-- Part of HAC-52. Client assistant proposals share the existing domain commands.
begin;
create table private.v2_client_action_confirmations (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id),
 member_id uuid not null references public.organization_members(id),
 action text not null check(action in ('facility.create','facility.revise','organization.revise','cargo-profile.create','cargo-profile.revise','preferences.create','preferences.revise')),
 resource_id uuid, expected_version integer check(expected_version>0),
 idempotency_key uuid not null, proposed_value jsonb not null,
 payload_hash text not null check(payload_hash ~ '^[0-9a-f]{64}$'),
 created_at timestamptz not null default now(), expires_at timestamptz not null default now()+interval '10 minutes',
 confirmed_at timestamptz, result jsonb,
 unique(organization_id,member_id,idempotency_key),
 check((action like '%.create')=(resource_id is null)),
 check((action like '%.create')=(expected_version is null)),
 check((confirmed_at is null)=(result is null))
);
create index v2_client_confirmation_scope_idx on private.v2_client_action_confirmations(organization_id,member_id,expires_at);
alter table private.v2_client_action_confirmations enable row level security;
revoke all on private.v2_client_action_confirmations from public,anon,authenticated,service_role;

create function private.authorize_v2_client_action(p_org uuid,p_member uuid,p_action text) returns void
language plpgsql security invoker set search_path='' as $$declare r text;begin
 select m.role into r from public.organization_members m join public.organizations o on o.id=m.organization_id
 where m.id=p_member and m.organization_id=p_org and m.auth_user_id=auth.uid() and m.status='ACTIVE' and o.status='ACTIVE';
 if r is null or r not in ('OWNER','SUPERVISOR') or (p_action in ('organization.revise','preferences.create','preferences.revise') and r<>'OWNER')
 then raise exception 'FORBIDDEN_TENANT' using errcode='PT403';end if;
end;$$;
revoke all on function private.authorize_v2_client_action(uuid,uuid,text) from public,anon,authenticated,service_role;

create function public.prepare_v2_client_action(p_organization_id uuid,p_member_id uuid,p_action text,
 p_resource_id uuid,p_expected_version integer,p_idempotency_key uuid,p_value jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c private.v2_client_action_confirmations;h text;begin
 perform private.authorize_v2_client_action(p_organization_id,p_member_id,p_action);
 if p_action not in ('facility.create','facility.revise','organization.revise','cargo-profile.create','cargo-profile.revise','preferences.create','preferences.revise')
  or p_idempotency_key is null or p_value is null then raise exception 'VALIDATION_ERROR' using errcode='PT400';end if;
 if p_action='organization.revise' and p_resource_id is distinct from p_organization_id
  or p_action='facility.revise' and not exists(select 1 from public.facilities where id=p_resource_id and organization_id=p_organization_id)
  or p_action='cargo-profile.revise' and not exists(select 1 from public.organization_cargo_profiles where id=p_resource_id and organization_id=p_organization_id)
  or p_action='preferences.revise' and not exists(select 1 from public.organization_preferences where id=p_resource_id and organization_id=p_organization_id)
 then raise exception 'FORBIDDEN_TENANT' using errcode='PT403';end if;
 h:=encode(extensions.digest(convert_to(jsonb_build_object('action',p_action,'id',p_resource_id,'expectedVersion',p_expected_version,'value',p_value)::text,'UTF8'),'sha256'),'hex');
 perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text||p_member_id::text||p_idempotency_key::text,52));
 select * into c from private.v2_client_action_confirmations where organization_id=p_organization_id and member_id=p_member_id and idempotency_key=p_idempotency_key for update;
 if found then
  if c.payload_hash<>h then raise exception 'IDEMPOTENCY_CONFLICT' using errcode='PT409';end if;
 else
  insert into private.v2_client_action_confirmations(organization_id,member_id,action,resource_id,expected_version,idempotency_key,proposed_value,payload_hash)
   values(p_organization_id,p_member_id,p_action,p_resource_id,p_expected_version,p_idempotency_key,p_value,h) returning * into c;
 end if;
 return jsonb_build_object('id',c.id,'organizationId',c.organization_id,'memberId',c.member_id,'action',c.action,'resourceId',c.resource_id,
  'expectedVersion',c.expected_version,'proposedValue',c.proposed_value,'expiresAt',c.expires_at,'requiresConfirmation',true);
end;$$;

create function public.confirm_v2_client_action(p_organization_id uuid,p_member_id uuid,p_confirmation_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c private.v2_client_action_confirmations;result jsonb;target uuid;begin
 select * into c from private.v2_client_action_confirmations where id=p_confirmation_id and organization_id=p_organization_id and member_id=p_member_id for update;
 if not found then raise exception 'CONFIRMATION_NOT_FOUND' using errcode='PT404';end if;
 perform private.authorize_v2_client_action(p_organization_id,p_member_id,c.action);
 if c.result is null then
  if c.expires_at<=now() then raise exception 'CONFIRMATION_EXPIRED' using errcode='PT409';end if;
  case c.action
   when 'facility.create','facility.revise' then result:=private.command_v2_facility(c.organization_id,c.member_id,c.idempotency_key,c.resource_id,c.expected_version,c.proposed_value);
   when 'organization.revise' then result:=private.command_v2_organization(c.organization_id,c.member_id,c.idempotency_key,c.expected_version,c.proposed_value);
   else result:=private.command_v2_catalog(c.organization_id,c.member_id,case when c.action like 'cargo-profile.%' then 'cargo-profiles' else 'preferences' end,
    null,null,c.resource_id,c.idempotency_key,c.expected_version,c.proposed_value);
  end case;
  target:=coalesce(result#>>'{row,id}',result#>>'{record,id}')::uuid;
  if target is null then raise exception 'CLIENT_COMMAND_RESULT_INVALID';end if;
  update private.v2_client_action_confirmations set confirmed_at=now(),result=jsonb_build_object('action',c.action,'id',target) where id=c.id;
  return jsonb_build_object('action',c.action,'id',target,'idempotentReplay',false);
 end if;
 return c.result||jsonb_build_object('idempotentReplay',true);
end;$$;
revoke all on function public.prepare_v2_client_action(uuid,uuid,text,uuid,integer,uuid,jsonb),public.confirm_v2_client_action(uuid,uuid,uuid) from public,anon,service_role;
grant execute on function public.prepare_v2_client_action(uuid,uuid,text,uuid,integer,uuid,jsonb),public.confirm_v2_client_action(uuid,uuid,uuid) to authenticated;
notify pgrst,'reload schema';
commit;

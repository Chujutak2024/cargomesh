-- HAC-41. Confirmations are bound to actor/client, payload, expiry and retry key.
create table private.v2_mcp_confirmations (
 id uuid primary key default gen_random_uuid(),auth_user_id uuid not null references auth.users(id),
 organization_id uuid not null,member_id uuid not null,oauth_client_id text,
 action text not null,context jsonb not null,value jsonb not null,idempotency_key uuid not null,
 payload_hash text not null check(payload_hash~'^[0-9a-f]{64}$'),
 expires_at timestamptz not null default now()+interval '5 minutes',confirmed_at timestamptz,
 unique(auth_user_id,idempotency_key),
 foreign key(member_id,organization_id,auth_user_id) references public.organization_members(id,organization_id,auth_user_id)
);
alter table private.v2_mcp_confirmations enable row level security;
create index v2_mcp_confirmations_member_idx on private.v2_mcp_confirmations(member_id,organization_id,auth_user_id);
revoke all on private.v2_mcp_confirmations from public,anon,authenticated,service_role;
create function private.identity_mcp_actor(o uuid,m uuid) returns void language plpgsql
security definer set search_path='' as $$declare client text:=auth.jwt()->>'client_id';begin
 perform private.workflow_member(o,m,false);
 if client is not null and not exists(select 1 from public.mcp_account_links l
  join private.mcp_oauth_clients c on c.client_id=l.oauth_client_id and c.enabled
  where l.auth_user_id=auth.uid() and l.organization_member_id=m and l.organization_id=o
  and l.oauth_client_id=client and l.provider=c.provider and l.external_subject_ref=auth.uid()::text
  and l.verified_at is not null and l.verified_at<=now() and l.status='ACTIVE' and l.revoked_at is null
  and l.expires_at>now() and l.scopes=array['mcp:tools']) then
  raise exception 'LINK_REVOKED_OR_EXPIRED' using errcode='PT403';end if;
end;$$;
create function private.mcp_confirmation_record(i uuid) returns jsonb language sql stable
security definer set search_path='' as $$select jsonb_build_object('id',id,'action',action,'context',context,
 'proposedValue',value,'payloadHash',payload_hash,'expiresAt',expires_at,'confirmationRequired',true)
 from private.v2_mcp_confirmations where id=i;$$;
create function public.check_v2_mcp_actor(p_organization_id uuid,p_member_id uuid) returns boolean
language plpgsql security definer set search_path='' as $$begin
 perform private.identity_mcp_actor(p_organization_id,p_member_id);return true;
end;$$;
create function public.prepare_v2_mcp_workflow(p_organization_id uuid,p_member_id uuid,p_action text,
 p_context jsonb,p_key uuid,p_value jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r private.v2_mcp_confirmations;h text;c uuid:=(p_context->>'carrierId')::uuid;begin
 perform private.identity_mcp_actor(p_organization_id,p_member_id);
 if c is null then perform private.workflow_member(p_organization_id,p_member_id,true);else perform private.identity_carrier(c);end if;
 if p_key is null or p_context is null or jsonb_typeof(p_context)<>'object'
  or (p_context-'carrierId'-'requestId'-'parentId'-'id')<>'{}'
  or p_action not in ('opportunities.create','opportunities.respond','offers.create','offers.withdraw',
   'decisions.create','decisions.revoke','bookings.create','bookings.confirm','bookings.cancel',
   'holds.create','holds.confirm','holds.release','executions.create','executions.start','executions.complete',
   'executions.cancel','executions.position','incidents.create','incidents.update','incidents.conditions',
   'consolidations.create','consolidations.close','consolidations.start','consolidations.complete',
   'consolidations.cancel','consolidations.position') then raise exception 'VALIDATION_ERROR' using errcode='PT400';end if;
 if p_action<>'incidents.conditions' then perform private.workflow_validate(p_action,p_value);end if;
 perform private.workflow_validate_periods(p_value);
 h:=private.hash_v2_freight_payload(jsonb_build_object('action',p_action,'context',p_context,'value',p_value));
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':mcp-confirm:'||p_key::text,0));
 select * into r from private.v2_mcp_confirmations where auth_user_id=auth.uid() and idempotency_key=p_key for update;
 if found then
  if r.payload_hash<>h or r.organization_id<>p_organization_id or r.member_id<>p_member_id
   or r.oauth_client_id is distinct from auth.jwt()->>'client_id' then raise exception 'IDEMPOTENCY_CONFLICT' using errcode='PT409';end if;
  if r.expires_at<=now() and r.confirmed_at is null then raise exception 'CONFIRMATION_EXPIRED' using errcode='PT409';end if;
 else
  insert into private.v2_mcp_confirmations(auth_user_id,organization_id,member_id,oauth_client_id,action,context,value,idempotency_key,payload_hash)
   values(auth.uid(),p_organization_id,p_member_id,auth.jwt()->>'client_id',p_action,p_context,p_value,p_key,h) returning * into r;
 end if;
 return private.mcp_confirmation_record(r.id);
end;$$;
create function public.confirm_v2_mcp_workflow(p_organization_id uuid,p_member_id uuid,p_id uuid,p_confirmed boolean)
returns jsonb language plpgsql security definer set search_path='' as $$declare r private.v2_mcp_confirmations;result jsonb;c uuid;op uuid;begin
 perform private.identity_mcp_actor(p_organization_id,p_member_id);
 if not coalesce(p_confirmed,false) then raise exception 'CONFIRMATION_REQUIRED' using errcode='PT400';end if;
 select * into r from private.v2_mcp_confirmations where id=p_id and auth_user_id=auth.uid()
  and organization_id=p_organization_id and member_id=p_member_id for update;
 if r.id is null then raise exception 'CONFIRMATION_NOT_FOUND' using errcode='PT404';end if;
 if r.oauth_client_id is distinct from auth.jwt()->>'client_id' then raise exception 'FORBIDDEN_IDENTITY' using errcode='PT403';end if;
 if r.expires_at<=now() and r.confirmed_at is null then raise exception 'CONFIRMATION_EXPIRED' using errcode='PT409';end if;
 c:=(r.context->>'carrierId')::uuid;
 if c is null then
  result:=private.command_v2_workflow(p_organization_id,p_member_id,r.action,r.context,r.idempotency_key,r.value);
 else
  op:=private.identity_carrier(c);
  result:=public.command_v2_carrier_workflow(op,r.action,r.context,r.idempotency_key,r.value);
 end if;
 update private.v2_mcp_confirmations set confirmed_at=coalesce(confirmed_at,now()) where id=r.id;
 return result||jsonb_build_object('confirmation',private.mcp_confirmation_record(r.id));
end;$$;

-- Resolve only authorized saved facilities and published nodes. No fabricated geocoding.
create function public.read_v2_location_candidates(p_organization_id uuid,p_member_id uuid,p_query jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$declare rows jsonb;begin
 perform private.workflow_member(p_organization_id,p_member_id,false);
 if not coalesce(extensions.jsonb_matches_schema('{"oneOf":[{"type":"object","additionalProperties":false,"required":["kind","text"],"properties":{"kind":{"const":"TEXT"},"text":{"type":"string","minLength":2,"maxLength":200}}},{"type":"object","additionalProperties":false,"required":["kind","lat","lng","radiusMeters"],"properties":{"kind":{"const":"COORDINATES"},"lat":{"type":"number","minimum":-90,"maximum":90},"lng":{"type":"number","minimum":-180,"maximum":180},"radiusMeters":{"type":"number","minimum":1,"maximum":5000}}}]}',p_query),false) then
  raise exception 'VALIDATION_ERROR' using errcode='PT400';end if;
 with candidates as (
  select id,'FACILITY'::text as kind,version,
   jsonb_build_object('facilityId',id,'label',name,'countryCode',country_code,'region',region_code,
    'city',city,'lat',latitude,'lng',longitude) as location,
   jsonb_build_object('reference','facilities/'||id::text,'provider','CARGOMESH_PERSISTED_FACILITY',
    'observedAt',updated_at,'validUntil',null,'provenanceStatus','UNKNOWN') as source
  from public.facilities where organization_id=p_organization_id and active
  union all
  select id,'NODE',version,jsonb_build_object('facilityId',null,'label',data->>'name','countryCode',data#>>'{location,countryCode}',
   'region',data#>>'{location,region}','city',data#>>'{location,city}','lat',data#>'{location,lat}','lng',data#>'{location,lng}'),data->'source'
  from public.logistics_nodes where status='ACTIVE' and (organization_id is null or organization_id=p_organization_id)
 ), matches as (
  select * from candidates where
   (p_query->>'kind'='TEXT' and position(lower(trim(p_query->>'text')) in lower((location->>'label')||' '||(location->>'city')))>0)
   or (p_query->>'kind'='COORDINATES' and location->>'lat' is not null and location->>'lng' is not null
    and 2*6371000*asin(sqrt(least(1.0,
     power(sin(radians((location->>'lat')::numeric-(p_query->>'lat')::numeric)/2),2)
     +cos(radians((p_query->>'lat')::numeric))*cos(radians((location->>'lat')::numeric))
     *power(sin(radians((location->>'lng')::numeric-(p_query->>'lng')::numeric)/2),2))))<=(p_query->>'radiusMeters')::numeric)
  order by kind,id limit 51
 ) select coalesce(jsonb_agg(jsonb_build_object('id',id,'kind',kind,'version',version,'location',location,'source',source)),'[]') into rows from matches;
 return rows;
end;$$;
revoke all on function private.identity_mcp_actor(uuid,uuid),private.mcp_confirmation_record(uuid)
 from public,anon,authenticated,service_role;
revoke all on function public.prepare_v2_mcp_workflow(uuid,uuid,text,jsonb,uuid,jsonb),
 public.confirm_v2_mcp_workflow(uuid,uuid,uuid,boolean),public.read_v2_location_candidates(uuid,uuid,jsonb),public.check_v2_mcp_actor(uuid,uuid)
 from public,anon,service_role;
grant execute on function public.prepare_v2_mcp_workflow(uuid,uuid,text,jsonb,uuid,jsonb),
 public.confirm_v2_mcp_workflow(uuid,uuid,uuid,boolean),public.read_v2_location_candidates(uuid,uuid,jsonb),public.check_v2_mcp_actor(uuid,uuid) to authenticated;

-- HAC-41. Additive identity metadata and consent; no demo identities or grants.
alter table public.organization_members add column verified_at timestamptz,
 add column version integer not null default 1 check(version>0);
alter table public.carrier_operators add column version integer not null default 1 check(version>0);
alter table public.mcp_account_links add column provider text check(provider in ('ALEXA_PLUS','OTHER')),
 add column external_subject_ref text check(length(external_subject_ref) between 1 and 256),
 add column verified_at timestamptz,
 add column version integer not null default 1 check(version>0);
-- Older links retain their history. MCP authentication rejects unverified metadata
-- until the user gives new, client-bound consent. Never invent provider identities.
create table private.mcp_oauth_clients (
 client_id text primary key check(length(client_id) between 1 and 256 and client_id !~ '[[:space:]]'),
 provider text not null check(provider in ('ALEXA_PLUS','OTHER')),
 enabled boolean not null default false,
 maximum_lifetime_seconds integer not null default 3600 check(maximum_lifetime_seconds between 60 and 86400)
);
alter table private.mcp_oauth_clients enable row level security;
revoke all on private.mcp_oauth_clients from public,anon,authenticated,service_role;

create table public.response_integrations (
 id uuid primary key default gen_random_uuid(), carrier_id uuid not null references public.carriers(id),
 carrier_service_id uuid not null, channel text not null check(channel in ('MANUAL','API','MCP')),
 endpoint_ref text check(endpoint_ref ~ '^(vault://[0-9a-f-]{36}|env://[A-Z][A-Z0-9_]{0,100})$'),
 verified_at timestamptz, status text not null check(status in ('PENDING','ACTIVE','DISABLED','ERROR')),
 evidence text check(length(evidence)<=500), version integer not null default 1 check(version>0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(carrier_service_id,carrier_id) references public.carrier_services(id,carrier_id),
 unique(carrier_service_id,channel),
 check((channel='MANUAL' and endpoint_ref is null) or (channel<>'MANUAL' and endpoint_ref is not null)),
 check(status<>'ACTIVE' or verified_at is not null)
);
create index response_integrations_carrier_idx on public.response_integrations(carrier_id,status);
create index response_integrations_service_idx on public.response_integrations(carrier_service_id,carrier_id);
alter table public.response_integrations enable row level security;
revoke all on public.response_integrations from public,anon,authenticated,service_role;
grant select on public.response_integrations to authenticated;

create function private.identity_carrier(c uuid) returns uuid language plpgsql
security definer set search_path='' as $$declare op uuid;begin
 perform private.workflow_carrier(c);
 select o.id into op from public.carrier_operators o join public.carriers carrier on carrier.id=o.carrier_id
  where o.carrier_id=c and o.auth_user_id=auth.uid() and carrier.status='ACTIVE'
  and o.status='ACTIVE' and o.verified_at is not null and o.verified_at<=now() and o.role in ('ADMIN','OPERATOR','DISPATCHER');
 if op is null then raise exception 'FORBIDDEN_CARRIER_IDENTITY' using errcode='PT403';end if;
 return op;
end;$$;
create function private.identity_carrier_read(c uuid) returns boolean language sql stable
security definer set search_path='' as $$
 select exists(select 1 from private.v2_catalog_grants g where g.auth_user_id=auth.uid()
  and g.revoked_at is null and (g.expires_at is null or g.expires_at>now())
  and (g.permission='CATALOG_ADMIN' or g.permission='CARRIER_EDITOR' and g.carrier_id=c))
 and exists(select 1 from public.carrier_operators op join public.carriers carrier on carrier.id=op.carrier_id
  where op.carrier_id=c and op.auth_user_id=auth.uid() and carrier.status='ACTIVE'
  and op.status='ACTIVE' and op.verified_at is not null and op.verified_at<=now() and op.role in ('ADMIN','OPERATOR','DISPATCHER'));
$$;
create policy response_integrations_carrier_read on public.response_integrations
 for select to authenticated using(private.identity_carrier_read(carrier_id));
-- Self lookup is sufficient for middleware; no write grants and no foreign operators.
grant select on public.carrier_operators to authenticated;
create policy carrier_operators_own_identity on public.carrier_operators for select to authenticated
 using(auth_user_id=(select auth.uid()));
create function public.get_v2_carrier_identity(p_carrier_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$declare i uuid;begin
 i:=private.identity_carrier(p_carrier_id);
 return jsonb_build_object('operatorId',i,'carrierId',p_carrier_id);
end;$$;
revoke all on function public.get_v2_carrier_identity(uuid) from public,anon,service_role;
grant execute on function public.get_v2_carrier_identity(uuid) to authenticated;
create function private.identity_link_active(i uuid) returns boolean language sql stable
security definer set search_path='' as $$select exists(
 select 1 from public.mcp_account_links l join private.mcp_oauth_clients c on c.client_id=l.oauth_client_id and c.enabled
 join public.organization_members m on m.id=l.organization_member_id and m.organization_id=l.organization_id and m.auth_user_id=l.auth_user_id
 join public.organizations o on o.id=m.organization_id
 where l.id=i and l.auth_user_id=auth.uid() and l.status='ACTIVE' and l.revoked_at is null
 and l.expires_at>now() and l.provider=c.provider and l.external_subject_ref=auth.uid()::text
 and l.verified_at is not null and l.verified_at<=now() and m.status='ACTIVE' and o.status='ACTIVE');$$;
revoke all on function private.identity_link_active(uuid) from public,anon,authenticated,service_role;
grant execute on function private.identity_link_active(uuid) to authenticated;
alter policy mcp_account_links_owner_select on public.mcp_account_links using(private.identity_link_active(id));

create table private.v2_identity_receipts (
 auth_user_id uuid not null references auth.users(id), idempotency_key uuid not null,
 payload_hash text not null check(payload_hash~'^[0-9a-f]{64}$'), result jsonb not null,
 created_at timestamptz not null default now(), primary key(auth_user_id,idempotency_key)
);
alter table private.v2_identity_receipts enable row level security;
revoke all on private.v2_identity_receipts from public,anon,authenticated,service_role;

create function public.read_v2_identity(p_kind text,p_organization_id uuid,p_carrier_id uuid,p_limit integer,p_offset integer)
returns jsonb language plpgsql security definer set search_path='' as $$declare rows jsonb;begin
 if auth.uid() is null then raise exception 'UNAUTHORIZED' using errcode='PT403';end if;
 if p_limit is null or p_limit not between 1 and 100 or p_offset is null or p_offset not between 0 and 100000 then
  raise exception 'VALIDATION_ERROR' using errcode='PT400';end if;
 if p_kind='members' then
  if not exists(select 1 from public.organization_members m join public.organizations o on o.id=m.organization_id
   where m.auth_user_id=auth.uid() and m.organization_id=p_organization_id and m.status='ACTIVE' and o.status='ACTIVE')
   then raise exception 'FORBIDDEN_TENANT' using errcode='PT403';end if;
  select coalesce(jsonb_agg(jsonb_build_object('kind','members','value',jsonb_build_object('id',id,
   'organizationId',organization_id,'role',role,'status',status,'contactRef',corporate_email,
   'verifiedAt',verified_at,'version',version))),'[]') into rows from
   (select * from public.organization_members where organization_id=p_organization_id
    and (auth_user_id=auth.uid() or exists(select 1 from public.organization_members own
     where own.auth_user_id=auth.uid() and own.organization_id=p_organization_id and own.status='ACTIVE' and own.role='OWNER'))
    order by created_at,id limit p_limit offset p_offset) m;
 elsif p_kind='operators' then
  perform private.identity_carrier(p_carrier_id);
  select coalesce(jsonb_agg(jsonb_build_object('kind','operators','value',jsonb_build_object('id',id,
   'carrierId',carrier_id,'displayName',display_name,'role',role,'email',email,'phone',phone,
   'status',status,'verifiedAt',verified_at,'version',version))),'[]') into rows from
   (select * from public.carrier_operators where carrier_id=p_carrier_id order by created_at,id limit p_limit offset p_offset) o;
 elsif p_kind='integrations' then
  perform private.identity_carrier(p_carrier_id);
  select coalesce(jsonb_agg(jsonb_build_object('kind','integrations','value',jsonb_build_object('id',id,
   'carrierId',carrier_id,'serviceId',carrier_service_id,'channel',channel,'endpointRef',endpoint_ref,
   'verifiedAt',verified_at,'status',status,'evidence',evidence,'version',version))),'[]') into rows from
   (select * from public.response_integrations where carrier_id=p_carrier_id order by created_at,id limit p_limit offset p_offset) r;
 elsif p_kind='links' then
  select coalesce(jsonb_agg(private.identity_link_record(id)),'[]') into rows from
   (select id from public.mcp_account_links where auth_user_id=auth.uid() order by created_at,id limit p_limit offset p_offset) l;
 else raise exception 'VALIDATION_ERROR' using errcode='PT400';end if;
 return rows;
end;$$;
create function private.identity_link_record(i uuid) returns jsonb language sql stable
security definer set search_path='' as $$ select jsonb_build_object('kind','links','value',jsonb_build_object(
 'id',id,'authUserId',auth_user_id,'organizationId',organization_id,'organizationMemberId',organization_member_id,
 'oauthClientId',oauth_client_id,'scopes',scopes,'provider',provider,'externalSubjectRef',external_subject_ref,
 'status',status,'verifiedAt',verified_at,'expiresAt',expires_at,'revokedAt',revoked_at,'version',version))
 from public.mcp_account_links where id=i;$$;

create function public.command_v2_mcp_link(p_organization_id uuid,p_action text,p_id uuid,p_key uuid,p_value jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor public.organization_members;client private.mcp_oauth_clients;link public.mcp_account_links;
 receipt private.v2_identity_receipts;h text;r jsonb;requested_client text:=p_value->>'oauthClientId';expected integer;begin
 if auth.uid() is null then raise exception 'UNAUTHORIZED' using errcode='PT403';end if;
 if p_key is null or p_value is null or jsonb_typeof(p_value)<>'object' then raise exception 'VALIDATION_ERROR' using errcode='PT400';end if;
 -- Ownership/consent and active member are rechecked BEFORE any receipt/replay.
 if p_action='consent' then
  if (p_value-'oauthClientId'-'expectedVersion'-'consent')<>'{}' or p_value->'consent' is distinct from 'true'::jsonb or p_id is not null
   then raise exception 'CONSENT_REQUIRED' using errcode='PT400';end if;
  select * into actor from public.organization_members where organization_id=p_organization_id
   and auth_user_id=auth.uid() and status='ACTIVE';
  if actor.id is null or not exists(select 1 from public.organizations where id=p_organization_id and status='ACTIVE') then
   raise exception 'FORBIDDEN_TENANT' using errcode='PT403';end if;
  select * into client from private.mcp_oauth_clients where client_id=requested_client and enabled;
  if client.client_id is null or auth.jwt()->>'client_id' is distinct from requested_client then
   raise exception 'OAUTH_CLIENT_NOT_VERIFIED' using errcode='PT403';end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':link:'||requested_client,0));
  select * into link from public.mcp_account_links where auth_user_id=auth.uid() and oauth_client_id=requested_client for update;
 elsif p_action='revoke' then
  if (p_value-'expectedVersion'-'reason')<>'{}' or nullif(trim(p_value->>'reason'),'') is null or length(p_value->>'reason')>500
   then raise exception 'VALIDATION_ERROR' using errcode='PT400';end if;
  select * into link from public.mcp_account_links where id=p_id and auth_user_id=auth.uid() for update;
  if link.id is null then raise exception 'IDENTITY_NOT_FOUND' using errcode='PT404';end if;
 else raise exception 'VALIDATION_ERROR' using errcode='PT400';end if;
 h:=private.hash_v2_freight_payload(jsonb_build_object('action',p_action,'id',p_id,'organizationId',p_organization_id,'value',p_value));
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':identity:'||p_key::text,0));
 select * into receipt from private.v2_identity_receipts where auth_user_id=auth.uid() and idempotency_key=p_key;
 if found then
  if receipt.payload_hash<>h then raise exception 'IDEMPOTENCY_CONFLICT' using errcode='PT409';end if;
  if p_action='consent' and (link.status<>'ACTIVE' or link.revoked_at is not null or link.expires_at<=now()
   or link.organization_id is distinct from p_organization_id or link.external_subject_ref is distinct from auth.uid()::text) then
   raise exception 'LINK_REVOKED_OR_EXPIRED' using errcode='PT403';end if;
  return jsonb_build_object('record',receipt.result,'replay',true);
 end if;
 if jsonb_typeof(p_value->'expectedVersion') is distinct from 'number'
  or (p_value->>'expectedVersion')!~'^[0-9]+$' then raise exception 'VALIDATION_ERROR' using errcode='PT400';end if;
 expected:=(p_value->>'expectedVersion')::integer;
 if expected is null or expected<>coalesce(link.version,0) then raise exception 'STALE_DRAFT' using errcode='PT409';end if;
 if p_action='consent' then
  insert into public.mcp_account_links(auth_user_id,organization_member_id,oauth_client_id,organization_id,scopes,
   provider,external_subject_ref,status,verified_at,linked_at,expires_at,linked_by_user_id)
  values(auth.uid(),actor.id,client.client_id,actor.organization_id,array['mcp:tools'],client.provider,
   auth.uid()::text,'ACTIVE',now(),now(),now()+make_interval(secs=>client.maximum_lifetime_seconds),auth.uid())
  on conflict(auth_user_id,oauth_client_id) do update set organization_member_id=excluded.organization_member_id,
   organization_id=excluded.organization_id,provider=excluded.provider,external_subject_ref=excluded.external_subject_ref,
   status='ACTIVE',verified_at=now(),linked_at=now(),expires_at=excluded.expires_at,linked_by_user_id=auth.uid(),
   revoked_at=null,revoked_by_user_id=null,revocation_reason=null,version=mcp_account_links.version+1,updated_at=now()
  returning * into link;
 else
  update public.mcp_account_links set status='REVOKED',revoked_at=now(),revoked_by_user_id=auth.uid(),
   revocation_reason=p_value->>'reason',version=version+1,updated_at=now() where id=link.id returning * into link;
 end if;
 r:=private.identity_link_record(link.id);
 insert into private.v2_identity_receipts(auth_user_id,idempotency_key,payload_hash,result) values(auth.uid(),p_key,h,r);
 return jsonb_build_object('record',r,'replay',false);
end;$$;
revoke all on function private.identity_carrier(uuid),private.identity_carrier_read(uuid),private.identity_link_record(uuid)
 from public,anon,authenticated,service_role;
grant execute on function private.identity_carrier_read(uuid) to authenticated;
revoke all on function public.read_v2_identity(text,uuid,uuid,integer,integer),
 public.command_v2_mcp_link(uuid,text,uuid,uuid,jsonb) from public,anon,service_role;
grant execute on function public.read_v2_identity(text,uuid,uuid,integer,integer),
 public.command_v2_mcp_link(uuid,text,uuid,uuid,jsonb) to authenticated;

create function public.command_v2_response_integration(p_carrier_id uuid,p_key uuid,p_value jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare op uuid;integration public.response_integrations;receipt private.v2_identity_receipts;
 service_id uuid:=(p_value->>'serviceId')::uuid;ch text:=p_value->>'channel';h text;r jsonb;begin
 op:=private.identity_carrier(p_carrier_id);
 if not exists(select 1 from public.carrier_operators where id=op and role='ADMIN') then
  raise exception 'FORBIDDEN_CARRIER_ROLE' using errcode='PT403';end if;
 if p_key is null or not coalesce(extensions.jsonb_matches_schema(
  '{"type":"object","additionalProperties":false,"required":["serviceId","channel","endpointRef","enabled","expectedVersion"],"properties":{"serviceId":{"type":"string","format":"uuid"},"channel":{"enum":["MANUAL","API","MCP"]},"endpointRef":{"anyOf":[{"type":"null"},{"type":"string","pattern":"^(vault://[0-9a-f-]{36}|env://[A-Z][A-Z0-9_]{0,100})$"}]},"enabled":{"type":"boolean"},"expectedVersion":{"type":"integer","minimum":0}}}',p_value),false)
  or (ch='MANUAL')<>(p_value->>'endpointRef' is null) then raise exception 'VALIDATION_ERROR' using errcode='PT400';end if;
 if not exists(select 1 from public.carrier_services where id=service_id and carrier_id=p_carrier_id) then
  raise exception 'IDENTITY_NOT_FOUND' using errcode='PT404';end if;
 h:=private.hash_v2_freight_payload(jsonb_build_object('action','integration.configure','carrierId',p_carrier_id,'value',p_value));
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':identity:'||p_key::text,0));
 select * into receipt from private.v2_identity_receipts where auth_user_id=auth.uid() and idempotency_key=p_key;
 if found then
  if receipt.payload_hash<>h then raise exception 'IDEMPOTENCY_CONFLICT' using errcode='PT409';end if;
  return jsonb_build_object('record',receipt.result,'replay',true);
 end if;
 perform pg_advisory_xact_lock(hashtextextended(service_id::text||':integration:'||ch,0));
 select * into integration from public.response_integrations where carrier_service_id=service_id and channel=ch for update;
 if (p_value->>'expectedVersion')::integer<>coalesce(integration.version,0) then raise exception 'STALE_DRAFT' using errcode='PT409';end if;
 insert into public.response_integrations(carrier_id,carrier_service_id,channel,endpoint_ref,status,verified_at,evidence)
 values(p_carrier_id,service_id,ch,p_value->>'endpointRef',
  case when not (p_value->>'enabled')::boolean then 'DISABLED' when ch='MANUAL' then 'ACTIVE' else 'PENDING' end,
  case when (p_value->>'enabled')::boolean and ch='MANUAL' then now() end,
  case when (p_value->>'enabled')::boolean and ch='MANUAL' then 'verified-operator:'||op::text end)
 on conflict(carrier_service_id,channel) do update set endpoint_ref=excluded.endpoint_ref,status=excluded.status,
  verified_at=excluded.verified_at,evidence=excluded.evidence,version=response_integrations.version+1,updated_at=now()
 returning * into integration;
 r:=jsonb_build_object('kind','integrations','value',jsonb_build_object('id',integration.id,
  'carrierId',integration.carrier_id,'serviceId',integration.carrier_service_id,'channel',integration.channel,
  'endpointRef',integration.endpoint_ref,'verifiedAt',integration.verified_at,'status',integration.status,
  'evidence',integration.evidence,'version',integration.version));
 insert into private.v2_identity_receipts(auth_user_id,idempotency_key,payload_hash,result) values(auth.uid(),p_key,h,r);
 return jsonb_build_object('record',r,'replay',false);
end;$$;
create function public.diagnose_v2_response_integration(p_carrier_id uuid,p_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$declare r public.response_integrations;begin
 perform private.identity_carrier(p_carrier_id);
 select * into r from public.response_integrations where id=p_id and carrier_id=p_carrier_id;
 if r.id is null then raise exception 'IDENTITY_NOT_FOUND' using errcode='PT404';end if;
 return jsonb_build_object('id',r.id,'carrierId',r.carrier_id,'serviceId',r.carrier_service_id,'channel',r.channel,
  'status',r.status,'referenceConfigured',r.endpoint_ref is not null,'verifiedAt',r.verified_at,
  'diagnosticScope','PERSISTED_CONFIGURATION','liveIntegrationConfirmed',false,
  'blockedBy',case when r.status='DISABLED' then 'DISABLED' when r.channel='MANUAL' then 'NONE'
   else 'EXTERNAL_ADAPTER_VERIFICATION_REQUIRED' end);
end;$$;
revoke all on function public.command_v2_response_integration(uuid,uuid,jsonb),
 public.diagnose_v2_response_integration(uuid,uuid) from public,anon,service_role;
grant execute on function public.command_v2_response_integration(uuid,uuid,jsonb),
 public.diagnose_v2_response_integration(uuid,uuid) to authenticated;

create function private.identity_directory_record(k text,i uuid) returns jsonb language plpgsql
security definer set search_path='' as $$declare r jsonb;begin
 if k='members' then select jsonb_build_object('kind',k,'value',jsonb_build_object('id',id,'organizationId',organization_id,
  'role',role,'status',status,'contactRef',corporate_email,'verifiedAt',verified_at,'version',version)) into r
  from public.organization_members where id=i;
 else select jsonb_build_object('kind',k,'value',jsonb_build_object('id',id,'carrierId',carrier_id,'displayName',display_name,
  'role',role,'status',status,'email',email,'phone',phone,'verifiedAt',verified_at,'version',version)) into r
  from public.carrier_operators where id=i;end if;return r;
end;$$;
create function public.command_v2_identity_directory(p_kind text,p_action text,p_organization_id uuid,
 p_carrier_id uuid,p_id uuid,p_key uuid,p_value jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare m public.organization_members;op public.carrier_operators;actor uuid;target_user uuid;verified timestamptz;
 receipt private.v2_identity_receipts;h text;r jsonb;i uuid:=p_id;target_email text:=lower(trim(p_value->>'email'));begin
 if auth.uid() is null then raise exception 'UNAUTHORIZED' using errcode='PT403';end if;
 if p_key is null or p_value is null or jsonb_typeof(p_value)<>'object' or p_kind not in ('members','operators')
  or p_action not in ('invite','revise','accept') or p_kind='members' and p_carrier_id is not null
  or p_kind='operators' and p_organization_id is not null then raise exception 'VALIDATION_ERROR' using errcode='PT400';end if;
 if p_kind='members' then
  if p_action='accept' then
   if not exists(select 1 from public.organizations where id=p_organization_id and status='ACTIVE') then
    raise exception 'FORBIDDEN_TENANT' using errcode='PT403';end if;
   select * into m from public.organization_members where id=p_id and organization_id=p_organization_id and auth_user_id=auth.uid() for update;
  else
   if not exists(select 1 from public.organization_members own join public.organizations o on o.id=own.organization_id
    where own.organization_id=p_organization_id and own.auth_user_id=auth.uid() and own.role='OWNER' and own.status='ACTIVE' and o.status='ACTIVE') then
    raise exception 'FORBIDDEN_TENANT' using errcode='PT403';end if;
   if p_id is not null then select * into m from public.organization_members where id=p_id and organization_id=p_organization_id for update;end if;
  end if;
  if p_action<>'invite' and m.id is null then raise exception 'IDENTITY_NOT_FOUND' using errcode='PT404';end if;
  if m.role='OWNER' and p_action<>'accept' then raise exception 'OWNER_CHANGE_REQUIRES_GOVERNANCE' using errcode='PT403';end if;
 else
  if p_action='accept' then
   perform private.workflow_carrier(p_carrier_id);
   select * into op from public.carrier_operators where id=p_id and carrier_id=p_carrier_id and auth_user_id=auth.uid() for update;
  else
   actor:=private.identity_carrier(p_carrier_id);
   if not exists(select 1 from public.carrier_operators where id=actor and role='ADMIN') then raise exception 'FORBIDDEN_CARRIER_ROLE' using errcode='PT403';end if;
   if p_id is not null then select * into op from public.carrier_operators where id=p_id and carrier_id=p_carrier_id for update;end if;
  end if;
  if p_action<>'invite' and op.id is null then raise exception 'IDENTITY_NOT_FOUND' using errcode='PT404';end if;
  if op.id=actor then raise exception 'SELF_PERMISSION_CHANGE_FORBIDDEN' using errcode='PT403';end if;
 end if;
 if p_action='invite' then
  if p_id is not null or not(p_value ?& array['email','role']) or jsonb_typeof(p_value->'email')<>'string'
   or jsonb_typeof(p_value->'role')<>'string' or target_email is null or target_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
   or (p_kind='members' and ((p_value-'email'-'role')<>'{}' or p_value->>'role' not in ('REQUESTER','SUPERVISOR')))
   or (p_kind='operators' and ((p_value-'email'-'role'-'displayName')<>'{}' or p_value->>'role' not in ('ADMIN','OPERATOR','DISPATCHER')
    or nullif(trim(p_value->>'displayName'),'') is null or length(p_value->>'displayName')>200)) then raise exception 'VALIDATION_ERROR' using errcode='PT400';end if;
  select id into target_user from auth.users where lower(auth.users.email)=target_email and deleted_at is null;
  if target_user is null then raise exception 'AUTH_USER_NOT_PROVISIONED' using errcode='PT400';end if;
 elsif p_action='revise' then
  if not(p_value ?& array['expectedVersion','role','status']) or jsonb_typeof(p_value->'role')<>'string'
   or jsonb_typeof(p_value->'status')<>'string' or (p_value-'expectedVersion'-'role'-'status')<>'{}' or p_value->>'status' not in ('ACTIVE','INACTIVE')
   or p_value->>'role' not in ('REQUESTER','SUPERVISOR','ADMIN','OPERATOR','DISPATCHER')
   or p_kind='members' and p_value->>'role' not in ('REQUESTER','SUPERVISOR')
   or p_kind='operators' and p_value->>'role' not in ('ADMIN','OPERATOR','DISPATCHER') then raise exception 'VALIDATION_ERROR' using errcode='PT400';end if;
 else
  if (p_value-'expectedVersion'-'consent')<>'{}' or p_value->'consent' is distinct from 'true'::jsonb then raise exception 'CONSENT_REQUIRED' using errcode='PT400';end if;
  select email_confirmed_at into verified from auth.users where id=auth.uid() and deleted_at is null;
  if verified is null then raise exception 'EMAIL_NOT_VERIFIED' using errcode='PT403';end if;
 end if;
 h:=private.hash_v2_freight_payload(jsonb_build_object('kind',p_kind,'action',p_action,'organizationId',p_organization_id,'carrierId',p_carrier_id,'id',p_id,'value',p_value));
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':identity:'||p_key::text,0));
 select * into receipt from private.v2_identity_receipts where auth_user_id=auth.uid() and idempotency_key=p_key;
 if found then
  if receipt.payload_hash<>h then raise exception 'IDEMPOTENCY_CONFLICT' using errcode='PT409';end if;
  return jsonb_build_object('record',receipt.result,'replay',true);end if;
 if p_action<>'invite' and (jsonb_typeof(p_value->'expectedVersion') is distinct from 'number'
  or (p_value->>'expectedVersion')!~'^[1-9][0-9]*$') then raise exception 'VALIDATION_ERROR' using errcode='PT400';end if;
 if p_action<>'invite' and ((p_value->>'expectedVersion')::integer is null
  or (p_value->>'expectedVersion')::integer<>case when p_kind='members' then m.version else op.version end) then raise exception 'STALE_DRAFT' using errcode='PT409';end if;
 if p_kind='members' then
  if p_action='invite' then insert into public.organization_members(organization_id,auth_user_id,display_name,role,status,corporate_email)
   values(p_organization_id,target_user,target_email,p_value->>'role','INVITED',target_email) returning id into i;
  else
   if p_action='accept' and not(m.status='INVITED' or m.status='ACTIVE' and m.verified_at is null)
    then raise exception 'INVALID_IDENTITY_STATE' using errcode='PT409';end if;
   if p_action='revise' and p_value->>'status'='ACTIVE' and m.verified_at is null then raise exception 'CONSENT_REQUIRED' using errcode='PT409';end if;
   update public.organization_members set role=case when p_action='accept' then role else p_value->>'role' end,
    status=case when p_action='accept' then 'ACTIVE' else p_value->>'status' end,
    verified_at=case when p_action='accept' then verified else verified_at end,version=version+1,updated_at=now() where id=i;
   if p_value->>'status'='INACTIVE' then update public.mcp_account_links set status='REVOKED',revoked_at=now(),
    revoked_by_user_id=auth.uid(),revocation_reason='MEMBERSHIP_REVOKED',version=version+1,updated_at=now()
    where organization_member_id=i and status='ACTIVE';end if;
  end if;
 else
  if p_action='invite' then insert into public.carrier_operators(carrier_id,auth_user_id,display_name,role,email,status)
   values(p_carrier_id,target_user,p_value->>'displayName',p_value->>'role',target_email,'INVITED') returning id into i;
  else
   if p_action='accept' and op.status<>'INVITED' then raise exception 'INVALID_IDENTITY_STATE' using errcode='PT409';end if;
   if p_action='revise' and p_value->>'status'='ACTIVE' and op.verified_at is null then raise exception 'CONSENT_REQUIRED' using errcode='PT409';end if;
   update public.carrier_operators set role=case when p_action='accept' then role else p_value->>'role' end,
    status=case when p_action='accept' then 'ACTIVE' else p_value->>'status' end,
    verified_at=case when p_action='accept' then verified else verified_at end,version=version+1,updated_at=now() where id=i;
  end if;
 end if;
 r:=private.identity_directory_record(p_kind,i);
 insert into private.v2_identity_receipts(auth_user_id,idempotency_key,payload_hash,result) values(auth.uid(),p_key,h,r);
 return jsonb_build_object('record',r,'replay',false);
end;$$;
revoke all on function private.identity_directory_record(text,uuid) from public,anon,authenticated,service_role;
revoke all on function public.command_v2_identity_directory(text,text,uuid,uuid,uuid,uuid,jsonb) from public,anon,service_role;
grant execute on function public.command_v2_identity_directory(text,text,uuid,uuid,uuid,uuid,jsonb) to authenticated;

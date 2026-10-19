-- LOCAL ONLY: execute in a transaction with cargomesh.test_access_manifest set.
-- Auth users must be created through the existing local Auth Admin API first.
-- No passwords, keys or new business orders belong in this scenario.
do $fixture$
declare
  fixture jsonb := current_setting('cargomesh.test_access_manifest', true)::jsonb;
  entry jsonb;
  org uuid;
  member uuid;
  operator uuid;
  uid uuid;
  profile text;
  label text;
  marker text;
begin
  select shobj_description(oid,'pg_database') into marker
  from pg_database where datname=current_database();
  if current_database()<>'hac50_scenario_fleet80_global_v1'
     or marker is distinct from 'LOCAL_ONLY:v2-carrier-fleet-80' then
    raise exception 'LOCAL_SCENARIO_DATABASE_REQUIRED';
  end if;
  if fixture->>'scenario' is distinct from 'v2-client-carrier-access-20261019'
     or jsonb_array_length(fixture->'accounts') is distinct from 3 then
    raise exception 'LOCAL_ACCESS_MANIFEST_REQUIRED';
  end if;
  for entry in select value from jsonb_array_elements(fixture->'accounts') loop
    uid := (entry->>'userId')::uuid;
    profile := entry->>'profile';
    if not exists(select 1 from auth.users u where u.id=uid
       and u.raw_app_meta_data->>'scenario'='v2-client-carrier-access-20261019'
       and u.raw_app_meta_data->>'test_profile'=profile) then
      raise exception 'NATIVE_SCENARIO_AUTH_IDENTITY_REQUIRED';
    end if;
    if profile in ('client','other-client') then
      if entry->>'role' is distinct from (case profile when 'client' then 'SUPERVISOR' else 'REQUESTER' end) then
        raise exception 'UNEXPECTED_CLIENT_ROLE';
      end if;
      org := (entry->>'organizationId')::uuid;
      member := (entry->>'memberId')::uuid;
      label := case profile when 'client' then '[SYNTHETIC] Cliente enlace nacional' else '[SYNTHETIC] Cliente aislamiento' end;
      insert into public.organizations(id,name,code,status,default_currency,country_code)
      values(org,label,'TEST-LINK-'||profile,'ACTIVE','USD','PE') on conflict(id) do nothing;
      insert into public.organization_members(id,organization_id,auth_user_id,display_name,corporate_email,role,status,verified_at)
      values(member,org,uid,label,entry->>'email',entry->>'role','ACTIVE',now()) on conflict(id) do nothing;
    elsif profile='carrier' then
      if entry->>'role' is distinct from 'OPERATOR'
         or entry->>'carrierId' is distinct from 'e5000001-0000-4000-8000-000000000001'
         or (entry->>'grantExpiresAt')::timestamptz<=now() then
        raise exception 'UNEXPECTED_CARRIER_SCOPE_OR_EXPIRED_GRANT';
      end if;
      operator := (entry->>'operatorId')::uuid;
      insert into public.carrier_operators(id,carrier_id,auth_user_id,display_name,role,email,status,verified_at)
      values(operator,(entry->>'carrierId')::uuid,uid,'[SYNTHETIC] Despacho enlace nacional',
             'OPERATOR',entry->>'email','ACTIVE',now()) on conflict(id) do nothing;
      insert into private.v2_catalog_grants(auth_user_id,carrier_id,permission,expires_at)
      select uid,(entry->>'carrierId')::uuid,'CARRIER_EDITOR',(entry->>'grantExpiresAt')::timestamptz
      where not exists(select 1 from private.v2_catalog_grants g where g.auth_user_id=uid
        and g.carrier_id=(entry->>'carrierId')::uuid and g.permission='CARRIER_EDITOR');
    else
      raise exception 'UNEXPECTED_SCENARIO_PROFILE';
    end if;
  end loop;
end;
$fixture$;

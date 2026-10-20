\set ON_ERROR_STOP on
\if :{?local_only}
\else
  \set local_only 0
\endif
\if :local_only
\else
  do $$ begin raise exception 'HAC54_LOCAL_OWNER_OPT_IN_REQUIRED'; end $$;
\endif
\if :{?owner_auth_id}
\else
  do $$ begin raise exception 'HAC54_LOCAL_OWNER_VERIFIED_AUTH_REQUIRED'; end $$;
\endif

-- Explicit local identity fixture only. Organization revision remains a native authenticated command.
begin;
select set_config('hac54.local_owner_auth_id', :'owner_auth_id', true);
do $$
declare
  uid uuid := current_setting('hac54.local_owner_auth_id')::uuid;
  org constant uuid := 'c2300000-0000-4000-8000-000000000001';
  member constant uuid := 'd54e0000-0000-4000-8000-000000000001';
  owner_email constant text := 'hac54.owner.local@cargomesh.test';
begin
  if not exists(select 1 from auth.users where id=uid and auth.users.email=owner_email and email_confirmed_at is not null
      and raw_user_meta_data->>'fixture'='HAC54 LOCAL_ONLY synthetic Client OWNER')
    or not exists(select 1 from public.organizations where id=org and code='QA-V2-A' and name like '[SYNTHETIC]%'
      and status='ACTIVE' and default_currency in ('PEN','USD')) then
    raise exception 'HAC54_LOCAL_OWNER_TARGET_MISMATCH';
  end if;
  if exists(select 1 from public.organization_members where (id=member or auth_user_id=uid)
      and (id<>member or auth_user_id<>uid or organization_id<>org or role<>'OWNER' or status<>'ACTIVE' or corporate_email<>owner_email)) then
    raise exception 'HAC54_LOCAL_OWNER_MEMBERSHIP_COLLISION';
  end if;
  insert into public.organization_members(id,organization_id,auth_user_id,display_name,corporate_email,role,status)
    values(member,org,uid,'[SYNTHETIC] HAC54 local Client owner',owner_email,'OWNER','ACTIVE') on conflict(id) do nothing;
  -- No changes to existing members, Carrier operators/catalog grants, Auth settings, RLS or business data.
  if exists(select 1 from public.carrier_operators where auth_user_id=uid)
    or exists(select 1 from private.v2_catalog_grants where auth_user_id=uid) then
    raise exception 'HAC54_LOCAL_OWNER_UNEXPECTED_CARRIER_OR_CATALOG_ACCESS';
  end if;
end $$;
commit;

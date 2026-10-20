\set ON_ERROR_STOP on
\if :{?local_only}
\else
  \set local_only 0
\endif
\if :local_only
\else
  do $$ begin raise exception 'HAC54_LOCAL_ONLY: explicit local-only opt-in required'; end $$;
\endif
\if :{?operator_auth_id}
\else
  do $$ begin raise exception 'HAC54_LOCAL_ONLY: verified local Auth user required'; end $$;
\endif

begin;
select set_config('hac54.local_operator_auth_id', :'operator_auth_id', true);
do $$
declare
  uid uuid := current_setting('hac54.local_operator_auth_id')::uuid;
  cid constant uuid := 'c2340000-0000-4000-8000-000000000001';
  oid constant uuid := 'd54c0000-0000-4000-8000-000000000001';
begin
  -- Identity bootstrap only. No membership inferred from Carrier access, no commercial records or bypassed guards.
  if not exists(select 1 from auth.users where id=uid and email='hac54.carrier.local@cargomesh.test' and email_confirmed_at is not null)
    or not exists(select 1 from public.carriers where id=cid and status='ACTIVE' and name like '[SYNTHETIC]%') then
    raise exception 'HAC54_LOCAL_ONLY: expected verified synthetic user and active baseline Carrier required';
  end if;
  if exists(select 1 from public.carrier_operators where id=oid and (auth_user_id<>uid or carrier_id<>cid or role<>'OPERATOR' or status<>'ACTIVE')) then
    raise exception 'HAC54_LOCAL_ONLY: operator ID collision; existing records will not be overwritten';
  end if;
  insert into public.carrier_operators(id,carrier_id,auth_user_id,display_name,role,email,status,verified_at)
    values(oid,cid,uid,'[SYNTHETIC] HAC54 local commercial operator','OPERATOR','hac54.carrier.local@cargomesh.test','ACTIVE',now())
    on conflict(id) do nothing;
  insert into private.v2_catalog_grants(auth_user_id,carrier_id,permission,expires_at)
    values(uid,cid,'CARRIER_EDITOR',now()+interval '7 days') on conflict do nothing;
  if not exists(select 1 from private.v2_catalog_grants where auth_user_id=uid and carrier_id=cid and permission='CARRIER_EDITOR'
    and revoked_at is null and (expires_at is null or expires_at>now())) then
    raise exception 'HAC54_LOCAL_ONLY: existing grant is expired/revoked; explicit renewal is required';
  end if;
end $$;
commit;

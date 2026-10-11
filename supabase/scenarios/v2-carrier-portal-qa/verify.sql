\set ON_ERROR_STOP on
\if :{?local_only}
\else
\set local_only 0
\endif
\if :local_only
\else
do $$ begin raise exception 'CARRIER_PORTAL_LOCAL_ONLY'; end $$;
\endif
do $$ begin if inet_server_addr() is not null then raise exception 'LOCAL_DOCKER_SOCKET_REQUIRED'; end if; end $$;
begin;
do $$ declare actor record; actual public.carrier_operators; begin
    if (select count(*) from carrier_portal_qa.actors where run_id=hac44_qa.current_run())<>12 then
        raise exception 'ACTOR_MAP_INCOMPLETE'; end if;
    if exists(select 1 from public.organization_members m join carrier_portal_qa.actors a on a.auth_user_id=m.auth_user_id
        where a.run_id=hac44_qa.current_run() and a.carrier_id is not null) then
        raise exception 'CARRIER_MUST_NOT_HAVE_SHIPPER_MEMBERSHIP'; end if;
    for actor in select * from carrier_portal_qa.actors where run_id=hac44_qa.current_run() and carrier_id is not null loop
        select * into actual from public.carrier_operators where id=actor.operator_id;
        if actual.auth_user_id is distinct from actor.auth_user_id or actual.role is distinct from actor.role
            or actual.status is distinct from actor.identity_status or (actual.verified_at is not null) is distinct from actor.verified then
            raise exception 'IDENTITY_FIXTURE_MISMATCH: %',actor.name; end if;
        if not exists(select 1 from private.v2_catalog_grants g where g.auth_user_id=actor.auth_user_id
            and g.carrier_id=actor.carrier_id and g.permission='CARRIER_EDITOR'
            and case actor.grant_state when 'EXPIRED' then g.expires_at<=now() and g.revoked_at is null
                when 'REVOKED' then g.revoked_at is not null
                else g.revoked_at is null and (g.expires_at is null or g.expires_at>now()) end) then
            raise exception 'GRANT_FIXTURE_MISMATCH: %',actor.name; end if;
    end loop;
    if not exists(select 1 from public.organization_members m join public.organizations o on o.id=m.organization_id
        join carrier_portal_qa.actors a on a.auth_user_id=m.auth_user_id
        where a.run_id=hac44_qa.current_run() and a.name='shipper' and m.role='OWNER'
        and m.status='ACTIVE' and m.verified_at is not null and o.status='ACTIVE') then
        raise exception 'SEPARATE_ACTIVE_VERIFIED_SHIPPER_REQUIRED'; end if;
    if exists(select 1 from private.v2_catalog_grants g join carrier_portal_qa.actors a on a.auth_user_id=g.auth_user_id
        where a.run_id=hac44_qa.current_run() and a.name='shipper') then
        raise exception 'SHIPPER_MUST_NOT_HAVE_CATALOG_GRANT'; end if;
    if not exists(select 1 from public.organization_members m join carrier_portal_qa.actors a on a.auth_user_id=m.auth_user_id
        join private.v2_catalog_grants g on g.auth_user_id=a.auth_user_id and g.permission='CATALOG_ADMIN'
        where a.run_id=hac44_qa.current_run() and a.name='setup' and m.role='OWNER' and m.status='ACTIVE'
        and m.organization_id='e4400000-0000-4000-8000-000000000012' and m.verified_at is not null
        and g.revoked_at is null and (g.expires_at is null or g.expires_at>now())) then
        raise exception 'INDEPENDENT_SETUP_OWNER_AND_GRANT_REQUIRED'; end if;
    if exists(select 1 from public.carrier_operators o join carrier_portal_qa.actors a on a.auth_user_id=o.auth_user_id
        where a.run_id=hac44_qa.current_run() and a.name in ('shipper','setup')) then
        raise exception 'ORGANIZATION_ACTORS_MUST_NOT_HAVE_CARRIER_IDENTITY'; end if;
    if exists(select 1 from auth.users u join carrier_portal_qa.actors a on a.auth_user_id=u.id
        where a.run_id=hac44_qa.current_run() and nullif(u.encrypted_password,'') is not null) then
        raise exception 'AUTH_PLACEHOLDER_HAS_CREDENTIAL'; end if;
    if exists(select 1 from public.v2_carrier_offers) or exists(select 1 from public.v2_bookings)
        or exists(select 1 from public.transport_executions) or exists(select 1 from public.capacity_reservations) then
        raise exception 'OPEN_FLOW_WAS_PREEXECUTED'; end if;
    if not exists(select 1 from public.carrier_opportunities where id=(select (value->>'id')::uuid
        from carrier_portal_qa.refs where name='opportunity' and run_id=hac44_qa.current_run()) and status='SENT') then
        raise exception 'OPEN_OPPORTUNITY_REQUIRED'; end if;
    if exists(select 1 from auth.identities) or exists(select 1 from auth.sessions) then
        raise exception 'AUTH_PLACEHOLDERS_MUST_NOT_HAVE_SESSIONS'; end if;
    if exists(select 1 from hac44_qa.triggers s left join pg_trigger t on t.tgrelid=to_regclass(s.relation) and t.tgname=s.name
        where s.run_id=hac44_qa.current_run() and (t.oid is null or t.tgenabled<>s.enabled)) then
        raise exception 'GUARD_STATE_CHANGED'; end if;
end $$;
select 'PASS CARRIER_PORTAL: exact actor states, carrier-only membership, open workflow, Auth placeholders, unchanged guards';
commit;
\ir counts.sql

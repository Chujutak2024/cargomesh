\set ON_ERROR_STOP on
\if :{?local_only}
\else
\set local_only 0
\endif
\if :local_only
\else
do $$
begin
    raise exception 'HAC44_LOCAL_ONLY';
end
$$;
\endif
select hac44_qa.capture_ids();
do $$
declare
    r uuid := hac44_qa.current_run();
begin
    if(
        select count(
            *
        ) from public.organizations where id in(
            'd4400000-0000-4000-8000-000000000001',
            'd4400000-0000-4000-8000-000000000002'
        ) and default_currency = 'USD'
    ) <> 2 then
        raise exception 'HAC44_CANONICAL_USD_REQUIRED';
    end if;
    if not exists(
        select 1 from public.carrier_depots where id = 'd4450000-0000-4000-8000-000000000001' and code =
        'HAC44_PIURA' and address_line is not null
    ) then
        raise exception 'HAC44_CANONICAL_DEPOT_REQUIRED';
    end if;
    if(
        select count(
            *
        ) from public.organization_members where id in(
            'd4420000-0000-4000-8000-000000000001',
            'd4420000-0000-4000-8000-000000000002'
        ) and status = 'ACTIVE'
    ) <> 2 or not exists(
        select 1 from public.organization_members where id = 'd4420000-0000-4000-8000-000000000003' and status =
        'INACTIVE'
    ) then
        raise exception 'HAC44_ACTOR_CONTROL_REQUIRED';
    end if;
    if exists(
        select 1 from hac44_qa.triggers s left join pg_trigger t on t.tgrelid = to_regclass(
            s.relation
        ) and t.tgname = s.name where s.run_id = r and(
            t.oid is null or t.tgenabled <> s.enabled
        )
    ) or(
        select count(
            *
        ) from hac44_qa.triggers where run_id = r
    ) <>(
        select count(
            *
        ) from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace where
        n.nspname in(
            'public',
            'private'
        )
    ) then
        raise exception 'HAC44_TRIGGER_STATE_CHANGED';
    end if;
    if not exists(
        select 1 from public.freight_requests where organization_id = 'd4400000-0000-4000-8000-000000000001'
    ) or not exists(
        select 1 from public.transport_plan_candidates where organization_id =
        'd4400000-0000-4000-8000-000000000001'
    ) or not exists(
        select 1 from public.v2_bookings where organization_id = 'd4400000-0000-4000-8000-000000000001'
    ) or not exists(
        select 1 from public.capacity_consolidations where carrier_id = 'd4440000-0000-4000-8000-000000000001'
    ) then
        raise exception 'HAC44_NATIVE_WORKFLOW_CONTROL_REQUIRED';
    end if;
end
$$;
do $$
begin
    if not exists(
        select 1 from public.driver_assignments where carrier_id = 'd4440000-0000-4000-8000-000000000001'
    ) or not exists(
        select 1 from public.vehicle_assignments where carrier_id = 'd4440000-0000-4000-8000-000000000001'
    ) or not exists(
        select 1 from public.capacity_reservations r join public.v2_bookings b on b.id = r.booking_id where b.
        organization_id = 'd4400000-0000-4000-8000-000000000001'
    ) or not exists(
        select 1 from public.operational_incidents where organization_id = 'd4400000-0000-4000-8000-000000000001'
    ) or not exists(
        select 1 from public.incident_updates where organization_id = 'd4400000-0000-4000-8000-000000000001'
    ) then
        raise exception 'HAC44_B4_B5_NATIVE_OPERATION_REQUIRED';
    end if;
end
$$;
select 'PASS HAC44 canonical actors, USD/depot, native workflow/LTL and unchanged trigger states';
\ir counts.sql

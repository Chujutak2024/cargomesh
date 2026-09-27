\set ON_ERROR_STOP on
\if :{?local_only}
\else
  \set local_only 0
\endif
\if :local_only
\else
  do $$ begin
    raise exception 'HAC12_LOCAL_ONLY: pass psql -v local_only=1; never run cleanup remotely';
  end $$;
\endif

begin;
-- Exact fixture IDs only. Fail before any cascade could remove another test's work.
do $$ begin
  if exists (select 1 from public.capacity_reservations
      where capacity_calendar_id = 'c23f0000-0000-4000-8000-000000000001')
    or exists (select 1 from public.scheduled_maintenances
      where transport_asset_id = 'c23d0000-0000-4000-8000-000000000001')
    or exists (select 1 from public.repositioning_blocks
      where capacity_calendar_id = 'c23f0000-0000-4000-8000-000000000001') then
    raise exception 'HAC12_CLEANUP_HAS_DEPENDENTS';
  end if;
end $$;
delete from public.capacity_calendars
  where id = 'c23f0000-0000-4000-8000-000000000001';
delete from public.asset_cargo_capabilities
  where transport_asset_id = 'c23d0000-0000-4000-8000-000000000001';
delete from public.transport_assets
  where id = 'c23d0000-0000-4000-8000-000000000001';
delete from public.capacity_pools
  where id = 'c23e0000-0000-4000-8000-000000000001';
delete from public.carrier_service_cargo_categories
  where carrier_service_id in (
    'c2360000-0000-4000-8000-000000000001',
    'c23a0000-0000-4000-8000-000000000001'
  ) and cargo_category_id = (select id from public.cargo_categories where code = 'PHARMA');
commit;

\set ON_ERROR_STOP on
\if :{?local_only}
\else
  \set local_only 0
\endif
\if :local_only
\else
  do $$ begin
    raise exception 'HAC12_LOCAL_ONLY: pass psql -v local_only=1; never deploy this scenario';
  end $$;
\endif

begin;
-- Requires the HAC-29 v2-road-baseline scenario; never part of a migration.
insert into public.carrier_service_cargo_categories (carrier_service_id, cargo_category_id)
select service_id, category.id from (values
  ('c2360000-0000-4000-8000-000000000001'::uuid),
  ('c23a0000-0000-4000-8000-000000000001'::uuid)
) as services(service_id)
cross join public.cargo_categories category
where category.code = 'PHARMA'
on conflict do nothing;

insert into public.transport_assets (
  id, carrier_id, carrier_service_id, code, mode, equipment_code, asset_role,
  max_weight_kg, max_volume_m3, active
) values (
  'c23d0000-0000-4000-8000-000000000001',
  'c2340000-0000-4000-8000-000000000001',
  'c2360000-0000-4000-8000-000000000001',
  'HAC12-SYNTHETIC-REEFER', 'ROAD', 'REEFER_TRUCK', 'CARRIER', 12000, 42, true
) on conflict (id) do nothing;

insert into public.asset_cargo_capabilities (
  transport_asset_id, cargo_category_id, temperature_min_c, temperature_max_c,
  certifications
)
select 'c23d0000-0000-4000-8000-000000000001', id, 2, 8,
  '["TEMP_CONTROLLED","SECURITY_SEAL"]'::jsonb
from public.cargo_categories where code = 'PHARMA'
on conflict (transport_asset_id, cargo_category_id) do update
  set temperature_min_c = excluded.temperature_min_c,
      temperature_max_c = excluded.temperature_max_c,
      certifications = excluded.certifications;

insert into public.capacity_pools (
  id, carrier_id, carrier_service_id, code, equipment_code,
  max_weight_kg, max_volume_m3, supported_cargo_category_ids, active
)
select 'c23e0000-0000-4000-8000-000000000001',
  'c2390000-0000-4000-8000-000000000001',
  'c23a0000-0000-4000-8000-000000000001',
  'HAC12-SYNTHETIC-UNVERIFIED-POOL', 'REEFER_TRUCK',
  12000, 42, array[id], true
from public.cargo_categories where code = 'PHARMA'
on conflict (id) do nothing;

insert into public.capacity_calendars (
  id, carrier_service_id, transport_asset_id, complete, available_windows,
  source_reference, provenance_status, observed_at, valid_until
) values (
  'c23f0000-0000-4000-8000-000000000001',
  'c2360000-0000-4000-8000-000000000001',
  'c23d0000-0000-4000-8000-000000000001', true,
  '[{"startsAt":"2026-10-04T00:00:00Z","endsAt":"2026-10-08T00:00:00Z"}]'::jsonb,
  'CARRIER_CALENDAR_V2_SCENARIO', 'SIMULATED',
  '2026-09-26T12:00:00Z', '2026-10-10T00:00:00Z'
) on conflict (id) do nothing;
commit;

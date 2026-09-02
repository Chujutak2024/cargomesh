\set ON_ERROR_STOP on

begin;

-- Scoped cleanup: only stable D1-03 seed identities are removed. Requests
-- created from the UI are intentionally outside this script.
delete from public.freight_requests
where id in (
  'f2100000-0000-0000-0000-000000000001',
  'f2100000-0000-0000-0000-000000000002'
);

delete from public.organization_cargo_profiles
where id in (
  'a1000000-0000-0000-0000-000000000101',
  'a1000000-0000-0000-0000-000000000102'
);

delete from public.carrier_metrics
where id in (
  'f1100000-0000-0000-0000-000000000001',
  'f1100000-0000-0000-0000-000000000002'
);

delete from public.carrier_service_cargo_categories
where carrier_service_id in (
  'd1000000-0000-0000-0000-000000000001',
  'd1000000-0000-0000-0000-000000000002'
);

delete from public.vehicles
where id in (
  'e1000000-0000-0000-0000-000000000001',
  'e1000000-0000-0000-0000-000000000002'
);

delete from public.carrier_services
where id in (
  'd1000000-0000-0000-0000-000000000001',
  'd1000000-0000-0000-0000-000000000002'
);

delete from public.carriers
where id = 'b1000000-0000-0000-0000-000000000001';

commit;

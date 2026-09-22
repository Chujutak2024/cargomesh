\set ON_ERROR_STOP on

begin;

-- Exact IDs only. Never delete by city, date, organization code, or UUID prefix.
delete from public.service_lanes
where id in ('c2380000-0000-4000-8000-000000000001');

delete from public.service_areas
where id in (
  'c2370000-0000-4000-8000-000000000001',
  'c2370000-0000-4000-8000-000000000002',
  'c2370000-0000-4000-8000-000000000003',
  'c2370000-0000-4000-8000-000000000004'
);

delete from public.carrier_depots
where id in ('c2350000-0000-4000-8000-000000000001');

delete from public.carrier_services
where id in ('c2360000-0000-4000-8000-000000000001');

delete from public.carriers
where id in ('c2340000-0000-4000-8000-000000000001');

delete from public.facilities
where id in (
  'c2330000-0000-4000-8000-000000000001',
  'c2330000-0000-4000-8000-000000000002',
  'c2330000-0000-4000-8000-000000000003',
  'c2330000-0000-4000-8000-000000000004'
);

delete from public.organization_members
where id in (
  'c2320000-0000-4000-8000-000000000001',
  'c2320000-0000-4000-8000-000000000002'
);

delete from auth.identities
where id in (
  'c2310000-0000-4000-8000-000000000001',
  'c2310000-0000-4000-8000-000000000002'
);

delete from auth.users
where id in (
  'c2310000-0000-4000-8000-000000000001',
  'c2310000-0000-4000-8000-000000000002'
);

delete from public.organizations
where id in (
  'c2300000-0000-4000-8000-000000000001',
  'c2300000-0000-4000-8000-000000000002'
);

commit;

-- HAC-23: scenario-backed negative cases with a working positive control for
-- each family. Load v2-road-baseline/seed.sql locally before this test.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
select plan(16);

-- Unlike HAC-21's transaction-local schema tests, these rows are the exact
-- replayable CP-2 scenario. Fail visibly if CI forgot to seed it.
select is((select count(*)::integer from public.organizations
  where id in ('c2300000-0000-4000-8000-000000000001',
               'c2300000-0000-4000-8000-000000000002')), 2,
  'scenario contains both organizations');
select is((select count(*)::integer from public.facilities
  where id in ('c2330000-0000-4000-8000-000000000001',
               'c2330000-0000-4000-8000-000000000002',
               'c2330000-0000-4000-8000-000000000003',
               'c2330000-0000-4000-8000-000000000004')), 4,
  'scenario contains all four named facilities');

-- Only declared V2 coverage is checked here. This is not the future full
-- eligibility engine (capacity, exclusions, pricing, and booking are absent).
create function pg_temp.qa_declared_road_lane(origin_id uuid, destination_id uuid)
returns integer language sql stable security invoker set search_path = '' as $$
  select count(*)::integer
  from public.facilities origin_site
  join public.facilities destination_site on destination_site.id = destination_id
  join public.service_areas pickup
    on pickup.carrier_service_id = 'c2360000-0000-4000-8000-000000000001'
   and pickup.area_role = 'PICKUP' and pickup.coverage = 'INCLUDE' and pickup.active
   and pickup.country_code = origin_site.country_code and pickup.city = origin_site.city
  join public.service_areas delivery
    on delivery.carrier_service_id = pickup.carrier_service_id
   and delivery.area_role = 'DELIVERY' and delivery.coverage = 'INCLUDE' and delivery.active
   and delivery.country_code = destination_site.country_code and delivery.city = destination_site.city
  join public.service_lanes lane
    on lane.carrier_service_id = pickup.carrier_service_id
   and lane.pickup_area_id = pickup.id and lane.delivery_area_id = delivery.id
   and lane.transport_mode = 'ROAD' and lane.active
  where origin_site.id = origin_id;
$$;

-- The role and JWT claims both matter: querying as postgres bypasses RLS.
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"c2310000-0000-4000-8000-000000000001","role":"authenticated"}';
select is(current_user, 'authenticated', 'RLS positive: actual SQL role is authenticated');
select is(auth.uid()::text, 'c2310000-0000-4000-8000-000000000001',
  'RLS positive: claims identify tenant A user');
select is((select count(*)::integer from public.facilities
  where id = 'c2330000-0000-4000-8000-000000000001'), 1,
  'RLS positive: tenant A sees its own Lima site');
select results_eq(
  $$update public.facilities set access_notes = 'qa-tenant-a-updated'
    where id = 'c2330000-0000-4000-8000-000000000001' returning id::text$$,
  $$values ('c2330000-0000-4000-8000-000000000001'::text)$$,
  'RLS positive: tenant A can modify its own site'
);
select is((select access_notes from public.facilities
  where id = 'c2330000-0000-4000-8000-000000000001'), 'qa-tenant-a-updated',
  'RLS positive: own-site mutation is observable');

set local "request.jwt.claims" to '{"sub":"c2310000-0000-4000-8000-000000000002","role":"authenticated"}';
select is(auth.uid()::text, 'c2310000-0000-4000-8000-000000000002',
  'RLS control: claims changed to tenant B user');
select is((select count(*)::integer from public.facilities
  where id = 'c2330000-0000-4000-8000-000000000004'), 1,
  'RLS control: tenant B sees its own Lima site');
select is((select count(*)::integer from public.facilities
  where id = 'c2330000-0000-4000-8000-000000000001'), 0,
  'RLS negative: tenant B cannot see tenant A site in the same city');
select results_eq(
  $$update public.facilities set access_notes = 'cross-tenant-write'
    where id = 'c2330000-0000-4000-8000-000000000001' returning id::text$$,
  $$select null::text where false$$,
  'RLS negative: tenant B cannot modify tenant A site'
);

set local "request.jwt.claims" to '{"sub":"c2310000-0000-4000-8000-000000000001","role":"authenticated"}';
select is((select access_notes from public.facilities
  where id = 'c2330000-0000-4000-8000-000000000001'), 'qa-tenant-a-updated',
  'RLS negative: tenant B did not alter tenant A data');

select is(pg_temp.qa_declared_road_lane(
  'c2330000-0000-4000-8000-000000000001',
  'c2330000-0000-4000-8000-000000000002'), 1,
  'coverage positive: Lima site has declared ROAD A-to-B coverage');
select is(pg_temp.qa_declared_road_lane(
  'c2330000-0000-4000-8000-000000000003',
  'c2330000-0000-4000-8000-000000000002'), 0,
  'coverage negative: Piura site and depot confer no service coverage');

select is(pg_temp.qa_declared_road_lane(
  'c2330000-0000-4000-8000-000000000001',
  'c2330000-0000-4000-8000-000000000002'), 1,
  'lane positive: the A-to-B directed lane exists');
select is(pg_temp.qa_declared_road_lane(
  'c2330000-0000-4000-8000-000000000002',
  'c2330000-0000-4000-8000-000000000001'), 0,
  'lane negative: B-to-A is not inferred from A-to-B');

select * from finish();
rollback;

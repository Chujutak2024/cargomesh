-- HAC-29 clean-profile adaptation of HAC-21; scenario seed is required. All rows added here are transaction-local and rolled back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
select no_plan();

select has_table('public', 'facilities', 'V2 shipper facilities exist');
select has_table('public', 'carrier_depots', 'V2 carrier depots exist');
select has_table('public', 'service_areas', 'V2 service areas exist');
select has_table('public', 'service_lanes', 'V2 directed service lanes exist');
select ok((select relrowsecurity from pg_class where oid = 'public.facilities'::regclass), 'facility RLS is enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.carrier_depots'::regclass), 'depot RLS is enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.service_areas'::regclass), 'area RLS is enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.service_lanes'::regclass), 'lane RLS is enabled');

-- Setup via migration owner, not the authenticated carrier catalog role.
insert into public.facilities (id, organization_id, code, name, country_code, city, address_line)
values
  ('e2000000-0000-4000-8000-000000000001', 'c2300000-0000-4000-8000-000000000001', 'ORIGIN', 'Origin facility', 'PE', 'Lima', 'Test 1'),
  ('e2000000-0000-4000-8000-000000000002', 'c2300000-0000-4000-8000-000000000002', 'OTHER', 'Other facility', 'PE', 'Lima', 'Test 2');
insert into public.carrier_depots (id, carrier_id, code, name, country_code, city)
values ('e3000000-0000-4000-8000-000000000001', 'c2340000-0000-4000-8000-000000000001',
  'V2-DEPOT', 'Test depot without coverage', 'PE', 'Lima');


insert into public.carrier_services
 (id,carrier_id,transport_mode,service_type,origin_country,origin_region,destination_country,destination_region,max_capacity_kg)
values ('e7000000-0000-4000-8000-000000000001','c2340000-0000-4000-8000-000000000001',
 'ROAD','FTL','PE','Lima','CL','Santiago',10000);
insert into public.freight_requests
 (id,organization_id,cargo_category_id,code,origin_country,origin_city,destination_country,destination_city,
 cargo_weight_kg,required_pickup,status,requested_by_member_id)
values ('e6000000-0000-4000-8000-000000000001','c2300000-0000-4000-8000-000000000001',
 'c0000000-0000-0000-0000-000000000003','QA-V2-DB-ONLY','PE','Lima','PE','Arequipa',4800,
 '2026-10-05T08:00:00Z','DRAFT','c2320000-0000-4000-8000-000000000001');
select is((select count(*)::int from public.carrier_services where id='e7000000-0000-4000-8000-000000000001'),1,'control: service exists without inferred lanes');
select is((select count(*)::int from public.carrier_depots where id='e3000000-0000-4000-8000-000000000001'),1,'control: owner can create catalog depot');

select results_eq(
  $$select count(*)::integer from public.service_lanes where carrier_service_id = 'e7000000-0000-4000-8000-000000000001'::uuid$$,
  $$values (0)$$,
  'ROAD service metadata and a carrier depot do not create V2 lanes'
);

set local role anon;
set local "request.jwt.claims" to '{"role":"anon"}';
select throws_ok($$select count(*) from public.facilities$$, '42501', null, 'anon cannot read facilities');
select throws_ok($$select count(*) from public.service_lanes$$, '42501', null, 'anon cannot read lanes');

set local role authenticated;
set local "request.jwt.claims" to '{"sub":"c2310000-0000-4000-8000-000000000001","role":"authenticated"}';
select results_eq(
  $$select code from public.facilities where code in ('ORIGIN','OTHER') order by code$$,
  $$values ('ORIGIN'::text)$$,
  'tenant A member sees only tenant A facilities'
);
select lives_ok(
  $$insert into public.facilities (organization_id, code, name, country_code, city, address_line)
    values ('c2300000-0000-4000-8000-000000000001', 'NEW', 'Allowed', 'PE', 'Lima', 'Test 3')$$,
  'active supervisor can create own facility'
);
select throws_ok(
  $$insert into public.facilities (organization_id, code, name, country_code, city, address_line)
    values ('c2300000-0000-4000-8000-000000000002', 'CROSS', 'Denied', 'PE', 'Lima', 'Test 4')$$,
  '42501', null, 'member cannot create a facility in another organization'
);
select throws_ok(
  $$insert into public.carrier_depots (carrier_id, code, name, country_code, city)
    values ('c2340000-0000-4000-8000-000000000001', 'BAD', 'Denied', 'PE', 'Lima')$$,
  '42501', null, 'organization member cannot mutate carrier catalog'
);
select throws_ok(
  $$update public.facilities set organization_id = 'c2300000-0000-4000-8000-000000000002'
    where id = 'e2000000-0000-4000-8000-000000000001'$$,
  '42501', null, 'facility ownership cannot be reassigned through client grant'
);

select is((select count(*)::int from public.service_lanes where id='c2380000-0000-4000-8000-000000000001'),1,'control: authenticated member reads declared lane');
select lives_ok($$update public.facilities set name='Own allowed edit' where id='e2000000-0000-4000-8000-000000000001'$$,'control: own facility writable without reassigning ownership');
select lives_ok($$update public.freight_requests set origin_facility_id='e2000000-0000-4000-8000-000000000001', destination_facility_id='c2330000-0000-4000-8000-000000000002'
 where id='e6000000-0000-4000-8000-000000000001'$$,'control: tenant A request accepts own facilities');
select is((select count(*)::int from public.freight_requests where id='e6000000-0000-4000-8000-000000000001'
 and origin_facility_id='e2000000-0000-4000-8000-000000000001'),1,'control: own facility reference really persisted');

select throws_ok(
  $$update public.freight_requests set origin_facility_id = 'e2000000-0000-4000-8000-000000000002'
    where id = 'e6000000-0000-4000-8000-000000000001'$$,
  '23503', null, 'request cannot reference another organization facility'
);


select is((select origin_facility_id::text from public.freight_requests where id='e6000000-0000-4000-8000-000000000001'),
 'e2000000-0000-4000-8000-000000000001','foreign origin rejection preserves own reference');
select throws_ok($$update public.freight_requests set destination_facility_id='e2000000-0000-4000-8000-000000000002'
 where id='e6000000-0000-4000-8000-000000000001'$$,'23503',null,'foreign destination rejected by composite tenant FK');
select is((select count(*)::int from public.facilities where id='e2000000-0000-4000-8000-000000000002'),0,'tenant B facility hidden under tenant A claims');

reset role;
update public.organization_members set role = 'REQUESTER'
where auth_user_id = 'c2310000-0000-4000-8000-000000000001'::uuid;
set local role authenticated;
select throws_ok(
  $$insert into public.facilities (organization_id, code, name, country_code, city, address_line)
    values ('c2300000-0000-4000-8000-000000000001', 'REQUESTER', 'Denied', 'PE', 'Lima', 'Test 5')$$,
  '42501', null, 'REQUESTER cannot create a facility'
);
reset role;
update public.organization_members set role = 'SUPERVISOR'
where auth_user_id = 'c2310000-0000-4000-8000-000000000001'::uuid;
-- Transaction-local cross-border corridor exercises the original constraint assertions.
insert into public.service_areas
  (id, carrier_service_id, area_role, coverage, granularity, country_code, city,
   fulfilment_source, partner_reference, evidence_reference, verified_at, valid_from)
values
  ('e4000000-0000-4000-8000-000000000001', 'e7000000-0000-4000-8000-000000000001',
   'PICKUP', 'INCLUDE', 'CITY', 'PE', 'Lima', 'OWN', null, 'test:pickup', now(), now()),
  ('e4000000-0000-4000-8000-000000000002', 'e7000000-0000-4000-8000-000000000001',
   'DELIVERY', 'INCLUDE', 'CITY', 'CL', 'Santiago', 'PARTNER', 'test:partner', 'test:delivery', now(), now());

select is((select count(*)::int from public.service_areas where id='e4000000-0000-4000-8000-000000000002' and partner_reference='test:partner'),1,'control: partner reference permits coverage');
select lives_ok($$update public.service_areas set evidence_reference='test:updated' where id='e4000000-0000-4000-8000-000000000001'$$,'control: allowed area update');

select throws_ok(
  $$insert into public.service_areas (carrier_service_id, area_role, coverage, granularity,
      country_code, city, fulfilment_source, evidence_reference, verified_at, valid_from)
    values ('e7000000-0000-4000-8000-000000000001', 'DELIVERY', 'INCLUDE', 'CITY',
      'CL', 'Santiago', 'PARTNER', 'test:no-partner', now(), now())$$,
  '23514', null, 'partner-backed coverage requires a partner reference'
);
select throws_ok(
  $$insert into public.service_lanes (carrier_service_id, pickup_area_id, delivery_area_id,
      evidence_reference, verified_at, valid_from)
    values ('e7000000-0000-4000-8000-000000000001',
      'e4000000-0000-4000-8000-000000000002', 'e4000000-0000-4000-8000-000000000001',
      'test:wrong-direction', now(), now())$$,
  '23514', null, 'reverse lane cannot swap pickup and delivery roles'
);
insert into public.service_lanes
  (id, carrier_service_id, pickup_area_id, delivery_area_id,
   evidence_reference, verified_at, valid_from)
values
  ('e5000000-0000-4000-8000-000000000001', 'e7000000-0000-4000-8000-000000000001',
   'e4000000-0000-4000-8000-000000000001', 'e4000000-0000-4000-8000-000000000002',
   'test:direct', now(), now());
select results_eq(
  $$select count(*)::integer from public.service_lanes
    where pickup_area_id = 'e4000000-0000-4000-8000-000000000001'
      and delivery_area_id = 'e4000000-0000-4000-8000-000000000002'$$,
  $$values (1)$$, 'explicit A to B lane exists'
);
select results_eq(
  $$select count(*)::integer from public.service_lanes
    where pickup_area_id = 'e4000000-0000-4000-8000-000000000002'
      and delivery_area_id = 'e4000000-0000-4000-8000-000000000001'$$,
  $$values (0)$$, 'A to B does not imply B to A'
);
select throws_ok(
  $$update public.service_areas set area_role = 'DELIVERY'
    where id = 'e4000000-0000-4000-8000-000000000001'$$,
  '23514', null, 'published lane cannot be reinterpreted by changing its pickup area'
);

select * from finish();
rollback;

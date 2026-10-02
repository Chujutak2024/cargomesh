-- HAC-29 data evidence only; this does not execute RoadServiceabilityService.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path=extensions,public;
select no_plan();
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"c2310000-0000-4000-8000-000000000001","role":"authenticated"}';
create temporary view declared_lanes as
 select s.id as service_id, p.city as pickup, d.city as delivery
 from public.carrier_services s
 join public.service_lanes l on l.carrier_service_id=s.id
 join public.service_areas p on p.id=l.pickup_area_id and p.carrier_service_id=s.id
 join public.service_areas d on d.id=l.delivery_area_id and d.carrier_service_id=s.id
 where s.id in ('c2360000-0000-4000-8000-000000000001','c23a0000-0000-4000-8000-000000000001')
 and s.active and s.transport_mode='ROAD' and l.active
 and p.active and d.active and p.area_role='PICKUP' and d.area_role='DELIVERY'
 and p.coverage='INCLUDE' and d.coverage='INCLUDE' and p.country_code='PE' and d.country_code='PE'
 and p.valid_from <= '2026-10-05T08:00:00Z' and d.valid_from <= '2026-10-05T08:00:00Z' and l.valid_from <= '2026-10-05T08:00:00Z'
 and (p.valid_until is null or p.valid_until >= '2026-10-07T20:00:00Z')
 and (d.valid_until is null or d.valid_until >= '2026-10-07T20:00:00Z')
 and (l.valid_until is null or l.valid_until >= '2026-10-07T20:00:00Z');
select is((select count(*)::int from declared_lanes where pickup='Lima' and delivery='Arequipa'),2,'positive: both services declare Lima to Arequipa');
select is((select count(*)::int from declared_lanes where pickup='Piura' and delivery='Arequipa'),0,'Piura has no matching declared lane');
select is((select count(*)::int from public.facilities where id='c2330000-0000-4000-8000-000000000003' and city='Piura' and latitude is null and longitude is null),1,'Piura fixture exists without invented coordinates');
select is((select count(*)::int from declared_lanes where pickup='Arequipa' and delivery='Lima'),0,'no implicit reverse lane');
select is((select count(*)::int from declared_lanes where service_id='c23a0000-0000-4000-8000-000000000001'),1,'unknown-capacity service has positive coverage evidence');
select is((select count(*)::int from public.carrier_services where id='c2360000-0000-4000-8000-000000000001' and max_capacity_kg=10000 and max_volume_m3=30),1,'positive: existing nominal capacity metadata preserved');
select is((select count(*)::int from public.carrier_services where id='c23a0000-0000-4000-8000-000000000001' and max_capacity_kg=10000 and max_volume_m3=30),1,'second service copies nominal metadata; this does not establish a free calendar');
select diag('BLOCKED HAC-12: capacity calendar positive control, HTTP eligible/unknown/zero and FORBIDDEN_TENANT; nominal capacity is not availability.');
select * from finish();
rollback;

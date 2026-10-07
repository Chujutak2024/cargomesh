-- Re-review regressions R-06/R-07/R-08/R-09; isolated synthetic scenario, rolled back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
select no_plan();
-- Each test file runs in its own rolled-back transaction. Do not depend on file 12.
insert into public.transport_assets(id,carrier_id,carrier_service_id,code,equipment_code,max_weight_kg,max_volume_m3)
values ('c23d0000-0000-4000-8000-000000000013','c2340000-0000-4000-8000-000000000001',
  'c2360000-0000-4000-8000-000000000001','REREVIEW-SYNTHETIC-ASSET','REEFER_TRUCK',12000,42);
insert into public.capacity_calendars(id,carrier_service_id,transport_asset_id,source_reference,provenance_status)
values ('c23f0000-0000-4000-8000-000000000013','c2360000-0000-4000-8000-000000000001',
  'c23d0000-0000-4000-8000-000000000013','REREVIEW_SYNTHETIC','SIMULATED');
create function pg_temp.hac12_payload() returns jsonb language sql as $$
  select '{
    "schemaVersion":"2.0",
    "origin":{"facilityId":"c2330000-0000-4000-8000-000000000001","label":"browser assertion ignored"},
    "destination":{"facilityId":"c2330000-0000-4000-8000-000000000002"},
    "pickupWindow":{"startsAt":"2026-10-01T10:00:00Z","endsAt":"2026-10-01T12:00:00Z"},
    "deliveryWindow":{"startsAt":"2026-10-02T10:00:00Z","endsAt":"2026-10-02T12:00:00Z"},
    "acceptedModes":["ROAD"],
    "requiredEquipment":null,
    "cargoSpecification":{
      "categoryCode":"GENERAL","description":"Synthetic test cargo",
      "packaging":"PALLET","totalWeightKg":1000,"totalVolumeM3":2,
      "divisible":true,"requirements":[],
      "units":[{"packageType":"PALLET","quantity":1,"weightPerUnitKg":1000,
        "volumePerUnitM3":2,"dimensionsCm":{"length":100,"width":100,"height":200},
        "indivisible":false,"stackable":true}]
    },
    "contacts":{
      "pickup":{"name":"QA Pickup","phoneE164":"+51911111111"},
      "recipient":{"name":"QA Recipient","phoneE164":"+51922222222"}
    },
    "budget":{"amount":500,"currency":"USD"}
  }'::jsonb;
$$;


set local role authenticated;
set local "request.jwt.claims" to '{"sub":"c2310000-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok($$ select public.create_v2_freight_request('c2300000-0000-4000-8000-000000000001', 'c2320000-0000-4000-8000-000000000001', 'a1300000-0000-4000-8000-000000000001', private.hash_v2_freight_payload(pg_temp.hac12_payload()), pg_temp.hac12_payload() #- '{cargoSpecification,units,0,dimensionsCm}') $$, 'PT400', 'VALIDATION_ERROR', 'R-07 missing dimensions leaves no row');
select throws_ok($$ select public.create_v2_freight_request('c2300000-0000-4000-8000-000000000001', 'c2320000-0000-4000-8000-000000000001', 'a1300000-0000-4000-8000-000000000001', private.hash_v2_freight_payload(pg_temp.hac12_payload()), pg_temp.hac12_payload() #- '{cargoSpecification,units,0,indivisible}') $$, 'PT400', 'VALIDATION_ERROR', 'R-07 missing indivisible leaves no row');
select throws_ok($$ select public.create_v2_freight_request('c2300000-0000-4000-8000-000000000001', 'c2320000-0000-4000-8000-000000000001', 'a1300000-0000-4000-8000-000000000001', private.hash_v2_freight_payload(pg_temp.hac12_payload()), pg_temp.hac12_payload() #- '{cargoSpecification,units,0,stackable}') $$, 'PT400', 'VALIDATION_ERROR', 'R-07 missing stackable leaves no row');
select throws_ok($$ select public.create_v2_freight_request('c2300000-0000-4000-8000-000000000001', 'c2320000-0000-4000-8000-000000000001', 'a1300000-0000-4000-8000-000000000001', private.hash_v2_freight_payload(pg_temp.hac12_payload()), jsonb_set(pg_temp.hac12_payload(),'{cargoSpecification,units,0,dimensionsCm,length}','0')) $$, 'PT400', 'VALIDATION_ERROR', 'R-07 zero dimension leaves no row');
select throws_ok($$ select public.create_v2_freight_request('c2300000-0000-4000-8000-000000000001', 'c2320000-0000-4000-8000-000000000001', 'a1300000-0000-4000-8000-000000000001', private.hash_v2_freight_payload(pg_temp.hac12_payload()), jsonb_set(pg_temp.hac12_payload(),'{cargoSpecification,units,0,dimensionsCm,height}','"200"')) $$, 'PT400', 'VALIDATION_ERROR', 'R-07 dimension string leaves no row');
select throws_ok($$ select public.create_v2_freight_request('c2300000-0000-4000-8000-000000000001', 'c2320000-0000-4000-8000-000000000001', 'a1300000-0000-4000-8000-000000000001', private.hash_v2_freight_payload(pg_temp.hac12_payload()), jsonb_set(pg_temp.hac12_payload(),'{cargoSpecification,units,0,indivisible}','"false"')) $$, 'PT400', 'VALIDATION_ERROR', 'R-07 indivisible string leaves no row');
select throws_ok($$ select public.create_v2_freight_request('c2300000-0000-4000-8000-000000000001', 'c2320000-0000-4000-8000-000000000001', 'a1300000-0000-4000-8000-000000000001', private.hash_v2_freight_payload(pg_temp.hac12_payload()), pg_temp.hac12_payload() #- '{cargoSpecification,units,0,packageType}') $$, 'PT400', 'VALIDATION_ERROR', 'R-07 package type absent leaves no row');
select throws_ok($$ select public.create_v2_freight_request('c2300000-0000-4000-8000-000000000001', 'c2320000-0000-4000-8000-000000000001', 'a1300000-0000-4000-8000-000000000001', private.hash_v2_freight_payload(pg_temp.hac12_payload()), jsonb_set(pg_temp.hac12_payload(),'{cargoSpecification,packaging}','"  "')) $$, 'PT400', 'VALIDATION_ERROR', 'R-07 blank package leaves no row');
select throws_ok($$ select public.create_v2_freight_request('c2300000-0000-4000-8000-000000000001', 'c2320000-0000-4000-8000-000000000001', 'a1300000-0000-4000-8000-000000000001', private.hash_v2_freight_payload(pg_temp.hac12_payload()), jsonb_set(pg_temp.hac12_payload(),'{cargoSpecification,requirements}','[3]')) $$, 'PT400', 'VALIDATION_ERROR', 'R-07 requirement not a string leaves no row');
select throws_ok($$ select public.create_v2_freight_request('c2300000-0000-4000-8000-000000000001', 'c2320000-0000-4000-8000-000000000001', 'a1300000-0000-4000-8000-000000000001', private.hash_v2_freight_payload(pg_temp.hac12_payload()), pg_temp.hac12_payload() #- '{cargoSpecification,divisible}') $$, 'PT400', 'VALIDATION_ERROR', 'R-07 divisible missing leaves no row');
select throws_ok($$ select public.create_v2_freight_request('c2300000-0000-4000-8000-000000000001', 'c2320000-0000-4000-8000-000000000001', 'a1300000-0000-4000-8000-000000000001', private.hash_v2_freight_payload(pg_temp.hac12_payload()), pg_temp.hac12_payload() #- '{contacts,recipient}') $$, 'PT400', 'VALIDATION_ERROR', 'R-07 contact missing leaves no row');
select throws_ok($$ select public.create_v2_freight_request('c2300000-0000-4000-8000-000000000001', 'c2320000-0000-4000-8000-000000000001', 'a1300000-0000-4000-8000-000000000001', private.hash_v2_freight_payload(pg_temp.hac12_payload()), jsonb_set(pg_temp.hac12_payload(),'{contacts,pickup,name}','3')) $$, 'PT400', 'VALIDATION_ERROR', 'R-07 contact name type leaves no row');
select throws_ok($$ select public.create_v2_freight_request('c2300000-0000-4000-8000-000000000001', 'c2320000-0000-4000-8000-000000000001', 'a1300000-0000-4000-8000-000000000001', private.hash_v2_freight_payload(pg_temp.hac12_payload()), jsonb_set(pg_temp.hac12_payload(),'{contacts,pickup,phoneE164}','"123"')) $$, 'PT400', 'VALIDATION_ERROR', 'R-07 contact phone format leaves no row');
select throws_ok($$ select public.create_v2_freight_request('c2300000-0000-4000-8000-000000000001', 'c2320000-0000-4000-8000-000000000001', 'a1300000-0000-4000-8000-000000000001', private.hash_v2_freight_payload(pg_temp.hac12_payload()), jsonb_set(pg_temp.hac12_payload(),'{contacts,pickup,email}','"invalid"')) $$, 'PT400', 'VALIDATION_ERROR', 'R-07 contact email format leaves no row');
select throws_ok($$ select public.create_v2_freight_request('c2300000-0000-4000-8000-000000000001', 'c2320000-0000-4000-8000-000000000001', 'a1300000-0000-4000-8000-000000000001', private.hash_v2_freight_payload(pg_temp.hac12_payload()), jsonb_set(pg_temp.hac12_payload(),'{contacts,pickup,admin}','true')) $$, 'PT400', 'VALIDATION_ERROR', 'R-07 contact extra field leaves no row');
select throws_ok($$ select public.create_v2_freight_request('c2300000-0000-4000-8000-000000000001', 'c2320000-0000-4000-8000-000000000001', 'a1300000-0000-4000-8000-000000000001', private.hash_v2_freight_payload(pg_temp.hac12_payload()), pg_temp.hac12_payload() #- '{pickupWindow,startsAt}') $$, 'PT400', 'VALIDATION_ERROR', 'R-07 window missing bound leaves no row');
select throws_ok($$ select public.create_v2_freight_request('c2300000-0000-4000-8000-000000000001', 'c2320000-0000-4000-8000-000000000001', 'a1300000-0000-4000-8000-000000000001', private.hash_v2_freight_payload(pg_temp.hac12_payload()), jsonb_set(pg_temp.hac12_payload(),'{pickupWindow,startsAt}','"2026-02-30T10:00:00Z"')) $$, 'PT400', 'VALIDATION_ERROR', 'R-07 window invalid date leaves no row');
select throws_ok($$ select public.create_v2_freight_request('c2300000-0000-4000-8000-000000000001', 'c2320000-0000-4000-8000-000000000001', 'a1300000-0000-4000-8000-000000000001', private.hash_v2_freight_payload(pg_temp.hac12_payload()), jsonb_set(pg_temp.hac12_payload(),'{pickupWindow,endsAt}','"2026-10-01T09:00:00Z"')) $$, 'PT400', 'VALIDATION_ERROR', 'R-07 window order leaves no row');
select throws_ok($$ select public.create_v2_freight_request('c2300000-0000-4000-8000-000000000001', 'c2320000-0000-4000-8000-000000000001', 'a1300000-0000-4000-8000-000000000001', private.hash_v2_freight_payload(pg_temp.hac12_payload()), jsonb_set(pg_temp.hac12_payload(),'{deliveryWindow}','{"startsAt":"2026-09-01T08:00:00Z","endsAt":"2026-09-01T09:00:00Z"}')) $$, 'PT400', 'VALIDATION_ERROR', 'R-07 delivery before pickup leaves no row');
select throws_ok($$ select public.create_v2_freight_request('c2300000-0000-4000-8000-000000000001', 'c2320000-0000-4000-8000-000000000001', 'a1300000-0000-4000-8000-000000000001', private.hash_v2_freight_payload(pg_temp.hac12_payload()), jsonb_set(pg_temp.hac12_payload(),'{origin,countryCode}','"PER"')) $$, 'PT400', 'VALIDATION_ERROR', 'R-07 country format leaves no row');
select throws_ok($$ select public.create_v2_freight_request('c2300000-0000-4000-8000-000000000001', 'c2320000-0000-4000-8000-000000000001', 'a1300000-0000-4000-8000-000000000001', private.hash_v2_freight_payload(pg_temp.hac12_payload()), jsonb_set(pg_temp.hac12_payload(),'{origin,facilityId}','42')) $$, 'PT400', 'VALIDATION_ERROR', 'R-07 facility uuid type leaves no row');
select throws_ok($$ select public.create_v2_freight_request('c2300000-0000-4000-8000-000000000001', 'c2320000-0000-4000-8000-000000000001', 'a1300000-0000-4000-8000-000000000001', private.hash_v2_freight_payload(pg_temp.hac12_payload()), pg_temp.hac12_payload() || '{"admin":true}'::jsonb) $$, 'PT400', 'VALIDATION_ERROR', 'R-07 extra top field leaves no row');
select throws_ok($$ select public.create_v2_freight_request('c2300000-0000-4000-8000-000000000001', 'c2320000-0000-4000-8000-000000000001', 'a1300000-0000-4000-8000-000000000001', private.hash_v2_freight_payload(pg_temp.hac12_payload()), jsonb_set(pg_temp.hac12_payload(),'{requiredEquipment}','"LOWBOY"')) $$, 'PT400', 'VALIDATION_ERROR', 'R-07 invalid equipment leaves no row');
select throws_ok($$ select public.create_v2_freight_request('c2300000-0000-4000-8000-000000000001', 'c2320000-0000-4000-8000-000000000001', 'a1300000-0000-4000-8000-000000000001', private.hash_v2_freight_payload(pg_temp.hac12_payload()), jsonb_set(pg_temp.hac12_payload(),'{budget,amount}','-1')) $$, 'PT400', 'VALIDATION_ERROR', 'R-07 negative budget leaves no row');
select throws_ok($$ select public.create_v2_freight_request('c2300000-0000-4000-8000-000000000001', 'c2320000-0000-4000-8000-000000000001', 'a1300000-0000-4000-8000-000000000001', private.hash_v2_freight_payload(pg_temp.hac12_payload()), jsonb_set(pg_temp.hac12_payload(),'{cargoSpecification,temperatureRange}','{"minCelsius":8,"maxCelsius":2}')) $$, 'PT400', 'VALIDATION_ERROR', 'R-07 inverted temperature leaves no row');
select is((select count(*)::integer from public.freight_requests where creation_idempotency_key='a1300000-0000-4000-8000-000000000001'),0,'all invalid DTOs leave zero drafts and receipts');
select lives_ok($$ select public.create_v2_freight_request('c2300000-0000-4000-8000-000000000001', 'c2320000-0000-4000-8000-000000000001', 'a1300000-0000-4000-8000-000000000001', private.hash_v2_freight_payload(pg_temp.hac12_payload()), pg_temp.hac12_payload()) $$,'same key succeeds with a complete DTO after invalid calls');
select is((select count(*)::integer from public.freight_requests where creation_idempotency_key='a1300000-0000-4000-8000-000000000001'),1,'positive complete DTO persists once');
select lives_ok($$ select public.create_v2_freight_request('c2300000-0000-4000-8000-000000000001', 'c2320000-0000-4000-8000-000000000001', 'a1300000-0000-4000-8000-000000000004', private.hash_v2_freight_payload(jsonb_set(pg_temp.hac12_payload(),'{cargoSpecification,totalWeightKg}','1000.0000005')), jsonb_set(pg_temp.hac12_payload(),'{cargoSpecification,totalWeightKg}','1000.0000005')) $$,'rounding tolerance preserves precise snapshot and rounded physical weight');

create function pg_temp.insert_copy(p_changes jsonb) returns void language sql as $$
  insert into public.freight_requests
  select (jsonb_populate_record(null::public.freight_requests,
    to_jsonb(r) || jsonb_build_object('id','a1300000-0000-4000-8000-000000000002',
      'code','V2-R06-COPY','creation_idempotency_key','a1300000-0000-4000-8000-000000000002') || p_changes)).*
  from public.freight_requests r where creation_idempotency_key='a1300000-0000-4000-8000-000000000001';
$$;
select throws_ok($$ select pg_temp.insert_copy(jsonb_build_object('v2_snapshot',jsonb_set((select v2_snapshot from public.freight_requests where creation_idempotency_key='a1300000-0000-4000-8000-000000000001'),'{origin,city}','"Piura"'))) $$,'PT400','VALIDATION_ERROR','R-06 forged city in snapshot fails on INSERT');
select throws_ok($$ select pg_temp.insert_copy('{"origin_city":"Piura"}'::jsonb) $$,'PT400','VALIDATION_ERROR','R-06 contradictory flattened city fails on INSERT');
select throws_ok($$ select pg_temp.insert_copy('{"cargo_weight_kg":1}'::jsonb) $$,'PT400','VALIDATION_ERROR','R-06 contradictory flattened weight fails on INSERT');
select throws_ok($$ select pg_temp.insert_copy('{"v2_contract_version":null}'::jsonb) $$,'PT400','VALIDATION_ERROR','R-06 marker removal fails on INSERT');
select throws_ok($$ select pg_temp.insert_copy('{"v2_creation_payload":null}'::jsonb) $$,'PT400','VALIDATION_ERROR','R-06 null creation payload fails on INSERT');
select throws_ok($$ select pg_temp.insert_copy('{"draft_version":7}'::jsonb) $$,'PT400','VALIDATION_ERROR','R-06 forged initial version fails on INSERT');
select throws_ok($$ select pg_temp.insert_copy('{"creation_payload_hash":null}'::jsonb) $$,'PT400','VALIDATION_ERROR','R-06 invalid receipt hash fails on INSERT');
select throws_ok($$ select pg_temp.insert_copy(jsonb_build_object('v2_creation_payload',pg_temp.hac12_payload() #- '{cargoSpecification,units,0,dimensionsCm}')) $$,'PT400','VALIDATION_ERROR','R-06 malformed creation payload fails on INSERT');
select is((select count(*)::integer from public.freight_requests where code='V2-R06-COPY'),0,'forged INSERTs leave no copied draft or receipt');
select lives_ok($$ select pg_temp.insert_copy('{}') $$,'canonical direct insert with complete matching data still passes RLS');
select is((select v2_snapshot #>> '{origin,city}' from public.freight_requests where creation_idempotency_key='a1300000-0000-4000-8000-000000000001'),'Lima','positive source retains canonical Lima');

select lives_ok($$ select pg_temp.insert_copy('{"id":"a1300000-0000-4000-8000-000000000003","code":"LEGACY-R06-COPY","creation_idempotency_key":"a1300000-0000-4000-8000-000000000003","v2_contract_version":null,"v2_snapshot":null,"v2_creation_payload":null}') $$,'legacy insert keeps its original contract');
reset role;
select throws_ok($$ update public.capacity_calendars set available_windows='[{}]' where id='c23f0000-0000-4000-8000-000000000013' $$,'23514',null,'R-08 malformed availability window rejected');
select throws_ok($$ update public.capacity_calendars set available_windows='[{"startsAt":"2026-10-01T10:00:00Z"}]' where id='c23f0000-0000-4000-8000-000000000013' $$,'23514',null,'R-08 malformed availability window rejected');
select throws_ok($$ update public.capacity_calendars set available_windows='[{"startsAt":"bad","endsAt":"2026-10-02T12:00:00Z"}]' where id='c23f0000-0000-4000-8000-000000000013' $$,'23514',null,'R-08 malformed availability window rejected');
select throws_ok($$ update public.capacity_calendars set available_windows='[{"startsAt":"2026-10-02T12:00:00Z","endsAt":"2026-10-01T10:00:00Z"}]' where id='c23f0000-0000-4000-8000-000000000013' $$,'23514',null,'R-08 malformed availability window rejected');
select lives_ok($$ update public.capacity_calendars set available_windows='[]',complete=false where id='c23f0000-0000-4000-8000-000000000013' $$,'R-08 empty incomplete calendar represents missing evidence');
select lives_ok($$ update public.capacity_calendars set available_windows='[{"startsAt":"2026-10-01T10:00:00Z","endsAt":"2026-10-02T12:00:00Z"}]' where id='c23f0000-0000-4000-8000-000000000013' $$,'R-08 complete ordered window allowed');
select lives_ok($$ insert into public.capacity_reservations(capacity_calendar_id,starts_at,ends_at,status) values ('c23f0000-0000-4000-8000-000000000013','2026-10-05T10:00:00Z','2026-10-05T12:00:00Z','CONFIRMED') $$,'R-09 first confirmed reservation passes');
select throws_ok($$ insert into public.capacity_reservations(capacity_calendar_id,starts_at,ends_at,status) values ('c23f0000-0000-4000-8000-000000000013','2026-10-05T11:00:00Z','2026-10-05T13:00:00Z','HELD') $$,'23P01',null,'R-09 overlapping HELD reservation rejected');
select throws_ok($$ insert into public.capacity_reservations(capacity_calendar_id,starts_at,ends_at,status) values ('c23f0000-0000-4000-8000-000000000013','2026-10-05T11:00:00Z','2026-10-05T13:00:00Z','CONFIRMED') $$,'23P01',null,'R-09 overlapping CONFIRMED reservation rejected');
select lives_ok($$ insert into public.capacity_reservations(capacity_calendar_id,starts_at,ends_at,status) values ('c23f0000-0000-4000-8000-000000000013','2026-10-05T12:00:00Z','2026-10-05T13:00:00Z','CONFIRMED') $$,'R-09 adjacent half-open reservation allowed');
select lives_ok($$ insert into public.capacity_reservations(capacity_calendar_id,starts_at,ends_at,status) values ('c23f0000-0000-4000-8000-000000000013','2026-10-05T11:00:00Z','2026-10-05T14:00:00Z','RELEASED') $$,'R-09 released reservation can overlap');
select throws_ok($$ update public.capacity_reservations set status='HELD' where capacity_calendar_id='c23f0000-0000-4000-8000-000000000013' and status='RELEASED' $$,'23P01',null,'R-09 reactivating an overlapping released reservation rejected');
select lives_ok($$ update public.capacity_reservations set status='RELEASED' where capacity_calendar_id='c23f0000-0000-4000-8000-000000000013' and starts_at='2026-10-05T10:00:00Z'; insert into public.capacity_reservations(capacity_calendar_id,starts_at,ends_at,status) values ('c23f0000-0000-4000-8000-000000000013','2026-10-05T10:00:00Z','2026-10-05T12:00:00Z','HELD') $$,'R-09 releasing capacity permits a new hold');
select * from finish();
rollback;

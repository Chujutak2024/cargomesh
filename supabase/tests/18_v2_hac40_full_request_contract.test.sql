-- Full request contract; explicit local fixture. Every test write rolls back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path=extensions,public;
select no_plan();
create temporary table full_input(value jsonb);
insert into full_input values ('{
 "schemaVersion":"2.0","origin":{"label":"Gate Lima","countryCode":"PE","city":"Lima","lat":-12,"lng":-77},
 "destination":{"label":"Gate Arequipa","countryCode":"PE","city":"Arequipa","lat":-16,"lng":-71},
 "pickupWindow":{"startsAt":"2026-10-05T08:00:00Z","endsAt":"2026-10-05T18:00:00Z"},
 "deliveryWindow":{"startsAt":"2026-10-07T08:00:00Z","endsAt":"2026-10-07T20:00:00Z"},
 "acceptedModes":["ROAD","SEA"],"serviceType":"LTL","selectionObjective":"LOWEST_COST",
 "requiredEquipment":null,"preferredEquipment":"ISO_CONTAINER",
 "cargoSpecification":{"categoryCode":"GENERAL","description":"Full contract QA","packaging":"PALLET",
   "totalWeightKg":1000,"totalVolumeM3":2,"divisible":true,"requirements":[],
   "availableDocuments":[{"code":"MSDS","reference":"document:qa","issuedAt":"2026-01-01T00:00:00Z","validUntil":"2027-01-01T00:00:00Z"}],
   "units":[{"packageType":"PALLET","quantity":1,"weightPerUnitKg":1000,"volumePerUnitM3":2,
     "dimensionsCm":{"length":100,"width":100,"height":200},"indivisible":false,"stackable":true,"unitsPerPackage":12}]},
 "contacts":{"pickup":{"name":"Pickup","phoneE164":"+51911111111","company":"Sender","addressDetail":"Gate 1","handlingInstructions":"Call"},
   "recipient":{"name":"Recipient","phoneE164":"+51922222222","company":"Consignee","addressDetail":"Gate 2","handlingInstructions":"Forklift required"}},
 "budget":{"amount":500,"currency":"USD"}
}');
create temporary table full_result(value jsonb);
grant select on full_input to authenticated;
grant select,insert on full_result to authenticated;
create function pg_temp.full_create(value jsonb,key uuid) returns jsonb language sql as $$
 select public.create_v2_freight_request('c2300000-0000-4000-8000-000000000001',
  'c2320000-0000-4000-8000-000000000001',key,private.hash_v2_freight_payload(value),value);
$$;
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"c2310000-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok($$select pg_temp.full_create(jsonb_set((select value from full_input),'{acceptedModes}','["ROAD","ROAD"]'),
 'd0600000-0000-4000-8000-000000000001')$$,'PT400','VALIDATION_ERROR','duplicate modes rejected without occupying key');
select throws_ok($$select pg_temp.full_create(jsonb_set((select value from full_input),'{serviceType}','"PARCEL"'),
 'd0600000-0000-4000-8000-000000000001')$$,'PT400','VALIDATION_ERROR','unknown class rejected');
select throws_ok($$select pg_temp.full_create(jsonb_set((select value from full_input),'{cargoSpecification,units,0,unitsPerPackage}','0'),
 'd0600000-0000-4000-8000-000000000001')$$,'PT400','VALIDATION_ERROR','package contents must be positive');
select throws_ok($$select pg_temp.full_create(jsonb_set((select value from full_input),'{cargoSpecification,availableDocuments,0,validUntil}','"2025-01-01T00:00:00Z"'),
 'd0600000-0000-4000-8000-000000000001')$$,'PT400','VALIDATION_ERROR','document validity checked in SQL');
insert into full_result select pg_temp.full_create((select value from full_input),'d0600000-0000-4000-8000-000000000001');
select is((select value#>>'{snapshot,serviceType}' from full_result),'LTL','LTL accepted rather than replaced by FTL');
select is((select value#>'{snapshot,acceptedModes}' from full_result),'["ROAD","SEA"]'::jsonb,'all accepted modes preserved');
select is((select value#>>'{snapshot,contacts,recipient,company}' from full_result),'Consignee','company persisted');
select is((select value#>>'{snapshot,contacts,recipient,handlingInstructions}' from full_result),'Forklift required','instructions persisted');
select is((select value#>>'{snapshot,cargoSpecification,units,0,unitsPerPackage}' from full_result),'12','package contents persisted');
select is((select service_type from public.freight_requests where id=(select (value->>'id')::uuid from full_result)),'LTL','flattened class coherent');
select is((select available_documents from public.freight_requests where id=(select (value->>'id')::uuid from full_result)),
 (select value#>'{cargoSpecification,availableDocuments}' from full_input),'flattened documents coherent');
select is((pg_temp.full_create((select value from full_input),'d0600000-0000-4000-8000-000000000001')->>'idempotentReplay'),'true','creation retry preserved');
select throws_ok($$select pg_temp.full_create(jsonb_set((select value from full_input),'{serviceType}','"FTL"'),
 'd0600000-0000-4000-8000-000000000001')$$,'PT409','IDEMPOTENCY_CONFLICT','class participates in receipt fingerprint');
select lives_ok($$select public.command_v2_freight_request('c2300000-0000-4000-8000-000000000001',
 'c2320000-0000-4000-8000-000000000001','d0600000-0000-4000-8000-000000000002',
 (select (value->>'id')::uuid from full_result),1,'REVISE',
 jsonb_set(jsonb_set((select value from full_input),'{serviceType}','"FTL"'),'{preferredEquipment}','"BOX_TRUCK"'))$$,
 'full revision updates snapshot and projections atomically');
select is((select preferred_equipment_code from public.freight_requests where id=(select (value->>'id')::uuid from full_result)),'BOX_TRUCK','preferred equipment updated');
select is((select service_type from public.freight_requests where id=(select (value->>'id')::uuid from full_result)),'FTL','revised class updated');
select lives_ok($$select public.command_v2_freight_request('c2300000-0000-4000-8000-000000000001',
 'c2320000-0000-4000-8000-000000000001','d0600000-0000-4000-8000-000000000003',
 (select (value->>'id')::uuid from full_result),2,'SUBMIT',null)$$,'manual canonical locations can be submitted');
select is((select status from public.freight_requests where id=(select (value->>'id')::uuid from full_result)),'PENDING','submitted request persisted');
select lives_ok($$select pg_temp.full_create(jsonb_set((select value from full_input),'{acceptedModes}','["AIR"]'),
 'd0600000-0000-4000-8000-000000000004')$$,'single AIR mode accepted as request data, not live service');
reset role;
select is((select count(*)::integer from public.freight_requests where creation_idempotency_key in
 ('d0600000-0000-4000-8000-000000000001','d0600000-0000-4000-8000-000000000004')),2,'only successful creates persist');
select * from finish();
rollback;

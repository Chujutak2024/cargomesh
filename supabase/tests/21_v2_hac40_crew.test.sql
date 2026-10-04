-- Synthetic scenario and privileged dependency provisioning are fully rolled back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
select no_plan();
create function pg_temp.hac40_payload() returns jsonb language sql as $$
select '{"schemaVersion":"2.0",
 "origin":{"facilityId":"c2330000-0000-4000-8000-000000000001"},
 "destination":{"facilityId":"c2330000-0000-4000-8000-000000000002"},
 "pickupWindow":{"startsAt":"2027-01-15T08:00:00Z","endsAt":"2027-01-15T18:00:00Z"},
 "deliveryWindow":{"startsAt":"2027-01-15T08:00:00Z","endsAt":"2027-01-15T20:00:00Z"},
 "acceptedModes":["ROAD"],"requiredEquipment":null,
 "cargoSpecification":{"categoryCode":"GENERAL","description":"QA original","packaging":"PALLET",
  "totalWeightKg":1000,"totalVolumeM3":2,"divisible":true,"requirements":[],
  "units":[{"packageType":"PALLET","quantity":1,"weightPerUnitKg":1000,"volumePerUnitM3":2,
   "dimensionsCm":{"length":100,"width":100,"height":200},"indivisible":false,"stackable":true}]},
 "contacts":{"pickup":{"name":"QA","phoneE164":"+51911111111"},
  "recipient":{"name":"QA","phoneE164":"+51922222222"}},"budget":{"amount":500,"currency":"USD"}}'::jsonb;
$$;
create temporary table request_result(value jsonb);
grant select,insert on request_result to authenticated;
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"c2310000-0000-4000-8000-000000000001","role":"authenticated"}';
insert into request_result select public.create_v2_freight_request(
 'c2300000-0000-4000-8000-000000000001','c2320000-0000-4000-8000-000000000001',
 'd0410000-0000-4000-8000-000000000001',private.hash_v2_freight_payload(pg_temp.hac40_payload()),pg_temp.hac40_payload());
reset role;
create temporary table crew_inputs(kind text primary key,value jsonb);
create temporary table crew_saved(kind text primary key,id uuid,key uuid,receipt jsonb);
grant all on crew_inputs,crew_saved to authenticated;
create function pg_temp.crew_cmd(k text,i uuid,key uuid,v integer,body jsonb) returns jsonb language sql as $$
select public.command_v2_catalog('c2300000-0000-4000-8000-000000000001','c2320000-0000-4000-8000-000000000001',k,'c2340000-0000-4000-8000-000000000001',null,i,key,v,body);$$;
create function pg_temp.crew_read(k text,i uuid) returns jsonb language sql as $$
select public.read_v2_catalog('c2300000-0000-4000-8000-000000000001','c2320000-0000-4000-8000-000000000001',k,'c2340000-0000-4000-8000-000000000001',null,i,100,0);$$;
insert into crew_inputs values('assets','{"schemaVersion": "2.0", "serviceId": "c2360000-0000-4000-8000-000000000001", "code": "CREW_QA", "mode": "ROAD", "equipmentType": "BOX_TRUCK", "role": "LOAD_BEARING", "usefulCapacityKg": 10000, "usableVolumeM3": 40, "operatingStatus": "AVAILABLE", "homeDepotId": "c2350000-0000-4000-8000-000000000001", "provenance": "OWN", "partnerId": null, "evidence": "fixture:asset", "roadVehicle": {"plate": "QA-CREW", "registrationCode": "QA-REG", "registeredAt": "2026-01-01", "brand": "Synthetic", "model": "Test", "variant": null, "bodyType": "BOX", "usableDimensions": {"length": 500, "width": 240, "height": 250}, "grossWeightLimitKg": 15000, "odometerKm": 5000, "conditionReason": null, "axleConfig": "2S1"}}');
insert into crew_inputs values('calendars','{"schemaVersion": "2.0", "serviceId": "c2360000-0000-4000-8000-000000000001", "assetId": "ASSET", "capacityPoolId": null, "timezone": "America/Lima", "horizon": {"startsAt": "2027-01-01T00:00:00Z", "endsAt": "2027-02-01T00:00:00Z"}, "source": "fixture:calendar", "lastVerifiedAt": "2026-01-01T00:00:00Z", "freshness": "SIMULATED", "validUntil": "2027-03-01T00:00:00Z", "complete": true, "availableWindows": [{"startsAt": "2027-01-01T00:00:00Z", "endsAt": "2027-02-01T00:00:00Z"}], "readyPickupAreaId": "c2370000-0000-4000-8000-000000000001"}');
insert into crew_inputs values('drivers','{"schemaVersion": "2.0", "serviceId": "c2360000-0000-4000-8000-000000000001", "fullName": "[SYNTHETIC] Crew QA", "portalAccountId": null, "licenseClass": "QA_LICENSE", "licenseValidUntil": "2027-01-31", "licenseTimezone": "America/Lima", "qualifications": ["QA_CERT"], "experienceYears": 2, "dutyStatus": "AVAILABLE", "evidence": {"reference": "fixture:crew", "verifiedAt": "2026-01-01T00:00:00Z", "validUntil": "2027-03-01T00:00:00Z", "provenanceStatus": "SIMULATED"}, "availableWindows": [{"startsAt": "2027-01-15T08:00:00Z", "endsAt": "2027-01-15T12:00:00Z"}], "dutyWindow": {"startsAt": "2027-01-15T00:00:00Z", "endsAt": "2027-01-16T00:00:00Z"}, "maximumDutySeconds": 28800, "usedDutySeconds": 0}');
insert into crew_inputs values('vehicle-combinations','{"schemaVersion": "2.0", "serviceId": "c2360000-0000-4000-8000-000000000001", "kind": "QA_COUPLING", "configuration": "Synthetic pair", "assetIds": ["ASSET"], "coupledWindow": {"startsAt": "2027-01-15T08:00:00Z", "endsAt": "2027-01-15T12:00:00Z"}, "evidence": [{"reference": "fixture:crew", "verifiedAt": "2026-01-01T00:00:00Z", "validUntil": "2027-03-01T00:00:00Z", "provenanceStatus": "SIMULATED"}], "combinedTareKg": 5000, "grossWeightLimitKg": 15000, "status": "PROPOSED", "compatibilityEvidence": {"reference": "fixture:crew", "verifiedAt": "2026-01-01T00:00:00Z", "validUntil": "2027-03-01T00:00:00Z", "provenanceStatus": "SIMULATED"}}');
insert into crew_inputs values('driver-assignments','{"schemaVersion": "2.0", "serviceId": "c2360000-0000-4000-8000-000000000001", "executionId": "EXECUTION", "driverId": "DRIVER", "window": {"startsAt": "2027-01-15T08:00:00Z", "endsAt": "2027-01-15T12:00:00Z"}, "status": "PROPOSED", "evidence": {"reference": "fixture:crew", "verifiedAt": "2026-01-01T00:00:00Z", "validUntil": "2027-03-01T00:00:00Z", "provenanceStatus": "SIMULATED"}, "role": "PRIMARY", "acceptedLicenseClasses": ["QA_LICENSE"], "requiredQualifications": ["QA_CERT"], "policyEvidence": {"reference": "fixture:crew", "verifiedAt": "2026-01-01T00:00:00Z", "validUntil": "2027-03-01T00:00:00Z", "provenanceStatus": "SIMULATED"}}');
insert into crew_inputs values('vehicle-assignments','{"schemaVersion": "2.0", "serviceId": "c2360000-0000-4000-8000-000000000001", "executionId": "EXECUTION", "assetId": "ASSET", "combinationId": null, "reservationId": "RESERVATION", "window": {"startsAt": "2027-01-15T08:00:00Z", "endsAt": "2027-01-15T12:00:00Z"}, "status": "PROPOSED", "evidence": {"reference": "fixture:crew", "verifiedAt": "2026-01-01T00:00:00Z", "validUntil": "2027-03-01T00:00:00Z", "provenanceStatus": "SIMULATED"}, "capacityCommitted": {"weightKg": 1000, "volumeM3": 2}}');
set local role anon;
select throws_ok($$select pg_temp.crew_read('drivers',null)$$,'42501',null,'anon cannot read drivers');
reset role;set local role authenticated;
select throws_ok($$select pg_temp.crew_read('drivers',null)$$,'PT403','FORBIDDEN_CATALOG','shipper cannot read drivers');
select throws_ok($$select pg_temp.crew_cmd('drivers',null,gen_random_uuid(),null,(select value from crew_inputs where kind='drivers'))$$,'PT403','FORBIDDEN_CATALOG','shipper cannot publish drivers');
reset role;
insert into private.v2_catalog_grants(auth_user_id,carrier_id,permission) values('c2310000-0000-4000-8000-000000000001','c2340000-0000-4000-8000-000000000001','CARRIER_EDITOR');
insert into public.transport_executions(id,organization_id,freight_request_id,carrier_id,carrier_service_id,status,planned_starts_at,planned_ends_at)
select 'd0520000-0000-4000-8000-000000000001','c2300000-0000-4000-8000-000000000001',(value->>'id')::uuid,
 'c2340000-0000-4000-8000-000000000001','c2360000-0000-4000-8000-000000000001','PLANNED','2027-01-15T00:00:00Z','2027-01-16T00:00:00Z' from request_result;
update crew_inputs set value=jsonb_set(value,'{executionId}','"d0520000-0000-4000-8000-000000000001"') where kind in('driver-assignments','vehicle-assignments');
set local role authenticated;
with keys as materialized(select gen_random_uuid() key),saved as materialized(select key,pg_temp.crew_cmd('assets',null,key,null,(select value from crew_inputs where kind='assets')) r from keys) insert into crew_saved select 'assets',(r#>>'{record,id}')::uuid,key,r from saved;
update crew_inputs set value=jsonb_set(value,'{assetId}',to_jsonb((select id::text from crew_saved where kind='assets'))) where kind in('calendars','vehicle-assignments');
update crew_inputs set value=jsonb_set(value,'{assetIds}',jsonb_build_array((select id::text from crew_saved where kind='assets'))) where kind='vehicle-combinations';
with keys as materialized(select gen_random_uuid() key),saved as materialized(select key,pg_temp.crew_cmd('calendars',null,key,null,(select value from crew_inputs where kind='calendars')) r from keys) insert into crew_saved select 'calendars',(r#>>'{record,id}')::uuid,key,r from saved;
reset role;
insert into public.capacity_reservations(id,capacity_calendar_id,freight_request_id,starts_at,ends_at,status,execution_id,committed_capacity,evidence)
select 'd0520000-0000-4000-8000-000000000002',(select id from crew_saved where kind='calendars'),(value->>'id')::uuid,
 '2027-01-15T08:00:00Z','2027-01-15T12:00:00Z','HELD','d0520000-0000-4000-8000-000000000001','{"weightKg":1000,"volumeM3":2}',
 (select value->'evidence' from crew_inputs where kind='vehicle-assignments') from request_result;
update crew_inputs set value=jsonb_set(value,'{reservationId}','"d0520000-0000-4000-8000-000000000002"') where kind='vehicle-assignments';
set local role authenticated;
with keys as materialized(select gen_random_uuid() key),saved as materialized(select key,pg_temp.crew_cmd('drivers',null,key,null,(select value from crew_inputs where kind='drivers')) r from keys) insert into crew_saved select 'drivers',(r#>>'{record,id}')::uuid,key,r from saved;
select is((select receipt#>>'{record,version}' from crew_saved where kind='drivers'),'1','drivers: create');
select is((select pg_temp.crew_cmd('drivers',null,key,null,(select value from crew_inputs where kind='drivers'))->>'replay' from crew_saved where kind='drivers'),'true','drivers: replay');
select is((pg_temp.crew_read('drivers',(select id from crew_saved where kind='drivers'))#>>'{0,serviceId}'),'c2360000-0000-4000-8000-000000000001','drivers: scoped detail');
select is(jsonb_array_length(pg_temp.crew_read('drivers',null)),1,'drivers: list');
select is((select pg_temp.crew_cmd('drivers',id,gen_random_uuid(),1,(select value from crew_inputs where kind='drivers'))#>>'{record,version}' from crew_saved where kind='drivers'),'2','drivers: revision');
select throws_ok($$select pg_temp.crew_cmd('drivers',id,gen_random_uuid(),1,(select value from crew_inputs where kind='drivers')) from crew_saved where kind='drivers'$$,'PT409','STALE_DRAFT','drivers: stale');
select throws_ok($$select pg_temp.crew_cmd('drivers',null,gen_random_uuid(),null,(select value||'{"forged":true}' from crew_inputs where kind='drivers'))$$,'PT400','VALIDATION_ERROR','drivers: strict SQL DTO');
select throws_ok($$select pg_temp.crew_cmd('drivers',null,key,null,(select jsonb_set(value,'{serviceId}','"c23a0000-0000-4000-8000-000000000001"') from crew_inputs where kind='drivers')) from crew_saved where kind='drivers'$$,'PT404','CATALOG_NOT_FOUND','drivers: foreign service');
select is((select pg_temp.crew_cmd('drivers',null,key,null,(select value from crew_inputs where kind='drivers'))#>>'{record,version}' from crew_saved where kind='drivers'),'1','drivers: original receipt stable');
with keys as materialized(select gen_random_uuid() key),saved as materialized(select key,pg_temp.crew_cmd('vehicle-combinations',null,key,null,(select value from crew_inputs where kind='vehicle-combinations')) r from keys) insert into crew_saved select 'vehicle-combinations',(r#>>'{record,id}')::uuid,key,r from saved;
select is((select receipt#>>'{record,version}' from crew_saved where kind='vehicle-combinations'),'1','vehicle-combinations: create');
select is((select pg_temp.crew_cmd('vehicle-combinations',null,key,null,(select value from crew_inputs where kind='vehicle-combinations'))->>'replay' from crew_saved where kind='vehicle-combinations'),'true','vehicle-combinations: replay');
select is((pg_temp.crew_read('vehicle-combinations',(select id from crew_saved where kind='vehicle-combinations'))#>>'{0,serviceId}'),'c2360000-0000-4000-8000-000000000001','vehicle-combinations: scoped detail');
select is(jsonb_array_length(pg_temp.crew_read('vehicle-combinations',null)),1,'vehicle-combinations: list');
select is((select pg_temp.crew_cmd('vehicle-combinations',id,gen_random_uuid(),1,(select value from crew_inputs where kind='vehicle-combinations'))#>>'{record,version}' from crew_saved where kind='vehicle-combinations'),'2','vehicle-combinations: revision');
select throws_ok($$select pg_temp.crew_cmd('vehicle-combinations',id,gen_random_uuid(),1,(select value from crew_inputs where kind='vehicle-combinations')) from crew_saved where kind='vehicle-combinations'$$,'PT409','STALE_DRAFT','vehicle-combinations: stale');
select throws_ok($$select pg_temp.crew_cmd('vehicle-combinations',null,gen_random_uuid(),null,(select value||'{"forged":true}' from crew_inputs where kind='vehicle-combinations'))$$,'PT400','VALIDATION_ERROR','vehicle-combinations: strict SQL DTO');
select throws_ok($$select pg_temp.crew_cmd('vehicle-combinations',null,key,null,(select jsonb_set(value,'{serviceId}','"c23a0000-0000-4000-8000-000000000001"') from crew_inputs where kind='vehicle-combinations')) from crew_saved where kind='vehicle-combinations'$$,'PT404','CATALOG_NOT_FOUND','vehicle-combinations: foreign service');
select is((select pg_temp.crew_cmd('vehicle-combinations',null,key,null,(select value from crew_inputs where kind='vehicle-combinations'))#>>'{record,version}' from crew_saved where kind='vehicle-combinations'),'1','vehicle-combinations: original receipt stable');
update crew_inputs set value=jsonb_set(value,'{driverId}',to_jsonb((select id::text from crew_saved where kind='drivers'))) where kind='driver-assignments';
with keys as materialized(select gen_random_uuid() key),saved as materialized(select key,pg_temp.crew_cmd('driver-assignments',null,key,null,(select value from crew_inputs where kind='driver-assignments')) r from keys) insert into crew_saved select 'driver-assignments',(r#>>'{record,id}')::uuid,key,r from saved;
select is((select receipt#>>'{record,version}' from crew_saved where kind='driver-assignments'),'1','driver-assignments: create');
select is((select pg_temp.crew_cmd('driver-assignments',null,key,null,(select value from crew_inputs where kind='driver-assignments'))->>'replay' from crew_saved where kind='driver-assignments'),'true','driver-assignments: replay');
select is((pg_temp.crew_read('driver-assignments',(select id from crew_saved where kind='driver-assignments'))#>>'{0,serviceId}'),'c2360000-0000-4000-8000-000000000001','driver-assignments: scoped detail');
select is(jsonb_array_length(pg_temp.crew_read('driver-assignments',null)),1,'driver-assignments: list');
select is((select pg_temp.crew_cmd('driver-assignments',id,gen_random_uuid(),1,(select value from crew_inputs where kind='driver-assignments'))#>>'{record,version}' from crew_saved where kind='driver-assignments'),'2','driver-assignments: revision');
select throws_ok($$select pg_temp.crew_cmd('driver-assignments',id,gen_random_uuid(),1,(select value from crew_inputs where kind='driver-assignments')) from crew_saved where kind='driver-assignments'$$,'PT409','STALE_DRAFT','driver-assignments: stale');
select throws_ok($$select pg_temp.crew_cmd('driver-assignments',null,gen_random_uuid(),null,(select value||'{"forged":true}' from crew_inputs where kind='driver-assignments'))$$,'PT400','VALIDATION_ERROR','driver-assignments: strict SQL DTO');
select throws_ok($$select pg_temp.crew_cmd('driver-assignments',null,key,null,(select jsonb_set(value,'{serviceId}','"c23a0000-0000-4000-8000-000000000001"') from crew_inputs where kind='driver-assignments')) from crew_saved where kind='driver-assignments'$$,'PT404','CATALOG_NOT_FOUND','driver-assignments: foreign service');
select is((select pg_temp.crew_cmd('driver-assignments',null,key,null,(select value from crew_inputs where kind='driver-assignments'))#>>'{record,version}' from crew_saved where kind='driver-assignments'),'1','driver-assignments: original receipt stable');
with keys as materialized(select gen_random_uuid() key),saved as materialized(select key,pg_temp.crew_cmd('vehicle-assignments',null,key,null,(select value from crew_inputs where kind='vehicle-assignments')) r from keys) insert into crew_saved select 'vehicle-assignments',(r#>>'{record,id}')::uuid,key,r from saved;
select is((select receipt#>>'{record,version}' from crew_saved where kind='vehicle-assignments'),'1','vehicle-assignments: create');
select is((select pg_temp.crew_cmd('vehicle-assignments',null,key,null,(select value from crew_inputs where kind='vehicle-assignments'))->>'replay' from crew_saved where kind='vehicle-assignments'),'true','vehicle-assignments: replay');
select is((pg_temp.crew_read('vehicle-assignments',(select id from crew_saved where kind='vehicle-assignments'))#>>'{0,serviceId}'),'c2360000-0000-4000-8000-000000000001','vehicle-assignments: scoped detail');
select is(jsonb_array_length(pg_temp.crew_read('vehicle-assignments',null)),1,'vehicle-assignments: list');
select is((select pg_temp.crew_cmd('vehicle-assignments',id,gen_random_uuid(),1,(select value from crew_inputs where kind='vehicle-assignments'))#>>'{record,version}' from crew_saved where kind='vehicle-assignments'),'2','vehicle-assignments: revision');
select throws_ok($$select pg_temp.crew_cmd('vehicle-assignments',id,gen_random_uuid(),1,(select value from crew_inputs where kind='vehicle-assignments')) from crew_saved where kind='vehicle-assignments'$$,'PT409','STALE_DRAFT','vehicle-assignments: stale');
select throws_ok($$select pg_temp.crew_cmd('vehicle-assignments',null,gen_random_uuid(),null,(select value||'{"forged":true}' from crew_inputs where kind='vehicle-assignments'))$$,'PT400','VALIDATION_ERROR','vehicle-assignments: strict SQL DTO');
select throws_ok($$select pg_temp.crew_cmd('vehicle-assignments',null,key,null,(select jsonb_set(value,'{serviceId}','"c23a0000-0000-4000-8000-000000000001"') from crew_inputs where kind='vehicle-assignments')) from crew_saved where kind='vehicle-assignments'$$,'PT404','CATALOG_NOT_FOUND','vehicle-assignments: foreign service');
select is((select pg_temp.crew_cmd('vehicle-assignments',null,key,null,(select value from crew_inputs where kind='vehicle-assignments'))#>>'{record,version}' from crew_saved where kind='vehicle-assignments'),'1','vehicle-assignments: original receipt stable');
select throws_ok($$select pg_temp.crew_cmd('driver-assignments',null,gen_random_uuid(),null,(select value from crew_inputs where kind='driver-assignments'))$$,'23P01',null,'driver assignment overlap excluded');
select throws_ok($$select pg_temp.crew_cmd('vehicle-assignments',null,gen_random_uuid(),null,(select value from crew_inputs where kind='vehicle-assignments'))$$,'PT409','FLEET_COMMITMENT_CONFLICT','FTL duplicate assignment blocked');
select throws_ok($$select pg_temp.crew_cmd('drivers',id,gen_random_uuid(),2,(select value from crew_inputs where kind='drivers')) from crew_saved where kind='drivers'$$,'PT409','FLEET_COMMITMENT_CONFLICT','driver edit cannot invalidate assignment');
select throws_ok($$select pg_temp.crew_cmd('vehicle-assignments',id,gen_random_uuid(),2,(select jsonb_set(value,'{status}','"CONFIRMED"') from crew_inputs where kind='vehicle-assignments')) from crew_saved where kind='vehicle-assignments'$$,'PT409','FLEET_COMMITMENT_CONFLICT','hold cannot confirm assignment');
select lives_ok($$select pg_temp.crew_cmd('driver-assignments',id,gen_random_uuid(),2,(select jsonb_set(value,'{status}','"CONFIRMED"') from crew_inputs where kind='driver-assignments')) from crew_saved where kind='driver-assignments'$$,'qualified driver confirms with explicit policy evidence');
reset role;
update public.capacity_reservations set status='CONFIRMED' where id='d0520000-0000-4000-8000-000000000002';
set local role authenticated;
select lives_ok($$select pg_temp.crew_cmd('vehicle-assignments',id,gen_random_uuid(),2,(select jsonb_set(value,'{status}','"CONFIRMED"') from crew_inputs where kind='vehicle-assignments')) from crew_saved where kind='vehicle-assignments'$$,'vehicle confirms only with coherent confirmed reservation');
select lives_ok($$select pg_temp.crew_cmd('vehicle-assignments',id,gen_random_uuid(),3,(select jsonb_set(value,'{status}','"RELEASED"') from crew_inputs where kind='vehicle-assignments')) from crew_saved where kind='vehicle-assignments'$$,'release confirmed assignment');
select throws_ok($$select pg_temp.crew_cmd('vehicle-assignments',id,gen_random_uuid(),4,(select value from crew_inputs where kind='vehicle-assignments')) from crew_saved where kind='vehicle-assignments'$$,'PT400','INVALID_ASSIGNMENT_TRANSITION','released assignment cannot resurrect');
reset role;
update public.carrier_services set service_type='LTL' where id='c2360000-0000-4000-8000-000000000001';
set local role authenticated;
with keys as materialized(select gen_random_uuid() key),saved as materialized(select key,pg_temp.crew_cmd('vehicle-assignments',null,key,null,(select jsonb_set(value,'{status}','"CONFIRMED"') from crew_inputs where kind='vehicle-assignments'))r from keys)
insert into crew_saved select 'ltl-first',(r#>>'{record,id}')::uuid,key,r from saved;
select is((select receipt#>>'{record,version}' from crew_saved where kind='ltl-first'),'1','LTL first confirmed allocation within reserved capacity');
select throws_ok($$select pg_temp.crew_cmd('vehicle-assignments',null,gen_random_uuid(),null,(select jsonb_set(value,'{capacityCommitted,weightKg}','10000') from crew_inputs where kind='vehicle-assignments'))$$,'PT409','FLEET_COMMITMENT_CONFLICT','LTL aggregate exceeds physical capacity');
with keys as materialized(select gen_random_uuid() key),saved as materialized(select key,pg_temp.crew_cmd('vehicle-assignments',null,key,null,(select value from crew_inputs where kind='vehicle-assignments'))r from keys)
insert into crew_saved select 'ltl-extra',(r#>>'{record,id}')::uuid,key,r from saved;
select is((select receipt#>>'{record,version}' from crew_saved where kind='ltl-extra'),'1','same-trip LTL allocation within residual capacity');
select throws_ok($$select pg_temp.crew_cmd('vehicle-assignments',id,gen_random_uuid(),1,(select jsonb_set(value,'{status}','"CONFIRMED"') from crew_inputs where kind='vehicle-assignments')) from crew_saved where kind='ltl-extra'$$,'PT409','FLEET_COMMITMENT_CONFLICT','LTL cannot confirm more capacity than reserved');
select lives_ok($$select pg_temp.crew_cmd('vehicle-assignments',id,gen_random_uuid(),1,(select jsonb_set(value,'{status}','"RELEASED"') from crew_inputs where kind='vehicle-assignments')) from crew_saved where kind='ltl-extra'$$,'release extra proposed LTL allocation');
reset role;
select throws_ok($$update public.capacity_reservations set status='RELEASED' where id='d0520000-0000-4000-8000-000000000002'$$,'PT409','FLEET_COMMITMENT_CONFLICT','reservation cannot release while assignment confirmed');
select throws_ok($$update public.carrier_services set service_type='FTL' where id='c2360000-0000-4000-8000-000000000001'$$,'PT409','FLEET_COMMITMENT_CONFLICT','service class frozen while assignments active');
set local role authenticated;
select lives_ok($$select pg_temp.crew_cmd('vehicle-assignments',id,gen_random_uuid(),1,(select jsonb_set(value,'{status}','"RELEASED"') from crew_inputs where kind='vehicle-assignments')) from crew_saved where kind='ltl-first'$$,'release first confirmed LTL allocation');
select throws_ok($$select pg_temp.crew_cmd('driver-assignments',id,gen_random_uuid(),3,(select jsonb_set(jsonb_set(value,'{status}','"CONFIRMED"'),'{acceptedLicenseClasses}','["WRONG"]') from crew_inputs where kind='driver-assignments')) from crew_saved where kind='driver-assignments'$$,'PT409','FLEET_COMMITMENT_CONFLICT','wrong license cannot confirm');
select throws_ok($$select pg_temp.crew_cmd('driver-assignments',id,gen_random_uuid(),3,(select jsonb_set(jsonb_set(value,'{status}','"CONFIRMED"'),'{evidence}','null') from crew_inputs where kind='driver-assignments')) from crew_saved where kind='driver-assignments'$$,'PT409','FLEET_EVIDENCE_REQUIRED','missing driver assignment evidence remains blocked');
select throws_ok($$select pg_temp.crew_cmd('drivers',null,gen_random_uuid(),null,(select jsonb_set(value,'{qualifications}','["QA_CERT","QA_CERT"]') from crew_inputs where kind='drivers'))$$,'PT400','VALIDATION_ERROR','duplicate driver qualification rejected by SQL');
select lives_ok($$select pg_temp.crew_cmd('vehicle-combinations',id,gen_random_uuid(),2,(select jsonb_set(value,'{status}','"COUPLED"') from crew_inputs where kind='vehicle-combinations')) from crew_saved where kind='vehicle-combinations'$$,'coupling with source and compatibility evidence');
select throws_ok($$select pg_temp.crew_cmd('vehicle-combinations',null,gen_random_uuid(),null,(select jsonb_set(value,'{status}','"COUPLED"') from crew_inputs where kind='vehicle-combinations'))$$,'23P01',null,'same asset cannot belong to overlapping coupled combinations');
select throws_ok($$select pg_temp.crew_cmd('vehicle-combinations',null,gen_random_uuid(),null,(select jsonb_set(value,'{assetIds}','[]') from crew_inputs where kind='vehicle-combinations'))$$,'PT400','VALIDATION_ERROR','empty combination rejected');
select throws_ok($$select pg_temp.crew_cmd('drivers',null,gen_random_uuid(),null,(select jsonb_set(value,'{licenseValidUntil}','"2027-02-30"') from crew_inputs where kind='drivers'))$$,'22008',null,'SQL rejects nonexistent LocalDate');
select throws_ok($$select pg_temp.crew_cmd('drivers',null,gen_random_uuid(),null,(select jsonb_set(value,'{licenseTimezone}','"Mars/Olympus"') from crew_inputs where kind='drivers'))$$,'PT400','VALIDATION_ERROR','SQL rejects fake timezone');
select throws_ok($$select * from public.drivers$$,'42501',null,'operational driver data cannot bypass command authorization');
select throws_ok($$update public.vehicle_assignments set status='CONFIRMED'$$,'42501',null,'direct assignment write denied');
reset role;
select lives_ok($$update public.capacity_reservations set status='RELEASED' where id='d0520000-0000-4000-8000-000000000002'$$,'reservation releases after assignment release');
update private.v2_catalog_grants set revoked_at=now() where auth_user_id='c2310000-0000-4000-8000-000000000001' and permission='CARRIER_EDITOR';
set local role authenticated;
select throws_ok($$select pg_temp.crew_read('drivers',null)$$,'PT403','FORBIDDEN_CATALOG','revocation denies read');
select throws_ok($$select pg_temp.crew_cmd('drivers',null,key,null,(select value from crew_inputs where kind='drivers')) from crew_saved where kind='drivers'$$,'PT403','FORBIDDEN_CATALOG','revocation denies replay');
set constraints all immediate;
reset role;
select is((select count(*)::integer from pg_class where relname in('drivers','vehicle_combinations','vehicle_combination_assets','driver_assignments','vehicle_assignments','transport_executions','carrier_operators') and relrowsecurity),7,'all new tables have RLS');
set constraints all immediate;
select * from finish();rollback;

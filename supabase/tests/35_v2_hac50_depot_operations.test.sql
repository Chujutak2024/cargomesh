begin;
create extension if not exists pgtap with schema extensions;
set local search_path=extensions,public;
select no_plan();
insert into auth.users(id,email,email_confirmed_at,aud,role) values
('c5010000-0000-4000-8000-000000000001','hac50-admin@example.invalid',now(),'authenticated','authenticated'),
('c5010000-0000-4000-8000-000000000002','hac50-dispatcher@example.invalid',now(),'authenticated','authenticated'),
('c5010000-0000-4000-8000-000000000003','hac50-foreign@example.invalid',now(),'authenticated','authenticated');
insert into public.carrier_operators(id,carrier_id,auth_user_id,display_name,role,status,verified_at)
select ('c5020000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'c2340000-0000-4000-8000-000000000001',('c5010000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'[SYNTHETIC] HAC50',role,'ACTIVE',now() from(values(1,'ADMIN'),(2,'DISPATCHER')) x(n,role);
insert into private.v2_catalog_grants(auth_user_id,carrier_id,permission) select ('c5010000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'c2340000-0000-4000-8000-000000000001','CARRIER_EDITOR' from generate_series(1,2) n;
create temp table depot_refs(name text primary key,v jsonb);grant all on depot_refs to authenticated;
insert into depot_refs values('policy',jsonb_build_object('schemaVersion','2.0','active',true,'serviceIds',jsonb_build_array('c2360000-0000-4000-8000-000000000001'),'operatingHours',jsonb_build_object('timezone','America/Lima','weekly',(select jsonb_agg(jsonb_build_object('dayOfWeek',n,'opensAt','08:00','closesAt','18:00')) from generate_series(1,7) n)),'resources','[{"code":"DOCK","name":"Synthetic shared dock","activities":["LOAD","UNLOAD"],"equipmentTypes":["BOX_TRUCK"],"maxConcurrentVehicles":1}]'::jsonb,'blockedWindows','[]'::jsonb,'evidence',jsonb_build_object('reference','SIMULATED local test','verifiedAt',now()-interval '1 hour','validUntil',now()+interval '30 days','provenanceStatus','SIMULATED')));
insert into depot_refs values('slot',jsonb_build_object('schemaVersion','2.0','serviceId','c2360000-0000-4000-8000-000000000001','resourceCode','DOCK','activity','LOAD','equipmentType','BOX_TRUCK','window',jsonb_build_object('startsAt',date_trunc('day',now())+interval '2 days 14 hours','endsAt',date_trunc('day',now())+interval '2 days 15 hours'),'units',1));
create function pg_temp.depot_call(action text,value jsonb default null,ver integer default null,i uuid default null,k uuid default null) returns jsonb language sql as $$select public.depot_operations_v2('c5020000-0000-4000-8000-000000000001','c2340000-0000-4000-8000-000000000001',(select (v#>>'{record,id}')::uuid from depot_refs where name='depot'),action,i,ver,k,value);$$;
set local role authenticated;set local "request.jwt.claims"='{"sub":"c5010000-0000-4000-8000-000000000001","role":"authenticated"}';
insert into depot_refs values('depot',public.command_v2_carrier_catalog('c5020000-0000-4000-8000-000000000001','depots','c2340000-0000-4000-8000-000000000001',null,null,gen_random_uuid(),null,'{"schemaVersion":"2.0","code":"HAC50_DEPOT","name":"[SYNTHETIC] HAC50 depot","location":{"label":"Synthetic","countryCode":"PE","region":"LIM","city":"Lima","lat":-12,"lng":-77},"active":true,"handling":["BOX_TRUCK"]}'));
select is(pg_temp.depot_call('policy.read')->'data','null'::jsonb,'missing policy is explicit null');
select is(pg_temp.depot_call('availability',(select v from depot_refs where name='slot'))#>>'{data,status}','unknown','missing policy does not grant capacity');
insert into depot_refs values('saved_policy',pg_temp.depot_call('policy.save',(select v from depot_refs where name='policy'),0,null,'c5030000-0000-4000-8000-000000000001'));
select is((select v#>>'{data,version}' from depot_refs where name='saved_policy'),'1','policy persists first version');
select is(pg_temp.depot_call('policy.save',(select v from depot_refs where name='policy'),0,null,'c5030000-0000-4000-8000-000000000001')->>'replay','true','identical retry replays');
select throws_ok($$select pg_temp.depot_call('policy.save',(select v||'{"active":false}' from depot_refs where name='policy'),0,null,'c5030000-0000-4000-8000-000000000001')$$,'PT409','IDEMPOTENCY_CONFLICT','same key different payload rejected');
select throws_ok($$select pg_temp.depot_call('policy.save',(select v from depot_refs where name='policy'),0,null,gen_random_uuid())$$,'PT409','STALE_DRAFT','stale policy revision rejected');
select is(pg_temp.depot_call('availability',(select v from depot_refs where name='slot'))#>>'{data,status}','eligible','valid resource window and policy accepted');
select is(pg_temp.depot_call('availability',(select v||'{"equipmentType":"REEFER_TRUCK"}' from depot_refs where name='slot'))#>>'{data,status}','ineligible','unsupported equipment rejected');
select is(pg_temp.depot_call('availability',(select v||'{"activity":"MAINTENANCE"}' from depot_refs where name='slot'))#>>'{data,status}','ineligible','unsupported activity rejected');
select is(pg_temp.depot_call('availability',(select jsonb_set(v,'{window}',jsonb_build_object('startsAt',date_trunc('day',now())+interval '2 days 4 hours','endsAt',date_trunc('day',now())+interval '2 days 5 hours')) from depot_refs where name='slot'))#>>'{data,status}','ineligible','entire window must be inside operating hours');
insert into depot_refs values('a',pg_temp.depot_call('appointment.save',(select v||'{"executionId":null,"status":"CONFIRMED","reason":"SIMULATED first slot"}' from depot_refs where name='slot'),0,null,gen_random_uuid()));
select is((select v#>>'{data,value,status}' from depot_refs where name='a'),'CONFIRMED','first confirmed appointment persists');
select throws_ok($$select pg_temp.depot_call('appointment.save',(select v||'{"executionId":null,"status":"CONFIRMED","reason":"SIMULATED conflict"}' from depot_refs where name='slot'),0,null,gen_random_uuid())$$,'PT409','DEPOT_SLOT_UNAVAILABLE','overlapping appointment rejected atomically');
insert into depot_refs values('b',pg_temp.depot_call('appointment.save',(select jsonb_set(v,'{window}',jsonb_build_object('startsAt',date_trunc('day',now())+interval '2 days 15 hours','endsAt',date_trunc('day',now())+interval '2 days 16 hours'))||'{"executionId":null,"status":"CONFIRMED","reason":"SIMULATED adjacent slot"}' from depot_refs where name='slot'),0,null,gen_random_uuid()));
select is((select v#>>'{data,value,status}' from depot_refs where name='b'),'CONFIRMED','adjacent windows do not overlap');
select lives_ok($$select pg_temp.depot_call('policy.save',(select jsonb_set(v,'{resources,0,maxConcurrentVehicles}','2') from depot_refs where name='policy'),1,null,gen_random_uuid())$$,'capacity increase preserves commitments');
select is(pg_temp.depot_call('availability',(select jsonb_set(v,'{window,endsAt}',to_jsonb(date_trunc('day',now())+interval '2 days 16 hours')) from depot_refs where name='slot'))#>>'{data,status}','eligible','peak occupancy does not add sequential appointments');
select throws_ok($$select pg_temp.depot_call('policy.save',(select v||'{"active":false}' from depot_refs where name='policy'),2,null,gen_random_uuid())$$,'PT409','DEPOT_COMMITMENT_CONFLICT','policy revision cannot invalidate an active commitment');
select lives_ok($$select pg_temp.depot_call('appointment.save',(select v#>'{data,value}'||'{"status":"CANCELLED","reason":"SIMULATED cancellation"}' from depot_refs where name='a'),1,(select (v#>>'{data,id}')::uuid from depot_refs where name='a'),gen_random_uuid())$$,'cancellation releases capacity and preserves record');
select is(jsonb_array_length(pg_temp.depot_call('appointments.list')->'data'),2,'cancelled appointment remains in history');
select lives_ok($$select pg_temp.depot_call('appointment.save',(select v#>'{data,value}'||'{"status":"CANCELLED","reason":"SIMULATED cancellation"}' from depot_refs where name='b'),1,(select (v#>>'{data,id}')::uuid from depot_refs where name='b'),gen_random_uuid())$$,'second commitment can be released');
reset role;
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
set local role authenticated;set local "request.jwt.claims"='{"sub":"c2310000-0000-4000-8000-000000000001","role":"authenticated"}';
insert into depot_refs(name,v) select 'request',public.create_v2_freight_request('c2300000-0000-4000-8000-000000000001','c2320000-0000-4000-8000-000000000001',gen_random_uuid(),private.hash_v2_freight_payload(payload),payload) from (select jsonb_set(jsonb_set(pg_temp.hac40_payload(),'{pickupWindow}',(select v->'window' from depot_refs where name='slot')),'{deliveryWindow}',(select v->'window' from depot_refs where name='slot')) payload) q;
reset role;
insert into public.transport_executions(id,organization_id,freight_request_id,carrier_id,carrier_service_id,status,planned_starts_at,planned_ends_at) select 'c5050000-0000-4000-8000-000000000001','c2300000-0000-4000-8000-000000000001',(v->>'id')::uuid,'c2340000-0000-4000-8000-000000000001','c2360000-0000-4000-8000-000000000001','PLANNED',(select (v#>>'{window,startsAt}')::timestamptz from depot_refs where name='slot'),(select (v#>>'{window,endsAt}')::timestamptz from depot_refs where name='slot') from depot_refs where name='request';
set local role authenticated;set local "request.jwt.claims"='{"sub":"c5010000-0000-4000-8000-000000000001","role":"authenticated"}';
insert into depot_refs values('linked',pg_temp.depot_call('appointment.save',(select v||'{"executionId":"c5050000-0000-4000-8000-000000000001","status":"CONFIRMED","reason":"SIMULATED linked operation"}' from depot_refs where name='slot'),0,null,gen_random_uuid()));
reset role;
select throws_ok($$update public.carrier_depots set active=false where id=(select (v#>>'{record,id}')::uuid from depot_refs where name='depot')$$,'PT409','DEPOT_COMMITMENT_CONFLICT','depot deactivation cannot strand confirmed appointments');
select throws_ok($$update public.carrier_services set active=false where id='c2360000-0000-4000-8000-000000000001'$$,'PT409','DEPOT_COMMITMENT_CONFLICT','service deactivation cannot strand confirmed appointments');
select throws_ok($$update public.transport_executions set status='CANCELLED' where id='c5050000-0000-4000-8000-000000000001'$$,'PT409','DEPOT_COMMITMENT_CONFLICT','execution cancellation requires releasing future depot appointments');
set local role authenticated;
select lives_ok($$select pg_temp.depot_call('appointment.save',(select v#>'{data,value}'||'{"status":"CANCELLED","reason":"SIMULATED release before execution"}' from depot_refs where name='linked'),1,(select (v#>>'{data,id}')::uuid from depot_refs where name='linked'),gen_random_uuid())$$,'linked appointment releases through audited versioned command');
reset role;select lives_ok($$update public.transport_executions set status='CANCELLED' where id='c5050000-0000-4000-8000-000000000001'$$,'execution can cancel after depot capacity release');
set local role authenticated;
select lives_ok($$select pg_temp.depot_call('policy.save',(select v||'{"operatingHours":null}' from depot_refs where name='policy'),2,null,gen_random_uuid())$$,'unknown hours can be recorded without inventing hours');
select is(pg_temp.depot_call('availability',(select v from depot_refs where name='slot'))#>>'{data,status}','unknown','unknown hours prevent confirmation');
select throws_ok($$select pg_temp.depot_call('appointment.save',(select v#>'{data,value}'||'{"status":"CONFIRMED"}' from depot_refs where name='a'),2,(select (v#>>'{data,id}')::uuid from depot_refs where name='a'),gen_random_uuid())$$,'PT409','DEPOT_TERMINAL_APPOINTMENT','cancelled appointments cannot be resurrected');
select throws_ok($$select pg_temp.depot_call('policy.save',(select v||'{"serviceIds":["00000000-0000-4000-8000-000000000099"]}' from depot_refs where name='policy'),3,null,gen_random_uuid())$$,'PT400','INVALID_DEPOT_SERVICE','unknown service cannot be supported');
select throws_ok($$select pg_temp.depot_call('policy.save',(select jsonb_set(v,'{resources,0,maxConcurrentVehicles}','0') from depot_refs where name='policy'),3,null,gen_random_uuid())$$,'PT400','VALIDATION_ERROR','invalid zero capacity rejected');
select lives_ok($$select pg_temp.depot_call('policy.save',(select jsonb_set(v,'{operatingHours}',jsonb_build_object('timezone','America/Lima','weekly',(select jsonb_agg(jsonb_build_object('dayOfWeek',n,'opensAt','00:00','closesAt','24:00')) from generate_series(1,7) n))) from depot_refs where name='policy'),3,null,gen_random_uuid())$$,'24-hour schedules can be persisted');
select is(pg_temp.depot_call('availability',(select jsonb_set(v,'{window}',jsonb_build_object('startsAt',date_trunc('day',now())+interval '2 days 4 hours','endsAt',date_trunc('day',now())+interval '2 days 7 hours')) from depot_refs where name='slot'))#>>'{data,status}','eligible','24-hour schedule spans local midnight without gaps');
select lives_ok($$select pg_temp.depot_call('policy.save',(select jsonb_set((pg_temp.depot_call('policy.read')->'data'->'value'),'{blockedWindows}',jsonb_build_array(jsonb_build_object('resourceCode',null,'window',(select v->'window' from depot_refs where name='slot'),'reason','SIMULATED site closure')))),4,null,gen_random_uuid())$$,'closure records can cover all resources');
select is(pg_temp.depot_call('availability',(select v from depot_refs where name='slot'))#>>'{data,status}','ineligible','site closure blocks handling inside opening hours');
select throws_ok($$select pg_temp.depot_call('appointment.save',(select v||'{"executionId":null,"status":"CONFIRMED","reason":"SIMULATED during closure"}' from depot_refs where name='slot'),0,null,gen_random_uuid())$$,'PT409','DEPOT_SLOT_UNAVAILABLE','closure is enforced on confirmation');
select lives_ok($$select pg_temp.depot_call('policy.save',(select jsonb_set(v,'{evidence,validUntil}',to_jsonb(now()-interval '1 minute')) from depot_refs where name='policy'),5,null,gen_random_uuid())$$,'expired evidence can be recorded honestly');
select is(pg_temp.depot_call('availability',(select v from depot_refs where name='slot'))#>>'{data,status}','unknown','expired evidence cannot confirm capacity');
select throws_ok($$insert into public.depot_operating_policies(depot_id,carrier_id,version,value) values(gen_random_uuid(),gen_random_uuid(),1,'{}')$$,'42501',null,'direct authenticated writes denied');
select throws_ok($$select * from private.depot_command_receipts$$,'42501',null,'private receipts inaccessible');
set local "request.jwt.claims"='{"sub":"c5010000-0000-4000-8000-000000000002","role":"authenticated"}';
select throws_ok($$select public.depot_operations_v2('c5020000-0000-4000-8000-000000000002','c2340000-0000-4000-8000-000000000001',(select (v#>>'{record,id}')::uuid from depot_refs where name='depot'),'policy.save',null,6,gen_random_uuid(),(select v from depot_refs where name='policy'))$$,'PT403','FORBIDDEN_CARRIER_ROLE','dispatcher cannot revise depot policy');
select throws_ok($$select pg_temp.depot_call('policy.read')$$,'PT403','FORBIDDEN_CARRIER_IDENTITY','forged operator denied');
set local "request.jwt.claims"='{"sub":"c5010000-0000-4000-8000-000000000003","role":"authenticated"}';
select is((select count(*)::integer from public.depot_operating_policies),0,'RLS hides policies from unrelated identity');
select is((select count(*)::integer from public.depot_appointments),0,'RLS hides appointments from unrelated identity');
set local role anon;select throws_ok($$select public.depot_operations_v2(null,null,null,'policy.read',null,null,null,null)$$,'42501',null,'anonymous cannot invoke RPC');
select * from finish();rollback;

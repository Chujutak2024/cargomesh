-- Synthetic fixtures, real authenticated native commands; all changes roll back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path=extensions,public;
select no_plan();
insert into private.v2_catalog_grants(auth_user_id,permission) values('c2310000-0000-4000-8000-000000000001','CATALOG_ADMIN') on conflict do nothing;
update public.service_areas set valid_from='2020-01-01',valid_until='2030-01-01',verified_at='2020-01-01' where carrier_service_id='c2360000-0000-4000-8000-000000000001';
update public.service_lanes set valid_from='2020-01-01',valid_until='2030-01-01',verified_at='2020-01-01' where carrier_service_id='c2360000-0000-4000-8000-000000000001';
insert into public.carrier_service_cargo_categories(carrier_service_id,cargo_category_id) values('c2360000-0000-4000-8000-000000000001','c0000000-0000-0000-0000-000000000001') on conflict do nothing;
create temporary table refs(name text primary key,value jsonb);
create temporary table fixtures(kind text primary key,value jsonb);
grant all on refs,fixtures to authenticated;
insert into fixtures values('capability-definitions','{"schemaVersion":"2.0","serviceId":"c2360000-0000-4000-8000-000000000001","categoryId":"c0000000-0000-0000-0000-000000000001","requirements":[],"maxWeightKg":8000,"temperatureRange":null,"certifications":["QA_CERT"],"evidence":"fixture:inspection","verifiedAt":"2026-01-01T00:00:00Z","validUntil":"2027-03-01T00:00:00Z","active":true}'::jsonb);
insert into fixtures values('assets','{"schemaVersion":"2.0","serviceId":"c2360000-0000-4000-8000-000000000001","code":"FLEET_QA","mode":"ROAD","equipmentType":"BOX_TRUCK","role":"LOAD_BEARING","usefulCapacityKg":10000,"usableVolumeM3":40,"operatingStatus":"AVAILABLE","homeDepotId":"c2350000-0000-4000-8000-000000000001","provenance":"OWN","partnerId":null,"evidence":"fixture:asset","roadVehicle":{"plate":"QA-001","registrationCode":"QA-REG","registeredAt":"2026-01-01","brand":"Synthetic","model":"Test","variant":null,"bodyType":"BOX","usableDimensions":{"length":500,"width":240,"height":250},"grossWeightLimitKg":15000,"odometerKm":5000,"conditionReason":null,"axleConfig":"2S1"}}'::jsonb);
insert into fixtures values('capacity-pools','{"schemaVersion":"2.0","serviceId":"c2360000-0000-4000-8000-000000000001","code":"POOL_QA","mode":"ROAD","equipmentType":"BOX_TRUCK","serviceWindow":{"startsAt":"2027-01-01T00:00:00Z","endsAt":"2027-02-01T00:00:00Z"},"declaredCapacity":{"weightKg":10000,"volumeM3":40},"provenance":"CONTRACTED","partnerId":null,"evidence":"fixture:agreement","supportedCargoCategoryIds":["c0000000-0000-0000-0000-000000000001"],"active":true}'::jsonb);
insert into fixtures values('calendars','{"schemaVersion":"2.0","serviceId":"c2360000-0000-4000-8000-000000000001","assetId":"ASSET","capacityPoolId":null,"timezone":"America/Lima","horizon":{"startsAt":"2027-01-01T00:00:00Z","endsAt":"2027-02-01T00:00:00Z"},"source":"fixture:calendar","lastVerifiedAt":"2026-01-01T00:00:00Z","freshness":"SIMULATED","validUntil":"2027-03-01T00:00:00Z","complete":true,"availableWindows":[{"startsAt":"2027-01-01T00:00:00Z","endsAt":"2027-02-01T00:00:00Z"}],"readyPickupAreaId":"c2370000-0000-4000-8000-000000000001"}'::jsonb);
insert into fixtures values('maintenances','{"schemaVersion":"2.0","serviceId":"c2360000-0000-4000-8000-000000000001","assetId":"ASSET","blockedWindow":{"startsAt":"2027-01-10T00:00:00Z","endsAt":"2027-01-11T00:00:00Z"},"kind":"PREVENTIVE","status":"SCHEDULED","source":"fixture:work-order","reason":"Synthetic preventive inspection"}'::jsonb);
insert into fixtures values('repositioning-blocks','{"schemaVersion":"2.0","serviceId":"c2360000-0000-4000-8000-000000000001","calendarId":"CALENDAR","occupiedWindow":{"startsAt":"2027-01-12T00:00:00Z","endsAt":"2027-01-13T00:00:00Z"},"origin":{"label":"Synthetic Lima","countryCode":"PE","region":"LIM","city":"Lima","lat":-12,"lng":-77},"nextPickup":{"label":"Synthetic Lima","countryCode":"PE","region":"LIM","city":"Lima","lat":-12,"lng":-77},"estimatedTravelSeconds":3600,"status":"PLANNED","source":"fixture:dispatch","reason":"Synthetic positioning"}'::jsonb);
insert into fixtures values('asset-capabilities','{"schemaVersion":"2.0","serviceId":"c2360000-0000-4000-8000-000000000001","assetId":"ASSET","categoryId":"c0000000-0000-0000-0000-000000000001","temperatureRange":null,"certifications":["QA_CERT"],"evidence":"fixture:inspection","verifiedAt":"2026-01-01T00:00:00Z","validUntil":"2027-03-01T00:00:00Z","active":true,"definitionId":"DEFINITION"}'::jsonb);
create function pg_temp.id(n text) returns uuid language sql as $$select (value->>'id')::uuid from refs where name=n;$$;
create function pg_temp.win() returns jsonb language sql as $$select jsonb_build_object('startsAt',now()-interval '30 minutes','endsAt',now()+interval '3 hours');$$;
create function pg_temp.ev() returns jsonb language sql as $$select jsonb_build_object('reference','fixture:workflow','provider','Synthetic QA','observedAt','2020-01-01T00:00:00Z','validUntil','2030-01-01T00:00:00Z','provenanceStatus','SIMULATED');$$;
create function pg_temp.ctx(q uuid default null,c uuid default null,p uuid default null,i uuid default null) returns jsonb language sql as $$select jsonb_build_object('requestId',q,'carrierId',c,'parentId',p,'id',i);$$;
create function pg_temp.w(a text,v jsonb,ctx jsonb default pg_temp.ctx(),key uuid default gen_random_uuid()) returns jsonb language sql as $$select public.command_v2_workflow('c2300000-0000-4000-8000-000000000001','c2320000-0000-4000-8000-000000000001',a,ctx,key,v)->'record';$$;
create function pg_temp.save(n text,a text,v jsonb,ctx jsonb default pg_temp.ctx()) returns void language sql as $$insert into refs values(n,pg_temp.w(a,v,ctx));$$;
set local role authenticated;
set local "request.jwt.claims"='{"sub":"c2310000-0000-4000-8000-000000000001","role":"authenticated"}';
create function pg_temp.req_payload() returns jsonb language sql as $$select '{"schemaVersion":"2.0","origin":{"facilityId":"c2330000-0000-4000-8000-000000000001"},"destination":{"facilityId":"c2330000-0000-4000-8000-000000000002"},"pickupWindow":{"startsAt":"2027-01-15T08:00:00Z","endsAt":"2027-01-15T18:00:00Z"},"deliveryWindow":{"startsAt":"2027-01-15T08:00:00Z","endsAt":"2027-01-15T20:00:00Z"},"acceptedModes":["ROAD"],"requiredEquipment":null,"cargoSpecification":{"categoryCode":"GENERAL","description":"QA original","packaging":"PALLET","totalWeightKg":1000,"totalVolumeM3":2,"divisible":true,"requirements":[],"units":[{"packageType":"PALLET","quantity":1,"weightPerUnitKg":1000,"volumePerUnitM3":2,"dimensionsCm":{"length":100,"width":100,"height":200},"indivisible":false,"stackable":true}]},"contacts":{"pickup":{"name":"QA","phoneE164":"+51911111111"},"recipient":{"name":"QA","phoneE164":"+51922222222"}},"budget":{"amount":500,"currency":"USD"}}'::jsonb||jsonb_build_object('pickupWindow',jsonb_build_object('startsAt',now()+interval '2 hours','endsAt',now()+interval '4 hours'),'deliveryWindow',jsonb_build_object('startsAt',now()+interval '5 hours','endsAt',now()+interval '8 hours'));$$;
insert into refs values('request',public.create_v2_freight_request('c2300000-0000-4000-8000-000000000001','c2320000-0000-4000-8000-000000000001',gen_random_uuid(),private.hash_v2_freight_payload(pg_temp.req_payload()),pg_temp.req_payload()));

select public.command_v2_freight_request('c2300000-0000-4000-8000-000000000001','c2320000-0000-4000-8000-000000000001',gen_random_uuid(),pg_temp.id('request'),1,'SUBMIT',null);
insert into refs select 'asset',public.command_v2_catalog('c2300000-0000-4000-8000-000000000001','c2320000-0000-4000-8000-000000000001','assets','c2340000-0000-4000-8000-000000000001',null,null,gen_random_uuid(),null,value||jsonb_build_object('code','WORKFLOW_QA'))->'record' from fixtures where kind='assets';
insert into refs select 'definition',public.command_v2_catalog('c2300000-0000-4000-8000-000000000001','c2320000-0000-4000-8000-000000000001','capability-definitions','c2340000-0000-4000-8000-000000000001',null,null,gen_random_uuid(),null,value||jsonb_build_object('validUntil','2030-01-01T00:00:00Z'))->'record' from fixtures where kind='capability-definitions';
insert into refs select 'capability',public.command_v2_catalog('c2300000-0000-4000-8000-000000000001','c2320000-0000-4000-8000-000000000001','asset-capabilities','c2340000-0000-4000-8000-000000000001',null,null,gen_random_uuid(),null,value||jsonb_build_object('assetId',pg_temp.id('asset'),'definitionId',pg_temp.id('definition'),'validUntil','2030-01-01T00:00:00Z'))->'record' from fixtures where kind='asset-capabilities';
insert into refs select 'calendar',public.command_v2_catalog('c2300000-0000-4000-8000-000000000001','c2320000-0000-4000-8000-000000000001','calendars','c2340000-0000-4000-8000-000000000001',null,null,gen_random_uuid(),null,value||jsonb_build_object('assetId',pg_temp.id('asset'),'horizon',jsonb_build_object('startsAt',now()-interval '2 hours','endsAt',now()+interval '1 day'),'availableWindows',jsonb_build_array(jsonb_build_object('startsAt',now()-interval '2 hours','endsAt',now()+interval '1 day')),'validUntil','2030-01-01T00:00:00Z'))->'record' from fixtures where kind='calendars';
select pg_temp.save('origin','nodes.publish',jsonb_build_object('schemaVersion','2.0','active',true,'kind','HUB','name','QA origin','location',(select (v2_snapshot->'origin')-'facilityId' from public.freight_requests where id=pg_temp.id('request')),'jurisdiction','PE','source',pg_temp.ev(),'verifiedAt','2020-01-01T00:00:00Z'));
select pg_temp.save('destination','nodes.publish',jsonb_build_object('schemaVersion','2.0','active',true,'kind','HUB','name','QA destination','location',(select (v2_snapshot->'destination')-'facilityId' from public.freight_requests where id=pg_temp.id('request')),'jurisdiction','PE','source',pg_temp.ev(),'verifiedAt','2020-01-01T00:00:00Z'));
select pg_temp.save('corridor','corridors.publish',jsonb_build_object('schemaVersion','2.0','active',true,'originNodeId',pg_temp.id('origin'),'destinationNodeId',pg_temp.id('destination'),'mode','ROAD','estimatedDistanceKm',100,'estimatedDurationSeconds',3600,'restrictions','[]'::jsonb,'source',pg_temp.ev(),'version','QA-1','validUntil','2030-01-01T00:00:00Z','grossWeightLimitKg',15000,'payloadLimitKg',10000,'usableDimensions',jsonb_build_object('length',500,'width',240,'height',250),'limitsEvidence',pg_temp.ev(),'waypoints',jsonb_build_array(jsonb_build_object('kind','REST','location',(select value#>'{data,location}' from refs where name='origin'),'source',pg_temp.ev(),'verifiedAt',null),jsonb_build_object('kind','FUEL','location',(select value#>'{data,location}' from refs where name='destination'),'source',pg_temp.ev(),'verifiedAt',null))));
select pg_temp.save('policy','route-policies.publish',jsonb_build_object('schemaVersion','2.0','active',true,'version','QA-1','objective','SHORTEST','constraints','[]'::jsonb,'weights',jsonb_build_object('distance',1,'duration',0),'missingDataRule','UNKNOWN'));
select pg_temp.save('limits','limits.publish',jsonb_build_object('schemaVersion','2.0','active',true,'serviceId','c2360000-0000-4000-8000-000000000001','assetId',pg_temp.id('asset'),'combinationId',null,'corridorId',pg_temp.id('corridor'),'manufacturerPayloadLimitKg',10000,'routeGrossLimitKg',15000,'combinedTareKg',5000,'usableVolumeM3',40,'usableDimensions',jsonb_build_object('length',500,'width',240,'height',250),'compatibilityConfirmed',true,'source',pg_temp.ev()),pg_temp.ctx(null,'c2340000-0000-4000-8000-000000000001'));
-- This suffix is preceded by the native, rolled-back fixture setup from test22.
reset role;
create function pg_temp.op() returns uuid language sql security definer as $$select id from public.carrier_operators where carrier_id='c2340000-0000-4000-8000-000000000001' and auth_user_id='c2310000-0000-4000-8000-000000000001';$$;
insert into public.organization_members(id,organization_id,auth_user_id,display_name,corporate_email,role,status)
values('c2320000-0000-4000-8000-000000000003','c2300000-0000-4000-8000-000000000001','c2310000-0000-4000-8000-000000000002','Synthetic quotation client','quote-local@cargomesh.test','SUPERVISOR','ACTIVE');
create function pg_temp.tariff() returns jsonb language sql as $$select jsonb_build_object(
 'schemaVersion','2.0','serviceId','c2360000-0000-4000-8000-000000000001','laneId','c2380000-0000-4000-8000-000000000001',
 'active',true,'autoIssue',true,'basis','PER_KM','baseAmount',100,'ratePerKm',1.25,'minimumAmount',200,
 'fuelAmount',10.01,'tollAmount',2,'handlingAmount',0,'taxAmount',0,'validityMinutes',60,'confirmationMinutes',30,
 'validUntil','2030-01-01T00:00:00Z','terms','SIMULATED approved local tariff','provenanceStatus','SIMULATED','acknowledgeAuthority',true);$$;
create function pg_temp.candidate() returns jsonb language sql as $$select jsonb_build_object('serviceId','c2360000-0000-4000-8000-000000000001','laneId','c2380000-0000-4000-8000-000000000001','calendarId',pg_temp.id('calendar'),'assetId',pg_temp.id('asset'),'poolId',null);$$;
create function pg_temp.quote(k uuid default 'c2900000-0000-4000-8000-000000000001',expected integer default 2,deadline timestamptz default now()+interval '1 hour') returns jsonb language sql as $$
 select public.request_v2_carrier_quote('c2300000-0000-4000-8000-000000000001','c2320000-0000-4000-8000-000000000003',pg_temp.id('request'),expected,k,deadline,pg_temp.candidate());$$;
select ok((select bool_and(relrowsecurity) from pg_class where oid in('private.carrier_quote_policies'::regclass,'private.quote_dispatches'::regclass,'private.quote_issue_context'::regclass,'private.quote_issued_offers'::regclass)),'policy, receipts and bounded delegation have RLS');
select ok(not has_table_privilege('authenticated','private.quote_issue_context','INSERT'),'user cannot invent a delegation context');
select ok(not has_function_privilege('authenticated','private.active_quote_delegation(uuid)','EXECUTE'),'delegation lookup is private');
select ok(not has_function_privilege('service_role','public.request_v2_carrier_quote(uuid,uuid,uuid,integer,uuid,timestamptz,jsonb)','EXECUTE'),'no administrative quotation shortcut');
select ok(not has_function_privilege('anon','public.configure_v2_quote_policy(uuid,uuid,uuid,integer,jsonb)','EXECUTE'),'anonymous cannot approve a tariff');
set local role authenticated;
set local "request.jwt.claims"='{"sub":"c2310000-0000-4000-8000-000000000001","role":"authenticated"}';
insert into refs select 'quote-policy',public.configure_v2_quote_policy('c2340000-0000-4000-8000-000000000001',pg_temp.op(),'c2900000-0000-4000-8000-000000000002',0,pg_temp.tariff());
select is((select value->>'version' from refs where name='quote-policy'),'1','Carrier ADMIN approves versioned tariff');
select is(public.configure_v2_quote_policy('c2340000-0000-4000-8000-000000000001',pg_temp.op(),'c2900000-0000-4000-8000-000000000002',0,pg_temp.tariff()),(select value from refs where name='quote-policy'),'same idempotency key replays the policy');
select throws_ok($$select public.configure_v2_quote_policy('c2340000-0000-4000-8000-000000000001',pg_temp.op(),gen_random_uuid(),0,pg_temp.tariff())$$,'PT409','STALE_DRAFT','policy cannot overwrite a newer approval');
set local "request.jwt.claims"='{"sub":"c2310000-0000-4000-8000-000000000002","role":"authenticated"}';
select throws_ok($$select public.configure_v2_quote_policy('c2340000-0000-4000-8000-000000000001',(select (value->>'operatorId')::uuid from refs where name='quote-policy'),gen_random_uuid(),1,pg_temp.tariff())$$,'PT403',null,'a Client cannot approve a Carrier tariff');
insert into refs values('auto-quote',pg_temp.quote());
select diag(value::text) from refs where name='auto-quote';
select is((select value->>'status' from refs where name='auto-quote'),'OFFERED','a separate shipper obtains a Carrier-approved automatic quote');
set local "request.jwt.claims"='{"sub":"c2310000-0000-4000-8000-000000000001","role":"authenticated"}';
select pg_temp.save('quote-scorepolicy','scoring-policies.publish',jsonb_build_object('schemaVersion','2.0','active',true,'policy',jsonb_build_object('version','QUOTE-QA-1','objective','LOWEST_COST','weights',jsonb_build_object('cost',1,'transit',0,'reliability',0),'missingDataRule','EXCLUDE','tieBreaker','OFFER_ID_ASC')));
set local "request.jwt.claims"='{"sub":"c2310000-0000-4000-8000-000000000002","role":"authenticated"}';
insert into refs values('quote-ranking',public.rank_v2_request_quotes('c2300000-0000-4000-8000-000000000001','c2320000-0000-4000-8000-000000000003',pg_temp.id('request'),2,'c2900000-0000-4000-8000-000000000006'));
select is((select value->>'notice' from refs where name='quote-ranking'),null::text,'stored cost policy ranks actual quotes without invented history');
select diag('QUOTE_CONTEXT:'||jsonb_build_object(
 'request',(select value||jsonb_build_object('status','PENDING','draftVersion',2) from refs where name='request'),
 'plans',public.read_v2_workflow('c2300000-0000-4000-8000-000000000001','c2320000-0000-4000-8000-000000000003','plans',pg_temp.ctx(pg_temp.id('request')),25,0),
 'opportunities',public.read_v2_workflow('c2300000-0000-4000-8000-000000000001','c2320000-0000-4000-8000-000000000003','opportunities',pg_temp.ctx(pg_temp.id('request')),25,0),
 'offers',public.read_v2_workflow('c2300000-0000-4000-8000-000000000001','c2320000-0000-4000-8000-000000000003','offers',pg_temp.ctx(pg_temp.id('request')),25,0),
 'ranking',public.read_v2_workflow('c2300000-0000-4000-8000-000000000001','c2320000-0000-4000-8000-000000000003','ranking',pg_temp.ctx(pg_temp.id('request')),25,0)
)::text);
select is(pg_temp.quote(),(select value from refs where name='auto-quote'),'retry returns the same offer and opportunity');
select throws_ok($$select pg_temp.quote('c2900000-0000-4000-8000-000000000001',2,now()+interval '45 minutes')$$,'PT409','IDEMPOTENCY_CONFLICT','changed deadline cannot reuse a key');
select throws_ok($$select pg_temp.quote(gen_random_uuid(),99)$$,'PT409','STALE_DRAFT','stale request version cannot create a quote');
select throws_ok($$select public.read_v2_quote_history('c2300000-0000-4000-8000-000000000002','c2320000-0000-4000-8000-000000000002',pg_temp.id('request'))$$,'PT404','REQUEST_NOT_FOUND','history does not reveal another tenant request');
select throws_ok($$insert into private.quote_issue_context values(pg_backend_pid(),txid_current(),auth.uid(),pg_temp.id('quote-policy'),gen_random_uuid())$$,'42501',null,'authenticated user cannot forge a quote context');
reset role;
select is((select (data#>>'{price,amount}')::numeric from public.v2_carrier_offers where id=(select (value->>'offerId')::uuid from refs where name='auto-quote')),237.01::numeric,'actual SQL tariff uses persisted 100km and exact cents');
select is((select issuer_auth_user_id from public.v2_carrier_offers where id=(select (value->>'offerId')::uuid from refs where name='auto-quote')),'c2310000-0000-4000-8000-000000000001'::uuid,'issuer is the Carrier approver, never the client');
select is((select count(*) from private.quote_issue_context),0::bigint,'delegation removed before transaction returns');
select is((select count(*) from private.quote_issued_offers where offer_id=(select (value->>'offerId')::uuid from refs where name='auto-quote')),1::bigint,'policy version and snapshot are audited');
select is((select count(*) from public.v2_bookings where freight_request_id=pg_temp.id('request')),0::bigint,'quotation creates neither booking nor capacity commitment');
select is((select count(*) from public.capacity_reservations where freight_request_id=pg_temp.id('request')),0::bigint,'quote does not reserve a vehicle');
set local role authenticated;
set local "request.jwt.claims"='{"sub":"c2310000-0000-4000-8000-000000000002","role":"authenticated"}';
create function pg_temp.client_command(a text,v jsonb) returns jsonb language sql as $$select public.command_v2_workflow('c2300000-0000-4000-8000-000000000001','c2320000-0000-4000-8000-000000000003',a,pg_temp.ctx(pg_temp.id('request')),gen_random_uuid(),v)->'record';$$;
insert into refs select 'decision',pg_temp.client_command('decisions.create',jsonb_build_object('schemaVersion','2.0','planId',value->>'planId','selectedOfferIds',jsonb_build_array(value->>'offerId'),'consideredOfferIds',jsonb_build_array(value->>'offerId'),'policyId',null,'rationale','Explicit local test selection','evidence',jsonb_build_array(pg_temp.ev()))) from refs where name='auto-quote';
insert into refs select 'booking',pg_temp.client_command('bookings.create',jsonb_build_object('schemaVersion','2.0','decisionId',pg_temp.id('decision'),'offerId',value->>'offerId','authorization','AUTHORIZE','evidence',pg_temp.ev())) from refs where name='auto-quote';
insert into refs select 'window',public.command_v2_quote_confirmation('c2300000-0000-4000-8000-000000000001','c2320000-0000-4000-8000-000000000003',null,null,pg_temp.id('booking'),'READ',null,null);
select is((select value->>'bookingStatus' from refs where name='window'),'AUTHORIZED','selection and authorization do not confirm or start transport');
select ok((select (value->>'deadline')::timestamptz=now()+interval '30 minutes' from refs where name='window'),'approved Carrier policy defines the confirmation deadline');
select throws_ok($$select public.command_v2_quote_confirmation('c2300000-0000-4000-8000-000000000001','c2320000-0000-4000-8000-000000000003',null,null,pg_temp.id('booking'),'PROPOSE',gen_random_uuid(),1,now()+interval '40 minutes','test')$$,'PT403','FORBIDDEN_WORKFLOW','client cannot invent a Carrier extension proposal');
set local "request.jwt.claims"='{"sub":"c2310000-0000-4000-8000-000000000001","role":"authenticated"}';
insert into refs select 'extension',public.command_v2_quote_confirmation(null,null,'c2340000-0000-4000-8000-000000000001',pg_temp.op(),pg_temp.id('booking'),'PROPOSE','c2900000-0000-4000-8000-000000000003',1,now()+interval '40 minutes','Synthetic carrier requests a short extension');
select ok((select (value->>'deadline')::timestamptz=now()+interval '30 minutes' from refs where name='extension'),'proposal alone does not extend the client deadline');
select throws_ok($$select public.command_v2_quote_confirmation(null,null,'c2340000-0000-4000-8000-000000000001',pg_temp.op(),pg_temp.id('booking'),'APPROVE',gen_random_uuid(),2,null,'self approval')$$,'PT403','CLIENT_CONSENT_REQUIRED','Carrier cannot approve its own extension');
select throws_ok($$select public.command_v2_quote_confirmation(null,null,'c2340000-0000-4000-8000-000000000001',pg_temp.op(),pg_temp.id('booking'),'PROPOSE',gen_random_uuid(),2,now()+interval '50 minutes','second proposal')$$,'PT400','INVALID_EXTENSION','one bounded extension proposal per booking');
set local "request.jwt.claims"='{"sub":"c2310000-0000-4000-8000-000000000002","role":"authenticated"}';
insert into refs select 'approved-extension',public.command_v2_quote_confirmation('c2300000-0000-4000-8000-000000000001','c2320000-0000-4000-8000-000000000003',null,null,pg_temp.id('booking'),'APPROVE','c2900000-0000-4000-8000-000000000004',2,null,'Explicit client approval');
select ok((select (value->>'deadline')::timestamptz=now()+interval '40 minutes' from refs where name='approved-extension'),'only explicit Client consent activates the new deadline');
select throws_ok($$select public.command_v2_quote_confirmation('c2300000-0000-4000-8000-000000000001','c2320000-0000-4000-8000-000000000003',null,null,pg_temp.id('booking'),'EXPIRE',gen_random_uuid(),3,null,'too early')$$,'PT409','CONFIRMATION_WINDOW_OPEN','an open booking window cannot expire early');
reset role;
update private.quote_booking_windows set deadline=now()-interval '1 second' where booking_id=pg_temp.id('booking');
set local role authenticated;
select lives_ok($$select public.command_v2_quote_confirmation('c2300000-0000-4000-8000-000000000001','c2320000-0000-4000-8000-000000000003',null,null,pg_temp.id('booking'),'EXPIRE',gen_random_uuid(),3,null,'Confirmation deadline expired')$$,'expired window closes through the native cancellation command');
reset role;
select is((select status from public.v2_bookings where id=pg_temp.id('booking')),'CANCELLED','expired authorization is cancelled');
select is((select count(*) from public.transport_executions where booking_id=pg_temp.id('booking') and status='IN_PROGRESS'),0::bigint,'no action falsely marks the truck on its way');
set local role authenticated;
set local "request.jwt.claims"='{"sub":"c2310000-0000-4000-8000-000000000001","role":"authenticated"}';
select public.configure_v2_quote_policy('c2340000-0000-4000-8000-000000000001',pg_temp.op(),gen_random_uuid(),1,pg_temp.tariff()||'{"autoIssue":false}'::jsonb);
set local "request.jwt.claims"='{"sub":"c2310000-0000-4000-8000-000000000002","role":"authenticated"}';
update refs set value=public.create_v2_freight_request('c2300000-0000-4000-8000-000000000001','c2320000-0000-4000-8000-000000000003',gen_random_uuid(),private.hash_v2_freight_payload(pg_temp.req_payload()),pg_temp.req_payload()) where name='request';
select public.command_v2_freight_request('c2300000-0000-4000-8000-000000000001','c2320000-0000-4000-8000-000000000003',gen_random_uuid(),pg_temp.id('request'),1,'SUBMIT',null);
insert into refs values('manual-quote',pg_temp.quote(gen_random_uuid()));
select is((select value->>'status' from refs where name='manual-quote'),'AWAITING_CARRIER','disabled automation delivers a manual opportunity without inventing a price');
set local "request.jwt.claims"='{"sub":"c2310000-0000-4000-8000-000000000001","role":"authenticated"}';
select public.configure_v2_quote_policy('c2340000-0000-4000-8000-000000000001',pg_temp.op(),gen_random_uuid(),2,pg_temp.tariff());
set local "request.jwt.claims"='{"sub":"c2310000-0000-4000-8000-000000000002","role":"authenticated"}';
insert into refs values('later-automatic-quote',pg_temp.quote(gen_random_uuid()));
select is((select value->>'status' from refs where name='later-automatic-quote'),'OFFERED','a new explicit search uses the newly approved policy');
select is((select value->>'opportunityId' from refs where name='later-automatic-quote'),(select value->>'opportunityId' from refs where name='manual-quote'),'new search reuses the current opportunity instead of sending duplicates');
reset role;
select is((select count(*) from public.carrier_opportunities where freight_request_id=pg_temp.id('request')),1::bigint,'one current opportunity for the service and resource');
set constraints all immediate;
select * from finish();
rollback;

-- Synthetic fixtures, real authenticated native commands; all changes roll back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path=extensions,public;
select no_plan();
select ok(has_function_privilege('service_role','private.validate_dispatch_preferences(jsonb)','EXECUTE'),'canonical service-role intake can validate dispatch preferences');
select ok(not has_function_privilege('anon','private.validate_dispatch_preferences(jsonb)','EXECUTE'),'dispatch validator remains unavailable to anonymous clients');
-- Coordinates belong only to this synthetic rolled-back fixture.
update public.facilities set latitude=case when code='QA-A-LIMA' then -12 else -16 end,longitude=case when code='QA-A-LIMA' then -77 else -71 end where id in('c2330000-0000-4000-8000-000000000001','c2330000-0000-4000-8000-000000000002');
insert into private.v2_catalog_grants(auth_user_id,permission) values('c2310000-0000-4000-8000-000000000001','CATALOG_ADMIN') on conflict do nothing;
update public.service_areas set valid_from='2020-01-01',valid_until='2030-01-01',verified_at='2020-01-01' where carrier_service_id='c2360000-0000-4000-8000-000000000001';
update public.service_lanes set valid_from='2020-01-01',valid_until='2030-01-01',verified_at='2020-01-01' where carrier_service_id='c2360000-0000-4000-8000-000000000001';
insert into public.carrier_service_cargo_categories(carrier_service_id,cargo_category_id) values('c2360000-0000-4000-8000-000000000001','c0000000-0000-0000-0000-000000000001') on conflict do nothing;
create temporary table refs(name text primary key,value jsonb);
create temporary table fixtures(kind text primary key,value jsonb);
grant all on refs,fixtures to authenticated;
insert into fixtures values('capability-definitions','{"schemaVersion":"2.0","serviceId":"c2360000-0000-4000-8000-000000000001","categoryId":"c0000000-0000-0000-0000-000000000001","requirements":[],"maxWeightKg":8000,"temperatureRange":null,"certifications":["QA_CERT"],"evidence":"fixture:inspection","verifiedAt":"2026-01-01T00:00:00Z","validUntil":"2027-03-01T00:00:00Z","active":true}'::jsonb);
insert into fixtures values('assets','{"schemaVersion":"2.0","serviceId":"c2360000-0000-4000-8000-000000000001","code":"FLEET_QA","mode":"ROAD","equipmentType":"BOX_TRUCK","role":"LOAD_BEARING","usefulCapacityKg":10000,"usableVolumeM3":28,"operatingStatus":"AVAILABLE","homeDepotId":"c2350000-0000-4000-8000-000000000001","provenance":"OWN","partnerId":null,"evidence":"fixture:asset","roadVehicle":{"plate":"QA-001","registrationCode":"QA-REG","registeredAt":"2026-01-01","brand":"Synthetic","model":"Test","variant":null,"bodyType":"BOX","usableDimensions":{"length":500,"width":240,"height":250},"grossWeightLimitKg":15000,"odometerKm":5000,"conditionReason":null,"axleConfig":"2S1"}}'::jsonb);
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
create function pg_temp.req_payload() returns jsonb language sql as $$select '{"schemaVersion":"2.0","origin":{"facilityId":"c2330000-0000-4000-8000-000000000001"},"destination":{"facilityId":"c2330000-0000-4000-8000-000000000002"},"pickupWindow":{"startsAt":"2027-01-15T08:00:00Z","endsAt":"2027-01-15T18:00:00Z"},"deliveryWindow":{"startsAt":"2027-01-15T08:00:00Z","endsAt":"2027-01-15T20:00:00Z"},"acceptedModes":["ROAD"],"requiredEquipment":null,"cargoSpecification":{"categoryCode":"GENERAL","description":"[SIMULATED] C01 two crates","packaging":"CRATE","totalWeightKg":12000,"totalVolumeM3":15.552,"divisible":true,"requirements":[],"units":[{"packageType":"CRATE","quantity":2,"weightPerUnitKg":6000,"volumePerUnitM3":7.776,"dimensionsCm":{"length":240,"width":180,"height":180},"indivisible":true,"stackable":false}]},"contacts":{"pickup":{"name":"QA","phoneE164":"+51911111111"},"recipient":{"name":"QA","phoneE164":"+51922222222"}},"budget":{"amount":500,"currency":"USD"}}'::jsonb||jsonb_build_object('pickupWindow',jsonb_build_object('startsAt',now()+interval '2 hours','endsAt',now()+interval '4 hours'),'deliveryWindow',jsonb_build_object('startsAt',now()+interval '5 hours','endsAt',now()+interval '8 hours'));$$;
alter function pg_temp.req_payload() rename to legacy_payload;
create function pg_temp.req_payload() returns jsonb language sql as $$select pg_temp.legacy_payload()||jsonb_build_object('selectionObjective','FASTEST','planningPreferences',jsonb_build_object('urgency','URGENT','loadSize','HEAVY','timeZone','America/Lima','pickupWindows',jsonb_build_array(jsonb_build_object('startsAt',now()+interval '2 hours','endsAt',now()+interval '3 hours'),jsonb_build_object('startsAt',now()+interval '3 hours 30 minutes','endsAt',now()+interval '4 hours')),'deliveryWindows',jsonb_build_array(jsonb_build_object('startsAt',now()+interval '5 hours','endsAt',now()+interval '6 hours'),jsonb_build_object('startsAt',now()+interval '7 hours','endsAt',now()+interval '8 hours'))));$$;
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
select pg_temp.save('limits','limits.publish',jsonb_build_object('schemaVersion','2.0','active',true,'serviceId','c2360000-0000-4000-8000-000000000001','assetId',pg_temp.id('asset'),'combinationId',null,'corridorId',pg_temp.id('corridor'),'manufacturerPayloadLimitKg',10000,'routeGrossLimitKg',15000,'combinedTareKg',5000,'usableVolumeM3',28,'usableDimensions',jsonb_build_object('length',500,'width',240,'height',250),'compatibilityConfirmed',true,'source',pg_temp.ev()),pg_temp.ctx(null,'c2340000-0000-4000-8000-000000000001'));
insert into refs select 'asset-2',public.command_v2_catalog('c2300000-0000-4000-8000-000000000001','c2320000-0000-4000-8000-000000000001','assets','c2340000-0000-4000-8000-000000000001',null,null,gen_random_uuid(),null,value||jsonb_build_object('code','MULTI_TRUCK_02','roadVehicle',(value->'roadVehicle')||jsonb_build_object('plate','QA-MULTI-02')))->'record' from fixtures where kind='assets';
insert into refs select 'capability-2',public.command_v2_catalog('c2300000-0000-4000-8000-000000000001','c2320000-0000-4000-8000-000000000001','asset-capabilities','c2340000-0000-4000-8000-000000000001',null,null,gen_random_uuid(),null,value||jsonb_build_object('assetId',pg_temp.id('asset-2'),'definitionId',pg_temp.id('definition'),'validUntil','2030-01-01T00:00:00Z'))->'record' from fixtures where kind='asset-capabilities';
insert into refs select 'calendar-2',public.command_v2_catalog('c2300000-0000-4000-8000-000000000001','c2320000-0000-4000-8000-000000000001','calendars','c2340000-0000-4000-8000-000000000001',null,null,gen_random_uuid(),null,value||jsonb_build_object('assetId',pg_temp.id('asset-2'),'horizon',jsonb_build_object('startsAt',now()-interval '2 hours','endsAt',now()+interval '1 day'),'availableWindows',jsonb_build_array(jsonb_build_object('startsAt',now()-interval '2 hours','endsAt',now()+interval '1 day')),'validUntil','2030-01-01T00:00:00Z'))->'record' from fixtures where kind='calendars';
select pg_temp.save('limits-2','limits.publish',(select value->'data' from refs where name='limits')||jsonb_build_object('assetId',pg_temp.id('asset-2')),pg_temp.ctx(null,'c2340000-0000-4000-8000-000000000001'));
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

create function pg_temp.multi_candidate() returns jsonb language sql as $$select pg_temp.candidate()||jsonb_build_object('resources',jsonb_build_array(
 jsonb_build_object('calendarId',pg_temp.id('calendar'),'assetId',pg_temp.id('asset'),'poolId',null,'allocations',jsonb_build_array(jsonb_build_object('unitIndex',0,'quantity',1))),
 jsonb_build_object('calendarId',pg_temp.id('calendar-2'),'assetId',pg_temp.id('asset-2'),'poolId',null,'allocations',jsonb_build_array(jsonb_build_object('unitIndex',0,'quantity',1)))));$$;
create function pg_temp.multi_quote(k uuid default gen_random_uuid()) returns jsonb language sql as $$select public.request_v2_carrier_quote('c2300000-0000-4000-8000-000000000001','c2320000-0000-4000-8000-000000000003',pg_temp.id('request'),2,k,now()+interval '1 hour',pg_temp.multi_candidate());$$;
set local role authenticated;
set local "request.jwt.claims"='{"sub":"c2310000-0000-4000-8000-000000000001","role":"authenticated"}';

create function pg_temp.dispatch_policy(confirm boolean default true) returns jsonb language sql as $$select pg_temp.tariff()||jsonb_build_object('maxResources',2,'resourcePricing','PER_PLAN','dispatch',jsonb_build_object('allowedPriorities',jsonb_build_array('URGENT','SCHEDULED'),'minNoticeMinutes',0,'loadingMinutes',30,'unloadingMinutes',30,'autoConfirm',confirm,'maxBookingAmount',1000,'acknowledgeSchedulingAuthority',confirm));$$;
select throws_ok($$select public.configure_v2_quote_policy('c2340000-0000-4000-8000-000000000001',pg_temp.op(),gen_random_uuid(),0,jsonb_set(pg_temp.dispatch_policy(),'{dispatch,acknowledgeSchedulingAuthority}','false'))$$,'PT400','SCHEDULING_AUTHORITY_REQUIRED','quote authority alone cannot authorize booking');
insert into refs values('dispatch-policy',public.configure_v2_quote_policy('c2340000-0000-4000-8000-000000000001',pg_temp.op(),gen_random_uuid(),0,pg_temp.dispatch_policy()));
reset role;
-- Explicit synthetic transit evidence: unknown transit must not create an ETA.
update public.service_lanes set planned_transit_minutes=120,transit_provenance_status='SIMULATED' where id='c2380000-0000-4000-8000-000000000001';
set local role authenticated;

set local "request.jwt.claims"='{"sub":"c2310000-0000-4000-8000-000000000002","role":"authenticated"}';

reset role;
create function pg_temp.cost_params() returns jsonb language sql as $$select '{"version":"COST_PLUS_V1","fuelLitresPer100Km":30,"fuelPricePerLitre":1.2,"driverHourlyCost":6,"vehicleCostPerKm":0.15,"fixedCostPerVehicle":25,"handlingCostPerShipment":20,"maxContinuousDrivingMinutes":60,"breakMinutes":15,"maxDailyDrivingMinutes":120,"dailyRestMinutes":600,"payRestTime":true,"markupPercent":20,"taxPercent":0}'::jsonb;$$;
create function pg_temp.cost_profile() returns jsonb language sql as $$select '{"version":"ROAD_COST_INPUT_V1","drivingSeconds":3600,"tollAmount":10,"stops":[{"waypointIndex":0,"afterDrivingSeconds":1800,"restMinutes":15,"feeAmount":5}],"source":{"reference":"fixture:costs","provider":"Synthetic cost fixture","observedAt":"2020-01-01T00:00:00Z","validUntil":"2030-01-01T00:00:00Z","provenanceStatus":"SIMULATED"}}'::jsonb;$$;
select is(private.calculate_operating_costs(pg_temp.cost_params(),jsonb_build_object('estimatedDistanceKm',100,'operatingProfile',pg_temp.cost_profile(),'waypoints',jsonb_build_array(jsonb_build_object('kind','REST','source',pg_temp.ev()))),2,0,8100,now()+interval '8 hours')->>'totalCents','29280','SQL matches the independent TypeScript expected cents');
select is(private.calculate_operating_costs(pg_temp.cost_params(),jsonb_build_object('estimatedDistanceKm',100,'operatingProfile',pg_temp.cost_profile(),'waypoints','[]'::jsonb),1,0,0,now()+interval '8 hours')->>'reason','REST_LOCATION_EVIDENCE_REQUIRED','missing stop cannot be replaced with invented rest');
select is(private.calculate_operating_costs(jsonb_set(pg_temp.cost_params(),'{maxContinuousDrivingMinutes}','20'),jsonb_build_object('estimatedDistanceKm',100,'operatingProfile',pg_temp.cost_profile(),'waypoints',jsonb_build_array(jsonb_build_object('kind','REST','source',pg_temp.ev()))),1,0,0,now()+interval '8 hours')->>'reason','DRIVER_REST_PLAN_REQUIRED','insufficient continuous-driving allowance blocks the route');
set local role authenticated;
set local "request.jwt.claims"='{"sub":"c2310000-0000-4000-8000-000000000001","role":"authenticated"}';
insert into refs values('cost-policy',public.configure_v2_quote_policy('c2340000-0000-4000-8000-000000000001',pg_temp.op(),gen_random_uuid(),1,pg_temp.dispatch_policy()||jsonb_build_object('basis','COST_PLUS','baseAmount',0,'ratePerKm',0,'minimumAmount',0,'fuelAmount',0,'tollAmount',0,'handlingAmount',0,'taxAmount',0,'resourcePricing','PER_RESOURCE','operatingCosts',pg_temp.cost_params())));
select is(public.read_v2_dispatch_options('c2300000-0000-4000-8000-000000000001','c2320000-0000-4000-8000-000000000001',pg_temp.id('request'),2),'[]'::jsonb,'no automatic cost schedule without operating evidence');
select pg_temp.w('corridors.publish',jsonb_build_object('expectedVersion',1,'value',(select value->'data' from refs where name='corridor')||jsonb_build_object('operatingProfile',pg_temp.cost_profile())),pg_temp.ctx(null,null,null,pg_temp.id('corridor')));
set local "request.jwt.claims"='{"sub":"c2310000-0000-4000-8000-000000000002","role":"authenticated"}';
create function pg_temp.cost_schedule() returns jsonb language sql as $$select jsonb_build_object('policyVersion',2,'pickupAt',now()+interval '2 hours','deliveryAt',now()+interval '5 hours','operationWindow',jsonb_build_object('startsAt',now()+interval '2 hours','endsAt',now()+interval '5 hours 30 minutes'),'routeId',pg_temp.id('corridor'),'transitSeconds',7200);$$;
insert into refs values('cost-offer',public.request_v2_carrier_quote('c2300000-0000-4000-8000-000000000001','c2320000-0000-4000-8000-000000000003',pg_temp.id('request'),2,gen_random_uuid(),now()+interval '1 hour',pg_temp.multi_candidate()||jsonb_build_object('schedule',pg_temp.cost_schedule())));
select is((select value->>'status' from refs where name='cost-offer'),'OFFERED','native two-truck quote issued from approved cost algorithm');
reset role;
select is((select (data#>>'{price,amount}')::numeric from public.v2_carrier_offers where id=(select (value->>'offerId')::uuid from refs where name='cost-offer')),292.8::numeric,'native price is based on consumption, driver and rest rather than the previous fixed tariff');
select is((select count(*)::int from public.v2_carrier_offers o cross join lateral jsonb_array_elements(o.data->'breakdown') x where o.id=(select (value->>'offerId')::uuid from refs where name='cost-offer') and x->>'kind'='FUEL'),1,'calculated fuel appears once');
select is((select calculation_snapshot#>>'{calculation,paidDriverSeconds}' from private.quote_issued_offers where offer_id=(select (value->>'offerId')::uuid from refs where name='cost-offer'))::integer,12600,'paid driver time includes loading, waiting and declared paid rest for both trucks');
select ok(not has_function_privilege('anon','private.calculate_operating_costs(jsonb,jsonb,integer,numeric,integer,timestamptz)','EXECUTE'),'anonymous cannot call internal pricing');
select ok(not has_table_privilege('authenticated','private.quote_issued_offers','SELECT'),'private cost and margin snapshots are not directly readable');
select ok((select not data::text like '%CARRIER_MARKUP%' from public.v2_carrier_offers where id=(select (value->>'offerId')::uuid from refs where name='cost-offer')),'internal markup is not leaked through the Client offer');
set local role authenticated;
set local "request.jwt.claims"='{"sub":"c2310000-0000-4000-8000-000000000001","role":"authenticated"}';
select is(public.read_v2_carrier_cost_calculation('c2340000-0000-4000-8000-000000000001',pg_temp.op(),(select (value->>'offerId')::uuid from refs where name='cost-offer'))#>>'{snapshot,calculation,totalCents}','29280','Carrier admin can explain the persisted cost calculation');
reset role;

reset role;
create function pg_temp.fleet_params() returns jsonb language sql as $$select pg_temp.cost_params()||jsonb_build_object('fleet',jsonb_build_object('version','TRUCK_PROFILES_V1','profiles','[{"id":"rigid","label":"Rigid model","equipmentCode":"BOX_TRUCK","fuelLitresPer100Km":30,"driverHourlyCost":6,"vehicleCostPerKm":0.15,"fixedCostPerVehicle":25,"maxSpeedKph":120},{"id":"larger","label":"Larger model","equipmentCode":"BOX_TRUCK","fuelLitresPer100Km":20,"driverHourlyCost":8,"vehicleCostPerKm":0.2,"fixedCostPerVehicle":40,"maxSpeedKph":120}]'::jsonb,'assets',jsonb_build_array(jsonb_build_object('assetId',pg_temp.id('asset'),'profileId','rigid','overrides','{}'::jsonb),jsonb_build_object('assetId',pg_temp.id('asset-2'),'profileId','larger','overrides','{}'::jsonb))));$$;
create function pg_temp.fleet_route() returns jsonb language sql as $$select jsonb_build_object('estimatedDistanceKm',100,'operatingProfile',pg_temp.cost_profile(),'waypoints',jsonb_build_array(jsonb_build_object('kind','REST','source',pg_temp.ev())));$$;
create function pg_temp.fleet_cost(p jsonb default pg_temp.fleet_params(),rr jsonb default pg_temp.multi_candidate()->'resources') returns jsonb language sql as $$select private.calculate_resource_operating_costs(p,pg_temp.fleet_route(),rr,0,8100,now()+interval '8 hours','c2340000-0000-4000-8000-000000000001','c2360000-0000-4000-8000-000000000001');$$;
select is(pg_temp.fleet_cost()->>'totalCents','31080','native heterogeneous pricing agrees with TS independent expected total');
select is((select sum((x->>'cents')::numeric) from jsonb_array_elements(pg_temp.fleet_cost()->'components') x),31080::numeric,'rounded components sum to the complete shipment price');
select is((select count(*)::int from jsonb_array_elements(pg_temp.fleet_cost()->'components') x where x->>'code'='HANDLING_PER_SHIPMENT'),1,'handling charged once for the shipment');
select is(pg_temp.fleet_cost(jsonb_set(pg_temp.fleet_params(),'{fleet,assets,1,overrides}','{"fuelLitresPer100Km":25}'::jsonb))->>'totalCents','31800','asset adjustment replaces the selected type consumption');
select is(pg_temp.fleet_cost(jsonb_set(pg_temp.fleet_params(),'{fleet,assets,1,overrides}','{"maxSpeedKph":80}'::jsonb))->>'reason','TRUCK_DRIVING_TIME_INCONSISTENT','speed cap blocks physically optimistic driving duration');
select is(pg_temp.fleet_cost(jsonb_set(pg_temp.fleet_params(),'{fleet,profiles,1,equipmentCode}','"REEFER_TRUCK"'))->>'reason','TRUCK_COST_EQUIPMENT_MISMATCH','persisted equipment is checked rather than trusting an arbitrary profile');
select ok(not private.valid_operating_cost_policy(jsonb_set(pg_temp.fleet_params(),'{fleet,assets,1,assetId}',to_jsonb(pg_temp.id('asset')))),'duplicate bindings rejected');
select is(pg_temp.fleet_cost(pg_temp.fleet_params(),jsonb_set(pg_temp.multi_candidate()->'resources','{1,assetId}','"a0000001-0000-4000-8000-000000000099"'))->>'reason','TRUCK_COST_ASSET_SCOPE','foreign or absent truck cannot be priced');
select ok(not coalesce(private.cost_route_matches_request(pg_temp.fleet_route(),(select v2_snapshot from public.freight_requests where id=pg_temp.id('request'))),false),'same city route without exact endpoints is not the real request route');
-- Exact synthetic endpoints correlate with this rolled-back request; not a real road measurement.
update public.route_corridors set data=jsonb_set(data,'{operatingProfile,endpoints}',(select jsonb_build_object('origin',jsonb_build_object('lat',v2_snapshot#>'{origin,lat}','lng',v2_snapshot#>'{origin,lng}'),'destination',jsonb_build_object('lat',v2_snapshot#>'{destination,lat}','lng',v2_snapshot#>'{destination,lng}')) from public.freight_requests where id=pg_temp.id('request'))) where id=pg_temp.id('corridor');
set local role authenticated;
set local "request.jwt.claims"='{"sub":"c2310000-0000-4000-8000-000000000001","role":"authenticated"}';
insert into refs values('fleet-policy',public.configure_v2_quote_policy('c2340000-0000-4000-8000-000000000001',pg_temp.op(),gen_random_uuid(),2,pg_temp.dispatch_policy()||jsonb_build_object('basis','COST_PLUS','baseAmount',0,'ratePerKm',0,'minimumAmount',0,'fuelAmount',0,'tollAmount',0,'handlingAmount',0,'taxAmount',0,'resourcePricing','PER_RESOURCE','operatingCosts',pg_temp.fleet_params())));
select throws_ok($$select public.configure_v2_quote_policy('c2340000-0000-4000-8000-000000000001',pg_temp.op(),gen_random_uuid(),2,(select value->'value' from refs where name='fleet-policy'))$$,'PT409','STALE_DRAFT','fleet policy retains optimistic concurrency');
set local "request.jwt.claims"='{"sub":"c2310000-0000-4000-8000-000000000002","role":"authenticated"}';
insert into refs values('fleet-preview',public.preview_v2_dispatch_costs('c2300000-0000-4000-8000-000000000001','c2320000-0000-4000-8000-000000000003',pg_temp.id('request'),2,jsonb_build_array(pg_temp.multi_candidate()||jsonb_build_object('schedule',jsonb_set(pg_temp.cost_schedule(),'{policyVersion}','3')))));
select is((select value#>>'{0,totalCents}' from refs where name='fleet-preview'),'31080','read-only cost comparison uses real native tariff and matching exact endpoints');
select ok((select not value::text like '%driverHourlyCost%' and not value::text like '%markup%' from refs where name='fleet-preview'),'client comparison never exposes driver wages or markup');
select throws_ok($$select public.preview_v2_dispatch_costs('c2300000-0000-4000-8000-000000000001','c2320000-0000-4000-8000-000000000003',pg_temp.id('request'),1,'[]')$$,'PT409','STALE_DRAFT','cost preview rejects stale requests');
reset role;
select ok(not has_function_privilege('anon','public.preview_v2_dispatch_costs(uuid,uuid,uuid,integer,jsonb)','EXECUTE'),'anonymous cannot inspect estimates');
select is((select count(*)::int from public.v2_carrier_offers),1,'cost comparison creates no extra offers');


set local role authenticated;
set local "request.jwt.claims"='{"sub":"c2310000-0000-4000-8000-000000000001","role":"authenticated"}';
-- A second request exercises actual native heterogeneous offer issuance, not just a cost preview.
update refs set name='request-scalar' where name='request';
insert into refs values('request',public.create_v2_freight_request('c2300000-0000-4000-8000-000000000001','c2320000-0000-4000-8000-000000000001',gen_random_uuid(),private.hash_v2_freight_payload(pg_temp.req_payload()),pg_temp.req_payload()));
select public.command_v2_freight_request('c2300000-0000-4000-8000-000000000001','c2320000-0000-4000-8000-000000000001',gen_random_uuid(),pg_temp.id('request'),1,'SUBMIT',null);
set local "request.jwt.claims"='{"sub":"c2310000-0000-4000-8000-000000000002","role":"authenticated"}';
create function pg_temp.fleet_quote() returns jsonb language sql as $$select public.request_v2_carrier_quote('c2300000-0000-4000-8000-000000000001','c2320000-0000-4000-8000-000000000003',pg_temp.id('request'),2,'a0000001-0000-4000-8000-000000000088',now()+interval '1 hour',pg_temp.multi_candidate()||jsonb_build_object('schedule',jsonb_set(pg_temp.cost_schedule(),'{policyVersion}','3')));$$;
insert into refs values('fleet-native-offer',pg_temp.fleet_quote());
select is((select value->>'status' from refs where name='fleet-native-offer'),'OFFERED','heterogeneous quote is issued by the native commercial flow');
select is(pg_temp.fleet_quote(),(select value from refs where name='fleet-native-offer'),'retry reuses the same heterogeneous offer and intent');
reset role;
select is((select (data#>>'{price,amount}')::numeric from public.v2_carrier_offers where id=(select (value->>'offerId')::uuid from refs where name='fleet-native-offer')),310.8::numeric,'issued fleet offer agrees with read-only comparison');
select is((select jsonb_array_length(calculation_snapshot#>'{calculation,resources}') from private.quote_issued_offers where offer_id=(select (value->>'offerId')::uuid from refs where name='fleet-native-offer')),2,'two immutable individual truck calculations persisted');

select is(private.dispatch_transit_seconds(pg_temp.fleet_route(),120,jsonb_build_object('basis','COST_PLUS','minimumAmount',0,'operatingCosts',pg_temp.fleet_params()||jsonb_build_object('fuelLitresPer100Km',0,'driverHourlyCost',0,'vehicleCostPerKm',0,'fixedCostPerVehicle',0,'handlingCostPerShipment',0))),7200,'fleet dispatch timing does not require a fictitious common truck cost');


insert into refs select 'auto-multi',value from refs where name='fleet-native-offer';

-- Reuse the native two-resource booking path with the COST_PLUS offer.

set local role authenticated;
set local "request.jwt.claims"='{"sub":"c2310000-0000-4000-8000-000000000002","role":"authenticated"}';
create function pg_temp.client_command(a text,v jsonb) returns jsonb language sql as $$select public.command_v2_workflow('c2300000-0000-4000-8000-000000000001','c2320000-0000-4000-8000-000000000003',a,pg_temp.ctx(pg_temp.id('request')),gen_random_uuid(),v)->'record';$$;
insert into refs select 'decision',pg_temp.client_command('decisions.create',jsonb_build_object('schemaVersion','2.0','planId',value->>'planId','selectedOfferIds',jsonb_build_array(value->>'offerId'),'consideredOfferIds',jsonb_build_array(value->>'offerId'),'policyId',null,'rationale','Explicit two-truck test selection','evidence',jsonb_build_array(pg_temp.ev()))) from refs where name='auto-multi';
insert into refs select 'booking',pg_temp.client_command('bookings.create',jsonb_build_object('schemaVersion','2.0','decisionId',pg_temp.id('decision'),'offerId',value->>'offerId','authorization','AUTHORIZE','evidence',pg_temp.ev())) from refs where name='auto-multi';
insert into refs select 'execution',pg_temp.client_command('executions.create',jsonb_build_object('schemaVersion','2.0','bookingId',pg_temp.id('booking'),'serviceId','c2360000-0000-4000-8000-000000000001'));
insert into refs select 'final-plan',public.read_v2_workflow('c2300000-0000-4000-8000-000000000001','c2320000-0000-4000-8000-000000000003','plans',pg_temp.ctx(null,null,null,(select (value->>'planId')::uuid from refs where name='auto-multi')),100,0)->0;
insert into refs select 'hold-'||n,pg_temp.client_command('holds.create',jsonb_build_object('schemaVersion','2.0','bookingId',pg_temp.id('booking'),'assignmentId',value#>>'{data,legAssignments,0,id}','planResourceId',resource->'resourceId','expiresAt',now()+interval '20 minutes','consolidationId',null,'evidence',resource#>'{resource,verificationSource,source}')) from refs cross join lateral jsonb_array_elements(value#>'{data,legAssignments,0,resources}') with ordinality resources(resource,n) where name='final-plan';
select is((select count(*)::integer from refs where name like 'hold-%' and value->>'status'='HELD'),2,'one Client booking prepares two independent native holds');
set local "request.jwt.claims"='{"sub":"c2310000-0000-4000-8000-000000000001","role":"authenticated"}';

-- A-12 acts on existing versioned limits, never fake maintenance/capacity changes.

reset role;
select is(private.assess_route_admission(null,now(),now()+interval '1 hour')->>'state','UNKNOWN','missing admission is unknown');
select is(private.assess_route_admission(jsonb_build_object('compatibilityConfirmed',true,'source',pg_temp.ev()),now(),now()+interval '1 hour')->>'state','ALLOWED','legacy true requires current evidence');
select is(private.assess_route_admission(jsonb_build_object('compatibilityConfirmed',false,'source',pg_temp.ev()),now(),now()+interval '1 hour')->>'state','UNKNOWN','legacy false is not an invented prohibition');
select is(private.assess_route_admission(jsonb_build_object('compatibilityConfirmed',true,'source',pg_temp.ev()||jsonb_build_object('validUntil',now()-interval '1 second')),now(),now()+interval '1 hour')->>'state','EXPIRED','expired admission never becomes allowed');
select ok(not has_function_privilege('authenticated','private.resource_route_admission(uuid,uuid,uuid,uuid,timestamptz,timestamptz)','EXECUTE'),'no direct unscoped admission oracle');
select ok(not has_function_privilege('anon','public.read_v2_dispatch_options_with_admission(uuid,uuid,uuid,integer)','EXECUTE'),'anonymous cannot read scoped admission options');
select ok(not has_function_privilege('anon','public.preview_v2_dispatch_costs(uuid,uuid,uuid,integer,jsonb)','EXECUTE'),'anonymous preview remains blocked');
set local role authenticated;
set local "request.jwt.claims"='{"sub":"c2310000-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok($$select pg_temp.w('limits.publish',(select value->'data' from refs where name='limits')||jsonb_build_object('admission',jsonb_build_object('decision','DENIED','reasonCode','ACCESS_RESTRICTION')),pg_temp.ctx(null,'c2340000-0000-4000-8000-000000000001'))$$,'PT400','INVALID_ROUTE_ADMISSION','contradictory allowed flag and denial rejected by native publication');
insert into refs values('denied-limit',pg_temp.w('limits.publish',jsonb_build_object('expectedVersion',1,'value',(select value->'data' from refs where name='limits-2')||jsonb_build_object('compatibilityConfirmed',false,'admission',jsonb_build_object('decision','DENIED','reasonCode','ACCESS_RESTRICTION'))),pg_temp.ctx(null,'c2340000-0000-4000-8000-000000000001',null,pg_temp.id('limits-2'))));
reset role;
select is(private.workflow_evaluate_plan((select (value->>'planId')::uuid from refs where name='auto-multi'))->>'eligibility','ineligible','existing quoted two-truck plan revalidates new corridor denial');
select ok(private.workflow_evaluate_plan((select (value->>'planId')::uuid from refs where name='auto-multi'))->'exclusionReasons' ? 'ROUTE_ADMISSION_DENIED','stable reason records explicit denial');
set local role authenticated;
set local "request.jwt.claims"='{"sub":"c2310000-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok($$select pg_temp.w('holds.confirm',jsonb_build_object('schemaVersion','2.0','expectedVersion',1,'note','Denied corridor','evidence',pg_temp.ev()),pg_temp.ctx(null,'c2340000-0000-4000-8000-000000000001',null,pg_temp.id('hold-2')))$$,'PT409','PLAN_OR_EVIDENCE_NOT_CURRENT','Carrier cannot confirm resource denied after quote');
reset role;
select is((select count(*)::int from public.capacity_reservations where booking_id=pg_temp.id('booking') and status='CONFIRMED'),0,'denial leaves zero partial confirmed resources');
set local role authenticated;
set local "request.jwt.claims"='{"sub":"c2310000-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok($$select pg_temp.w('bookings.confirm',jsonb_build_object('schemaVersion','2.0','expectedVersion',1,'note','Denied plan','evidence',pg_temp.ev(),'carrierReference','A12','confirmation','CONFIRMED'),pg_temp.ctx(null,'c2340000-0000-4000-8000-000000000001',null,pg_temp.id('booking')))$$,'PT409','CAPACITY_COMMITMENT_REQUIRED','booking cannot confirm a denied resource plan');

insert into refs values('unknown-limit',pg_temp.w('limits.publish',jsonb_build_object('expectedVersion',2,'value',(select value->'data' from refs where name='denied-limit')||jsonb_build_object('admission',jsonb_build_object('decision','UNKNOWN','reasonCode','ACCESS_NOT_VERIFIED'))),pg_temp.ctx(null,'c2340000-0000-4000-8000-000000000001',null,pg_temp.id('limits-2'))));
reset role;
select is(private.workflow_evaluate_plan((select (value->>'planId')::uuid from refs where name='auto-multi'))->>'eligibility','unknown','missing proof is not explicit denial and never eligible');
set local role authenticated;
set local "request.jwt.claims"='{"sub":"c2310000-0000-4000-8000-000000000001","role":"authenticated"}';
insert into refs values('expired-limit',pg_temp.w('limits.publish',jsonb_build_object('expectedVersion',3,'value',(select value->'data' from refs where name='unknown-limit')||jsonb_build_object('compatibilityConfirmed',true,'admission',jsonb_build_object('decision','ALLOWED','reasonCode','ACCESS_CONFIRMED'),'source',pg_temp.ev()||jsonb_build_object('validUntil',now()-interval '1 second'))),pg_temp.ctx(null,'c2340000-0000-4000-8000-000000000001',null,pg_temp.id('limits-2'))));
reset role;
select ok(private.workflow_evaluate_plan((select (value->>'planId')::uuid from refs where name='auto-multi'))->'pendingRequirements' ? 'ROUTE_ADMISSION_EXPIRED','expired proof stays pending during native plan revalidation');
set local role authenticated;
set local "request.jwt.claims"='{"sub":"c2310000-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok($$select pg_temp.w('limits.publish',jsonb_build_object('expectedVersion',1,'value',(select value->'data' from refs where name='denied-limit')),pg_temp.ctx(null,'c2340000-0000-4000-8000-000000000001',null,pg_temp.id('limits-2')))$$,'PT409','STALE_DRAFT','admission publication keeps version conflicts');
-- Restore admission through a versioned command; then the original two-resource booking can finish.
insert into refs values('allowed-limit',pg_temp.w('limits.publish',jsonb_build_object('expectedVersion',4,'value',(select value->'data' from refs where name='denied-limit')||jsonb_build_object('compatibilityConfirmed',true,'admission',jsonb_build_object('decision','ALLOWED','reasonCode','ACCESS_CONFIRMED'))),pg_temp.ctx(null,'c2340000-0000-4000-8000-000000000001',null,pg_temp.id('limits-2'))));
select lives_ok($$select pg_temp.w('holds.confirm',jsonb_build_object('schemaVersion','2.0','expectedVersion',1,'note','First carrying resource','evidence',pg_temp.ev()),pg_temp.ctx(null,'c2340000-0000-4000-8000-000000000001',null,pg_temp.id('hold-1')))$$,'Carrier confirms first resource');
select throws_ok($$select pg_temp.w('bookings.confirm',jsonb_build_object('schemaVersion','2.0','expectedVersion',1,'note','Incomplete capacity','evidence',pg_temp.ev(),'carrierReference','PLAN1','confirmation','CONFIRMED'),pg_temp.ctx(null,'c2340000-0000-4000-8000-000000000001',null,pg_temp.id('booking')))$$,'PT409','CAPACITY_COMMITMENT_REQUIRED','one confirmed truck cannot confirm a two-truck booking');
select lives_ok($$select pg_temp.w('holds.confirm',jsonb_build_object('schemaVersion','2.0','expectedVersion',1,'note','Second carrying resource','evidence',pg_temp.ev()),pg_temp.ctx(null,'c2340000-0000-4000-8000-000000000001',null,pg_temp.id('hold-2')))$$,'Carrier confirms second resource');
select lives_ok($$select pg_temp.w('bookings.confirm',jsonb_build_object('schemaVersion','2.0','expectedVersion',1,'note','Both resources committed','evidence',pg_temp.ev(),'carrierReference','PLAN1','confirmation','CONFIRMED'),pg_temp.ctx(null,'c2340000-0000-4000-8000-000000000001',null,pg_temp.id('booking')))$$,'Carrier can confirm once both resources are committed');
reset role;
select is((select count(*)::integer from public.v2_bookings where freight_request_id=pg_temp.id('request')),1,'two carrying resources still belong to one booking');
set local role authenticated;
set local "request.jwt.claims"='{"sub":"c2310000-0000-4000-8000-000000000002","role":"authenticated"}';
select is(jsonb_array_length(public.read_v2_workflow('c2300000-0000-4000-8000-000000000001','c2320000-0000-4000-8000-000000000003','holds',pg_temp.ctx(pg_temp.id('request')),100,0)),2,'Client reads both committed resources through its authorized projection');

reset role;
select is((select (data#>>'{price,amount}')::numeric from public.v2_carrier_offers where id=(select (value->>'offerId')::uuid from refs where name='auto-multi')),310.80::numeric,'booking preserves the native authorized cost-plus offer price');
select is((select count(*)::int from public.capacity_reservations where booking_id=pg_temp.id('booking') and status='CONFIRMED'),2,'costed C01 confirms exactly two physical capacity reservations');
select is((select sum(assigned_weight_kg) from public.load_allocations where assignment_id in(select id from public.plan_resource_bindings where plan_id=(select (value->>'planId')::uuid from refs where name='auto-multi'))),12000::numeric,'costed booked plan preserves all twelve tonnes');
select is((select status from public.transport_executions where id=pg_temp.id('execution')),'PLANNED','commercial confirmation does not fabricate an in-transit event');

-- Replay the original booking intent, rather than issuing a second commercial operation.
insert into refs select 'booking-replay-key',jsonb_build_object('id',idempotency_key) from private.v2_workflow_receipts where result->>'id'=pg_temp.id('booking')::text and result->>'status'='AUTHORIZED';
set local role authenticated;
set local "request.jwt.claims"='{"sub":"c2310000-0000-4000-8000-000000000002","role":"authenticated"}';
select is((public.command_v2_workflow('c2300000-0000-4000-8000-000000000001','c2320000-0000-4000-8000-000000000003','bookings.create',pg_temp.ctx(pg_temp.id('request')),
 pg_temp.id('booking-replay-key'),
 jsonb_build_object('schemaVersion','2.0','decisionId',pg_temp.id('decision'),'offerId',(select value->>'offerId' from refs where name='auto-multi'),'authorization','AUTHORIZE','evidence',pg_temp.ev()))#>>'{record,id}'),pg_temp.id('booking')::text,'same native booking intent returns the same booking');
reset role;
select is((select count(*)::int from public.capacity_reservations where booking_id=pg_temp.id('booking')),2,'booking replay creates no additional physical reservations');

select * from finish();rollback;

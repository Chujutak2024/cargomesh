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
create function pg_temp.req_payload() returns jsonb language sql as $$select '{"schemaVersion":"2.0","origin":{"facilityId":"c2330000-0000-4000-8000-000000000001"},"destination":{"facilityId":"c2330000-0000-4000-8000-000000000002"},"pickupWindow":{"startsAt":"2027-01-15T08:00:00Z","endsAt":"2027-01-15T18:00:00Z"},"deliveryWindow":{"startsAt":"2027-01-15T08:00:00Z","endsAt":"2027-01-15T20:00:00Z"},"acceptedModes":["ROAD"],"requiredEquipment":null,"cargoSpecification":{"categoryCode":"GENERAL","description":"QA original","packaging":"PALLET","totalWeightKg":1000,"totalVolumeM3":2,"divisible":true,"requirements":[],"units":[{"packageType":"PALLET","quantity":1,"weightPerUnitKg":1000,"volumePerUnitM3":2,"dimensionsCm":{"length":100,"width":100,"height":200},"indivisible":false,"stackable":true}]},"contacts":{"pickup":{"name":"QA","phoneE164":"+51911111111"},"recipient":{"name":"QA","phoneE164":"+51922222222"}},"budget":{"amount":500,"currency":"USD"}}'::jsonb||jsonb_build_object('pickupWindow',jsonb_build_object('startsAt',now()-interval '1 hour','endsAt',now()+interval '4 hours'),'deliveryWindow',jsonb_build_object('startsAt',now(),'endsAt',now()+interval '8 hours'));$$;
insert into refs values('request',public.create_v2_freight_request('c2300000-0000-4000-8000-000000000001','c2320000-0000-4000-8000-000000000001',gen_random_uuid(),private.hash_v2_freight_payload(pg_temp.req_payload()),pg_temp.req_payload()));

select ok(pg_temp.id('request') is not null,'canonical request created');
select public.command_v2_freight_request('c2300000-0000-4000-8000-000000000001','c2320000-0000-4000-8000-000000000001',gen_random_uuid(),pg_temp.id('request'),1,'SUBMIT',null);
insert into refs select 'asset',public.command_v2_catalog('c2300000-0000-4000-8000-000000000001','c2320000-0000-4000-8000-000000000001','assets','c2340000-0000-4000-8000-000000000001',null,null,gen_random_uuid(),null,value||jsonb_build_object('code','WORKFLOW_QA'))->'record' from fixtures where kind='assets';
insert into refs select 'definition',public.command_v2_catalog('c2300000-0000-4000-8000-000000000001','c2320000-0000-4000-8000-000000000001','capability-definitions','c2340000-0000-4000-8000-000000000001',null,null,gen_random_uuid(),null,value||jsonb_build_object('validUntil','2030-01-01T00:00:00Z'))->'record' from fixtures where kind='capability-definitions';
insert into refs select 'capability',public.command_v2_catalog('c2300000-0000-4000-8000-000000000001','c2320000-0000-4000-8000-000000000001','asset-capabilities','c2340000-0000-4000-8000-000000000001',null,null,gen_random_uuid(),null,value||jsonb_build_object('assetId',pg_temp.id('asset'),'definitionId',pg_temp.id('definition'),'validUntil','2030-01-01T00:00:00Z'))->'record' from fixtures where kind='asset-capabilities';
insert into refs select 'calendar',public.command_v2_catalog('c2300000-0000-4000-8000-000000000001','c2320000-0000-4000-8000-000000000001','calendars','c2340000-0000-4000-8000-000000000001',null,null,gen_random_uuid(),null,value||jsonb_build_object('assetId',pg_temp.id('asset'),'horizon',jsonb_build_object('startsAt',now()-interval '2 hours','endsAt',now()+interval '1 day'),'availableWindows',jsonb_build_array(jsonb_build_object('startsAt',now()-interval '2 hours','endsAt',now()+interval '1 day')),'validUntil','2030-01-01T00:00:00Z'))->'record' from fixtures where kind='calendars';
select pg_temp.save('origin','nodes.publish',jsonb_build_object('schemaVersion','2.0','active',true,'kind','HUB','name','QA origin','location',(select (v2_snapshot->'origin')-'facilityId' from public.freight_requests where id=pg_temp.id('request')),'jurisdiction','PE','source',pg_temp.ev(),'verifiedAt','2020-01-01T00:00:00Z'));
select pg_temp.save('destination','nodes.publish',jsonb_build_object('schemaVersion','2.0','active',true,'kind','HUB','name','QA destination','location',(select (v2_snapshot->'destination')-'facilityId' from public.freight_requests where id=pg_temp.id('request')),'jurisdiction','PE','source',pg_temp.ev(),'verifiedAt','2020-01-01T00:00:00Z'));
select pg_temp.save('corridor','corridors.publish',jsonb_build_object('schemaVersion','2.0','active',true,'originNodeId',pg_temp.id('origin'),'destinationNodeId',pg_temp.id('destination'),'mode','ROAD','estimatedDistanceKm',100,'estimatedDurationSeconds',3600,'restrictions','[]'::jsonb,'source',pg_temp.ev(),'version','QA-1','validUntil','2030-01-01T00:00:00Z','grossWeightLimitKg',15000,'payloadLimitKg',10000,'usableDimensions',jsonb_build_object('length',500,'width',240,'height',250),'limitsEvidence',pg_temp.ev(),'waypoints','[]'::jsonb));
select pg_temp.save('policy','route-policies.publish',jsonb_build_object('schemaVersion','2.0','active',true,'version','QA-1','objective','SHORTEST','constraints','[]'::jsonb,'weights',jsonb_build_object('distance',1,'duration',0),'missingDataRule','UNKNOWN'));
select pg_temp.save('limits','limits.publish',jsonb_build_object('schemaVersion','2.0','active',true,'serviceId','c2360000-0000-4000-8000-000000000001','assetId',pg_temp.id('asset'),'combinationId',null,'corridorId',pg_temp.id('corridor'),'manufacturerPayloadLimitKg',10000,'routeGrossLimitKg',15000,'combinedTareKg',5000,'usableVolumeM3',40,'usableDimensions',jsonb_build_object('length',500,'width',240,'height',250),'compatibilityConfirmed',true,'source',pg_temp.ev()),pg_temp.ctx(null,'c2340000-0000-4000-8000-000000000001'));
select pg_temp.save('route','routes.create',jsonb_build_object('schemaVersion','2.0','corridorIds',jsonb_build_array(pg_temp.id('corridor')),'policyId',pg_temp.id('policy')),pg_temp.ctx(pg_temp.id('request')));
select is((select value->>'status' from refs where name='route'),'eligible','sourced directed route eligible');
select is((select value#>>'{data,planner,algorithmVersion}' from refs where name='route'),
 'PUBLISHED_ITINERARY_VALIDATOR_V1','RoutePlanner: native creation exposes its actual algorithm version');
select matches((select value#>>'{data,planner,graphVersion}' from refs where name='route'),
 '^[0-9a-f]{64}$','RoutePlanner: itinerary snapshot has a SHA-256 graph fingerprint');
select is((select value#>'{data,planner,source}' from refs where name='route'),
 jsonb_build_object('kind','PUBLISHED_CORRIDORS','scope','SELECTED_ITINERARY_SNAPSHOT',
 'references',jsonb_build_array(pg_temp.id('corridor'))),'RoutePlanner: source references the real published corridor');
select is((public.read_v2_workflow('c2300000-0000-4000-8000-000000000001',
 'c2320000-0000-4000-8000-000000000001','routes',
 pg_temp.ctx(null,null,null,pg_temp.id('route')),100,0)->0)#>'{data,planner}',
 (select value#>'{data,planner}' from refs where name='route'),
 'RoutePlanner: authenticated native GET preserves all generated metadata');
-- Find/replan share the persisted route validator and cannot fabricate coverage.
select pg_temp.save('middle','nodes.publish',jsonb_build_object('schemaVersion','2.0','active',true,'kind','HUB',
 'name','QA alternative midpoint','location',jsonb_build_object('label','Synthetic Ica','countryCode','PE','region',null,
 'city','Ica','lat',null,'lng',null),'jurisdiction','PE','source',pg_temp.ev(),'verifiedAt','2020-01-01T00:00:00Z'));
select pg_temp.save('first-alternative','corridors.publish',
 (select value->'data' from refs where name='corridor')||jsonb_build_object('destinationNodeId',pg_temp.id('middle'),
 'estimatedDistanceKm',30,'estimatedDurationSeconds',1000));
select pg_temp.save('second-alternative','corridors.publish',
 (select value->'data' from refs where name='corridor')||jsonb_build_object('originNodeId',pg_temp.id('middle'),
 'estimatedDistanceKm',30,'estimatedDurationSeconds',1000));
insert into refs values('search-key',jsonb_build_object('id',gen_random_uuid()));
insert into refs values('search',public.command_v2_route_planner('c2300000-0000-4000-8000-000000000001',
 'c2320000-0000-4000-8000-000000000001','find',pg_temp.id('request'),pg_temp.id('search-key'),
 jsonb_build_object('schemaVersion','2.0','policyId',pg_temp.id('policy'),'expectedDraftVersion',2,'maxLegs',2,'maxAlternatives',10)));
select ok((select jsonb_array_length(value#>'{result,alternatives}')>=1 from refs where name='search'),
 'RoutePlanner: automatic directed search finds a published path');
select is((select value#>'{result,alternatives,0,data,corridorIds}' from refs where name='search'),
 jsonb_build_array(pg_temp.id('first-alternative'),pg_temp.id('second-alternative')),
 'RoutePlanner: policy ranks the shorter multi-leg route before the direct route');
select is((public.command_v2_route_planner('c2300000-0000-4000-8000-000000000001',
 'c2320000-0000-4000-8000-000000000001','find',pg_temp.id('request'),pg_temp.id('search-key'),
 jsonb_build_object('schemaVersion','2.0','policyId',pg_temp.id('policy'),'expectedDraftVersion',2,'maxLegs',2,'maxAlternatives',10))->>'replay'),
 'true','RoutePlanner: identical search replays without extra routes');
insert into refs values('search-again',public.command_v2_route_planner('c2300000-0000-4000-8000-000000000001',
 'c2320000-0000-4000-8000-000000000001','find',pg_temp.id('request'),gen_random_uuid(),
 jsonb_build_object('schemaVersion','2.0','policyId',pg_temp.id('policy'),'expectedDraftVersion',2,'maxLegs',2,'maxAlternatives',10)));
select is((select value#>'{result,alternatives,0,data,corridorIds}' from refs where name='search-again'),
 (select value#>'{result,alternatives,0,data,corridorIds}' from refs where name='search'),
 'RoutePlanner: ordering is deterministic across distinct requests with the same graph');
select throws_ok($$select public.command_v2_route_planner('c2300000-0000-4000-8000-000000000001',
 'c2320000-0000-4000-8000-000000000001','find',pg_temp.id('request'),pg_temp.id('search-key'),
 jsonb_build_object('schemaVersion','2.0','policyId',pg_temp.id('policy'),'expectedDraftVersion',2,'maxLegs',1,'maxAlternatives',10))$$,
 'PT409','IDEMPOTENCY_CONFLICT','RoutePlanner: conflicting search does not consume an existing receipt');
select throws_ok($$select public.command_v2_route_planner('c2300000-0000-4000-8000-000000000001',
 'c2320000-0000-4000-8000-000000000001','find',pg_temp.id('request'),gen_random_uuid(),
 jsonb_build_object('schemaVersion','2.0','policyId',pg_temp.id('policy'),'expectedDraftVersion',2,'maxLegs',9,'maxAlternatives',10))$$,
 'PT400','VALIDATION_ERROR','RoutePlanner: explicit search bounds are enforced');
insert into refs select 'aux',public.command_v2_catalog('c2300000-0000-4000-8000-000000000001','c2320000-0000-4000-8000-000000000001','assets','c2340000-0000-4000-8000-000000000001',null,null,gen_random_uuid(),null,value||jsonb_build_object('code','F05_ESCORT','role','AUXILIARY','usefulCapacityKg',0,'usableVolumeM3',null,'roadVehicle',(value->'roadVehicle')||jsonb_build_object('plate','QA-F05-AUX')))->'record' from fixtures where kind='assets';
insert into refs select 'aux-calendar',public.command_v2_catalog('c2300000-0000-4000-8000-000000000001','c2320000-0000-4000-8000-000000000001','calendars','c2340000-0000-4000-8000-000000000001',null,null,gen_random_uuid(),null,value||jsonb_build_object('assetId',pg_temp.id('aux'),'horizon',jsonb_build_object('startsAt',now()-interval '2 hours','endsAt',now()+interval '1 day'),'availableWindows',jsonb_build_array(jsonb_build_object('startsAt',now()-interval '2 hours','endsAt',now()+interval '1 day')),'validUntil','2030-01-01T00:00:00Z'))->'record' from fixtures where kind='calendars';
select pg_temp.save('plan','plans.create',jsonb_build_object('schemaVersion','2.0','routeId',pg_temp.id('route'),'assignments',jsonb_build_array(jsonb_build_object('legSequence',1,'serviceId','c2360000-0000-4000-8000-000000000001','laneId','c2380000-0000-4000-8000-000000000001','window',pg_temp.win(),'resources',jsonb_build_array(
 jsonb_build_object('calendarId',pg_temp.id('calendar'),'assetId',pg_temp.id('asset'),'capacityPoolId',null,'combinationId',null,'role','LOAD_BEARING','allocations',jsonb_build_array(jsonb_build_object('unitIndex',0,'quantity',1))),
 jsonb_build_object('calendarId',pg_temp.id('aux-calendar'),'assetId',pg_temp.id('aux'),'capacityPoolId',null,'combinationId',null,'role','AUXILIARY','allocations','[]'::jsonb))))),pg_temp.ctx(pg_temp.id('request')));
select is((select value->>'status' from refs where name='plan'),'eligible','F05: load-bearing and auxiliary resources are both evaluated');
select is((select jsonb_array_length(value#>'{data,legAssignments}') from refs where name='plan'),1,'F05: one canonical leg assignment');
select is((select jsonb_array_length(value#>'{data,legAssignments,0,resources}') from refs where name='plan'),2,'F05: assignment owns two resources');
select throws_ok($$select pg_temp.w('plans.create',jsonb_build_object('schemaVersion','2.0','routeId',pg_temp.id('route'),'assignments',jsonb_build_array(jsonb_build_object('legSequence',1,'serviceId','c2360000-0000-4000-8000-000000000001','laneId','c2380000-0000-4000-8000-000000000001','window',pg_temp.win(),'resources','[]'::jsonb))),pg_temp.ctx(pg_temp.id('request')))$$,'PT400','VALIDATION_ERROR','F05: empty resource ownership is rejected before storage');
insert into refs values('partner',public.command_v2_catalog('c2300000-0000-4000-8000-000000000001',
 'c2320000-0000-4000-8000-000000000001','partners','c2340000-0000-4000-8000-000000000001',null,null,
 gen_random_uuid(),null,jsonb_build_object('schemaVersion','2.0','registeredName','Model QA partner',
 'partnerCarrierRef',null,'agreementValidFrom','2020-01-01T00:00:00Z','agreementValidUntil','2030-01-01T00:00:00Z',
 'status','ACTIVE','coverageEvidence','fixture:partner-agreement'))->'record');
insert into refs values('partner-key',jsonb_build_object('id',gen_random_uuid()));
insert into refs values('partner-plan',pg_temp.w('plans.partner',jsonb_build_object('schemaVersion','2.0',
 'expectedVersion',1,'note','Assign actual carrier partner','evidence',pg_temp.ev(),'partnerId',pg_temp.id('partner')),
 pg_temp.ctx(null,null,(select (value#>>'{data,legAssignments,0,id}')::uuid from refs where name='plan'),pg_temp.id('plan')),
 pg_temp.id('partner-key')));
select is((select value#>>'{data,legAssignments,0,fulfilmentPartnerId}' from refs where name='partner-plan'),
 pg_temp.id('partner')::text,'Partner: canonical assignment FK is returned in native output');
select is((select value->>'version' from refs where name='partner-plan'),'2','Partner: plan revision increments');
select is(pg_temp.w('plans.partner',jsonb_build_object('schemaVersion','2.0','expectedVersion',1,
 'note','Assign actual carrier partner','evidence',pg_temp.ev(),'partnerId',pg_temp.id('partner')),
 pg_temp.ctx(null,null,(select (value#>>'{data,legAssignments,0,id}')::uuid from refs where name='plan'),pg_temp.id('plan')),
 pg_temp.id('partner-key')),(select value from refs where name='partner-plan'),'Partner: identical retry preserves original plan revision');
insert into refs values('expired-partner',public.command_v2_catalog('c2300000-0000-4000-8000-000000000001',
 'c2320000-0000-4000-8000-000000000001','partners','c2340000-0000-4000-8000-000000000001',null,null,
 gen_random_uuid(),null,jsonb_build_object('schemaVersion','2.0','registeredName','Expired QA partner',
 'partnerCarrierRef',null,'agreementValidFrom','2020-01-01T00:00:00Z','agreementValidUntil','2020-02-01T00:00:00Z',
 'status','ACTIVE','coverageEvidence','fixture:expired-partner'))->'record');
select throws_ok($$select pg_temp.w('plans.partner',jsonb_build_object('schemaVersion','2.0','expectedVersion',2,
 'note','Expired partner attempt','evidence',pg_temp.ev(),'partnerId',pg_temp.id('expired-partner')),
 pg_temp.ctx(null,null,(select (value#>>'{data,legAssignments,0,id}')::uuid from refs where name='plan'),pg_temp.id('plan')))$$,
 'PT409','PARTNER_AGREEMENT_REQUIRED','Partner: agreement must cover the whole leg window');
insert into refs values('foreign-partner',public.command_v2_catalog('c2300000-0000-4000-8000-000000000001',
 'c2320000-0000-4000-8000-000000000001','partners','c2390000-0000-4000-8000-000000000001',null,null,
 gen_random_uuid(),null,jsonb_build_object('schemaVersion','2.0','registeredName','Foreign QA partner',
 'partnerCarrierRef',null,'agreementValidFrom','2020-01-01T00:00:00Z','agreementValidUntil','2030-01-01T00:00:00Z',
 'status','ACTIVE','coverageEvidence','fixture:foreign-partner'))->'record');
select throws_ok($$select pg_temp.w('plans.partner',jsonb_build_object('schemaVersion','2.0','expectedVersion',2,
 'note','Foreign partner attempt','evidence',pg_temp.ev(),'partnerId',pg_temp.id('foreign-partner')),
 pg_temp.ctx(null,null,(select (value#>>'{data,legAssignments,0,id}')::uuid from refs where name='plan'),pg_temp.id('plan')))$$,
 'PT400','PARTNER_SERVICE_MISMATCH','Partner: carrier must own the service of the assignment');
select throws_ok($$select pg_temp.w('plans.partner',jsonb_build_object('schemaVersion','2.0',
 'expectedVersion',1,'note','Stale assignment change','evidence',pg_temp.ev(),'partnerId',null),
 pg_temp.ctx(null,null,(select (value#>>'{data,legAssignments,0,id}')::uuid from refs where name='plan'),pg_temp.id('plan')))$$,
 'PT409','STALE_DRAFT','Partner: stale plan version cannot change responsibility');
insert into refs select 'assignment',jsonb_build_object('id',value#>>'{data,legAssignments,0,id}') from refs where name='plan';
select pg_temp.save('opportunity','opportunities.create',jsonb_build_object('schemaVersion','2.0','planId',pg_temp.id('plan'),'carrierId','c2340000-0000-4000-8000-000000000001','assignmentIds',jsonb_build_array(pg_temp.id('assignment')),'responseDeadline',now()+interval '2 hours','responseChannel','MANUAL'),pg_temp.ctx(pg_temp.id('request')));
select is((select value->>'status' from refs where name='opportunity'),'SENT','invitation emitted without fabricating offer');
select public.command_v2_catalog('c2300000-0000-4000-8000-000000000001',
 'c2320000-0000-4000-8000-000000000001','partners','c2340000-0000-4000-8000-000000000001',null,
 pg_temp.id('partner'),gen_random_uuid(),1,jsonb_build_object('schemaVersion','2.0',
 'registeredName','Model QA partner','partnerCarrierRef',null,'agreementValidFrom','2020-01-01T00:00:00Z',
 'agreementValidUntil','2030-01-01T00:00:00Z','status','INACTIVE','coverageEvidence','fixture:partner-agreement'));
select throws_ok($$select pg_temp.w('offers.create',jsonb_build_object('schemaVersion','2.0','carrierReference','QA-OFFER','planCandidateId',pg_temp.id('plan'),'coveredServiceIds',jsonb_build_array('c2360000-0000-4000-8000-000000000001'),'coveredAssignmentIds',jsonb_build_array(pg_temp.id('assignment')),'price',jsonb_build_object('amount',100,'currency','USD'),'breakdown',jsonb_build_array(jsonb_build_object('kind','TRANSPORT','amount',jsonb_build_object('amount',100,'currency','USD'),'treatment','QUOTED','source',pg_temp.ev(),'observedAt','2020-01-01T00:00:00Z','details',null)),'validity',jsonb_build_object('startsAt',now()-interval '1 hour','endsAt',now()+interval '8 hours'),'source',jsonb_build_object('channel','MANUAL','evidence',pg_temp.ev()),'issuedAt',now(),'estimatedPickupAt',null,'estimatedDeliveryAt',null,'transitDurationSeconds',3600,'reservableCapacity',jsonb_build_object('weightKg',1000,'volumeM3',2),'commercialTerms','[]'::jsonb,'evidence',jsonb_build_array(pg_temp.ev()),'supersedesOfferId',null),pg_temp.ctx(null,'c2340000-0000-4000-8000-000000000001',pg_temp.id('opportunity')));$$,'PT409','PARTNER_AGREEMENT_REQUIRED','Partner: revoked agreement blocks commercial commit');
select public.command_v2_catalog('c2300000-0000-4000-8000-000000000001',
 'c2320000-0000-4000-8000-000000000001','partners','c2340000-0000-4000-8000-000000000001',null,
 pg_temp.id('partner'),gen_random_uuid(),2,jsonb_build_object('schemaVersion','2.0',
 'registeredName','Model QA partner','partnerCarrierRef',null,'agreementValidFrom','2020-01-01T00:00:00Z',
 'agreementValidUntil','2030-01-01T00:00:00Z','status','ACTIVE','coverageEvidence','fixture:partner-agreement'));
select pg_temp.save('offer','offers.create',jsonb_build_object('schemaVersion','2.0','carrierReference','QA-OFFER','planCandidateId',pg_temp.id('plan'),'coveredServiceIds',jsonb_build_array('c2360000-0000-4000-8000-000000000001'),'coveredAssignmentIds',jsonb_build_array(pg_temp.id('assignment')),'price',jsonb_build_object('amount',100,'currency','USD'),'breakdown',jsonb_build_array(jsonb_build_object('kind','TRANSPORT','amount',jsonb_build_object('amount',100,'currency','USD'),'treatment','QUOTED','source',pg_temp.ev(),'observedAt','2020-01-01T00:00:00Z','details',null)),'validity',jsonb_build_object('startsAt',now()-interval '1 hour','endsAt',now()+interval '8 hours'),'source',jsonb_build_object('channel','MANUAL','evidence',pg_temp.ev()),'issuedAt',now(),'estimatedPickupAt',null,'estimatedDeliveryAt',null,'transitDurationSeconds',3600,'reservableCapacity',jsonb_build_object('weightKg',1000,'volumeM3',2),'commercialTerms','[]'::jsonb,'evidence',jsonb_build_array(pg_temp.ev()),'supersedesOfferId',null),pg_temp.ctx(null,'c2340000-0000-4000-8000-000000000001',pg_temp.id('opportunity')));
select is(jsonb_array_length(public.read_v2_workflow('c2300000-0000-4000-8000-000000000001','c2320000-0000-4000-8000-000000000001','offers',pg_temp.ctx(pg_temp.id('request')),100,0)),1,'Partner: failed offer left no partial row');
select is((select value#>>'{data,source,issuerId}' from refs where name='offer'),'c2320000-0000-4000-8000-000000000001','issuer resolved from authenticated actor');
select pg_temp.save('scorepolicy','scoring-policies.publish',jsonb_build_object('schemaVersion','2.0','active',true,'policy',jsonb_build_object('version','QA-1','objective','LOWEST_COST','weights',jsonb_build_object('cost',1,'transit',0,'reliability',0),'missingDataRule','EXCLUDE','tieBreaker','OFFER_ID_ASC')));
select pg_temp.save('ranking','ranking.create',jsonb_build_object('schemaVersion','2.0','policyId',pg_temp.id('scorepolicy')),pg_temp.ctx(pg_temp.id('request')));
select is((select value#>>'{data,options,0,position}' from refs where name='ranking'),'1','ranking materialized with policy and explanation');
select pg_temp.save('decision','decisions.create',jsonb_build_object('schemaVersion','2.0','planId',pg_temp.id('plan'),'selectedOfferIds',jsonb_build_array(pg_temp.id('offer')),'rationale','QA authorized choice','policyId',pg_temp.id('scorepolicy'),'consideredOfferIds',jsonb_build_array(pg_temp.id('offer')),'evidence',jsonb_build_array(pg_temp.ev())),pg_temp.ctx(pg_temp.id('request')));
select pg_temp.save('booking','bookings.create',jsonb_build_object('schemaVersion','2.0','decisionId',pg_temp.id('decision'),'offerId',pg_temp.id('offer'),'authorization','AUTHORIZE','evidence',pg_temp.ev()));
select is((select value->>'status' from refs where name='booking'),'AUTHORIZED','shipper authorizes without pretending carrier confirmation');
select pg_temp.save('execution','executions.create',jsonb_build_object('schemaVersion','2.0','bookingId',pg_temp.id('booking'),'serviceId','c2360000-0000-4000-8000-000000000001'));
select is((select value->>'status' from refs where name='execution'),'PLANNED','execution linked to actual booked service');
select throws_ok($$select pg_temp.w('holds.create',jsonb_build_object('schemaVersion','2.0','bookingId',pg_temp.id('booking'),'assignmentId',pg_temp.id('assignment'),'expiresAt',now()+interval '1 hour','evidence',pg_temp.ev()))$$,'PT409','PLAN_RESOURCE_REQUIRED','F05: multi-resource hold requires explicit resource');
select pg_temp.save('hold','holds.create',jsonb_build_object('schemaVersion','2.0','bookingId',pg_temp.id('booking'),'assignmentId',pg_temp.id('assignment'),'planResourceId',(select value#>'{data,assignments,0,resourceId}' from refs where name='plan'),'expiresAt',now()+interval '1 hour','evidence',pg_temp.ev()));
select lives_ok($$select pg_temp.w('holds.confirm',jsonb_build_object('schemaVersion','2.0','expectedVersion',1,'note','F05 first resource','evidence',pg_temp.ev()),pg_temp.ctx(null,'c2340000-0000-4000-8000-000000000001',null,pg_temp.id('hold')))$$,'F05: first resource confirms');
select throws_ok($$select pg_temp.w('bookings.confirm',jsonb_build_object('schemaVersion','2.0','expectedVersion',1,'note','F05 incomplete','evidence',pg_temp.ev(),'carrierReference','F05','confirmation','CONFIRMED'),pg_temp.ctx(null,'c2340000-0000-4000-8000-000000000001',null,pg_temp.id('booking')))$$,'PT409','CAPACITY_COMMITMENT_REQUIRED','F05: partial resource commitment cannot confirm booking');
select pg_temp.save('aux-hold','holds.create',jsonb_build_object('schemaVersion','2.0','bookingId',pg_temp.id('booking'),'assignmentId',pg_temp.id('assignment'),'planResourceId',(select value#>'{data,assignments,1,resourceId}' from refs where name='plan'),'expiresAt',now()+interval '1 hour','evidence',pg_temp.ev()));
select lives_ok($$select pg_temp.w('holds.confirm',jsonb_build_object('schemaVersion','2.0','expectedVersion',1,'note','F05 escort','evidence',pg_temp.ev()),pg_temp.ctx(null,'c2340000-0000-4000-8000-000000000001',null,pg_temp.id('aux-hold')))$$,'F05: auxiliary resource confirms independently');
select lives_ok($$select pg_temp.w('bookings.confirm',jsonb_build_object('schemaVersion','2.0','expectedVersion',1,'note','F05 complete','evidence',pg_temp.ev(),'carrierReference','F05','confirmation','CONFIRMED'),pg_temp.ctx(null,'c2340000-0000-4000-8000-000000000001',null,pg_temp.id('booking')))$$,'F05: booking requires and accepts both resources');
select pg_temp.save('condition','conditions.publish',jsonb_build_object('schemaVersion','2.0','active',true,
 'corridorId',pg_temp.id('corridor'),'kind','CLOSURE','location',(select value#>'{data,origin}' from refs where name='route'),
 'observedAt',now()-interval '1 minute','validUntil',now()+interval '1 day','source',pg_temp.ev(),'confidence','SIMULATED'));
select pg_temp.save('incident','incidents.create',jsonb_build_object('schemaVersion','2.0','kind','ROAD_CLOSURE','severity','WARNING',
 'occurredAt',now(),'location',null,'description','Synthetic route closure','evidence',jsonb_build_array(pg_temp.ev())),
 pg_temp.ctx(null,'c2340000-0000-4000-8000-000000000001',pg_temp.id('execution')));
select pg_temp.save('linked-incident','incidents.conditions',jsonb_build_object('schemaVersion','2.0','expectedVersion',1,
 'note','Correlate condition on execution route','evidence',pg_temp.ev(),'conditionIds',jsonb_build_array(pg_temp.id('condition'))),
 pg_temp.ctx(null,'c2340000-0000-4000-8000-000000000001',null,pg_temp.id('incident')));
select is((select value#>'{data,routeConditionIds}' from refs where name='linked-incident'),
 jsonb_build_array(pg_temp.id('condition')),'Incident: canonical bridge is exposed by authenticated native output');
select throws_ok($$select pg_temp.w('incidents.conditions',jsonb_build_object('schemaVersion','2.0','expectedVersion',2,
 'note','Unknown condition','evidence',pg_temp.ev(),'conditionIds',jsonb_build_array(gen_random_uuid())),
 pg_temp.ctx(null,'c2340000-0000-4000-8000-000000000001',null,pg_temp.id('incident')))$$,
 'PT400','INCIDENT_CONDITION_ROUTE_MISMATCH','Incident: foreign/unknown condition is rejected atomically');
select is((public.read_v2_workflow('c2300000-0000-4000-8000-000000000001','c2320000-0000-4000-8000-000000000001',
 'incidents',pg_temp.ctx(null,'c2340000-0000-4000-8000-000000000001',null,pg_temp.id('incident')),100,0)->0)#>'{data,routeConditionIds}',
 jsonb_build_array(pg_temp.id('condition')),'Incident: failed replacement rolls back the original association');
insert into refs values('replan',public.command_v2_route_planner('c2300000-0000-4000-8000-000000000001',
 'c2320000-0000-4000-8000-000000000001','replan',pg_temp.id('route'),gen_random_uuid(),
 jsonb_build_object('schemaVersion','2.0','expectedVersion',1,'conditionId',pg_temp.id('condition'),'maxLegs',2,'maxAlternatives',10)));
select is((select value#>>'{result,decision,requiresSelection}' from refs where name='replan'),'true',
 'RoutePlanner: replan proposes snapshots without selecting or changing bookings');
select is((select value#>>'{result,decision,action}' from refs where name='replan'),'PROPOSE_ALTERNATIVE',
 'RoutePlanner: a verified alternative is proposed after direct corridor closes');
select is((select value#>'{result,alternatives,0,data,corridorIds}' from refs where name='replan'),
 jsonb_build_array(pg_temp.id('first-alternative'),pg_temp.id('second-alternative')),
 'RoutePlanner: current closure does not block the independent two-leg itinerary');
select isnt((select value#>>'{result,search,graphVersion}' from refs where name='search'),
 (select value#>>'{result,search,graphVersion}' from refs where name='replan'),
 'RoutePlanner: condition publication changes the evaluated graph fingerprint');
select ok((select exists(select 1 from jsonb_array_elements(value#>'{result,alternatives}') r
 where r->>'status'='ineligible' and (r#>'{data,reasons}') ? 'ROUTE_CLOSED') from refs where name='replan'),
 'RoutePlanner: current condition is evaluated and explained');
select throws_ok($$select public.command_v2_route_planner('c2300000-0000-4000-8000-000000000001',
 'c2320000-0000-4000-8000-000000000001','replan',pg_temp.id('route'),gen_random_uuid(),
 jsonb_build_object('schemaVersion','2.0','expectedVersion',99,'conditionId',pg_temp.id('condition'),'maxLegs',2,'maxAlternatives',10))$$,
 'PT409','STALE_DRAFT','RoutePlanner: stale route version cannot request a new decision');
select is(current_user::text,'authenticated','F05: deferred verification retains the real caller role');
select lives_ok($$set constraints all immediate$$,'F05: authenticated command reaches deferred constraint verification');
set constraints all deferred;
reset role;
select ok((select relrowsecurity from pg_class where oid='public.incident_route_conditions'::regclass),
 'Incident: association bridge enables RLS');
select ok(not has_table_privilege('authenticated','public.incident_route_conditions','INSERT'),
 'Incident: clients cannot bypass the authorized association command');
select ok(not has_function_privilege('anon','public.command_v2_route_planner(uuid,uuid,text,uuid,uuid,jsonb)','EXECUTE'),
 'RoutePlanner: anonymous users cannot search tenant requests');
select isnt(private.workflow_planner_snapshot((select value->'data' from refs where name='route')),
 private.workflow_planner_snapshot(jsonb_set((select value->'data' from refs where name='route'),
 '{policyVersion}','999'::jsonb)),'RoutePlanner: policy revision changes graph fingerprint');
select isnt(private.workflow_planner_snapshot((select value->'data' from refs where name='route')),
 private.workflow_planner_snapshot(jsonb_set((select value->'data' from refs where name='route'),
 '{legs,0,corridorVersion}','999'::jsonb)),'RoutePlanner: corridor revision changes graph fingerprint');
select is((select count(*)::integer from public.capacity_reservations where booking_id=pg_temp.id('booking') and plan_resource_id is not null and plan_leg_assignment_id=pg_temp.id('assignment')),2,'F05: reservations have direct resource and canonical assignment FKs');
select is((select count(*)::integer from public.plan_leg_assignments where plan_id=pg_temp.id('plan') and data ? 'capacityNeeded'),1,'F05: UML assignment attributes persisted');
select ok((select relrowsecurity from pg_class where oid='public.plan_leg_assignments'::regclass),'F05: canonical assignments enable RLS');
select ok(not has_table_privilege('authenticated','public.plan_leg_assignments','INSERT'),'F05: clients cannot bypass canonical commands');
select throws_ok($$insert into public.transport_plan_candidates(id,organization_id,freight_request_id,route_plan_id,request_version,status,data)
 select gen_random_uuid(),organization_id,freight_request_id,route_plan_id,request_version,status,data from public.transport_plan_candidates where id=pg_temp.id('plan')$$,'23505',null,'F05: database prevents two candidates owning one route');
select throws_ok($$update public.capacity_reservations set plan_resource_id=gen_random_uuid() where id=pg_temp.id('hold')$$,'PT400','RESOURCE_ASSIGNMENT_MISMATCH','F05: reservation cannot substitute another plan resource');
-- F-02 documents the physical catalog, distinct from authenticated native commands.
-- These postgres probes do not certify a client bypass or weaken workflow guarantees.
select throws_ok($$update public.capacity_reservations set plan_assignment_id=null where id=pg_temp.id('hold')$$,
 'PT400','RESOURCE_ASSIGNMENT_MISMATCH','F02: resource and leg IDs cannot remain without a binding');
select lives_ok($$update public.capacity_reservations set plan_assignment_id=null,
 plan_resource_id=null,plan_leg_assignment_id=null where id=pg_temp.id('hold'); set constraints all immediate$$,
 'F02: physical catalog permits all three NULL even on a confirmed reservation');
select is((select status::text from public.capacity_reservations where id=pg_temp.id('hold')),
 'CONFIRMED','F02: NULL permission is not limited to pre-plan holds at table level');
create function pg_temp.empty_assignment() returns void language plpgsql as $$begin
 insert into public.plan_leg_assignments(id,plan_id,route_leg_id,carrier_service_id,lane_id,sequence,starts_at,ends_at)
 select gen_random_uuid(),plan_id,route_leg_id,carrier_service_id,lane_id,sequence,starts_at,ends_at from public.plan_leg_assignments where id=pg_temp.id('assignment');
 set constraints all immediate;
end;$$;
select throws_ok($$select pg_temp.empty_assignment()$$,'23514','ASSIGNMENT_REQUIRES_RESOURCES','F05: zero-resource assignment cannot survive constraint verification');
set constraints all immediate;
select pass('F05: valid grouped assignment satisfies deferred constraints');

-- QA B01/B02: restore the caller after privileged physical-schema assertions above.
set local role authenticated;
set local "request.jwt.claims"='{"sub":"c2310000-0000-4000-8000-000000000001","role":"authenticated"}';
select is(current_user::text,'authenticated','T01: B01/B02 starts under the real caller role');
-- QA B01/B02: authenticated commands reach real deferred constraint evaluation.
insert into refs values('limited',public.command_v2_route_planner('c2300000-0000-4000-8000-000000000001',
 'c2320000-0000-4000-8000-000000000001','find',pg_temp.id('request'),gen_random_uuid(),
 jsonb_build_object('schemaVersion','2.0','policyId',pg_temp.id('policy'),'expectedDraftVersion',2,'maxLegs',2,'maxAlternatives',1)));
select is((select jsonb_array_length(value#>'{result,alternatives}') from refs where name='limited'),1,'B01: maxAlternatives=1 succeeds without deleting immutable history');
select throws_ok($$select public.command_v2_route_planner('c2300000-0000-4000-8000-000000000001',
 'c2320000-0000-4000-8000-000000000001','find',pg_temp.id('request'),gen_random_uuid(),
 jsonb_build_object('schemaVersion','2.0','policyId',pg_temp.id('policy'),'expectedDraftVersion',99,'maxLegs',2,'maxAlternatives',1))$$,
 'PT409','STALE_DRAFT','find rejects a stale request version');
select throws_ok($$select public.command_v2_route_planner('c2300000-0000-4000-8000-000000000001',
 'c2320000-0000-4000-8000-000000000001','find',pg_temp.id('request'),gen_random_uuid(),
 jsonb_build_object('schemaVersion','2.0','policyId',pg_temp.id('policy'),'maxLegs',2,'maxAlternatives',1))$$,
 'PT400','VALIDATION_ERROR','find requires the expected request version');
select pg_temp.save('payload-corridor','corridors.publish',(select value->'data' from refs where name='corridor')||jsonb_build_object('payloadLimitKg',100));
select pg_temp.save('overweight-route','routes.create',jsonb_build_object('schemaVersion','2.0','corridorIds',jsonb_build_array(pg_temp.id('payload-corridor')),'policyId',pg_temp.id('policy')),pg_temp.ctx(pg_temp.id('request')));
select is((select value->>'status' from refs where name='overweight-route'),'ineligible','B02: 1000kg exceeds corridor 100kg');
select ok((select value#>'{data,reasons}' ? 'ROUTE_PAYLOAD_LIMIT_EXCEEDED' from refs where name='overweight-route'),'B02: overweight reason is explicit');
select pg_temp.save('payload-equal','corridors.publish',jsonb_build_object('expectedVersion',1,'value',
 (select value->'data' from refs where name='corridor')||jsonb_build_object('payloadLimitKg',1000)),pg_temp.ctx(null,null,null,pg_temp.id('payload-corridor')));
select pg_temp.save('equal-route','routes.create',jsonb_build_object('schemaVersion','2.0','corridorIds',jsonb_build_array(pg_temp.id('payload-corridor')),'policyId',pg_temp.id('policy')),pg_temp.ctx(pg_temp.id('request')));
select is((select value->>'status' from refs where name='equal-route'),'eligible','B02: exact payload limit positive control is eligible');
select pg_temp.save('payload-unknown','corridors.publish',jsonb_build_object('expectedVersion',2,'value',
 (select value->'data' from refs where name='corridor')||jsonb_build_object('payloadLimitKg',null)),pg_temp.ctx(null,null,null,pg_temp.id('payload-corridor')));
select pg_temp.save('unknown-route','routes.create',jsonb_build_object('schemaVersion','2.0','corridorIds',jsonb_build_array(pg_temp.id('payload-corridor')),'policyId',pg_temp.id('policy')),pg_temp.ctx(pg_temp.id('request')));
select ok((select value#>'{data,reasons}' ? 'ROUTE_PAYLOAD_LIMIT_UNKNOWN' and value->>'status'<>'eligible' from refs where name='unknown-route'),'B02: missing limit cannot become eligible');
set constraints all immediate;
select is(current_user::text,'authenticated','T01: deferred B01/B02 verification retains authenticated');
select pass('B01/B02: constraints evaluated as authenticated without reset role');

select * from finish();rollback;

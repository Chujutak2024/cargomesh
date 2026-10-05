-- Synthetic fixtures and grants are rolled back. Never provisions hosted identities.
begin;
set local search_path=extensions,public;
select no_plan();
create temporary table fleet_inputs(kind text primary key,value jsonb);
create temporary table fleet_saved(kind text primary key,id uuid,key uuid,receipt jsonb);
grant all on fleet_inputs,fleet_saved to authenticated;
insert into fleet_inputs values('capability-definitions','{"schemaVersion": "2.0", "serviceId": "c2360000-0000-4000-8000-000000000001", "categoryId": "c0000000-0000-0000-0000-000000000001", "requirements": [], "maxWeightKg": 8000, "temperatureRange": null, "certifications": ["QA_CERT"], "evidence": "fixture:inspection", "verifiedAt": "2026-01-01T00:00:00Z", "validUntil": "2027-03-01T00:00:00Z", "active": true}'::jsonb);
insert into fleet_inputs values('assets','{"schemaVersion": "2.0", "serviceId": "c2360000-0000-4000-8000-000000000001", "code": "FLEET_QA", "mode": "ROAD", "equipmentType": "BOX_TRUCK", "role": "LOAD_BEARING", "usefulCapacityKg": 10000, "usableVolumeM3": 40, "operatingStatus": "AVAILABLE", "homeDepotId": "c2350000-0000-4000-8000-000000000001", "provenance": "OWN", "partnerId": null, "evidence": "fixture:asset", "roadVehicle": {"plate": "QA-001", "registrationCode": "QA-REG", "registeredAt": "2026-01-01", "brand": "Synthetic", "model": "Test", "variant": null, "bodyType": "BOX", "usableDimensions": {"length": 500, "width": 240, "height": 250}, "grossWeightLimitKg": 15000, "odometerKm": 5000, "conditionReason": null, "axleConfig": "2S1"}}'::jsonb);
insert into fleet_inputs values('capacity-pools','{"schemaVersion": "2.0", "serviceId": "c2360000-0000-4000-8000-000000000001", "code": "POOL_QA", "mode": "ROAD", "equipmentType": "BOX_TRUCK", "serviceWindow": {"startsAt": "2027-01-01T00:00:00Z", "endsAt": "2027-02-01T00:00:00Z"}, "declaredCapacity": {"weightKg": 10000, "volumeM3": 40}, "provenance": "CONTRACTED", "partnerId": null, "evidence": "fixture:agreement", "supportedCargoCategoryIds": ["c0000000-0000-0000-0000-000000000001"], "active": true}'::jsonb);
insert into fleet_inputs values('calendars','{"schemaVersion": "2.0", "serviceId": "c2360000-0000-4000-8000-000000000001", "assetId": "ASSET", "capacityPoolId": null, "timezone": "America/Lima", "horizon": {"startsAt": "2027-01-01T00:00:00Z", "endsAt": "2027-02-01T00:00:00Z"}, "source": "fixture:calendar", "lastVerifiedAt": "2026-01-01T00:00:00Z", "freshness": "SIMULATED", "validUntil": "2027-03-01T00:00:00Z", "complete": true, "availableWindows": [{"startsAt": "2027-01-01T00:00:00Z", "endsAt": "2027-02-01T00:00:00Z"}], "readyPickupAreaId": "c2370000-0000-4000-8000-000000000001"}'::jsonb);
insert into fleet_inputs values('maintenances','{"schemaVersion": "2.0", "serviceId": "c2360000-0000-4000-8000-000000000001", "assetId": "ASSET", "blockedWindow": {"startsAt": "2027-01-10T00:00:00Z", "endsAt": "2027-01-11T00:00:00Z"}, "kind": "PREVENTIVE", "status": "SCHEDULED", "source": "fixture:work-order", "reason": "Synthetic preventive inspection"}'::jsonb);
insert into fleet_inputs values('repositioning-blocks','{"schemaVersion": "2.0", "serviceId": "c2360000-0000-4000-8000-000000000001", "calendarId": "CALENDAR", "occupiedWindow": {"startsAt": "2027-01-12T00:00:00Z", "endsAt": "2027-01-13T00:00:00Z"}, "origin": {"label": "Synthetic Lima", "countryCode": "PE", "region": "LIM", "city": "Lima", "lat": -12, "lng": -77}, "nextPickup": {"label": "Synthetic Lima", "countryCode": "PE", "region": "LIM", "city": "Lima", "lat": -12, "lng": -77}, "estimatedTravelSeconds": 3600, "status": "PLANNED", "source": "fixture:dispatch", "reason": "Synthetic positioning"}'::jsonb);
insert into fleet_inputs values('asset-capabilities','{"schemaVersion": "2.0", "serviceId": "c2360000-0000-4000-8000-000000000001", "assetId": "ASSET", "categoryId": "c0000000-0000-0000-0000-000000000001", "temperatureRange": null, "certifications": ["QA_CERT"], "evidence": "fixture:inspection", "verifiedAt": "2026-01-01T00:00:00Z", "validUntil": "2027-03-01T00:00:00Z", "active": true, "definitionId": "DEFINITION"}'::jsonb);
create function pg_temp.fleet_cmd(k text,i uuid,key uuid,v integer,body jsonb) returns jsonb language sql as $$
select public.command_v2_catalog('c2300000-0000-4000-8000-000000000001','c2320000-0000-4000-8000-000000000001',k,'c2340000-0000-4000-8000-000000000001',null,i,key,v,body);$$;
create function pg_temp.fleet_read(k text,i uuid) returns jsonb language sql as $$
select public.read_v2_catalog('c2300000-0000-4000-8000-000000000001','c2320000-0000-4000-8000-000000000001',k,'c2340000-0000-4000-8000-000000000001',null,i,100,0);$$;
set local role anon;
select throws_ok($$select pg_temp.fleet_cmd('assets',null,gen_random_uuid(),null,'{}')$$,'42501',null,'anonymous denied');
reset role;
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"c2310000-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok($$select pg_temp.fleet_cmd('assets',null,gen_random_uuid(),null,(select value from fleet_inputs where kind='assets'))$$,'PT403','FORBIDDEN_CATALOG','shipper cannot publish fleet');
select throws_ok($$select pg_temp.fleet_read('assets',null)$$,'PT403','FORBIDDEN_CATALOG','shipper cannot read operational fleet');
reset role;
insert into private.v2_catalog_grants(auth_user_id,carrier_id,permission) values('c2310000-0000-4000-8000-000000000001','c2340000-0000-4000-8000-000000000001','CARRIER_EDITOR');
set local role authenticated;
with keys as materialized(select gen_random_uuid() key),saved as materialized(select key,pg_temp.fleet_cmd('capability-definitions',null,key,null,(select value from fleet_inputs where kind='capability-definitions')) r from keys)
insert into fleet_saved select 'capability-definitions',(r#>>'{record,id}')::uuid,key,r from saved;
select is((select receipt#>>'{record,version}' from fleet_saved where kind='capability-definitions'),'1','capability-definitions: create');
select is((select pg_temp.fleet_cmd('capability-definitions',null,key,null,(select value from fleet_inputs where kind='capability-definitions'))->>'replay' from fleet_saved where kind='capability-definitions'),'true','capability-definitions: creation replay');
select is((pg_temp.fleet_read('capability-definitions',(select id from fleet_saved where kind='capability-definitions'))#>>'{0,carrierId}'),'c2340000-0000-4000-8000-000000000001','capability-definitions: scoped read');
select is((select pg_temp.fleet_cmd('capability-definitions',id,gen_random_uuid(),1,(select value from fleet_inputs where kind='capability-definitions'))#>>'{record,version}' from fleet_saved where kind='capability-definitions'),'2','capability-definitions: revision');
select throws_ok($$select pg_temp.fleet_cmd('capability-definitions',id,gen_random_uuid(),1,(select value from fleet_inputs where kind='capability-definitions')) from fleet_saved where kind='capability-definitions'$$,'PT409','STALE_DRAFT','capability-definitions: stale rejected');
select throws_ok($$select pg_temp.fleet_cmd('capability-definitions',null,key,null,(select value||'{"rogue":true}'::jsonb from fleet_inputs where kind='capability-definitions')) from fleet_saved where kind='capability-definitions'$$,'PT400','VALIDATION_ERROR','capability-definitions: SQL rejects extra fields');
select is((select pg_temp.fleet_cmd('capability-definitions',null,key,null,(select value from fleet_inputs where kind='capability-definitions'))#>>'{record,version}' from fleet_saved where kind='capability-definitions'),'1','capability-definitions: receipt stable after revisions');
with keys as materialized(select gen_random_uuid() key),saved as materialized(select key,pg_temp.fleet_cmd('assets',null,key,null,(select value from fleet_inputs where kind='assets')) r from keys)
insert into fleet_saved select 'assets',(r#>>'{record,id}')::uuid,key,r from saved;
select is((select receipt#>>'{record,version}' from fleet_saved where kind='assets'),'1','assets: create');
select throws_ok($$select pg_temp.fleet_cmd('assets',null,gen_random_uuid(),null,
 jsonb_set((select value from fleet_inputs where kind='assets'),'{roadVehicle,bodyType}','null'))$$,
 'PT400','VALIDATION_ERROR','CP-1: native command rejects NULL required body type');
select throws_ok($$select pg_temp.fleet_cmd('assets',null,gen_random_uuid(),null,
 jsonb_set((select value from fleet_inputs where kind='assets'),'{roadVehicle,plate}','null'))$$,
 'PT400','VALIDATION_ERROR','CP-1: native command rejects NULL required plate');
select throws_ok($$select pg_temp.fleet_cmd('assets',null,gen_random_uuid(),null,
 jsonb_set((select value from fleet_inputs where kind='assets'),'{usefulCapacityKg}','null'))$$,
 'PT400','VALIDATION_ERROR','CP-1: native command rejects unknown mandatory carrying capacity');
select is(pg_temp.fleet_read('assets',(select id from fleet_saved where kind='assets'))#>>'{0,value,roadVehicle,bodyType}',
 'BOX','CP-1: valid body type survives authenticated create and GET');
select is(pg_temp.fleet_cmd('assets',null,gen_random_uuid(),null,(select value from fleet_inputs where kind='assets')
 ||'{"code":"CP1_ESCORT","role":"AUXILIARY","usefulCapacityKg":0,"usableVolumeM3":null}')#>>'{record,value,usefulCapacityKg}',
 '0','CP-1: auxiliary capacity projects zero without contributing cargo capacity');
select is((select pg_temp.fleet_cmd('assets',null,key,null,(select value from fleet_inputs where kind='assets'))->>'replay' from fleet_saved where kind='assets'),'true','assets: creation replay');
select is((pg_temp.fleet_read('assets',(select id from fleet_saved where kind='assets'))#>>'{0,carrierId}'),'c2340000-0000-4000-8000-000000000001','assets: scoped read');
select is((select pg_temp.fleet_cmd('assets',id,gen_random_uuid(),1,(select value from fleet_inputs where kind='assets'))#>>'{record,version}' from fleet_saved where kind='assets'),'2','assets: revision');
select throws_ok($$select pg_temp.fleet_cmd('assets',id,gen_random_uuid(),1,(select value from fleet_inputs where kind='assets')) from fleet_saved where kind='assets'$$,'PT409','STALE_DRAFT','assets: stale rejected');
select throws_ok($$select pg_temp.fleet_cmd('assets',null,key,null,(select value||'{"rogue":true}'::jsonb from fleet_inputs where kind='assets')) from fleet_saved where kind='assets'$$,'PT400','VALIDATION_ERROR','assets: SQL rejects extra fields');
select is((select pg_temp.fleet_cmd('assets',null,key,null,(select value from fleet_inputs where kind='assets'))#>>'{record,version}' from fleet_saved where kind='assets'),'1','assets: receipt stable after revisions');
with keys as materialized(select gen_random_uuid() key),saved as materialized(select key,pg_temp.fleet_cmd('capacity-pools',null,key,null,(select value from fleet_inputs where kind='capacity-pools')) r from keys)
insert into fleet_saved select 'capacity-pools',(r#>>'{record,id}')::uuid,key,r from saved;
select is((select receipt#>>'{record,version}' from fleet_saved where kind='capacity-pools'),'1','capacity-pools: create');
select is((select pg_temp.fleet_cmd('capacity-pools',null,key,null,(select value from fleet_inputs where kind='capacity-pools'))->>'replay' from fleet_saved where kind='capacity-pools'),'true','capacity-pools: creation replay');
select is((pg_temp.fleet_read('capacity-pools',(select id from fleet_saved where kind='capacity-pools'))#>>'{0,carrierId}'),'c2340000-0000-4000-8000-000000000001','capacity-pools: scoped read');
select is((select pg_temp.fleet_cmd('capacity-pools',id,gen_random_uuid(),1,(select value from fleet_inputs where kind='capacity-pools'))#>>'{record,version}' from fleet_saved where kind='capacity-pools'),'2','capacity-pools: revision');
select throws_ok($$select pg_temp.fleet_cmd('capacity-pools',id,gen_random_uuid(),1,(select value from fleet_inputs where kind='capacity-pools')) from fleet_saved where kind='capacity-pools'$$,'PT409','STALE_DRAFT','capacity-pools: stale rejected');
select throws_ok($$select pg_temp.fleet_cmd('capacity-pools',null,key,null,(select value||'{"rogue":true}'::jsonb from fleet_inputs where kind='capacity-pools')) from fleet_saved where kind='capacity-pools'$$,'PT400','VALIDATION_ERROR','capacity-pools: SQL rejects extra fields');
select is((select pg_temp.fleet_cmd('capacity-pools',null,key,null,(select value from fleet_inputs where kind='capacity-pools'))#>>'{record,version}' from fleet_saved where kind='capacity-pools'),'1','capacity-pools: receipt stable after revisions');
update fleet_inputs set value=jsonb_set(value,'{assetId}',to_jsonb((select id::text from fleet_saved where kind='assets'))) where kind='calendars';
with keys as materialized(select gen_random_uuid() key),saved as materialized(select key,pg_temp.fleet_cmd('calendars',null,key,null,(select value from fleet_inputs where kind='calendars')) r from keys)
insert into fleet_saved select 'calendars',(r#>>'{record,id}')::uuid,key,r from saved;
select is((select receipt#>>'{record,version}' from fleet_saved where kind='calendars'),'1','calendars: create');
select is((select pg_temp.fleet_cmd('calendars',null,key,null,(select value from fleet_inputs where kind='calendars'))->>'replay' from fleet_saved where kind='calendars'),'true','calendars: creation replay');
select is((pg_temp.fleet_read('calendars',(select id from fleet_saved where kind='calendars'))#>>'{0,carrierId}'),'c2340000-0000-4000-8000-000000000001','calendars: scoped read');
select is((select pg_temp.fleet_cmd('calendars',id,gen_random_uuid(),1,(select value from fleet_inputs where kind='calendars'))#>>'{record,version}' from fleet_saved where kind='calendars'),'2','calendars: revision');
select throws_ok($$select pg_temp.fleet_cmd('calendars',id,gen_random_uuid(),1,(select value from fleet_inputs where kind='calendars')) from fleet_saved where kind='calendars'$$,'PT409','STALE_DRAFT','calendars: stale rejected');
select throws_ok($$select pg_temp.fleet_cmd('calendars',null,key,null,(select value||'{"rogue":true}'::jsonb from fleet_inputs where kind='calendars')) from fleet_saved where kind='calendars'$$,'PT400','VALIDATION_ERROR','calendars: SQL rejects extra fields');
select is((select pg_temp.fleet_cmd('calendars',null,key,null,(select value from fleet_inputs where kind='calendars'))#>>'{record,version}' from fleet_saved where kind='calendars'),'1','calendars: receipt stable after revisions');
update fleet_inputs set value=jsonb_set(value,'{assetId}',to_jsonb((select id::text from fleet_saved where kind='assets'))) where kind='maintenances';
with keys as materialized(select gen_random_uuid() key),saved as materialized(select key,pg_temp.fleet_cmd('maintenances',null,key,null,(select value from fleet_inputs where kind='maintenances')) r from keys)
insert into fleet_saved select 'maintenances',(r#>>'{record,id}')::uuid,key,r from saved;
select is((select receipt#>>'{record,version}' from fleet_saved where kind='maintenances'),'1','maintenances: create');
select is((select pg_temp.fleet_cmd('maintenances',null,key,null,(select value from fleet_inputs where kind='maintenances'))->>'replay' from fleet_saved where kind='maintenances'),'true','maintenances: creation replay');
select is((pg_temp.fleet_read('maintenances',(select id from fleet_saved where kind='maintenances'))#>>'{0,carrierId}'),'c2340000-0000-4000-8000-000000000001','maintenances: scoped read');
select is((select pg_temp.fleet_cmd('maintenances',id,gen_random_uuid(),1,(select value from fleet_inputs where kind='maintenances'))#>>'{record,version}' from fleet_saved where kind='maintenances'),'2','maintenances: revision');
select throws_ok($$select pg_temp.fleet_cmd('maintenances',id,gen_random_uuid(),1,(select value from fleet_inputs where kind='maintenances')) from fleet_saved where kind='maintenances'$$,'PT409','STALE_DRAFT','maintenances: stale rejected');
select throws_ok($$select pg_temp.fleet_cmd('maintenances',null,key,null,(select value||'{"rogue":true}'::jsonb from fleet_inputs where kind='maintenances')) from fleet_saved where kind='maintenances'$$,'PT400','VALIDATION_ERROR','maintenances: SQL rejects extra fields');
select is((select pg_temp.fleet_cmd('maintenances',null,key,null,(select value from fleet_inputs where kind='maintenances'))#>>'{record,version}' from fleet_saved where kind='maintenances'),'1','maintenances: receipt stable after revisions');
update fleet_inputs set value=jsonb_set(value,'{calendarId}',to_jsonb((select id::text from fleet_saved where kind='calendars'))) where kind='repositioning-blocks';
with keys as materialized(select gen_random_uuid() key),saved as materialized(select key,pg_temp.fleet_cmd('repositioning-blocks',null,key,null,(select value from fleet_inputs where kind='repositioning-blocks')) r from keys)
insert into fleet_saved select 'repositioning-blocks',(r#>>'{record,id}')::uuid,key,r from saved;
select is((select receipt#>>'{record,version}' from fleet_saved where kind='repositioning-blocks'),'1','repositioning-blocks: create');
select is((select pg_temp.fleet_cmd('repositioning-blocks',null,key,null,(select value from fleet_inputs where kind='repositioning-blocks'))->>'replay' from fleet_saved where kind='repositioning-blocks'),'true','repositioning-blocks: creation replay');
select is((pg_temp.fleet_read('repositioning-blocks',(select id from fleet_saved where kind='repositioning-blocks'))#>>'{0,carrierId}'),'c2340000-0000-4000-8000-000000000001','repositioning-blocks: scoped read');
select is((select pg_temp.fleet_cmd('repositioning-blocks',id,gen_random_uuid(),1,(select value from fleet_inputs where kind='repositioning-blocks'))#>>'{record,version}' from fleet_saved where kind='repositioning-blocks'),'2','repositioning-blocks: revision');
select throws_ok($$select pg_temp.fleet_cmd('repositioning-blocks',id,gen_random_uuid(),1,(select value from fleet_inputs where kind='repositioning-blocks')) from fleet_saved where kind='repositioning-blocks'$$,'PT409','STALE_DRAFT','repositioning-blocks: stale rejected');
select throws_ok($$select pg_temp.fleet_cmd('repositioning-blocks',null,key,null,(select value||'{"rogue":true}'::jsonb from fleet_inputs where kind='repositioning-blocks')) from fleet_saved where kind='repositioning-blocks'$$,'PT400','VALIDATION_ERROR','repositioning-blocks: SQL rejects extra fields');
select is((select pg_temp.fleet_cmd('repositioning-blocks',null,key,null,(select value from fleet_inputs where kind='repositioning-blocks'))#>>'{record,version}' from fleet_saved where kind='repositioning-blocks'),'1','repositioning-blocks: receipt stable after revisions');
update fleet_inputs set value=jsonb_set(value,'{definitionId}',to_jsonb((select id::text from fleet_saved where kind='capability-definitions'))) where kind='asset-capabilities';
update fleet_inputs set value=jsonb_set(value,'{assetId}',to_jsonb((select id::text from fleet_saved where kind='assets'))) where kind='asset-capabilities';
with keys as materialized(select gen_random_uuid() key),saved as materialized(select key,pg_temp.fleet_cmd('asset-capabilities',null,key,null,(select value from fleet_inputs where kind='asset-capabilities')) r from keys)
insert into fleet_saved select 'asset-capabilities',(r#>>'{record,id}')::uuid,key,r from saved;
select is((select receipt#>>'{record,version}' from fleet_saved where kind='asset-capabilities'),'1','asset-capabilities: create');
select is((select pg_temp.fleet_cmd('asset-capabilities',null,key,null,(select value from fleet_inputs where kind='asset-capabilities'))->>'replay' from fleet_saved where kind='asset-capabilities'),'true','asset-capabilities: creation replay');
select is((pg_temp.fleet_read('asset-capabilities',(select id from fleet_saved where kind='asset-capabilities'))#>>'{0,carrierId}'),'c2340000-0000-4000-8000-000000000001','asset-capabilities: scoped read');
select is((select pg_temp.fleet_cmd('asset-capabilities',id,gen_random_uuid(),1,(select value from fleet_inputs where kind='asset-capabilities'))#>>'{record,version}' from fleet_saved where kind='asset-capabilities'),'2','asset-capabilities: revision');
select throws_ok($$select pg_temp.fleet_cmd('asset-capabilities',id,gen_random_uuid(),1,(select value from fleet_inputs where kind='asset-capabilities')) from fleet_saved where kind='asset-capabilities'$$,'PT409','STALE_DRAFT','asset-capabilities: stale rejected');
select throws_ok($$select pg_temp.fleet_cmd('asset-capabilities',null,key,null,(select value||'{"rogue":true}'::jsonb from fleet_inputs where kind='asset-capabilities')) from fleet_saved where kind='asset-capabilities'$$,'PT400','VALIDATION_ERROR','asset-capabilities: SQL rejects extra fields');
select is((select pg_temp.fleet_cmd('asset-capabilities',null,key,null,(select value from fleet_inputs where kind='asset-capabilities'))#>>'{record,version}' from fleet_saved where kind='asset-capabilities'),'1','asset-capabilities: receipt stable after revisions');
with saved as materialized(select pg_temp.fleet_cmd('assets',null,gen_random_uuid(),null,jsonb_set(value||'{"code":"FLEET_SECOND"}','{roadVehicle,plate}','"QA-002"')) r from fleet_inputs where kind='assets')
insert into fleet_saved select 'second-asset',(r#>>'{record,id}')::uuid,gen_random_uuid(),r from saved;
select is((select pg_temp.fleet_cmd('asset-capabilities',null,gen_random_uuid(),null,jsonb_set(value,'{assetId}',to_jsonb((select id::text from fleet_saved where kind='second-asset'))))#>>'{record,value,definitionId}' from fleet_inputs where kind='asset-capabilities'),(select id::text from fleet_saved where kind='capability-definitions'),'same capability definition serves another asset');
select throws_ok($$select pg_temp.fleet_cmd('assets',null,gen_random_uuid(),null,value||'{"code":"DUPLICATE_PLATE"}') from fleet_inputs where kind='assets'$$,'23505',null,'same physical plate cannot count as two assets');
select throws_ok($$select pg_temp.fleet_cmd('assets',null,gen_random_uuid(),null,value||'{"role":"AUXILIARY"}') from fleet_inputs where kind='assets'$$,'PT400','VALIDATION_ERROR','auxiliary cannot carry capacity');
select throws_ok($$select pg_temp.fleet_cmd('assets',null,gen_random_uuid(),null,jsonb_set(value,'{serviceId}','"c23a0000-0000-4000-8000-000000000001"')) from fleet_inputs where kind='assets'$$,'PT404','CATALOG_NOT_FOUND','foreign service rejected');
select throws_ok($$select pg_temp.fleet_cmd('assets',null,gen_random_uuid(),null,jsonb_set(value,'{mode}','"AIR"')) from fleet_inputs where kind='assets'$$,'PT400','VALIDATION_ERROR','service mode mismatch rejected');
select throws_ok($$select pg_temp.fleet_cmd('calendars',id,gen_random_uuid(),2,jsonb_set(value,'{timezone}','"Mars/Olympus"')) from fleet_inputs join fleet_saved using(kind) where kind='calendars'$$,'PT400','VALIDATION_ERROR','unknown timezone rejected');
select throws_ok($$select pg_temp.fleet_cmd('calendars',id,gen_random_uuid(),2,jsonb_set(value,'{availableWindows}',value->'availableWindows'||value->'availableWindows')) from fleet_inputs join fleet_saved using(kind) where kind='calendars'$$,'PT400','VALIDATION_ERROR','duplicate availability rejected');
select throws_ok($$select pg_temp.fleet_cmd('calendars',id,gen_random_uuid(),2,jsonb_set(value,'{horizon,endsAt}','"2027-01-15T00:00:00Z"')) from fleet_inputs join fleet_saved using(kind) where kind='calendars'$$,'PT400','VALIDATION_ERROR','availability outside horizon rejected');
select throws_ok($$select pg_temp.fleet_cmd('asset-capabilities',id,gen_random_uuid(),2,jsonb_set(value,'{temperatureRange}','{"minCelsius":10,"maxCelsius":0}')) from fleet_inputs join fleet_saved using(kind) where kind='asset-capabilities'$$,'PT400','VALIDATION_ERROR','inverted temperature rejected');
select throws_ok($$select plate from public.transport_assets$$,'42501',null,'direct plate read forbidden');
select throws_ok($$update public.transport_assets set plate='SPOOF'$$,'42501',null,'direct mutation forbidden');
select throws_ok($$select public.read_v2_catalog('c2300000-0000-4000-8000-000000000001','c2320000-0000-4000-8000-000000000001','assets','c2390000-0000-4000-8000-000000000001',null,null,25,0)$$,'PT403','FORBIDDEN_CATALOG','other carrier read denied');
reset role;
select throws_ok($$insert into public.capacity_reservations(capacity_calendar_id,starts_at,ends_at,status) select id,'2027-01-10T01:00:00Z','2027-01-10T02:00:00Z','HELD' from fleet_saved where kind='calendars'$$,'PT409','FLEET_COMMITMENT_CONFLICT','maintenance blocks hold');
select throws_ok($$insert into public.capacity_reservations(capacity_calendar_id,starts_at,ends_at,status) select id,'2027-01-12T01:00:00Z','2027-01-12T02:00:00Z','HELD' from fleet_saved where kind='calendars'$$,'PT409','FLEET_COMMITMENT_CONFLICT','repositioning blocks hold');
insert into public.capacity_reservations(capacity_calendar_id,starts_at,ends_at,status) select id,'2027-01-20T01:00:00Z','2027-01-20T02:00:00Z','HELD' from fleet_saved where kind='calendars';
set local role authenticated;
select throws_ok($$select pg_temp.fleet_cmd('assets',id,gen_random_uuid(),2,value) from fleet_inputs join fleet_saved using(kind) where kind='assets'$$,'PT409','FLEET_COMMITMENT_CONFLICT','live hold protects resource revisions');
select throws_ok($$select pg_temp.fleet_cmd('maintenances',id,gen_random_uuid(),2,jsonb_set(value,'{blockedWindow}','{"startsAt":"2027-01-20T00:00:00Z","endsAt":"2027-01-21T00:00:00Z"}')) from fleet_inputs join fleet_saved using(kind) where kind='maintenances'$$,'PT409','FLEET_COMMITMENT_CONFLICT','hold blocks overlapping maintenance');
select is((pg_temp.fleet_read('assets',(select id from fleet_saved where kind='assets'))#>>'{0,version}'),'2','failed revision leaves version unchanged');
reset role;
update private.v2_catalog_grants set revoked_at=now() where auth_user_id='c2310000-0000-4000-8000-000000000001';
set local role authenticated;
select throws_ok($$select pg_temp.fleet_read('assets',null)$$,'PT403','FORBIDDEN_CATALOG','revocation takes effect immediately');
select throws_ok($$select pg_temp.fleet_cmd('assets',null,key,null,value) from fleet_inputs join fleet_saved using(kind) where kind='assets'$$,'PT403','FORBIDDEN_CATALOG','revocation checked before replay');
reset role;
insert into public.carrier_services(id,carrier_id,transport_mode,service_type,origin_country,origin_region,destination_country,destination_region,active)
values('d2000000-0000-4000-8000-000000000001','c2340000-0000-4000-8000-000000000001','ROAD','FTL','PE','Lima','PE','Lima',true);
insert into public.transport_assets(carrier_id,carrier_service_id,code,mode,equipment_code)
values('c2340000-0000-4000-8000-000000000001','d2000000-0000-4000-8000-000000000001','MODE_GUARD','ROAD','BOX_TRUCK');
select throws_ok($$update public.carrier_services set transport_mode='AIR' where id='d2000000-0000-4000-8000-000000000001'$$,
 'PT400','FLEET_SERVICE_MODE_MISMATCH','service mode cannot invalidate existing physical fleet');
select * from finish();rollback;

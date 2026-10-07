-- Local scenario and rolled-back grants only; never provisions hosted identities.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path=extensions,public;
select no_plan();
create temporary table cat_inputs(kind text primary key,value jsonb);
create temporary table cat_saved(kind text primary key,id uuid,receipt jsonb,key uuid);
grant all on cat_inputs,cat_saved to authenticated,service_role;
insert into cat_inputs values('preferences','{"schemaVersion": "2.0", "objective": "WEIGHTED", "maximumWaitMinutes": 180, "preferredMode": "ROAD", "preferredEquipment": "REEFER_TRUCK", "usualBudget": {"amount": 1000, "currency": "USD"}, "validUntil": null}'::jsonb);
insert into cat_inputs values('cargo-categories','{"schemaVersion": "2.0", "code": "MINERALS", "name": "Minerals", "guidance": {"recommendedEntryMethods": ["PACKAGES"], "intakeSpecificationSchema": {"fields": []}, "suggestedRequirements": {}, "recommendedVehicleClasses": ["BOX_TRUCK"]}, "suggestedEquipment": "BOX_TRUCK", "active": true}'::jsonb);
insert into cat_inputs values('cargo-profiles','{"schemaVersion": "2.0", "name": "Catalog QA", "categoryId": "CATEGORY", "typicalUnits": [{"packageType": "BOX", "quantity": 2, "weightPerUnitKg": 10, "volumePerUnitM3": 0.2, "dimensionsCm": {"length": 10, "width": 20, "height": 30}, "indivisible": false, "stackable": true, "unitsPerPackage": 4}], "requirements": ["SECURITY_SEAL"], "preferredEquipment": "BOX_TRUCK", "active": true}'::jsonb);
insert into cat_inputs values('carriers','{"schemaVersion": "2.0", "code": "HAC40_CARRIER", "commercialName": "Catalog carrier", "legalName": "Carrier SRL", "businessIdType": "RUC", "businessIdValue": "12345678901", "registeredCountry": "PE", "providerType": "CARRIER", "status": "ACTIVE", "operationalPhone": "+51999000111"}'::jsonb);
insert into cat_inputs values('depots','{"schemaVersion": "2.0", "code": "DEPOT", "name": "Callao depot", "location": {"label": "Dock", "countryCode": "PE", "region": "CAL", "city": "Callao", "lat": -12, "lng": -77}, "active": true, "handling": ["BOX_TRUCK"]}'::jsonb);
insert into cat_inputs values('services','{"schemaVersion": "2.0", "mode": "ROAD", "serviceClass": "FTL", "maxWeightKg": 10000, "maxVolumeM3": 40, "responseChannels": ["MANUAL"], "status": "ACTIVE", "admittedCargoTypes": ["CATEGORY"], "temperatureRange": null, "requiredCertifications": ["SANITARY"], "supportsHazardous": false, "supportsFragile": true, "supportsOversized": false}'::jsonb);
insert into cat_inputs values('partners','{"schemaVersion": "2.0", "registeredName": "Last mile partner", "partnerCarrierRef": null, "agreementValidFrom": "2026-01-01T00:00:00Z", "agreementValidUntil": "2027-01-01T00:00:00Z", "status": "ACTIVE", "coverageEvidence": "contract:qa"}'::jsonb);
insert into cat_inputs values('areas','{"schemaVersion": "2.0", "role": "PICKUP", "inclusion": "INCLUDE", "geography": {"granularity": "CITY", "countryCode": "PE", "region": "LIM", "city": "Lima", "postalCode": null}, "source": "OWN", "partnerId": null, "evidence": "coverage:qa", "verifiedAt": "2026-01-01T00:00:00Z", "validFrom": "2026-01-01T00:00:00Z", "validUntil": "2027-01-01T00:00:00Z", "active": true}'::jsonb);
insert into cat_inputs values('lanes','{"schemaVersion": "2.0", "pickupAreaId": "PICKUP", "deliveryAreaId": "DELIVERY", "kind": "DIRECT", "mode": "ROAD", "borderReviewRequired": false, "evidence": "lane:qa", "verifiedAt": "2026-01-01T00:00:00Z", "validFrom": "2026-01-01T00:00:00Z", "validUntil": "2027-01-01T00:00:00Z", "active": true, "plannedTransitMinutes": null, "transitProvenanceStatus": "UNKNOWN", "crossBorderProhibited": false, "crossBorderProhibitionReference": null}'::jsonb);
create function pg_temp.cat_cmd(k text,i uuid,key uuid,v integer,body jsonb) returns jsonb language sql security invoker as $$
 select public.command_v2_catalog('c2300000-0000-4000-8000-000000000001','c2320000-0000-4000-8000-000000000001',k,
 case when k in ('depots','services','partners','areas','lanes') then (select id from cat_saved where kind='carriers') else null end,
 case when k in ('areas','lanes') then (select id from cat_saved where kind='services') else null end,i,key,v,body);$$;
create function pg_temp.cat_read(k text,i uuid) returns jsonb language sql security invoker as $$
 select public.read_v2_catalog('c2300000-0000-4000-8000-000000000001','c2320000-0000-4000-8000-000000000001',k,
 case when k in ('depots','services','partners','areas','lanes') then (select id from cat_saved where kind='carriers') else null end,
 case when k in ('areas','lanes') then (select id from cat_saved where kind='services') else null end,i,100,0);$$;
select ok((select relrowsecurity from pg_class where oid='private.v2_catalog_grants'::regclass),'ACL RLS enabled');
select ok((select relrowsecurity from pg_class where oid='private.v2_catalog_receipts'::regclass),'receipt RLS enabled');
set local role anon;
select throws_ok($$select pg_temp.cat_cmd('carriers',null,gen_random_uuid(),null,'{}')$$,'42501',null,'anonymous call rejected');
reset role;
update public.organization_members set role='OWNER' where id='c2320000-0000-4000-8000-000000000001';
delete from public.organization_preferences where organization_id='c2300000-0000-4000-8000-000000000001';
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"c2310000-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok($$select pg_temp.cat_cmd('carriers',null,gen_random_uuid(),null,(select value from cat_inputs where kind='carriers'))$$,
 'PT403','FORBIDDEN_CATALOG','shipper OWNER cannot create a carrier');
select throws_ok($$select pg_temp.cat_cmd('cargo-categories',null,gen_random_uuid(),null,(select value from cat_inputs where kind='cargo-categories'))$$,
 'PT403','FORBIDDEN_CATALOG','shipper OWNER cannot publish global categories');
select throws_ok($$select public.read_v2_catalog('c2300000-0000-4000-8000-000000000002','c2320000-0000-4000-8000-000000000002','carriers',null,null,null,25,0)$$,
 'PT403','FORBIDDEN_CATALOG','forged member/organization rejected');
select throws_ok($$select * from private.v2_catalog_grants$$,'42501',null,'cannot read/provision catalog grants');
reset role;
insert into private.v2_catalog_grants(auth_user_id,permission) values('c2310000-0000-4000-8000-000000000001','CATALOG_ADMIN');
set local role authenticated;
with command as materialized(select gen_random_uuid() key), saved as materialized(select key,pg_temp.cat_cmd('preferences',null,key,null,(select value from cat_inputs where kind='preferences')) r from command) insert into cat_saved select 'preferences',(r#>>'{record,id}')::uuid,r,key from saved;
select is((select receipt#>>'{record,version}' from cat_saved where kind='preferences'),'1','preferences: created');
select is((select pg_temp.cat_cmd('preferences',null,key,null,(select value from cat_inputs where kind='preferences'))->>'replay' from cat_saved where kind='preferences'),'true','preferences: retry returns receipt');
select is((pg_temp.cat_read('preferences',(select id from cat_saved where kind='preferences'))#>>'{0,version}'),'1','preferences: scoped GET reads persisted version');
select is((select pg_temp.cat_cmd('preferences',id,gen_random_uuid(),1,(select value from cat_inputs where kind='preferences'))#>>'{record,version}' from cat_saved where kind='preferences'),'2','preferences: revision');
select throws_ok($$select pg_temp.cat_cmd('preferences',id,gen_random_uuid(),1,(select value from cat_inputs where kind='preferences')) from cat_saved where kind='preferences'$$,'PT409','STALE_DRAFT','preferences: stale revision rejected');
select throws_ok($$select pg_temp.cat_cmd('preferences',id,gen_random_uuid(),2,(select value||'{"rogue":true}' from cat_inputs where kind='preferences')) from cat_saved where kind='preferences'$$,'PT400','VALIDATION_ERROR','preferences: unknown properties rejected at SQL boundary');
select is((select pg_temp.cat_cmd('preferences',null,key,null,(select value from cat_inputs where kind='preferences'))#>>'{record,version}' from cat_saved where kind='preferences'),'1','preferences: original receipt survives revisions');
with command as materialized(select gen_random_uuid() key), saved as materialized(select key,pg_temp.cat_cmd('cargo-categories',null,key,null,(select value from cat_inputs where kind='cargo-categories')) r from command) insert into cat_saved select 'cargo-categories',(r#>>'{record,id}')::uuid,r,key from saved;
select is((select receipt#>>'{record,version}' from cat_saved where kind='cargo-categories'),'1','cargo-categories: created');
select is((select pg_temp.cat_cmd('cargo-categories',null,key,null,(select value from cat_inputs where kind='cargo-categories'))->>'replay' from cat_saved where kind='cargo-categories'),'true','cargo-categories: retry returns receipt');
select is((pg_temp.cat_read('cargo-categories',(select id from cat_saved where kind='cargo-categories'))#>>'{0,version}'),'1','cargo-categories: scoped GET reads persisted version');
select is((select pg_temp.cat_cmd('cargo-categories',id,gen_random_uuid(),1,(select value from cat_inputs where kind='cargo-categories'))#>>'{record,version}' from cat_saved where kind='cargo-categories'),'2','cargo-categories: revision');
select throws_ok($$select pg_temp.cat_cmd('cargo-categories',id,gen_random_uuid(),1,(select value from cat_inputs where kind='cargo-categories')) from cat_saved where kind='cargo-categories'$$,'PT409','STALE_DRAFT','cargo-categories: stale revision rejected');
select throws_ok($$select pg_temp.cat_cmd('cargo-categories',id,gen_random_uuid(),2,(select value||'{"rogue":true}' from cat_inputs where kind='cargo-categories')) from cat_saved where kind='cargo-categories'$$,'PT400','VALIDATION_ERROR','cargo-categories: unknown properties rejected at SQL boundary');
select is((select pg_temp.cat_cmd('cargo-categories',null,key,null,(select value from cat_inputs where kind='cargo-categories'))#>>'{record,version}' from cat_saved where kind='cargo-categories'),'1','cargo-categories: original receipt survives revisions');
update cat_inputs set value=jsonb_set(value,'{categoryId}',to_jsonb((select id::text from cat_saved where kind='cargo-categories'))) where kind='cargo-profiles';
with command as materialized(select gen_random_uuid() key), saved as materialized(select key,pg_temp.cat_cmd('cargo-profiles',null,key,null,(select value from cat_inputs where kind='cargo-profiles')) r from command) insert into cat_saved select 'cargo-profiles',(r#>>'{record,id}')::uuid,r,key from saved;
select is((select receipt#>>'{record,version}' from cat_saved where kind='cargo-profiles'),'1','cargo-profiles: created');
select is((select pg_temp.cat_cmd('cargo-profiles',null,key,null,(select value from cat_inputs where kind='cargo-profiles'))->>'replay' from cat_saved where kind='cargo-profiles'),'true','cargo-profiles: retry returns receipt');
select is((pg_temp.cat_read('cargo-profiles',(select id from cat_saved where kind='cargo-profiles'))#>>'{0,version}'),'1','cargo-profiles: scoped GET reads persisted version');
select is((select pg_temp.cat_cmd('cargo-profiles',id,gen_random_uuid(),1,(select value from cat_inputs where kind='cargo-profiles'))#>>'{record,version}' from cat_saved where kind='cargo-profiles'),'2','cargo-profiles: revision');
select throws_ok($$select pg_temp.cat_cmd('cargo-profiles',id,gen_random_uuid(),1,(select value from cat_inputs where kind='cargo-profiles')) from cat_saved where kind='cargo-profiles'$$,'PT409','STALE_DRAFT','cargo-profiles: stale revision rejected');
select throws_ok($$select pg_temp.cat_cmd('cargo-profiles',id,gen_random_uuid(),2,(select value||'{"rogue":true}' from cat_inputs where kind='cargo-profiles')) from cat_saved where kind='cargo-profiles'$$,'PT400','VALIDATION_ERROR','cargo-profiles: unknown properties rejected at SQL boundary');
select is((select pg_temp.cat_cmd('cargo-profiles',null,key,null,(select value from cat_inputs where kind='cargo-profiles'))#>>'{record,version}' from cat_saved where kind='cargo-profiles'),'1','cargo-profiles: original receipt survives revisions');
with command as materialized(select gen_random_uuid() key), saved as materialized(select key,pg_temp.cat_cmd('carriers',null,key,null,(select value from cat_inputs where kind='carriers')) r from command) insert into cat_saved select 'carriers',(r#>>'{record,id}')::uuid,r,key from saved;
select is((select receipt#>>'{record,version}' from cat_saved where kind='carriers'),'1','carriers: created');
select is((select pg_temp.cat_cmd('carriers',null,key,null,(select value from cat_inputs where kind='carriers'))->>'replay' from cat_saved where kind='carriers'),'true','carriers: retry returns receipt');
select is((pg_temp.cat_read('carriers',(select id from cat_saved where kind='carriers'))#>>'{0,version}'),'1','carriers: scoped GET reads persisted version');
select is((select pg_temp.cat_cmd('carriers',id,gen_random_uuid(),1,(select value from cat_inputs where kind='carriers'))#>>'{record,version}' from cat_saved where kind='carriers'),'2','carriers: revision');
select throws_ok($$select pg_temp.cat_cmd('carriers',id,gen_random_uuid(),1,(select value from cat_inputs where kind='carriers')) from cat_saved where kind='carriers'$$,'PT409','STALE_DRAFT','carriers: stale revision rejected');
select throws_ok($$select pg_temp.cat_cmd('carriers',id,gen_random_uuid(),2,(select value||'{"rogue":true}' from cat_inputs where kind='carriers')) from cat_saved where kind='carriers'$$,'PT400','VALIDATION_ERROR','carriers: unknown properties rejected at SQL boundary');
select is((select pg_temp.cat_cmd('carriers',null,key,null,(select value from cat_inputs where kind='carriers'))#>>'{record,version}' from cat_saved where kind='carriers'),'1','carriers: original receipt survives revisions');
with command as materialized(select gen_random_uuid() key), saved as materialized(select key,pg_temp.cat_cmd('depots',null,key,null,(select value from cat_inputs where kind='depots')) r from command) insert into cat_saved select 'depots',(r#>>'{record,id}')::uuid,r,key from saved;
select is((select receipt#>>'{record,version}' from cat_saved where kind='depots'),'1','depots: created');
select is((select pg_temp.cat_cmd('depots',null,key,null,(select value from cat_inputs where kind='depots'))->>'replay' from cat_saved where kind='depots'),'true','depots: retry returns receipt');
select is((pg_temp.cat_read('depots',(select id from cat_saved where kind='depots'))#>>'{0,version}'),'1','depots: scoped GET reads persisted version');
select is((select pg_temp.cat_cmd('depots',id,gen_random_uuid(),1,(select value from cat_inputs where kind='depots'))#>>'{record,version}' from cat_saved where kind='depots'),'2','depots: revision');
select throws_ok($$select pg_temp.cat_cmd('depots',id,gen_random_uuid(),1,(select value from cat_inputs where kind='depots')) from cat_saved where kind='depots'$$,'PT409','STALE_DRAFT','depots: stale revision rejected');
select throws_ok($$select pg_temp.cat_cmd('depots',id,gen_random_uuid(),2,(select value||'{"rogue":true}' from cat_inputs where kind='depots')) from cat_saved where kind='depots'$$,'PT400','VALIDATION_ERROR','depots: unknown properties rejected at SQL boundary');
select is((select pg_temp.cat_cmd('depots',null,key,null,(select value from cat_inputs where kind='depots'))#>>'{record,version}' from cat_saved where kind='depots'),'1','depots: original receipt survives revisions');
update cat_inputs set value=jsonb_set(value,'{admittedCargoTypes}',jsonb_build_array((select id::text from cat_saved where kind='cargo-categories'))) where kind='services';
with command as materialized(select gen_random_uuid() key), saved as materialized(select key,pg_temp.cat_cmd('services',null,key,null,(select value from cat_inputs where kind='services')) r from command) insert into cat_saved select 'services',(r#>>'{record,id}')::uuid,r,key from saved;
select is((select receipt#>>'{record,version}' from cat_saved where kind='services'),'1','services: created');
select is((select pg_temp.cat_cmd('services',null,key,null,(select value from cat_inputs where kind='services'))->>'replay' from cat_saved where kind='services'),'true','services: retry returns receipt');
select is((pg_temp.cat_read('services',(select id from cat_saved where kind='services'))#>>'{0,version}'),'1','services: scoped GET reads persisted version');
select is((select pg_temp.cat_cmd('services',id,gen_random_uuid(),1,(select value from cat_inputs where kind='services'))#>>'{record,version}' from cat_saved where kind='services'),'2','services: revision');
select throws_ok($$select pg_temp.cat_cmd('services',id,gen_random_uuid(),1,(select value from cat_inputs where kind='services')) from cat_saved where kind='services'$$,'PT409','STALE_DRAFT','services: stale revision rejected');
select throws_ok($$select pg_temp.cat_cmd('services',id,gen_random_uuid(),2,(select value||'{"rogue":true}' from cat_inputs where kind='services')) from cat_saved where kind='services'$$,'PT400','VALIDATION_ERROR','services: unknown properties rejected at SQL boundary');
select is((select pg_temp.cat_cmd('services',null,key,null,(select value from cat_inputs where kind='services'))#>>'{record,version}' from cat_saved where kind='services'),'1','services: original receipt survives revisions');
with command as materialized(select gen_random_uuid() key), saved as materialized(select key,pg_temp.cat_cmd('partners',null,key,null,(select value from cat_inputs where kind='partners')) r from command) insert into cat_saved select 'partners',(r#>>'{record,id}')::uuid,r,key from saved;
select is((select receipt#>>'{record,version}' from cat_saved where kind='partners'),'1','partners: created');
select is((select pg_temp.cat_cmd('partners',null,key,null,(select value from cat_inputs where kind='partners'))->>'replay' from cat_saved where kind='partners'),'true','partners: retry returns receipt');
select is((pg_temp.cat_read('partners',(select id from cat_saved where kind='partners'))#>>'{0,version}'),'1','partners: scoped GET reads persisted version');
select is((select pg_temp.cat_cmd('partners',id,gen_random_uuid(),1,(select value from cat_inputs where kind='partners'))#>>'{record,version}' from cat_saved where kind='partners'),'2','partners: revision');
select throws_ok($$select pg_temp.cat_cmd('partners',id,gen_random_uuid(),1,(select value from cat_inputs where kind='partners')) from cat_saved where kind='partners'$$,'PT409','STALE_DRAFT','partners: stale revision rejected');
select throws_ok($$select pg_temp.cat_cmd('partners',id,gen_random_uuid(),2,(select value||'{"rogue":true}' from cat_inputs where kind='partners')) from cat_saved where kind='partners'$$,'PT400','VALIDATION_ERROR','partners: unknown properties rejected at SQL boundary');
select is((select pg_temp.cat_cmd('partners',null,key,null,(select value from cat_inputs where kind='partners'))#>>'{record,version}' from cat_saved where kind='partners'),'1','partners: original receipt survives revisions');
with command as materialized(select gen_random_uuid() key), saved as materialized(select key,pg_temp.cat_cmd('areas',null,key,null,(select value from cat_inputs where kind='areas')) r from command) insert into cat_saved select 'areas',(r#>>'{record,id}')::uuid,r,key from saved;
select is((select receipt#>>'{record,version}' from cat_saved where kind='areas'),'1','areas: created');
select is((select pg_temp.cat_cmd('areas',null,key,null,(select value from cat_inputs where kind='areas'))->>'replay' from cat_saved where kind='areas'),'true','areas: retry returns receipt');
select is((pg_temp.cat_read('areas',(select id from cat_saved where kind='areas'))#>>'{0,version}'),'1','areas: scoped GET reads persisted version');
select is((select pg_temp.cat_cmd('areas',id,gen_random_uuid(),1,(select value from cat_inputs where kind='areas'))#>>'{record,version}' from cat_saved where kind='areas'),'2','areas: revision');
select throws_ok($$select pg_temp.cat_cmd('areas',id,gen_random_uuid(),1,(select value from cat_inputs where kind='areas')) from cat_saved where kind='areas'$$,'PT409','STALE_DRAFT','areas: stale revision rejected');
select throws_ok($$select pg_temp.cat_cmd('areas',id,gen_random_uuid(),2,(select value||'{"rogue":true}' from cat_inputs where kind='areas')) from cat_saved where kind='areas'$$,'PT400','VALIDATION_ERROR','areas: unknown properties rejected at SQL boundary');
select is((select pg_temp.cat_cmd('areas',null,key,null,(select value from cat_inputs where kind='areas'))#>>'{record,version}' from cat_saved where kind='areas'),'1','areas: original receipt survives revisions');
with saved as materialized(select pg_temp.cat_cmd('areas',null,gen_random_uuid(),null,jsonb_set(jsonb_set((select value from cat_inputs where kind='areas'),'{role}','"DELIVERY"'),'{geography,city}','"Arequipa"')) r) insert into cat_saved select 'delivery',(r#>>'{record,id}')::uuid,r,null from saved;
update cat_inputs set value=jsonb_set(jsonb_set(value,'{pickupAreaId}',to_jsonb((select id::text from cat_saved where kind='areas'))),'{deliveryAreaId}',to_jsonb((select id::text from cat_saved where kind='delivery'))) where kind='lanes';
with command as materialized(select gen_random_uuid() key), saved as materialized(select key,pg_temp.cat_cmd('lanes',null,key,null,(select value from cat_inputs where kind='lanes')) r from command) insert into cat_saved select 'lanes',(r#>>'{record,id}')::uuid,r,key from saved;
select is((select receipt#>>'{record,version}' from cat_saved where kind='lanes'),'1','lanes: created');
select is((select pg_temp.cat_cmd('lanes',null,key,null,(select value from cat_inputs where kind='lanes'))->>'replay' from cat_saved where kind='lanes'),'true','lanes: retry returns receipt');
select is((pg_temp.cat_read('lanes',(select id from cat_saved where kind='lanes'))#>>'{0,version}'),'1','lanes: scoped GET reads persisted version');
select is((select pg_temp.cat_cmd('lanes',id,gen_random_uuid(),1,(select value from cat_inputs where kind='lanes'))#>>'{record,version}' from cat_saved where kind='lanes'),'2','lanes: revision');
select throws_ok($$select pg_temp.cat_cmd('lanes',id,gen_random_uuid(),1,(select value from cat_inputs where kind='lanes')) from cat_saved where kind='lanes'$$,'PT409','STALE_DRAFT','lanes: stale revision rejected');
select throws_ok($$select pg_temp.cat_cmd('lanes',id,gen_random_uuid(),2,(select value||'{"rogue":true}' from cat_inputs where kind='lanes')) from cat_saved where kind='lanes'$$,'PT400','VALIDATION_ERROR','lanes: unknown properties rejected at SQL boundary');
select is((select pg_temp.cat_cmd('lanes',null,key,null,(select value from cat_inputs where kind='lanes'))#>>'{record,version}' from cat_saved where kind='lanes'),'1','lanes: original receipt survives revisions');
select is((pg_temp.cat_read('cargo-profiles',(select id from cat_saved where kind='cargo-profiles'))#>>'{0,value,requirements,0}'),'SECURITY_SEAL','requirements array round trip');
select is((pg_temp.cat_read('cargo-profiles',(select id from cat_saved where kind='cargo-profiles'))#>>'{0,value,typicalUnits,0,unitsPerPackage}'),'4','full unit template round trip');
select is((pg_temp.cat_read('cargo-categories',(select id from cat_saved where kind='cargo-categories'))#>>'{0,value,code}'),'MINERALS','new reference code persisted');
select throws_ok($$select pg_temp.cat_cmd('carriers',null,(select key from cat_saved where kind='carriers'),null,jsonb_set((select value from cat_inputs where kind='carriers'),'{commercialName}','"Forged"'))$$,'PT409','IDEMPOTENCY_CONFLICT','key cannot change payload');
select throws_ok($$select pg_temp.cat_cmd('lanes',null,gen_random_uuid(),null,jsonb_set(jsonb_set((select value from cat_inputs where kind='lanes'),'{pickupAreaId}',to_jsonb((select id::text from cat_saved where kind='delivery'))),'{deliveryAreaId}',to_jsonb((select id::text from cat_saved where kind='areas'))))$$,'23514','INVALID_LANE_ENDPOINTS','inverse lane cannot exchange endpoint roles');
select throws_ok($$select pg_temp.cat_cmd('lanes',null,gen_random_uuid(),null,jsonb_set((select value from cat_inputs where kind='lanes'),'{mode}','"SEA"'))$$,'23514','LANE_MODE_MISMATCH','lane cannot contradict parent service mode');
select throws_ok($$select pg_temp.cat_cmd('services',(select id from cat_saved where kind='services'),gen_random_uuid(),2,jsonb_set((select value from cat_inputs where kind='services'),'{mode}','"AIR"'))$$,'PT400','SERVICE_MODE_HAS_LANES','service revision cannot invalidate published lanes');
select throws_ok($$select pg_temp.cat_cmd('areas',null,gen_random_uuid(),null,jsonb_set(jsonb_set((select value from cat_inputs where kind='areas'),'{source}','"PARTNER"'),'{partnerId}','"c2340000-0000-4000-8000-000000000001"'))$$,'PT400','INVALID_PARTNER_SOURCE','partner must belong to the publishing carrier');
select throws_ok($$select pg_temp.cat_cmd('carriers',(select id from cat_saved where kind='carriers'),gen_random_uuid(),2,(select value||'{"verifiedContact":{"email":"forged@test.com"}}' from cat_inputs where kind='carriers'))$$,'PT400','VALIDATION_ERROR','carrier contact verification is not self asserted');
select lives_ok($$select pg_temp.cat_cmd('areas',null,gen_random_uuid(),null,jsonb_set((select value from cat_inputs where kind='areas'),'{geography}',
 '{"granularity":"POLYGON","countryCode":"PE","region":null,"city":null,"postalCode":null,"geometry":{"type":"Polygon","coordinates":[[[-78,-13],[-77,-13],[-77,-12],[-78,-13]]]}}'))$$,'polygon catalog storage is supported');
select lives_ok($$select pg_temp.cat_cmd('areas',null,gen_random_uuid(),null,jsonb_set((select value from cat_inputs where kind='areas'),'{geography}',
 '{"granularity":"POINTS","countryCode":"PE","region":null,"city":null,"postalCode":null,"geometry":{"type":"MultiPoint","coordinates":[[-77,-12]]}}'))$$,'point-set catalog storage is supported');
select throws_ok($$select pg_temp.cat_cmd('areas',null,gen_random_uuid(),null,jsonb_set((select value from cat_inputs where kind='areas'),'{geography}',
 '{"granularity":"POLYGON","countryCode":"PE","region":null,"city":null,"postalCode":null,"geometry":{"type":"Polygon","coordinates":[[[-78,-13],[-77,-13],[-77,-12],[-76,-13]]]}}'))$$,'23514',null,'open polygon rejected by database');
select throws_ok($$select pg_temp.cat_cmd('cargo-categories',(select id from cat_saved where kind='cargo-categories'),gen_random_uuid(),2,
 jsonb_set((select value from cat_inputs where kind='cargo-categories'),'{code}','"MINERALS_CHANGED"'))$$,'PT400','IMMUTABLE_CATEGORY_CODE','category code remains stable across references');
set local role service_role;
select throws_ok($$update public.carriers set name='Bypass' where id=(select id from cat_saved where kind='carriers')$$,'PT403','DIRECT_CATALOG_MUTATION_FORBIDDEN','service role cannot bypass command');
reset role;
select ok(not (select allow_auto_booking from public.organization_preferences where organization_id='c2300000-0000-4000-8000-000000000001'),'preferences do not authorize automatic booking');
update private.v2_catalog_grants set revoked_at=now();
insert into private.v2_catalog_grants(auth_user_id,carrier_id,permission) select 'c2310000-0000-4000-8000-000000000001',id,'CARRIER_EDITOR' from cat_saved where kind='carriers';
set local role authenticated;
select lives_ok($$select pg_temp.cat_cmd('depots',(select id from cat_saved where kind='depots'),gen_random_uuid(),2,(select value from cat_inputs where kind='depots'))$$,'scoped editor can revise own depot');
select throws_ok($$select public.command_v2_catalog('c2300000-0000-4000-8000-000000000001','c2320000-0000-4000-8000-000000000001','depots','c2340000-0000-4000-8000-000000000001',null,null,gen_random_uuid(),null,(select value from cat_inputs where kind='depots'))$$,'PT403','FORBIDDEN_CATALOG','scoped editor cannot edit another carrier');
reset role;
update private.v2_catalog_grants set revoked_at=now() where permission='CARRIER_EDITOR';
set local role authenticated;
select throws_ok($$select pg_temp.cat_cmd('depots',null,(select key from cat_saved where kind='depots'),null,(select value from cat_inputs where kind='depots'))$$,'PT403','FORBIDDEN_CATALOG','revoked grant cannot replay privileged command');
reset role;
select is((select count(*)::integer from private.v2_catalog_receipts where organization_id='c2300000-0000-4000-8000-000000000001'),22,'only successful commands consume keys');
set local role authenticated;
set local "request.jwt.claims"='{"sub":"c2310000-0000-4000-8000-000000000001","role":"authenticated"}';
select is(jsonb_typeof(pg_temp.cat_read('cargo-categories',(select id from cat_saved where kind='cargo-categories'))#>'{0,value,version}'),
 'string','CP-1: category domain revision is textual in authenticated GET');
select is(jsonb_typeof(pg_temp.cat_read('cargo-categories',(select id from cat_saved where kind='cargo-categories'))#>'{0,version}'),
 'number','CP-1: concurrency revision remains numeric');
reset role;
select * from finish();rollback;

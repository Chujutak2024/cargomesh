-- Structural/privacy regression independent of business seed; native positive
-- and stale-version cases are additionally exercised with actual local sessions.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path=extensions,public;
select no_plan();
select ok(has_function_privilege('authenticated','public.read_v2_carrier_workflow(uuid,text,jsonb,integer,integer)','EXECUTE'),'native Carrier reader remains callable');
select ok(not has_function_privilege('anon','public.read_v2_carrier_workflow(uuid,text,jsonb,integer,integer)','EXECUTE'),'anonymous Carrier reads denied');
select ok(not has_function_privilege('service_role','public.read_v2_carrier_workflow(uuid,text,jsonb,integer,integer)','EXECUTE'),'no service-role shortcut on reader');
select ok(not has_function_privilege('authenticated','private.carrier_opportunity_projection(jsonb)','EXECUTE'),'private projection cannot be invoked by users');
select ok(not has_function_privilege('anon','public.command_v2_carrier_workflow(uuid,text,jsonb,uuid,jsonb)','EXECUTE'),'anonymous commands denied');
select ok(not has_function_privilege('authenticated','private.carrier_request_brief(public.freight_requests)','EXECUTE'),'raw request helper not exposed');
select ok(exists(select 1 from pg_trigger where tgrelid='public.carrier_opportunities'::regclass and tgname='carrier_opportunity_request_guard' and not tgisinternal),'snapshot/version guard installed');
create temporary table projection_result(value jsonb);
insert into projection_result select private.carrier_opportunity_projection('{
 "kind":"opportunities","requestId":"ae510000-0000-4000-8000-000000000001",
 "organizationId":"ae510000-0000-4000-8000-000000000002","carrierId":"ae510000-0000-4000-8000-000000000003",
 "data":{"schemaVersion":"2.0","planId":"ae510000-0000-4000-8000-000000000004",
 "assignmentIds":[],"responseDeadline":"2026-10-21T00:00:00Z","responseChannel":"MANUAL","sentAt":"2026-10-19T00:00:00Z",
 "contacts":{"pickup":{"name":"PRIVATE_CONTACT"}},"internalSecret":"PRIVATE_INTERNAL",
 "origin":{"facilityId":"ae510000-0000-4000-8000-000000000005","label":"PRIVATE_ADDRESS","city":"Lima","countryCode":"PE","region":"LIM","lat":-12,"lng":-77},
 "destination":{"facilityId":null,"label":"PRIVATE_DESTINATION","city":"Lima","countryCode":"PE","region":"LIM","lat":-12.1,"lng":-77.1},
 "cargoSpecification":{"categoryCode":"GENERAL","requirements":["KEEP_DRY"],"availableDocuments":[{"reference":"PRIVATE_DOCUMENT"}]},
 "assignmentSnapshots":[{"id":"ae510000-0000-4000-8000-000000000006","serviceId":"ae510000-0000-4000-8000-000000000007","resource":{"driverName":"PRIVATE_DRIVER"}}]}}'::jsonb);
select is(value#>>'{data,origin,label}','Lima','city is preserved instead of address') from projection_result;
select is(value#>'{data,origin,facilityId}','null'::jsonb,'Facility identity is withheld') from projection_result;
select is(value#>'{data,origin,lat}','null'::jsonb,'exact coordinates are withheld') from projection_result;
select is(value#>>'{data,requestBrief,contactsVisibility}','WITHHELD','contact privacy is explicit') from projection_result;
select is(value#>>'{data,requestBrief,isCurrent}','false','missing current request cannot imply a current invitation') from projection_result;
select ok(value::text !~ 'PRIVATE_','no contact, address, document, driver or opaque internal field escapes') from projection_result;
select is(value#>>'{data,cargoSpecification,requirements,0}','KEEP_DRY','cargo constraints are retained') from projection_result;
select * from finish();
rollback;

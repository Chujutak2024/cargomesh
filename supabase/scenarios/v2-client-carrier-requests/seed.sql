-- LOCAL synthetic published network for the request inbox exercise.
-- This is not a Google route or a claim of verified truck access.
do $scenario$
declare
 evidence jsonb:='{"reference":"scenario:client-carrier-requests","provider":"Synthetic local scenario","observedAt":"2026-10-16T00:00:00Z","validUntil":"2026-10-30T00:00:00Z","provenanceStatus":"SIMULATED"}';
 a uuid:='e5190001-0000-4000-8000-000000000001';
 b uuid:='e5190001-0000-4000-8000-000000000002';
begin
 if current_database()<>'hac50_scenario_fleet80_global_v1' or
  (select shobj_description(oid,'pg_database') from pg_database where datname=current_database()) is distinct from 'LOCAL_ONLY:v2-carrier-fleet-80' then
  raise exception 'LOCAL_SCENARIO_DATABASE_REQUIRED';end if;
 insert into public.logistics_nodes(id,status,data) values
 (a,'ACTIVE',jsonb_build_object('schemaVersion','2.0','active',true,'kind','HUB','name','[SIMULATED] Lima pickup',
  'location',jsonb_build_object('label','[SIMULATED] Private pickup address','countryCode','PE','region','LIM','city','Lima','lat',-12.04,'lng',-77.03),
  'jurisdiction','PE','source',evidence,'verifiedAt','2026-10-16T00:00:00Z')),
 (b,'ACTIVE',jsonb_build_object('schemaVersion','2.0','active',true,'kind','HUB','name','[SIMULATED] Lima delivery',
  'location',jsonb_build_object('label','[SIMULATED] Private delivery address','countryCode','PE','region','LIM','city','Lima','lat',-12.08,'lng',-77.04),
  'jurisdiction','PE','source',evidence,'verifiedAt','2026-10-16T00:00:00Z')) on conflict(id) do nothing;
 insert into public.route_corridors(id,status,origin_node_id,destination_node_id,data) values
 ('e5190002-0000-4000-8000-000000000001','ACTIVE',a,b,jsonb_build_object('schemaVersion','2.0','active',true,
  'originNodeId',a,'destinationNodeId',b,'mode','ROAD','estimatedDistanceKm',7,'estimatedDurationSeconds',1800,
  'restrictions','[]'::jsonb,'source',evidence,'version','synthetic-inbox-v1','validUntil','2026-10-30T00:00:00Z',
  'grossWeightLimitKg',null,'payloadLimitKg',null,'usableDimensions',null,'limitsEvidence',null,'waypoints','[]'::jsonb)) on conflict(id) do nothing;
 insert into public.route_planning_policies(id,status,data) values
 ('e5190003-0000-4000-8000-000000000001','ACTIVE',jsonb_build_object('schemaVersion','2.0','active',true,
  'version','synthetic-inbox-v1','objective','FASTEST','constraints','[]'::jsonb,
  'weights',jsonb_build_object('distance',0,'duration',1),'missingDataRule','UNKNOWN')) on conflict(id) do nothing;
end;
$scenario$;

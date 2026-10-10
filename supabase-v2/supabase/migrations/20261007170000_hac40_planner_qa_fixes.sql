-- B01/B02: preserve search history, enforce corridor payload and request version.
create or replace function private.workflow_route(o uuid,qid uuid,ids jsonb,policy uuid,rid uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare q public.freight_requests;p public.route_planning_policies;c public.route_corridors;n1 public.logistics_nodes;n2 public.logistics_nodes;
 next_id uuid;prev uuid;seq integer:=0;leg uuid;x jsonb;origin jsonb;dest jsonb;reasons jsonb:='[]';distance numeric:=0;duration numeric:=0;known_distance boolean:=true;known_duration boolean:=true;
begin
 q:=private.workflow_request(o,qid);select * into p from public.route_planning_policies where id=policy and status='ACTIVE';
 if p.id is null then raise exception 'WORKFLOW_NOT_FOUND' using errcode='PT404';end if;
 insert into public.route_plans(id,organization_id,freight_request_id,status,policy_id,data) values(rid,o,qid,'unknown',policy,'{}');
 for next_id in select value::uuid from jsonb_array_elements_text(ids) loop
  seq:=seq+1;select * into c from public.route_corridors where id=next_id and status='ACTIVE';
  if c.id is null then raise exception 'WORKFLOW_NOT_FOUND' using errcode='PT404';end if;
  select * into n1 from public.logistics_nodes where id=c.origin_node_id;select * into n2 from public.logistics_nodes where id=c.destination_node_id;
  if seq>1 and prev<>c.origin_node_id then raise exception 'DISCONTINUOUS_ROUTE' using errcode='PT400';end if;
  if seq=1 then origin:=n1.data->'location';end if;dest:=n2.data->'location';prev:=c.destination_node_id;
  if not coalesce(q.v2_snapshot->'acceptedModes',jsonb_build_array(q.v2_snapshot->>'transportMode')) ? (c.data->>'mode') then raise exception 'ROUTE_MODE_MISMATCH' using errcode='PT400';end if;
  if n1.data#>>'{location,countryCode}'<>n2.data#>>'{location,countryCode}' and not exists(select 1 from jsonb_array_elements(c.data->'restrictions') req_rule where (req_rule->>'required')::boolean) then reasons:=reasons||'"BORDER_RULES_UNKNOWN"'::jsonb;end if;
  if c.data->>'mode'<>'ROAD' then reasons:=reasons||'"MODE_ADAPTER_UNVERIFIED"'::jsonb;end if;
  if n1.status<>'ACTIVE' or n2.status<>'ACTIVE' then raise exception 'NODE_INACTIVE' using errcode='PT400';end if;
  if not private.workflow_evidence(c.data->'source',q.pickup_window_start,q.delivery_window_end) or not private.workflow_evidence(n1.data->'source',q.pickup_window_start,q.delivery_window_end)
    or not private.workflow_evidence(n2.data->'source',q.pickup_window_start,q.delivery_window_end) then reasons:=reasons||'"ROUTE_SOURCE_UNKNOWN"'::jsonb;end if;
  -- Payload is a hard corridor constraint; absent/currently unproven limits are unknown.
  if (c.data->>'payloadLimitKg') is null or not private.workflow_evidence(c.data->'limitsEvidence',q.pickup_window_start,q.delivery_window_end)
    or (c.data->>'validUntil') is null or (c.data->>'validUntil')::timestamptz<q.delivery_window_end then
   reasons:=reasons||jsonb_build_array('ROUTE_PAYLOAD_LIMIT_UNKNOWN');
  elsif (q.v2_snapshot#>>'{cargoSpecification,totalWeightKg}')::numeric>(c.data->>'payloadLimitKg')::numeric then
   reasons:=reasons||jsonb_build_array('ROUTE_PAYLOAD_LIMIT_EXCEEDED');
  end if;
  for x in select value from jsonb_array_elements(c.data->'restrictions') union all select value from jsonb_array_elements(p.data->'constraints') loop
   if (x->>'required')::boolean and (not private.workflow_evidence(x->'evidence',q.pickup_window_start,q.delivery_window_end)
     or not exists(select 1 from jsonb_array_elements(coalesce(q.v2_snapshot#>'{cargoSpecification,availableDocuments}','[]')) doc where doc->>'code'=x->>'code'
       and doc->>'reference' is not null and (doc->>'issuedAt')::timestamptz<=now() and (doc->>'validUntil')::timestamptz>=q.delivery_window_end))
   then reasons:=reasons||jsonb_build_array('PERMIT_REQUIRED:'||(x->>'code'));end if;
  end loop;
  for x in select data from public.route_conditions where parent_id=c.id and status='ACTIVE'
    and (data->>'observedAt')::timestamptz<=now() and ((data->>'validUntil') is null or (data->>'validUntil')::timestamptz>now()) loop
   if x->>'kind'='CLOSURE' and x->>'confidence' in ('VERIFIED','SIMULATED') then reasons:=reasons||'"ROUTE_CLOSED"'::jsonb;
   else reasons:=reasons||jsonb_build_array('ROUTE_CONDITION:'||(x->>'kind'));end if;
  end loop;
  if c.data->>'estimatedDistanceKm' is null then known_distance:=false;else distance:=distance+(c.data->>'estimatedDistanceKm')::numeric;end if;
  if c.data->>'estimatedDurationSeconds' is null then known_duration:=false;else duration:=duration+(c.data->>'estimatedDurationSeconds')::numeric;end if;
  leg:=gen_random_uuid();insert into public.route_legs(id,route_plan_id,corridor_id,sequence,data) values(leg,rid,c.id,seq,
   jsonb_build_object('sequence',seq,'mode',c.data->'mode','origin',n1.data->'location','destination',n2.data->'location',
    'borderRequirements',c.data->'restrictions','estimatedDistanceKm',c.data->'estimatedDistanceKm','estimatedDurationSeconds',c.data->'estimatedDurationSeconds','waypoints',c.data->'waypoints','conditions',coalesce((select jsonb_agg(data) from public.route_conditions where parent_id=c.id and status='ACTIVE' and (data->>'observedAt')::timestamptz<=now() and ((data->>'validUntil') is null or (data->>'validUntil')::timestamptz>now())),'[]'::jsonb),'source',c.data->'source','corridorVersion',c.version,'originNodeVersion',n1.version,'destinationNodeVersion',n2.version));
  insert into public.route_waypoints(route_leg_id,sequence,data) select leg,ordinality,value from jsonb_array_elements(c.data->'waypoints') with ordinality;
 end loop;
 if lower(origin->>'city')<>lower(q.v2_snapshot#>>'{origin,city}') or origin->>'countryCode'<>q.v2_snapshot#>>'{origin,countryCode}'
 or lower(dest->>'city')<>lower(q.v2_snapshot#>>'{destination,city}') or dest->>'countryCode'<>q.v2_snapshot#>>'{destination,countryCode}' then raise exception 'ROUTE_REQUEST_ENDPOINT_MISMATCH' using errcode='PT400';end if;
 if (q.v2_snapshot#>>'{origin,lat}') is not null and origin->'lat' is distinct from q.v2_snapshot#>'{origin,lat}'
 or (q.v2_snapshot#>>'{origin,lng}') is not null and origin->'lng' is distinct from q.v2_snapshot#>'{origin,lng}'
 or (q.v2_snapshot#>>'{destination,lat}') is not null and dest->'lat' is distinct from q.v2_snapshot#>'{destination,lat}'
 or (q.v2_snapshot#>>'{destination,lng}') is not null and dest->'lng' is distinct from q.v2_snapshot#>'{destination,lng}' then reasons:=reasons||'"ENDPOINT_CONNECTOR_UNKNOWN"'::jsonb;end if;
 if known_duration and duration>extract(epoch from(q.delivery_window_end-q.pickup_window_start)) then reasons:=reasons||'"ROUTE_WINDOW_EXCEEDED"'::jsonb;end if;
 update public.route_plans set status=case when reasons ? 'ROUTE_CLOSED' or reasons ? 'ROUTE_WINDOW_EXCEEDED' or reasons ? 'ROUTE_PAYLOAD_LIMIT_EXCEEDED' then 'ineligible' when jsonb_array_length(reasons)>0 then 'unknown' else 'eligible' end,
 data=jsonb_build_object('origin',origin,'destination',dest,'corridorIds',ids,'policyId',policy,'policyVersion',p.version,'estimatedDistanceKm',case when known_distance then distance end,
  'estimatedDurationSeconds',case when known_duration then duration end,'geographicSource',jsonb_build_object('kind','PUBLISHED_CORRIDORS','references',ids),
  'confidence',case when jsonb_array_length(reasons)>0 then 'UNKNOWN' when exists(select 1 from public.route_corridors where id in(select value::uuid from jsonb_array_elements_text(ids)) and data#>>'{source,provenanceStatus}'='SIMULATED') or exists(select 1 from public.route_legs l join public.route_corridors cc on cc.id=l.corridor_id join public.logistics_nodes n on n.id in(cc.origin_node_id,cc.destination_node_id) where l.route_plan_id=rid and n.data#>>'{source,provenanceStatus}'='SIMULATED') then 'SIMULATED' else 'VERIFIED' end,'estimatedTolls',null,'borderCostEstimate',null,'reasons',reasons,
  'legs',(select jsonb_agg(data||jsonb_build_object('id',id,'corridorId',corridor_id) order by sequence) from public.route_legs where route_plan_id=rid)) where id=rid;
 update public.route_plans set data=data||jsonb_build_object('planner',private.workflow_planner_snapshot(data)) where id=rid;
 return private.workflow_record('routes',rid);end;$$;


-- Native, tenant-authorized route search/replan. No providers or synthetic rows.
create or replace function public.command_v2_route_planner(p_organization_id uuid,p_member_id uuid,p_action text,
 p_target_id uuid,p_key uuid,p_value jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare o uuid:=p_organization_id;q public.freight_requests;p public.route_planning_policies;
 old public.route_plans;condition public.route_conditions;receipt private.v2_workflow_receipts;
 h text;policy uuid;legs integer;max_results integer;graph jsonb;walks jsonb;paths jsonb;
 item jsonb;r jsonb;rid uuid;all_routes jsonb:='[]';result jsonb;selected jsonb;decision jsonb:=null;
 gid text;max_distance numeric;max_duration numeric;begin
 perform private.workflow_member(o,p_member_id,true);
 if p_key is null or p_target_id is null or p_action not in ('find','replan') or p_action is null
  or not coalesce(extensions.jsonb_matches_schema(
   case when p_action='find' then
   '{"type":"object","properties":{"schemaVersion":{"const":"2.0"},"policyId":{"type":"string","format":"uuid"},"expectedDraftVersion":{"type":"integer","minimum":1},"maxLegs":{"type":"integer","minimum":1,"maximum":8},"maxAlternatives":{"type":"integer","minimum":1,"maximum":20}},"required":["schemaVersion","policyId","expectedDraftVersion","maxLegs","maxAlternatives"],"additionalProperties":false}'::json
   else
   '{"type":"object","properties":{"schemaVersion":{"const":"2.0"},"conditionId":{"type":"string","format":"uuid"},"expectedVersion":{"type":"integer","minimum":1},"maxLegs":{"type":"integer","minimum":1,"maximum":8},"maxAlternatives":{"type":"integer","minimum":1,"maximum":20}},"required":["schemaVersion","conditionId","expectedVersion","maxLegs","maxAlternatives"],"additionalProperties":false}'::json end,p_value),false)
 then raise exception 'VALIDATION_ERROR' using errcode='PT400';end if;
 perform 1 from public.carrier_services order by id for update;
 if p_action='find' then
  q:=private.workflow_request(o,p_target_id);policy:=(p_value->>'policyId')::uuid;
 else
  perform private.workflow_scope(o,null,'routes',p_target_id);
  select * into old from public.route_plans where id=p_target_id for update;
  q:=private.workflow_request(o,old.freight_request_id);policy:=old.policy_id;
  select * into condition from public.route_conditions where id=(p_value->>'conditionId')::uuid;
  if condition.id is null or not exists(select 1 from public.route_legs where route_plan_id=old.id and corridor_id=condition.parent_id)
   then raise exception 'ROUTE_CONDITION_MISMATCH' using errcode='PT400';end if;
 end if;
 h:=private.hash_v2_freight_payload(jsonb_build_object('action','route-planner.'||p_action,
  'targetId',p_target_id,'value',p_value));
 perform pg_advisory_xact_lock(hashtextextended(o::text||':'||p_member_id::text||':'||p_key::text,0));
 select * into receipt from private.v2_workflow_receipts where organization_id=o and member_id=p_member_id and idempotency_key=p_key;
 if found then
  if receipt.payload_hash<>h then raise exception 'IDEMPOTENCY_CONFLICT' using errcode='PT409';end if;
  return jsonb_build_object('result',receipt.result,'replay',true);
 end if;
 if p_action='find' and q.draft_version<>(p_value->>'expectedDraftVersion')::integer then
  raise exception 'STALE_DRAFT' using errcode='PT409';end if;
 if p_action='replan' and old.version<>(p_value->>'expectedVersion')::integer then
  raise exception 'STALE_DRAFT' using errcode='PT409';end if;
 if p_action='replan' and (condition.status<>'ACTIVE' or (condition.data->>'observedAt')::timestamptz>now()
  or (condition.data->>'validUntil')::timestamptz<=now()) then
  raise exception 'ROUTE_CONDITION_NOT_CURRENT' using errcode='PT409';end if;
 select * into p from public.route_planning_policies where id=policy and status='ACTIVE' for update;
 if p.id is null then raise exception 'WORKFLOW_NOT_FOUND' using errcode='PT404';end if;
 legs:=(p_value->>'maxLegs')::integer;max_results:=(p_value->>'maxAlternatives')::integer;
 -- Lock the records whose versions are placed into the immutable graph snapshot.
 perform 1 from public.logistics_nodes order by id for update;
 perform 1 from public.route_corridors order by id for update;
 perform 1 from public.route_conditions order by id for update;
 select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'origin',c.origin_node_id,'destination',c.destination_node_id,
  'version',c.version,'mode',c.data->'mode','originVersion',n1.version,'destinationVersion',n2.version,
  'originLocation',n1.data->'location','destinationLocation',n2.data->'location') order by c.id),'[]') into graph
 from public.route_corridors c join public.logistics_nodes n1 on n1.id=c.origin_node_id
 join public.logistics_nodes n2 on n2.id=c.destination_node_id
 where c.status='ACTIVE' and n1.status='ACTIVE' and n2.status='ACTIVE'
 and coalesce(q.v2_snapshot->'acceptedModes',jsonb_build_array(q.v2_snapshot->>'transportMode')) ? (c.data->>'mode');
 if jsonb_array_length(graph)>64 then raise exception 'ROUTE_SEARCH_LIMIT' using errcode='PT409';end if;
 gid:=private.hash_v2_freight_payload(jsonb_build_object('graph',graph,'policyId',policy,'policyVersion',p.version,
  'conditions',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'version',c.version,'status',c.status) order by c.id)
   from public.route_conditions c where exists(select 1 from jsonb_array_elements(graph) edge where (edge->>'id')::uuid=c.parent_id)),'[]')));
 -- Exhaust all simple directed walks within explicit bounds. Abort on overflow;
 -- do not return a truncated universe as an exhaustive search.
 with recursive edges as (select value e from jsonb_array_elements(graph)),
 walk(node,visited,ids,location) as (
  select e->>'destination',array[e->>'origin',e->>'destination'],jsonb_build_array(e->'id'),e->'destinationLocation'
  from edges where lower(e#>>'{originLocation,city}')=lower(q.v2_snapshot#>>'{origin,city}')
   and e#>>'{originLocation,countryCode}'=q.v2_snapshot#>>'{origin,countryCode}'
  union all
  select e->>'destination',w.visited||(e->>'destination'),w.ids||jsonb_build_array(e->'id'),e->'destinationLocation'
  from walk w join edges on e->>'origin'=w.node
  where jsonb_array_length(w.ids)<legs and not(e->>'destination'=any(w.visited))
   and not(lower(w.location->>'city')=lower(q.v2_snapshot#>>'{destination,city}')
    and w.location->>'countryCode'=q.v2_snapshot#>>'{destination,countryCode}')
 ), bounded as(select * from walk limit 1001)
 select coalesce(jsonb_agg(jsonb_build_object('ids',ids,'location',location)),'[]') into walks from bounded;
 if jsonb_array_length(walks)>1000 then raise exception 'ROUTE_SEARCH_LIMIT' using errcode='PT409';end if;
 select coalesce(jsonb_agg(value->'ids' order by (value->'ids')::text),'[]') into paths from jsonb_array_elements(walks)
 where lower(value#>>'{location,city}')=lower(q.v2_snapshot#>>'{destination,city}')
  and value#>>'{location,countryCode}'=q.v2_snapshot#>>'{destination,countryCode}';
 for item in select value from jsonb_array_elements(paths) loop
  rid:=gen_random_uuid();r:=private.workflow_route(o,q.id,item,policy,rid);
  -- Preserve search provenance independently of the per-itinerary validator.
  update public.route_plans set data=jsonb_set(data,'{planner,search}',jsonb_build_object(
   'algorithmVersion','BOUNDED_SIMPLE_PATHS_V1','graphVersion',gid,'policyId',policy,'policyVersion',p.version,
   'scope','ACTIVE_PUBLISHED_DIRECTED_NETWORK','maxLegs',legs,
   'corridorVersions',coalesce((select jsonb_agg(jsonb_build_object('id',e->'id','version',e->'version',
    'originNodeVersion',e->'originVersion','destinationNodeVersion',e->'destinationVersion') order by e->>'id')
    from jsonb_array_elements(graph) e),'[]'),
   'conditionVersions',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'version',c.version,
    'status',c.status,'source',c.data->'source') order by c.id) from public.route_conditions c
    where exists(select 1 from jsonb_array_elements(graph) e where (e->>'id')::uuid=c.parent_id)),'[]')))
   where id=rid;
  r:=private.workflow_record('routes',rid);
  all_routes:=all_routes||jsonb_build_array(r);
 end loop;
 select max((value#>>'{data,estimatedDistanceKm}')::numeric),max((value#>>'{data,estimatedDurationSeconds}')::numeric)
 into max_distance,max_duration from jsonb_array_elements(all_routes);
 select coalesce(jsonb_agg(value order by
  case value->>'status' when 'eligible' then 0 when 'unknown' then 1 else 2 end,
  case when p.data->>'objective'='SHORTEST' then (value#>>'{data,estimatedDistanceKm}')::numeric
   when p.data->>'objective'='FASTEST' then (value#>>'{data,estimatedDurationSeconds}')::numeric
   else (value#>>'{data,estimatedDistanceKm}')::numeric/greatest(max_distance,1)*(p.data#>>'{weights,distance}')::numeric
    +(value#>>'{data,estimatedDurationSeconds}')::numeric/greatest(max_duration,1)*(p.data#>>'{weights,duration}')::numeric end nulls last,
   (value#>'{data,corridorIds}')::text),'[]') into all_routes from jsonb_array_elements(all_routes);
 select coalesce(jsonb_agg(value order by ordinal),'[]') into selected from jsonb_array_elements(all_routes) with ordinality as rows(value,ordinal)
 where ordinal<=max_results;
 -- maxAlternatives limits presentation only. Keep all evaluated immutable snapshots.
 if p_action='replan' then
  decision:=jsonb_build_object('originalRouteId',old.id,'conditionId',condition.id,
   'recommendedRouteId',case when selected->0->>'status'='eligible' then selected->0->'id' else 'null'::jsonb end,
   'action',case when jsonb_array_length(selected)=0 then 'NO_ALTERNATIVE'
    when selected->0->>'status'='eligible' then 'PROPOSE_ALTERNATIVE' else 'REQUIRES_REVIEW' end,'requiresSelection',true);
 end if;
 result:=jsonb_build_object('alternatives',selected,'search',jsonb_build_object('algorithmVersion','BOUNDED_SIMPLE_PATHS_V1',
  'requestId',q.id,'policyId',policy,'graphVersion',gid,'maxLegs',legs,'evaluatedPaths',jsonb_array_length(paths),
  'returnedPaths',jsonb_array_length(selected),'completeWithinBounds',true,'presentationTruncated',jsonb_array_length(paths)>max_results,
  'universe','ACTIVE_PUBLISHED_DIRECTED_NETWORK','evaluatedAt',now()),'decision',decision);
 insert into private.v2_workflow_receipts(organization_id,member_id,idempotency_key,payload_hash,result)
 values(o,p_member_id,p_key,h,result);
 return jsonb_build_object('result',result,'replay',false);
end;$$;
revoke all on function public.command_v2_route_planner(uuid,uuid,text,uuid,uuid,jsonb) from public,anon,service_role;
grant execute on function public.command_v2_route_planner(uuid,uuid,text,uuid,uuid,jsonb) to authenticated;

-- Native, tenant-authorized route search/replan. No providers or synthetic rows.
create function public.command_v2_route_planner(p_organization_id uuid,p_member_id uuid,p_action text,
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
   '{"type":"object","properties":{"schemaVersion":{"const":"2.0"},"policyId":{"type":"string","format":"uuid"},"maxLegs":{"type":"integer","minimum":1,"maximum":8},"maxAlternatives":{"type":"integer","minimum":1,"maximum":20}},"required":["schemaVersion","policyId","maxLegs","maxAlternatives"],"additionalProperties":false}'::json
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
 -- Non-presented snapshots are removed atomically; no plan/booking references them.
 delete from public.route_waypoints where route_leg_id in(select id from public.route_legs where route_plan_id in(
  select (value->>'id')::uuid from jsonb_array_elements(all_routes) with ordinality as rows(value,ordinal) where ordinal>max_results));
 delete from public.route_legs where route_plan_id in(select (value->>'id')::uuid from jsonb_array_elements(all_routes)
  with ordinality as rows(value,ordinal) where ordinal>max_results);
 delete from public.route_plans where id in(select (value->>'id')::uuid from jsonb_array_elements(all_routes)
  with ordinality as rows(value,ordinal) where ordinal>max_results);
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

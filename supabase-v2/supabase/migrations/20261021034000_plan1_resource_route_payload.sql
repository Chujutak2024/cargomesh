-- Plan1: per-resource load checks; no synthetic rows or permission expansion.
begin;
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
  -- Before allocation, reject an impossible whole package (or an unsplittable shipment).
  -- The native plan evaluator enforces corridor/manufacturer/gross limits on every assigned load.
  if (c.data->>'payloadLimitKg') is null or not private.workflow_evidence(c.data->'limitsEvidence',q.pickup_window_start,q.delivery_window_end)
    or (c.data->>'validUntil') is null or (c.data->>'validUntil')::timestamptz<q.delivery_window_end then
   reasons:=reasons||jsonb_build_array('ROUTE_PAYLOAD_LIMIT_UNKNOWN');
  elsif (case when not coalesce((q.v2_snapshot#>>'{cargoSpecification,divisible}')::boolean,false)
    then (q.v2_snapshot#>>'{cargoSpecification,totalWeightKg}')::numeric
    else coalesce((select max((u->>'weightPerUnitKg')::numeric) from jsonb_array_elements(q.v2_snapshot#>'{cargoSpecification,units}') u),0)
   end)>(c.data->>'payloadLimitKg')::numeric then
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
revoke all on function private.workflow_route(uuid,uuid,jsonb,uuid,uuid) from public,anon,authenticated,service_role;
commit;

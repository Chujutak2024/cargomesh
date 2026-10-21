-- Plan1: bounded multi-resource quotes; legacy tariffs authorize one resource only.
begin;
alter table private.quote_dispatches add column resource_fingerprint text not null default '' check(resource_fingerprint='' or resource_fingerprint~'^[a-f0-9]{64}$');
alter table private.quote_dispatches drop constraint quote_dispatches_pkey;
alter table private.quote_dispatches add primary key(request_id,request_version,service_id,lane_id,calendar_id,resource_fingerprint);
create or replace function public.configure_v2_quote_policy(p_carrier_id uuid,p_operator_id uuid,p_key uuid,p_expected_version integer,p_value jsonb default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare p private.carrier_quote_policies;r private.quote_command_receipts;h text;result jsonb;begin
 if p_operator_id is distinct from private.identity_carrier(p_carrier_id) then raise exception 'FORBIDDEN_CARRIER_IDENTITY' using errcode='PT403';end if;
 if p_value is null then
  return coalesce((select jsonb_agg(private.quote_policy_record(x) order by x.service_id,x.lane_id) from private.carrier_quote_policies x where x.carrier_id=p_carrier_id),'[]'::jsonb);
 end if;
 perform private.identity_carrier_action(p_carrier_id,'limits.publish'); -- ADMIN approval, not a shipper grant.
 if p_key is null or p_expected_version is null or p_expected_version<0 or not coalesce(extensions.jsonb_matches_schema($policy_schema${"type":"object","additionalProperties":false,"required":["schemaVersion","serviceId","laneId","active","autoIssue","basis","baseAmount","ratePerKm","minimumAmount","fuelAmount","tollAmount","handlingAmount","taxAmount","validityMinutes","confirmationMinutes","validUntil","terms","provenanceStatus","acknowledgeAuthority"],"properties":{"schemaVersion":{"const":"2.0"},"serviceId":{"type":"string","format":"uuid"},"laneId":{"type":"string","format":"uuid"},"active":{"type":"boolean"},"autoIssue":{"type":"boolean"},"basis":{"enum":["PER_TRIP","PER_KM"]},"baseAmount":{"type":"number","minimum":0,"maximum":100000000},"ratePerKm":{"type":"number","minimum":0,"maximum":100000000},"minimumAmount":{"type":"number","minimum":0,"maximum":100000000},"fuelAmount":{"type":"number","minimum":0,"maximum":100000000},"tollAmount":{"type":"number","minimum":0,"maximum":100000000},"handlingAmount":{"type":"number","minimum":0,"maximum":100000000},"taxAmount":{"type":"number","minimum":0,"maximum":100000000},"validityMinutes":{"type":"integer","minimum":5,"maximum":1440},"confirmationMinutes":{"type":"integer","minimum":5,"maximum":1440},"validUntil":{"type":"string","format":"date-time"},"terms":{"type":"string","minLength":1,"maxLength":2000},"provenanceStatus":{"enum":["VERIFIED","SIMULATED"]},"acknowledgeAuthority":{"const":true},"maxResources":{"type":"integer","minimum":1,"maximum":8},"resourcePricing":{"enum":["PER_PLAN","PER_RESOURCE"]}}}$policy_schema$::json,p_value),false)
 then raise exception 'VALIDATION_ERROR' using errcode='PT400';end if;
 if coalesce((p_value->>'maxResources')::integer,1)>1 and p_value->>'resourcePricing' is null then raise exception 'RESOURCE_PRICING_SCOPE_REQUIRED' using errcode='PT400';end if;
 if (p_value->>'validUntil')::timestamptz<=now() or btrim(p_value->>'terms')='' or
  (p_value->>'basis'='PER_KM' and (p_value->>'ratePerKm')::numeric<=0) or
  (p_value->>'basis'='PER_TRIP' and (p_value->>'ratePerKm')::numeric<>0) or
  (p_value->>'baseAmount')::numeric+(p_value->>'minimumAmount')::numeric+(p_value->>'ratePerKm')::numeric<=0 or
  exists(select 1 from jsonb_each(p_value) kv where kv.key in('baseAmount','ratePerKm','minimumAmount','fuelAmount','tollAmount','handlingAmount','taxAmount') and (kv.value::text)::numeric*100<>round((kv.value::text)::numeric*100))
 then raise exception 'INVALID_TARIFF' using errcode='PT400';end if;
 if not exists(select 1 from public.carrier_services s join public.service_lanes l on l.carrier_service_id=s.id
  where s.id=(p_value->>'serviceId')::uuid and s.carrier_id=p_carrier_id and l.id=(p_value->>'laneId')::uuid and s.transport_mode='ROAD' and s.service_type='FTL')
 then raise exception 'INVALID_POLICY_SCOPE' using errcode='PT400';end if;
 h:=private.hash_v2_freight_payload(jsonb_build_object('carrier',p_carrier_id,'expectedVersion',p_expected_version,'value',p_value));
 perform pg_advisory_xact_lock(hashtextextended('quote-policy-key:'||p_operator_id||':'||p_key,0));
 select * into r from private.quote_command_receipts where actor_id=p_operator_id and key=p_key and scope='policy';
 if found then if r.payload_hash<>h then raise exception 'IDEMPOTENCY_CONFLICT' using errcode='PT409';end if;return r.result;end if;
 perform pg_advisory_xact_lock(hashtextextended('quote-policy:'||p_carrier_id||':'||(p_value->>'serviceId')||':'||(p_value->>'laneId'),0));
 select * into p from private.carrier_quote_policies where carrier_id=p_carrier_id and service_id=(p_value->>'serviceId')::uuid and lane_id=(p_value->>'laneId')::uuid for update;
 if coalesce(p.version,0)<>p_expected_version then raise exception 'STALE_DRAFT' using errcode='PT409';end if;
 insert into private.carrier_quote_policies(carrier_id,service_id,lane_id,operator_id,auth_user_id,version,value)
 values(p_carrier_id,(p_value->>'serviceId')::uuid,(p_value->>'laneId')::uuid,p_operator_id,auth.uid(),p_expected_version+1,p_value)
 on conflict(carrier_id,service_id,lane_id) do update set operator_id=excluded.operator_id,auth_user_id=excluded.auth_user_id,version=excluded.version,value=excluded.value,updated_at=now() returning * into p;
 result:=private.quote_policy_record(p);
 insert into private.quote_command_receipts values(p_operator_id,p_key,'policy',h,result);return result;
end;$$;

create or replace function public.request_v2_carrier_quote(p_organization_id uuid,p_member_id uuid,p_request_id uuid,p_expected_version integer,
 p_key uuid,p_deadline timestamptz,p_candidate jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare q public.freight_requests;s public.carrier_services;p private.carrier_quote_policies;r private.quote_command_receipts;
 h text;ctx jsonb;route jsonb;plan jsonb;opp jsonb;offer jsonb;result jsonb;route_policy uuid;corridor uuid;corridor_count integer;
 allocations jsonb;assignments jsonb;offer_id uuid;expiry timestamptz;distance numeric;transport numeric;total numeric;component jsonb;parts jsonb;ev jsonb;v jsonb;
 sid uuid:=(p_candidate->>'serviceId')::uuid;lane uuid:=(p_candidate->>'laneId')::uuid;cal uuid:=(p_candidate->>'calendarId')::uuid;
 resources jsonb;resource_count integer;fingerprint text;pricing_factor integer;reason text;reuse_plan boolean:=false;supersedes uuid;current_offer uuid;begin
 perform private.workflow_member(p_organization_id,p_member_id,true);
 -- Keep the service -> request ordering used by fleet, crew and native workflow commands.
 perform 1 from public.carrier_services order by id for update;
 select * into q from public.freight_requests where id=p_request_id and organization_id=p_organization_id for update;
 if not found then raise exception 'REQUEST_NOT_FOUND' using errcode='PT404';end if;
 if p_expected_version is null or p_expected_version<>q.draft_version then raise exception 'STALE_DRAFT' using errcode='PT409';end if;
 if q.status<>'PENDING' then raise exception 'REQUEST_NOT_SUBMITTED' using errcode='PT409';end if;
 if p_key is null or p_deadline is null or p_deadline<=now() or p_deadline>q.pickup_window_start or not coalesce(extensions.jsonb_matches_schema(
 '{"type":"object","additionalProperties":false,"required":["serviceId","laneId","calendarId","assetId","poolId"],"properties":{"serviceId":{"type":"string","format":"uuid"},"laneId":{"type":"string","format":"uuid"},"calendarId":{"type":"string","format":"uuid"},"assetId":{"type":["string","null"],"format":"uuid"},"poolId":{"type":["string","null"],"format":"uuid"},"resources":{"type":"array","minItems":2,"maxItems":8,"items":{"type":"object","additionalProperties":false,"required":["calendarId","assetId","poolId","allocations"],"properties":{"calendarId":{"type":"string","format":"uuid"},"assetId":{"type":"string","format":"uuid"},"poolId":{"type":"null"},"allocations":{"type":"array","minItems":1,"items":{"type":"object","additionalProperties":false,"required":["unitIndex","quantity"],"properties":{"unitIndex":{"type":"integer","minimum":0},"quantity":{"type":"integer","minimum":1}}}}}}}}}'::json,p_candidate),false)
 then raise exception 'INVALID_QUOTE_SEARCH' using errcode='PT400';end if;
 resources:=p_candidate->'resources';resource_count:=coalesce(jsonb_array_length(resources),1);
 if resource_count>1 and not coalesce((q.v2_snapshot#>>'{cargoSpecification,divisible}')::boolean,false) then raise exception 'SHIPMENT_SPLIT_NOT_ALLOWED' using errcode='PT400';end if;
 fingerprint:=case when resources is null then '' else private.hash_v2_freight_payload(resources) end;
 if resources is not null and (p_candidate->'poolId'<>'null'::jsonb or resources->0->>'calendarId' is distinct from p_candidate->>'calendarId' or resources->0->>'assetId' is distinct from p_candidate->>'assetId'
   or (select count(distinct x->>'calendarId') from jsonb_array_elements(resources) x)<>resource_count
   or (select count(distinct x->>'assetId') from jsonb_array_elements(resources) x)<>resource_count)
 then raise exception 'INVALID_QUOTE_CANDIDATE' using errcode='PT400';end if;
 h:=private.hash_v2_freight_payload(jsonb_build_object('request',p_request_id,'version',p_expected_version,'deadline',p_deadline,'candidate',p_candidate));
 perform pg_advisory_xact_lock(hashtextextended('quote-command:'||p_member_id||':'||p_key,0));
 select * into r from private.quote_command_receipts where actor_id=p_member_id and key=p_key and scope='request';
 if found then if r.payload_hash<>h then raise exception 'IDEMPOTENCY_CONFLICT' using errcode='PT409';end if;return r.result;end if;
 select * into s from public.carrier_services where id=sid and active and transport_mode='ROAD' and service_type='FTL';
 if s.id is null or not exists(select 1 from public.service_lanes where id=lane and carrier_service_id=sid and active)
  or not exists(select 1 from public.capacity_calendars cc where cc.id=cal and cc.carrier_service_id=sid
   and cc.transport_asset_id is not distinct from (p_candidate->>'assetId')::uuid and cc.capacity_pool_id is not distinct from (p_candidate->>'poolId')::uuid)
 then raise exception 'INVALID_QUOTE_CANDIDATE' using errcode='PT400';end if;
 if resources is not null and exists(select 1 from jsonb_array_elements(resources) x where not exists(select 1 from public.capacity_calendars cc join public.transport_assets a on a.id=cc.transport_asset_id where cc.id=(x->>'calendarId')::uuid and cc.carrier_service_id=sid and a.id=(x->>'assetId')::uuid and a.carrier_service_id=sid and a.active and a.mode='ROAD')) then raise exception 'INVALID_QUOTE_CANDIDATE' using errcode='PT400';end if;
 select d.result into result from private.quote_dispatches d where request_id=q.id and request_version=q.draft_version and service_id=sid and lane_id=lane and calendar_id=cal and resource_fingerprint=fingerprint;
 if result is not null then
  plan:=private.workflow_record('plans',(result->>'planId')::uuid);opp:=private.workflow_record('opportunities',(result->>'opportunityId')::uuid);
  if not private.workflow_current_plan((plan->>'id')::uuid) then raise exception 'PLAN_REQUIRES_REVIEW' using errcode='PT409';end if;
  select id into current_offer from public.v2_carrier_offers where parent_id=(result->>'opportunityId')::uuid and private.workflow_offer_current(id) order by created_at desc,id limit 1;
  if current_offer is not null then
   result:=result||jsonb_build_object('offerId',current_offer,'status','OFFERED','reason','CURRENT_CARRIER_QUOTE');
   insert into private.quote_command_receipts values(p_member_id,p_key,'request',h,result);return result;
  end if;
  if opp->>'status' in('DECLINED','CANCELLED') then
   result:=result||jsonb_build_object('offerId',null,'status','REQUIRES_REVIEW','reason','CARRIER_DECLINED');
   insert into private.quote_command_receipts values(p_member_id,p_key,'request',h,result);return result;
  end if;
  if (opp#>>'{data,responseDeadline}')::timestamptz>now() then
   reuse_plan:=true;
   select private.workflow_record('routes',route_plan_id) into route from public.transport_plan_candidates where id=(plan->>'id')::uuid;
   select id into supersedes from public.v2_carrier_offers where parent_id=(opp->>'id')::uuid and status='RECEIVED' order by created_at desc,id limit 1;
  end if;
 end if;
 -- This first automatic adapter handles one direct ROAD leg. Ambiguous/multi-leg routes remain manual.
 select count(*),(array_agg(c.id order by c.id))[1] into corridor_count,corridor from public.route_corridors c
 join public.logistics_nodes n1 on n1.id=(c.data->>'originNodeId')::uuid join public.logistics_nodes n2 on n2.id=(c.data->>'destinationNodeId')::uuid
 where c.status='ACTIVE' and n1.status='ACTIVE' and n2.status='ACTIVE' and c.data->>'mode'='ROAD'
 and n1.data#>>'{location,countryCode}'=q.v2_snapshot#>>'{origin,countryCode}' and n2.data#>>'{location,countryCode}'=q.v2_snapshot#>>'{destination,countryCode}'
 and exists(select 1 from public.route_resource_limits limits where limits.status='ACTIVE' and limits.carrier_service_id=sid and limits.corridor_id=c.id
  and limits.combination_id is null and (limits.asset_id is null or limits.asset_id=(p_candidate->>'assetId')::uuid))
 and (resources is null or not exists(select 1 from jsonb_array_elements(resources) x where not exists(select 1 from public.route_resource_limits ll where ll.status='ACTIVE' and ll.carrier_service_id=sid and ll.corridor_id=c.id and ll.combination_id is null and (ll.asset_id is null or ll.asset_id=(x->>'assetId')::uuid))))
 and lower(n1.data#>>'{location,city}')=lower(q.v2_snapshot#>>'{origin,city}') and lower(n2.data#>>'{location,city}')=lower(q.v2_snapshot#>>'{destination,city}');
 select id into route_policy from public.route_planning_policies where status='ACTIVE' order by id limit 1;
 result:=jsonb_build_object('serviceId',sid,'planId',null,'opportunityId',null,'offerId',null,'status','REQUIRES_REVIEW','reason','PUBLISHED_DIRECT_ROUTE_REQUIRED','policyVersion',null);
 if not reuse_plan and (corridor_count<>1 or route_policy is null) then
  insert into private.quote_command_receipts values(p_member_id,p_key,'request',h,result);return result;
 end if;
 ctx:=jsonb_build_object('requestId',q.id,'carrierId',null,'parentId',null,'id',null);
 begin
  if not reuse_plan then
  route:=private.command_v2_workflow(p_organization_id,p_member_id,'routes.create',ctx,gen_random_uuid(),jsonb_build_object('schemaVersion','2.0','corridorIds',jsonb_build_array(corridor),'policyId',route_policy))->'record';
  if resources is null then
  select jsonb_agg(jsonb_build_object('unitIndex',idx-1,'quantity',(unit->>'quantity')::integer) order by idx) into allocations
   from jsonb_array_elements(q.v2_snapshot#>'{cargoSpecification,units}') with ordinality x(unit,idx);
  resources:=jsonb_build_array(jsonb_build_object('calendarId',cal,'assetId',p_candidate->'assetId','poolId',p_candidate->'poolId','allocations',allocations));
  end if;
  select jsonb_agg(jsonb_build_object('calendarId',x->'calendarId','assetId',x->'assetId','capacityPoolId',x->'poolId','combinationId',null,'role','LOAD_BEARING','allocations',x->'allocations') order by n) into resources from jsonb_array_elements(resources) with ordinality r(x,n);
  plan:=private.command_v2_workflow(p_organization_id,p_member_id,'plans.create',ctx,gen_random_uuid(),jsonb_build_object('schemaVersion','2.0','routeId',route->>'id','assignments',jsonb_build_array(
   jsonb_build_object('legSequence',1,'serviceId',sid,'laneId',lane,'window',jsonb_build_object('startsAt',q.v2_snapshot#>>'{pickupWindow,startsAt}','endsAt',q.v2_snapshot#>>'{deliveryWindow,endsAt}'),
    'resources',resources))))->'record';
  end if;
  if plan#>>'{data,eligibility}'<>'eligible' or not private.workflow_current_plan((plan->>'id')::uuid) then raise exception 'PLAN_REQUIRES_REVIEW' using errcode='PT422';end if;
  select jsonb_agg(x->'id') into assignments from jsonb_array_elements(plan#>'{data,legAssignments}') x;
  if not reuse_plan then
   opp:=private.command_v2_workflow(p_organization_id,p_member_id,'opportunities.create',ctx,gen_random_uuid(),jsonb_build_object('schemaVersion','2.0','planId',plan->>'id','carrierId',s.carrier_id,'assignmentIds',assignments,'responseDeadline',p_deadline,'responseChannel','MANUAL'))->'record';
  end if;
  result:=result||jsonb_build_object('planId',plan->'id','opportunityId',opp->'id','status','AWAITING_CARRIER','reason','MANUAL_QUOTE_REQUIRED');
  select * into p from private.carrier_quote_policies where carrier_id=s.carrier_id and service_id=sid and lane_id=lane for share;
  if p.id is not null and (p.value->>'active')::boolean and (p.value->>'autoIssue')::boolean and (p.value->>'validUntil')::timestamptz>=q.delivery_window_end
   and resource_count<=coalesce((p.value->>'maxResources')::integer,1) and (resource_count=1 or p.value->>'resourcePricing' in('PER_PLAN','PER_RESOURCE')) then
   offer_id:=gen_random_uuid();
   insert into private.quote_issue_context values(pg_backend_pid(),txid_current(),auth.uid(),p.id,offer_id);
   if (private.active_quote_delegation(s.carrier_id)).id is null then delete from private.quote_issue_context where backend_pid=pg_backend_pid() and transaction_id=txid_current();
   else
    distance:=(route#>>'{data,estimatedDistanceKm}')::numeric;
    if p.value->>'basis'='PER_KM' and (distance is null or distance<=0) then
     delete from private.quote_issue_context where backend_pid=pg_backend_pid() and transaction_id=txid_current();
     result:=result||jsonb_build_object('reason','TARIFF_DISTANCE_UNKNOWN');
    else
     expiry:=least(p_deadline,(opp#>>'{data,responseDeadline}')::timestamptz,(p.value->>'validUntil')::timestamptz,now()+make_interval(mins=>(p.value->>'validityMinutes')::integer));
     ev:=jsonb_build_object('reference','quote-policy:'||p.id||':v'||p.version,'provider','Carrier-approved tariff','observedAt',p.updated_at,'validUntil',p.value->>'validUntil',
      'provenanceStatus',p.value->>'provenanceStatus');
     pricing_factor:=case when p.value->>'resourcePricing'='PER_RESOURCE' then resource_count else 1 end;
     transport:=pricing_factor*greatest((p.value->>'minimumAmount')::numeric,round((p.value->>'baseAmount')::numeric+case when p.value->>'basis'='PER_KM' then distance*(p.value->>'ratePerKm')::numeric else 0 end,2));total:=transport;
     parts:=jsonb_build_array(jsonb_build_object('kind','TRANSPORT','amount',jsonb_build_object('amount',transport,'currency','USD'),'treatment','QUOTED','source',ev,'observedAt',now(),'details',p.value->>'terms'));
     for component in select value from jsonb_array_elements(jsonb_build_array(jsonb_build_object('kind','FUEL','amount',p.value->'fuelAmount'),jsonb_build_object('kind','TOLL','amount',p.value->'tollAmount'),jsonb_build_object('kind','HANDLING','amount',p.value->'handlingAmount'),jsonb_build_object('kind','TAX','amount',p.value->'taxAmount'))) loop
      total:=total+pricing_factor*(component->>'amount')::numeric;
      parts:=parts||jsonb_build_array(jsonb_build_object('kind',component->>'kind','amount',jsonb_build_object('amount',pricing_factor*(component->>'amount')::numeric,'currency','USD'),'treatment','QUOTED','source',ev,'observedAt',now(),'details','Carrier policy component'));
     end loop;
     v:=jsonb_build_object('schemaVersion','2.0','carrierReference','AUTO-'||left(offer_id::text,8),'planCandidateId',plan->'id','coveredServiceIds',jsonb_build_array(sid),'coveredAssignmentIds',assignments,
      'price',jsonb_build_object('amount',total,'currency','USD'),'breakdown',parts,'validity',jsonb_build_object('startsAt',now(),'endsAt',expiry),'issuedAt',now(),
      'estimatedPickupAt',q.v2_snapshot#>'{pickupWindow,startsAt}','estimatedDeliveryAt',q.v2_snapshot#>'{deliveryWindow,startsAt}',
      'transitDurationSeconds',route#>'{data,estimatedDurationSeconds}','reservableCapacity',jsonb_build_object('weightKg',q.v2_snapshot#>'{cargoSpecification,totalWeightKg}','volumeM3',q.v2_snapshot#>'{cargoSpecification,totalVolumeM3}'),
      'commercialTerms',jsonb_build_array(jsonb_build_object('code','CARRIER_POLICY','description',(p.value->>'terms')||' | resources='||resource_count||'; pricing='||coalesce(p.value->>'resourcePricing','PER_PLAN')),jsonb_build_object('code','CONFIRMATION_WINDOW_MINUTES','description',p.value->>'confirmationMinutes')),
      'evidence',jsonb_build_array(ev),'source',jsonb_build_object('channel','API','evidence',ev),'supersedesOfferId',supersedes);
     perform private.workflow_validate('offers.create',v);
     -- Use the same grouped-leg to resource-binding adapter as the native Carrier command.
     v:=jsonb_set(v,'{coveredAssignmentIds}',private.expand_leg_assignments(v->'coveredAssignmentIds',(v->>'planCandidateId')::uuid));
     offer:=private.workflow_offer(null,p.operator_id,s.carrier_id,(opp->>'id')::uuid,v,offer_id);
     insert into private.quote_issued_offers values(offer_id,p.id,p.version,p.value,now());
     delete from private.quote_issue_context where backend_pid=pg_backend_pid() and transaction_id=txid_current();
     result:=result||jsonb_build_object('offerId',offer_id,'status','OFFERED','reason','CARRIER_POLICY_QUOTE','policyVersion',p.version);
    end if;
   end if;
  end if;
  insert into private.quote_dispatches(request_id,request_version,service_id,lane_id,calendar_id,result,created_at,resource_fingerprint) values(q.id,q.draft_version,sid,lane,cal,result,now(),fingerprint)
   on conflict(request_id,request_version,service_id,lane_id,calendar_id,resource_fingerprint) do update set result=excluded.result,created_at=excluded.created_at;
 exception when sqlstate 'PT422' or sqlstate 'PT409' or sqlstate 'PT400' then
  get stacked diagnostics reason=message_text;
  result:=jsonb_build_object('serviceId',sid,'planId',null,'opportunityId',null,'offerId',null,'status','REQUIRES_REVIEW','reason',reason,'policyVersion',null);
 end;
 insert into private.quote_command_receipts values(p_member_id,p_key,'request',h,result);return result;
end;$$;


revoke all on function public.configure_v2_quote_policy(uuid,uuid,uuid,integer,jsonb),public.request_v2_carrier_quote(uuid,uuid,uuid,integer,uuid,timestamptz,jsonb) from public,anon,service_role;
grant execute on function public.configure_v2_quote_policy(uuid,uuid,uuid,integer,jsonb),public.request_v2_carrier_quote(uuid,uuid,uuid,integer,uuid,timestamptz,jsonb) to authenticated;
commit;

create or replace function private.workflow_build_plan(o uuid,qid uuid,v jsonb,pid uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare a jsonb;r jsonb;flat jsonb:='[]';meta jsonb:='[]';gid uuid;rid uuid;begin
 select id into rid from public.route_plans where id=(v->>'routeId')::uuid and organization_id=o and freight_request_id=qid for update;
 if rid is null then raise exception 'WORKFLOW_NOT_FOUND' using errcode='PT404';end if;
 if exists(select 1 from public.transport_plan_candidates where route_plan_id=rid) then rid:=private.clone_plan_route(rid);end if;
 for a in select value from jsonb_array_elements(v->'assignments') loop
  if a ? 'resources' then gid:=gen_random_uuid();else gid:=null;end if;
  for r in select value from jsonb_array_elements(case when a ? 'resources' then a->'resources' else jsonb_build_array(a) end) loop
   flat:=flat||jsonb_build_array((a-'resources')||r);
   meta:=meta||jsonb_build_array(jsonb_build_object('groupId',gid,'sequence',a->'legSequence','serviceId',a->'serviceId',
    'calendarId',r->'calendarId','assetId',r->'assetId','poolId',r->'capacityPoolId'));
  end loop;
 end loop;
 if exists(select 1 from jsonb_array_elements(meta) x
  group by x->>'sequence',x->>'serviceId',x->>'calendarId',x->>'assetId',x->>'poolId'
  having count(*)>1 and bool_or(x->>'groupId' is not null))
 then raise exception 'DUPLICATE_PLAN_RESOURCE' using errcode='PT400';end if;
 -- Non-splittable means one carrying resource per leg, independently of channel.
 if not coalesce((select (v2_snapshot#>>'{cargoSpecification,divisible}')::boolean from public.freight_requests where id=qid and organization_id=o),false)
 and exists(select 1 from jsonb_array_elements(flat) x where x->>'role'='LOAD_BEARING' group by x->>'legSequence' having count(*)>1)
 then raise exception 'SHIPMENT_SPLIT_NOT_ALLOWED' using errcode='PT400';end if;
 perform set_config('cargomesh.f05_groups',meta::text,true);
 perform private.workflow_build_plan_before_f05(o,qid,jsonb_set(jsonb_set(v,'{routeId}',to_jsonb(rid)),'{assignments}',flat),pid);
 perform set_config('cargomesh.f05_groups','',true);
 for a in select value from jsonb_array_elements(private.workflow_record('plans',pid)#>'{data,legAssignments}') loop
  update public.plan_leg_assignments set data=a-'id'-'resources' where id=(a->>'id')::uuid;
 end loop;
 return private.workflow_record('plans',pid);
end;$$;
revoke all on function private.workflow_build_plan(uuid,uuid,jsonb,uuid) from public,anon,authenticated,service_role;

-- Coarse, allowlisted cargo allocation; no asset identifiers, contacts or addresses.
create or replace function private.carrier_opportunity_projection(r jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare d jsonb:=r->'data'; brief jsonb; q public.freight_requests; p public.transport_plan_candidates;
 origin jsonb;destination jsonb;assignments jsonb; current_revision boolean;begin
 if r->>'kind'<>'opportunities' then return r;end if;
 select * into q from public.freight_requests where id=(r->>'requestId')::uuid and organization_id=(r->>'organizationId')::uuid;
 select * into p from public.transport_plan_candidates where id=(d->>'planId')::uuid and freight_request_id=q.id and organization_id=q.organization_id;
 current_revision:=coalesce(p.request_version=q.draft_version and coalesce((d#>>'{requestBrief,requestVersion}')::integer,p.request_version)=q.draft_version,false);
 -- Legacy invitations can only recover windows when their evaluated revision is current.
 brief:=case when d#>>'{requestBrief,schemaVersion}'='1.0' then d->'requestBrief'
  when current_revision then private.carrier_request_brief(q)
  else jsonb_build_object('schemaVersion','1.0','requestId',r->'requestId','requestCode',q.code,
   'requestVersion',p.request_version,'customerRef',r->'organizationId','pickupWindow',null,'deliveryWindow',null,
   'acceptedModes',null,'requiredEquipment',null,'preferredEquipment',null,
   'contactsVisibility','WITHHELD','locationPrecision','CITY') end;
 brief:=brief||jsonb_build_object('currentRequestVersion',q.draft_version,'isCurrent',current_revision,
  'canReview',current_revision and q.status='PENDING' and p.status<>'ineligible','requestStatus',q.status,
  'planEligibility',p.status,'pendingRequirements',coalesce(p.data->'pendingRequirements','[]'::jsonb),
  'exclusionReasons',coalesce(p.data->'exclusionReasons','[]'::jsonb));
 -- Reconstruct canonical coarse locations. Never copy an address, Facility ID or coordinates.
 origin:=jsonb_build_object('facilityId',null,'label',d#>>'{origin,city}','city',d#>>'{origin,city}',
  'countryCode',d#>>'{origin,countryCode}','region',d#>'{origin,region}','lat',null,'lng',null);
 destination:=jsonb_build_object('facilityId',null,'label',d#>>'{destination,city}','city',d#>>'{destination,city}',
  'countryCode',d#>>'{destination,countryCode}','region',d#>'{destination,region}','lat',null,'lng',null);
 select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id',s->'id','serviceId',s->'serviceId',
  'legAssignmentId',s->'legAssignmentId','window',s->'window',
  'allocationSummary',case when s#>>'{resource,role}' in('LOAD_BEARING','AUXILIARY') then jsonb_build_object(
   'role',s#>'{resource,role}','equipment',s#>'{resource,equipment}',
   'units',(select coalesce(jsonb_agg(jsonb_build_object('unitIndex',u.unit_index,'quantity',u.quantity,'weightKg',u.assigned_weight_kg,'volumeM3',u.assigned_volume_m3) order by u.unit_index),'[]'::jsonb) from public.load_allocations u join public.plan_resource_bindings b on b.id=u.assignment_id where b.id=(s->>'id')::uuid and b.plan_id=p.id and b.carrier_service_id=(s->>'serviceId')::uuid)) else null end))),'[]'::jsonb) into assignments
 from jsonb_array_elements(coalesce(d->'assignmentSnapshots','[]'::jsonb)) s;
 -- Explicit allowlist: request contacts, documents and opaque resource snapshots are withheld.
 d:=jsonb_build_object('schemaVersion',d->'schemaVersion','planId',d->'planId','carrierId',r->'carrierId',
  'assignmentIds',d->'assignmentIds','responseDeadline',d->'responseDeadline','responseChannel',d->'responseChannel',
  'sentAt',d->'sentAt','origin',origin,'destination',destination,'assignmentSnapshots',assignments,
  'cargoSpecification',(d->'cargoSpecification')-'availableDocuments',
  'pickupWindow',brief->'pickupWindow','deliveryWindow',brief->'deliveryWindow','requestBrief',brief)
  ||(select coalesce(jsonb_object_agg(key,value),'{}'::jsonb) from jsonb_each(r->'data')
     where key in ('response','responseNote','responseEvidence','respondedAt','respondedBy'));
 return jsonb_set(r,'{data}',d);
end;$$;
revoke all on function private.carrier_opportunity_projection(jsonb) from public,anon,authenticated,service_role;

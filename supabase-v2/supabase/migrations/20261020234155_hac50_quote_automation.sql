-- Carrier-approved automatic quotes. No demo data, credentials, holds or bookings.
begin;
create table private.carrier_quote_policies(
 id uuid primary key default gen_random_uuid(),carrier_id uuid not null references public.carriers(id),
 service_id uuid not null references public.carrier_services(id),lane_id uuid not null references public.service_lanes(id),
 operator_id uuid not null,auth_user_id uuid not null references auth.users(id),version integer not null check(version>0),
 value jsonb not null check(jsonb_typeof(value)='object'),updated_at timestamptz not null default now(),
 unique(carrier_id,service_id,lane_id),foreign key(operator_id,carrier_id) references public.carrier_operators(id,carrier_id)
);
create index quote_policy_service_idx on private.carrier_quote_policies(service_id);
create index quote_policy_lane_idx on private.carrier_quote_policies(lane_id);
create index quote_policy_operator_idx on private.carrier_quote_policies(operator_id);
create index quote_policy_auth_idx on private.carrier_quote_policies(auth_user_id);
create table private.quote_command_receipts(
 actor_id uuid not null,key uuid not null,scope text not null,payload_hash text not null,result jsonb not null,
 primary key(actor_id,key,scope),check(payload_hash~'^[a-f0-9]{64}$')
);
create table private.quote_dispatches(
 request_id uuid not null references public.freight_requests(id),request_version integer not null check(request_version>0),
 service_id uuid not null references public.carrier_services(id),lane_id uuid not null references public.service_lanes(id),
 calendar_id uuid not null references public.capacity_calendars(id),result jsonb not null,
 created_at timestamptz not null default now(),primary key(request_id,request_version,service_id,lane_id,calendar_id)
);
create index quote_dispatch_service_idx on private.quote_dispatches(service_id);
create index quote_dispatch_lane_idx on private.quote_dispatches(lane_id);
create index quote_dispatch_calendar_idx on private.quote_dispatches(calendar_id);
create table private.quote_issue_context(
 backend_pid integer not null,transaction_id bigint not null,user_id uuid not null,
 policy_id uuid not null references private.carrier_quote_policies(id),offer_id uuid not null,
 primary key(backend_pid,transaction_id)
);
create index quote_issue_policy_idx on private.quote_issue_context(policy_id);
create table private.quote_issued_offers(
 offer_id uuid primary key references public.v2_carrier_offers(id),policy_id uuid not null references private.carrier_quote_policies(id),
 policy_version integer not null check(policy_version>0),policy_snapshot jsonb not null check(jsonb_typeof(policy_snapshot)='object'),issued_at timestamptz not null default now()
);
create index quote_issued_policy_idx on private.quote_issued_offers(policy_id);
alter table private.carrier_quote_policies enable row level security;
alter table private.quote_command_receipts enable row level security;
alter table private.quote_dispatches enable row level security;
alter table private.quote_issue_context enable row level security;
alter table private.quote_issued_offers enable row level security;
revoke all on private.carrier_quote_policies,private.quote_command_receipts,private.quote_dispatches,private.quote_issue_context,private.quote_issued_offers from public,anon,authenticated,service_role;

create function private.quote_policy_record(p private.carrier_quote_policies) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('id',p.id,'carrierId',p.carrier_id,'serviceId',p.service_id,'laneId',p.lane_id,'version',p.version,'value',p.value,'updatedAt',p.updated_at);
$$;
create function public.configure_v2_quote_policy(p_carrier_id uuid,p_operator_id uuid,p_key uuid,p_expected_version integer,p_value jsonb default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare p private.carrier_quote_policies;r private.quote_command_receipts;h text;result jsonb;begin
 if p_operator_id is distinct from private.identity_carrier(p_carrier_id) then raise exception 'FORBIDDEN_CARRIER_IDENTITY' using errcode='PT403';end if;
 if p_value is null then
  return coalesce((select jsonb_agg(private.quote_policy_record(x) order by x.service_id,x.lane_id) from private.carrier_quote_policies x where x.carrier_id=p_carrier_id),'[]'::jsonb);
 end if;
 perform private.identity_carrier_action(p_carrier_id,'limits.publish'); -- ADMIN approval, not a shipper grant.
 if p_key is null or p_expected_version is null or p_expected_version<0 or not coalesce(extensions.jsonb_matches_schema($policy_schema${"type":"object","additionalProperties":false,"required":["schemaVersion","serviceId","laneId","active","autoIssue","basis","baseAmount","ratePerKm","minimumAmount","fuelAmount","tollAmount","handlingAmount","taxAmount","validityMinutes","confirmationMinutes","validUntil","terms","provenanceStatus","acknowledgeAuthority"],"properties":{"schemaVersion":{"const":"2.0"},"serviceId":{"type":"string","format":"uuid"},"laneId":{"type":"string","format":"uuid"},"active":{"type":"boolean"},"autoIssue":{"type":"boolean"},"basis":{"enum":["PER_TRIP","PER_KM"]},"baseAmount":{"type":"number","minimum":0,"maximum":100000000},"ratePerKm":{"type":"number","minimum":0,"maximum":100000000},"minimumAmount":{"type":"number","minimum":0,"maximum":100000000},"fuelAmount":{"type":"number","minimum":0,"maximum":100000000},"tollAmount":{"type":"number","minimum":0,"maximum":100000000},"handlingAmount":{"type":"number","minimum":0,"maximum":100000000},"taxAmount":{"type":"number","minimum":0,"maximum":100000000},"validityMinutes":{"type":"integer","minimum":5,"maximum":1440},"confirmationMinutes":{"type":"integer","minimum":5,"maximum":1440},"validUntil":{"type":"string","format":"date-time"},"terms":{"type":"string","minLength":1,"maxLength":2000},"provenanceStatus":{"enum":["VERIFIED","SIMULATED"]},"acknowledgeAuthority":{"const":true}}}$policy_schema$::json,p_value),false)
 then raise exception 'VALIDATION_ERROR' using errcode='PT400';end if;
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

-- Delegation exists only inside this trusted transaction, for one approved policy and offer ID.
create function private.active_quote_delegation(c uuid) returns private.carrier_quote_policies language plpgsql security definer set search_path='' as $$
declare p private.carrier_quote_policies;begin
 select pp.* into p from private.quote_issue_context ctx join private.carrier_quote_policies pp on pp.id=ctx.policy_id
 join public.carrier_operators op on op.id=pp.operator_id and op.carrier_id=pp.carrier_id
 where ctx.backend_pid=pg_backend_pid() and ctx.transaction_id=txid_current() and ctx.user_id=auth.uid() and pp.carrier_id=c
  and (pp.value->>'active')::boolean and (pp.value->>'autoIssue')::boolean and (pp.value->>'validUntil')::timestamptz>now()
  and op.status='ACTIVE' and op.role='ADMIN' and op.auth_user_id=pp.auth_user_id and op.verified_at<=now()
  and exists(select 1 from private.v2_catalog_grants g where g.auth_user_id=pp.auth_user_id and g.revoked_at is null
   and (g.expires_at is null or g.expires_at>now()) and (g.permission='CATALOG_ADMIN' or g.permission='CARRIER_EDITOR' and g.carrier_id=c));
 return p;
end;$$;
alter function private.workflow_carrier(uuid) rename to workflow_carrier_before_quote_automation;
create function private.workflow_carrier(c uuid) returns void language plpgsql security definer set search_path='' as $$
declare p private.carrier_quote_policies;begin
 p:=private.active_quote_delegation(c);if p.id is null then perform private.workflow_carrier_before_quote_automation(c);end if;
end;$$;
create or replace function private.guard_offer_issuer() returns trigger language plpgsql security definer set search_path='' as $$
declare op uuid;p private.carrier_quote_policies;begin
 if tg_op='UPDATE' then
  if new.issuer_operator_id is distinct from old.issuer_operator_id or new.issuer_auth_user_id is distinct from old.issuer_auth_user_id
   or new.issuer_member_id is distinct from old.issuer_member_id or new.data->'source' is distinct from old.data->'source'
  then raise exception 'IMMUTABLE_OFFER_ISSUER' using errcode='PT400';end if;return new;
 end if;
 p:=private.active_quote_delegation(new.carrier_id);
 if p.id is not null and new.data#>>'{source,channel}'='API' and exists(select 1 from private.quote_issue_context x
  where x.backend_pid=pg_backend_pid() and x.transaction_id=txid_current() and x.user_id=auth.uid() and x.offer_id=new.id and x.policy_id=p.id)
 then new.issuer_operator_id:=p.operator_id;new.issuer_auth_user_id:=p.auth_user_id;new.issuer_member_id:=null;
  new.data:=jsonb_set(new.data,'{source,issuerId}',to_jsonb(p.operator_id));return new;
 end if;
 op:=private.identity_carrier(new.carrier_id);
 if new.data#>>'{source,channel}' is distinct from 'MANUAL' then raise exception 'INTEGRATION_ADAPTER_REQUIRED' using errcode='PT403';end if;
 new.issuer_operator_id:=op;new.issuer_auth_user_id:=auth.uid();
 select id into new.issuer_member_id from public.organization_members where id=(new.data#>>'{source,issuerId}')::uuid and auth_user_id=auth.uid();
 new.data:=jsonb_set(new.data,'{source,issuerId}',to_jsonb(op));return new;
end;$$;

create function public.request_v2_carrier_quote(p_organization_id uuid,p_member_id uuid,p_request_id uuid,p_expected_version integer,
 p_key uuid,p_deadline timestamptz,p_candidate jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare q public.freight_requests;s public.carrier_services;p private.carrier_quote_policies;r private.quote_command_receipts;
 h text;ctx jsonb;route jsonb;plan jsonb;opp jsonb;offer jsonb;result jsonb;route_policy uuid;corridor uuid;corridor_count integer;
 allocations jsonb;assignments jsonb;offer_id uuid;expiry timestamptz;distance numeric;transport numeric;total numeric;component jsonb;parts jsonb;ev jsonb;v jsonb;
 sid uuid:=(p_candidate->>'serviceId')::uuid;lane uuid:=(p_candidate->>'laneId')::uuid;cal uuid:=(p_candidate->>'calendarId')::uuid;
 reason text;reuse_plan boolean:=false;supersedes uuid;current_offer uuid;begin
 perform private.workflow_member(p_organization_id,p_member_id,true);
 -- Keep the service -> request ordering used by fleet, crew and native workflow commands.
 perform 1 from public.carrier_services order by id for update;
 select * into q from public.freight_requests where id=p_request_id and organization_id=p_organization_id for update;
 if not found then raise exception 'REQUEST_NOT_FOUND' using errcode='PT404';end if;
 if p_expected_version is null or p_expected_version<>q.draft_version then raise exception 'STALE_DRAFT' using errcode='PT409';end if;
 if q.status<>'PENDING' then raise exception 'REQUEST_NOT_SUBMITTED' using errcode='PT409';end if;
 if p_key is null or p_deadline is null or p_deadline<=now() or p_deadline>q.pickup_window_start or not coalesce(extensions.jsonb_matches_schema(
 '{"type":"object","additionalProperties":false,"required":["serviceId","laneId","calendarId","assetId","poolId"],"properties":{"serviceId":{"type":"string","format":"uuid"},"laneId":{"type":"string","format":"uuid"},"calendarId":{"type":"string","format":"uuid"},"assetId":{"type":["string","null"],"format":"uuid"},"poolId":{"type":["string","null"],"format":"uuid"}}}'::json,p_candidate),false)
 then raise exception 'INVALID_QUOTE_SEARCH' using errcode='PT400';end if;
 h:=private.hash_v2_freight_payload(jsonb_build_object('request',p_request_id,'version',p_expected_version,'deadline',p_deadline,'candidate',p_candidate));
 perform pg_advisory_xact_lock(hashtextextended('quote-command:'||p_member_id||':'||p_key,0));
 select * into r from private.quote_command_receipts where actor_id=p_member_id and key=p_key and scope='request';
 if found then if r.payload_hash<>h then raise exception 'IDEMPOTENCY_CONFLICT' using errcode='PT409';end if;return r.result;end if;
 select * into s from public.carrier_services where id=sid and active and transport_mode='ROAD' and service_type='FTL';
 if s.id is null or not exists(select 1 from public.service_lanes where id=lane and carrier_service_id=sid and active)
  or not exists(select 1 from public.capacity_calendars cc where cc.id=cal and cc.carrier_service_id=sid
   and cc.transport_asset_id is not distinct from (p_candidate->>'assetId')::uuid and cc.capacity_pool_id is not distinct from (p_candidate->>'poolId')::uuid)
 then raise exception 'INVALID_QUOTE_CANDIDATE' using errcode='PT400';end if;
 select d.result into result from private.quote_dispatches d where request_id=q.id and request_version=q.draft_version and service_id=sid and lane_id=lane and calendar_id=cal;
 if result is not null then
  plan:=private.workflow_record('plans',(result->>'planId')::uuid);opp:=private.workflow_record('opportunities',(result->>'opportunityId')::uuid);
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
  select jsonb_agg(jsonb_build_object('unitIndex',idx-1,'quantity',(unit->>'quantity')::integer) order by idx) into allocations
   from jsonb_array_elements(q.v2_snapshot#>'{cargoSpecification,units}') with ordinality x(unit,idx);
  plan:=private.command_v2_workflow(p_organization_id,p_member_id,'plans.create',ctx,gen_random_uuid(),jsonb_build_object('schemaVersion','2.0','routeId',route->>'id','assignments',jsonb_build_array(
   jsonb_build_object('legSequence',1,'serviceId',sid,'laneId',lane,'window',jsonb_build_object('startsAt',q.v2_snapshot#>>'{pickupWindow,startsAt}','endsAt',q.v2_snapshot#>>'{deliveryWindow,endsAt}'),
    'resources',jsonb_build_array(jsonb_build_object('calendarId',cal,'assetId',p_candidate->'assetId','capacityPoolId',p_candidate->'poolId','combinationId',null,'role','LOAD_BEARING','allocations',allocations))))))->'record';
  end if;
  if plan#>>'{data,eligibility}'<>'eligible' or not private.workflow_current_plan((plan->>'id')::uuid) then raise exception 'PLAN_REQUIRES_REVIEW' using errcode='PT422';end if;
  select jsonb_agg(x->'id') into assignments from jsonb_array_elements(plan#>'{data,legAssignments}') x;
  if not reuse_plan then
   opp:=private.command_v2_workflow(p_organization_id,p_member_id,'opportunities.create',ctx,gen_random_uuid(),jsonb_build_object('schemaVersion','2.0','planId',plan->>'id','carrierId',s.carrier_id,'assignmentIds',assignments,'responseDeadline',p_deadline,'responseChannel','MANUAL'))->'record';
  end if;
  result:=result||jsonb_build_object('planId',plan->'id','opportunityId',opp->'id','status','AWAITING_CARRIER','reason','MANUAL_QUOTE_REQUIRED');
  select * into p from private.carrier_quote_policies where carrier_id=s.carrier_id and service_id=sid and lane_id=lane for share;
  if p.id is not null and (p.value->>'active')::boolean and (p.value->>'autoIssue')::boolean and (p.value->>'validUntil')::timestamptz>=q.delivery_window_end then
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
     transport:=greatest((p.value->>'minimumAmount')::numeric,round((p.value->>'baseAmount')::numeric+case when p.value->>'basis'='PER_KM' then distance*(p.value->>'ratePerKm')::numeric else 0 end,2));total:=transport;
     parts:=jsonb_build_array(jsonb_build_object('kind','TRANSPORT','amount',jsonb_build_object('amount',transport,'currency','USD'),'treatment','QUOTED','source',ev,'observedAt',now(),'details',p.value->>'terms'));
     for component in select value from jsonb_array_elements(jsonb_build_array(jsonb_build_object('kind','FUEL','amount',p.value->'fuelAmount'),jsonb_build_object('kind','TOLL','amount',p.value->'tollAmount'),jsonb_build_object('kind','HANDLING','amount',p.value->'handlingAmount'),jsonb_build_object('kind','TAX','amount',p.value->'taxAmount'))) loop
      total:=total+(component->>'amount')::numeric;
      parts:=parts||jsonb_build_array(jsonb_build_object('kind',component->>'kind','amount',jsonb_build_object('amount',component->'amount','currency','USD'),'treatment','QUOTED','source',ev,'observedAt',now(),'details','Carrier policy component'));
     end loop;
     v:=jsonb_build_object('schemaVersion','2.0','carrierReference','AUTO-'||left(offer_id::text,8),'planCandidateId',plan->'id','coveredServiceIds',jsonb_build_array(sid),'coveredAssignmentIds',assignments,
      'price',jsonb_build_object('amount',total,'currency','USD'),'breakdown',parts,'validity',jsonb_build_object('startsAt',now(),'endsAt',expiry),'issuedAt',now(),
      'estimatedPickupAt',q.v2_snapshot#>'{pickupWindow,startsAt}','estimatedDeliveryAt',q.v2_snapshot#>'{deliveryWindow,startsAt}',
      'transitDurationSeconds',route#>'{data,estimatedDurationSeconds}','reservableCapacity',jsonb_build_object('weightKg',q.v2_snapshot#>'{cargoSpecification,totalWeightKg}','volumeM3',q.v2_snapshot#>'{cargoSpecification,totalVolumeM3}'),
      'commercialTerms',jsonb_build_array(jsonb_build_object('code','CARRIER_POLICY','description',p.value->>'terms'),jsonb_build_object('code','CONFIRMATION_WINDOW_MINUTES','description',p.value->>'confirmationMinutes')),
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
  insert into private.quote_dispatches values(q.id,q.draft_version,sid,lane,cal,result,now())
   on conflict(request_id,request_version,service_id,lane_id,calendar_id) do update set result=excluded.result,created_at=excluded.created_at;
 exception when sqlstate 'PT422' or sqlstate 'PT409' or sqlstate 'PT400' then
  get stacked diagnostics reason=message_text;
  result:=jsonb_build_object('serviceId',sid,'planId',null,'opportunityId',null,'offerId',null,'status','REQUIRES_REVIEW','reason',reason,'policyVersion',null);
 end;
 insert into private.quote_command_receipts values(p_member_id,p_key,'request',h,result);return result;
end;$$;

create function public.rank_v2_request_quotes(p_organization_id uuid,p_member_id uuid,p_request_id uuid,p_expected_version integer,p_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare q public.freight_requests;policy uuid;r jsonb;begin
 perform private.workflow_member(p_organization_id,p_member_id,true);
 perform 1 from public.carrier_services order by id for update;
 select * into q from public.freight_requests where id=p_request_id and organization_id=p_organization_id for update;
 if not found then raise exception 'REQUEST_NOT_FOUND' using errcode='PT404';end if;
 if q.draft_version is distinct from p_expected_version then raise exception 'STALE_DRAFT' using errcode='PT409';end if;
 select id into policy from public.scoring_policies where status='ACTIVE' and data#>>'{policy,objective}'='LOWEST_COST' order by id limit 1;
 if policy is null then return jsonb_build_object('id',null,'notice','SCORING_POLICY_REQUIRED');end if;
 r:=private.command_v2_workflow(p_organization_id,p_member_id,'ranking.create',jsonb_build_object('requestId',q.id,'carrierId',null,'parentId',null,'id',null),p_key,jsonb_build_object('schemaVersion','2.0','policyId',policy));
 return jsonb_build_object('id',r#>'{record,id}','notice',null);
end;$$;

create function public.read_v2_quote_history(p_organization_id uuid,p_member_id uuid,p_request_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$declare q public.freight_requests;begin
 perform private.workflow_member(p_organization_id,p_member_id,false);
 select * into q from public.freight_requests where id=p_request_id and organization_id=p_organization_id;
 if not found then raise exception 'REQUEST_NOT_FOUND' using errcode='PT404';end if;
 return coalesce((select jsonb_agg(x.row order by x.created_at desc) from (
  select f.created_at,jsonb_build_object('requestId',f.id,'reference',f.code,'createdAt',f.created_at,
   'totalWeightKg',f.v2_snapshot#>'{cargoSpecification,totalWeightKg}','totalVolumeM3',f.v2_snapshot#>'{cargoSpecification,totalVolumeM3}',
   'quotedPrices',coalesce((select jsonb_agg(jsonb_build_object('amount',o.data#>'{price,amount}','currency',o.data#>'{price,currency}','issuedAt',o.data->'issuedAt','status',o.status,'basis','HISTORICAL_QUOTE_NOT_CURRENT_PRICE'))
   from public.v2_carrier_offers o where o.organization_id=p_organization_id and o.freight_request_id=f.id and o.data#>>'{price,currency}'='USD'),'[]'::jsonb)) as row
  from public.freight_requests f where f.organization_id=p_organization_id and f.id<>q.id and f.created_at<q.created_at
  and f.v2_snapshot#>>'{origin,city}'=q.v2_snapshot#>>'{origin,city}' and f.v2_snapshot#>>'{destination,city}'=q.v2_snapshot#>>'{destination,city}'
  and f.v2_snapshot#>>'{origin,countryCode}'=q.v2_snapshot#>>'{origin,countryCode}' and f.v2_snapshot#>>'{destination,countryCode}'=q.v2_snapshot#>>'{destination,countryCode}'
  and f.v2_snapshot#>>'{cargoSpecification,categoryCode}'=q.v2_snapshot#>>'{cargoSpecification,categoryCode}'
  and f.v2_snapshot#>'{cargoSpecification,requirements}'=q.v2_snapshot#>'{cargoSpecification,requirements}'
  and (f.v2_snapshot#>>'{cargoSpecification,totalWeightKg}')::numeric between (q.v2_snapshot#>>'{cargoSpecification,totalWeightKg}')::numeric/2 and (q.v2_snapshot#>>'{cargoSpecification,totalWeightKg}')::numeric*2
  and (f.v2_snapshot#>>'{cargoSpecification,totalVolumeM3}')::numeric between (q.v2_snapshot#>>'{cargoSpecification,totalVolumeM3}')::numeric/2 and (q.v2_snapshot#>>'{cargoSpecification,totalVolumeM3}')::numeric*2
  and f.v2_snapshot->>'requiredEquipment' is not distinct from q.v2_snapshot->>'requiredEquipment'
  order by f.created_at desc,f.id limit 5) x),'[]'::jsonb);
end;$$;

-- A selection remains pending until Carrier confirmation. A bounded extension requires Client consent.
create table private.quote_booking_windows(
 booking_id uuid primary key references public.v2_bookings(id),version integer not null default 1 check(version>0),
 deadline timestamptz not null,max_deadline timestamptz not null,proposed_deadline timestamptz,
 extension_used boolean not null default false,audit jsonb not null default '[]' check(jsonb_typeof(audit)='array'),check(deadline<=max_deadline),
 check(proposed_deadline is null or proposed_deadline<=max_deadline)
);
alter table private.quote_booking_windows enable row level security;
revoke all on private.quote_booking_windows from public,anon,authenticated,service_role;
create function private.guard_quote_confirmation() returns trigger language plpgsql security definer set search_path='' as $$
declare issued private.quote_issued_offers;offer public.v2_carrier_offers;w private.quote_booking_windows;minutes integer;deadline timestamptz;begin
 if tg_op='INSERT' then
  select * into issued from private.quote_issued_offers where offer_id=new.offer_id;
  if issued.offer_id is not null then
   select * into offer from public.v2_carrier_offers where id=new.offer_id;
   minutes:=(issued.policy_snapshot->>'confirmationMinutes')::integer;
   deadline:=least(now()+make_interval(mins=>minutes),(offer.data#>>'{validity,endsAt}')::timestamptz);
   if deadline<=now() then raise exception 'OFFER_EXPIRED' using errcode='PT409';end if;
   insert into private.quote_booking_windows(booking_id,deadline,max_deadline,audit) values(new.id,deadline,(offer.data#>>'{validity,endsAt}')::timestamptz,
    jsonb_build_array(jsonb_build_object('action','AUTHORIZED','at',now(),'actor',auth.uid())));
  end if;
 elsif old.status='AUTHORIZED' and new.status='CONFIRMED' then
  select * into w from private.quote_booking_windows where booking_id=new.id for update;
  if w.booking_id is not null and w.deadline<=now() then raise exception 'CONFIRMATION_DEADLINE_EXPIRED' using errcode='PT409';end if;
 end if;
 return new;
end;$$;
-- AFTER INSERT permits the private FK to reference the newly authorized booking.
create trigger quote_confirmation_created after insert on public.v2_bookings for each row execute function private.guard_quote_confirmation();
create trigger quote_confirmation_guard before update on public.v2_bookings for each row execute function private.guard_quote_confirmation();
create function private.guard_quote_hold_window() returns trigger language plpgsql security definer set search_path='' as $$
declare w private.quote_booking_windows;b public.v2_bookings;begin
 select * into w from private.quote_booking_windows where booking_id=new.booking_id;
 if w.booking_id is null then return new;end if;
 select * into b from public.v2_bookings where id=new.booking_id;
 if b.status='AUTHORIZED' then
  if new.status='CONFIRMED' and w.deadline<=now() then raise exception 'CONFIRMATION_DEADLINE_EXPIRED' using errcode='PT409';end if;
  if new.status='HELD' then new.expires_at:=least(new.expires_at,w.deadline);end if;
 end if;return new;
end;$$;
create trigger quote_hold_confirmation_guard before insert or update on public.capacity_reservations for each row execute function private.guard_quote_hold_window();
create function public.command_v2_quote_confirmation(p_organization_id uuid,p_member_id uuid,p_carrier_id uuid,p_operator_id uuid,
 p_booking_id uuid,p_action text,p_key uuid,p_expected_version integer,p_deadline timestamptz default null,p_reason text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare b public.v2_bookings;w private.quote_booking_windows;r private.quote_command_receipts;actor uuid;h text;result jsonb;ctx jsonb;ev jsonb;begin
 if p_organization_id is not null then
  perform private.workflow_member(p_organization_id,p_member_id,p_action<>'READ');actor:=p_member_id;
  if p_carrier_id is not null or p_operator_id is not null then raise exception 'INVALID_ACTOR' using errcode='PT403';end if;
 else
  if p_member_id is not null or p_operator_id is distinct from private.identity_carrier(p_carrier_id) then raise exception 'FORBIDDEN_CARRIER_IDENTITY' using errcode='PT403';end if;
  actor:=p_operator_id;
  if p_action<>'READ' then perform private.identity_carrier_action(p_carrier_id,'bookings.confirm');end if;
 end if;
 if p_action='READ' then
  select * into b from public.v2_bookings where id=p_booking_id and
   (p_organization_id is not null and organization_id=p_organization_id or p_organization_id is null and carrier_id=p_carrier_id);
 else
  -- Match native service -> booking -> window ordering before a cancellation can release capacity.
  perform 1 from public.carrier_services order by id for update;
  select * into b from public.v2_bookings where id=p_booking_id and
   (p_organization_id is not null and organization_id=p_organization_id or p_organization_id is null and carrier_id=p_carrier_id) for update;
 end if;
 if b.id is null then raise exception 'BOOKING_NOT_FOUND' using errcode='PT404';end if;
 if p_action='READ' then select * into w from private.quote_booking_windows where booking_id=b.id;
 else select * into w from private.quote_booking_windows where booking_id=b.id for update;end if;
 if not found then return null;end if;
 if p_action<>'READ' then
  if p_key is null or p_expected_version is null or btrim(coalesce(p_reason,''))='' or length(p_reason)>300 then raise exception 'VALIDATION_ERROR' using errcode='PT400';end if;
  h:=private.hash_v2_freight_payload(jsonb_build_object('booking',b.id,'action',p_action,'version',p_expected_version,'deadline',p_deadline,'reason',p_reason));
  perform pg_advisory_xact_lock(hashtextextended('quote-window:'||actor||':'||p_key,0));
  select * into r from private.quote_command_receipts where actor_id=actor and key=p_key and scope='confirmation';
  if found then if r.payload_hash<>h then raise exception 'IDEMPOTENCY_CONFLICT' using errcode='PT409';end if;return r.result;end if;
  if w.version<>p_expected_version then raise exception 'STALE_DRAFT' using errcode='PT409';end if;
  if b.status<>'AUTHORIZED' then raise exception 'BOOKING_NOT_PENDING' using errcode='PT409';end if;
  if p_action='PROPOSE' then
   if p_organization_id is not null then raise exception 'FORBIDDEN_WORKFLOW' using errcode='PT403';end if;
   if w.extension_used or p_deadline is null or p_deadline<=greatest(now(),w.deadline) or p_deadline>w.max_deadline then raise exception 'INVALID_EXTENSION' using errcode='PT400';end if;
   w.proposed_deadline:=p_deadline;w.extension_used:=true;
  elsif p_action in ('APPROVE','DECLINE') then
   if p_organization_id is null then raise exception 'CLIENT_CONSENT_REQUIRED' using errcode='PT403';end if;
   if w.proposed_deadline is null or w.proposed_deadline<=now() then raise exception 'EXTENSION_NOT_PENDING' using errcode='PT409';end if;
   if p_action='APPROVE' then w.deadline:=w.proposed_deadline;end if;w.proposed_deadline:=null;
  elsif p_action='EXPIRE' then
   if w.deadline>now() then raise exception 'CONFIRMATION_WINDOW_OPEN' using errcode='PT409';end if;
   ctx:=jsonb_build_object('requestId',null,'carrierId',p_carrier_id,'parentId',null,'id',b.id);
   ev:=jsonb_build_object('reference','CONFIRMATION_DEADLINE_EXPIRED','provider','CargoMesh','observedAt',now(),'validUntil',null,'provenanceStatus','VERIFIED');
   perform private.command_v2_workflow(p_organization_id,actor,'bookings.cancel',ctx,p_key,jsonb_build_object('schemaVersion','2.0','expectedVersion',b.version,'note',p_reason,'evidence',ev));
   select * into b from public.v2_bookings where id=b.id;
  else raise exception 'VALIDATION_ERROR' using errcode='PT400';end if;
  w.version:=w.version+1;w.audit:=w.audit||jsonb_build_array(jsonb_build_object('action',p_action,'at',now(),'actor',auth.uid(),'reason',p_reason,'deadline',w.deadline,'proposedDeadline',w.proposed_deadline));
  update private.quote_booking_windows set version=w.version,deadline=w.deadline,proposed_deadline=w.proposed_deadline,extension_used=w.extension_used,audit=w.audit where booking_id=b.id;
 end if;
 result:=jsonb_build_object('bookingId',b.id,'version',w.version,'bookingStatus',b.status,'deadline',w.deadline,'maxDeadline',w.max_deadline,'proposedDeadline',w.proposed_deadline,'extensionUsed',w.extension_used);
 if p_action<>'READ' then insert into private.quote_command_receipts values(actor,p_key,'confirmation',h,result);end if;return result;
end;$$;
revoke all on function private.guard_quote_confirmation(),private.guard_quote_hold_window() from public,anon,authenticated,service_role;
revoke all on function public.command_v2_quote_confirmation(uuid,uuid,uuid,uuid,uuid,text,uuid,integer,timestamptz,text) from public,anon,service_role;
grant execute on function public.command_v2_quote_confirmation(uuid,uuid,uuid,uuid,uuid,text,uuid,integer,timestamptz,text) to authenticated;
revoke all on function private.quote_policy_record(private.carrier_quote_policies),private.active_quote_delegation(uuid),private.workflow_carrier_before_quote_automation(uuid),private.workflow_carrier(uuid),private.guard_offer_issuer() from public,anon,authenticated,service_role;
revoke all on function public.configure_v2_quote_policy(uuid,uuid,uuid,integer,jsonb),public.request_v2_carrier_quote(uuid,uuid,uuid,integer,uuid,timestamptz,jsonb),public.rank_v2_request_quotes(uuid,uuid,uuid,integer,uuid),public.read_v2_quote_history(uuid,uuid,uuid) from public,anon,service_role;
grant execute on function public.configure_v2_quote_policy(uuid,uuid,uuid,integer,jsonb),public.request_v2_carrier_quote(uuid,uuid,uuid,integer,uuid,timestamptz,jsonb),public.rank_v2_request_quotes(uuid,uuid,uuid,integer,uuid),public.read_v2_quote_history(uuid,uuid,uuid) to authenticated;
notify pgrst,'reload schema';
commit;

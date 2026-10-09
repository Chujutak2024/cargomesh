-- HAC-41. Carrier principals have their own receipts and no invented shipper tenant.
create table private.v2_carrier_workflow_receipts (
 carrier_id uuid not null references public.carriers(id), operator_id uuid not null,
 idempotency_key uuid not null, payload_hash text not null check(payload_hash~'^[0-9a-f]{64}$'),
 result jsonb not null, created_at timestamptz not null default now(),
 primary key(carrier_id,operator_id,idempotency_key),
 foreign key(operator_id,carrier_id) references public.carrier_operators(id,carrier_id)
);
alter table private.v2_carrier_workflow_receipts enable row level security;
create index v2_carrier_workflow_receipts_operator_idx on private.v2_carrier_workflow_receipts(operator_id,carrier_id);
revoke all on private.v2_carrier_workflow_receipts from public,anon,authenticated,service_role;
create function private.workflow_actor(o uuid,m uuid,c uuid,w boolean) returns void
language plpgsql security definer set search_path='' as $$begin
 if o is not null then
  perform private.workflow_member(o,m,w);
  -- A shipper membership or catalog grant does not impersonate a carrier.
  if c is not null then perform private.identity_carrier(c);end if;
 else
  if c is null or w or m is distinct from private.identity_carrier(c) then
   raise exception 'FORBIDDEN_CARRIER_IDENTITY' using errcode='PT403';end if;
 end if;
end;$$;

create function private.workflow_receipt(o uuid,m uuid,c uuid,k uuid) returns private.v2_workflow_receipts
language plpgsql security definer set search_path='' as $$declare r private.v2_workflow_receipts;begin
 if o is not null then
  select * into r from private.v2_workflow_receipts where organization_id=o and member_id=m and idempotency_key=k;
 else
  select null::uuid,operator_id,idempotency_key,payload_hash,result,created_at into r
   from private.v2_carrier_workflow_receipts where carrier_id=c and operator_id=m and idempotency_key=k;
 end if;return r;
end;$$;
create function private.workflow_save_receipt(o uuid,m uuid,c uuid,k uuid,h text,r jsonb) returns void
language plpgsql security definer set search_path='' as $$begin
 if o is not null then
  insert into private.v2_workflow_receipts(organization_id,member_id,idempotency_key,payload_hash,result) values(o,m,k,h,r);
 else
  insert into private.v2_carrier_workflow_receipts(carrier_id,operator_id,idempotency_key,payload_hash,result) values(c,m,k,h,r);
 end if;
end;$$;

alter table public.v2_carrier_offers add column issuer_operator_id uuid,
 add column issuer_auth_user_id uuid references auth.users(id),
 add column issuer_member_id uuid references public.organization_members(id),
 add foreign key(issuer_operator_id,carrier_id) references public.carrier_operators(id,carrier_id);
create index v2_carrier_offers_issuer_idx on public.v2_carrier_offers(issuer_operator_id);
create index v2_carrier_offers_issuer_auth_idx on public.v2_carrier_offers(issuer_auth_user_id);
create index v2_carrier_offers_issuer_member_idx on public.v2_carrier_offers(issuer_member_id);
-- Keep legacy offers readable. New commitments require a real verified issuer.
alter function private.workflow_offer_current(uuid) rename to workflow_offer_current_before_identity;
create function private.workflow_offer_current(i uuid) returns boolean language sql
security definer set search_path='' as $$
 select private.workflow_offer_current_before_identity(i) and exists(
  select 1 from public.v2_carrier_offers offer join public.carrier_operators op
   on op.id=offer.issuer_operator_id and op.carrier_id=offer.carrier_id
  where offer.id=i and op.auth_user_id=offer.issuer_auth_user_id and op.status='ACTIVE'
   and op.verified_at is not null and op.verified_at<=now());
$$;
revoke all on function private.workflow_offer_current(uuid),private.workflow_offer_current_before_identity(uuid)
 from public,anon,authenticated,service_role;
create function private.identity_carrier_action(c uuid,a text) returns void language plpgsql
security definer set search_path='' as $$declare op uuid;role text;begin
 op:=private.identity_carrier(c);
 select carrier_operators.role into role from public.carrier_operators where id=op;
 if role='DISPATCHER' and split_part(a,'.',1) not in ('executions','incidents','asset-events','consolidations')
  or role<>'ADMIN' and a in ('limits.publish','metrics.publish') then
  raise exception 'FORBIDDEN_CARRIER_ROLE' using errcode='PT403';end if;
end;$$;
revoke all on function private.identity_carrier_action(uuid,text) from public,anon,authenticated,service_role;
create function private.guard_offer_issuer() returns trigger language plpgsql
security definer set search_path='' as $$declare op uuid;begin
 if tg_op='UPDATE' then
  if new.issuer_operator_id is distinct from old.issuer_operator_id
   or new.issuer_auth_user_id is distinct from old.issuer_auth_user_id
   or new.issuer_member_id is distinct from old.issuer_member_id
   or new.data->'source' is distinct from old.data->'source' then
   raise exception 'IMMUTABLE_OFFER_ISSUER' using errcode='PT400';end if;
  return new;
 end if;
 op:=private.identity_carrier(new.carrier_id);
 if new.data#>>'{source,channel}' is distinct from 'MANUAL' then
  -- An ordinary user cannot impersonate an external response adapter.
  raise exception 'INTEGRATION_ADAPTER_REQUIRED' using errcode='PT403';end if;
 new.issuer_operator_id:=op;new.issuer_auth_user_id:=auth.uid();
 select id into new.issuer_member_id from public.organization_members
  where id=(new.data#>>'{source,issuerId}')::uuid and auth_user_id=auth.uid();
 new.data:=jsonb_set(new.data,'{source,issuerId}',to_jsonb(op));
 return new;
end;$$;
create trigger offer_issuer_guard before insert or update on public.v2_carrier_offers
 for each row execute function private.guard_offer_issuer();

create function public.read_v2_carrier_workflow(p_operator_id uuid,p_kind text,p_context jsonb,p_limit integer,p_offset integer)
returns jsonb language plpgsql security definer set search_path='' as $$declare c uuid:=(p_context->>'carrierId')::uuid;begin
 if p_operator_id is distinct from private.identity_carrier(c) then raise exception 'FORBIDDEN_CARRIER_IDENTITY' using errcode='PT403';end if;
 if p_kind not in ('opportunities','offers','bookings','executions','incidents','incident-updates',
  'execution-events','holds','consolidations','asset-events','limits','metrics') or p_context->>'requestId' is not null then
  raise exception 'FORBIDDEN_WORKFLOW' using errcode='PT403';end if;
 return private.read_v2_workflow(null,p_operator_id,p_kind,p_context,p_limit,p_offset);
end;$$;
create function public.command_v2_carrier_workflow(p_operator_id uuid,p_action text,p_context jsonb,p_key uuid,p_value jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$declare c uuid:=(p_context->>'carrierId')::uuid;role text;begin
 if p_operator_id is distinct from private.identity_carrier(c) then raise exception 'FORBIDDEN_CARRIER_IDENTITY' using errcode='PT403';end if;
 if p_context->>'requestId' is not null or p_action not in ('opportunities.respond','offers.create','offers.withdraw',
  'bookings.confirm','bookings.cancel','holds.confirm','holds.release','executions.start','executions.complete',
  'executions.cancel','executions.position','incidents.create','incidents.update','incidents.conditions',
  'asset-events.create','consolidations.create','consolidations.close','consolidations.start','consolidations.complete',
  'consolidations.cancel','consolidations.position','limits.publish','metrics.publish') then
  raise exception 'FORBIDDEN_WORKFLOW' using errcode='PT403';end if;
 select carrier_operators.role into role from public.carrier_operators where id=p_operator_id;
 if role='DISPATCHER' and split_part(p_action,'.',1) not in ('executions','incidents','asset-events','consolidations')
  or role<>'ADMIN' and p_action in ('limits.publish','metrics.publish') then
  raise exception 'FORBIDDEN_CARRIER_ROLE' using errcode='PT403';end if;
 return private.command_v2_workflow(null,p_operator_id,p_action,p_context,p_key,p_value);
end;$$;
revoke all on function private.workflow_actor(uuid,uuid,uuid,boolean),
 private.workflow_receipt(uuid,uuid,uuid,uuid),private.workflow_save_receipt(uuid,uuid,uuid,uuid,text,jsonb),
 private.guard_offer_issuer() from public,anon,authenticated,service_role;
revoke all on function public.read_v2_carrier_workflow(uuid,text,jsonb,integer,integer),
 public.command_v2_carrier_workflow(uuid,text,jsonb,uuid,jsonb) from public,anon,service_role;
grant execute on function public.read_v2_carrier_workflow(uuid,text,jsonb,integer,integer),
 public.command_v2_carrier_workflow(uuid,text,jsonb,uuid,jsonb) to authenticated;

-- Preserves 20261004154048_hac40_workflow.sql (private.read_v2_workflow); only actor/receipt dispatch changes.
create or replace function private.read_v2_workflow(p_organization_id uuid,p_member_id uuid,p_kind text,p_context jsonb,p_limit integer,p_offset integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare t text;i uuid;c uuid:=(p_context->>'carrierId')::uuid;q uuid:=(p_context->>'requestId')::uuid;parent uuid:=(p_context->>'parentId')::uuid;
 ident uuid:=(p_context->>'id')::uuid;rows jsonb:='[]';r jsonb;begin
 perform private.workflow_actor(p_organization_id,p_member_id,(p_context->>'carrierId')::uuid,false);t:=private.workflow_table(p_kind);
 if p_limit not between 1 and 100 or p_offset not between 0 and 100000 or p_limit is null or p_offset is null then raise exception 'VALIDATION_ERROR' using errcode='PT400';end if;
 if c is not null then perform private.workflow_carrier(c);end if;
 if p_kind in ('limits','metrics','consolidations','asset-events') and c is null then raise exception 'FORBIDDEN_WORKFLOW' using errcode='PT403';end if;
 if q is not null then perform private.workflow_request(p_organization_id,q);end if;
 if parent is not null and p_kind in ('incidents','execution-events') then perform private.workflow_scope(p_organization_id,c,'executions',parent);
 elsif parent is not null and p_kind='incident-updates' then perform private.workflow_scope(p_organization_id,c,'incidents',parent);
 elsif p_kind='asset-events' then perform private.workflow_carrier(c);if not exists(select 1 from public.transport_assets where id=parent and carrier_id=c) then raise exception 'WORKFLOW_NOT_FOUND' using errcode='PT404';end if;end if;
 if parent is not null and p_kind in ('holds','executions') then perform private.workflow_scope(p_organization_id,c,'bookings',parent);end if;
 if p_kind='holds' then
  for i in select h.id from public.capacity_reservations h join public.v2_bookings b on b.id=h.booking_id where
   (c is null and b.organization_id=p_organization_id or c is not null and b.carrier_id=c) and (parent is null or h.booking_id=parent) and (ident is null or h.id=ident) order by h.created_at,h.id limit p_limit offset p_offset loop rows:=rows||jsonb_build_array(private.workflow_record(p_kind,i));end loop;
 elsif p_kind='executions' then
  for i in select id from public.transport_executions where (c is null and organization_id=p_organization_id or c is not null and carrier_id=c)
   and booking_id is not null and (parent is null or booking_id=parent) and (ident is null or id=ident) order by created_at,id limit p_limit offset p_offset loop rows:=rows||jsonb_build_array(private.workflow_record(p_kind,i));end loop;
 else
  for i in execute format('select id from public.%I where (($1 is null and (organization_id=$2 or organization_id is null)) or ($1 is not null and carrier_id=$1)) and ($3 is null or freight_request_id=$3) and ($4 is null or parent_id=$4) and ($5 is null or id=$5) order by created_at,id limit $6 offset $7',t)
   using c,p_organization_id,q,parent,ident,p_limit,p_offset loop rows:=rows||jsonb_build_array(private.workflow_record(p_kind,i));end loop;
 end if;return rows;end;$$;

-- Preserves 20261004154048_hac40_workflow.sql (private.command_v2_workflow_before_ltl_operations); only actor/receipt dispatch changes.
create or replace function private.command_v2_workflow_before_ltl_operations(p_organization_id uuid,p_member_id uuid,p_action text,p_context jsonb,p_key uuid,p_value jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare k text:=split_part(p_action,'.',1);op text:=split_part(p_action,'.',2);t text;c uuid:=(p_context->>'carrierId')::uuid;
 qid uuid:=(p_context->>'requestId')::uuid;parent uuid:=(p_context->>'parentId')::uuid;ident uuid:=(p_context->>'id')::uuid;
 i uuid:=coalesce(ident,gen_random_uuid());rid uuid;old jsonb;v jsonb:=p_value;result jsonb;h text;receipt private.v2_workflow_receipts;
 o uuid:=p_organization_id;new_status text;expected integer;pub boolean:=op='publish';q public.freight_requests;plan public.transport_plan_candidates;
 opp public.carrier_opportunities;offer public.v2_carrier_offers;b public.v2_bookings;e public.transport_executions;hold public.capacity_reservations;
 ass public.plan_resource_bindings;res public.plan_resources;rowid uuid;ref uuid;svc uuid;payload jsonb;window_start timestamptz;window_end timestamptz;
begin
 perform private.workflow_actor(p_organization_id,p_member_id,(p_context->>'carrierId')::uuid,false);
 if p_context->>'carrierId' is not null then perform private.identity_carrier_action((p_context->>'carrierId')::uuid,p_action);end if;
 if p_key is null or jsonb_typeof(p_context)<>'object' or (p_context-'carrierId'-'requestId'-'parentId'-'id')<>'{}'::jsonb then raise exception 'VALIDATION_ERROR' using errcode='PT400';end if;
 if pub and ident is not null then
  if jsonb_typeof(v)<>'object' or (v-'expectedVersion'-'value')<>'{}'::jsonb then raise exception 'VALIDATION_ERROR' using errcode='PT400';end if;
  expected:=(v->>'expectedVersion')::integer;v:=v->'value';
 end if;
 perform private.workflow_validate(p_action,v);perform private.workflow_validate_periods(v);t:=private.workflow_table(k);
 if op in ('respond','withdraw','revoke','confirm','release','cancel','start','complete','position','update','close') and ident is null
  or op='create' and ident is not null
  or k in ('routes','plans','opportunities','ranking','decisions') and op='create' and qid is null
  or p_action in ('offers.create','incidents.create','asset-events.create') and parent is null
  then raise exception 'VALIDATION_ERROR' using errcode='PT400';end if;
 if p_action in ('routes.create','plans.create','opportunities.create','ranking.create','decisions.create','decisions.revoke','bookings.create','holds.create','executions.create') then
  if c is not null then raise exception 'VALIDATION_ERROR' using errcode='PT400';end if;
  perform private.workflow_member(o,p_member_id,true);
 end if;
 if p_action in ('opportunities.respond','offers.create','offers.withdraw','holds.confirm','bookings.confirm','executions.start','executions.complete','executions.cancel','executions.position','incidents.create','incidents.update') and c is null then raise exception 'FORBIDDEN_WORKFLOW' using errcode='PT403';end if;
 if k='consolidations' and c is null then raise exception 'FORBIDDEN_WORKFLOW' using errcode='PT403';end if;
 -- Shared deterministic ordering with fleet/crew; native commands serialize affected commitments.
 -- Broad service lock deliberately favors correctness until narrower measured lock scopes are introduced.
 perform 1 from public.carrier_services order by id for update;
 if c is not null then perform private.workflow_carrier(c);end if;
 if k in ('limits','metrics','asset-events') and c is null then raise exception 'FORBIDDEN_WORKFLOW' using errcode='PT403';end if;
 if pub and k not in ('limits','metrics') then perform private.workflow_admin();
 elsif c is null then perform private.workflow_member(o,p_member_id,true);end if;
 if qid is not null then q:=private.workflow_request(o,qid);end if;
 if ident is not null then
  if pub and k not in ('limits','metrics') then old:=private.workflow_record(k,ident);
  else old:=private.workflow_scope(o,c,k,ident);end if;
  if old->>'id' is null then raise exception 'WORKFLOW_NOT_FOUND' using errcode='PT404';end if;
  if qid is not null and (old->>'requestId')::uuid is distinct from qid then raise exception 'WORKFLOW_NOT_FOUND' using errcode='PT404';end if;
  if not pub then expected:=(v->>'expectedVersion')::integer;end if;
 end if;
 perform private.workflow_expire_holds();
 -- Recheck actor/grant and target scope before receipt lookup, including revoked-access replays.
 h:=private.hash_v2_freight_payload(jsonb_build_object('action',p_action,'context',p_context,'value',p_value));
 perform pg_advisory_xact_lock(hashtextextended(coalesce(o::text,p_context->>'carrierId')||':'||p_member_id::text||':'||p_key::text,0));
 receipt:=private.workflow_receipt(o,p_member_id,(p_context->>'carrierId')::uuid,p_key);
 if receipt.idempotency_key is not null then if receipt.payload_hash<>h then raise exception 'IDEMPOTENCY_CONFLICT' using errcode='PT409';end if;return jsonb_build_object('record',receipt.result,'replay',true);end if;
 if ident is not null and (expected is null or expected<1 or expected<>(old->>'version')::integer) then raise exception 'STALE_DRAFT' using errcode='PT409';end if;
 if pub then
  new_status:=case when coalesce((v->>'active')::boolean,true) then 'ACTIVE' else 'INACTIVE' end;
  if k='limits' then
   if not exists(select 1 from public.carrier_services where id=(v->>'serviceId')::uuid and carrier_id=c)
    or v->>'assetId' is not null and not exists(select 1 from public.transport_assets where id=(v->>'assetId')::uuid and carrier_id=c and carrier_service_id=(v->>'serviceId')::uuid)
    or v->>'combinationId' is not null and not exists(select 1 from public.vehicle_combinations where id=(v->>'combinationId')::uuid and carrier_id=c and carrier_service_id=(v->>'serviceId')::uuid)
    then raise exception 'INVALID_LIMIT_REFERENCE' using errcode='PT400';end if;
   if (v->>'combinedTareKg')::numeric>=(v->>'routeGrossLimitKg')::numeric then raise exception 'VALIDATION_ERROR' using errcode='PT400';end if;
  elsif k='corridors' and v->>'originNodeId'=v->>'destinationNodeId' then raise exception 'VALIDATION_ERROR' using errcode='PT400';
  elsif k='scoring-policies' and (abs((v#>>'{policy,weights,cost}')::numeric+(v#>>'{policy,weights,transit}')::numeric+(v#>>'{policy,weights,reliability}')::numeric-1)>0.000000001 or v#>>'{policy,objective}'='LOWEST_COST' and (v#>>'{policy,weights,cost}')::numeric<>1 or v#>>'{policy,objective}'='FASTEST' and (v#>>'{policy,weights,transit}')::numeric<>1) then raise exception 'SCORING_POLICY_INVALID' using errcode='PT400';
  elsif k='route-policies' and abs((v#>>'{weights,distance}')::numeric+(v#>>'{weights,duration}')::numeric-1)>0.000000001 then raise exception 'VALIDATION_ERROR' using errcode='PT400';
  elsif k='metrics' and (v#>>'{period,endsAt}')::timestamptz>now() then raise exception 'METRIC_PERIOD_NOT_FINISHED' using errcode='PT400';end if;
  if ident is null then
   if k='corridors' then insert into public.route_corridors(id,status,data,origin_node_id,destination_node_id) values(i,new_status,v,(v->>'originNodeId')::uuid,(v->>'destinationNodeId')::uuid);
   elsif k='limits' then insert into public.route_resource_limits(id,carrier_id,status,data,carrier_service_id,asset_id,combination_id,corridor_id) values(i,c,new_status,v,(v->>'serviceId')::uuid,(v->>'assetId')::uuid,(v->>'combinationId')::uuid,(v->>'corridorId')::uuid);
   else execute format('insert into public.%I(id,carrier_id,parent_id,status,data) values($1,$2,$3,$4,$5)',t) using i,c,case when k='conditions' then (v->>'corridorId')::uuid end,new_status,v;end if;
  else
   if k='scoring-policies' and old#>'{data,policy}' is distinct from v->'policy'
    or k='route-policies' and ((old->'data')-'active') is distinct from (v-'active') then raise exception 'POLICY_VERSION_IMMUTABLE' using errcode='PT400';end if;
   if k='corridors' and (old#>'{data,originNodeId}' is distinct from v->'originNodeId' or old#>'{data,destinationNodeId}' is distinct from v->'destinationNodeId')
   or k='conditions' and old#>'{data,corridorId}' is distinct from v->'corridorId'
   or k='limits' and (old#>'{data,serviceId}' is distinct from v->'serviceId' or old#>'{data,assetId}' is distinct from v->'assetId' or old#>'{data,combinationId}' is distinct from v->'combinationId' or old#>'{data,corridorId}' is distinct from v->'corridorId') then raise exception 'IMMUTABLE_WORKFLOW_SCOPE' using errcode='PT400';end if;
   execute format('update public.%I set data=$1,status=$2,version=version+1,updated_at=now() where id=$3',t) using v,new_status,i;
  end if;
  result:=private.workflow_record(k,i);
 elsif p_action='routes.create' then result:=private.workflow_route(o,qid,v->'corridorIds',(v->>'policyId')::uuid,i);
 elsif p_action='plans.create' then result:=private.workflow_build_plan(o,qid,v,i);
 elsif p_action='opportunities.create' then
  select * into plan from public.transport_plan_candidates where id=(v->>'planId')::uuid and organization_id=o and freight_request_id=qid;
  if plan.id is null then raise exception 'WORKFLOW_NOT_FOUND' using errcode='PT404';end if;
  if (v->>'responseDeadline')::timestamptz<=now() or (v->>'responseDeadline')::timestamptz>q.pickup_window_end then raise exception 'INVALID_RESPONSE_DEADLINE' using errcode='PT400';end if;
  if exists(select 1 from jsonb_array_elements_text(v->'assignmentIds') x where not exists(select 1 from public.plan_resource_bindings aa join public.plan_resources rr on rr.id=aa.resource_id where aa.id=x.value::uuid and aa.plan_id=plan.id and rr.carrier_id=(v->>'carrierId')::uuid)) then raise exception 'OPPORTUNITY_ASSIGNMENT_MISMATCH' using errcode='PT400';end if;
  insert into public.carrier_opportunities(id,organization_id,carrier_id,freight_request_id,parent_id,status,data) values(i,o,(v->>'carrierId')::uuid,qid,plan.id,'SENT',v||jsonb_build_object('sentAt',now(),'cargoSpecification',q.v2_snapshot->'cargoSpecification','origin',q.v2_snapshot->'origin','destination',q.v2_snapshot->'destination',
   'assignmentSnapshots',(select jsonb_agg(aa.data||jsonb_build_object('id',aa.id,'serviceId',aa.carrier_service_id,'resource',rr.data,'routeLeg',rl.data)) from public.plan_resource_bindings aa join public.plan_resources rr on rr.id=aa.resource_id join public.route_legs rl on rl.id=aa.route_leg_id where aa.plan_id=plan.id and (v->'assignmentIds') ? aa.id::text)));result:=private.workflow_record(k,i);
 elsif p_action='opportunities.respond' then
  if c is null then raise exception 'FORBIDDEN_WORKFLOW' using errcode='PT403';end if;
  select * into opp from public.carrier_opportunities where id=i;
  if opp.status not in ('SENT','ACCEPTED') or (opp.data->>'responseDeadline')::timestamptz<=now() then raise exception 'OPPORTUNITY_NOT_OPEN' using errcode='PT409';end if;
  update public.carrier_opportunities set status=v->>'response',data=data||jsonb_build_object('response',v->'response','responseNote',v->'note','responseEvidence',v->'evidence','respondedAt',now(),'respondedBy',p_member_id),version=version+1,updated_at=now() where id=i;result:=private.workflow_record(k,i);
 elsif p_action='offers.create' then result:=private.workflow_offer(o,p_member_id,c,parent,v,i);
 elsif p_action='offers.withdraw' then
  if c is null then raise exception 'FORBIDDEN_WORKFLOW' using errcode='PT403';end if;
  if old->>'status'<>'RECEIVED' or exists(select 1 from public.v2_bookings where offer_id=i and status not in ('CANCELLED','REJECTED')) then raise exception 'OFFER_COMMITTED' using errcode='PT409';end if;
  update public.v2_carrier_offers set status='WITHDRAWN',version=version+1,updated_at=now(),data=data||jsonb_build_object('status','WITHDRAWN','withdrawal',v,'withdrawnAt',now()) where id=i;result:=private.workflow_record(k,i);
 elsif p_action='ranking.create' then result:=private.workflow_ranking(o,qid,(v->>'policyId')::uuid,i);
 elsif p_action='decisions.create' then result:=private.workflow_selection(o,p_member_id,qid,v,i);
 elsif p_action='decisions.revoke' then
  if old->>'status'<>'SELECTED' then raise exception 'INVALID_DECISION_STATE' using errcode='PT409';end if;
  if exists(select 1 from public.v2_bookings where decision_id=i and status not in ('CANCELLED','REJECTED')) then raise exception 'CANCEL_BOOKINGS_FIRST' using errcode='PT409';end if;
  update public.selection_decisions set status='REVOKED',version=version+1,updated_at=now(),data=data||jsonb_build_object('status','REVOKED','revocation',v,'revokedAt',now()) where id=i;result:=private.workflow_record(k,i);
 elsif p_action='bookings.create' then
  ref:=(v->>'decisionId')::uuid;perform private.workflow_scope(o,null,'decisions',ref);
  if not exists(select 1 from public.selection_decisions where id=ref and status='SELECTED') or not exists(select 1 from public.selection_offers where decision_id=ref and offer_id=(v->>'offerId')::uuid)
   or not private.workflow_offer_current((v->>'offerId')::uuid) then raise exception 'DECISION_OFFER_NOT_CURRENT' using errcode='PT409';end if;
  select * into offer from public.v2_carrier_offers where id=(v->>'offerId')::uuid;
  insert into public.v2_bookings(id,organization_id,carrier_id,freight_request_id,status,decision_id,offer_id,data) values(i,o,offer.carrier_id,offer.freight_request_id,'AUTHORIZED',ref,offer.id,
   jsonb_build_object('carrierReference',null,'confirmedAt',null,'authorizedAt',now(),'authorizedBy',p_member_id,'authorizationStatus','AUTHORIZED','carrierConfirmationStatus','PENDING','capacityEvidence','[]'::jsonb,'authorizationEvidence',v->'evidence'));result:=private.workflow_record(k,i);
 elsif p_action='executions.create' then
  ref:=(v->>'bookingId')::uuid;payload:=private.workflow_scope(o,c,'bookings',ref);select * into b from public.v2_bookings where id=ref;
  if b.status not in ('AUTHORIZED','CONFIRMED') then raise exception 'BOOKING_NOT_AUTHORIZED' using errcode='PT409';end if;
  select min(aa.starts_at),max(aa.ends_at) into window_start,window_end from public.plan_resource_bindings aa join public.v2_carrier_offers oo on aa.plan_id=oo.plan_id
   where oo.id=b.offer_id and aa.carrier_service_id=(v->>'serviceId')::uuid and oo.data->'coveredAssignmentIds' ? aa.id::text;
  if window_start is null then raise exception 'EXECUTION_SERVICE_NOT_BOOKED' using errcode='PT400';end if;
  insert into public.transport_executions(id,organization_id,freight_request_id,carrier_id,carrier_service_id,booking_id,status,planned_starts_at,planned_ends_at,data)
   values(i,b.organization_id,b.freight_request_id,b.carrier_id,(v->>'serviceId')::uuid,ref,'PLANNED',window_start,window_end,jsonb_build_object('createdBy',p_member_id));result:=private.workflow_record(k,i);
 elsif p_action='consolidations.create' then
  if not exists(select 1 from public.carrier_services ss join public.capacity_calendars cc on cc.carrier_service_id=ss.id where ss.id=(v->>'serviceId')::uuid and ss.carrier_id=c and ss.service_type='LTL' and ss.transport_mode='ROAD' and cc.id=(v->>'calendarId')::uuid and cc.transport_asset_id is not null)
   or not exists(select 1 from public.route_plans rr join public.transport_plan_candidates pp on pp.route_plan_id=rr.id join public.carrier_opportunities oo on oo.parent_id=pp.id where rr.id=(v->>'routeId')::uuid and oo.carrier_id=c)
   or not private.workflow_evidence(v->'evidence',(v#>>'{window,startsAt}')::timestamptz,(v#>>'{window,endsAt}')::timestamptz) then raise exception 'CONSOLIDATION_EVIDENCE_REQUIRED' using errcode='PT409';end if;
  insert into public.capacity_consolidations(id,carrier_id,status,data,carrier_service_id,calendar_id,route_id) values(i,c,'OPEN',v,(v->>'serviceId')::uuid,(v->>'calendarId')::uuid,(v->>'routeId')::uuid);result:=private.workflow_record(k,i);
 elsif p_action='consolidations.close' then
  if old->>'status'<>'OPEN' or exists(select 1 from public.capacity_reservations where consolidation_id=i and status in ('HELD','CONFIRMED')) then raise exception 'CONSOLIDATION_HAS_COMMITMENTS' using errcode='PT409';end if;
  update public.capacity_consolidations set status='CLOSED',version=version+1,updated_at=now(),data=data||jsonb_build_object('closure',v) where id=i;result:=private.workflow_record(k,i);
 elsif p_action='holds.create' then
  payload:=private.workflow_scope(o,null,'bookings',(v->>'bookingId')::uuid);select * into b from public.v2_bookings where id=(v->>'bookingId')::uuid;
  select * into offer from public.v2_carrier_offers where id=b.offer_id;
  select * into ass from public.plan_resource_bindings where id=(v->>'assignmentId')::uuid and plan_id=offer.plan_id;
  select * into res from public.plan_resources where id=ass.resource_id;
  if b.status not in ('AUTHORIZED','CONFIRMED') or not private.workflow_offer_current(offer.id) or ass.id is null
    or not offer.data->'coveredAssignmentIds' ? ass.id::text then raise exception 'BOOKING_ASSIGNMENT_NOT_CURRENT' using errcode='PT409';end if;
  select * into e from public.transport_executions where booking_id=b.id and carrier_service_id=ass.carrier_service_id and status='PLANNED';
  if e.id is null then raise exception 'PLANNED_EXECUTION_REQUIRED' using errcode='PT409';end if;
  if v->>'consolidationId' is not null then
   if not private.workflow_trip_compatible((v->>'consolidationId')::uuid,ass.plan_id,ass.carrier_service_id,res.calendar_id,ass.starts_at,ass.ends_at) then raise exception 'CONSOLIDATION_ROUTE_MISMATCH' using errcode='PT400';end if;
   if e.consolidation_id is not null and e.consolidation_id<>(v->>'consolidationId')::uuid then raise exception 'IMMUTABLE_EXECUTION_TRIP' using errcode='PT400';end if;
   update public.transport_executions set consolidation_id=(v->>'consolidationId')::uuid where id=e.id;
  end if;
  if (v->>'expiresAt')::timestamptz<=now() or (v->>'expiresAt')::timestamptz>ass.ends_at or not private.workflow_evidence(v->'evidence',ass.starts_at,ass.ends_at) then raise exception 'HOLD_EVIDENCE_OR_EXPIRY_INVALID' using errcode='PT400';end if;
  payload:=jsonb_build_object('reference',v#>'{evidence,reference}','verifiedAt',v#>'{evidence,observedAt}','validUntil',v#>'{evidence,validUntil}','provenanceStatus',v#>'{evidence,provenanceStatus}');
  insert into public.capacity_reservations(id,capacity_calendar_id,freight_request_id,starts_at,ends_at,status,booking_id,plan_assignment_id,execution_id,expires_at,committed_capacity,source,reference,evidence,consolidation_id)
  values(i,res.calendar_id,b.freight_request_id,ass.starts_at,ass.ends_at,'HELD',b.id,ass.id,e.id,(v->>'expiresAt')::timestamptz,ass.data->'capacityNeeded',v#>>'{evidence,provider}',v#>>'{evidence,reference}',payload,(v->>'consolidationId')::uuid);
  if res.combination_id is not null then
   for rowid in select cc.id from public.vehicle_combination_assets mm join public.capacity_calendars cc on cc.transport_asset_id=mm.transport_asset_id where mm.combination_id=res.combination_id and cc.id<>res.calendar_id order by cc.id loop
    insert into public.capacity_reservations(capacity_calendar_id,freight_request_id,starts_at,ends_at,status,booking_id,plan_assignment_id,execution_id,expires_at,committed_capacity,source,reference,evidence,parent_reservation_id,consolidation_id)
    values(rowid,b.freight_request_id,ass.starts_at,ass.ends_at,'HELD',b.id,ass.id,e.id,(v->>'expiresAt')::timestamptz,jsonb_build_object('weightKg',0,'volumeM3',0),v#>>'{evidence,provider}',v#>>'{evidence,reference}',payload,i,(v->>'consolidationId')::uuid);
   end loop;
  end if;result:=private.workflow_record(k,i);
 elsif p_action in ('holds.confirm','holds.release') then
  select * into hold from public.capacity_reservations where id=i;select * into b from public.v2_bookings where id=hold.booking_id;
  if hold.parent_reservation_id is not null then raise exception 'GROUP_HOLD_REQUIRED' using errcode='PT400';end if;
  if p_action='holds.confirm' then
   if c is null then raise exception 'FORBIDDEN_WORKFLOW' using errcode='PT403';end if;
   if hold.status<>'HELD' or hold.expires_at<=now() or b.status not in ('AUTHORIZED','CONFIRMED') then raise exception 'HOLD_EXPIRED_OR_NOT_ACTIVE' using errcode='PT409';end if;
   if not private.workflow_current_plan((select plan_id from public.v2_carrier_offers where id=b.offer_id)) or not private.workflow_evidence(v->'evidence',hold.starts_at,hold.ends_at) then raise exception 'PLAN_OR_EVIDENCE_NOT_CURRENT' using errcode='PT409';end if;
   update public.capacity_reservations set status='CONFIRMED',version=version+1,updated_at=now() where id=i or parent_reservation_id=i;
  else
   if b.status='CONFIRMED' or exists(select 1 from public.vehicle_assignments where capacity_reservation_id=i and status='CONFIRMED') or exists(select 1 from public.transport_executions where id=hold.execution_id and status='IN_PROGRESS') then raise exception 'CANCEL_EXECUTION_OR_BOOKING_FIRST' using errcode='PT409';end if;
   update public.capacity_reservations set status='RELEASED',version=version+1,updated_at=now() where id=i or parent_reservation_id=i;
  end if;result:=private.workflow_record(k,i);
 elsif p_action='bookings.confirm' then
  if c is null then raise exception 'FORBIDDEN_WORKFLOW' using errcode='PT403';end if;
  select * into b from public.v2_bookings where id=i;
  if b.status<>'AUTHORIZED' then raise exception 'INVALID_BOOKING_STATE' using errcode='PT409';end if;
  if v->>'confirmation'='REJECTED' then perform private.workflow_release_booking(b.id,false);new_status:='REJECTED';
  else
   select * into offer from public.v2_carrier_offers where id=b.offer_id;
   if not private.workflow_evidence(v->'evidence',(offer.data#>>'{validity,startsAt}')::timestamptz,now()) then raise exception 'CONFIRMATION_EVIDENCE_REQUIRED' using errcode='PT409';end if;
   if not private.workflow_offer_current(offer.id) or exists(select 1 from jsonb_array_elements_text(offer.data->'coveredAssignmentIds') x where not exists(select 1 from public.capacity_reservations rr where rr.booking_id=b.id and rr.plan_assignment_id=x.value::uuid and rr.status='CONFIRMED')) then raise exception 'CAPACITY_COMMITMENT_REQUIRED' using errcode='PT409';end if;
   new_status:='CONFIRMED';
  end if;
  update public.v2_bookings set status=new_status,version=version+1,updated_at=now(),data=data||jsonb_build_object('carrierConfirmationStatus',new_status,'carrierReference',v->'carrierReference','confirmedAt',case when new_status='CONFIRMED' then now() end,'confirmationEvidence',v->'evidence','confirmedBy',p_member_id,'capacityEvidence',coalesce((select jsonb_agg(private.workflow_record('holds',rr.id)) from public.capacity_reservations rr where rr.booking_id=i and rr.status='CONFIRMED'),'[]'::jsonb)) where id=i;result:=private.workflow_record(k,i);
 elsif p_action='bookings.cancel' then
  select * into b from public.v2_bookings where id=i;
  if b.status in ('CANCELLED','REJECTED','COMPLETED') then raise exception 'INVALID_BOOKING_STATE' using errcode='PT409';end if;
  perform private.workflow_release_booking(b.id,c is not null);
  update public.v2_bookings set status='CANCELLED',version=version+1,updated_at=now(),data=data||jsonb_build_object('authorizationStatus','REVOKED','carrierConfirmationStatus','CANCELLED','cancellation',v,'cancelledAt',now(),'cancelledBy',p_member_id) where id=i;result:=private.workflow_record(k,i);
 elsif k='executions' then
  if c is null then raise exception 'FORBIDDEN_WORKFLOW' using errcode='PT403';end if;
  select * into e from public.transport_executions where id=i;select * into b from public.v2_bookings where id=e.booking_id;
  if p_action='executions.start' then
   if e.status<>'PLANNED' or b.status<>'CONFIRMED' or now()<e.planned_starts_at or now()>=e.planned_ends_at then raise exception 'EXECUTION_NOT_READY' using errcode='PT409';end if;
   if not private.workflow_current_plan((select plan_id from public.v2_carrier_offers where id=b.offer_id)) then raise exception 'PLAN_NOT_ELIGIBLE' using errcode='PT409';end if;
   if not exists(select 1 from public.driver_assignments where execution_id=i and status='CONFIRMED' and role='PRIMARY')
    or exists(select 1 from public.plan_resource_bindings aa join public.plan_resources rr on rr.id=aa.resource_id join public.v2_carrier_offers oo on oo.plan_id=aa.plan_id where oo.id=b.offer_id and aa.carrier_service_id=e.carrier_service_id and rr.asset_id is not null and not exists(select 1 from public.vehicle_assignments vv where vv.execution_id=e.id and vv.transport_asset_id=rr.asset_id and vv.status='CONFIRMED')) or (select count(*) from public.driver_assignments where execution_id=i and status='CONFIRMED' and role='PRIMARY')<(select count(distinct rr.id) from public.plan_resource_bindings aa join public.plan_resources rr on rr.id=aa.resource_id join public.v2_carrier_offers oo on oo.plan_id=aa.plan_id where oo.id=b.offer_id and aa.carrier_service_id=e.carrier_service_id and rr.asset_id is not null and rr.data->>'role'='LOAD_BEARING') then raise exception 'CONFIRMED_CREW_REQUIRED' using errcode='PT409';end if;
   update public.transport_executions set status='IN_PROGRESS',actual_started_at=now(),version=version+1,updated_at=now() where id=i;
  elsif p_action in ('executions.complete','executions.cancel') then
   if p_action='executions.complete' and e.status<>'IN_PROGRESS' or p_action='executions.cancel' and e.status not in ('PLANNED','IN_PROGRESS') then raise exception 'INVALID_EXECUTION_STATE' using errcode='PT409';end if;
   if p_action='executions.cancel' then
    perform private.workflow_release_booking(b.id,true);
    update public.v2_bookings set status='CANCELLED',version=version+1,updated_at=now(),data=data||jsonb_build_object('authorizationStatus','REVOKED','carrierConfirmationStatus','CANCELLED','cancellation',v,'cancelledAt',now(),'cancelledBy',p_member_id,'triggerExecutionId',i) where id=b.id;
   else
    perform private.workflow_release_execution(i);
    update public.transport_executions set status='COMPLETED',actual_completed_at=now(),version=version+1,updated_at=now() where id=i;
   end if;
   if p_action='executions.complete' and not exists(select 1 from jsonb_array_elements_text((select data->'coveredServiceIds' from public.v2_carrier_offers where id=b.offer_id)) ss where not exists(select 1 from public.transport_executions ee where ee.booking_id=b.id and ee.carrier_service_id=ss.value::uuid and ee.status='COMPLETED')) then update public.v2_bookings set status='COMPLETED',version=version+1,updated_at=now() where id=b.id;end if;
  elsif p_action='executions.position' then
   if not private.workflow_evidence(v->'evidence',(v->>'observedAt')::timestamptz,now()) then raise exception 'POSITION_EVIDENCE_REQUIRED' using errcode='PT409';end if;
   if e.status<>'IN_PROGRESS' or (v->>'observedAt')::timestamptz>now() or (e.data->>'lastObservedAt')::timestamptz>=(v->>'observedAt')::timestamptz then raise exception 'POSITION_OUT_OF_ORDER' using errcode='PT409';end if;
   update public.transport_executions set last_known_position=v->'location',data=data||jsonb_build_object('lastObservedAt',v->'observedAt','positionEvidence',v->'evidence'),version=version+1,updated_at=now() where id=i;
  else raise exception 'VALIDATION_ERROR' using errcode='PT400';end if;
  insert into public.execution_events(organization_id,carrier_id,freight_request_id,parent_id,status,data) values(e.organization_id,e.carrier_id,e.freight_request_id,i,'RECORDED',v||jsonb_build_object('action',p_action,'at',now(),'actorId',p_member_id));result:=private.workflow_record(k,i);
 elsif p_action='incidents.create' then
  payload:=private.workflow_scope(o,c,'executions',parent);select * into e from public.transport_executions where id=parent;
  if c is null or e.status not in ('PLANNED','IN_PROGRESS') or (v->>'occurredAt')::timestamptz>now() then raise exception 'INCIDENT_NOT_ALLOWED' using errcode='PT409';end if;
  insert into public.operational_incidents(id,organization_id,carrier_id,freight_request_id,parent_id,status,data) values(i,e.organization_id,e.carrier_id,e.freight_request_id,parent,'OPEN',v||jsonb_build_object('reportedBy',p_member_id,'status','OPEN'));result:=private.workflow_record(k,i);
 elsif p_action='incidents.update' then
  if c is null then raise exception 'FORBIDDEN_WORKFLOW' using errcode='PT403';end if;
  if v->>'action'='RESOLVE' and old->>'status'<>'OPEN' or v->>'action'='REOPEN' and old->>'status'<>'RESOLVED' then raise exception 'INVALID_INCIDENT_STATE' using errcode='PT409';end if;
  new_status:=case when v->>'action'='RESOLVE' then 'RESOLVED' when v->>'action'='REOPEN' then 'OPEN' else old->>'status' end;
  insert into public.incident_updates(organization_id,carrier_id,freight_request_id,parent_id,status,data) values((old->>'organizationId')::uuid,c,(old->>'requestId')::uuid,i,'RECORDED',v||jsonb_build_object('at',now(),'actorId',p_member_id));
  update public.operational_incidents set status=new_status,data=data||jsonb_build_object('status',new_status),version=version+1,updated_at=now() where id=i;result:=private.workflow_record(k,i);
 elsif p_action='asset-events.create' then
  if not exists(select 1 from public.transport_assets where id=parent and carrier_id=c and version=(v->>'expectedVersion')::integer) then raise exception 'STALE_DRAFT' using errcode='PT409';end if;
  if exists(select 1 from public.transport_assets where id=parent and operating_status=v->>'next') then raise exception 'INVALID_ASSET_TRANSITION' using errcode='PT409';end if;
  payload:=jsonb_build_object('at',now(),'previous',(select operating_status from public.transport_assets where id=parent),'next',v->'next','reason',v->'reason','evidence',v->'evidence','actorId',p_member_id);
  update public.transport_assets set operating_status=v->>'next',condition_reason=v->>'reason',active=v->>'next' in ('AVAILABLE','IN_SERVICE') where id=parent;
  insert into public.asset_status_events(id,carrier_id,parent_id,status,data) values(i,c,parent,'RECORDED',payload);result:=private.workflow_record(k,i);
 else raise exception 'VALIDATION_ERROR' using errcode='PT400';end if;
 perform private.workflow_save_receipt(o,p_member_id,(p_context->>'carrierId')::uuid,p_key,h,result);
 return jsonb_build_object('record',result,'replay',false);end;$$;

-- Preserves 20261004232244_hac40_ltl_shared_operations.sql (private.command_v2_workflow_before_cp1); only actor/receipt dispatch changes.
create or replace function private.command_v2_workflow_before_cp1(p_organization_id uuid,p_member_id uuid,p_action text,p_context jsonb,p_key uuid,p_value jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c uuid:=(p_context->>'carrierId')::uuid;i uuid:=(p_context->>'id')::uuid;
 cc public.capacity_consolidations;e public.transport_executions;receipt private.v2_workflow_receipts;
 h text;result jsonb;members uuid[];affected uuid[];old_events uuid[];event_id uuid:=gen_random_uuid();
 child_action text;child_value jsonb;signature jsonb;next_signature jsonb;first_member boolean:=true;
begin
 if p_action not in ('consolidations.start','consolidations.complete','consolidations.cancel','consolidations.position')
  and not (p_action='consolidations.close' and exists(select 1 from public.capacity_consolidations where id=i and status in ('COMPLETED','CANCELLED'))) then
  -- Individual cancellation withdraws one booking, retaining the other tenants in transit.
  perform private.workflow_actor(p_organization_id,p_member_id,(p_context->>'carrierId')::uuid,false);
 if p_context->>'carrierId' is not null then perform private.identity_carrier_action((p_context->>'carrierId')::uuid,p_action);end if;
  if p_action in ('executions.start','executions.complete','executions.position') and exists(select 1 from public.transport_executions where id=i and consolidation_id is not null and (p_action='executions.start' or status='IN_PROGRESS')) then
   perform private.workflow_scope(p_organization_id,c,'executions',i);
   raise exception 'CONSOLIDATION_ACTION_REQUIRED' using errcode='PT409';end if;
  if p_action in ('executions.cancel','bookings.cancel') then
   perform 1 from public.carrier_services order by id for update;
   select array_agg(distinct consolidation_id) into affected from public.transport_executions
    where booking_id=case when p_action='bookings.cancel' then i else (select booking_id from public.transport_executions where id=i) end and consolidation_id is not null;
   update public.capacity_consolidations set status='CANCELLING' where id=any(affected) and status='IN_PROGRESS';
  end if;
  result:=private.command_v2_workflow_before_ltl_operations(p_organization_id,p_member_id,p_action,p_context,p_key,p_value);
  if p_action='holds.create' and not (result->>'replay')::boolean then
   update public.driver_assignments set occupancy_group_id=occupancy_group_id where execution_id=(select execution_id from public.capacity_reservations where id=(result#>>'{record,id}')::uuid) and status in ('PROPOSED','CONFIRMED');
  end if;
  update public.capacity_consolidations cc2 set status=case when exists(select 1 from public.transport_executions where consolidation_id=cc2.id and status='IN_PROGRESS') then 'IN_PROGRESS' else 'CANCELLED' end,
   version=version+case when (result->>'replay')::boolean then 0 else 1 end,updated_at=case when (result->>'replay')::boolean then updated_at else now() end where id=any(affected) and status='CANCELLING';
  return result;
 end if;
 perform private.workflow_actor(p_organization_id,p_member_id,(p_context->>'carrierId')::uuid,false);
 if p_key is null or jsonb_typeof(p_context)<>'object' or (p_context-'carrierId'-'id'-'requestId'-'parentId')<>'{}'::jsonb or p_context->>'requestId' is not null or p_context->>'parentId' is not null or c is null or i is null then raise exception 'VALIDATION_ERROR' using errcode='PT400';end if;
 perform private.workflow_validate(p_action,p_value);perform private.workflow_validate_periods(p_value);
 perform 1 from public.carrier_services order by id for update;
 perform private.workflow_carrier(c);perform private.workflow_scope(p_organization_id,c,'consolidations',i);
 select * into cc from public.capacity_consolidations where id=i for update;
 h:=private.hash_v2_freight_payload(jsonb_build_object('action',p_action,'context',p_context,'value',p_value));
 perform pg_advisory_xact_lock(hashtextextended(coalesce(p_organization_id::text,p_context->>'carrierId')||':'||p_member_id::text||':'||p_key::text,0));
 receipt:=private.workflow_receipt(p_organization_id,p_member_id,(p_context->>'carrierId')::uuid,p_key);
 if receipt.idempotency_key is not null then if receipt.payload_hash<>h then raise exception 'IDEMPOTENCY_CONFLICT' using errcode='PT409';end if;return jsonb_build_object('record',receipt.result,'replay',true);end if;
 if (p_value->>'expectedVersion')::integer<>cc.version then raise exception 'STALE_DRAFT' using errcode='PT409';end if;
 if p_action='consolidations.close' then
  if exists(select 1 from public.capacity_reservations where consolidation_id=i and status in ('HELD','CONFIRMED')) then raise exception 'CONSOLIDATION_HAS_COMMITMENTS' using errcode='PT409';end if;
  update public.capacity_consolidations set status='CLOSED',version=version+1,updated_at=now(),data=data||jsonb_build_object('tripOutcome',cc.status,'closure',p_value) where id=i;
 else
  if p_action='consolidations.start' then
   if cc.status<>'OPEN' then raise exception 'INVALID_CONSOLIDATION_STATE' using errcode='PT409';end if;
   perform private.workflow_expire_holds();
   select array_agg(distinct execution_id order by execution_id) into members from public.capacity_reservations where consolidation_id=i and parent_reservation_id is null and status in ('HELD','CONFIRMED');
   if coalesce(cardinality(members),0)=0 or cardinality(members)>100 then raise exception 'CONSOLIDATION_MEMBER_COUNT_INVALID' using errcode='PT409';end if;
   if exists(select 1 from public.capacity_reservations where consolidation_id=i and status='HELD') then raise exception 'CONFIRMED_CONSOLIDATION_RESERVATION_REQUIRED' using errcode='PT409';end if;
   child_action:='executions.start';
  else
   if cc.status<>'IN_PROGRESS' and not(p_action='consolidations.cancel' and cc.status='OPEN') then raise exception 'INVALID_CONSOLIDATION_STATE' using errcode='PT409';end if;
   select array_agg(id order by id) into members from public.transport_executions where consolidation_id=i and (status='IN_PROGRESS' or p_action='consolidations.cancel' and status='PLANNED');
   if coalesce(cardinality(members),0)=0 then raise exception 'CONSOLIDATION_MEMBER_COUNT_INVALID' using errcode='PT409';end if;
   child_action:=case p_action when 'consolidations.complete' then 'executions.complete' when 'consolidations.cancel' then 'executions.cancel' else 'executions.position' end;
  end if;
  select coalesce(array_agg(id),'{}'::uuid[]) into old_events from public.execution_events where parent_id=any(members);
  if p_action='consolidations.cancel' then
   select array_agg(distinct consolidation_id) into affected from public.transport_executions where booking_id in (select booking_id from public.transport_executions where id=any(members)) and consolidation_id is not null;
   update public.capacity_consolidations set status='CANCELLING' where id=any(affected) and status='IN_PROGRESS';
  elsif p_action='consolidations.complete' then update public.capacity_consolidations set status='COMPLETING' where id=i;end if;
  for e in select * from public.transport_executions where id=any(members) order by id loop
   if p_action='consolidations.start' then
    if e.planned_starts_at<>(cc.data#>>'{window,startsAt}')::timestamptz or e.planned_ends_at<>(cc.data#>>'{window,endsAt}')::timestamptz then raise exception 'SHARED_TRIP_WINDOW_MISMATCH' using errcode='PT409';end if;
    select jsonb_build_object('drivers',(select jsonb_agg(jsonb_build_array(driver_id,role,starts_at,ends_at) order by driver_id,role,starts_at,ends_at) from public.driver_assignments where execution_id=e.id and status='CONFIRMED'),
     'vehicles',(select jsonb_agg(jsonb_build_array(transport_asset_id,vehicle_combination_id,starts_at,ends_at) order by transport_asset_id,vehicle_combination_id,starts_at,ends_at) from public.vehicle_assignments where execution_id=e.id and status='CONFIRMED')) into next_signature;
    if first_member then signature:=next_signature;first_member:=false;elsif next_signature is distinct from signature then raise exception 'SHARED_TRIP_CREW_MISMATCH' using errcode='PT409';end if;
    if not exists(select 1 from public.driver_assignments where execution_id=e.id and status='CONFIRMED' and role='PRIMARY' and starts_at<=e.planned_starts_at and ends_at>=e.planned_ends_at)
     or exists(select 1 from public.vehicle_assignments where execution_id=e.id and status='CONFIRMED' and (starts_at>e.planned_starts_at or ends_at<e.planned_ends_at)) then raise exception 'CONFIRMED_CREW_REQUIRED' using errcode='PT409';end if;
   end if;
   child_value:=p_value||jsonb_build_object('expectedVersion',e.version);
   if child_action='executions.cancel' and e.status not in ('PLANNED','IN_PROGRESS') then continue;end if;
   perform private.command_v2_workflow_before_ltl_operations(p_organization_id,p_member_id,child_action,jsonb_build_object('carrierId',c,'id',e.id),gen_random_uuid(),child_value);
  end loop;
  update public.execution_events set consolidation_id=i,physical_event_id=event_id where parent_id=any(members) and not(id=any(old_events));
  update public.capacity_consolidations set status=case p_action when 'consolidations.start' then 'IN_PROGRESS' when 'consolidations.complete' then 'COMPLETED' when 'consolidations.cancel' then 'CANCELLED' else 'IN_PROGRESS' end,
   version=version+1,updated_at=now(),data=data||jsonb_build_object('lastPhysicalEvent',jsonb_build_object('id',event_id,'action',p_action,'at',now(),'actorId',p_member_id,'audit',p_value))
    ||case when p_action='consolidations.start' then jsonb_build_object('memberExecutionIds',to_jsonb(members),'physicalCrew',signature) else '{}'::jsonb end where id=i;
  update public.capacity_consolidations cc2 set status=case when exists(select 1 from public.transport_executions where consolidation_id=cc2.id and status='IN_PROGRESS') then 'IN_PROGRESS' else 'CANCELLED' end,version=version+1,updated_at=now() where id=any(affected) and id<>i and status='CANCELLING';
 end if;
 result:=private.workflow_record('consolidations',i);
 perform private.workflow_save_receipt(p_organization_id,p_member_id,(p_context->>'carrierId')::uuid,p_key,h,result);
 return jsonb_build_object('record',result,'replay',false);
end;$$;

-- Preserves 20261005181940_hac40_cp1_contract_reconciliation.sql (private.command_v2_workflow_before_f05); only actor/receipt dispatch changes.
create or replace function private.command_v2_workflow_before_f05(p_organization_id uuid,p_member_id uuid,p_action text,p_context jsonb,p_key uuid,p_value jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;record jsonb;begin
 result:=private.command_v2_workflow_before_cp1(p_organization_id,p_member_id,p_action,p_context,p_key,p_value);
 record:=result->'record';
 if record->>'kind'='routes' and not (record->'data') ? 'planner' then
  result:=jsonb_set(result,'{record,data,planner}',private.workflow_planner_snapshot(record->'data'));
 end if;
 return result;
end;$$;

-- Preserves 20261005192012_hac40_uml_cardinalities.sql (private.command_v2_workflow_before_model_associations); only actor/receipt dispatch changes.
create or replace function private.command_v2_workflow_before_model_associations(p_organization_id uuid,p_member_id uuid,p_action text,p_context jsonb,p_key uuid,p_value jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v jsonb:=p_value;result jsonb;pid uuid;b uuid;matches integer;begin
 perform private.workflow_actor(p_organization_id,p_member_id,(p_context->>'carrierId')::uuid,false);
 if p_context->>'carrierId' is not null then perform private.identity_carrier_action((p_context->>'carrierId')::uuid,p_action);end if;
 if p_action in ('opportunities.create','offers.create','holds.create') then perform private.workflow_validate(p_action,p_value);end if;
 if p_action='opportunities.create' then
  pid:=(v->>'planId')::uuid;
  perform private.workflow_scope(p_organization_id,null,'plans',pid);
  v:=jsonb_set(v,'{assignmentIds}',private.expand_leg_assignments(v->'assignmentIds',pid));
 elsif p_action='offers.create' then
  perform private.workflow_scope(p_organization_id,(p_context->>'carrierId')::uuid,'opportunities',(p_context->>'parentId')::uuid);
  v:=jsonb_set(v,'{coveredAssignmentIds}',private.expand_leg_assignments(v->'coveredAssignmentIds',(v->>'planCandidateId')::uuid));
 elsif p_action='holds.create' then
  perform private.workflow_scope(p_organization_id,null,'bookings',(v->>'bookingId')::uuid);
  select count(*),min(rb.id::text)::uuid into matches,b from public.plan_resource_bindings rb
   join public.v2_bookings book on book.id=(v->>'bookingId')::uuid join public.v2_carrier_offers oo on oo.id=book.offer_id
   where rb.leg_assignment_id=(v->>'assignmentId')::uuid and rb.plan_id=oo.plan_id
   and (not v ? 'planResourceId' or rb.resource_id=(v->>'planResourceId')::uuid);
  if matches=0 then raise exception 'RESOURCE_ASSIGNMENT_MISMATCH' using errcode='PT400';
  elsif matches>1 then raise exception 'PLAN_RESOURCE_REQUIRED' using errcode='PT409';end if;
  v:=jsonb_set(v-'planResourceId','{assignmentId}',to_jsonb(b));
 end if;
 result:=private.command_v2_workflow_before_f05(p_organization_id,p_member_id,p_action,p_context,p_key,v);
 return jsonb_set(result,'{record}',private.project_workflow_record(result#>>'{record,kind}',result->'record'));
end;$$;

-- Preserves 20261007083000_hac40_model_associations.sql (private.command_v2_workflow); only actor/receipt dispatch changes.
create or replace function private.command_v2_workflow(p_organization_id uuid,p_member_id uuid,p_action text,
 p_context jsonb,p_key uuid,p_value jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare o uuid:=p_organization_id;c uuid;ident uuid;parent uuid;old jsonb;result jsonb;h text;
 receipt private.v2_workflow_receipts;a public.plan_leg_assignments;v jsonb:=p_value;pid uuid;begin
 if p_action not in ('plans.partner','incidents.conditions') then
  result:=private.command_v2_workflow_before_model_associations(o,p_member_id,p_action,p_context,p_key,v);
  if not (result->>'replay')::boolean then
   if p_action='offers.create' then
    select plan_id into pid from public.v2_carrier_offers where id=(result#>>'{record,id}')::uuid;
   elsif p_action in ('bookings.create','bookings.confirm') then
    select f.plan_id into pid from public.v2_bookings b join public.v2_carrier_offers f on f.id=b.offer_id
     where b.id=(result#>>'{record,id}')::uuid;
   elsif p_action in ('holds.create','holds.confirm') then
    select f.plan_id into pid from public.capacity_reservations h join public.v2_bookings b on b.id=h.booking_id
     join public.v2_carrier_offers f on f.id=b.offer_id where h.id=(result#>>'{record,id}')::uuid;
   elsif p_action='executions.start' then
    select f.plan_id into pid from public.transport_executions e join public.v2_bookings b on b.id=e.booking_id
     join public.v2_carrier_offers f on f.id=b.offer_id where e.id=(result#>>'{record,id}')::uuid;
   end if;
   if pid is not null then perform private.check_plan_partners(pid);end if;
  end if;
  return result;
 end if;
 if p_key is null or p_context is null or jsonb_typeof(p_context)<>'object'
  or (p_context-'carrierId'-'requestId'-'parentId'-'id')<>'{}' then
  raise exception 'VALIDATION_ERROR' using errcode='PT400';end if;
 c:=(p_context->>'carrierId')::uuid;ident:=(p_context->>'id')::uuid;parent:=(p_context->>'parentId')::uuid;
 if ident is null or p_context->>'requestId' is not null then raise exception 'VALIDATION_ERROR' using errcode='PT400';end if;
 perform private.workflow_actor(o,p_member_id,(p_context->>'carrierId')::uuid,p_action='plans.partner');
 if p_context->>'carrierId' is not null then perform private.identity_carrier_action((p_context->>'carrierId')::uuid,p_action);end if;
 if v ? 'action' then raise exception 'VALIDATION_ERROR' using errcode='PT400';end if;
 perform private.workflow_validate('incidents.update',
  (v-'partnerId'-'conditionIds')||jsonb_build_object('action','NOTE'));
 if p_action='plans.partner' then
  if c is not null or parent is null or not(v ? 'partnerId') or v ? 'conditionIds'
   or jsonb_typeof(v->'partnerId') not in ('null','string') then raise exception 'VALIDATION_ERROR' using errcode='PT400';end if;
 else
  if parent is not null or v ? 'partnerId' or not coalesce(extensions.jsonb_matches_schema(
   '{"type":"array","maxItems":100,"uniqueItems":true,"items":{"type":"string","format":"uuid"}}',v->'conditionIds'),false)
   then raise exception 'VALIDATION_ERROR' using errcode='PT400';end if;
  perform private.workflow_carrier(c);
 end if;
 -- Match the existing native command lock order and hash/receipt namespace.
 perform 1 from public.carrier_services order by id for update;
 old:=private.workflow_scope(o,c,case when p_action='plans.partner' then 'plans' else 'incidents' end,ident);
 h:=private.hash_v2_freight_payload(jsonb_build_object('action',p_action,'context',p_context,'value',v));
 perform pg_advisory_xact_lock(hashtextextended(coalesce(o::text,p_context->>'carrierId')||':'||p_member_id::text||':'||p_key::text,0));
 receipt:=private.workflow_receipt(o,p_member_id,(p_context->>'carrierId')::uuid,p_key);
 if receipt.idempotency_key is not null then
  if receipt.payload_hash<>h then raise exception 'IDEMPOTENCY_CONFLICT' using errcode='PT409';end if;
  return jsonb_build_object('record',receipt.result,'replay',true);
 end if;
 if (v->>'expectedVersion')::integer<>(old->>'version')::integer then raise exception 'STALE_DRAFT' using errcode='PT409';end if;
 if p_action='plans.partner' then
  select * into a from public.plan_leg_assignments where id=parent and plan_id=ident for update;
  if a.id is null then raise exception 'WORKFLOW_NOT_FOUND' using errcode='PT404';end if;
  if exists(select 1 from public.carrier_opportunities where parent_id=ident)
   or exists(select 1 from public.v2_carrier_offers where plan_id=ident) then
   raise exception 'PLAN_COMMERCIAL_SNAPSHOT_LOCKED' using errcode='PT409';end if;
  update public.plan_leg_assignments set fulfilment_partner_id=(v->>'partnerId')::uuid,
   data=data||jsonb_build_object('partnerAudit',v||jsonb_build_object('actorId',p_member_id,'at',now())) where id=parent;
  update public.transport_plan_candidates set version=version+1,updated_at=now() where id=ident;
  result:=private.workflow_record('plans',ident);
 else
  delete from public.incident_route_conditions where incident_id=ident;
  insert into public.incident_route_conditions select ident,value::uuid from jsonb_array_elements_text(v->'conditionIds');
  update public.operational_incidents set version=version+1,updated_at=now(),
   data=data||jsonb_build_object('conditionAudit',v||jsonb_build_object('actorId',p_member_id,'at',now())) where id=ident;
  result:=private.workflow_record('incidents',ident);
 end if;
 perform private.workflow_save_receipt(o,p_member_id,(p_context->>'carrierId')::uuid,p_key,h,result);
 return jsonb_build_object('record',result,'replay',false);
end;$$;

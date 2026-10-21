-- One atomic delegated preparation/confirmation, with policy and customer audit.
begin;
create table private.dispatch_booking_audit(
 booking_id uuid primary key references public.v2_bookings(id),policy_id uuid not null references private.carrier_quote_policies(id),
 policy_version integer not null check(policy_version>0),operator_id uuid not null references public.carrier_operators(id),
 organization_id uuid not null references public.organizations(id),member_id uuid not null references public.organization_members(id),
 auth_user_id uuid not null references auth.users(id),confirmed_at timestamptz not null default now(),policy_snapshot jsonb not null check(jsonb_typeof(policy_snapshot)='object')
);
create index dispatch_booking_policy_idx on private.dispatch_booking_audit(policy_id);
create index dispatch_booking_operator_idx on private.dispatch_booking_audit(operator_id);
create index dispatch_booking_organization_idx on private.dispatch_booking_audit(organization_id);
create index dispatch_booking_member_idx on private.dispatch_booking_audit(member_id);
create index dispatch_booking_auth_idx on private.dispatch_booking_audit(auth_user_id);
alter table private.dispatch_booking_audit enable row level security;
revoke all on private.dispatch_booking_audit from public,anon,authenticated,service_role;
create function public.prepare_v2_delegated_booking(p_organization_id uuid,p_member_id uuid,p_booking_id uuid,p_expected_version integer,p_key uuid,p_consent text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare b public.v2_bookings;offer public.v2_carrier_offers;issued private.quote_issued_offers;p private.carrier_quote_policies;r private.quote_command_receipts;
 result jsonb;h text;plan jsonb;ctx jsonb;leg jsonb;resource jsonb;binding uuid;held public.capacity_reservations;execution public.transport_executions;
 evidence jsonb;expiry timestamptz;window_deadline timestamptz;expected_holds integer:=0;execution_ids jsonb:='[]';hold_ids jsonb:='[]';sid uuid;begin
 perform private.workflow_member(p_organization_id,p_member_id,true);
 if p_key is null or p_expected_version is null or p_expected_version<1 or p_consent is distinct from 'PREPARE_AUTHORIZED_CAPACITY' then raise exception 'VALIDATION_ERROR' using errcode='PT400';end if;
 h:=private.hash_v2_freight_payload(jsonb_build_object('booking',p_booking_id,'version',p_expected_version,'consent',p_consent));
 perform 1 from public.carrier_services order by id for update;
 perform 1 from public.freight_requests where id=(select freight_request_id from public.v2_bookings where id=p_booking_id and organization_id=p_organization_id) for update;
 select * into b from public.v2_bookings where id=p_booking_id and organization_id=p_organization_id for update;
 if not found then raise exception 'WORKFLOW_NOT_FOUND' using errcode='PT404';end if;
 perform pg_advisory_xact_lock(hashtextextended('dispatch-booking:'||p_member_id||':'||p_key,0));
 select * into r from private.quote_command_receipts where actor_id=p_member_id and key=p_key and scope='dispatch-booking';
 if found then if r.payload_hash<>h then raise exception 'IDEMPOTENCY_CONFLICT' using errcode='PT409';end if;return r.result;end if;
 -- A manual or revoked policy never grants the shipper general Carrier command authority.
 select * into issued from private.quote_issued_offers where offer_id=b.offer_id;
 select * into p from private.carrier_quote_policies where id=issued.policy_id and carrier_id=b.carrier_id for share;
 if not private.dispatch_policy_authorized(p) or p.version is distinct from issued.policy_version or p.value is distinct from issued.policy_snapshot
  or not coalesce((p.value#>>'{dispatch,autoConfirm}')::boolean,false) or not coalesce((p.value#>>'{dispatch,acknowledgeSchedulingAuthority}')::boolean,false) then return null;end if;
 if b.version is distinct from p_expected_version then raise exception 'STALE_DRAFT' using errcode='PT409';end if;
 if b.status<>'AUTHORIZED' or b.data->>'authorizationStatus'<>'AUTHORIZED' or b.data->>'carrierConfirmationStatus'<>'PENDING' then raise exception 'BOOKING_NOT_AUTHORIZED' using errcode='PT409';end if;
 select * into offer from public.v2_carrier_offers where id=b.offer_id and organization_id=p_organization_id and carrier_id=b.carrier_id and freight_request_id=b.freight_request_id;
 if offer.id is null or offer.data#>>'{price,currency}'<>'USD' or (offer.data#>>'{price,amount}')::numeric>(p.value#>>'{dispatch,maxBookingAmount}')::numeric then return null;end if;
 if not private.workflow_offer_current(offer.id) or not private.workflow_current_plan(offer.plan_id) then raise exception 'PLAN_OR_OFFER_NOT_CURRENT' using errcode='PT409';end if;
 select deadline into window_deadline from private.quote_booking_windows where booking_id=b.id for update;
 expiry:=least((offer.data#>>'{validity,endsAt}')::timestamptz,window_deadline,(p.value->>'validUntil')::timestamptz);
 if expiry<=now() then raise exception 'BOOKING_CONFIRMATION_EXPIRED' using errcode='PT409';end if;
 offer.data:=jsonb_set(offer.data,'{coveredAssignmentIds}',private.canonical_assignment_ids(offer.data->'coveredAssignmentIds'));
 plan:=private.workflow_record('plans',offer.plan_id);ctx:=jsonb_build_object('id',null,'parentId',null,'carrierId',null,'requestId',b.freight_request_id);
 for leg in select value from jsonb_array_elements(plan#>'{data,legAssignments}') where offer.data->'coveredAssignmentIds' ? (value->>'id') loop
  sid:=(leg->>'serviceId')::uuid;
  if (leg->>'carrierId')::uuid is distinct from b.carrier_id or not offer.data->'coveredServiceIds' ? sid::text then raise exception 'INVALID_BOOKING_SCOPE' using errcode='PT409';end if;
  select * into execution from public.transport_executions where booking_id=b.id and carrier_service_id=sid order by id limit 1 for update;
  if execution.id is null then
   result:=private.command_v2_workflow(p_organization_id,p_member_id,'executions.create',ctx,gen_random_uuid(),jsonb_build_object('schemaVersion','2.0','bookingId',b.id,'serviceId',sid));
   select * into execution from public.transport_executions where id=(result#>>'{record,id}')::uuid;
  end if;
  if execution.status<>'PLANNED' then raise exception 'EXECUTION_NOT_READY' using errcode='PT409';end if;
  if not execution_ids ? execution.id::text then execution_ids:=execution_ids||jsonb_build_array(execution.id);end if;
  for resource in select value from jsonb_array_elements(leg->'resources') loop
   expected_holds:=expected_holds+1;
   select aa.id into binding from public.plan_resource_bindings aa where aa.id=(resource->>'bindingId')::uuid and aa.leg_assignment_id=(leg->>'id')::uuid and aa.plan_id=offer.plan_id and aa.resource_id=(resource->>'resourceId')::uuid and aa.carrier_service_id=sid and aa.starts_at=(resource#>>'{resource,window,startsAt}')::timestamptz and aa.ends_at=(resource#>>'{resource,window,endsAt}')::timestamptz;
   if binding is null then raise exception 'RESOURCE_ASSIGNMENT_MISMATCH' using errcode='PT409';end if;
   evidence:=coalesce(resource#>'{resource,verificationSource,source}',leg#>'{evidence,0}');
   if not private.workflow_evidence(evidence,(resource#>>'{resource,window,startsAt}')::timestamptz,(resource#>>'{resource,window,endsAt}')::timestamptz) then raise exception 'CAPACITY_EVIDENCE_REQUIRED' using errcode='PT409';end if;
   select * into held from public.capacity_reservations where booking_id=b.id and plan_assignment_id=binding and parent_reservation_id is null for update;
   if held.id is null then
    result:=private.command_v2_workflow(p_organization_id,p_member_id,'holds.create',ctx,gen_random_uuid(),jsonb_build_object('schemaVersion','2.0','bookingId',b.id,'assignmentId',leg->>'id','planResourceId',resource->>'resourceId','expiresAt',least(expiry,(resource#>>'{resource,window,endsAt}')::timestamptz),'consolidationId',null,'evidence',evidence));
    select * into held from public.capacity_reservations where id=(result#>>'{record,id}')::uuid;
   end if;
   if held.status not in('HELD','CONFIRMED') or held.status='HELD' and held.expires_at<=now() or held.capacity_calendar_id is distinct from (resource#>>'{resource,calendarId}')::uuid or held.starts_at is distinct from (resource#>>'{resource,window,startsAt}')::timestamptz or held.ends_at is distinct from (resource#>>'{resource,window,endsAt}')::timestamptz then raise exception 'RESOURCE_REVALIDATION_REQUIRED' using errcode='PT409';end if;
   hold_ids:=hold_ids||jsonb_build_array(held.id);
  end loop;
 end loop;
 if expected_holds=0 or expected_holds>32 or exists(select 1 from jsonb_array_elements_text(offer.data->'coveredAssignmentIds') x where not exists(select 1 from public.plan_resource_bindings a join public.capacity_reservations rr on rr.plan_assignment_id=a.id where a.plan_id=offer.plan_id and rr.booking_id=b.id and rr.id in(select value::uuid from jsonb_array_elements_text(hold_ids)) and a.leg_assignment_id=x.value::uuid)) then raise exception 'CAPACITY_COMMITMENT_REQUIRED' using errcode='PT409';end if;
 if not private.workflow_current_plan(offer.plan_id) then raise exception 'PLAN_NOT_ELIGIBLE' using errcode='PT409';end if;
 -- Native holds already enforce calendar exclusions and deferred fleet guards. No execution starts here.
 update public.capacity_reservations set status='CONFIRMED',version=version+1,updated_at=now() where (id in(select value::uuid from jsonb_array_elements_text(hold_ids)) or parent_reservation_id in(select value::uuid from jsonb_array_elements_text(hold_ids))) and status='HELD';
 evidence:=jsonb_build_object('reference','quote-policy:'||p.id||':v'||p.version,'provider','Carrier-approved scheduling','observedAt',p.updated_at,'validUntil',p.value->>'validUntil','provenanceStatus',p.value->>'provenanceStatus');
 insert into private.dispatch_booking_audit(booking_id,policy_id,policy_version,operator_id,organization_id,member_id,auth_user_id,policy_snapshot) values(b.id,p.id,p.version,p.operator_id,p_organization_id,p_member_id,auth.uid(),p.value);
 update public.v2_bookings set status='CONFIRMED',version=version+1,updated_at=now(),data=data||jsonb_build_object('carrierConfirmationStatus','CONFIRMED','carrierReference','AUTO-'||left(b.id::text,8),'confirmedAt',now(),'confirmationEvidence',evidence,'confirmedBy',p.operator_id,'capacityEvidence',(select jsonb_agg(private.workflow_record('holds',rr.id) order by rr.id) from public.capacity_reservations rr where rr.booking_id=b.id and rr.status='CONFIRMED')) where id=b.id;
 result:=jsonb_build_object('schemaVersion','2.0','data',jsonb_build_object('bookingId',b.id,'status','SCHEDULED','executionIds',execution_ids,'holdIds',hold_ids));
 insert into private.quote_command_receipts values(p_member_id,p_key,'dispatch-booking',h,result);return result;
end;$$;
revoke all on function public.prepare_v2_delegated_booking(uuid,uuid,uuid,integer,uuid,text) from public,anon,service_role;
grant execute on function public.prepare_v2_delegated_booking(uuid,uuid,uuid,integer,uuid,text) to authenticated;
commit;

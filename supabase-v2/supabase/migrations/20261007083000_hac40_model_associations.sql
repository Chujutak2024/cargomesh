-- HAC-40: canonical UML associations. Production structure/commands only.
alter table public.plan_leg_assignments add column fulfilment_partner_id uuid
 references public.fulfilment_partners(id);
create index leg_assignment_partner_idx on public.plan_leg_assignments(fulfilment_partner_id);

create function private.validate_leg_partner() returns trigger
language plpgsql security definer set search_path='' as $$
declare p public.fulfilment_partners; c uuid;begin
 if new.fulfilment_partner_id is null then return new;end if;
 select * into p from public.fulfilment_partners where id=new.fulfilment_partner_id for update;
 select carrier_id into c from public.carrier_services where id=new.carrier_service_id;
 if p.id is null or p.carrier_id is distinct from c then
  raise exception 'PARTNER_SERVICE_MISMATCH' using errcode='PT400';end if;
 if p.status<>'ACTIVE' or p.agreement_valid_from is null or p.agreement_valid_until is null
  or p.agreement_valid_from>new.starts_at or p.agreement_valid_until<new.ends_at then
  raise exception 'PARTNER_AGREEMENT_REQUIRED' using errcode='PT409';end if;
 return new;
end;$$;
create trigger leg_partner_guard before insert or update on public.plan_leg_assignments
 for each row execute function private.validate_leg_partner();
create function private.check_plan_partners(pid uuid) returns void
language plpgsql security definer set search_path='' as $$begin
 perform 1 from public.fulfilment_partners where id in(
  select fulfilment_partner_id from public.plan_leg_assignments where plan_id=pid) order by id for update;
 if exists(select 1 from public.plan_leg_assignments a join public.carrier_services s on s.id=a.carrier_service_id
  join public.fulfilment_partners p on p.id=a.fulfilment_partner_id where a.plan_id=pid
  and (p.carrier_id<>s.carrier_id or p.status<>'ACTIVE' or p.agreement_valid_from is null
   or p.agreement_valid_until is null or p.agreement_valid_from>a.starts_at or p.agreement_valid_until<a.ends_at))
 then raise exception 'PARTNER_AGREEMENT_REQUIRED' using errcode='PT409';end if;
end;$$;

create table public.incident_route_conditions(
 incident_id uuid not null references public.operational_incidents(id),
 condition_id uuid not null references public.route_conditions(id),
 primary key(incident_id,condition_id));
create index incident_conditions_condition_idx on public.incident_route_conditions(condition_id);
alter table public.incident_route_conditions enable row level security;
revoke all on public.incident_route_conditions from public,anon,authenticated,service_role;
create function private.validate_incident_condition() returns trigger
language plpgsql security definer set search_path='' as $$
declare i public.operational_incidents; c public.route_conditions;begin
 select * into i from public.operational_incidents where id=new.incident_id;
 select * into c from public.route_conditions where id=new.condition_id;
 if i.id is null or c.id is null or not exists(
  select 1 from public.transport_executions e
  join public.v2_bookings b on b.id=e.booking_id
  join public.v2_carrier_offers o on o.id=b.offer_id
  join public.transport_plan_candidates p on p.id=o.plan_id
  join public.plan_leg_assignments a on a.plan_id=p.id and a.carrier_service_id=e.carrier_service_id
  join public.route_legs l on l.id=a.route_leg_id
  where e.id=i.parent_id and l.corridor_id=c.parent_id) then
  raise exception 'INCIDENT_CONDITION_ROUTE_MISMATCH' using errcode='PT400';end if;
 if c.status<>'ACTIVE' or (c.data->>'observedAt')::timestamptz>(i.data->>'occurredAt')::timestamptz
  or (c.data->>'validUntil')::timestamptz<(i.data->>'occurredAt')::timestamptz then
  raise exception 'INCIDENT_CONDITION_PERIOD_MISMATCH' using errcode='PT400';end if;
 return new;
end;$$;
create trigger incident_condition_guard before insert or update on public.incident_route_conditions
 for each row execute function private.validate_incident_condition();

alter function private.workflow_record(text,uuid) rename to workflow_record_before_model_associations;
create function private.workflow_record(k text,i uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r jsonb; g jsonb; groups jsonb:='[]';begin
 r:=private.workflow_record_before_model_associations(k,i);
 if k='plans' then
  for g in select value from jsonb_array_elements(r#>'{data,legAssignments}') loop
   groups:=groups||jsonb_build_array(g||jsonb_build_object('fulfilmentPartnerId',
    (select fulfilment_partner_id from public.plan_leg_assignments where id=(g->>'id')::uuid)));
  end loop;
  r:=jsonb_set(r,'{data,legAssignments}',groups);
 elsif k='incidents' then
  r:=jsonb_set(r,'{data,routeConditionIds}',coalesce((select jsonb_agg(condition_id order by condition_id)
   from public.incident_route_conditions where incident_id=i),'[]'));
 end if;return r;
end;$$;

alter function private.command_v2_workflow(uuid,uuid,text,jsonb,uuid,jsonb)
 rename to command_v2_workflow_before_model_associations;
create function private.command_v2_workflow(p_organization_id uuid,p_member_id uuid,p_action text,
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
 perform private.workflow_member(o,p_member_id,p_action='plans.partner');
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
 perform pg_advisory_xact_lock(hashtextextended(o::text||':'||p_member_id::text||':'||p_key::text,0));
 select * into receipt from private.v2_workflow_receipts where organization_id=o and member_id=p_member_id and idempotency_key=p_key;
 if found then
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
 insert into private.v2_workflow_receipts(organization_id,member_id,idempotency_key,payload_hash,result)
 values(o,p_member_id,p_key,h,result);
 return jsonb_build_object('record',result,'replay',false);
end;$$;
revoke all on function private.validate_leg_partner(),private.check_plan_partners(uuid),private.validate_incident_condition(),
 private.workflow_record(text,uuid),private.workflow_record_before_model_associations(text,uuid),
 private.command_v2_workflow(uuid,uuid,text,jsonb,uuid,jsonb),
 private.command_v2_workflow_before_model_associations(uuid,uuid,text,jsonb,uuid,jsonb)
 from public,anon,authenticated,service_role;

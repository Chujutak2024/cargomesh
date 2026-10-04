-- HAC-40: one physical LTL journey, isolated per-booking projections.
-- Additive schema/logic only. No demo rows, identity provisioning or hosted seed.
set search_path=public,extensions;
alter table public.driver_assignments add column occupancy_group_id uuid not null default gen_random_uuid();
update public.driver_assignments da set occupancy_group_id=coalesce(e.consolidation_id,da.id) from public.transport_executions e where e.id=da.execution_id;
comment on column public.driver_assignments.occupancy_group_id is 'Derived occupancy key: one evidenced consolidation or an independent assignment; clients cannot choose it.';
do $$declare constraint_name text;begin
 select conname into constraint_name from pg_constraint where conrelid='public.driver_assignments'::regclass and contype='x';
 if constraint_name is null then raise exception 'DRIVER_EXCLUSION_MISSING';end if;
 execute format('alter table public.driver_assignments drop constraint %I',constraint_name);
end;$$;
alter table public.driver_assignments add constraint driver_physical_trip_exclusion
 exclude using gist(driver_id with =,occupancy_group_id with <>,tstzrange(starts_at,ends_at,'[)') with &&)
 where(status in ('PROPOSED','CONFIRMED'));
alter table public.execution_events add column consolidation_id uuid references public.capacity_consolidations(id),add column physical_event_id uuid;
create index execution_events_consolidation_idx on public.execution_events(consolidation_id,created_at,id);
create index execution_events_physical_event_idx on public.execution_events(physical_event_id);
reset search_path;

create or replace function private.workflow_same_trip(a uuid,b uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.transport_executions aa join public.transport_executions bb on bb.consolidation_id=aa.consolidation_id
 join public.capacity_consolidations cc on cc.id=aa.consolidation_id where aa.id=a and bb.id=b and aa.carrier_id=bb.carrier_id
 and aa.carrier_service_id=bb.carrier_service_id and cc.status in ('OPEN','IN_PROGRESS','COMPLETING','CANCELLING')
 and private.workflow_evidence(cc.data->'evidence',aa.planned_starts_at,aa.planned_ends_at));$$;

create function private.guard_v2_driver_occupancy() returns trigger language plpgsql security definer set search_path='' as $$
declare e public.transport_executions;cc public.capacity_consolidations;begin
 select * into e from public.transport_executions where id=new.execution_id;
 if e.id is null then raise exception 'INVALID_CATALOG_REFERENCE' using errcode='PT400';end if;
 if e.consolidation_id is null then
  if tg_op='UPDATE' then new.occupancy_group_id:=old.occupancy_group_id;else new.occupancy_group_id:=new.id;end if;
 else
  select * into cc from public.capacity_consolidations where id=e.consolidation_id;
  if cc.carrier_id is distinct from e.carrier_id or cc.carrier_service_id is distinct from e.carrier_service_id
   or cc.status not in ('OPEN','IN_PROGRESS','COMPLETING','CANCELLING') and new.status in ('PROPOSED','CONFIRMED')
   then raise exception 'INVALID_CONSOLIDATION_MEMBER' using errcode='PT400';end if;
  if new.status='CONFIRMED' and not exists(select 1 from public.capacity_reservations rr
   where rr.execution_id=e.id and rr.consolidation_id=cc.id and rr.status='CONFIRMED' and rr.parent_reservation_id is null)
   then raise exception 'CONFIRMED_CONSOLIDATION_RESERVATION_REQUIRED' using errcode='PT409';end if;
  new.occupancy_group_id:=cc.id;
 end if;
 return new;end;$$;
create trigger a_driver_occupancy before insert or update on public.driver_assignments for each row execute function private.guard_v2_driver_occupancy();

alter function private.workflow_trip_compatible(uuid,uuid,uuid,uuid,timestamptz,timestamptz) rename to workflow_trip_compatible_before_ltl_operations;
create function private.workflow_trip_compatible(batch uuid,pid uuid,sid uuid,calid uuid,s timestamptz,t timestamptz) returns boolean language plpgsql stable security definer set search_path='' as $$begin
 if exists(select 1 from public.capacity_consolidations where id=batch and status<>'OPEN') then raise exception 'CONSOLIDATION_MEMBERSHIP_FROZEN' using errcode='PT409';end if;
 return private.workflow_trip_compatible_before_ltl_operations(batch,pid,sid,calid,s,t);end;$$;

alter function private.workflow_record(text,uuid) rename to workflow_record_before_ltl_operations;
create function private.workflow_record(k text,i uuid) returns jsonb language plpgsql security definer set search_path='' as $$declare result jsonb;e public.execution_events;begin
 result:=private.workflow_record_before_ltl_operations(k,i);
 if k='executions' then result:=jsonb_set(result,'{data}',result->'data'||jsonb_build_object('consolidationId',(select consolidation_id from public.transport_executions where id=i)));
 elsif k='execution-events' then select * into e from public.execution_events where id=i;result:=jsonb_set(result,'{data}',result->'data'||jsonb_build_object('consolidationId',e.consolidation_id,'physicalEventId',e.physical_event_id));end if;
 return result;end;$$;
create or replace function private.guard_v2_crew() returns trigger language plpgsql set search_path='' as $$
declare e public.transport_executions%rowtype;d public.drivers%rowtype;a public.transport_assets%rowtype;w jsonb;
 c public.vehicle_combinations%rowtype;r public.capacity_reservations%rowtype;cal public.capacity_calendars%rowtype;
 sec numeric;occupied_weight numeric;occupied_volume numeric;point_at timestamptz;service_class text;begin
 if current_user<>'postgres' or tg_op='DELETE' then raise exception 'COMMAND_REQUIRED' using errcode='42501';end if;
 if tg_op='UPDATE' then
  if new.id<>old.id or new.carrier_id<>old.carrier_id or new.carrier_service_id<>old.carrier_service_id then raise exception 'IMMUTABLE_FLEET_SCOPE' using errcode='PT400';end if;
  new.version:=old.version+1;new.updated_at:=now();
 end if;
 perform 1 from public.carrier_services where id=new.carrier_service_id and carrier_id=new.carrier_id and transport_mode='ROAD';
 if not found then raise exception 'INVALID_CATALOG_REFERENCE' using errcode='PT400';end if;
 if tg_table_name='drivers' then
  for w in select x from jsonb_array_elements(new.available_windows)x loop
   if (w->>'endsAt')::timestamptz<=(w->>'startsAt')::timestamptz then raise exception 'VALIDATION_ERROR' using errcode='PT400';end if;
  end loop;
  if not exists(select 1 from pg_timezone_names where name=new.license_timezone) then raise exception 'VALIDATION_ERROR' using errcode='PT400';end if;
  if new.carrier_operator_id is not null and not exists(select 1 from public.carrier_operators where id=new.carrier_operator_id and carrier_id=new.carrier_id and status='ACTIVE') then raise exception 'INVALID_CATALOG_REFERENCE' using errcode='PT400';end if;
  if tg_op='UPDATE' and exists(select 1 from public.driver_assignments where driver_id=old.id and status in ('PROPOSED','CONFIRMED') and ends_at>now()) then raise exception 'FLEET_COMMITMENT_CONFLICT' using errcode='PT409';end if;
 elsif tg_table_name='vehicle_combinations' then
  if tg_op='UPDATE' and exists(select 1 from public.vehicle_assignments where vehicle_combination_id=old.id and status in ('PROPOSED','CONFIRMED') and ends_at>now()) then raise exception 'FLEET_COMMITMENT_CONFLICT' using errcode='PT409';end if;
  if new.status='COUPLED' and not private.crew_evidence(new.compatibility_evidence,new.starts_at,new.ends_at) then raise exception 'FLEET_EVIDENCE_REQUIRED' using errcode='PT409';end if;
 else
  select * into e from public.transport_executions where id=new.execution_id;
  if e.consolidation_id is not null and exists(select 1 from public.capacity_consolidations where id=e.consolidation_id and status='IN_PROGRESS') then raise exception 'CONSOLIDATION_CREW_FROZEN' using errcode='PT409';end if;
  if e.id is null or e.carrier_id<>new.carrier_id or e.carrier_service_id<>new.carrier_service_id
   or new.starts_at<e.planned_starts_at or new.ends_at>e.planned_ends_at or e.status in ('CANCELLED','COMPLETED') then raise exception 'INVALID_CATALOG_REFERENCE' using errcode='PT400';end if;
  if tg_op='UPDATE' then
   if new.execution_id<>old.execution_id or (old.status in ('RELEASED','CANCELLED') and new.status<>old.status)
    or (old.status='CONFIRMED' and new.status='PROPOSED') then raise exception 'INVALID_ASSIGNMENT_TRANSITION' using errcode='PT400';end if;
  end if;
  if tg_table_name='driver_assignments' then
   if tg_op='UPDATE' and new.driver_id<>old.driver_id then raise exception 'IMMUTABLE_ASSIGNMENT_SOURCE' using errcode='PT400';end if;
   select * into d from public.drivers where id=new.driver_id for update;
   if d.id is null or d.carrier_id<>new.carrier_id or d.carrier_service_id<>new.carrier_service_id then raise exception 'INVALID_CATALOG_REFERENCE' using errcode='PT400';end if;
   if new.status='CONFIRMED' then
    if not private.crew_evidence(new.evidence,new.starts_at,new.ends_at) or not private.crew_evidence(new.policy_evidence,new.starts_at,new.ends_at)
     or not private.crew_evidence(d.evidence,new.starts_at,new.ends_at) or d.duty_starts_at is null or d.maximum_duty_seconds is null
     or jsonb_array_length(new.accepted_license_classes)=0 then raise exception 'FLEET_EVIDENCE_REQUIRED' using errcode='PT409';end if;
    if d.duty_status not in ('AVAILABLE','ON_DUTY') or ((d.license_valid_until+1)::timestamp at time zone d.license_timezone)<new.ends_at
     or not(new.accepted_license_classes ? d.license_class) or not(d.qualifications @> new.required_qualifications)
     or new.starts_at<d.duty_starts_at or new.ends_at>d.duty_ends_at or not private.crew_windows_cover(d.available_windows,new.starts_at,new.ends_at)
    then raise exception 'FLEET_COMMITMENT_CONFLICT' using errcode='PT409';end if;
    select coalesce(sum(extract(epoch from upper(piece)-lower(piece))),0) into sec
    from (select range_agg(tstzrange(s,f,'[)')) occupied from (
     select greatest(starts_at,d.duty_starts_at) s,least(ends_at,d.duty_ends_at) f from public.driver_assignments
      where driver_id=new.driver_id and id<>new.id and status in ('PROPOSED','CONFIRMED')
       and tstzrange(starts_at,ends_at,'[)')&&tstzrange(d.duty_starts_at,d.duty_ends_at,'[)')
     union all select new.starts_at,new.ends_at) windows) unioned cross join lateral unnest(unioned.occupied) piece;
    if sec+d.used_duty_seconds>d.maximum_duty_seconds then raise exception 'FLEET_COMMITMENT_CONFLICT' using errcode='PT409';end if;
   end if;
  else
   if tg_op='UPDATE' and (new.transport_asset_id<>old.transport_asset_id or new.vehicle_combination_id is distinct from old.vehicle_combination_id
    or old.capacity_reservation_id is not null and new.capacity_reservation_id is distinct from old.capacity_reservation_id) then raise exception 'IMMUTABLE_ASSIGNMENT_SOURCE' using errcode='PT400';end if;
   select * into a from public.transport_assets where id=new.transport_asset_id for update;
   if a.id is null or a.carrier_id<>new.carrier_id or a.carrier_service_id<>new.carrier_service_id or a.mode<>'ROAD' then raise exception 'INVALID_CATALOG_REFERENCE' using errcode='PT400';end if;
   if a.asset_role='ESCORT' and ((new.capacity_committed->>'weightKg')::numeric>0 or (new.capacity_committed->>'volumeM3')::numeric>0) then raise exception 'VALIDATION_ERROR' using errcode='PT400';end if;
   if new.vehicle_combination_id is not null then
    select * into c from public.vehicle_combinations where id=new.vehicle_combination_id;
    if c.id is null or not exists(select 1 from public.vehicle_combination_assets where combination_id=c.id and transport_asset_id=a.id)
     or c.status<>'COUPLED' or c.starts_at>new.starts_at or c.ends_at<new.ends_at then raise exception 'INVALID_CATALOG_REFERENCE' using errcode='PT400';end if;
    -- One combined carrying assignment: cannot count tractor and trailer separately.
    if new.status in ('PROPOSED','CONFIRMED') and exists(select 1 from public.vehicle_assignments v where v.id<>new.id and v.status in ('PROPOSED','CONFIRMED')
     and (v.vehicle_combination_id=c.id or v.transport_asset_id in(select transport_asset_id from public.vehicle_combination_assets where combination_id=c.id)) and not private.workflow_same_trip(v.execution_id,new.execution_id)
     and tstzrange(v.starts_at,v.ends_at,'[)')&&tstzrange(new.starts_at,new.ends_at,'[)')) then raise exception 'FLEET_COMMITMENT_CONFLICT' using errcode='PT409';end if;
   elsif new.status in ('PROPOSED','CONFIRMED') and exists(select 1 from public.vehicle_combination_assets m where m.transport_asset_id=a.id and m.active
    and tstzrange(m.starts_at,m.ends_at,'[)')&&tstzrange(new.starts_at,new.ends_at,'[)')) then raise exception 'FLEET_COMMITMENT_CONFLICT' using errcode='PT409';end if;
   if new.status in ('PROPOSED','CONFIRMED') then
    if exists(select 1 from public.capacity_reservations rr join public.capacity_calendars cc on cc.id=rr.capacity_calendar_id where cc.transport_asset_id=a.id
     and rr.id is distinct from new.capacity_reservation_id and rr.status in ('HELD','CONFIRMED')
     and (new.capacity_reservation_id is not null or rr.execution_id is distinct from new.execution_id) and not private.workflow_same_trip(rr.execution_id,new.execution_id)
     and tstzrange(rr.starts_at,rr.ends_at,'[)')&&tstzrange(new.starts_at,new.ends_at,'[)')) then raise exception 'FLEET_COMMITMENT_CONFLICT' using errcode='PT409';end if;
    select s.service_type into service_class from public.carrier_services s where s.id=new.carrier_service_id;
    if exists(select 1 from public.vehicle_assignments v where v.transport_asset_id=a.id and v.id<>new.id and v.status in ('PROPOSED','CONFIRMED')
      and tstzrange(v.starts_at,v.ends_at,'[)')&&tstzrange(new.starts_at,new.ends_at,'[)') and (service_class='FTL' or v.execution_id<>new.execution_id and not private.workflow_same_trip(v.execution_id,new.execution_id)))
    then raise exception 'FLEET_COMMITMENT_CONFLICT' using errcode='PT409';end if;
    for point_at in select new.starts_at union select greatest(v.starts_at,new.starts_at) from public.vehicle_assignments v where v.transport_asset_id=a.id
      and v.id<>new.id and v.status in ('PROPOSED','CONFIRMED') and v.starts_at<new.ends_at and v.ends_at>new.starts_at loop
     select coalesce(sum((capacity_committed->>'weightKg')::numeric),0),coalesce(sum((capacity_committed->>'volumeM3')::numeric),0)
      into occupied_weight,occupied_volume from public.vehicle_assignments where transport_asset_id=a.id and id<>new.id and status in ('PROPOSED','CONFIRMED') and starts_at<=point_at and ends_at>point_at;
     if a.max_weight_kg is not null and occupied_weight+(new.capacity_committed->>'weightKg')::numeric>a.max_weight_kg
      or a.max_volume_m3 is not null and occupied_volume+(new.capacity_committed->>'volumeM3')::numeric>a.max_volume_m3
      or exists(select 1 from public.carrier_services s where s.id=new.carrier_service_id and (
       s.max_capacity_kg is not null and occupied_weight+(new.capacity_committed->>'weightKg')::numeric>s.max_capacity_kg
       or s.max_volume_m3 is not null and occupied_volume+(new.capacity_committed->>'volumeM3')::numeric>s.max_volume_m3)) then raise exception 'FLEET_COMMITMENT_CONFLICT' using errcode='PT409';end if;
    end loop;
    if not a.active or exists(select 1 from public.scheduled_maintenances where transport_asset_id=a.id and status in ('SCHEDULED','IN_PROGRESS') and tstzrange(starts_at,ends_at,'[)')&&tstzrange(new.starts_at,new.ends_at,'[)'))
     or exists(select 1 from public.repositioning_blocks b join public.capacity_calendars cc on cc.id=b.capacity_calendar_id where cc.transport_asset_id=a.id and b.status in ('PLANNED','IN_PROGRESS')
       and tstzrange(b.starts_at,b.ends_at,'[)')&&tstzrange(new.starts_at,new.ends_at,'[)')) then raise exception 'FLEET_COMMITMENT_CONFLICT' using errcode='PT409';end if;
   end if;
   if new.status='CONFIRMED' then
    if not private.crew_evidence(new.evidence,new.starts_at,new.ends_at) then raise exception 'FLEET_EVIDENCE_REQUIRED' using errcode='PT409';end if;
    select * into r from public.capacity_reservations where id=new.capacity_reservation_id for update;
    select * into cal from public.capacity_calendars where id=r.capacity_calendar_id;
    if r.id is null or r.status<>'CONFIRMED' or r.execution_id is distinct from new.execution_id or r.freight_request_id is distinct from e.freight_request_id
     or cal.transport_asset_id is distinct from a.id or cal.carrier_id<>new.carrier_id or cal.carrier_service_id<>new.carrier_service_id
     or r.starts_at>new.starts_at or r.ends_at<new.ends_at then raise exception 'FLEET_COMMITMENT_CONFLICT' using errcode='PT409';end if;
    if not private.crew_evidence(r.evidence,new.starts_at,new.ends_at) or r.committed_capacity is null
      or a.asset_role='CARRIER' and (a.evidence is null or new.vehicle_combination_id is null and (a.max_weight_kg is null or a.max_volume_m3 is null))
      or not cal.complete or cal.provenance_status not in ('VERIFIED','SIMULATED') or cal.observed_at is null or cal.observed_at>now() or cal.valid_until is null or cal.valid_until<new.ends_at
      or not private.crew_windows_cover(cal.available_windows,new.starts_at,new.ends_at) then raise exception 'FLEET_EVIDENCE_REQUIRED' using errcode='PT409';end if;
    select coalesce(sum((capacity_committed->>'weightKg')::numeric),0),coalesce(sum((capacity_committed->>'volumeM3')::numeric),0) into occupied_weight,occupied_volume
     from public.vehicle_assignments where capacity_reservation_id=r.id and id<>new.id and status='CONFIRMED';
    if occupied_weight+(new.capacity_committed->>'weightKg')::numeric>(r.committed_capacity->>'weightKg')::numeric
     or occupied_volume+(new.capacity_committed->>'volumeM3')::numeric>(r.committed_capacity->>'volumeM3')::numeric then raise exception 'FLEET_COMMITMENT_CONFLICT' using errcode='PT409';end if;
    if new.vehicle_combination_id is not null then
     if not private.workflow_combination_commitment(new.capacity_reservation_id,new.vehicle_combination_id,(new.capacity_committed->>'weightKg')::numeric,(new.capacity_committed->>'volumeM3')::numeric) then raise exception 'FLEET_EVIDENCE_REQUIRED' using errcode='PT409';end if;
    end if;
   end if;
  end if;
 end if;return new;end;$$;
alter function private.workflow_validate(text,jsonb) rename to workflow_validate_before_ltl_operations;
create function private.workflow_validate(a text,v jsonb) returns void language plpgsql set search_path='' as $$declare s json;begin case a
when 'consolidations.start' then s:='{"type":"object","properties":{"schemaVersion":{"type":"string","const":"2.0"},"expectedVersion":{"type":"integer","exclusiveMinimum":0},"note":{"type":"string","minLength":1,"maxLength":2000,"pattern":"\\S"},"evidence":{"type":"object","properties":{"reference":{"type":"string","minLength":1,"maxLength":500,"pattern":"\\S"},"provider":{"type":"string","minLength":1,"maxLength":150,"pattern":"\\S"},"observedAt":{"type":"string","format":"date-time"},"validUntil":{"anyOf":[{"type":"string","format":"date-time"},{"type":"null"}]},"provenanceStatus":{"type":"string","enum":["VERIFIED","ESTIMATED","SIMULATED","UNKNOWN"]}},"required":["reference","provider","observedAt","validUntil","provenanceStatus"],"additionalProperties":false}},"required":["schemaVersion","expectedVersion","note","evidence"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}'::json;
when 'consolidations.complete' then s:='{"type":"object","properties":{"schemaVersion":{"type":"string","const":"2.0"},"expectedVersion":{"type":"integer","exclusiveMinimum":0},"note":{"type":"string","minLength":1,"maxLength":2000,"pattern":"\\S"},"evidence":{"type":"object","properties":{"reference":{"type":"string","minLength":1,"maxLength":500,"pattern":"\\S"},"provider":{"type":"string","minLength":1,"maxLength":150,"pattern":"\\S"},"observedAt":{"type":"string","format":"date-time"},"validUntil":{"anyOf":[{"type":"string","format":"date-time"},{"type":"null"}]},"provenanceStatus":{"type":"string","enum":["VERIFIED","ESTIMATED","SIMULATED","UNKNOWN"]}},"required":["reference","provider","observedAt","validUntil","provenanceStatus"],"additionalProperties":false}},"required":["schemaVersion","expectedVersion","note","evidence"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}'::json;
when 'consolidations.cancel' then s:='{"type":"object","properties":{"schemaVersion":{"type":"string","const":"2.0"},"expectedVersion":{"type":"integer","exclusiveMinimum":0},"note":{"type":"string","minLength":1,"maxLength":2000,"pattern":"\\S"},"evidence":{"type":"object","properties":{"reference":{"type":"string","minLength":1,"maxLength":500,"pattern":"\\S"},"provider":{"type":"string","minLength":1,"maxLength":150,"pattern":"\\S"},"observedAt":{"type":"string","format":"date-time"},"validUntil":{"anyOf":[{"type":"string","format":"date-time"},{"type":"null"}]},"provenanceStatus":{"type":"string","enum":["VERIFIED","ESTIMATED","SIMULATED","UNKNOWN"]}},"required":["reference","provider","observedAt","validUntil","provenanceStatus"],"additionalProperties":false}},"required":["schemaVersion","expectedVersion","note","evidence"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}'::json;
when 'consolidations.position' then s:='{"type":"object","properties":{"schemaVersion":{"type":"string","const":"2.0"},"expectedVersion":{"type":"integer","exclusiveMinimum":0},"note":{"type":"string","minLength":1,"maxLength":2000,"pattern":"\\S"},"evidence":{"type":"object","properties":{"reference":{"type":"string","minLength":1,"maxLength":500,"pattern":"\\S"},"provider":{"type":"string","minLength":1,"maxLength":150,"pattern":"\\S"},"observedAt":{"type":"string","format":"date-time"},"validUntil":{"anyOf":[{"type":"string","format":"date-time"},{"type":"null"}]},"provenanceStatus":{"type":"string","enum":["VERIFIED","ESTIMATED","SIMULATED","UNKNOWN"]}},"required":["reference","provider","observedAt","validUntil","provenanceStatus"],"additionalProperties":false},"location":{"type":"object","properties":{"label":{"type":"string","minLength":1,"pattern":"\\S"},"countryCode":{"type":"string","pattern":"^[A-Z]{2}$"},"region":{"type":["string","null"]},"city":{"type":"string","minLength":1,"pattern":"\\S"},"lat":{"anyOf":[{"type":"number","minimum":-90,"maximum":90},{"type":"null"}]},"lng":{"anyOf":[{"type":"number","minimum":-180,"maximum":180},{"type":"null"}]}},"required":["label","countryCode","region","city","lat","lng"],"additionalProperties":false},"observedAt":{"type":"string","format":"date-time"},"correlationId":{"type":"string","minLength":1,"maxLength":2000,"pattern":"\\S"}},"required":["schemaVersion","expectedVersion","note","evidence","location","observedAt","correlationId"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}'::json;
else perform private.workflow_validate_before_ltl_operations(a,v);return;end case;
 if not coalesce(extensions.jsonb_matches_schema(s,v),false) then raise exception 'VALIDATION_ERROR' using errcode='PT400';end if;end;$$;
alter function private.command_v2_workflow(uuid,uuid,text,jsonb,uuid,jsonb) rename to command_v2_workflow_before_ltl_operations;
create function private.command_v2_workflow(p_organization_id uuid,p_member_id uuid,p_action text,p_context jsonb,p_key uuid,p_value jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c uuid:=(p_context->>'carrierId')::uuid;i uuid:=(p_context->>'id')::uuid;
 cc public.capacity_consolidations;e public.transport_executions;receipt private.v2_workflow_receipts;
 h text;result jsonb;members uuid[];affected uuid[];old_events uuid[];event_id uuid:=gen_random_uuid();
 child_action text;child_value jsonb;signature jsonb;next_signature jsonb;first_member boolean:=true;
begin
 if p_action not in ('consolidations.start','consolidations.complete','consolidations.cancel','consolidations.position')
  and not (p_action='consolidations.close' and exists(select 1 from public.capacity_consolidations where id=i and status in ('COMPLETED','CANCELLED'))) then
  -- Individual cancellation withdraws one booking, retaining the other tenants in transit.
  perform private.workflow_member(p_organization_id,p_member_id,false);
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
 perform private.workflow_member(p_organization_id,p_member_id,false);
 if p_key is null or jsonb_typeof(p_context)<>'object' or (p_context-'carrierId'-'id'-'requestId'-'parentId')<>'{}'::jsonb or p_context->>'requestId' is not null or p_context->>'parentId' is not null or c is null or i is null then raise exception 'VALIDATION_ERROR' using errcode='PT400';end if;
 perform private.workflow_validate(p_action,p_value);perform private.workflow_validate_periods(p_value);
 perform 1 from public.carrier_services order by id for update;
 perform private.workflow_carrier(c);perform private.workflow_scope(p_organization_id,c,'consolidations',i);
 select * into cc from public.capacity_consolidations where id=i for update;
 h:=private.hash_v2_freight_payload(jsonb_build_object('action',p_action,'context',p_context,'value',p_value));
 perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text||':'||p_member_id::text||':'||p_key::text,0));
 select * into receipt from private.v2_workflow_receipts where organization_id=p_organization_id and member_id=p_member_id and idempotency_key=p_key;
 if found then if receipt.payload_hash<>h then raise exception 'IDEMPOTENCY_CONFLICT' using errcode='PT409';end if;return jsonb_build_object('record',receipt.result,'replay',true);end if;
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
 insert into private.v2_workflow_receipts(organization_id,member_id,idempotency_key,payload_hash,result) values(p_organization_id,p_member_id,p_key,h,result);
 return jsonb_build_object('record',result,'replay',false);
end;$$;
create or replace function public.command_v2_workflow(p_organization_id uuid,p_member_id uuid,p_action text,p_context jsonb,p_key uuid,p_value jsonb) returns jsonb language sql security definer set search_path='' as $$select private.command_v2_workflow(p_organization_id,p_member_id,p_action,p_context,p_key,p_value);$$;
revoke all on function private.workflow_same_trip(uuid,uuid) from public,anon,authenticated,service_role;
revoke all on function private.guard_v2_driver_occupancy() from public,anon,authenticated,service_role;
revoke all on function private.workflow_trip_compatible(uuid,uuid,uuid,uuid,timestamptz,timestamptz) from public,anon,authenticated,service_role;
revoke all on function private.workflow_record(text,uuid) from public,anon,authenticated,service_role;
revoke all on function private.guard_v2_crew() from public,anon,authenticated,service_role;
revoke all on function private.workflow_validate(text,jsonb) from public,anon,authenticated,service_role;
revoke all on function private.command_v2_workflow(uuid,uuid,text,jsonb,uuid,jsonb) from public,anon,authenticated,service_role;

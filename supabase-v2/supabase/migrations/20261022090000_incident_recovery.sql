-- Recovery is a linked request, never a rewrite of the failed contract or its price.
begin;
create table public.incident_recoveries (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id),
 incident_id uuid not null unique references public.operational_incidents(id),
 original_request_id uuid not null references public.freight_requests(id),
 original_booking_id uuid not null references public.v2_bookings(id),
 original_execution_id uuid not null references public.transport_executions(id),
 failed_carrier_id uuid not null references public.carriers(id),
 replacement_request_id uuid not null unique references public.freight_requests(id),
 replacement_booking_id uuid unique references public.v2_bookings(id),
 status text not null default 'SEARCHING' check(status in ('SEARCHING','REPLACED')),
 cause text not null check(cause in ('CARRIER_ACCIDENT','CARRIER_NONCOMPLIANCE')),
 urgency_surcharge numeric not null default 0 check(urgency_surcharge=0),
 created_by uuid not null references public.organization_members(id),
 consent jsonb not null check(consent->>'code'='AUTHORIZE_RECOVERY_SEARCH'),
 version integer not null default 1 check(version>0),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check(original_request_id<>replacement_request_id),
 check((status='REPLACED')=(replacement_booking_id is not null))
);
create table public.incident_recovery_reservations (
 recovery_id uuid not null references public.incident_recoveries(id),
 reservation_id uuid not null unique references public.capacity_reservations(id),
 -- Quantities retain original unit indices; no inferred pallet dimensions or broken indivisible units.
 allocations jsonb not null check(jsonb_typeof(allocations)='array' and jsonb_array_length(allocations)>0),
 primary key(recovery_id,reservation_id)
);
create index incident_recovery_org_idx on public.incident_recoveries(organization_id,created_at,id);
create index incident_recovery_carrier_idx on public.incident_recoveries(failed_carrier_id,created_at,id);
create index incident_recovery_request_idx on public.incident_recoveries(original_request_id);
create index incident_recovery_booking_idx on public.incident_recoveries(original_booking_id);
create index incident_recovery_member_idx on public.incident_recoveries(created_by);
create index incident_recovery_execution_idx on public.incident_recoveries(original_execution_id);
create table private.incident_recovery_receipts (
 organization_id uuid not null references public.organizations(id),member_id uuid not null references public.organization_members(id),
 key uuid not null,payload_hash text not null check(payload_hash~'^[0-9a-f]{64}$'),result jsonb not null,
 primary key(organization_id,member_id,key)
);
alter table public.incident_recoveries enable row level security;
alter table public.incident_recovery_reservations enable row level security;
alter table private.incident_recovery_receipts enable row level security;
revoke all on public.incident_recoveries,public.incident_recovery_reservations,private.incident_recovery_receipts from public,anon,authenticated,service_role;
-- Reads and writes go through identity-scoped RPCs, as with native workflow records.

create function private.recovery_record(i uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',r.id,'incidentId',r.incident_id,'originalRequestId',r.original_request_id,
 'originalBookingId',r.original_booking_id,'originalExecutionId',r.original_execution_id,'failedCarrierId',r.failed_carrier_id,
 'replacementRequestId',r.replacement_request_id,'replacementBookingId',r.replacement_booking_id,'status',r.status,
 'cause',r.cause,'phase',case when r.status='REPLACED' then 'REPLACED' when exists(select 1 from public.v2_bookings b where b.freight_request_id=r.replacement_request_id and b.status='AUTHORIZED') then 'AWAITING_CARRIER' when exists(select 1 from public.v2_carrier_offers f where f.freight_request_id=r.replacement_request_id and f.status='RECEIVED' and (f.data#>>'{validity,endsAt}')::timestamptz>now()) then 'AWAITING_CLIENT' else 'NEEDS_ATTENTION' end,'priority','URGENT','urgencySurcharge',0,'version',r.version,'createdAt',r.created_at,'updatedAt',r.updated_at,
 'reservationIds',(select jsonb_agg(reservation_id order by reservation_id) from public.incident_recovery_reservations where recovery_id=r.id))
 from public.incident_recoveries r where r.id=i;
$$;

create function public.read_v2_incident_recovery(p_organization_id uuid,p_member_id uuid,p_request_id uuid)
 returns jsonb language plpgsql security definer set search_path='' as $$
declare q public.freight_requests;inc jsonb;cases jsonb;begin
 perform private.workflow_member(p_organization_id,p_member_id,false);
 select * into q from public.freight_requests where id=p_request_id and organization_id=p_organization_id and v2_contract_version='2.0';
 if q.id is null then raise exception 'REQUEST_NOT_FOUND' using errcode='PT404';end if;
 select coalesce(jsonb_agg(private.recovery_record(id) order by created_at),'[]') into cases from public.incident_recoveries
 where organization_id=p_organization_id and (original_request_id=q.id or replacement_request_id=q.id);
 select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'version',i.version,'status',i.status,'kind',i.data->>'kind',
 'description',i.data->>'description','executionId',e.id,'executionStatus',e.status,
 'reservations',(select coalesce(jsonb_agg(jsonb_build_object('id',rr.id,'weightKg',rr.committed_capacity->'weightKg','volumeM3',rr.committed_capacity->'volumeM3',
 'allocations',(select jsonb_agg(jsonb_build_object('unitIndex',a.unit_index,'quantity',a.quantity)) from public.load_allocations a where a.assignment_id=rr.plan_assignment_id))), '[]')
 from public.capacity_reservations rr where rr.execution_id=e.id and rr.status='CONFIRMED' and rr.parent_reservation_id is null
 and not exists(select 1 from public.incident_recovery_reservations used where used.reservation_id=rr.id))) order by i.created_at),'[]') into inc
 from public.operational_incidents i join public.transport_executions e on e.id=i.parent_id
 where i.freight_request_id=q.id and i.organization_id=p_organization_id and i.status='OPEN' and e.status in ('PLANNED','IN_PROGRESS')
 and not exists(select 1 from public.incident_recoveries r where r.incident_id=i.id);
 return jsonb_build_object('cases',cases,'incidents',inc);
end;$$;

create function public.create_v2_incident_recovery(p_organization_id uuid,p_member_id uuid,p_incident_id uuid,p_key uuid,p_value jsonb)
 returns jsonb language plpgsql security definer set search_path='' as $$
declare i public.operational_incidents;e public.transport_executions;q public.freight_requests;b public.v2_bookings;
 receipt private.incident_recovery_receipts;h text;rid uuid;child uuid;payload jsonb;created jsonb;rr public.capacity_reservations;
 alloc jsonb;units jsonb;cargo jsonb;unit jsonb;item jsonb;total_weight numeric:=0;total_volume numeric:=0;result jsonb;begin
 perform private.workflow_member(p_organization_id,p_member_id,true);
 if p_key is null or p_incident_id is null or not coalesce(extensions.jsonb_matches_schema($schema${"type":"object","additionalProperties":false,"required":["schemaVersion","expectedIncidentVersion","cause","reservationIds","origin","pickupWindow","deliveryWindow","timeZone","consent"],"properties":{"schemaVersion":{"const":"2.0"},"expectedIncidentVersion":{"type":"integer","minimum":1},"cause":{"enum":["CARRIER_ACCIDENT","CARRIER_NONCOMPLIANCE"]},"reservationIds":{"type":"array","items":{"type":"string","format":"uuid"},"minItems":1,"maxItems":100,"uniqueItems":true},"origin":{"type":"object","additionalProperties":false,"properties":{"facilityId":{"type":["string","null"],"format":"uuid"},"label":{"type":"string","minLength":1,"maxLength":200},"countryCode":{"type":"string","pattern":"^[A-Z]{2}$"},"city":{"type":"string","minLength":1,"maxLength":120},"region":{"type":["string","null"],"maxLength":120},"lat":{"type":["number","null"],"minimum":-90,"maximum":90},"lng":{"type":["number","null"],"minimum":-180,"maximum":180}}},"pickupWindow":{"type":"object","additionalProperties":false,"required":["startsAt","endsAt"],"properties":{"startsAt":{"type":"string","format":"date-time"},"endsAt":{"type":"string","format":"date-time"}}},"deliveryWindow":{"type":"object","additionalProperties":false,"required":["startsAt","endsAt"],"properties":{"startsAt":{"type":"string","format":"date-time"},"endsAt":{"type":"string","format":"date-time"}}},"timeZone":{"type":"string","minLength":1,"maxLength":100},"remainingAllocations":{"type":"array","items":{"type":"object","additionalProperties":false,"required":["unitIndex","quantity"],"properties":{"unitIndex":{"type":"integer","minimum":0},"quantity":{"type":"integer","minimum":1}}},"minItems":1,"maxItems":100},"confirmRemainingCargo":{"type":"boolean"},"consent":{"const":"AUTHORIZE_RECOVERY_SEARCH"}}}$schema$::json,p_value),false) or p_value->>'consent' is distinct from 'AUTHORIZE_RECOVERY_SEARCH'
 or p_value->>'cause' not in ('CARRIER_ACCIDENT','CARRIER_NONCOMPLIANCE')
 or jsonb_typeof(p_value->'reservationIds') is distinct from 'array' or jsonb_array_length(p_value->'reservationIds') not between 1 and 100
 or (select count(distinct value) from jsonb_array_elements_text(p_value->'reservationIds'))<>jsonb_array_length(p_value->'reservationIds')
 then raise exception 'VALIDATION_ERROR' using errcode='PT400';end if;
 if not exists(select 1 from pg_timezone_names where name=p_value->>'timeZone') then raise exception 'VALIDATION_ERROR' using errcode='PT400';end if;
 h:=private.hash_v2_freight_payload(jsonb_build_object('incidentId',p_incident_id,'value',p_value));
 perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text||':'||p_member_id::text||':'||p_key::text,22));
 select * into receipt from private.incident_recovery_receipts where organization_id=p_organization_id and member_id=p_member_id and key=p_key;
 if found then if receipt.payload_hash<>h then raise exception 'IDEMPOTENCY_CONFLICT' using errcode='PT409';end if;return receipt.result;end if;
 select * into i from public.operational_incidents where id=p_incident_id and organization_id=p_organization_id for update;
 if i.id is null then raise exception 'INCIDENT_NOT_FOUND' using errcode='PT404';end if;
 if i.version is distinct from (p_value->>'expectedIncidentVersion')::integer then raise exception 'STALE_DRAFT' using errcode='PT409';end if;
 select * into e from public.transport_executions where id=i.parent_id for update;
 select * into b from public.v2_bookings where id=e.booking_id;
 select * into q from public.freight_requests where id=i.freight_request_id;
 if i.status<>'OPEN' or e.status not in ('PLANNED','IN_PROGRESS') or b.status<>'CONFIRMED'
 or exists(select 1 from public.incident_recoveries where incident_id=i.id)
 then raise exception 'RECOVERY_NOT_ALLOWED' using errcode='PT409';end if;
 -- Lock all resources in stable order. A reservation cannot be recovered twice, even through another incident.
 for rr in select * from public.capacity_reservations where id in(select value::uuid from jsonb_array_elements_text(p_value->'reservationIds')) order by id for update loop
  if rr.execution_id is distinct from e.id or rr.status<>'CONFIRMED' or rr.parent_reservation_id is not null
   or exists(select 1 from public.incident_recovery_reservations where reservation_id=rr.id)
  then raise exception 'INVALID_RECOVERY_RESERVATION' using errcode='PT409';end if;
 end loop;
 if (select count(*) from public.capacity_reservations where id in(select value::uuid from jsonb_array_elements_text(p_value->'reservationIds')))<>jsonb_array_length(p_value->'reservationIds')
 then raise exception 'INVALID_RECOVERY_RESERVATION' using errcode='PT400';end if;
 -- Multi-leg recovery needs an evidenced remaining itinerary. Never count the same cargo on consecutive legs twice.
 if (select count(distinct a.route_leg_id) from public.capacity_reservations r join public.plan_resource_bindings a on a.id=r.plan_assignment_id where r.id in(select value::uuid from jsonb_array_elements_text(p_value->'reservationIds')))<>1
 then raise exception 'RECOVERY_ITINERARY_REVIEW_REQUIRED' using errcode='PT409';end if;
 select jsonb_agg(jsonb_build_object('unitIndex',unit_index,'quantity',qty) order by unit_index) into alloc from (
 select a.unit_index,sum(a.quantity)::integer qty from public.load_allocations a join public.capacity_reservations r on r.plan_assignment_id=a.assignment_id
 where r.id in(select value::uuid from jsonb_array_elements_text(p_value->'reservationIds')) group by a.unit_index) x;
 if alloc is null then raise exception 'RECOVERY_CARGO_REVIEW_REQUIRED' using errcode='PT409';end if;
 -- For a running trip, the Client explicitly declares remaining whole packages and their pickup location.
 if e.status='IN_PROGRESS' then
  if p_value->>'confirmRemainingCargo' is distinct from 'true' or jsonb_typeof(p_value->'remainingAllocations') is distinct from 'array'
   or jsonb_array_length(p_value->'remainingAllocations') not between 1 and 100
   or (select count(distinct x->>'unitIndex') from jsonb_array_elements(p_value->'remainingAllocations') x)<>jsonb_array_length(p_value->'remainingAllocations')
   then raise exception 'REMAINING_CARGO_CONFIRMATION_REQUIRED' using errcode='PT400';end if;
  for item in select x from jsonb_array_elements(p_value->'remainingAllocations') x loop
   if (item->>'quantity')::integer<=0 or not exists(select 1 from jsonb_array_elements(alloc) a where a->>'unitIndex'=item->>'unitIndex' and (item->>'quantity')::integer<=(a->>'quantity')::integer)
   then raise exception 'INVALID_RECOVERY_CARGO' using errcode='PT400';end if;
  end loop;
  alloc:=p_value->'remainingAllocations';
 end if;
 units:='[]';
 for item in select x from jsonb_array_elements(alloc) x loop
  unit:=q.v2_snapshot#>'{cargoSpecification,units}'->(item->>'unitIndex')::integer;
  if unit is null or (item->>'quantity')::integer>(unit->>'quantity')::integer then raise exception 'INVALID_RECOVERY_CARGO' using errcode='PT400';end if;
  units:=units||jsonb_build_array(unit||jsonb_build_object('quantity',(item->>'quantity')::integer));
  total_weight:=total_weight+(unit->>'weightPerUnitKg')::numeric*(item->>'quantity')::integer;
  total_volume:=total_volume+(unit->>'volumePerUnitM3')::numeric*(item->>'quantity')::integer;
 end loop;
 cargo:=q.v2_snapshot->'cargoSpecification'||jsonb_build_object('units',units,'totalWeightKg',total_weight,'totalVolumeM3',total_volume);
 payload:=(q.v2_creation_payload-'organizationId'-'budget')||jsonb_build_object('origin',p_value->'origin','pickupWindow',p_value->'pickupWindow',
 'deliveryWindow',p_value->'deliveryWindow','cargoSpecification',cargo,'selectionObjective','FASTEST','planningPreferences',jsonb_build_object(
 'urgency','URGENT','loadSize',null,'timeZone',p_value->>'timeZone','pickupWindows',jsonb_build_array(p_value->'pickupWindow'),'deliveryWindows',jsonb_build_array(p_value->'deliveryWindow')));
 if (p_value#>>'{pickupWindow,startsAt}')::timestamptz<=now() then raise exception 'RECOVERY_PICKUP_EXPIRED' using errcode='PT400';end if;
 created:=public.create_v2_freight_request(p_organization_id,p_member_id,gen_random_uuid(),private.hash_v2_freight_payload(payload),payload);
 child:=(created->>'id')::uuid;
 perform public.command_v2_freight_request(p_organization_id,p_member_id,gen_random_uuid(),child,1,'SUBMIT',null);
 insert into public.incident_recoveries(organization_id,incident_id,original_request_id,original_booking_id,original_execution_id,failed_carrier_id,replacement_request_id,cause,created_by,consent)
 values(p_organization_id,i.id,q.id,b.id,e.id,e.carrier_id,child,p_value->>'cause',p_member_id,jsonb_build_object('code','AUTHORIZE_RECOVERY_SEARCH','at',now(),'memberId',p_member_id,'remainingCargoConfirmed',e.status='IN_PROGRESS','allocations',alloc)) returning id into rid;
 insert into public.incident_recovery_reservations(recovery_id,reservation_id,allocations)
 select rid,r.id,(select jsonb_agg(jsonb_build_object('unitIndex',a.unit_index,'quantity',a.quantity)) from public.load_allocations a where a.assignment_id=r.plan_assignment_id)
 from public.capacity_reservations r where r.id in(select value::uuid from jsonb_array_elements_text(p_value->'reservationIds'));
 result:=private.recovery_record(rid);
 insert into private.incident_recovery_receipts values(p_organization_id,p_member_id,p_key,h,result);
 return result;
end;$$;

-- This context is also used by the application BEFORE discovery/ranking, so the failed Carrier
-- is excluded from the universe, not silently removed after it was ranked first.
create function public.read_v2_recovery_quote_context(p_organization_id uuid,p_member_id uuid,p_request_id uuid)
 returns jsonb language plpgsql security definer set search_path='' as $$declare r public.incident_recoveries;begin
 perform private.workflow_member(p_organization_id,p_member_id,false);
 select * into r from public.incident_recoveries where organization_id=p_organization_id and replacement_request_id=p_request_id;
 if r.id is null then return null;end if;
 return jsonb_build_object('recoveryId',r.id,'failedCarrierId',r.failed_carrier_id,'priority','URGENT','urgencySurcharge',0);
end;$$;

create function private.guard_recovery_offer() returns trigger language plpgsql security definer set search_path='' as $$
declare r public.incident_recoveries;ctx private.quote_issue_context;begin
 select * into r from public.incident_recoveries where replacement_request_id=new.freight_request_id;
 if r.id is null then return new;end if;
 if tg_op='UPDATE' then
  if new.data->'price' is distinct from old.data->'price' or new.data->'breakdown' is distinct from old.data->'breakdown'
   or new.data->'commercialTerms' is distinct from old.data->'commercialTerms' then raise exception 'IMMUTABLE_RECOVERY_PRICE' using errcode='PT409';end if;
  return new;
 end if;
 select * into ctx from private.quote_issue_context where backend_pid=pg_backend_pid() and transaction_id=txid_current() and user_id=auth.uid() and offer_id=new.id;
 if r.status<>'SEARCHING' or new.carrier_id=r.failed_carrier_id or ctx.offer_id is null or (private.active_quote_delegation(new.carrier_id)).id is null
 then raise exception 'RECOVERY_APPROVED_AUTOMATION_REQUIRED' using errcode='PT409';end if;
 new.data:=new.data||jsonb_build_object('breakdown',new.data->'breakdown'||jsonb_build_array(jsonb_build_object('kind','OTHER','amount',jsonb_build_object('amount',0,'currency','USD'),'treatment','INCLUDED','source',new.data#>'{source,evidence}','observedAt',new.data->'issuedAt','details','Incident recovery urgency/immediate-order surcharge: USD 0.')),'commercialTerms',coalesce(new.data->'commercialTerms','[]')||jsonb_build_array(jsonb_build_object(
 'code','INCIDENT_RECOVERY_NO_URGENCY_SURCHARGE','description','Priority recovery. Urgency and immediate-order surcharge: USD 0. Normal replacement tariff requires Client authorization.')));
 return new;
end;$$;
create trigger recovery_offer_guard before insert or update on public.v2_carrier_offers for each row execute function private.guard_recovery_offer();

-- Replacement confirmation and release are one transaction. No driver/truck pairing is inferred.
create function private.confirm_incident_replacement() returns trigger language plpgsql security definer set search_path='' as $$
declare r public.incident_recoveries;e public.transport_executions;ev jsonb;full_release boolean;begin
 if new.status<>'CONFIRMED' or old.status='CONFIRMED' then return new;end if;
 select * into r from public.incident_recoveries where replacement_request_id=new.freight_request_id for update;
 if r.id is null then return new;end if;
 if r.status<>'SEARCHING' or new.carrier_id=r.failed_carrier_id then raise exception 'RECOVERY_ALREADY_REPLACED' using errcode='PT409';end if;
 select * into e from public.transport_executions where id=r.original_execution_id for update;
 if e.status not in ('PLANNED','IN_PROGRESS') or not exists(select 1 from public.v2_bookings where id=r.original_booking_id and status='CONFIRMED')
 or exists(select 1 from public.incident_recovery_reservations x join public.capacity_reservations rr on rr.id=x.reservation_id where x.recovery_id=r.id and rr.status<>'CONFIRMED')
 then raise exception 'RECOVERY_ORIGINAL_STATE_CHANGED' using errcode='PT409';end if;
 if exists(select 1 from public.capacity_reservations rr where rr.booking_id=new.id and rr.status<>'CONFIRMED')
 or not exists(select 1 from public.capacity_reservations rr where rr.booking_id=new.id and rr.status='CONFIRMED')
 then raise exception 'CAPACITY_COMMITMENT_REQUIRED' using errcode='PT409';end if;
 update public.vehicle_assignments set status='RELEASED',version=version+1,updated_at=now()
 where capacity_reservation_id in(select reservation_id from public.incident_recovery_reservations where recovery_id=r.id) and status in ('PROPOSED','CONFIRMED');
 update public.capacity_reservations set status='RELEASED',version=version+1,updated_at=now()
 where id in(select reservation_id from public.incident_recovery_reservations where recovery_id=r.id)
 or parent_reservation_id in(select reservation_id from public.incident_recovery_reservations where recovery_id=r.id);
 full_release:=not exists(select 1 from public.capacity_reservations where execution_id=e.id and status in ('HELD','CONFIRMED'));
 if full_release then
  perform private.workflow_release_execution(e.id);
  update public.transport_executions set status='CANCELLED',version=version+1,updated_at=now() where id=e.id;
  if not exists(select 1 from public.transport_executions where booking_id=r.original_booking_id and status in ('PLANNED','IN_PROGRESS')) then
   update public.v2_bookings set status='CANCELLED',version=version+1,updated_at=now(),data=data||jsonb_build_object('authorizationStatus','REVOKED','carrierConfirmationStatus','CANCELLED','cancelledAt',now(),'cancellation',jsonb_build_object('note','Replaced after Carrier incident','recoveryId',r.id)) where id=r.original_booking_id;
  end if;
 end if;
 update public.incident_recoveries set status='REPLACED',replacement_booking_id=new.id,version=version+1,updated_at=now() where id=r.id;
 ev:=jsonb_build_object('schemaVersion','2.0','expectedVersion',(select version from public.operational_incidents where id=r.incident_id),
 'action','RESOLVE','recoveryId',r.id,'replacementBookingId',new.id,'at',now(),'actorId',r.created_by,'source','RECOVERY_SERVICE',
 'note','Replacement booking confirmed; affected commitments released.','evidence',new.data->'confirmationEvidence');
 insert into public.incident_updates(organization_id,carrier_id,freight_request_id,parent_id,status,data) values(r.organization_id,r.failed_carrier_id,r.original_request_id,r.incident_id,'RECORDED',ev);
 update public.operational_incidents set status='RESOLVED',version=version+1,updated_at=now(),data=data||jsonb_build_object('status','RESOLVED','recoveryId',r.id) where id=r.incident_id;
 return new;
end;$$;
create trigger incident_replacement_confirmed after update on public.v2_bookings for each row execute function private.confirm_incident_replacement();

-- An open recovery must not be manually labelled resolved while still awaiting a replacement.
create function private.guard_recovering_incident() returns trigger language plpgsql security definer set search_path='' as $$begin
 if new.status='RESOLVED' and old.status<>'RESOLVED' and exists(select 1 from public.incident_recoveries where incident_id=old.id and status='SEARCHING' and replacement_booking_id is null)
 then raise exception 'RECOVERY_REPLACEMENT_REQUIRED' using errcode='PT409';end if;return new;
end;$$;
create trigger recovering_incident_guard before update on public.operational_incidents for each row execute function private.guard_recovering_incident();

revoke all on function private.recovery_record(uuid),private.guard_recovery_offer(),private.confirm_incident_replacement(),private.guard_recovering_incident() from public,anon,authenticated,service_role;
revoke all on function public.read_v2_incident_recovery(uuid,uuid,uuid),public.create_v2_incident_recovery(uuid,uuid,uuid,uuid,jsonb),public.read_v2_recovery_quote_context(uuid,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.read_v2_incident_recovery(uuid,uuid,uuid),public.create_v2_incident_recovery(uuid,uuid,uuid,uuid,jsonb),public.read_v2_recovery_quote_context(uuid,uuid,uuid) to authenticated;

-- Accidents do not repair assets. New quotes require a fresh, complete availability
-- assertion after the incident; releasing a booking never restores physical readiness.
create function public.read_v2_recovery_blocked_calendars(p_organization_id uuid,p_member_id uuid)
 returns jsonb language plpgsql security definer set search_path='' as $$declare result jsonb;begin
 perform private.workflow_member(p_organization_id,p_member_id,false);
 select coalesce(jsonb_agg(distinct cal.id),'[]') into result from public.incident_recoveries r
 join public.operational_incidents i on i.id=r.incident_id
 join public.incident_recovery_reservations x on x.recovery_id=r.id
 join public.capacity_reservations rr on rr.id=x.reservation_id
 join public.capacity_calendars cal on cal.id=rr.capacity_calendar_id
 where r.cause='CARRIER_ACCIDENT' and (not cal.complete or cal.provenance_status not in ('VERIFIED','SIMULATED') or cal.observed_at is null or cal.observed_at<=(i.data->>'occurredAt')::timestamptz);
 return result;
end;$$;
alter function public.request_v2_carrier_quote(uuid,uuid,uuid,integer,uuid,timestamptz,jsonb) rename to request_v2_carrier_quote_before_incident_recovery;
alter function public.request_v2_carrier_quote_before_incident_recovery(uuid,uuid,uuid,integer,uuid,timestamptz,jsonb) set schema private;
revoke all on function private.request_v2_carrier_quote_before_incident_recovery(uuid,uuid,uuid,integer,uuid,timestamptz,jsonb) from public,anon,authenticated,service_role;
create function public.request_v2_carrier_quote(p_organization_id uuid,p_member_id uuid,p_request_id uuid,p_expected_version integer,p_key uuid,p_deadline timestamptz,p_candidate jsonb)
 returns jsonb language plpgsql security definer set search_path='' as $$declare failed uuid;blocked jsonb;begin
 perform private.workflow_member(p_organization_id,p_member_id,true);
 select failed_carrier_id into failed from public.incident_recoveries where organization_id=p_organization_id and replacement_request_id=p_request_id;
 if failed is not null and exists(select 1 from public.carrier_services where id=(p_candidate->>'serviceId')::uuid and carrier_id=failed)
 then raise exception 'RECOVERY_FAILED_CARRIER_EXCLUDED' using errcode='PT409';end if;
 blocked:=public.read_v2_recovery_blocked_calendars(p_organization_id,p_member_id);
 if blocked ? (p_candidate->>'calendarId') or exists(select 1 from jsonb_array_elements(coalesce(p_candidate->'resources','[]')) x where blocked ? (x->>'calendarId'))
 then raise exception 'INCIDENT_AVAILABILITY_REVALIDATION_REQUIRED' using errcode='PT409';end if;
 return private.request_v2_carrier_quote_before_incident_recovery(p_organization_id,p_member_id,p_request_id,p_expected_version,p_key,p_deadline,p_candidate);
end;$$;

create function private.guard_recovery_execution() returns trigger language plpgsql security definer set search_path='' as $$begin
 if new.status in ('IN_PROGRESS','COMPLETED') and new.status<>old.status
 and exists(select 1 from public.incident_recoveries where original_execution_id=old.id and status='SEARCHING')
 then raise exception 'RECOVERY_PENDING' using errcode='PT409';end if;return new;
end;$$;
create trigger recovery_execution_guard before update on public.transport_executions for each row execute function private.guard_recovery_execution();

-- The native start command must count only the retained resources after partial recovery.
-- Keep every original authorization, evidence, temporal and current-plan check intact.
-- Fail migration if its precise target changes, rather than rewriting an unrelated function.
do $adjust$
declare src text;segment text;changed text;needle text:='and rr.asset_id is not null';first_at integer;last_at integer;begin
 src:=pg_get_functiondef('private.command_v2_workflow_before_ltl_operations(uuid,uuid,text,jsonb,uuid,jsonb)'::regprocedure);
 first_at:=strpos(src,'elsif k=''executions'' then');
 last_at:=strpos(src,'elsif p_action in (''executions.complete'',''executions.cancel'') then');
 if first_at=0 or last_at<=first_at then raise exception 'RECOVERY_NATIVE_START_TARGET_CHANGED';end if;
 segment:=substr(src,first_at,last_at-first_at);
 if (length(segment)-length(replace(segment,needle,'')))/length(needle)<>2 then raise exception 'RECOVERY_NATIVE_START_TARGET_CHANGED';end if;
 changed:=replace(segment,needle,needle||' and not exists(select 1 from public.incident_recovery_reservations recovered join public.incident_recoveries recovery on recovery.id=recovered.recovery_id join public.capacity_reservations released on released.id=recovered.reservation_id where recovery.status=''REPLACED'' and recovery.original_execution_id=e.id and released.plan_resource_id=rr.id)');
 execute substr(src,1,first_at-1)||changed||substr(src,last_at);
end;$adjust$;
revoke all on function public.read_v2_recovery_blocked_calendars(uuid,uuid),public.request_v2_carrier_quote(uuid,uuid,uuid,integer,uuid,timestamptz,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.read_v2_recovery_blocked_calendars(uuid,uuid),public.request_v2_carrier_quote(uuid,uuid,uuid,integer,uuid,timestamptz,jsonb) to authenticated;
revoke all on function private.guard_recovery_execution() from public,anon,authenticated,service_role;
commit;

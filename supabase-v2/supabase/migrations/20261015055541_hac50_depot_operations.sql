-- HAC-50. Carrier-owned depot rules and serialized occupancy. No synthetic data.
begin;
create function private.valid_depot_hours(v jsonb) returns boolean language plpgsql stable set search_path='' as $$declare h jsonb;previous_day integer;previous_close text;begin
 if v='null'::jsonb then return true;end if;
 if not coalesce(extensions.jsonb_matches_schema('{"type":"object","additionalProperties":false,"required":["timezone","weekly"],"properties":{"timezone":{"type":"string"},"weekly":{"type":"array","maxItems":28,"items":{"type":"object","additionalProperties":false,"required":["dayOfWeek","opensAt","closesAt"],"properties":{"dayOfWeek":{"type":"integer","minimum":1,"maximum":7},"opensAt":{"type":"string","pattern":"^([01][0-9]|2[0-3]):[0-5][0-9]$"},"closesAt":{"type":"string","pattern":"^(([01][0-9]|2[0-3]):[0-5][0-9]|24:00)$"}}}}}}'::json,v),false) or not exists(select 1 from pg_catalog.pg_timezone_names where name=v->>'timezone') then return false;end if;
 for h in select value from jsonb_array_elements(v->'weekly') order by (value->>'dayOfWeek')::integer,value->>'opensAt' loop
  if h->>'opensAt'>=h->>'closesAt' or previous_day=(h->>'dayOfWeek')::integer and h->>'opensAt'<previous_close then return false;end if;
  previous_day:=(h->>'dayOfWeek')::integer;previous_close:=h->>'closesAt';
 end loop;return true;end;$$;
create function private.valid_depot_policy(v jsonb) returns boolean language plpgsql stable set search_path='' as $$
declare r jsonb;b jsonb;begin
 if not coalesce(extensions.jsonb_matches_schema('{"type":"object","additionalProperties":false,"required":["schemaVersion","active","serviceIds","operatingHours","resources","blockedWindows","evidence"],"properties":{"schemaVersion":{"const":"2.0"},"active":{"type":"boolean"},"serviceIds":{"type":"array","minItems":1,"maxItems":100,"uniqueItems":true,"items":{"type":"string","format":"uuid"}},"operatingHours":{"type":["object","null"]},"resources":{"type":"array","minItems":1,"maxItems":20,"items":{"type":"object","additionalProperties":false,"required":["code","name","activities","equipmentTypes","maxConcurrentVehicles"],"properties":{"code":{"type":"string","pattern":"^[A-Z][A-Z0-9_]{0,49}$"},"name":{"type":"string","minLength":1,"maxLength":500,"pattern":"\\S"},"activities":{"type":"array","minItems":1,"maxItems":4,"uniqueItems":true,"items":{"enum":["LOAD","UNLOAD","PARK","MAINTENANCE"]}},"equipmentTypes":{"type":["array","null"],"minItems":1,"maxItems":100,"uniqueItems":true,"items":{"type":"string","minLength":1}},"maxConcurrentVehicles":{"type":["integer","null"],"minimum":1,"maximum":10000}}}},"blockedWindows":{"type":"array","maxItems":100,"items":{"type":"object","additionalProperties":false,"required":["resourceCode","window","reason"],"properties":{"resourceCode":{"type":["string","null"],"pattern":"^[A-Z][A-Z0-9_]{0,49}$"},"window":{"type":"object","additionalProperties":false,"required":["startsAt","endsAt"],"properties":{"startsAt":{"type":"string","format":"date-time"},"endsAt":{"type":"string","format":"date-time"}}},"reason":{"type":"string","minLength":1,"maxLength":500,"pattern":"\\S"}}}},"evidence":{"type":["object","null"],"additionalProperties":false,"required":["reference","verifiedAt","validUntil","provenanceStatus"],"properties":{"reference":{"type":"string","minLength":1,"maxLength":500,"pattern":"\\S"},"verifiedAt":{"type":"string","format":"date-time"},"validUntil":{"type":"string","format":"date-time"},"provenanceStatus":{"enum":["VERIFIED","ESTIMATED","SIMULATED","UNKNOWN"]}}}}}'::json,v),false) then return false;end if;
 if not private.valid_depot_hours(v->'operatingHours') then return false;end if;
 if jsonb_array_length(v->'resources')<>(select count(distinct x->>'code') from jsonb_array_elements(v->'resources') x) then return false;end if;
 for r in select value from jsonb_array_elements(v->'resources') loop
  if r->'equipmentTypes'<>'null'::jsonb and exists(select 1 from jsonb_array_elements_text(r->'equipmentTypes') e where e not in ('BOX_TRUCK','REEFER_TRUCK','FLATBED','TANKER_TRUCK','TRACTOR_TRAILER','ISO_CONTAINER','RAIL_WAGON','AIR_ULD')) then return false;end if;
 end loop;
 for b in select value from jsonb_array_elements(v->'blockedWindows') loop
  if (b#>>'{window,endsAt}')::timestamptz<=(b#>>'{window,startsAt}')::timestamptz or (b->>'resourceCode' is not null and not exists(select 1 from jsonb_array_elements(v->'resources') resource_row where resource_row->>'code'=b->>'resourceCode')) then return false;end if;
 end loop;
 if v->'evidence'<>'null'::jsonb and (v#>>'{evidence,validUntil}')::timestamptz<=(v#>>'{evidence,verifiedAt}')::timestamptz then return false;end if;
 return true;
exception when invalid_datetime_format or datetime_field_overflow or invalid_text_representation then return false;end;$$;
create function private.valid_depot_slot(v jsonb,appointment boolean) returns boolean language plpgsql stable set search_path='' as $$begin
 if not coalesce(extensions.jsonb_matches_schema('{"type":"object","required":["schemaVersion","serviceId","resourceCode","activity","equipmentType","window","units"],"properties":{"schemaVersion":{"const":"2.0"},"serviceId":{"type":"string","format":"uuid"},"resourceCode":{"type":"string","pattern":"^[A-Z][A-Z0-9_]{0,49}$"},"activity":{"enum":["LOAD","UNLOAD","PARK","MAINTENANCE"]},"equipmentType":{"type":"string","minLength":1},"window":{"type":"object","additionalProperties":false,"required":["startsAt","endsAt"],"properties":{"startsAt":{"type":"string","format":"date-time"},"endsAt":{"type":"string","format":"date-time"}}},"units":{"type":"integer","minimum":1,"maximum":10000}}}'::json,v),false) then return false;end if;
 if exists(select 1 from jsonb_object_keys(v) k where k<>all(array['schemaVersion','serviceId','resourceCode','activity','equipmentType','window','units']||case when appointment then array['executionId','status','reason'] else array[]::text[] end)) then return false;end if;
 if v->>'equipmentType' not in ('BOX_TRUCK','REEFER_TRUCK','FLATBED','TANKER_TRUCK','TRACTOR_TRAILER','ISO_CONTAINER','RAIL_WAGON','AIR_ULD') then return false;end if;
 if appointment and (not(v?'executionId' and v?'status' and v?'reason') or jsonb_typeof(v->'executionId') not in ('string','null') or coalesce(v->>'status','') not in ('PROPOSED','CONFIRMED','CANCELLED','COMPLETED') or nullif(trim(v->>'reason'),'') is null or length(v->>'reason')>500) then return false;end if;
 if appointment and v->>'executionId' is not null then perform (v->>'executionId')::uuid;end if;
 return (v#>>'{window,endsAt}')::timestamptz>(v#>>'{window,startsAt}')::timestamptz and (v#>>'{window,endsAt}')::timestamptz-(v#>>'{window,startsAt}')::timestamptz<=interval '14 days';
exception when invalid_datetime_format or datetime_field_overflow or invalid_text_representation then return false;end;$$;

create table public.depot_operating_policies(depot_id uuid primary key references public.carrier_depots(id),carrier_id uuid not null references public.carriers(id),version integer not null check(version>0),value jsonb not null check(private.valid_depot_policy(value)),updated_at timestamptz not null default now());
create index depot_operating_policies_carrier_idx on public.depot_operating_policies(carrier_id,depot_id);
create table public.depot_appointments(id uuid primary key default gen_random_uuid(),depot_id uuid not null references public.depot_operating_policies(depot_id),carrier_id uuid not null references public.carriers(id),service_id uuid not null references public.carrier_services(id),version integer not null check(version>0),starts_at timestamptz not null,ends_at timestamptz not null, value jsonb not null check(private.valid_depot_slot(value,true)),check(ends_at>starts_at),check(starts_at=(value#>>'{window,startsAt}')::timestamptz and ends_at=(value#>>'{window,endsAt}')::timestamptz),updated_at timestamptz not null default now());
create index depot_appointments_scope_idx on public.depot_appointments(carrier_id,depot_id,service_id);
create index depot_appointments_window_idx on public.depot_appointments using gist(tstzrange(starts_at,ends_at,'[)'));
create table private.depot_command_receipts(carrier_id uuid not null,operator_id uuid not null,idempotency_key uuid not null,payload_hash text not null check(payload_hash~'^[0-9a-f]{64}$'),result jsonb not null,primary key(carrier_id,operator_id,idempotency_key),foreign key(operator_id,carrier_id) references public.carrier_operators(id,carrier_id));
create table private.depot_command_events(id bigint generated always as identity primary key,carrier_id uuid not null references public.carriers(id),depot_id uuid not null references public.carrier_depots(id),operator_id uuid not null,action text not null,record_id uuid not null,version integer not null,value jsonb not null,created_at timestamptz not null default now(),foreign key(operator_id,carrier_id) references public.carrier_operators(id,carrier_id));
create index depot_command_events_scope_idx on private.depot_command_events(carrier_id,depot_id,created_at);
alter table public.depot_operating_policies enable row level security;alter table public.depot_appointments enable row level security;
alter table private.depot_command_receipts enable row level security;alter table private.depot_command_events enable row level security;
create function private.depot_read_access(c uuid) returns boolean language plpgsql stable security definer set search_path='' as $$begin return private.identity_carrier(c) is not null;exception when sqlstate 'PT403' then return false;end;$$;
create policy depot_policy_read on public.depot_operating_policies for select to authenticated using(private.depot_read_access(carrier_id));
create policy depot_appointment_read on public.depot_appointments for select to authenticated using(private.depot_read_access(carrier_id));
revoke all on public.depot_operating_policies,public.depot_appointments,private.depot_command_receipts,private.depot_command_events from public,anon,authenticated,service_role;
grant select on public.depot_operating_policies,public.depot_appointments to authenticated;

create function private.depot_decision(c uuid,d uuid,v jsonb,excluded uuid default null) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare p public.depot_operating_policies;r jsonb;blocked text[]:='{}';unknowns text[]:='{}';st timestamptz;en timestamptz;through_at timestamptz;slot record;peak integer;limit_units integer;begin
 if not private.valid_depot_slot(v,false) then raise exception 'VALIDATION_ERROR' using errcode='PT400';end if;
 st:=(v#>>'{window,startsAt}')::timestamptz;en:=(v#>>'{window,endsAt}')::timestamptz;
 select * into p from public.depot_operating_policies where carrier_id=c and depot_id=d;
 if not found then return jsonb_build_object('status','unknown','reasons',jsonb_build_array('DEPOT_POLICY_UNKNOWN'),'provenanceStatus','UNKNOWN','policyVersion',null);end if;
 if not exists(select 1 from public.carrier_depots where id=d and carrier_id=c and active) or not(p.value->>'active')::boolean then blocked:=array_append(blocked,'DEPOT_INACTIVE');end if;
 if not exists(select 1 from jsonb_array_elements_text(p.value->'serviceIds') x where x=(v->>'serviceId')) or not exists(select 1 from public.carrier_services where id=(v->>'serviceId')::uuid and carrier_id=c and active) then blocked:=array_append(blocked,'DEPOT_SERVICE_UNSUPPORTED');end if;
 select x into r from jsonb_array_elements(p.value->'resources') x where x->>'code'=v->>'resourceCode';
 if r is null then blocked:=array_append(blocked,'DEPOT_RESOURCE_UNSUPPORTED');else
  if not(r->'activities' ? (v->>'activity')) then blocked:=array_append(blocked,'DEPOT_ACTIVITY_UNSUPPORTED');end if;
  if r->'equipmentTypes'='null'::jsonb then unknowns:=array_append(unknowns,'DEPOT_EQUIPMENT_UNKNOWN');elsif not(r->'equipmentTypes' ? (v->>'equipmentType')) then blocked:=array_append(blocked,'DEPOT_EQUIPMENT_UNSUPPORTED');end if;
  limit_units:=(r->>'maxConcurrentVehicles')::integer;
  if limit_units is null then unknowns:=array_append(unknowns,'DEPOT_CAPACITY_UNKNOWN');else
   select coalesce(max(load),0)::integer into peak from (select sum(change) over(order by at) load from (
    select at,sum(change) change from (
     select greatest(st,a.starts_at) at,(a.value->>'units')::integer change from public.depot_appointments a where a.carrier_id=c and a.depot_id=d and a.id is distinct from excluded and a.value->>'resourceCode'=v->>'resourceCode' and a.value->>'status'='CONFIRMED' and tstzrange(a.starts_at,a.ends_at,'[)')&&tstzrange(st,en,'[)')
     union all select least(en,a.ends_at),-(a.value->>'units')::integer from public.depot_appointments a where a.carrier_id=c and a.depot_id=d and a.id is distinct from excluded and a.value->>'resourceCode'=v->>'resourceCode' and a.value->>'status'='CONFIRMED' and tstzrange(a.starts_at,a.ends_at,'[)')&&tstzrange(st,en,'[)')
    ) events group by at) grouped) running;
   if peak+(v->>'units')::integer>limit_units then blocked:=array_append(blocked,'DEPOT_CAPACITY_CONFLICT');end if;
  end if;
 end if;
 if p.value->'operatingHours'='null'::jsonb then unknowns:=array_append(unknowns,'DEPOT_HOURS_UNKNOWN');else
  through_at:=st;
  for slot in select (day::date+(h->>'opensAt')::time) at time zone (p.value#>>'{operatingHours,timezone}') opens,(day::date+(h->>'closesAt')::time) at time zone (p.value#>>'{operatingHours,timezone}') closes from generate_series((st at time zone (p.value#>>'{operatingHours,timezone}'))::date::timestamp,((en-interval '1 microsecond') at time zone (p.value#>>'{operatingHours,timezone}'))::date::timestamp,interval '1 day') day cross join jsonb_array_elements(p.value#>'{operatingHours,weekly}') h where extract(isodow from day)::integer=(h->>'dayOfWeek')::integer order by opens loop
   if slot.opens>through_at then exit;end if;if slot.closes>through_at then through_at:=slot.closes;end if;
  end loop;
  if through_at<en then blocked:=array_append(blocked,'DEPOT_OUTSIDE_HOURS');end if;
 end if;
 if exists(select 1 from jsonb_array_elements(p.value->'blockedWindows') b where (b->>'resourceCode' is null or b->>'resourceCode'=v->>'resourceCode') and tstzrange((b#>>'{window,startsAt}')::timestamptz,(b#>>'{window,endsAt}')::timestamptz,'[)')&&tstzrange(st,en,'[)')) then blocked:=array_append(blocked,'DEPOT_BLOCKED');end if;
 if p.value->'evidence'='null'::jsonb or p.value#>>'{evidence,provenanceStatus}' in ('UNKNOWN','ESTIMATED') or (p.value#>>'{evidence,verifiedAt}')::timestamptz>least(now(),st) or (p.value#>>'{evidence,validUntil}')::timestamptz<=now() or (p.value#>>'{evidence,validUntil}')::timestamptz<en then unknowns:=array_append(unknowns,'DEPOT_EVIDENCE_UNKNOWN');end if;
 return jsonb_build_object('status',case when cardinality(blocked)>0 then 'ineligible' when cardinality(unknowns)>0 then 'unknown' else 'eligible' end,'reasons',to_jsonb(blocked||unknowns),'provenanceStatus',coalesce(p.value#>>'{evidence,provenanceStatus}','UNKNOWN'),'policyVersion',p.version);
end;$$;

create function private.depot_operations(op uuid,c uuid,d uuid,action text,i uuid,ver integer,k uuid,v jsonb) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare p public.depot_operating_policies;a public.depot_appointments;rec jsonb;receipt private.depot_command_receipts;fingerprint text;sid uuid;x uuid;decision jsonb;begin
 if auth.uid() is null or op is distinct from private.identity_carrier(c) then raise exception 'FORBIDDEN_CARRIER_IDENTITY' using errcode='PT403';end if;
 if not exists(select 1 from public.carrier_depots where id=d and carrier_id=c) then raise exception 'DEPOT_NOT_FOUND' using errcode='PT404';end if;
 if action='policy.read' then select jsonb_build_object('id',depot_id,'carrierId',carrier_id,'depotId',depot_id,'version',version,'updatedAt',updated_at,'value',value) into rec from public.depot_operating_policies where depot_id=d and carrier_id=c;return jsonb_build_object('data',rec);end if;
 if action='appointments.list' then return jsonb_build_object('data',coalesce((select jsonb_agg(r order by r->>'updatedAt') from(select jsonb_build_object('id',id,'carrierId',carrier_id,'depotId',depot_id,'version',version,'updatedAt',updated_at,'value',value) r from public.depot_appointments where carrier_id=c and depot_id=d order by updated_at,id limit 1001) q),'[]'::jsonb));end if;
 if action='availability' then return jsonb_build_object('data',private.depot_decision(c,d,v));end if;
 if action not in ('policy.save','appointment.save') or k is null or ver is null or ver<0 then raise exception 'VALIDATION_ERROR' using errcode='PT400';end if;
 if not exists(select 1 from public.carrier_operators where id=op and carrier_id=c and role='ADMIN') then raise exception 'FORBIDDEN_CARRIER_ROLE' using errcode='PT403';end if;
 perform pg_advisory_xact_lock(hashtextextended(c::text||op::text||k::text,0));
 fingerprint:=encode(extensions.digest(convert_to(jsonb_build_object('action',action,'depotId',d,'id',i,'expectedVersion',ver,'value',v)::text,'UTF8'),'sha256'),'hex');
 select * into receipt from private.depot_command_receipts where carrier_id=c and operator_id=op and idempotency_key=k;
 if found then if receipt.payload_hash<>fingerprint then raise exception 'IDEMPOTENCY_CONFLICT' using errcode='PT409';end if;return receipt.result||jsonb_build_object('replay',true);end if;
 -- One depot lock serializes rule revisions and all occupancy decisions.
 perform 1 from public.carrier_depots where id=d and carrier_id=c for update;
 if action='policy.save' then
  if i is not null or not private.valid_depot_policy(v) then raise exception 'VALIDATION_ERROR' using errcode='PT400';end if;
  for x in select value::text::uuid from jsonb_array_elements_text(v->'serviceIds') loop if not exists(select 1 from public.carrier_services where id=x and carrier_id=c) then raise exception 'INVALID_DEPOT_SERVICE' using errcode='PT400';end if;end loop;
  if v->'evidence'<>'null'::jsonb and (v#>>'{evidence,verifiedAt}')::timestamptz>now() then raise exception 'VALIDATION_ERROR' using errcode='PT400';end if;
  select * into p from public.depot_operating_policies where depot_id=d;
  if coalesce(p.version,0)<>ver then raise exception 'STALE_DRAFT' using errcode='PT409';end if;
  insert into public.depot_operating_policies(depot_id,carrier_id,version,value) values(d,c,ver+1,v) on conflict(depot_id) do update set version=excluded.version,value=excluded.value,updated_at=now();
  for a in select * from public.depot_appointments where depot_id=d and carrier_id=c and value->>'status'='CONFIRMED' and (value#>>'{window,endsAt}')::timestamptz>now() loop
   decision:=private.depot_decision(c,d,a.value-array['executionId','status','reason'],a.id);if decision->>'status'<>'eligible' then raise exception 'DEPOT_COMMITMENT_CONFLICT' using errcode='PT409';end if;
  end loop;
  rec:=jsonb_build_object('id',d,'carrierId',c,'depotId',d,'version',ver+1,'updatedAt',now(),'value',v);
 else
  if not private.valid_depot_slot(v,true) then raise exception 'VALIDATION_ERROR' using errcode='PT400';end if;
  sid:=(v->>'serviceId')::uuid;
  if not exists(select 1 from public.carrier_services where id=sid and carrier_id=c) or not exists(select 1 from public.depot_operating_policies where depot_id=d and carrier_id=c) then raise exception 'INVALID_DEPOT_SERVICE' using errcode='PT400';end if;
  if v->>'executionId' is not null then perform 1 from public.transport_executions where id=(v->>'executionId')::uuid for share;end if;
  if v->>'executionId' is not null and not exists(select 1 from public.transport_executions where id=(v->>'executionId')::uuid and carrier_id=c and carrier_service_id=sid and (v->>'status'<>'CONFIRMED' or status in ('PLANNED','IN_PROGRESS'))) then raise exception 'INVALID_DEPOT_EXECUTION' using errcode='PT400';end if;
  if i is not null then select * into a from public.depot_appointments where id=i and carrier_id=c and depot_id=d for update;if not found then raise exception 'DEPOT_APPOINTMENT_NOT_FOUND' using errcode='PT404';end if;end if;
  if coalesce(a.version,0)<>ver then raise exception 'STALE_DRAFT' using errcode='PT409';end if;
  if a.value->>'status' in ('CANCELLED','COMPLETED') then raise exception 'DEPOT_TERMINAL_APPOINTMENT' using errcode='PT409';end if;
  if i is null and v->>'status' in ('CANCELLED','COMPLETED') or v->>'status'='COMPLETED' and (a.value->>'status' is distinct from 'CONFIRMED' or a.ends_at>now()) then raise exception 'VALIDATION_ERROR' using errcode='PT400';end if;
  if i is not null and (a.service_id<>sid or a.value->>'executionId' is distinct from v->>'executionId') then raise exception 'IMMUTABLE_DEPOT_CONTEXT' using errcode='PT400';end if;
  if a.value->>'status'='CONFIRMED' and v->>'status'='PROPOSED' then raise exception 'DEPOT_INVALID_TRANSITION' using errcode='PT409';end if;
  if i is not null and v->>'status' in ('CANCELLED','COMPLETED') and (a.value-array['status','reason']) is distinct from (v-array['status','reason']) then raise exception 'IMMUTABLE_DEPOT_CONTEXT' using errcode='PT400';end if;
  if v->>'status'='CONFIRMED' then
   perform 1 from public.carrier_services where id=sid and carrier_id=c for share;
   if (v#>>'{window,startsAt}')::timestamptz<now() then raise exception 'DEPOT_WINDOW_IN_PAST' using errcode='PT409';end if;
   decision:=private.depot_decision(c,d,v-array['executionId','status','reason'],i);if decision->>'status'<>'eligible' then raise exception 'DEPOT_SLOT_UNAVAILABLE' using errcode='PT409';end if;
  end if;
  i:=coalesce(i,gen_random_uuid());
  insert into public.depot_appointments(id,depot_id,carrier_id,service_id,version,starts_at,ends_at,value) values(i,d,c,sid,ver+1,(v#>>'{window,startsAt}')::timestamptz,(v#>>'{window,endsAt}')::timestamptz,v) on conflict(id) do update set version=excluded.version,starts_at=excluded.starts_at,ends_at=excluded.ends_at,value=excluded.value,updated_at=now();
  rec:=jsonb_build_object('id',i,'carrierId',c,'depotId',d,'version',ver+1,'updatedAt',now(),'value',v);
 end if;
 insert into private.depot_command_events(carrier_id,depot_id,operator_id,action,record_id,version,value) values(c,d,op,action,(rec->>'id')::uuid,ver+1,v);
 rec:=jsonb_build_object('data',rec,'replay',false);insert into private.depot_command_receipts values(c,op,k,fingerprint,rec);return rec;
end;$$;
create function public.depot_operations_v2(p_operator_id uuid,p_carrier_id uuid,p_depot_id uuid,p_action text,p_id uuid,p_expected_version integer,p_idempotency_key uuid,p_value jsonb) returns jsonb language sql security invoker set search_path='' as $$select private.depot_operations(p_operator_id,p_carrier_id,p_depot_id,p_action,p_id,p_expected_version,p_idempotency_key,p_value);$$;
revoke all on function private.valid_depot_policy(jsonb),private.valid_depot_slot(jsonb,boolean),private.depot_read_access(uuid),private.depot_decision(uuid,uuid,jsonb,uuid),private.depot_operations(uuid,uuid,uuid,text,uuid,integer,uuid,jsonb),public.depot_operations_v2(uuid,uuid,uuid,text,uuid,integer,uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function private.depot_read_access(uuid),private.depot_operations(uuid,uuid,uuid,text,uuid,integer,uuid,jsonb),public.depot_operations_v2(uuid,uuid,uuid,text,uuid,integer,uuid,jsonb) to authenticated;

create function private.guard_depot_commitments() returns trigger language plpgsql security definer set search_path='' as $$begin
 if tg_table_name='carrier_depots' and old.active and not new.active and exists(select 1 from public.depot_appointments where depot_id=new.id and value->>'status'='CONFIRMED' and ends_at>now())
 or tg_table_name='carrier_services' and old.active and not new.active and exists(select 1 from public.depot_appointments where service_id=new.id and value->>'status'='CONFIRMED' and ends_at>now()) then raise exception 'DEPOT_COMMITMENT_CONFLICT' using errcode='PT409';end if;
 return new;end;$$;
create trigger depot_active_commitments before update of active on public.carrier_depots for each row execute function private.guard_depot_commitments();
create trigger depot_service_commitments before update of active on public.carrier_services for each row execute function private.guard_depot_commitments();
revoke all on function private.guard_depot_commitments() from public,anon,authenticated,service_role;
create function private.guard_execution_depot_commitments() returns trigger language plpgsql security definer set search_path='' as $$begin
 if new.status in ('CANCELLED','COMPLETED') and new.status is distinct from old.status and exists(select 1 from public.depot_appointments where value->>'executionId'=new.id::text and value->>'status'='CONFIRMED' and ends_at>now()) then raise exception 'DEPOT_COMMITMENT_CONFLICT' using errcode='PT409';end if;return new;end;$$;
create trigger execution_depot_commitments before update of status on public.transport_executions for each row execute function private.guard_execution_depot_commitments();
revoke all on function private.valid_depot_hours(jsonb),private.guard_execution_depot_commitments() from public,anon,authenticated,service_role;
notify pgrst,'reload schema';
commit;

-- HAC-50. Carrier-owned document review and separately reported passage events.
-- No customs authority integration and no synthetic business rows in migrations.
create function private.valid_border_value(v jsonb, kind text) returns boolean
language plpgsql stable set search_path='' as $$
declare d jsonb; schema jsonb;begin
 if kind='context' then
  schema:='{"type":"object","additionalProperties":false,"required":["schemaVersion","serviceId","laneId","executionId","operationReference","routeFingerprint","fromCountry","toCountry","checkpointReference","window","requiredDocuments","provenance"],"properties":{"schemaVersion":{"const":"2.0"},"serviceId":{"type":"string","format":"uuid"},"laneId":{"type":"string","format":"uuid"},"executionId":{"type":["string","null"],"format":"uuid"},"operationReference":{"type":"string","minLength":1,"maxLength":500},"routeFingerprint":{"type":"string","pattern":"^[a-f0-9]{64}$"},"fromCountry":{"type":"string","pattern":"^[A-Z]{2}$"},"toCountry":{"type":"string","pattern":"^[A-Z]{2}$"},"checkpointReference":{"type":"string","minLength":1,"maxLength":500},"window":{"type":"object","additionalProperties":false,"required":["startsAt","endsAt"],"properties":{"startsAt":{"type":"string","format":"date-time"},"endsAt":{"type":"string","format":"date-time"}}},"requiredDocuments":{"type":"array","minItems":1,"maxItems":30,"uniqueItems":true,"items":{"type":"string","pattern":"^[A-Z][A-Z0-9_]{0,49}$"}},"provenance":{"enum":["SIMULATED","CARRIER_REPORTED"]}}}'::jsonb;
 elsif kind='review' then
  schema:='{"type":"object","additionalProperties":false,"required":["status","documents","note"],"properties":{"status":{"enum":["IN_REVIEW","NEEDS_DOCUMENTS","APPROVED","REJECTED"]},"note":{"type":"string","minLength":1,"maxLength":500},"documents":{"type":"array","maxItems":30,"items":{"type":"object","additionalProperties":false,"required":["code","reference","checkedAt","validUntil"],"properties":{"code":{"type":"string","pattern":"^[A-Z][A-Z0-9_]{0,49}$"},"reference":{"type":"string","minLength":1,"maxLength":500},"checkedAt":{"type":"string","format":"date-time"},"validUntil":{"type":"string","format":"date-time"}}}}}}'::jsonb;
 elsif kind='passage' then
  schema:='{"type":"object","additionalProperties":false,"required":["status","occurredAt","reference"],"properties":{"status":{"enum":["APPROACHING","WAITING","INSPECTION","HELD","RELEASED","CROSSED"]},"occurredAt":{"type":"string","format":"date-time"},"reference":{"type":"string","minLength":1,"maxLength":500}}}'::jsonb;
 else return false;end if;
 if not coalesce(extensions.jsonb_matches_schema(schema::json,v),false) then return false;end if;
 if kind='context' then
  return v->>'fromCountry'<>v->>'toCountry' and length(btrim(v->>'operationReference'))>0 and length(btrim(v->>'checkpointReference'))>0
    and (v#>>'{window,endsAt}')::timestamptz>(v#>>'{window,startsAt}')::timestamptz;
 elsif kind='review' then
  if length(btrim(v->>'note'))=0 or (select count(*)<>count(distinct e->>'code') from jsonb_array_elements(v->'documents') e) then return false;end if;
  for d in select value from jsonb_array_elements(v->'documents') loop
   if length(btrim(d->>'reference'))=0 or (d->>'validUntil')::timestamptz<=(d->>'checkedAt')::timestamptz then return false;end if;
  end loop;
 else return length(btrim(v->>'reference'))>0;end if;
 return true;
exception when invalid_datetime_format or datetime_field_overflow or invalid_text_representation then return false;end;$$;

create unique index service_lanes_id_service_border_idx on public.service_lanes(id,carrier_service_id);
create table public.carrier_border_crossings(
 id uuid primary key default gen_random_uuid(),carrier_id uuid not null references public.carriers(id),
 service_id uuid not null,lane_id uuid not null,lane_version integer not null check(lane_version>0),
 catalog_fingerprint text not null check(catalog_fingerprint~'^[a-f0-9]{64}$'),
 context jsonb not null check(private.valid_border_value(context,'context')),
 version integer not null check(version>0),review_status text not null default 'PENDING'
   check(review_status in ('PENDING','IN_REVIEW','NEEDS_DOCUMENTS','APPROVED','REJECTED')),
 documents jsonb not null default '[]',review_note text,passage_status text not null default 'NOT_STARTED'
   check(passage_status in ('NOT_STARTED','APPROACHING','WAITING','INSPECTION','HELD','RELEASED','CROSSED')),
 last_event_at timestamptz,release_reference text,updated_at timestamptz not null default now(),
 foreign key(service_id,carrier_id) references public.carrier_services(id,carrier_id),
 foreign key(lane_id,service_id) references public.service_lanes(id,carrier_service_id),
 check(service_id=(context->>'serviceId')::uuid and lane_id=(context->>'laneId')::uuid),
 check(private.valid_border_value(jsonb_build_object('status','IN_REVIEW','note',coalesce(review_note,'Pending'),'documents',documents),'review')),
 check((passage_status='NOT_STARTED')=(last_event_at is null)),
 check(passage_status not in ('RELEASED','CROSSED') or nullif(btrim(release_reference),'') is not null)
);
create index carrier_border_crossings_scope_idx on public.carrier_border_crossings(carrier_id,updated_at desc,id);
create index carrier_border_crossings_lane_idx on public.carrier_border_crossings(lane_id,service_id);
create index carrier_border_crossings_service_idx on public.carrier_border_crossings(service_id,carrier_id);
create unique index carrier_border_crossings_operation_idx on public.carrier_border_crossings
 (carrier_id,lane_id,(context->>'operationReference'),(context->>'checkpointReference'),(context->>'routeFingerprint'),(context->>'provenance'));
create table private.border_command_receipts(
 carrier_id uuid not null,operator_id uuid not null,idempotency_key uuid not null,
 payload_hash text not null check(payload_hash~'^[a-f0-9]{64}$'),result jsonb not null,
 primary key(carrier_id,operator_id,idempotency_key),
 foreign key(operator_id,carrier_id) references public.carrier_operators(id,carrier_id)
);
create table private.border_command_events(
 id bigint generated always as identity primary key,crossing_id uuid not null references public.carrier_border_crossings(id),
 carrier_id uuid not null,operator_id uuid not null,version integer not null check(version>0),
 action text not null check(action in ('create','review','passage')),value jsonb not null,recorded_at timestamptz not null default now(),
 unique(crossing_id,version),foreign key(operator_id,carrier_id) references public.carrier_operators(id,carrier_id)
);
create index border_command_events_scope_idx on private.border_command_events(carrier_id,crossing_id,version);
create index border_command_events_operator_idx on private.border_command_events(operator_id,carrier_id);
alter table public.carrier_border_crossings enable row level security;
alter table private.border_command_receipts enable row level security;
alter table private.border_command_events enable row level security;
create policy border_crossing_read on public.carrier_border_crossings for select to authenticated using(private.depot_read_access(carrier_id));
revoke all on public.carrier_border_crossings,private.border_command_receipts,private.border_command_events from public,anon,authenticated,service_role;
grant select on public.carrier_border_crossings to authenticated;

create function private.border_record(r public.carrier_border_crossings) returns jsonb
language sql stable set search_path='' as $$select jsonb_build_object(
 'id',r.id,'carrierId',r.carrier_id,'version',r.version,'laneVersion',r.lane_version,'context',r.context,'catalogFingerprint',r.catalog_fingerprint,
 'reviewStatus',r.review_status,'documents',r.documents,'reviewNote',r.review_note,
 'passageStatus',r.passage_status,'lastEventAt',r.last_event_at,'releaseReference',r.release_reference,'updatedAt',r.updated_at);$$;

-- Recheck current persisted catalog. A dossier is not reusable across a lane revision or country pair.
create function private.border_catalog_fingerprint(c uuid,v jsonb) returns text
language sql stable set search_path='' as $$select encode(extensions.digest(convert_to(jsonb_build_array(s.id,s.version,l.id,l.version,p.id,p.version,d.id,d.version)::text,'UTF8'),'sha256'),'hex')
 from public.service_lanes l join public.carrier_services s on s.id=l.carrier_service_id
 join public.service_areas p on p.id=l.pickup_area_id join public.service_areas d on d.id=l.delivery_area_id
 where s.carrier_id=c and s.id=(v->>'serviceId')::uuid and l.id=(v->>'laneId')::uuid;$$;
create function private.lock_border_catalog(c uuid,v jsonb) returns void
language plpgsql set search_path='' as $$begin
 perform 1 from public.carriers where id=c for share;
 perform 1 from public.carrier_services where id=(v->>'serviceId')::uuid and carrier_id=c for share;
 perform 1 from public.service_lanes where id=(v->>'laneId')::uuid for share;
 perform 1 from public.service_areas where id in(select pickup_area_id from public.service_lanes where id=(v->>'laneId')::uuid
  union select delivery_area_id from public.service_lanes where id=(v->>'laneId')::uuid) order by id for share;
end;$$;
create function private.border_catalog_check(c uuid,v jsonb,ver integer default null,expected_hash text default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare l public.service_lanes;p public.service_areas;d public.service_areas;s public.carrier_services;
 reasons text[]:=array[]::text[];st timestamptz;en timestamptz;blocked boolean:=false;begin
 select * into s from public.carrier_services where id=(v->>'serviceId')::uuid and carrier_id=c;
 select * into l from public.service_lanes where id=(v->>'laneId')::uuid and carrier_service_id=s.id;
 if s.id is null or l.id is null then return jsonb_build_object('status','unknown','reasons',jsonb_build_array('BORDER_CATALOG_MISSING'));end if;
 select * into p from public.service_areas where id=l.pickup_area_id;select * into d from public.service_areas where id=l.delivery_area_id;
 if l.cross_border_prohibited then blocked:=true;reasons:=array_append(reasons,'BORDER_CROSSING_PROHIBITED');end if;
 if not l.active or not s.active or not p.active or not d.active or not exists(select 1 from public.carriers where id=c and status='ACTIVE') then blocked:=true;reasons:=array_append(reasons,'BORDER_CATALOG_INACTIVE');end if;
 if p.area_role<>'PICKUP' or d.area_role<>'DELIVERY' or p.coverage<>'INCLUDE' or d.coverage<>'INCLUDE'
   or p.country_code<>v->>'fromCountry' or d.country_code<>v->>'toCountry' then
  blocked:=true;reasons:=array_append(reasons,'BORDER_COUNTRY_PAIR_MISMATCH');end if;
 if ver is not null and ver<>l.version then reasons:=array_append(reasons,'BORDER_CATALOG_CHANGED');end if;
 if expected_hash is not null and expected_hash is distinct from private.border_catalog_fingerprint(c,v) and not('BORDER_CATALOG_CHANGED'=any(reasons)) then reasons:=array_append(reasons,'BORDER_CATALOG_CHANGED');end if;
 st:=(v#>>'{window,startsAt}')::timestamptz;en:=(v#>>'{window,endsAt}')::timestamptz;
 if l.valid_from>st or p.valid_from>st or d.valid_from>st or l.valid_until<en or p.valid_until<en or d.valid_until<en
   or l.verified_at>now() or p.verified_at>now() or d.verified_at>now() then reasons:=array_append(reasons,'BORDER_CATALOG_NOT_CURRENT');end if;
 return jsonb_build_object('status',case when blocked then 'ineligible' when cardinality(reasons)>0 then 'unknown' else 'eligible' end,'reasons',to_jsonb(reasons));
end;$$;
create function private.border_documents_current(v jsonb,docs jsonb) returns boolean
language sql stable set search_path='' as $$select not exists(
 select 1 from jsonb_array_elements_text(v->'requiredDocuments') code where not exists(
  select 1 from jsonb_array_elements(docs) d where d->>'code'=code
   and (d->>'checkedAt')::timestamptz<=least(now(),(v#>>'{window,startsAt}')::timestamptz)
   and (d->>'validUntil')::timestamptz>now() and (d->>'validUntil')::timestamptz>=(v#>>'{window,endsAt}')::timestamptz));$$;

create function private.border_operations(op uuid,c uuid,action text,i uuid,ver integer,k uuid,v jsonb) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare r public.carrier_border_crossings;receipt private.border_command_receipts;result jsonb;fingerprint text;
 check_result jsonb;lane_ver integer;allowed boolean;event_at timestamptz;begin
 if auth.uid() is null or op is distinct from private.identity_carrier(c) then raise exception 'FORBIDDEN_CARRIER_IDENTITY' using errcode='PT403';end if;
 if action is null or action not in ('create','list','read','history','assessment','review','passage') or
   (action in ('create','list') and i is not null) or (action not in ('create','list') and i is null) then raise exception 'VALIDATION_ERROR' using errcode='PT400';end if;
 if action='list' then return jsonb_build_object('data',coalesce((select jsonb_agg(x order by x->>'updatedAt' desc,x->>'id') from(
  select private.border_record(t) x from public.carrier_border_crossings t where carrier_id=c order by updated_at desc,id limit 101) q),'[]'::jsonb));end if;
 if i is not null then select * into r from public.carrier_border_crossings where id=i and carrier_id=c;
  if not found then raise exception 'BORDER_CROSSING_NOT_FOUND' using errcode='PT404';end if;end if;
 if action='read' then return jsonb_build_object('data',private.border_record(r));end if;
 if action='history' then return jsonb_build_object('data',coalesce((select jsonb_agg(x order by (x->>'version')::integer desc) from(
  select jsonb_build_object('id',e.id::text,'crossingId',e.crossing_id,'carrierId',e.carrier_id,'operatorId',e.operator_id,
    'version',e.version,'action',e.action,'value',e.value,'recordedAt',e.recorded_at) x
   from private.border_command_events e where carrier_id=c and crossing_id=i order by version desc limit 1001) q),'[]'::jsonb));end if;
 if action='assessment' then return jsonb_build_object('data',private.border_record(r),'catalogCheck',private.border_catalog_check(c,r.context,r.lane_version,r.catalog_fingerprint));end if;
 if k is null or ver is null or ver<0 or (action='create')<>(ver=0) or not private.valid_border_value(v,case when action='create' then 'context' else action end) then raise exception 'VALIDATION_ERROR' using errcode='PT400';end if;
 if not exists(select 1 from public.carrier_operators where id=op and carrier_id=c and role in ('ADMIN','DISPATCHER')) then raise exception 'FORBIDDEN_CARRIER_ROLE' using errcode='PT403';end if;
 perform pg_advisory_xact_lock(hashtextextended(c::text||op::text||k::text,0));
 fingerprint:=encode(extensions.digest(convert_to(jsonb_build_object('action',action,'id',i,'expectedVersion',ver,'value',v)::text,'UTF8'),'sha256'),'hex');
 select * into receipt from private.border_command_receipts where carrier_id=c and operator_id=op and idempotency_key=k;
 if found then if receipt.payload_hash<>fingerprint then raise exception 'IDEMPOTENCY_CONFLICT' using errcode='PT409';end if;return receipt.result||jsonb_build_object('replay',true);end if;
 if action='create' then
  -- The lane lock also serializes duplicate operation creation. Catalog revisions use the same row lock.
  perform private.lock_border_catalog(c,v);
  check_result:=private.border_catalog_check(c,v);
  if check_result->>'status'<>'eligible' then raise exception 'BORDER_CATALOG_UNAVAILABLE' using errcode='PT409';end if;
  select version into lane_ver from public.service_lanes where id=(v->>'laneId')::uuid;
  if v->>'executionId' is not null and not exists(select 1 from public.transport_executions
    where id=(v->>'executionId')::uuid and carrier_id=c and carrier_service_id=(v->>'serviceId')::uuid
      and status in ('PLANNED','IN_PROGRESS') and planned_starts_at<=(v#>>'{window,startsAt}')::timestamptz and planned_ends_at>=(v#>>'{window,endsAt}')::timestamptz) then raise exception 'INVALID_BORDER_EXECUTION' using errcode='PT400';end if;
  insert into public.carrier_border_crossings(carrier_id,service_id,lane_id,lane_version,catalog_fingerprint,context,version)
   values(c,(v->>'serviceId')::uuid,(v->>'laneId')::uuid,lane_ver,private.border_catalog_fingerprint(c,v),v,1) returning * into r;
 else
  select * into r from public.carrier_border_crossings where id=i and carrier_id=c for update;
  if r.version<>ver then raise exception 'STALE_DRAFT' using errcode='PT409';end if;
  if r.passage_status='CROSSED' then raise exception 'BORDER_TERMINAL_CROSSING' using errcode='PT409';end if;
  perform private.lock_border_catalog(c,r.context);
  check_result:=private.border_catalog_check(c,r.context,r.lane_version,r.catalog_fingerprint);
  if check_result->>'status'<>'eligible' then raise exception 'BORDER_CATALOG_UNAVAILABLE' using errcode='PT409';end if;
  if action='review' then
   if r.passage_status='RELEASED' then raise exception 'BORDER_REVIEW_LOCKED' using errcode='PT409';end if;
   allowed:=case r.review_status when 'PENDING' then v->>'status'='IN_REVIEW'
    when 'IN_REVIEW' then v->>'status' in ('IN_REVIEW','NEEDS_DOCUMENTS','APPROVED','REJECTED')
    when 'NEEDS_DOCUMENTS' then v->>'status'='IN_REVIEW'
    when 'APPROVED' then v->>'status'='IN_REVIEW' else false end;
   if not allowed then raise exception 'BORDER_INVALID_TRANSITION' using errcode='PT409';end if;
   if exists(select 1 from jsonb_array_elements(v->'documents') d where (d->>'checkedAt')::timestamptz>now()
     or not(r.context->'requiredDocuments' ? (d->>'code'))) then raise exception 'VALIDATION_ERROR' using errcode='PT400';end if;
   if v->>'status'='APPROVED' and not private.border_documents_current(r.context,v->'documents') then raise exception 'BORDER_DOCUMENTS_INCOMPLETE' using errcode='PT409';end if;
   update public.carrier_border_crossings set review_status=v->>'status',documents=v->'documents',review_note=v->>'note',version=ver+1,updated_at=now() where id=i returning * into r;
  else
   allowed:=case r.passage_status when 'NOT_STARTED' then v->>'status'='APPROACHING'
    when 'APPROACHING' then v->>'status'='WAITING' when 'WAITING' then v->>'status' in ('INSPECTION','HELD')
    when 'INSPECTION' then v->>'status' in ('HELD','RELEASED') when 'HELD' then v->>'status'='INSPECTION'
    when 'RELEASED' then v->>'status'='CROSSED' else false end;
   if not allowed then raise exception 'BORDER_INVALID_TRANSITION' using errcode='PT409';end if;
   event_at:=(v->>'occurredAt')::timestamptz;
   if event_at>now() or event_at<r.last_event_at or event_at<(r.context#>>'{window,startsAt}')::timestamptz or event_at>(r.context#>>'{window,endsAt}')::timestamptz then raise exception 'BORDER_EVENT_TIME_INVALID' using errcode='PT400';end if;
   if r.context->>'provenance'='CARRIER_REPORTED' and not exists(select 1 from public.transport_executions where id=(r.context->>'executionId')::uuid and carrier_id=c and carrier_service_id=r.service_id and status='IN_PROGRESS') then raise exception 'BORDER_EXECUTION_NOT_ACTIVE' using errcode='PT409';end if;
   if v->>'status' in ('RELEASED','CROSSED') and (r.review_status<>'APPROVED' or not private.border_documents_current(r.context,r.documents)) then raise exception 'BORDER_REVIEW_NOT_READY' using errcode='PT409';end if;
   update public.carrier_border_crossings set passage_status=v->>'status',last_event_at=event_at,
    release_reference=case when v->>'status'='RELEASED' then v->>'reference' else release_reference end,
    version=ver+1,updated_at=now() where id=i returning * into r;
  end if;
 end if;
 insert into private.border_command_events(crossing_id,carrier_id,operator_id,version,action,value) values(r.id,c,op,r.version,action,v);
 result:=jsonb_build_object('data',private.border_record(r),'replay',false);
 insert into private.border_command_receipts values(c,op,k,fingerprint,result);return result;
exception when unique_violation then raise exception 'BORDER_OPERATION_CONFLICT' using errcode='PT409';end;$$;
create function public.border_operations_v2(p_operator_id uuid,p_carrier_id uuid,p_action text,p_id uuid,p_expected_version integer,p_idempotency_key uuid,p_value jsonb)
 returns jsonb language sql security invoker set search_path='' as $$select private.border_operations(p_operator_id,p_carrier_id,p_action,p_id,p_expected_version,p_idempotency_key,p_value);$$;
revoke all on function private.valid_border_value(jsonb,text),private.border_record(public.carrier_border_crossings),private.border_catalog_fingerprint(uuid,jsonb),private.lock_border_catalog(uuid,jsonb),private.border_catalog_check(uuid,jsonb,integer,text),private.border_documents_current(jsonb,jsonb),private.border_operations(uuid,uuid,text,uuid,integer,uuid,jsonb),public.border_operations_v2(uuid,uuid,text,uuid,integer,uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function private.border_operations(uuid,uuid,text,uuid,integer,uuid,jsonb),public.border_operations_v2(uuid,uuid,text,uuid,integer,uuid,jsonb) to authenticated;

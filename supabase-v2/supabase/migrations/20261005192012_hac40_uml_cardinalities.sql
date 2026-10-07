-- F-05: canonical leg assignments own 1..N resource bindings. Production data
-- is preserved; the previous per-resource assignment rows become bindings.
alter table public.plan_leg_assignments rename to plan_resource_bindings;
alter table public.plan_resource_bindings rename constraint plan_leg_assignments_pkey to plan_resource_bindings_pkey;

create table public.plan_leg_assignments (
 id uuid primary key,
 plan_id uuid not null references public.transport_plan_candidates(id),
 route_leg_id uuid not null references public.route_legs(id),
 carrier_service_id uuid not null references public.carrier_services(id),
 lane_id uuid not null references public.service_lanes(id),
 sequence integer not null check(sequence>0),
 starts_at timestamptz not null, ends_at timestamptz not null,
 data jsonb not null default '{}',
 unique(id,plan_id), check(ends_at>starts_at)
);
alter table public.plan_leg_assignments enable row level security;
revoke all on public.plan_leg_assignments from public,anon,authenticated,service_role;
create index leg_assignment_plan_idx on public.plan_leg_assignments(plan_id);
create index leg_assignment_route_idx on public.plan_leg_assignments(route_leg_id);
create index leg_assignment_service_idx on public.plan_leg_assignments(carrier_service_id);
create index leg_assignment_lane_idx on public.plan_leg_assignments(lane_id);

insert into public.plan_leg_assignments(id,plan_id,route_leg_id,carrier_service_id,lane_id,sequence,starts_at,ends_at,data)
 select id,plan_id,route_leg_id,carrier_service_id,lane_id,sequence,starts_at,ends_at,data from public.plan_resource_bindings;
alter table public.plan_resource_bindings add column leg_assignment_id uuid;
update public.plan_resource_bindings set leg_assignment_id=id;
alter table public.plan_resource_bindings alter column leg_assignment_id set not null,
 add constraint resource_binding_leg_fk foreign key(leg_assignment_id,plan_id) references public.plan_leg_assignments(id,plan_id),
 add constraint resource_binding_resource_unique unique(resource_id);
create index binding_leg_idx on public.plan_resource_bindings(leg_assignment_id,plan_id);

-- Preserve native resource-level evaluation, holds, booking and operation. This
-- changes identifiers of implementation tables, not their permissions or rules.
do $$declare f record;begin
 for f in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='private' and p.prokind='f' and p.prosrc like '%public.plan_leg_assignments%'
 loop execute replace(pg_get_functiondef(f.oid),'public.plan_leg_assignments','public.plan_resource_bindings');end loop;
end;$$;

create function private.guard_leg_resource_binding() returns trigger language plpgsql security definer set search_path='' as $$
declare g uuid;a public.plan_leg_assignments;r public.plan_resources;meta jsonb;begin
 select * into r from public.plan_resources where id=new.resource_id;
 if tg_op='UPDATE' then
  if new.leg_assignment_id is distinct from old.leg_assignment_id or new.resource_id<>old.resource_id
   or new.plan_id<>old.plan_id then raise exception 'IMMUTABLE_RESOURCE_BINDING' using errcode='PT400';end if;
 else
  for meta in select value from jsonb_array_elements(coalesce(nullif(current_setting('cargomesh.f05_groups',true),''),'[]')::jsonb) loop
   if (meta->>'sequence')::integer=new.sequence and (meta->>'serviceId')::uuid=new.carrier_service_id
    and (meta->>'calendarId')::uuid=r.calendar_id and (meta->>'assetId')::uuid is not distinct from r.asset_id
    and (meta->>'poolId')::uuid is not distinct from r.capacity_pool_id then g:=(meta->>'groupId')::uuid;exit;end if;
  end loop;
  new.leg_assignment_id:=coalesce(g,new.id);
  insert into public.plan_leg_assignments(id,plan_id,route_leg_id,carrier_service_id,lane_id,sequence,starts_at,ends_at)
   values(new.leg_assignment_id,new.plan_id,new.route_leg_id,new.carrier_service_id,new.lane_id,new.sequence,new.starts_at,new.ends_at)
   on conflict(id) do nothing;
 end if;
 select * into a from public.plan_leg_assignments where id=new.leg_assignment_id;
 if a.plan_id is distinct from new.plan_id or a.route_leg_id is distinct from new.route_leg_id
  or a.carrier_service_id is distinct from new.carrier_service_id or a.lane_id is distinct from new.lane_id
  or a.starts_at is distinct from new.starts_at or a.ends_at is distinct from new.ends_at
 then raise exception 'RESOURCE_ASSIGNMENT_MISMATCH' using errcode='PT400';end if;
 return new;
end;$$;
create trigger resource_binding_leg_guard before insert or update on public.plan_resource_bindings
 for each row execute function private.guard_leg_resource_binding();

create function private.require_leg_resources() returns trigger language plpgsql set search_path='' as $$
declare i uuid;begin
 if tg_table_name='plan_leg_assignments' then i:=coalesce(new.id,old.id);
 else i:=coalesce(new.leg_assignment_id,old.leg_assignment_id);end if;
 if exists(select 1 from public.plan_leg_assignments where id=i)
  and not exists(select 1 from public.plan_resource_bindings where leg_assignment_id=i)
 then raise exception 'ASSIGNMENT_REQUIRES_RESOURCES' using errcode='23514';end if;
 return null;
end;$$;
create constraint trigger leg_requires_resources after insert or update on public.plan_leg_assignments
 deferrable initially deferred for each row execute function private.require_leg_resources();
create constraint trigger binding_preserves_resources after delete or update on public.plan_resource_bindings
 deferrable initially deferred for each row execute function private.require_leg_resources();

alter table public.capacity_reservations add column plan_resource_id uuid references public.plan_resources(id),
 add column plan_leg_assignment_id uuid references public.plan_leg_assignments(id);
update public.capacity_reservations h set plan_resource_id=b.resource_id,plan_leg_assignment_id=b.leg_assignment_id
 from public.plan_resource_bindings b where b.id=h.plan_assignment_id;
create index reservation_resource_idx on public.capacity_reservations(plan_resource_id);
create index reservation_leg_idx on public.capacity_reservations(plan_leg_assignment_id);
create function private.guard_reservation_plan_resource() returns trigger language plpgsql security definer set search_path='' as $$
declare b public.plan_resource_bindings;begin
 if new.plan_assignment_id is null then
  if new.plan_resource_id is not null or new.plan_leg_assignment_id is not null then raise exception 'RESOURCE_ASSIGNMENT_MISMATCH' using errcode='PT400';end if;
 else
  select * into b from public.plan_resource_bindings where id=new.plan_assignment_id;
  if b.id is null or new.plan_resource_id is not null and new.plan_resource_id<>b.resource_id
   or new.plan_leg_assignment_id is not null and new.plan_leg_assignment_id<>b.leg_assignment_id
  then raise exception 'RESOURCE_ASSIGNMENT_MISMATCH' using errcode='PT400';end if;
  new.plan_resource_id:=b.resource_id;new.plan_leg_assignment_id:=b.leg_assignment_id;
 end if;
 return new;
end;$$;
create trigger a_reservation_resource before insert or update on public.capacity_reservations
 for each row execute function private.guard_reservation_plan_resource();

-- A route snapshot belongs to at most one candidate. Reusing a route blueprint
-- creates a distinct snapshot; alternatives do not share mutable route identity.
create function private.clone_plan_route(i uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare r public.route_plans;l public.route_legs;n uuid:=gen_random_uuid();lid uuid;begin
 select * into r from public.route_plans where id=i;
 insert into public.route_plans(id,organization_id,freight_request_id,status,policy_id,data)
  values(n,r.organization_id,r.freight_request_id,r.status,r.policy_id,r.data||jsonb_build_object('copiedFromRouteId',i));
 for l in select * from public.route_legs where route_plan_id=i order by sequence loop
  lid:=gen_random_uuid();
  insert into public.route_legs(id,route_plan_id,corridor_id,sequence,data) values(lid,n,l.corridor_id,l.sequence,l.data);
  insert into public.route_waypoints(route_leg_id,sequence,data) select lid,sequence,data from public.route_waypoints where route_leg_id=l.id;
 end loop;
 update public.route_plans set data=data||jsonb_build_object('legs',(select jsonb_agg(data||jsonb_build_object('id',id,'corridorId',corridor_id) order by sequence)
  from public.route_legs where route_plan_id=n)) where id=n;
 return n;
end;$$;
do $$declare p record;n uuid;begin
 for p in select id,route_plan_id from (select id,route_plan_id,row_number() over(partition by route_plan_id order by id) ordinal
  from public.transport_plan_candidates) plans where ordinal>1 loop
  n:=private.clone_plan_route(p.route_plan_id);
  update public.plan_leg_assignments a set route_leg_id=l.id from public.route_legs l
   where a.plan_id=p.id and l.route_plan_id=n and l.sequence=a.sequence;
  update public.plan_resource_bindings b set route_leg_id=l.id from public.route_legs l
   where b.plan_id=p.id and l.route_plan_id=n and l.sequence=b.sequence;
  update public.transport_plan_candidates set route_plan_id=n,data=jsonb_set(data,'{routeId}',to_jsonb(n)) where id=p.id;
 end loop;
end;$$;

create function private.canonical_assignment_ids(ids jsonb) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(id) order by id),'[]') from
 (select distinct coalesce((select leg_assignment_id from public.plan_resource_bindings where id=x::uuid),x::uuid) id
  from jsonb_array_elements_text(ids) x) mapped;
$$;

create function private.project_workflow_record(k text,result jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare a jsonb;g jsonb;groups jsonb:='[]';bindings jsonb:='[]';gid uuid;idx integer;w numeric;vol numeric;h public.capacity_reservations;begin
 if k='plans' then
  for a in select value from jsonb_array_elements(result#>'{data,assignments}') loop
   select leg_assignment_id into gid from public.plan_resource_bindings where id=(a->>'id')::uuid;
   if gid is null then raise exception 'RESOURCE_ASSIGNMENT_MISMATCH' using errcode='PT400';end if;
   bindings:=bindings||jsonb_build_array(a||jsonb_build_object('legAssignmentId',gid));
   idx:=null;
   select ordinal-1 into idx from jsonb_array_elements(groups) with ordinality as gg(value,ordinal) where value->>'id'=gid::text;
   if idx is null then
    g:=jsonb_build_object('id',gid,'serviceId',a->'serviceId','carrierId',a->'carrierId','sequence',a->'sequence',
     'window',a->'window','responsibility',a->'responsibility','coverage',a->'coverage','availability',a->'availability',
     'capacityNeeded',jsonb_build_object('weightKg',0,'volumeM3',0),'evidence',a->'evidence','resources','[]'::jsonb);
    idx:=jsonb_array_length(groups);groups:=groups||jsonb_build_array(g);
   else g:=groups->idx;end if;
   w:=(g#>>'{capacityNeeded,weightKg}')::numeric+(a#>>'{capacityNeeded,weightKg}')::numeric;
   vol:=(g#>>'{capacityNeeded,volumeM3}')::numeric+(a#>>'{capacityNeeded,volumeM3}')::numeric;
   g:=g||jsonb_build_object('capacityNeeded',jsonb_build_object('weightKg',w,'volumeM3',vol),
    'resources',(g->'resources')||jsonb_build_array(jsonb_build_object('bindingId',a->'id','resourceId',a->'resourceId',
     'resource',a->'resource','allocations',a->'allocations')));
   groups:=jsonb_set(groups,array[idx::text],g);
  end loop;
  result:=jsonb_set(jsonb_set(result,'{data,assignments}',bindings),'{data,legAssignments}',groups);
 elsif k='offers' then
  result:=jsonb_set(result,'{data,coveredAssignmentIds}',private.canonical_assignment_ids(result#>'{data,coveredAssignmentIds}'));
 elsif k='opportunities' then
  result:=jsonb_set(result,'{data,assignmentIds}',private.canonical_assignment_ids(result#>'{data,assignmentIds}'));
 elsif k='holds' then
  select * into h from public.capacity_reservations where id=(result->>'id')::uuid;
  result:=jsonb_set(jsonb_set(result,'{data,assignmentId}',to_jsonb(h.plan_leg_assignment_id)),
   '{data,planResourceId}',to_jsonb(h.plan_resource_id));
 elsif k='ranking' then
  groups:='[]';
  for a in select value from jsonb_array_elements(result#>'{data,options}') loop
   groups:=groups||jsonb_build_array(jsonb_set(a,'{assignments}',private.canonical_assignment_ids(a->'assignments')));
  end loop;
  result:=jsonb_set(result,'{data,options}',groups);
 end if;
 return result;
end;$$;
alter function private.workflow_record(text,uuid) rename to workflow_record_before_f05;
create function private.workflow_record(k text,i uuid) returns jsonb language sql security definer set search_path='' as $$
 select private.project_workflow_record(k,private.workflow_record_before_f05(k,i));
$$;

create function private.expand_leg_assignments(ids jsonb,pid uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;begin
 if jsonb_array_length(ids)<>(select count(distinct value) from jsonb_array_elements_text(ids))
  or exists(select 1 from jsonb_array_elements_text(ids) x where not exists(select 1 from public.plan_leg_assignments where id=x::uuid and plan_id=pid))
 then raise exception 'INVALID_PLAN_REFERENCE' using errcode='PT400';end if;
 select jsonb_agg(id order by id) into result from public.plan_resource_bindings where plan_id=pid and ids ? leg_assignment_id::text;
 return coalesce(result,'[]');
end;$$;

alter function private.command_v2_workflow(uuid,uuid,text,jsonb,uuid,jsonb) rename to command_v2_workflow_before_f05;
create function private.command_v2_workflow(p_organization_id uuid,p_member_id uuid,p_action text,p_context jsonb,p_key uuid,p_value jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v jsonb:=p_value;result jsonb;pid uuid;b uuid;matches integer;begin
 perform private.workflow_member(p_organization_id,p_member_id,false);
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

-- Persist the UML assignment attributes from the immutable binding snapshot.
do $$declare p record;a jsonb;begin
 for p in select id from public.transport_plan_candidates loop
  for a in select value from jsonb_array_elements(private.workflow_record('plans',p.id)#>'{data,legAssignments}') loop
   update public.plan_leg_assignments set data=a-'id'-'resources' where id=(a->>'id')::uuid;
  end loop;
 end loop;
end;$$;

alter table public.transport_plan_candidates add constraint plan_owns_route_unique unique(route_plan_id);

alter function private.workflow_build_plan(uuid,uuid,jsonb,uuid) rename to workflow_build_plan_before_f05;
create function private.workflow_build_plan(o uuid,qid uuid,v jsonb,pid uuid) returns jsonb language plpgsql security definer set search_path='' as $$
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
 perform set_config('cargomesh.f05_groups',meta::text,true);
 perform private.workflow_build_plan_before_f05(o,qid,jsonb_set(jsonb_set(v,'{routeId}',to_jsonb(rid)),'{assignments}',flat),pid);
 perform set_config('cargomesh.f05_groups','',true);
 for a in select value from jsonb_array_elements(private.workflow_record('plans',pid)#>'{data,legAssignments}') loop
  update public.plan_leg_assignments set data=a-'id'-'resources' where id=(a->>'id')::uuid;
 end loop;
 return private.workflow_record('plans',pid);
end;$$;

revoke all on function private.guard_leg_resource_binding(),private.require_leg_resources(),private.guard_reservation_plan_resource(),
 private.clone_plan_route(uuid),private.workflow_build_plan(uuid,uuid,jsonb,uuid),private.workflow_build_plan_before_f05(uuid,uuid,jsonb,uuid),
 private.canonical_assignment_ids(jsonb),private.project_workflow_record(text,jsonb),private.workflow_record(text,uuid),private.workflow_record_before_f05(text,uuid),
 private.expand_leg_assignments(jsonb,uuid),private.command_v2_workflow(uuid,uuid,text,jsonb,uuid,jsonb),
 private.command_v2_workflow_before_f05(uuid,uuid,text,jsonb,uuid,jsonb) from public,anon,authenticated,service_role;

alter function private.workflow_validate(text,jsonb) rename to workflow_validate_before_f05;
create function private.workflow_validate(a text,v jsonb) returns void language plpgsql set search_path='' as $$
declare item jsonb;r jsonb;resources jsonb;s json;begin
 if a='holds.create' then
  if not coalesce(extensions.jsonb_matches_schema('{"type":"object","properties":{"schemaVersion":{"type":"string","const":"2.0"},"bookingId":{"type":"string","format":"uuid"},"assignmentId":{"type":"string","format":"uuid"},"planResourceId":{"type":"string","format":"uuid"},"expiresAt":{"type":"string","format":"date-time"},"consolidationId":{"anyOf":[{"type":"string","format":"uuid"},{"type":"null"}],"default":null},"evidence":{"type":"object","properties":{"reference":{"type":"string","minLength":1,"maxLength":500},"provider":{"type":"string","minLength":1,"maxLength":150},"observedAt":{"type":"string","format":"date-time"},"validUntil":{"anyOf":[{"type":"string","format":"date-time"},{"type":"null"}]},"provenanceStatus":{"type":"string","enum":["VERIFIED","ESTIMATED","SIMULATED","UNKNOWN"]}},"required":["reference","provider","observedAt","validUntil","provenanceStatus"],"additionalProperties":false}},"required":["schemaVersion","bookingId","assignmentId","expiresAt","evidence"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}'::json,v),false) then raise exception 'VALIDATION_ERROR' using errcode='PT400';end if;return;
 end if;
 if a<>'plans.create' then perform private.workflow_validate_before_f05(a,v);return;end if;
 s:='{"type":"object","properties":{"schemaVersion":{"type":"string","const":"2.0"},"routeId":{"type":"string","format":"uuid"},"assignments":{"type":"array","items":{"anyOf":[{"type":"object","properties":{"legSequence":{"type":"integer","exclusiveMinimum":0},"serviceId":{"type":"string","format":"uuid"},"laneId":{"type":"string","format":"uuid"},"window":{"type":"object","properties":{"startsAt":{"type":"string","format":"date-time"},"endsAt":{"type":"string","format":"date-time"}},"required":["startsAt","endsAt"],"additionalProperties":false},"resources":{"type":"array","items":{"type":"object","properties":{"calendarId":{"type":"string","format":"uuid"},"assetId":{"anyOf":[{"type":"string","format":"uuid"},{"type":"null"}]},"capacityPoolId":{"anyOf":[{"type":"string","format":"uuid"},{"type":"null"}]},"combinationId":{"anyOf":[{"type":"string","format":"uuid"},{"type":"null"}]},"role":{"type":"string","enum":["LOAD_BEARING","AUXILIARY"]},"allocations":{"type":"array","items":{"type":"object","properties":{"unitIndex":{"type":"integer","minimum":0},"quantity":{"type":"integer","exclusiveMinimum":0}},"required":["unitIndex","quantity"],"additionalProperties":false},"maxItems":100}},"required":["calendarId","assetId","capacityPoolId","combinationId","role","allocations"],"additionalProperties":false},"minItems":1,"maxItems":100}},"required":["legSequence","serviceId","laneId","window","resources"],"additionalProperties":false},{"type":"object","properties":{"legSequence":{"type":"integer","exclusiveMinimum":0},"serviceId":{"type":"string","format":"uuid"},"laneId":{"type":"string","format":"uuid"},"calendarId":{"type":"string","format":"uuid"},"assetId":{"anyOf":[{"type":"string","format":"uuid"},{"type":"null"}]},"capacityPoolId":{"anyOf":[{"type":"string","format":"uuid"},{"type":"null"}]},"combinationId":{"anyOf":[{"type":"string","format":"uuid"},{"type":"null"}]},"role":{"type":"string","enum":["LOAD_BEARING","AUXILIARY"]},"window":{"type":"object","properties":{"startsAt":{"type":"string","format":"date-time"},"endsAt":{"type":"string","format":"date-time"}},"required":["startsAt","endsAt"],"additionalProperties":false},"allocations":{"type":"array","items":{"type":"object","properties":{"unitIndex":{"type":"integer","minimum":0},"quantity":{"type":"integer","exclusiveMinimum":0}},"required":["unitIndex","quantity"],"additionalProperties":false},"maxItems":100}},"required":["legSequence","serviceId","laneId","calendarId","assetId","capacityPoolId","combinationId","role","window","allocations"],"additionalProperties":false}]},"minItems":1,"maxItems":100}},"required":["schemaVersion","routeId","assignments"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}'::json;
 if not coalesce(extensions.jsonb_matches_schema(s,v),false) then raise exception 'VALIDATION_ERROR' using errcode='PT400';end if;
 for item in select value from jsonb_array_elements(v->'assignments') loop
  resources:=case when item ? 'resources' then item->'resources' else jsonb_build_array(item) end;
  for r in select value from jsonb_array_elements(resources) loop
   if (r->>'assetId' is null)=(r->>'capacityPoolId' is null)
    or r->>'role'='AUXILIARY' and jsonb_array_length(r->'allocations')>0
   then raise exception 'VALIDATION_ERROR' using errcode='PT400';end if;
  end loop;
  if item ? 'resources' and exists(select 1 from jsonb_array_elements(resources) x
   group by coalesce(x->>'assetId',x->>'capacityPoolId') having count(*)>1)
  then raise exception 'DUPLICATE_PLAN_RESOURCE' using errcode='PT400';end if;
 end loop;
end;$$;
revoke all on function private.workflow_validate(text,jsonb),private.workflow_validate_before_f05(text,jsonb) from public,anon,authenticated,service_role;

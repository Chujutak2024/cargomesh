-- HAC-50: persistent owner-scoped preparations and native offer request-revision guard.
-- No fixtures. Does not replace Client workflow functions or create capacity commitments.
create table private.v2_offer_preparations (
 id uuid primary key default pg_catalog.gen_random_uuid(),
 carrier_id uuid not null references public.carriers(id),
 operator_id uuid not null, user_id uuid not null references auth.users(id),
 opportunity_id uuid not null references public.carrier_opportunities(id),
 supersedes_offer_id uuid references public.v2_carrier_offers(id),
 organization_id uuid not null references public.organizations(id),
 freight_request_id uuid not null references public.freight_requests(id),
 version integer not null check(version>0), value jsonb not null check(jsonb_typeof(value)='object' and octet_length(value::text)<=524288),
 updated_at timestamptz not null default now(),
 foreign key(operator_id,carrier_id) references public.carrier_operators(id,carrier_id)
);
create unique index v2_offer_preparations_scope_idx on private.v2_offer_preparations
 (carrier_id,operator_id,user_id,opportunity_id,coalesce(supersedes_offer_id,'00000000-0000-0000-0000-000000000000'::uuid));
create index v2_offer_preparations_user_idx on private.v2_offer_preparations(user_id,carrier_id,operator_id);
create index v2_offer_preparations_opportunity_idx on private.v2_offer_preparations(opportunity_id);
create index v2_offer_preparations_supersedes_idx on private.v2_offer_preparations(supersedes_offer_id);
create index v2_offer_preparations_organization_idx on private.v2_offer_preparations(organization_id);
create index v2_offer_preparations_request_idx on private.v2_offer_preparations(freight_request_id);
alter table private.v2_offer_preparations enable row level security;
-- Defense in depth. Clients receive no table grants; all access is through the guarded RPC.
create policy preparation_owner on private.v2_offer_preparations to authenticated
 using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));

create table private.v2_offer_preparation_revisions (
 preparation_id uuid not null references private.v2_offer_preparations(id),version integer not null check(version>0),
 user_id uuid not null references auth.users(id),value jsonb not null,recorded_at timestamptz not null default now(),
 primary key(preparation_id,version)
);
create index v2_offer_preparation_revisions_user_idx on private.v2_offer_preparation_revisions(user_id);
alter table private.v2_offer_preparation_revisions enable row level security;
create policy preparation_revision_owner on private.v2_offer_preparation_revisions to authenticated
 using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create table private.v2_offer_preparation_receipts (
 carrier_id uuid not null references public.carriers(id),operator_id uuid not null,user_id uuid not null references auth.users(id),
 idempotency_key uuid not null,payload_hash text not null check(payload_hash~'^[0-9a-f]{64}$'),result jsonb not null,
 created_at timestamptz not null default now(),primary key(carrier_id,operator_id,user_id,idempotency_key),
 foreign key(operator_id,carrier_id) references public.carrier_operators(id,carrier_id)
);
create index v2_offer_preparation_receipts_user_idx on private.v2_offer_preparation_receipts(user_id);
alter table private.v2_offer_preparation_receipts enable row level security;
create policy preparation_receipt_owner on private.v2_offer_preparation_receipts to authenticated
 using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
revoke all on private.v2_offer_preparations,private.v2_offer_preparation_revisions,private.v2_offer_preparation_receipts from public,anon,authenticated,service_role;

create function private.offer_preparation_record(r private.v2_offer_preparations) returns jsonb
 language sql immutable security invoker set search_path='' as $$
 select jsonb_build_object('id',r.id,'carrierId',r.carrier_id,'operatorId',r.operator_id,'userId',r.user_id,
 'organizationId',r.organization_id,'requestId',r.freight_request_id,'version',r.version,'updatedAt',r.updated_at,'value',r.value);
$$;
create function private.valid_offer_preparation_value(v jsonb) returns boolean language sql immutable security invoker set search_path='' as $$
 select coalesce(extensions.jsonb_matches_schema('{"type":"object","properties":{"schemaVersion":{"const":"2.0"},"opportunityId":{"type":"string","format":"uuid"},"assignmentIds":{"type":"array","items":{"type":"string","format":"uuid"},"maxItems":100,"uniqueItems":true},"supersedesOfferId":{"anyOf":[{"type":"string","format":"uuid"},{"type":"null"}]},"fields":{"type":"object","properties":{"price":{"type":"string","maxLength":100},"validFrom":{"type":"string","maxLength":100},"validUntil":{"type":"string","maxLength":100},"estimatedPickupAt":{"type":"string","maxLength":100},"estimatedDeliveryAt":{"type":"string","maxLength":100},"transitDurationSeconds":{"type":"string","maxLength":100},"capacityWeight":{"type":"string","maxLength":100},"capacityVolume":{"type":"string","maxLength":100},"carrierReference":{"type":"string","maxLength":200},"source":{"type":"object","properties":{"reference":{"type":"string","maxLength":500},"provider":{"type":"string","maxLength":150},"observedAt":{"type":"string","maxLength":100},"validUntil":{"type":"string","maxLength":100},"provenanceStatus":{"enum":["VERIFIED","ESTIMATED","SIMULATED","UNKNOWN"]}},"required":["reference","provider","observedAt","validUntil","provenanceStatus"],"additionalProperties":false},"evidence":{"type":"array","items":{"type":"object","properties":{"reference":{"type":"string","maxLength":500},"provider":{"type":"string","maxLength":150},"observedAt":{"type":"string","maxLength":100},"validUntil":{"type":"string","maxLength":100},"provenanceStatus":{"enum":["VERIFIED","ESTIMATED","SIMULATED","UNKNOWN"]}},"required":["reference","provider","observedAt","validUntil","provenanceStatus"],"additionalProperties":false},"maxItems":100},"breakdown":{"type":"array","items":{"type":"object","properties":{"kind":{"enum":["TRANSPORT","FUEL","TOLL","HANDLING","SPECIAL_EQUIPMENT","BORDER","TAX","DISCOUNT","OTHER"]},"treatment":{"enum":["INCLUDED","QUOTED","ESTIMATED","EXCLUDED","UNKNOWN"]},"amount":{"type":"string","maxLength":100},"observedAt":{"type":"string","maxLength":100},"details":{"type":"string","maxLength":1000},"source":{"type":"object","properties":{"reference":{"type":"string","maxLength":500},"provider":{"type":"string","maxLength":150},"observedAt":{"type":"string","maxLength":100},"validUntil":{"type":"string","maxLength":100},"provenanceStatus":{"enum":["VERIFIED","ESTIMATED","SIMULATED","UNKNOWN"]}},"required":["reference","provider","observedAt","validUntil","provenanceStatus"],"additionalProperties":false}},"required":["kind","treatment","amount","observedAt","details","source"],"additionalProperties":false},"maxItems":100},"commercialTerms":{"type":"array","items":{"type":"object","properties":{"code":{"type":"string","maxLength":2000},"description":{"type":"string","maxLength":2000}},"required":["code","description"],"additionalProperties":false},"maxItems":100}},"required":["price","validFrom","validUntil","estimatedPickupAt","estimatedDeliveryAt","transitDurationSeconds","capacityWeight","capacityVolume","carrierReference","source","evidence","breakdown","commercialTerms"],"additionalProperties":false},"requestVersion":{"type":["integer","null"],"minimum":1}},"required":["schemaVersion","opportunityId","assignmentIds","supersedesOfferId","fields"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}'::json,v),false);
$$;

create function private.offer_preparations_v2(p_carrier_id uuid,p_operator_id uuid,p_action text,
 p_limit integer,p_offset integer,p_key uuid,p_hash text,p_expected_version integer,p_value jsonb) returns jsonb
 language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();r private.v2_offer_preparations;receipt private.v2_offer_preparation_receipts;
 opp public.carrier_opportunities;plan public.transport_plan_candidates;previous public.v2_carrier_offers;replacement uuid;h text;result jsonb;operator_role text;
begin
 if u is null or p_operator_id is distinct from private.identity_carrier(p_carrier_id) then
  raise exception 'FORBIDDEN_CARRIER_IDENTITY' using errcode='PT403';end if;
 select role into operator_role from public.carrier_operators where id=p_operator_id and carrier_id=p_carrier_id and auth_user_id=u;
 if operator_role is null then raise exception 'FORBIDDEN_CARRIER_IDENTITY' using errcode='PT403';end if;
 if p_action='list' then
  if p_limit is null or p_limit not between 1 and 100 or p_offset is null or p_offset<0 then raise exception 'VALIDATION_ERROR' using errcode='PT400';end if;
  select coalesce(jsonb_agg(item.record order by item.updated_at desc,item.id),'[]'::jsonb) into result from
   (select private.offer_preparation_record(d) record,d.updated_at,d.id from private.v2_offer_preparations d
    where d.carrier_id=p_carrier_id and d.operator_id=p_operator_id and d.user_id=u
    order by d.updated_at desc,d.id limit p_limit offset p_offset) item;
  return result;
 end if;
 if p_action is distinct from 'save' then raise exception 'VALIDATION_ERROR' using errcode='PT400';end if;
 if operator_role not in ('ADMIN','OPERATOR') then raise exception 'FORBIDDEN_CARRIER_ROLE' using errcode='PT403';end if;
 if p_key is null or p_hash is null or p_hash!~'^[0-9a-f]{64}$' or p_expected_version is null or p_expected_version<0
  or p_value is null or not private.valid_offer_preparation_value(p_value) or octet_length(p_value::text)>524288 then
  raise exception 'VALIDATION_ERROR' using errcode='PT400';end if;
 -- Compute the receipt hash again in PostgreSQL; do not trust a caller-provided digest.
 h:=encode(extensions.digest(jsonb_build_object('expectedVersion',p_expected_version,'value',p_value)::text,'sha256'),'hex');
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('offer-preparation-key:'||p_carrier_id||p_operator_id||u||p_key,0));
 select * into receipt from private.v2_offer_preparation_receipts where carrier_id=p_carrier_id and operator_id=p_operator_id and user_id=u and idempotency_key=p_key;
 if receipt.idempotency_key is not null then
  if receipt.payload_hash<>h then raise exception 'IDEMPOTENCY_CONFLICT' using errcode='PT409';end if;
  return jsonb_build_object('record',receipt.result,'replay',true);
 end if;
 select * into opp from public.carrier_opportunities where id=(p_value->>'opportunityId')::uuid and carrier_id=p_carrier_id for share;
 if opp.id is null then raise exception 'WORKFLOW_NOT_FOUND' using errcode='PT404';end if;
 select * into plan from public.transport_plan_candidates where id=opp.parent_id and freight_request_id=opp.freight_request_id and organization_id=opp.organization_id for share;
 if plan.id is null then raise exception 'INVALID_PREPARATION_REFERENCES' using errcode='PT400';end if;
 if p_value->>'requestVersion' is not null and (p_value->>'requestVersion')::integer is distinct from plan.request_version then
  raise exception 'STALE_REQUEST' using errcode='PT409';end if;
 -- Incomplete preparations may be retained after closure, bound to their original plan revision.
 p_value:=jsonb_set(p_value,'{requestVersion}',to_jsonb(plan.request_version));
 if not ((p_value->'assignmentIds') <@ private.canonical_assignment_ids(opp.data->'assignmentIds')) then raise exception 'INVALID_PREPARATION_REFERENCES' using errcode='PT400';end if;
 replacement:=(p_value->>'supersedesOfferId')::uuid;
 if replacement is not null then
  select * into previous from public.v2_carrier_offers where id=replacement and carrier_id=p_carrier_id and parent_id=opp.id;
  if previous.id is null or previous.plan_id<>opp.parent_id or previous.organization_id<>opp.organization_id or previous.freight_request_id<>opp.freight_request_id then
   raise exception 'INVALID_PREPARATION_REFERENCES' using errcode='PT400';end if;
 end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('offer-preparation-scope:'||p_carrier_id||p_operator_id||u||opp.id||coalesce(replacement::text,'new'),0));
 select * into r from private.v2_offer_preparations where carrier_id=p_carrier_id and operator_id=p_operator_id and user_id=u
  and opportunity_id=opp.id and supersedes_offer_id is not distinct from replacement for update;
 if coalesce(r.version,0)<>p_expected_version then raise exception 'STALE_PREPARATION' using errcode='PT409';end if;
 if r.id is null then
  insert into private.v2_offer_preparations(carrier_id,operator_id,user_id,opportunity_id,supersedes_offer_id,organization_id,freight_request_id,version,value)
   values(p_carrier_id,p_operator_id,u,opp.id,replacement,opp.organization_id,opp.freight_request_id,1,p_value) returning * into r;
 else
  update private.v2_offer_preparations set value=p_value,version=version+1,updated_at=now() where id=r.id returning * into r;
 end if;
 insert into private.v2_offer_preparation_revisions(preparation_id,version,user_id,value) values(r.id,r.version,u,r.value);
 result:=private.offer_preparation_record(r);
 insert into private.v2_offer_preparation_receipts(carrier_id,operator_id,user_id,idempotency_key,payload_hash,result) values(p_carrier_id,p_operator_id,u,p_key,h,result);
 return jsonb_build_object('record',result,'replay',false);
end;$$;
-- The privileged implementation is private. The public RPC is a narrow invoker wrapper.
create function public.offer_preparations_v2(p_carrier_id uuid,p_operator_id uuid,p_action text,
 p_limit integer,p_offset integer,p_key uuid,p_hash text,p_expected_version integer,p_value jsonb) returns jsonb
 language sql security invoker set search_path='' as $$
 select private.offer_preparations_v2(p_carrier_id,p_operator_id,p_action,p_limit,p_offset,p_key,p_hash,p_expected_version,p_value);
$$;
revoke all on function private.offer_preparation_record(private.v2_offer_preparations),private.valid_offer_preparation_value(jsonb),
 private.offer_preparations_v2(uuid,uuid,text,integer,integer,uuid,text,integer,jsonb),
 public.offer_preparations_v2(uuid,uuid,text,integer,integer,uuid,text,integer,jsonb) from public,anon,authenticated,service_role;
grant usage on schema private to authenticated;
grant execute on function private.offer_preparations_v2(uuid,uuid,text,integer,integer,uuid,text,integer,jsonb),
 public.offer_preparations_v2(uuid,uuid,text,integer,integer,uuid,text,integer,jsonb) to authenticated;

-- Bind an issued offer to the request revision evaluated by its immutable plan.
-- This supplements native issuer/assignment/receipt guards; it does not replace workflow_offer.
create function private.guard_offer_request_revision() returns trigger
language plpgsql security definer set search_path='' as $$
declare q public.freight_requests;p public.transport_plan_candidates;opp public.carrier_opportunities;begin
 if tg_op='UPDATE' then
  if new.data->'requestVersion' is distinct from old.data->'requestVersion'
   or new.data->'requestCode' is distinct from old.data->'requestCode' then
   raise exception 'IMMUTABLE_OFFER_REQUEST' using errcode='PT400';end if;
  return new;
 end if;
 select * into q from public.freight_requests
  where id=new.freight_request_id and organization_id=new.organization_id for share;
 select * into p from public.transport_plan_candidates
  where id=new.plan_id and freight_request_id=q.id and organization_id=q.organization_id for share;
 select * into opp from public.carrier_opportunities
  where id=new.parent_id and carrier_id=new.carrier_id and freight_request_id=q.id
   and organization_id=q.organization_id and parent_id=p.id for share;
 if q.id is null or p.id is null or opp.id is null
  or (new.data->>'planCandidateId')::uuid is distinct from p.id
  or (new.data->>'opportunityId')::uuid is distinct from opp.id then
  raise exception 'OFFER_CONTEXT_MISMATCH' using errcode='PT400';end if;
 if q.status<>'PENDING' or p.request_version is distinct from q.draft_version
  or coalesce((opp.data#>>'{requestBrief,requestVersion}')::integer,p.request_version) is distinct from q.draft_version then
  raise exception 'STALE_REQUEST' using errcode='PT409';end if;
 if p.status='ineligible' then raise exception 'INELIGIBLE_PLAN' using errcode='PT409';end if;
 new.data:=new.data||jsonb_build_object('requestVersion',q.draft_version,'requestCode',q.code);
 return new;
end;$$;
create trigger offer_request_revision_guard before insert or update on public.v2_carrier_offers
for each row execute function private.guard_offer_request_revision();
revoke all on function private.guard_offer_request_revision() from public,anon,authenticated,service_role;

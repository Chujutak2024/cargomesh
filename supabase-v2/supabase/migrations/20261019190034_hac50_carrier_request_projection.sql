-- HAC-50: minimum opportunity projection. Does not replace workflow_record (C6/Jean).
-- Native actor, role, receipt and mutation functions remain the authority.
create function private.carrier_request_brief(q public.freight_requests) returns jsonb
language sql security definer set search_path='' as $$
 select jsonb_build_object('schemaVersion','1.0','requestId',q.id,'requestCode',q.code,
  'requestVersion',q.draft_version,'customerRef',q.organization_id,
  'pickupWindow',q.v2_snapshot->'pickupWindow','deliveryWindow',q.v2_snapshot->'deliveryWindow',
  'acceptedModes',q.v2_snapshot->'acceptedModes','requiredEquipment',q.v2_snapshot->'requiredEquipment',
  'preferredEquipment',q.v2_snapshot->'preferredEquipment',
  'contactsVisibility','WITHHELD','locationPrecision','CITY');
$$;

create function private.carrier_opportunity_request_guard() returns trigger
language plpgsql security definer set search_path='' as $$
declare q public.freight_requests; p public.transport_plan_candidates;begin
 select * into q from public.freight_requests where id=new.freight_request_id and organization_id=new.organization_id for share;
 select * into p from public.transport_plan_candidates where id=new.parent_id and freight_request_id=q.id and organization_id=q.organization_id;
 if q.id is null or p.id is null then raise exception 'OPPORTUNITY_REQUEST_MISMATCH' using errcode='PT400';end if;
 if tg_op='INSERT' then
  if p.status='ineligible' then raise exception 'INELIGIBLE_PLAN' using errcode='PT409';end if;
  if p.request_version<>q.draft_version then raise exception 'STALE_REQUEST' using errcode='PT409';end if;
  new.data:=new.data||jsonb_build_object('requestBrief',private.carrier_request_brief(q));
 elsif new.data->'requestBrief' is distinct from old.data->'requestBrief' then
  raise exception 'IMMUTABLE_REQUEST_BRIEF' using errcode='PT400';
 end if;
 if tg_op='UPDATE' and new.status='ACCEPTED' and
  (p.request_version<>q.draft_version or coalesce((new.data#>>'{requestBrief,requestVersion}')::integer,p.request_version)<>q.draft_version or q.status<>'PENDING' or p.status='ineligible') then
  raise exception 'STALE_REQUEST' using errcode='PT409';
 end if;
 return new;
end;$$;
create trigger carrier_opportunity_request_guard before insert or update on public.carrier_opportunities
for each row execute function private.carrier_opportunity_request_guard();

create function private.carrier_opportunity_projection(r jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare d jsonb:=r->'data'; brief jsonb; q public.freight_requests; p public.transport_plan_candidates;
 origin jsonb;destination jsonb;assignments jsonb; current_revision boolean;begin
 if r->>'kind'<>'opportunities' then return r;end if;
 select * into q from public.freight_requests where id=(r->>'requestId')::uuid and organization_id=(r->>'organizationId')::uuid;
 select * into p from public.transport_plan_candidates where id=(d->>'planId')::uuid and freight_request_id=q.id and organization_id=q.organization_id;
 current_revision:=coalesce(p.request_version=q.draft_version and coalesce((d#>>'{requestBrief,requestVersion}')::integer,p.request_version)=q.draft_version,false);
 -- Legacy invitations can only recover windows when their evaluated revision is current.
 brief:=case when d#>>'{requestBrief,schemaVersion}'='1.0' then d->'requestBrief'
  when current_revision then private.carrier_request_brief(q)
  else jsonb_build_object('schemaVersion','1.0','requestId',r->'requestId','requestCode',q.code,
   'requestVersion',p.request_version,'customerRef',r->'organizationId','pickupWindow',null,'deliveryWindow',null,
   'acceptedModes',null,'requiredEquipment',null,'preferredEquipment',null,
   'contactsVisibility','WITHHELD','locationPrecision','CITY') end;
 brief:=brief||jsonb_build_object('currentRequestVersion',q.draft_version,'isCurrent',current_revision,
  'canReview',current_revision and q.status='PENDING' and p.status<>'ineligible','requestStatus',q.status,
  'planEligibility',p.status,'pendingRequirements',coalesce(p.data->'pendingRequirements','[]'::jsonb),
  'exclusionReasons',coalesce(p.data->'exclusionReasons','[]'::jsonb));
 -- Reconstruct canonical coarse locations. Never copy an address, Facility ID or coordinates.
 origin:=jsonb_build_object('facilityId',null,'label',d#>>'{origin,city}','city',d#>>'{origin,city}',
  'countryCode',d#>>'{origin,countryCode}','region',d#>'{origin,region}','lat',null,'lng',null);
 destination:=jsonb_build_object('facilityId',null,'label',d#>>'{destination,city}','city',d#>>'{destination,city}',
  'countryCode',d#>>'{destination,countryCode}','region',d#>'{destination,region}','lat',null,'lng',null);
 select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id',s->'id','serviceId',s->'serviceId',
  'legAssignmentId',s->'legAssignmentId','window',s->'window'))),'[]'::jsonb) into assignments
 from jsonb_array_elements(coalesce(d->'assignmentSnapshots','[]'::jsonb)) s;
 -- Explicit allowlist: request contacts, documents and opaque resource snapshots are withheld.
 d:=jsonb_build_object('schemaVersion',d->'schemaVersion','planId',d->'planId','carrierId',r->'carrierId',
  'assignmentIds',d->'assignmentIds','responseDeadline',d->'responseDeadline','responseChannel',d->'responseChannel',
  'sentAt',d->'sentAt','origin',origin,'destination',destination,'assignmentSnapshots',assignments,
  'cargoSpecification',(d->'cargoSpecification')-'availableDocuments',
  'pickupWindow',brief->'pickupWindow','deliveryWindow',brief->'deliveryWindow','requestBrief',brief)
  ||(select coalesce(jsonb_object_agg(key,value),'{}'::jsonb) from jsonb_each(r->'data')
     where key in ('response','responseNote','responseEvidence','respondedAt','respondedBy'));
 return jsonb_set(r,'{data}',d);
end;$$;

create or replace function public.read_v2_carrier_workflow(p_operator_id uuid,p_kind text,p_context jsonb,p_limit integer,p_offset integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c uuid:=(p_context->>'carrierId')::uuid;rows jsonb;begin
 if p_operator_id is distinct from private.identity_carrier(c) then raise exception 'FORBIDDEN_CARRIER_IDENTITY' using errcode='PT403';end if;
 if p_kind not in ('opportunities','offers','bookings','executions','incidents','incident-updates',
  'execution-events','holds','consolidations','asset-events','limits','metrics') or p_context->>'requestId' is not null then
  raise exception 'FORBIDDEN_WORKFLOW' using errcode='PT403';end if;
 rows:=private.read_v2_workflow(null,p_operator_id,p_kind,p_context,p_limit,p_offset);
 if p_kind='opportunities' then
  select coalesce(jsonb_agg(private.carrier_opportunity_projection(value) order by ordinal),'[]'::jsonb)
   into rows from jsonb_array_elements(rows) with ordinality as x(value,ordinal);
 end if;
 return rows;
end;$$;

create or replace function public.command_v2_carrier_workflow(p_operator_id uuid,p_action text,p_context jsonb,p_key uuid,p_value jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c uuid:=(p_context->>'carrierId')::uuid;role text;result jsonb;begin
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
 result:=private.command_v2_workflow(null,p_operator_id,p_action,p_context,p_key,p_value);
 if p_action='opportunities.respond' then
  result:=jsonb_set(result,'{record}',private.carrier_opportunity_projection(result->'record'));
 end if;
 return result;
end;$$;
revoke all on function private.carrier_request_brief(public.freight_requests),
 private.carrier_opportunity_request_guard(),private.carrier_opportunity_projection(jsonb)
 from public,anon,authenticated,service_role;
revoke all on function public.read_v2_carrier_workflow(uuid,text,jsonb,integer,integer),
 public.command_v2_carrier_workflow(uuid,text,jsonb,uuid,jsonb) from public,anon,service_role;
grant execute on function public.read_v2_carrier_workflow(uuid,text,jsonb,integer,integer),
 public.command_v2_carrier_workflow(uuid,text,jsonb,uuid,jsonb) to authenticated;

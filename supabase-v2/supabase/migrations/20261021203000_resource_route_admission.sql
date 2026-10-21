-- A-12: explicit resource/corridor admission on existing versioned limits; no seeds.
begin;
create function private.valid_route_admission(v jsonb) returns boolean language plpgsql immutable set search_path='' as $$begin
 if not (v ? 'admission') then return true;end if;
 if jsonb_typeof(v->'admission') is distinct from 'object' then return false;end if;
 return coalesce(v#>>'{admission,decision}' in('ALLOWED','DENIED','UNKNOWN')
 and v#>>'{admission,reasonCode}' ~ '^[A-Z][A-Z0-9_]{0,79}$'
 and (select count(*) from jsonb_object_keys(v->'admission'))=2
 and jsonb_typeof(v->'compatibilityConfirmed')='boolean'
 and (v->>'compatibilityConfirmed')::boolean=((v#>>'{admission,decision}')='ALLOWED'),false);
exception when data_exception then return false;end;$$;
alter table public.route_resource_limits add constraint resource_route_admission_valid check(private.valid_route_admission(data));
-- Existing RLS, source references, version checks, receipt hashes and locks remain authoritative.
alter function private.workflow_validate(text,jsonb) rename to workflow_validate_before_admission;
create function private.workflow_validate(a text,v jsonb) returns void language plpgsql set search_path='' as $$begin
 if a='limits.publish' and v ? 'admission' then
  if not private.valid_route_admission(v) then raise exception 'INVALID_ROUTE_ADMISSION' using errcode='PT400';end if;
  perform private.workflow_validate_before_admission(a,v-'admission');
 else perform private.workflow_validate_before_admission(a,v);end if;
end;$$;
create function private.assess_route_admission(v jsonb,s timestamptz,t timestamptz) returns jsonb language plpgsql stable set search_path='' as $$
declare e jsonb:=v->'source';decision text;begin
 if v is null or s is null or t is null or s>=t or not private.valid_route_admission(v)
  or e->>'reference' is null or e->>'provider' is null or e->>'provenanceStatus' not in('VERIFIED','SIMULATED')
  or (e->>'observedAt')::timestamptz>now() or (e->>'observedAt')::timestamptz>s or e->>'validUntil' is null
 then return jsonb_build_object('state','UNKNOWN','reasonCode','ROUTE_ADMISSION_UNKNOWN');end if;
 if (e->>'validUntil')::timestamptz<=now() or (e->>'validUntil')::timestamptz<t then
  return jsonb_build_object('state','EXPIRED','reasonCode','ROUTE_ADMISSION_EXPIRED');end if;
 if not coalesce(private.workflow_evidence(e,s,t),false) then return jsonb_build_object('state','UNKNOWN','reasonCode','ROUTE_ADMISSION_UNKNOWN');end if;
 decision:=coalesce(v#>>'{admission,decision}',case when (v->>'compatibilityConfirmed')::boolean then 'ALLOWED' else 'UNKNOWN' end);
 return jsonb_build_object('state',decision,'reasonCode','ROUTE_ADMISSION_'||decision);
exception when data_exception then return jsonb_build_object('state','UNKNOWN','reasonCode','ROUTE_ADMISSION_UNKNOWN');end;$$;
create function private.resource_route_admission(service uuid,corridor uuid,asset uuid,combination uuid,s timestamptz,t timestamptz) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v jsonb;begin
 select rr.data into v from public.route_resource_limits rr where rr.carrier_service_id=service and rr.corridor_id=corridor and rr.status='ACTIVE'
 and (combination is null and rr.asset_id=asset and rr.combination_id is null or combination is not null and rr.combination_id=combination)
 order by rr.created_at desc,rr.id limit 1;
 return private.assess_route_admission(v,s,t);
end;$$;
-- Scoped, read-only generation receives evidence, not a hardcoded vehicle class or price.
create function public.read_v2_dispatch_options_with_admission(p_organization_id uuid,p_member_id uuid,p_request_id uuid,p_expected_version integer) returns jsonb
language plpgsql security definer set search_path='' as $$declare options jsonb;result jsonb;begin
 options:=public.read_v2_dispatch_options(p_organization_id,p_member_id,p_request_id,p_expected_version);
 select coalesce(jsonb_agg(o.value||jsonb_build_object('admissions',coalesce((select jsonb_agg(jsonb_build_object(
 'assetId',rr.asset_id,'limitId',rr.id,'version',rr.version,'compatibilityConfirmed',coalesce((rr.data->>'compatibilityConfirmed')::boolean,false),
 'admission',rr.data->'admission','source',rr.data->'source') order by rr.asset_id) from
 (select distinct on(l.asset_id) l.* from public.route_resource_limits l where l.carrier_service_id=(o.value->>'serviceId')::uuid
 and l.corridor_id=(o.value->>'routeId')::uuid and l.status='ACTIVE' and l.asset_id is not null and l.combination_id is null
 order by l.asset_id,l.created_at desc,l.id) rr),'[]'::jsonb)) order by o.ord),'[]'::jsonb) into result
 from jsonb_array_elements(options) with ordinality o(value,ord);return result;
end;$$;
revoke all on function public.read_v2_dispatch_options_with_admission(uuid,uuid,uuid,integer) from public,anon,service_role;
grant execute on function public.read_v2_dispatch_options_with_admission(uuid,uuid,uuid,integer) to authenticated;

-- The same evaluator is called when creating a plan, emitting offers, acquiring holds and confirming booking.
alter function private.workflow_evaluate_plan(uuid) rename to workflow_evaluate_plan_before_admission;
create function private.workflow_evaluate_plan(pid uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;a record;assessment jsonb;assessments jsonb:='[]';item jsonb;begin
 result:=private.workflow_evaluate_plan_before_admission(pid);
 for a in select aa.id,aa.carrier_service_id,aa.starts_at,aa.ends_at,pr.asset_id,pr.combination_id,rl.corridor_id
 from public.plan_resource_bindings aa join public.plan_resources pr on pr.id=aa.resource_id join public.route_legs rl on rl.id=aa.route_leg_id
 where aa.plan_id=pid and pr.asset_id is not null and pr.data->>'role'='LOAD_BEARING' order by aa.id loop
  assessment:=private.resource_route_admission(a.carrier_service_id,a.corridor_id,a.asset_id,a.combination_id,a.starts_at,a.ends_at);
  if assessment->>'state'='DENIED' then result:=result||jsonb_build_object('eligibility','ineligible','provenance','UNKNOWN',
   'exclusionReasons',(result->'exclusionReasons')||jsonb_build_array('ROUTE_ADMISSION_DENIED'));
  elsif assessment->>'state'<>'ALLOWED' then result:=result||jsonb_build_object('eligibility',case when result->>'eligibility'='ineligible' then 'ineligible' else 'unknown' end,'provenance','UNKNOWN',
   'pendingRequirements',(result->'pendingRequirements')||jsonb_build_array(assessment->>'reasonCode'));end if;
  for item in select value from jsonb_array_elements(result->'resourceAssessments') loop
   if item->>'assignmentId'=a.id::text then item:=jsonb_set(item,'{admission}',assessment);end if;
   assessments:=assessments||jsonb_build_array(item);
  end loop;
  result:=jsonb_set(result,'{resourceAssessments}',assessments);assessments:='[]';
 end loop;return result;
end;$$;

-- Prevent cost preview from treating a denied/expired resource as a ready commercial candidate.
alter function public.preview_v2_dispatch_costs(uuid,uuid,uuid,integer,jsonb) rename to preview_v2_dispatch_costs_before_admission;
create function public.preview_v2_dispatch_costs(p_organization_id uuid,p_member_id uuid,p_request_id uuid,p_expected_version integer,p_candidates jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$declare c jsonb;x jsonb;resources jsonb;assessment jsonb;result jsonb:='[]';one jsonb;reason text;idx int:=0;begin
 perform public.preview_v2_dispatch_costs_before_admission(p_organization_id,p_member_id,p_request_id,p_expected_version,'[]'::jsonb);
 if p_candidates is null or jsonb_typeof(p_candidates)<>'array' or jsonb_array_length(p_candidates)>128 then raise exception 'DISPATCH_COST_SEARCH_LIMIT' using errcode='PT400';end if;
 for c in select value from jsonb_array_elements(p_candidates) loop
  begin
   -- Validate existing candidate/request/policy scope before consulting admission.
   -- No private rates are returned by the base preview; a rejected scope remains rejected.
   one:=public.preview_v2_dispatch_costs_before_admission(p_organization_id,p_member_id,p_request_id,p_expected_version,jsonb_build_array(c))->0;
   if one->>'status'='READY' then
   resources:=coalesce(c->'resources',jsonb_build_array(jsonb_build_object('assetId',c->'assetId')));
   for x in select value from jsonb_array_elements(resources) loop
    assessment:=private.resource_route_admission((c->>'serviceId')::uuid,(c#>>'{schedule,routeId}')::uuid,(x->>'assetId')::uuid,null,
     (c#>>'{schedule,operationWindow,startsAt}')::timestamptz,(c#>>'{schedule,operationWindow,endsAt}')::timestamptz);
    if assessment->>'state'<>'ALLOWED' then raise exception '%',assessment->>'reasonCode' using errcode='PT422';end if;
   end loop;
   end if;
   one:=jsonb_set(one,'{index}',to_jsonb(idx));
  exception when sqlstate 'PT422' or data_exception then get stacked diagnostics reason=message_text;
   one:=jsonb_build_object('index',idx,'status','REQUIRES_REVIEW','totalCents',null,'reason',reason);
  end;
  result:=result||jsonb_build_array(one);idx:=idx+1;
 end loop;return result;
end;$$;
revoke all on function public.preview_v2_dispatch_costs_before_admission(uuid,uuid,uuid,integer,jsonb) from public,anon,authenticated,service_role;
revoke all on function public.preview_v2_dispatch_costs(uuid,uuid,uuid,integer,jsonb) from public,anon,service_role;
grant execute on function public.preview_v2_dispatch_costs(uuid,uuid,uuid,integer,jsonb) to authenticated;
revoke all on function private.valid_route_admission(jsonb),private.workflow_validate_before_admission(text,jsonb),private.workflow_validate(text,jsonb),
 private.assess_route_admission(jsonb,timestamptz,timestamptz),private.resource_route_admission(uuid,uuid,uuid,uuid,timestamptz,timestamptz),
 private.workflow_evaluate_plan_before_admission(uuid),private.workflow_evaluate_plan(uuid) from public,anon,authenticated,service_role;
commit;

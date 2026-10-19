-- HAC-50. Read projection only; no grants, business mutations or synthetic rows.
begin;
create or replace function private.workflow_record(k text,i uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r jsonb; g jsonb; groups jsonb:='[]';begin
 r:=private.workflow_record_before_model_associations(k,i);
 if k='plans' then
  for g in select value from jsonb_array_elements(r#>'{data,legAssignments}') loop
   groups:=groups||jsonb_build_array(g||jsonb_build_object('fulfilmentPartnerId',
    (select fulfilment_partner_id from public.plan_leg_assignments where id=(g->>'id')::uuid)));
  end loop;
  r:=jsonb_set(r,'{data,legAssignments}',groups);
 elsif k='opportunities' then
  -- Retain the resource snapshot and attach its factual grouped-leg reference.
  r:=jsonb_set(r,'{data,assignmentSnapshots}',coalesce((select jsonb_agg(s.value||
   case when b.leg_assignment_id is not null then jsonb_build_object('legAssignmentId',b.leg_assignment_id) else '{}'::jsonb end order by s.ordinal)
   from jsonb_array_elements(r#>'{data,assignmentSnapshots}') with ordinality as s(value,ordinal)
   left join public.plan_resource_bindings b on b.id=(s.value->>'id')::uuid
    and b.plan_id=(r#>>'{data,planId}')::uuid),'[]'::jsonb));
 elsif k='bookings' then
  r:=jsonb_set(r,'{data}',(r->'data')||coalesce((select jsonb_build_object('offerId',offer_id,'decisionId',decision_id) from public.v2_bookings where id=i),'{}'::jsonb));
 elsif k='incidents' then
  r:=jsonb_set(r,'{data,routeConditionIds}',coalesce((select jsonb_agg(condition_id order by condition_id)
   from public.incident_route_conditions where incident_id=i),'[]'));
 end if;return r;
end;$$;
revoke all on function private.workflow_record(text,uuid) from public,anon,authenticated,service_role;
notify pgrst,'reload schema';
commit;

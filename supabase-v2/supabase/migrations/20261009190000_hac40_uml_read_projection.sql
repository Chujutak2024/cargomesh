-- UML read closure: expose persistent selection and the ordered waypoint snapshot.
-- Existing commands, actor checks, grants and immutable receipts retain their contracts.
alter function private.project_workflow_record(text,jsonb)
 rename to project_workflow_record_before_uml_read;

create function private.project_workflow_record(k text,result jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare leg jsonb; legs jsonb:='[]'; points jsonb; decision uuid;
begin
 result:=private.project_workflow_record_before_uml_read(k,result);
 if k='bookings' then
  select decision_id into decision from public.v2_bookings where id=(result->>'id')::uuid;
  if decision is not null then
   result:=jsonb_set(result,'{data,decisionId}',to_jsonb(decision));
  end if;
 elsif k='routes' then
  for leg in select value from jsonb_array_elements(result#>'{data,legs}') loop
   -- workflow_route persists WITH ORDINALITY in route_waypoints.sequence.
   -- Project from the immutable snapshot, including historical retry receipts.
   select coalesce(jsonb_agg(value||jsonb_build_object('sequence',ordinality)
     order by ordinality),'[]'::jsonb) into points
    from jsonb_array_elements(leg->'waypoints') with ordinality;
   legs:=legs||jsonb_build_array(jsonb_set(leg,'{waypoints}',points));
  end loop;
  result:=jsonb_set(result,'{data,legs}',legs);
 end if;
 return result;
end;$$;

revoke all on function private.project_workflow_record(text,jsonb),
 private.project_workflow_record_before_uml_read(text,jsonb)
 from public,anon,authenticated,service_role;

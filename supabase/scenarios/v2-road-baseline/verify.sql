\set ON_ERROR_STOP on

do $$
declare
  n integer;
begin
  select count(*) into n from public.organizations
  where (id = 'c2300000-0000-4000-8000-000000000001' and code = 'QA-V2-A')
     or (id = 'c2300000-0000-4000-8000-000000000002' and code = 'QA-V2-B');
  if n <> 2 then raise exception 'V2_QA_VERIFY: expected two distinct organizations'; end if;

  select count(*) into n from auth.users u
  join auth.identities i on i.user_id = u.id and i.id = u.id and i.provider = 'email'
  join public.organization_members m on m.auth_user_id = u.id
  where (u.id = 'c2310000-0000-4000-8000-000000000001'
         and m.id = 'c2320000-0000-4000-8000-000000000001'
         and m.organization_id = 'c2300000-0000-4000-8000-000000000001'
         and u.email = 'qa-v2-a@cargomesh.test')
     or (u.id = 'c2310000-0000-4000-8000-000000000002'
         and m.id = 'c2320000-0000-4000-8000-000000000002'
         and m.organization_id = 'c2300000-0000-4000-8000-000000000002'
         and u.email = 'qa-v2-b@cargomesh.test');
  if n <> 2 then raise exception 'V2_QA_VERIFY: expected two exact Auth identities and memberships'; end if;

  select count(*) into n from public.organization_members
  where id in ('c2320000-0000-4000-8000-000000000001', 'c2320000-0000-4000-8000-000000000002')
    and role = 'SUPERVISOR' and status = 'ACTIVE';
  if n <> 2 then raise exception 'V2_QA_VERIFY: both members must be active supervisors'; end if;

  select count(*) into n from public.facilities
  where (id = 'c2330000-0000-4000-8000-000000000001'
         and organization_id = 'c2300000-0000-4000-8000-000000000001' and city = 'Lima')
     or (id = 'c2330000-0000-4000-8000-000000000002'
         and organization_id = 'c2300000-0000-4000-8000-000000000001' and city = 'Arequipa')
     or (id = 'c2330000-0000-4000-8000-000000000003'
         and organization_id = 'c2300000-0000-4000-8000-000000000001' and city = 'Piura')
     or (id = 'c2330000-0000-4000-8000-000000000004'
         and organization_id = 'c2300000-0000-4000-8000-000000000002' and city = 'Lima');
  if n <> 4 then raise exception 'V2_QA_VERIFY: facility ownership/geography mismatch'; end if;

  select count(*) into n from public.carriers
  where id = 'c2340000-0000-4000-8000-000000000001' and code = 'QA_V2_ROAD' and status = 'ACTIVE';
  if n <> 1 then raise exception 'V2_QA_VERIFY: carrier missing'; end if;

  select count(*) into n from public.carrier_services
  where id = 'c2360000-0000-4000-8000-000000000001'
    and carrier_id = 'c2340000-0000-4000-8000-000000000001'
    and transport_mode = 'ROAD' and active;
  if n <> 1 then raise exception 'V2_QA_VERIFY: ROAD service missing'; end if;

  select count(*) into n from public.carrier_depots
  where id = 'c2350000-0000-4000-8000-000000000001'
    and carrier_id = 'c2340000-0000-4000-8000-000000000001' and city = 'Piura';
  if n <> 1 then raise exception 'V2_QA_VERIFY: uncovered depot missing'; end if;

  select count(*) into n from public.service_areas
  where carrier_service_id = 'c2360000-0000-4000-8000-000000000001'
    and coverage = 'INCLUDE' and active
    and ((id = 'c2370000-0000-4000-8000-000000000001' and area_role = 'PICKUP' and city = 'Lima')
      or (id = 'c2370000-0000-4000-8000-000000000002' and area_role = 'DELIVERY' and city = 'Arequipa')
      or (id = 'c2370000-0000-4000-8000-000000000003' and area_role = 'PICKUP' and city = 'Arequipa')
      or (id = 'c2370000-0000-4000-8000-000000000004' and area_role = 'DELIVERY' and city = 'Lima'));
  if n <> 4 then raise exception 'V2_QA_VERIFY: four directed endpoint areas required'; end if;

  select count(*) into n from public.service_areas
  where carrier_service_id = 'c2360000-0000-4000-8000-000000000001' and city = 'Piura';
  if n <> 0 then raise exception 'V2_QA_VERIFY: Piura must have no service area'; end if;

  select count(*) into n from public.service_lanes
  where id = 'c2380000-0000-4000-8000-000000000001'
    and carrier_service_id = 'c2360000-0000-4000-8000-000000000001'
    and pickup_area_id = 'c2370000-0000-4000-8000-000000000001'
    and delivery_area_id = 'c2370000-0000-4000-8000-000000000002'
    and transport_mode = 'ROAD' and active;
  if n <> 1 then raise exception 'V2_QA_VERIFY: A-to-B lane missing'; end if;

  select count(*) into n from public.service_lanes
  where carrier_service_id = 'c2360000-0000-4000-8000-000000000001';
  if n <> 1 then raise exception 'V2_QA_VERIFY: only A-to-B lane may exist'; end if;

  select count(*) into n from public.service_lanes
  where pickup_area_id = 'c2370000-0000-4000-8000-000000000003'
    and delivery_area_id = 'c2370000-0000-4000-8000-000000000004';
  if n <> 0 then raise exception 'V2_QA_VERIFY: reverse B-to-A lane must be absent'; end if;
end
$$;

select jsonb_build_object(
  'package', 'HAC-23-V2-ROAD-BASELINE',
  'verified', true,
  'organizations', 2,
  'localAuthIdentities', 2,
  'facilities', 4,
  'uncoveredDepot', 1,
  'serviceAreas', 4,
  'directedLanesAtoB', 1,
  'reverseLanesBtoA', 0,
  'piuraServiceAreas', 0
) as v2_road_baseline_verification;

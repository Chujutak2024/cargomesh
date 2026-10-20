-- Synthetic local sites for the native Client -> Carrier demo.
-- Requires v2-client-carrier-access on the existing marked fleet80 database.
-- No schema, authorization, freight request, offer or booking changes.
do $fixture$
declare
  target_org uuid;
begin
  if current_database() <> 'hac50_scenario_fleet80_global_v1'
     or (select shobj_description(oid,'pg_database') from pg_database where datname=current_database())
        is distinct from 'LOCAL_ONLY:v2-carrier-fleet-80' then
    raise exception 'LOCAL_SCENARIO_DATABASE_REQUIRED';
  end if;
  select o.id into strict target_org from public.organizations o
  where o.code='TEST-LINK-client' and o.status='ACTIVE'
    and exists(select 1 from public.organization_members m join auth.users u on u.id=m.auth_user_id
      where m.organization_id=o.id and m.status='ACTIVE' and m.role='SUPERVISOR'
        and u.raw_app_meta_data->>'scenario'='v2-client-carrier-access-20261019'
        and u.raw_app_meta_data->>'test_profile'='client');

  insert into public.facilities(id,organization_id,code,name,facility_type,
    country_code,region_code,city,address_line,latitude,longitude,active,access_restrictions,operating_hours)
  select item.id,target_org,item.code,item.name,item.kind,'PE','LIM','Lima',item.address,
    item.lat,item.lng,true,'[]'::jsonb,null
  from (values
    ('9380fa0e-d7fe-4ff4-8702-10b166912e58'::uuid,'TEST-LINK-PICKUP','[SYNTHETIC] Almacén Lima · Recojo','WAREHOUSE',
      '[SIMULATED] Lima pickup site',-12.04,-77.03),
    ('16650064-6053-43ae-bee2-7574849dd1b1'::uuid,'TEST-LINK-DELIVERY','[SYNTHETIC] Centro Lima · Entrega','DISTRIBUTION_CENTER',
      '[SIMULATED] Lima delivery site',-12.08,-77.04)
  ) as item(id,code,name,kind,address,lat,lng)
  where not exists(select 1 from public.facilities f where f.organization_id=target_org and f.code=item.code)
  on conflict do nothing;

  if (select count(*) from public.facilities where organization_id=target_org and active
      and code in ('TEST-LINK-PICKUP','TEST-LINK-DELIVERY')) <> 2 then
    raise exception 'LOCAL_CLIENT_FACILITIES_NOT_READY';
  end if;
end;
$fixture$;

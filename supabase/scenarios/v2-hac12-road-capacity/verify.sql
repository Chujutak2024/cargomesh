\set ON_ERROR_STOP on
do $$ begin
  if (select count(*) from public.transport_assets
      where id = 'c23d0000-0000-4000-8000-000000000001'
        and equipment_code = 'REEFER_TRUCK' and max_weight_kg = 12000
        and max_volume_m3 = 42) <> 1 then
    raise exception 'HAC12_VERIFY_ASSET';
  end if;
  if (select count(*) from public.asset_cargo_capabilities capability
      join public.cargo_categories category on category.id = capability.cargo_category_id
      where capability.transport_asset_id = 'c23d0000-0000-4000-8000-000000000001'
        and category.code = 'PHARMA'
        and capability.certifications @> '["TEMP_CONTROLLED","SECURITY_SEAL"]'::jsonb
        and capability.temperature_min_c = 2 and capability.temperature_max_c = 8) <> 1 then
    raise exception 'HAC12_VERIFY_CARGO';
  end if;
  if (select count(*) from public.capacity_calendars
      where id = 'c23f0000-0000-4000-8000-000000000001'
        and complete and provenance_status = 'SIMULATED') <> 1 then
    raise exception 'HAC12_VERIFY_CALENDAR';
  end if;
  if (select count(*) from public.capacity_pools
      where id = 'c23e0000-0000-4000-8000-000000000001') <> 1 then
    raise exception 'HAC12_VERIFY_POOL';
  end if;
  if (select count(*) from public.carrier_service_cargo_categories
      where carrier_service_id in (
        'c2360000-0000-4000-8000-000000000001',
        'c23a0000-0000-4000-8000-000000000001'
      ) and cargo_category_id = (select id from public.cargo_categories where code = 'PHARMA')) <> 2 then
    raise exception 'HAC12_VERIFY_SERVICE_CATEGORIES';
  end if;
end $$;

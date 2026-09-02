\set ON_ERROR_STOP on

do $$
declare
  v_count integer;
begin
  select count(*) into v_count
  from public.carriers
  where id = 'b1000000-0000-0000-0000-000000000001'
    and code = 'NEXO_DEMO'
    and provider_url = '/providers/nexo-demo'
    and status = 'ACTIVE'
    and supports_webmcp;
  if v_count <> 1 then
    raise exception 'D1_VERIFY: synthetic carrier configuration mismatch';
  end if;

  select count(*) into v_count
  from public.carrier_services
  where id in (
      'd1000000-0000-0000-0000-000000000001',
      'd1000000-0000-0000-0000-000000000002'
    )
    and carrier_id = 'b1000000-0000-0000-0000-000000000001'
    and active
    and provider_service_code is not null;
  if v_count <> 2 then
    raise exception 'D1_VERIFY: expected exactly two registered scenario services';
  end if;

  select count(*) into v_count
  from public.organization_cargo_profiles
  where id in (
      'a1000000-0000-0000-0000-000000000101',
      'a1000000-0000-0000-0000-000000000102'
    )
    and profile_name like '[SYNTHETIC]%'
    and default_requirements ->> 'fixture_provenance' = 'D1_SYNTHETIC_PROFILE';
  if v_count <> 2 then
    raise exception 'D1_VERIFY: synthetic profile markers or identities mismatch';
  end if;

  select count(*) into v_count
  from public.freight_requests
  where id in (
      'f2100000-0000-0000-0000-000000000001',
      'f2100000-0000-0000-0000-000000000002'
    )
    and code like 'SYN-HIST-D1-%'
    and cargo_specifications ->> 'fixtureProvenance' = 'D1_SYNTHETIC_RECOMMENDATION_HISTORY'
    and (cargo_specifications ->> 'notARealRun')::boolean
    and created_at < '2026-09-01T12:00:00Z';
  if v_count <> 2 then
    raise exception 'D1_VERIFY: history must contain exactly two marked, past synthetic antecedents';
  end if;

  select count(*) into v_count
  from public.orchestration_runs
  where freight_request_id in (
    'f2100000-0000-0000-0000-000000000001',
    'f2100000-0000-0000-0000-000000000002'
  );
  if v_count <> 0 then
    raise exception 'D1_VERIFY: synthetic antecedents must not preload orchestration runtime';
  end if;

  select count(*) into v_count
  from public.carrier_offers
  where freight_request_id in (
    'f2100000-0000-0000-0000-000000000001',
    'f2100000-0000-0000-0000-000000000002'
  );
  if v_count <> 0 then
    raise exception 'D1_VERIFY: synthetic antecedents must not preload offers';
  end if;

  select count(*) into v_count
  from public.freight_decisions
  where freight_request_id in (
    'f2100000-0000-0000-0000-000000000001',
    'f2100000-0000-0000-0000-000000000002'
  );
  if v_count <> 0 then
    raise exception 'D1_VERIFY: synthetic antecedents must not preload decisions';
  end if;

  select count(*) into v_count
  from public.bookings
  where freight_request_id in (
    'f2100000-0000-0000-0000-000000000001',
    'f2100000-0000-0000-0000-000000000002'
  );
  if v_count <> 0 then
    raise exception 'D1_VERIFY: synthetic antecedents must not preload bookings';
  end if;
end
$$;

do $$
declare
  v_domestic_matches integer;
  v_cross_border_matches integer;
  v_negative_matches integer;
  v_golden_matches integer;
begin
  -- Mirrors discovery's effective catalog constraints. Domestic requests do
  -- not require supports_cross_border; cross-border requests do.
  select count(*) into v_domestic_matches
  from public.carrier_services cs
  join public.carrier_service_cargo_categories csc on csc.carrier_service_id = cs.id
  where cs.carrier_id = 'b1000000-0000-0000-0000-000000000001'
    and cs.active
    and cs.origin_country = 'PE' and cs.origin_region = 'Lima'
    and cs.destination_country = 'PE' and cs.destination_region = 'Arequipa'
    and cs.transport_mode = 'ROAD' and cs.service_type = 'FTL'
    and cs.max_capacity_kg >= 7000 and cs.max_volume_m3 >= 10.5
    and csc.cargo_category_id = 'c0000000-0000-0000-0000-000000000001';

  select count(*) into v_cross_border_matches
  from public.carrier_services cs
  join public.carrier_service_cargo_categories csc on csc.carrier_service_id = cs.id
  where cs.carrier_id = 'b1000000-0000-0000-0000-000000000001'
    and cs.active and cs.supports_cross_border
    and cs.origin_country = 'PE' and cs.origin_region = 'Callao'
    and cs.destination_country = 'CL' and cs.destination_region = 'Santiago'
    and cs.transport_mode = 'ROAD' and cs.service_type = 'FTL'
    and cs.max_capacity_kg >= 4500 and cs.max_volume_m3 >= 9
    and csc.cargo_category_id = 'c0000000-0000-0000-0000-000000000007';

  select count(*) into v_negative_matches
  from public.carrier_services cs
  join public.carrier_service_cargo_categories csc on csc.carrier_service_id = cs.id
  where cs.carrier_id = 'b1000000-0000-0000-0000-000000000001'
    and cs.active
    and cs.origin_country = 'PE' and cs.origin_region = 'Lima'
    and cs.destination_country = 'PE' and cs.destination_region = 'Arequipa'
    and cs.transport_mode = 'ROAD' and cs.service_type = 'FTL'
    and cs.max_capacity_kg >= 18000 and cs.max_volume_m3 >= 42
    and csc.cargo_category_id = 'c0000000-0000-0000-0000-000000000006';

  if v_domestic_matches <> 1 then
    raise exception 'D1_VERIFY: national compatible case expected 1 catalog match, got %', v_domestic_matches;
  end if;
  if v_cross_border_matches <> 1 then
    raise exception 'D1_VERIFY: Peru-Chile compatible case expected 1 catalog match, got %', v_cross_border_matches;
  end if;
  if v_negative_matches <> 0 then
    raise exception 'D1_VERIFY: negative capacity/category case expected 0 catalog matches, got %', v_negative_matches;
  end if;

  -- The new carrier never serves MACHINERY, so FR-1042 still resolves only the
  -- three canonical Golden Flow services.
  select count(*) into v_golden_matches
  from public.freight_requests fr
  join public.carrier_services cs
    on cs.origin_country = fr.origin_country
   and cs.destination_country = fr.destination_country
   and cs.transport_mode = fr.transport_mode
   and cs.service_type = fr.service_type
   and (cs.origin_region is null or cs.origin_region = fr.origin_city)
   and (cs.destination_region is null or cs.destination_region = fr.destination_city)
   and (not fr.cross_border or cs.supports_cross_border)
   and cs.max_capacity_kg >= fr.cargo_weight_kg
   and (fr.cargo_volume_m3 is null or (cs.max_volume_m3 is not null and cs.max_volume_m3 >= fr.cargo_volume_m3))
   and cs.active
  join public.carrier_service_cargo_categories csc
    on csc.carrier_service_id = cs.id
   and csc.cargo_category_id = fr.cargo_category_id
  join public.carriers c on c.id = cs.carrier_id
  where fr.code = 'FR-1042'
    and c.status = 'ACTIVE'
    and c.supports_webmcp
    and c.provider_url is not null;

  if v_golden_matches <> 3 then
    raise exception 'D1_VERIFY: Golden Flow candidate count changed; expected 3, got %', v_golden_matches;
  end if;
end
$$;

select jsonb_build_object(
  'verified', true,
  'catalog', jsonb_build_object('carriers', 1, 'services', 2, 'vehicles', 2, 'metrics', 2),
  'profiles', 2,
  'syntheticAntecedents', 2,
  'runtimeRowsForAntecedents', 0,
  'caseMatches', jsonb_build_object('national', 1, 'peruChile', 1, 'negative', 0),
  'goldenFlowCandidateCount', 3
) as d1_verification;

\set ON_ERROR_STOP on

begin;

-- D1-03 is a local, synthetic demonstration dataset. It deliberately seeds only
-- catalog/configuration, organization cargo profiles, and clearly marked history.
-- A new request and all runtime rows must be created by the product during the demo.

do $$
begin
  if not exists (select 1 from public.organizations where id = 'a0000000-0000-0000-0000-000000000001' and code = 'ACME') then
    raise exception 'D1_SEED_PREREQUISITE: ACME baseline organization is missing';
  end if;

  if not exists (select 1 from public.cargo_categories where id = 'c0000000-0000-0000-0000-000000000001' and code = 'GENERAL')
     or not exists (select 1 from public.cargo_categories where id = 'c0000000-0000-0000-0000-000000000006' and code = 'CONSTRUCTION')
     or not exists (select 1 from public.cargo_categories where id = 'c0000000-0000-0000-0000-000000000007' and code = 'AGRICULTURAL') then
    raise exception 'D1_SEED_PREREQUISITE: expected baseline cargo categories are missing';
  end if;
end
$$;

insert into public.carriers (
  id, name, code, provider_type, status, provider_url, supports_webmcp,
  created_at, updated_at
)
values (
  'b1000000-0000-0000-0000-000000000001',
  '[SYNTHETIC] Nexo Demo Logistics',
  'NEXO_DEMO',
  'SMALL_FLEET',
  'ACTIVE',
  '/providers/nexo-demo',
  true,
  '2026-09-01T12:00:00Z',
  '2026-09-01T12:00:00Z'
)
on conflict (id) do update
set name = excluded.name,
    code = excluded.code,
    provider_type = excluded.provider_type,
    status = excluded.status,
    provider_url = excluded.provider_url,
    supports_webmcp = excluded.supports_webmcp,
    updated_at = excluded.updated_at;

insert into public.carrier_services (
  id, carrier_id, transport_mode, service_type,
  origin_country, origin_region, destination_country, destination_region,
  max_capacity_kg, max_volume_m3,
  supports_refrigerated, temperature_min_c, temperature_max_c,
  supports_hazardous, supports_fragile, supports_oversized,
  active, supports_cross_border, customs_coordination_included,
  provider_service_code, created_at, updated_at
)
values
  (
    'd1000000-0000-0000-0000-000000000001',
    'b1000000-0000-0000-0000-000000000001',
    'ROAD', 'FTL', 'PE', 'Lima', 'PE', 'Arequipa',
    12000, 40,
    false, null, null, false, true, false,
    true, false, false,
    'NEXO-DEMO-PE-DOM-FTL',
    '2026-09-01T12:00:00Z', '2026-09-01T12:00:00Z'
  ),
  (
    'd1000000-0000-0000-0000-000000000002',
    'b1000000-0000-0000-0000-000000000001',
    'ROAD', 'FTL', 'PE', 'Callao', 'CL', 'Santiago',
    16000, 50,
    false, null, null, false, false, false,
    true, true, true,
    'NEXO-DEMO-PECL-AGR-FTL',
    '2026-09-01T12:00:00Z', '2026-09-01T12:00:00Z'
  )
on conflict (id) do update
set carrier_id = excluded.carrier_id,
    transport_mode = excluded.transport_mode,
    service_type = excluded.service_type,
    origin_country = excluded.origin_country,
    origin_region = excluded.origin_region,
    destination_country = excluded.destination_country,
    destination_region = excluded.destination_region,
    max_capacity_kg = excluded.max_capacity_kg,
    max_volume_m3 = excluded.max_volume_m3,
    supports_refrigerated = excluded.supports_refrigerated,
    temperature_min_c = excluded.temperature_min_c,
    temperature_max_c = excluded.temperature_max_c,
    supports_hazardous = excluded.supports_hazardous,
    supports_fragile = excluded.supports_fragile,
    supports_oversized = excluded.supports_oversized,
    active = excluded.active,
    supports_cross_border = excluded.supports_cross_border,
    customs_coordination_included = excluded.customs_coordination_included,
    provider_service_code = excluded.provider_service_code,
    updated_at = excluded.updated_at;

insert into public.carrier_service_cargo_categories (
  carrier_service_id, cargo_category_id
)
values
  ('d1000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001'),
  ('d1000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000007')
on conflict do nothing;

insert into public.vehicles (
  id, carrier_id, code, brand, model, license_plate, vehicle_type,
  capacity_kg, volume_m3, supports_refrigerated, supports_hazardous,
  supports_oversized, location, status, created_at, updated_at
)
values
  (
    'e1000000-0000-0000-0000-000000000001',
    'b1000000-0000-0000-0000-000000000001',
    'NEX-DEMO-101', 'Synthetic', 'Rigid 12T', 'D1-LOCAL-101', 'RIGID_TRUCK',
    12000, 40, false, false, false, 'Lima, PE', 'AVAILABLE',
    '2026-09-01T12:00:00Z', '2026-09-01T12:00:00Z'
  ),
  (
    'e1000000-0000-0000-0000-000000000002',
    'b1000000-0000-0000-0000-000000000001',
    'NEX-DEMO-201', 'Synthetic', 'Tractor 16T', 'D1-PECL-201', 'TRACTOR_TRAILER',
    16000, 50, false, false, false, 'Callao, PE', 'AVAILABLE',
    '2026-09-01T12:00:00Z', '2026-09-01T12:00:00Z'
  )
on conflict (id) do update
set carrier_id = excluded.carrier_id,
    code = excluded.code,
    brand = excluded.brand,
    model = excluded.model,
    license_plate = excluded.license_plate,
    vehicle_type = excluded.vehicle_type,
    capacity_kg = excluded.capacity_kg,
    volume_m3 = excluded.volume_m3,
    supports_refrigerated = excluded.supports_refrigerated,
    supports_hazardous = excluded.supports_hazardous,
    supports_oversized = excluded.supports_oversized,
    location = excluded.location,
    status = excluded.status,
    updated_at = excluded.updated_at;

insert into public.carrier_metrics (
  id, carrier_id, cargo_category_id, organization_id, transport_mode,
  origin_country, origin_city, destination_country, destination_city,
  completed_freight_requests, successful_freight_requests, success_rate,
  avg_cost, average_route_cost, avg_delay_hours, cancellation_rate,
  route_completed_freight_requests,
  organization_completed_freight_requests,
  organization_successful_freight_requests,
  created_at, updated_at
)
values
  (
    'f1100000-0000-0000-0000-000000000001',
    'b1000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000001', null, 'ROAD',
    'PE', 'Lima', 'PE', 'Arequipa',
    12, 11, 91.67, 980, 980, 1.2, 4.0, 12, 0, 0,
    '2026-09-01T12:00:00Z', '2026-09-01T12:00:00Z'
  ),
  (
    'f1100000-0000-0000-0000-000000000002',
    'b1000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000007', null, 'ROAD',
    'PE', 'Callao', 'CL', 'Santiago',
    9, 8, 88.89, 1420, 1420, 2.0, 5.0, 9, 0, 0,
    '2026-09-01T12:00:00Z', '2026-09-01T12:00:00Z'
  )
on conflict (id) do update
set carrier_id = excluded.carrier_id,
    cargo_category_id = excluded.cargo_category_id,
    organization_id = excluded.organization_id,
    transport_mode = excluded.transport_mode,
    origin_country = excluded.origin_country,
    origin_city = excluded.origin_city,
    destination_country = excluded.destination_country,
    destination_city = excluded.destination_city,
    completed_freight_requests = excluded.completed_freight_requests,
    successful_freight_requests = excluded.successful_freight_requests,
    success_rate = excluded.success_rate,
    avg_cost = excluded.avg_cost,
    average_route_cost = excluded.average_route_cost,
    avg_delay_hours = excluded.avg_delay_hours,
    cancellation_rate = excluded.cancellation_rate,
    route_completed_freight_requests = excluded.route_completed_freight_requests,
    organization_completed_freight_requests = excluded.organization_completed_freight_requests,
    organization_successful_freight_requests = excluded.organization_successful_freight_requests,
    updated_at = excluded.updated_at;

insert into public.organization_cargo_profiles (
  id, organization_id, cargo_category_id, profile_name, default_entry_method,
  typical_entry_quantity, typical_unit_weight_kg, typical_units_per_entry,
  typical_length_cm, typical_width_cm, typical_height_cm,
  default_requirements, preferred_vehicle_classes, priority, active,
  created_at, updated_at
)
values
  (
    'a1000000-0000-0000-0000-000000000101',
    'a0000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000001',
    '[SYNTHETIC] Carga nacional Lima-Arequipa', 'PALLETS',
    8, 1000, 1, 120, 100, 125,
    '{"cross_border":false,"is_fragile":true,"fixture_provenance":"D1_SYNTHETIC_PROFILE"}'::jsonb,
    '["RIGID_TRUCK"]'::jsonb, 80, true,
    '2026-09-01T12:00:00Z', '2026-09-01T12:00:00Z'
  ),
  (
    'a1000000-0000-0000-0000-000000000102',
    'a0000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000007',
    '[SYNTHETIC] Agrícola Perú-Chile', 'SACKS',
    200, 30, 1, 60, 40, 25,
    '{"cross_border":true,"customs_coordination_required":true,"fixture_provenance":"D1_SYNTHETIC_PROFILE"}'::jsonb,
    '["TRACTOR_TRAILER"]'::jsonb, 70, true,
    '2026-09-01T12:00:00Z', '2026-09-01T12:00:00Z'
  )
on conflict (id) do update
set organization_id = excluded.organization_id,
    cargo_category_id = excluded.cargo_category_id,
    profile_name = excluded.profile_name,
    default_entry_method = excluded.default_entry_method,
    typical_entry_quantity = excluded.typical_entry_quantity,
    typical_unit_weight_kg = excluded.typical_unit_weight_kg,
    typical_units_per_entry = excluded.typical_units_per_entry,
    typical_length_cm = excluded.typical_length_cm,
    typical_width_cm = excluded.typical_width_cm,
    typical_height_cm = excluded.typical_height_cm,
    default_requirements = excluded.default_requirements,
    preferred_vehicle_classes = excluded.preferred_vehicle_classes,
    priority = excluded.priority,
    active = excluded.active,
    updated_at = excluded.updated_at;

insert into public.freight_requests (
  id, organization_id, cargo_category_id, cargo_profile_id, code,
  origin_country, origin_city, origin_address,
  destination_country, destination_city, destination_address,
  cargo_description, cargo_weight_kg, cargo_volume_m3, package_count,
  cargo_entry_method, entry_quantity, entry_unit_weight_kg, units_per_entry,
  entry_length_cm, entry_width_cm, entry_height_cm, cargo_specifications,
  service_type, transport_mode, requires_refrigeration,
  temperature_min_c, temperature_max_c, is_hazardous, is_fragile,
  is_oversized, is_high_value, is_stackable, special_instructions,
  pickup_mode, required_pickup, pickup_window_start, pickup_window_end,
  delivery_deadline, budget_max, optimization_strategy,
  available_documents, cross_border, status, confirmed_at,
  created_at, updated_at
)
values
  (
    'f2100000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000001',
    'a1000000-0000-0000-0000-000000000101',
    'SYN-HIST-D1-NAT-001',
    'PE', 'Lima', 'Centro de distribución sintético, Lima',
    'PE', 'Arequipa', 'Almacén sintético, Arequipa',
    'Antecedente sintético de carga general nacional',
    8000, 12, 8, 'PALLETS', 8, 1000, 1, 120, 100, 125,
    '{"fixtureProvenance":"D1_SYNTHETIC_RECOMMENDATION_HISTORY","scenarioVersion":"1.0","notARealRun":true}'::jsonb,
    'FTL', 'ROAD', false, null, null, false, true, false, false, true,
    '[SYNTHETIC HISTORY] Solo para probar recomendaciones; no representa una operación real.',
    'SCHEDULED', '2026-07-08T13:00:00Z', '2026-07-08T13:00:00Z',
    '2026-07-08T17:00:00Z', '2026-07-09T23:00:00Z', 1100, 'BALANCED',
    '[]'::jsonb, false, 'BOOKED', '2026-07-01T12:00:00Z',
    '2026-07-01T12:00:00Z', '2026-07-10T12:00:00Z'
  ),
  (
    'f2100000-0000-0000-0000-000000000002',
    'a0000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000007',
    'a1000000-0000-0000-0000-000000000102',
    'SYN-HIST-D1-PECL-001',
    'PE', 'Callao', 'Terminal sintético, Callao',
    'CL', 'Santiago', 'Centro sintético, Santiago',
    'Antecedente sintético de productos agrícolas',
    6000, 12, 200, 'SACKS', 200, 30, 1, 60, 40, 25,
    '{"fixtureProvenance":"D1_SYNTHETIC_RECOMMENDATION_HISTORY","scenarioVersion":"1.0","notARealRun":true}'::jsonb,
    'FTL', 'ROAD', false, null, null, false, false, false, false, true,
    '[SYNTHETIC HISTORY] Solo para probar recomendaciones; no representa una operación real.',
    'SCHEDULED', '2026-06-17T13:00:00Z', '2026-06-17T13:00:00Z',
    '2026-06-17T17:00:00Z', '2026-06-20T13:00:00Z', 1600, 'BALANCED',
    '["COMMERCIAL_INVOICE","PACKING_LIST","CERTIFICATE_OF_ORIGIN"]'::jsonb,
    true, 'BOOKED', '2026-06-10T12:00:00Z',
    '2026-06-10T12:00:00Z', '2026-06-21T12:00:00Z'
  )
on conflict (id) do update
set organization_id = excluded.organization_id,
    cargo_category_id = excluded.cargo_category_id,
    cargo_profile_id = excluded.cargo_profile_id,
    code = excluded.code,
    origin_country = excluded.origin_country,
    origin_city = excluded.origin_city,
    origin_address = excluded.origin_address,
    destination_country = excluded.destination_country,
    destination_city = excluded.destination_city,
    destination_address = excluded.destination_address,
    cargo_description = excluded.cargo_description,
    cargo_weight_kg = excluded.cargo_weight_kg,
    cargo_volume_m3 = excluded.cargo_volume_m3,
    package_count = excluded.package_count,
    cargo_entry_method = excluded.cargo_entry_method,
    entry_quantity = excluded.entry_quantity,
    entry_unit_weight_kg = excluded.entry_unit_weight_kg,
    units_per_entry = excluded.units_per_entry,
    entry_length_cm = excluded.entry_length_cm,
    entry_width_cm = excluded.entry_width_cm,
    entry_height_cm = excluded.entry_height_cm,
    cargo_specifications = excluded.cargo_specifications,
    service_type = excluded.service_type,
    transport_mode = excluded.transport_mode,
    requires_refrigeration = excluded.requires_refrigeration,
    temperature_min_c = excluded.temperature_min_c,
    temperature_max_c = excluded.temperature_max_c,
    is_hazardous = excluded.is_hazardous,
    is_fragile = excluded.is_fragile,
    is_oversized = excluded.is_oversized,
    is_high_value = excluded.is_high_value,
    is_stackable = excluded.is_stackable,
    special_instructions = excluded.special_instructions,
    pickup_mode = excluded.pickup_mode,
    required_pickup = excluded.required_pickup,
    pickup_window_start = excluded.pickup_window_start,
    pickup_window_end = excluded.pickup_window_end,
    delivery_deadline = excluded.delivery_deadline,
    budget_max = excluded.budget_max,
    optimization_strategy = excluded.optimization_strategy,
    available_documents = excluded.available_documents,
    cross_border = excluded.cross_border,
    status = excluded.status,
    confirmed_at = excluded.confirmed_at,
    created_at = excluded.created_at,
    updated_at = excluded.updated_at;

commit;

select jsonb_build_object(
  'package', 'D1-03',
  'baseClock', '2026-09-01T12:00:00Z',
  'catalogRows', 7,
  'profileRows', 2,
  'syntheticHistoryRows', 2,
  'runtimeRowsSeeded', 0
) as d1_seed_summary;

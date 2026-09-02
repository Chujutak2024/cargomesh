-- Migration: 20260902102000_seed_international_truck_carriers.sql
-- Description: Sembrado de 3 transportistas internacionales con marcas de clase mundial en inglés
-- enfocados exclusivamente en transporte terrestre por carretera (ROAD FTL):
-- 1. Polaris Cold Chain Logistics (Cadena de frío extremo Reefer FTL)
-- 2. Apex Hazmat Transport (Carga peligrosa y materiales industriales certificados)
-- 3. Velocity Express Freight (Flete express prioritario en 24h)

begin;

-- =============================================================================
-- 1. REGISTRO DE TRANSPORTISTAS INTERNACIONALES (public.carriers)
-- =============================================================================
insert into public.carriers (
  id,
  name,
  code,
  provider_type,
  status,
  provider_url,
  supports_webmcp,
  created_at,
  updated_at
)
values
  -- Carrier 5: Frío extremo internacional
  (
    'b2000000-0000-0000-0000-000000000001',
    'Polaris Cold Chain Logistics',
    'POLARIS_COLD_CHAIN',
    'ENTERPRISE_CARRIER',
    'ACTIVE',
    '/providers/polaris-cold-chain',
    true,
    now(),
    now()
  ),
  -- Carrier 6: Carga peligrosa certificada
  (
    'b2000000-0000-0000-0000-000000000002',
    'Apex Hazmat Transport',
    'APEX_HAZMAT',
    'ENTERPRISE_CARRIER',
    'ACTIVE',
    '/providers/apex-hazmat',
    true,
    now(),
    now()
  ),
  -- Carrier 7: Flete prioritario express
  (
    'b2000000-0000-0000-0000-000000000003',
    'Velocity Express Freight',
    'VELOCITY_EXPRESS',
    'REGIONAL_CARRIER',
    'ACTIVE',
    '/providers/velocity-express',
    true,
    now(),
    now()
  )
on conflict (id) do update
set name = excluded.name,
    code = excluded.code,
    provider_type = excluded.provider_type,
    status = excluded.status,
    provider_url = excluded.provider_url,
    supports_webmcp = excluded.supports_webmcp,
    updated_at = now();

-- =============================================================================
-- 2. SERVICIOS DE TRANSPORTE (public.carrier_services)
-- =============================================================================
insert into public.carrier_services (
  id,
  carrier_id,
  transport_mode,
  service_type,
  origin_country,
  origin_region,
  destination_country,
  destination_region,
  max_capacity_kg,
  max_volume_m3,
  supports_refrigerated,
  temperature_min_c,
  temperature_max_c,
  supports_hazardous,
  supports_fragile,
  supports_oversized,
  active,
  supports_cross_border,
  customs_coordination_included,
  provider_service_code,
  created_at,
  updated_at
)
values
  -- Polaris: Ruta Transfronteriza con Frío Extremo
  (
    'd2000000-0000-0000-0000-000000000001',
    'b2000000-0000-0000-0000-000000000001',
    'ROAD',
    'FTL',
    'PE',
    'Callao',
    'CL',
    'Santiago',
    22000,
    65,
    true,
    -25,
    5,
    false,
    true,
    false,
    true,
    true,
    true,
    'POLARIS-PECL-REEFER-FTL',
    now(),
    now()
  ),
  -- Apex: Corredor Minero Hazmat Internacional
  (
    'd2000000-0000-0000-0000-000000000002',
    'b2000000-0000-0000-0000-000000000002',
    'ROAD',
    'FTL',
    'PE',
    'Callao',
    'CL',
    'Santiago',
    30000,
    60,
    false,
    null,
    null,
    true,
    false,
    true,
    true,
    true,
    true,
    'APEX-PECL-HAZMAT-FTL',
    now(),
    now()
  ),
  -- Velocity: Corredor Rápido Nacional Express
  (
    'd2000000-0000-0000-0000-000000000003',
    'b2000000-0000-0000-0000-000000000003',
    'ROAD',
    'FTL',
    'PE',
    'Lima',
    'PE',
    'Arequipa',
    12000,
    40,
    false,
    null,
    null,
    false,
    true,
    false,
    true,
    false,
    false,
    'VELOCITY-PE-EXPRESS-FTL',
    now(),
    now()
  )
on conflict (id) do update
set carrier_id = excluded.carrier_id,
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
    supports_cross_border = excluded.supports_cross_border,
    provider_service_code = excluded.provider_service_code,
    updated_at = now();

-- =============================================================================
-- 3. ASOCIACIÓN DE CATEGORÍAS DE CARGA (public.carrier_service_cargo_categories)
-- =============================================================================
insert into public.carrier_service_cargo_categories (carrier_service_id, cargo_category_id)
values
  -- Polaris soporta Agrícola y General refrigerada
  ('d2000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000007'), -- AGRICULTURAL
  ('d2000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001'), -- GENERAL
  -- Apex soporta Maquinaria Pesada y Construcción/Química
  ('d2000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000005'), -- MACHINERY
  ('d2000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000006'), -- CONSTRUCTION
  -- Velocity soporta General y Construcción ligera
  ('d2000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000001'), -- GENERAL
  ('d2000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000006')  -- CONSTRUCTION
on conflict do nothing;

-- =============================================================================
-- 4. FLOTA DE CAMIONES DEDICADA (public.vehicles)
-- =============================================================================
insert into public.vehicles (
  id,
  carrier_id,
  code,
  brand,
  model,
  license_plate,
  vehicle_type,
  capacity_kg,
  volume_m3,
  supports_refrigerated,
  supports_hazardous,
  supports_oversized,
  location,
  status,
  updated_at
)
values
  -- Polaris Camiones Reefer
  (
    'e2000000-0000-0000-0000-000000000001',
    'b2000000-0000-0000-0000-000000000001',
    'POL-TRK-101',
    'Volvo',
    'FM 460 Cryo-Reefer (-25°C)',
    'P8A-901',
    'TRACTOR_TRAILER',
    18000,
    50,
    true,
    false,
    false,
    'Callao, PE',
    'AVAILABLE',
    now()
  ),
  (
    'e2000000-0000-0000-0000-000000000002',
    'b2000000-0000-0000-0000-000000000001',
    'POL-TRK-102',
    'Scania',
    'R500 Thermo King Super-II',
    'P2B-334',
    'TRACTOR_TRAILER',
    22000,
    65,
    true,
    false,
    false,
    'Ica, PE',
    'AVAILABLE',
    now()
  ),
  -- Apex Camiones Hazmat Pesados
  (
    'e2000000-0000-0000-0000-000000000003',
    'b2000000-0000-0000-0000-000000000002',
    'APX-TRK-201',
    'Kenworth',
    'T680 Hazmat Certified Hauler',
    'A5C-881',
    'TRACTOR_TRAILER',
    26000,
    55,
    false,
    true,
    false,
    'Callao, PE',
    'AVAILABLE',
    now()
  ),
  (
    'e2000000-0000-0000-0000-000000000004',
    'b2000000-0000-0000-0000-000000000002',
    'APX-TRK-202',
    'Mack',
    'Anthem Heavy Duty Hazmat/Lowboy',
    'A9D-129',
    'TRACTOR_TRAILER',
    30000,
    60,
    false,
    true,
    true,
    'Arequipa, PE',
    'AVAILABLE',
    now()
  ),
  -- Velocity Camiones Express
  (
    'e2000000-0000-0000-0000-000000000005',
    'b2000000-0000-0000-0000-000000000003',
    'VEL-TRK-301',
    'Freightliner',
    'Cascadia 116 Rapid Dry Van',
    'V1E-772',
    'TRACTOR_TRAILER',
    12000,
    40,
    false,
    false,
    false,
    'Lima, PE',
    'AVAILABLE',
    now()
  ),
  (
    'e2000000-0000-0000-0000-000000000006',
    'b2000000-0000-0000-0000-000000000003',
    'VEL-TRK-302',
    'Isuzu',
    'Giga Forward Express 10T',
    'V4F-440',
    'RIGID_TRUCK',
    10000,
    35,
    false,
    false,
    false,
    'Lima, PE',
    'AVAILABLE',
    now()
  )
on conflict (code) do update
set carrier_id = excluded.carrier_id,
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
    updated_at = now();

-- =============================================================================
-- 5. HISTORIAL DE RENDIMIENTO Y MÉTRICAS (public.carrier_metrics)
-- =============================================================================
insert into public.carrier_metrics (
  id,
  carrier_id,
  cargo_category_id,
  transport_mode,
  origin_country,
  origin_city,
  destination_country,
  destination_city,
  completed_freight_requests,
  successful_freight_requests,
  success_rate,
  avg_cost,
  average_route_cost,
  avg_delay_hours,
  cancellation_rate,
  route_completed_freight_requests,
  created_at,
  updated_at
)
values
  -- Polaris (Alta confiabilidad en frío)
  (
    'f2000000-0000-0000-0000-000000000001',
    'b2000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000007',
    'ROAD',
    'PE',
    'Callao',
    'CL',
    'Santiago',
    45,
    44,
    97.8,
    1850,
    1850,
    0.5,
    1.2,
    45,
    now(),
    now()
  ),
  -- Apex (Especialista Hazmat con tarifa premium)
  (
    'f2000000-0000-0000-0000-000000000002',
    'b2000000-0000-0000-0000-000000000002',
    'c0000000-0000-0000-0000-000000000005',
    'ROAD',
    'PE',
    'Callao',
    'CL',
    'Santiago',
    60,
    58,
    96.7,
    2650,
    2650,
    0.8,
    2.0,
    60,
    now(),
    now()
  ),
  -- Velocity (Rápido nacional)
  (
    'f2000000-0000-0000-0000-000000000003',
    'b2000000-0000-0000-0000-000000000003',
    'c0000000-0000-0000-0000-000000000001',
    'ROAD',
    'PE',
    'Lima',
    'PE',
    'Arequipa',
    80,
    78,
    97.5,
    890,
    890,
    0.3,
    1.0,
    80,
    now(),
    now()
  )
on conflict (id) do update
set success_rate = excluded.success_rate,
    avg_cost = excluded.avg_cost,
    average_route_cost = excluded.average_route_cost,
    avg_delay_hours = excluded.avg_delay_hours,
    updated_at = now();

commit;

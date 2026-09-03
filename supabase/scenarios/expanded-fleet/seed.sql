-- =============================================================================
-- Scenario: expanded-fleet/seed.sql
-- Description: Sembrado sintético de demostración (Escenario Demo Controlado).
-- Invariante: NO ES UNA MIGRACIÓN. NO EJECUTAR CON DB PUSH.
-- Orden de inserción auditado para respetar integridad referencial (FKs).
-- =============================================================================

begin;

-- =============================================================================
-- 1. ORGANIZACIONES SHIPPERS ADICIONALES (public.organizations)
-- =============================================================================
insert into public.organizations (
  id,
  name,
  code,
  status,
  default_currency,
  legal_name,
  country_code,
  business_identifier_type,
  business_identifier_value,
  verified_corporate_email,
  corporate_phone,
  created_at,
  updated_at
)
values
  -- Organización 2: Agroexportadora (demanda camiones refrigerados / Reefer FTL)
  (
    'a0000000-0000-0000-0000-000000000002',
    'Agrícola del Valle Sur',
    'AGRIVAS',
    'ACTIVE',
    'USD',
    'Agrícola del Valle Sur S.A.C.',
    'PE',
    'RUC',
    '20519283741',
    'operaciones@agrivas.pe',
    '+51 1 719 3320',
    now(),
    now()
  ),
  -- Organización 3: Construcción & Manufactura (demanda camiones pesados / Plataforma FTL)
  (
    'a0000000-0000-0000-0000-000000000003',
    'Cemento & Concreto Andino',
    'CEMENTOS',
    'ACTIVE',
    'USD',
    'Cemento & Concreto Andino S.A.',
    'PE',
    'RUC',
    '20491827365',
    'logistica@cementosandino.pe',
    '+51 1 614 8800',
    now(),
    now()
  )
on conflict (id) do update
set name = excluded.name,
    code = excluded.code,
    status = excluded.status,
    legal_name = excluded.legal_name,
    business_identifier_value = excluded.business_identifier_value,
    verified_corporate_email = excluded.verified_corporate_email,
    corporate_phone = excluded.corporate_phone,
    updated_at = now();

-- =============================================================================
-- 2. PREFERENCIAS OPERATIVAS DE CADA ORGANIZACIÓN (public.organization_preferences)
-- =============================================================================
insert into public.organization_preferences (
  id,
  organization_id,
  default_strategy,
  max_pickup_wait_hours,
  allow_auto_booking,
  confidence_threshold,
  selection_mode,
  billing_mode,
  created_at,
  updated_at
)
values
  (
    'a0000000-0000-0000-0000-000000000102',
    'a0000000-0000-0000-0000-000000000002',
    'BALANCED',
    2.0,
    false,
    85.00,
    'ASSISTED',
    'INVOICE',
    now(),
    now()
  ),
  (
    'a0000000-0000-0000-0000-000000000103',
    'a0000000-0000-0000-0000-000000000003',
    'BALANCED',
    4.0,
    false,
    80.00,
    'ASSISTED',
    'INVOICE',
    now(),
    now()
  )
on conflict (organization_id) do update
set default_strategy = excluded.default_strategy,
    max_pickup_wait_hours = excluded.max_pickup_wait_hours,
    selection_mode = excluded.selection_mode,
    updated_at = now();

-- =============================================================================
-- 3. MIEMBROS DE LA ORGANIZACIÓN (public.organization_members)
-- Condicional: Solo se insertan si el auth_user_id existe previamente en auth.users
-- para evitar violaciones de la FK organization_members_auth_user_id_fkey.
-- =============================================================================
insert into public.organization_members (
  id,
  organization_id,
  auth_user_id,
  display_name,
  corporate_email,
  role,
  status,
  created_at,
  updated_at
)
select
  m.id,
  m.organization_id,
  m.auth_user_id,
  m.display_name,
  m.corporate_email,
  m.role,
  m.status,
  m.created_at,
  m.updated_at
from (
  values
    ('e0000000-0000-0000-0000-000000000002'::uuid, 'a0000000-0000-0000-0000-000000000002'::uuid, 'd0000000-0000-0000-0000-000000000002'::uuid, 'Lucía Paredes', 'lucia.paredes@agrivas.pe', 'OWNER', 'ACTIVE', now(), now()),
    ('e0000000-0000-0000-0000-000000000003'::uuid, 'a0000000-0000-0000-0000-000000000003'::uuid, 'd0000000-0000-0000-0000-000000000003'::uuid, 'Marco Benavides', 'marco.benavides@cementosandino.pe', 'OWNER', 'ACTIVE', now(), now())
) as m(id, organization_id, auth_user_id, display_name, corporate_email, role, status, created_at, updated_at)
where exists (select 1 from auth.users u where u.id = m.auth_user_id)
on conflict (organization_id, auth_user_id) do update
set display_name = excluded.display_name,
    corporate_email = excluded.corporate_email,
    role = excluded.role,
    status = excluded.status,
    updated_at = now();

-- =============================================================================
-- 4. PERFILES DE CARGA PARA RECOMENDACIONES (public.organization_cargo_profiles)
-- =============================================================================
insert into public.organization_cargo_profiles (
  id,
  organization_id,
  cargo_category_id,
  profile_name,
  default_entry_method,
  typical_entry_quantity,
  typical_unit_weight_kg,
  typical_units_per_entry,
  typical_length_cm,
  typical_width_cm,
  typical_height_cm,
  default_requirements,
  preferred_vehicle_classes,
  priority,
  active,
  created_at,
  updated_at
)
values
  -- Perfil Agrícola (Fruta Fresca / Sacos en Camión Refrigerado Reefer)
  (
    'a0000000-0000-0000-0000-000000000201',
    'a0000000-0000-0000-0000-000000000002',
    'c0000000-0000-0000-0000-000000000007', -- AGRICULTURAL
    'Pallets de Uva Red Globe Refrigerada',
    'PALLETS',
    10,
    800,
    1,
    120,
    100,
    160,
    jsonb_build_object(
      'requires_refrigeration', true,
      'temperature_min_c', -1,
      'temperature_max_c', 1,
      'customs_coordination', true,
      'preferred_truck_type', 'REEFER_TRUCK'
    ),
    '["REEFER_TRUCK", "TRACTOR_TRAILER"]'::jsonb,
    100,
    true,
    now(),
    now()
  ),
  -- Perfil Construcción (Cemento en Camión Plataforma Pesada FTL)
  (
    'a0000000-0000-0000-0000-000000000301',
    'a0000000-0000-0000-0000-000000000003',
    'c0000000-0000-0000-0000-000000000006', -- CONSTRUCTION
    'Pallets Cemento Tipo I y Agregados',
    'PALLETS',
    16,
    1250,
    1,
    120,
    100,
    140,
    jsonb_build_object(
      'requires_refrigeration', false,
      'supports_oversized', false,
      'preferred_truck_type', 'FLATBED_TRAILER'
    ),
    '["TRACTOR_TRAILER", "RIGID_TRUCK"]'::jsonb,
    100,
    true,
    now(),
    now()
  )
on conflict (id) do update
set profile_name = excluded.profile_name,
    typical_entry_quantity = excluded.typical_entry_quantity,
    typical_unit_weight_kg = excluded.typical_unit_weight_kg,
    default_requirements = excluded.default_requirements,
    preferred_vehicle_classes = excluded.preferred_vehicle_classes,
    updated_at = now();

-- =============================================================================
-- 5. TRANSPORTISTAS INTERNACIONALES (public.carriers)
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
  -- Carrier 5: Frío extremo internacional (Escenario / Roadmap)
  (
    'b2000000-0000-0000-0000-000000000001',
    'Polaris Cold Chain Logistics',
    'POLARIS_COLD_CHAIN',
    'ENTERPRISE_CARRIER',
    'ACTIVE',
    '/providers/polaris-cold-chain',
    false,
    now(),
    now()
  ),
  -- Carrier 6: Carga peligrosa certificada (Escenario / Roadmap)
  (
    'b2000000-0000-0000-0000-000000000002',
    'Apex Hazmat Transport',
    'APEX_HAZMAT',
    'ENTERPRISE_CARRIER',
    'ACTIVE',
    '/providers/apex-hazmat',
    false,
    now(),
    now()
  ),
  -- Carrier 7: Flete prioritario express (Escenario / Roadmap)
  (
    'b2000000-0000-0000-0000-000000000003',
    'Velocity Express Freight',
    'VELOCITY_EXPRESS',
    'CARRIER',
    'ACTIVE',
    '/providers/velocity-express',
    false,
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
-- 6. SERVICIOS DE TRANSPORTE (public.carrier_services)
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
-- 7. ASOCIACIÓN DE CATEGORÍAS DE CARGA (public.carrier_service_cargo_categories)
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
-- 8. FLOTA VEHICULAR ENRIQUECIDA (public.vehicles)
-- Las asociaciones a carriers se resuelven por código de carrier para asegurar
-- compatibilidad idéntica tanto en entornos con IDs 200000... como b00000...
-- =============================================================================

-- 8.1 Flota Andes Freight (Carga Pesada & Minería)
insert into public.vehicles (
  id, carrier_id, code, brand, model, license_plate, vehicle_type,
  capacity_kg, volume_m3, supports_refrigerated, supports_hazardous,
  supports_oversized, location, status, updated_at
)
select
  v.id, c.id, v.code, v.brand, v.model, v.license_plate, v.vehicle_type,
  v.capacity_kg, v.volume_m3, v.supports_refrigerated, v.supports_hazardous,
  v.supports_oversized, v.location, v.status, now()
from (
  values
    ('e0000000-0000-0000-0000-000000000001'::uuid, 'AND-TRK-101', 'Scania', 'R450 Highline 6x4', 'V9A-812', 'TRACTOR_TRAILER', 28000, 60, false, true, true, 'Callao, PE', 'AVAILABLE'),
    ('e0000000-0000-0000-0000-000000000012'::uuid, 'AND-TRK-102', 'Volvo', 'FH16 540 Lowboy', 'V7B-441', 'TRACTOR_TRAILER', 32000, 75, false, true, true, 'Arequipa, PE', 'AVAILABLE'),
    ('e0000000-0000-0000-0000-000000000013'::uuid, 'AND-TRK-103', 'Scania', 'G410 Furgón Minero', 'V3C-902', 'TRACTOR_TRAILER', 20000, 50, false, false, false, 'Tacna, PE', 'IN_TRANSIT')
) as v(id, code, brand, model, license_plate, vehicle_type, capacity_kg, volume_m3, supports_refrigerated, supports_hazardous, supports_oversized, location, status)
cross join (select id from public.carriers where code = 'ANDES' limit 1) c
on conflict (code) do update
set carrier_id = excluded.carrier_id, brand = excluded.brand, model = excluded.model,
    license_plate = excluded.license_plate, vehicle_type = excluded.vehicle_type,
    capacity_kg = excluded.capacity_kg, volume_m3 = excluded.volume_m3,
    supports_refrigerated = excluded.supports_refrigerated, supports_hazardous = excluded.supports_hazardous,
    supports_oversized = excluded.supports_oversized, location = excluded.location,
    status = excluded.status, updated_at = now();

-- 8.2 Flota Inca Express (Refrigerados & Agro)
insert into public.vehicles (
  id, carrier_id, code, brand, model, license_plate, vehicle_type,
  capacity_kg, volume_m3, supports_refrigerated, supports_hazardous,
  supports_oversized, location, status, updated_at
)
select
  v.id, c.id, v.code, v.brand, v.model, v.license_plate, v.vehicle_type,
  v.capacity_kg, v.volume_m3, v.supports_refrigerated, v.supports_hazardous,
  v.supports_oversized, v.location, v.status, now()
from (
  values
    ('e0000000-0000-0000-0000-000000000002'::uuid, 'INC-TRK-201', 'Volvo', 'FM 420 Reefer Thermo King', 'F4D-319', 'TRACTOR_TRAILER', 15000, 45, true, false, false, 'Callao, PE', 'AVAILABLE'),
    ('e0000000-0000-0000-0000-000000000022'::uuid, 'INC-TRK-202', 'Mercedes-Benz', 'Actros 2645 Dry Van', 'F8E-220', 'TRACTOR_TRAILER', 24000, 70, false, false, false, 'Lima, PE', 'AVAILABLE'),
    ('e0000000-0000-0000-0000-000000000023'::uuid, 'INC-TRK-203', 'Volvo', 'FH 460 Multi-Temp Reefer', 'F1G-554', 'TRACTOR_TRAILER', 18000, 52, true, false, false, 'Ica, PE', 'AVAILABLE')
) as v(id, code, brand, model, license_plate, vehicle_type, capacity_kg, volume_m3, supports_refrigerated, supports_hazardous, supports_oversized, location, status)
cross join (select id from public.carriers where code = 'INCA' limit 1) c
on conflict (code) do update
set carrier_id = excluded.carrier_id, brand = excluded.brand, model = excluded.model,
    license_plate = excluded.license_plate, vehicle_type = excluded.vehicle_type,
    capacity_kg = excluded.capacity_kg, volume_m3 = excluded.volume_m3,
    supports_refrigerated = excluded.supports_refrigerated, supports_hazardous = excluded.supports_hazardous,
    supports_oversized = excluded.supports_oversized, location = excluded.location,
    status = excluded.status, updated_at = now();

-- 8.3 Flota Pacific Logistics (Express & Rápido)
insert into public.vehicles (
  id, carrier_id, code, brand, model, license_plate, vehicle_type,
  capacity_kg, volume_m3, supports_refrigerated, supports_hazardous,
  supports_oversized, location, status, updated_at
)
select
  v.id, c.id, v.code, v.brand, v.model, v.license_plate, v.vehicle_type,
  v.capacity_kg, v.volume_m3, v.supports_refrigerated, v.supports_hazardous,
  v.supports_oversized, v.location, v.status, now()
from (
  values
    ('e0000000-0000-0000-0000-000000000003'::uuid, 'PAC-TRK-301', 'Freightliner', 'Cascadia 126 Express Van', 'C5H-781', 'TRACTOR_TRAILER', 15000, 45, false, false, false, 'Callao, PE', 'AVAILABLE'),
    ('e0000000-0000-0000-0000-000000000032'::uuid, 'PAC-TRK-302', 'Isuzu', 'Forward 1400 Box Truck', 'C9J-112', 'RIGID_TRUCK', 8000, 30, false, false, false, 'Lima, PE', 'AVAILABLE'),
    ('e0000000-0000-0000-0000-000000000033'::uuid, 'PAC-TRK-303', 'Hino', '700 Series Intermodal', 'C2K-909', 'TRACTOR_TRAILER', 26000, 65, false, true, false, 'Callao, PE', 'AVAILABLE')
) as v(id, code, brand, model, license_plate, vehicle_type, capacity_kg, volume_m3, supports_refrigerated, supports_hazardous, supports_oversized, location, status)
cross join (select id from public.carriers where code = 'PACIFIC' limit 1) c
on conflict (code) do update
set carrier_id = excluded.carrier_id, brand = excluded.brand, model = excluded.model,
    license_plate = excluded.license_plate, vehicle_type = excluded.vehicle_type,
    capacity_kg = excluded.capacity_kg, volume_m3 = excluded.volume_m3,
    supports_refrigerated = excluded.supports_refrigerated, supports_hazardous = excluded.supports_hazardous,
    supports_oversized = excluded.supports_oversized, location = excluded.location,
    status = excluded.status, updated_at = now();

-- 8.4 Flota Polaris Cold Chain
insert into public.vehicles (
  id, carrier_id, code, brand, model, license_plate, vehicle_type,
  capacity_kg, volume_m3, supports_refrigerated, supports_hazardous,
  supports_oversized, location, status, updated_at
)
select
  v.id, c.id, v.code, v.brand, v.model, v.license_plate, v.vehicle_type,
  v.capacity_kg, v.volume_m3, v.supports_refrigerated, v.supports_hazardous,
  v.supports_oversized, v.location, v.status, now()
from (
  values
    ('e2000000-0000-0000-0000-000000000001'::uuid, 'POL-TRK-101', 'Volvo', 'FM 460 Cryo-Reefer (-25°C)', 'P8A-901', 'TRACTOR_TRAILER', 18000, 50, true, false, false, 'Callao, PE', 'AVAILABLE'),
    ('e2000000-0000-0000-0000-000000000002'::uuid, 'POL-TRK-102', 'Scania', 'R500 Thermo King Super-II', 'P2B-334', 'TRACTOR_TRAILER', 22000, 65, true, false, false, 'Ica, PE', 'AVAILABLE')
) as v(id, code, brand, model, license_plate, vehicle_type, capacity_kg, volume_m3, supports_refrigerated, supports_hazardous, supports_oversized, location, status)
cross join (select id from public.carriers where code = 'POLARIS_COLD_CHAIN' limit 1) c
on conflict (code) do update
set carrier_id = excluded.carrier_id, brand = excluded.brand, model = excluded.model,
    license_plate = excluded.license_plate, vehicle_type = excluded.vehicle_type,
    capacity_kg = excluded.capacity_kg, volume_m3 = excluded.volume_m3,
    supports_refrigerated = excluded.supports_refrigerated, supports_hazardous = excluded.supports_hazardous,
    supports_oversized = excluded.supports_oversized, location = excluded.location,
    status = excluded.status, updated_at = now();

-- 8.5 Flota Apex Hazmat
insert into public.vehicles (
  id, carrier_id, code, brand, model, license_plate, vehicle_type,
  capacity_kg, volume_m3, supports_refrigerated, supports_hazardous,
  supports_oversized, location, status, updated_at
)
select
  v.id, c.id, v.code, v.brand, v.model, v.license_plate, v.vehicle_type,
  v.capacity_kg, v.volume_m3, v.supports_refrigerated, v.supports_hazardous,
  v.supports_oversized, v.location, v.status, now()
from (
  values
    ('e2000000-0000-0000-0000-000000000003'::uuid, 'APX-TRK-201', 'Kenworth', 'T680 Hazmat Certified Hauler', 'A5C-881', 'TRACTOR_TRAILER', 30000, 60, false, true, true, 'Callao, PE', 'AVAILABLE'),
    ('e2000000-0000-0000-0000-000000000004'::uuid, 'APX-TRK-202', 'Freightliner', 'Cascadia Heavy Lowboy', 'A1D-492', 'TRACTOR_TRAILER', 32000, 70, false, true, true, 'Arequipa, PE', 'AVAILABLE')
) as v(id, code, brand, model, license_plate, vehicle_type, capacity_kg, volume_m3, supports_refrigerated, supports_hazardous, supports_oversized, location, status)
cross join (select id from public.carriers where code = 'APEX_HAZMAT' limit 1) c
on conflict (code) do update
set carrier_id = excluded.carrier_id, brand = excluded.brand, model = excluded.model,
    license_plate = excluded.license_plate, vehicle_type = excluded.vehicle_type,
    capacity_kg = excluded.capacity_kg, volume_m3 = excluded.volume_m3,
    supports_refrigerated = excluded.supports_refrigerated, supports_hazardous = excluded.supports_hazardous,
    supports_oversized = excluded.supports_oversized, location = excluded.location,
    status = excluded.status, updated_at = now();

-- 8.6 Flota Velocity Express
insert into public.vehicles (
  id, carrier_id, code, brand, model, license_plate, vehicle_type,
  capacity_kg, volume_m3, supports_refrigerated, supports_hazardous,
  supports_oversized, location, status, updated_at
)
select
  v.id, c.id, v.code, v.brand, v.model, v.license_plate, v.vehicle_type,
  v.capacity_kg, v.volume_m3, v.supports_refrigerated, v.supports_hazardous,
  v.supports_oversized, v.location, v.status, now()
from (
  values
    ('e2000000-0000-0000-0000-000000000005'::uuid, 'VEL-TRK-301', 'Isuzu', 'Giga 6x2 Express Freight', 'T4E-108', 'RIGID_TRUCK', 12000, 40, false, false, false, 'Lima, PE', 'AVAILABLE'),
    ('e2000000-0000-0000-0000-000000000006'::uuid, 'VEL-TRK-302', 'Hino', '500 Series Urban Fast', 'T9F-773', 'RIGID_TRUCK', 10000, 35, false, false, false, 'Arequipa, PE', 'AVAILABLE')
) as v(id, code, brand, model, license_plate, vehicle_type, capacity_kg, volume_m3, supports_refrigerated, supports_hazardous, supports_oversized, location, status)
cross join (select id from public.carriers where code = 'VELOCITY_EXPRESS' limit 1) c
on conflict (code) do update
set carrier_id = excluded.carrier_id, brand = excluded.brand, model = excluded.model,
    license_plate = excluded.license_plate, vehicle_type = excluded.vehicle_type,
    capacity_kg = excluded.capacity_kg, volume_m3 = excluded.volume_m3,
    supports_refrigerated = excluded.supports_refrigerated, supports_hazardous = excluded.supports_hazardous,
    supports_oversized = excluded.supports_oversized, location = excluded.location,
    status = excluded.status, updated_at = now();

-- 8.7 Flota Nexo Demo (Condicional Aislada: Solo si el carrier NEXO existe en el entorno)
insert into public.vehicles (
  id, carrier_id, code, brand, model, license_plate, vehicle_type,
  capacity_kg, volume_m3, supports_refrigerated, supports_hazardous,
  supports_oversized, location, status, updated_at
)
select
  v.id, c.id, v.code, v.brand, v.model, v.license_plate, v.vehicle_type,
  v.capacity_kg, v.volume_m3, v.supports_refrigerated, v.supports_hazardous,
  v.supports_oversized, v.location, v.status, now()
from (
  values
    ('e1000000-0000-0000-0000-000000000001'::uuid, 'NEX-DEMO-101', 'Hino', '500 Series Cortina Sider', 'D1-LOCAL-101', 'RIGID_TRUCK', 12000, 40, false, false, false, 'Lima, PE', 'AVAILABLE'),
    ('e1000000-0000-0000-0000-000000000002'::uuid, 'NEX-DEMO-201', 'International', 'ProStar Furgón Seco', 'D1-PECL-201', 'TRACTOR_TRAILER', 16000, 50, false, false, false, 'Callao, PE', 'AVAILABLE')
) as v(id, code, brand, model, license_plate, vehicle_type, capacity_kg, volume_m3, supports_refrigerated, supports_hazardous, supports_oversized, location, status)
join public.carriers c on (c.code in ('NEXO', 'NEXO_DEMO') or c.id = 'b1000000-0000-0000-0000-000000000001')
on conflict (code) do update
set carrier_id = excluded.carrier_id, brand = excluded.brand, model = excluded.model,
    license_plate = excluded.license_plate, vehicle_type = excluded.vehicle_type,
    capacity_kg = excluded.capacity_kg, volume_m3 = excluded.volume_m3,
    supports_refrigerated = excluded.supports_refrigerated, supports_hazardous = excluded.supports_hazardous,
    supports_oversized = excluded.supports_oversized, location = excluded.location,
    status = excluded.status, updated_at = now();

commit;

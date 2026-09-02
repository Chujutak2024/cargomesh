-- Migration: 20260902101000_seed_additional_organizations.sql
-- Description: Sembrado de 2 organizaciones generadoras de carga (shippers) adicionales
-- enfocadas estrictamente en transporte terrestre en camiones (Agroexportación refrigerada y Materiales de construcción).

begin;

-- =============================================================================
-- 1. ORGANIZACIONES SHIPPERS (Solo transporte terrestre en camión)
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
-- 2. PREFERENCIAS OPERATIVAS DE CADA ORGANIZACIÓN
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
-- 3. MIEMBROS DE LA ORGANIZACIÓN (Usuarios Shippers Responsables)
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
values
  (
    'e0000000-0000-0000-0000-000000000002',
    'a0000000-0000-0000-0000-000000000002',
    'd0000000-0000-0000-0000-000000000002',
    'Lucía Paredes',
    'lucia.paredes@agrivas.pe',
    'OWNER',
    'ACTIVE',
    now(),
    now()
  ),
  (
    'e0000000-0000-0000-0000-000000000003',
    'a0000000-0000-0000-0000-000000000003',
    'd0000000-0000-0000-0000-000000000003',
    'Marco Benavides',
    'marco.benavides@cementosandino.pe',
    'OWNER',
    'ACTIVE',
    now(),
    now()
  )
on conflict (organization_id, auth_user_id) do update
set display_name = excluded.display_name,
    corporate_email = excluded.corporate_email,
    role = excluded.role,
    status = excluded.status,
    updated_at = now();

-- =============================================================================
-- 4. PERFILES DE CARGA PARA SUGERENCIAS INTELIGENTES WEBMCP
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

commit;

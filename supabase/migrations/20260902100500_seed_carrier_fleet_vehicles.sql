-- Migration: 20260902100500_seed_carrier_fleet_vehicles.sql
-- Description: Sembrado enriquecido de flota vehicular de camiones para los 4 transportistas registrados
-- Incluye tracto-camiones pesados, furgones refrigerados (Reefer), camiones rígidos y transporte multimodal.

begin;

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
  -- =========================================================================
  -- 1. ANDES EXPRESS (b0000000-0000-0000-0000-000000000001) — Carga Pesada & Minería
  -- =========================================================================
  (
    'e0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000001',
    'AND-TRK-101',
    'Scania',
    'R450 Highline 6x4',
    'V9A-812',
    'TRACTOR_TRAILER',
    28000,
    60,
    false,
    true,
    true,
    'Callao, PE',
    'AVAILABLE',
    now()
  ),
  (
    'e0000000-0000-0000-0000-000000000012',
    'b0000000-0000-0000-0000-000000000001',
    'AND-TRK-102',
    'Volvo',
    'FH16 540 Lowboy',
    'V7B-441',
    'TRACTOR_TRAILER',
    32000,
    75,
    false,
    true,
    true,
    'Arequipa, PE',
    'AVAILABLE',
    now()
  ),
  (
    'e0000000-0000-0000-0000-000000000013',
    'b0000000-0000-0000-0000-000000000001',
    'AND-TRK-103',
    'Scania',
    'G410 Furgón Minero',
    'V3C-902',
    'TRACTOR_TRAILER',
    20000,
    50,
    false,
    false,
    false,
    'Tacna, PE',
    'IN_TRANSIT',
    now()
  ),

  -- =========================================================================
  -- 2. TRANSPORTES INCA (b0000000-0000-0000-0000-000000000002) — Refrigerados & Agro
  -- =========================================================================
  (
    'e0000000-0000-0000-0000-000000000002',
    'b0000000-0000-0000-0000-000000000002',
    'INC-TRK-201',
    'Volvo',
    'FM 420 Reefer Thermo King',
    'F4D-319',
    'TRACTOR_TRAILER',
    15000,
    45,
    true,
    false,
    false,
    'Callao, PE',
    'AVAILABLE',
    now()
  ),
  (
    'e0000000-0000-0000-0000-000000000022',
    'b0000000-0000-0000-0000-000000000002',
    'INC-TRK-202',
    'Mercedes-Benz',
    'Actros 2645 Dry Van',
    'F8E-220',
    'TRACTOR_TRAILER',
    24000,
    70,
    false,
    false,
    false,
    'Lima, PE',
    'AVAILABLE',
    now()
  ),
  (
    'e0000000-0000-0000-0000-000000000023',
    'b0000000-0000-0000-0000-000000000002',
    'INC-TRK-203',
    'Volvo',
    'FH 460 Multi-Temp Reefer',
    'F1G-554',
    'TRACTOR_TRAILER',
    18000,
    52,
    true,
    false,
    false,
    'Ica, PE',
    'AVAILABLE',
    now()
  ),

  -- =========================================================================
  -- 3. PACIFIC CARGO LOGISTICS (b0000000-0000-0000-0000-000000000003) — Express & Rápido
  -- =========================================================================
  (
    'e0000000-0000-0000-0000-000000000003',
    'b0000000-0000-0000-0000-000000000003',
    'PAC-TRK-301',
    'Freightliner',
    'Cascadia 126 Express Van',
    'C5H-781',
    'TRACTOR_TRAILER',
    15000,
    45,
    false,
    false,
    false,
    'Callao, PE',
    'AVAILABLE',
    now()
  ),
  (
    'e0000000-0000-0000-0000-000000000032',
    'b0000000-0000-0000-0000-000000000003',
    'PAC-TRK-302',
    'Isuzu',
    'Forward 1400 Box Truck',
    'C9J-112',
    'RIGID_TRUCK',
    8000,
    30,
    false,
    false,
    false,
    'Lima, PE',
    'AVAILABLE',
    now()
  ),
  (
    'e0000000-0000-0000-0000-000000000033',
    'b0000000-0000-0000-0000-000000000003',
    'PAC-TRK-303',
    'Hino',
    '700 Series Intermodal',
    'C2K-909',
    'TRACTOR_TRAILER',
    26000,
    65,
    false,
    true,
    false,
    'Callao, PE',
    'AVAILABLE',
    now()
  ),

  -- =========================================================================
  -- 4. NEXO DEMO LOGISTICS (b1000000-0000-0000-0000-000000000001) — Escenarios D1
  -- =========================================================================
  (
    'e1000000-0000-0000-0000-000000000001',
    'b1000000-0000-0000-0000-000000000001',
    'NEX-DEMO-101',
    'Hino',
    '500 Series Cortina Sider',
    'D1-LOCAL-101',
    'RIGID_TRUCK',
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
    'e1000000-0000-0000-0000-000000000002',
    'b1000000-0000-0000-0000-000000000001',
    'NEX-DEMO-201',
    'International',
    'ProStar Furgón Seco',
    'D1-PECL-201',
    'TRACTOR_TRAILER',
    16000,
    50,
    false,
    false,
    false,
    'Callao, PE',
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
    updated_at = excluded.updated_at;

commit;

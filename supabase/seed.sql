-- ============================================================================
-- CargoMesh v4 Deterministic Seed Data (International Cross-Border FTL: PE -> CL)
-- ============================================================================

-- 1. Organizations
INSERT INTO organizations (id, name, code, status, default_currency) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'ACME Mining Corp', 'ACME', 'ACTIVE', 'USD'),
  ('a0000000-0000-0000-0000-000000000002', 'Andes Agro Export', 'AGRO', 'ACTIVE', 'USD')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name;

-- 2. Organization Preferences
INSERT INTO organization_preferences (id, organization_id, default_strategy, max_pickup_wait_hours, budget_default, allow_auto_booking, confidence_threshold) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'BALANCED', 2.0, 2000.0, true, 85.0)
ON CONFLICT (id) DO NOTHING;

-- 3. Cargo Categories
INSERT INTO cargo_categories (id, code, name, description, active) VALUES
  ('c0000000-0000-0000-0000-000000000001', 'GENERAL', 'Carga General', 'Mercancía paletizada, repuestos mineros y bultos estándar', true),
  ('c0000000-0000-0000-0000-000000000002', 'FOOD', 'Alimentos y Perecibles', 'Alimentos con o sin cadena de frío', true),
  ('c0000000-0000-0000-0000-000000000003', 'MACHINERY', 'Maquinaria y Minería', 'Equipos industriales y repuestos pesados', true),
  ('c0000000-0000-0000-0000-000000000004', 'CONSTRUCTION', 'Construcción', 'Materiales y herramientas de obra', true),
  ('c0000000-0000-0000-0000-000000000005', 'CHEMICALS', 'Químicos / HAZMAT', 'Sustancias químicas controladas', true)
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name;

-- 4. Carriers (3 Providers for WebMCP Discovery)
INSERT INTO carriers (id, name, code, provider_type, status) VALUES
  ('d0000000-0000-0000-0000-000000000001', 'Andes Freight S.A.', 'ANDES', 'CARRIER', 'ACTIVE'),
  ('d0000000-0000-0000-0000-000000000002', 'Inca Logistics Corp', 'INCA', 'ENTERPRISE_CARRIER', 'ACTIVE'),
  ('d0000000-0000-0000-0000-000000000003', 'Pacific Cargo Express', 'PACIFIC', 'SMALL_FLEET', 'ACTIVE')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name;

-- 5. Carrier Services (International Corridor: Peru -> Chile)
INSERT INTO carrier_services (
  id, carrier_id, transport_mode, service_type, origin_country, origin_region,
  destination_country, destination_region, max_capacity_kg, max_volume_m3,
  supports_refrigerated, supports_hazardous, supports_fragile, supports_oversized, active
) VALUES
  ('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'ROAD', 'FTL', 'PE', 'Lima', 'CL', 'Santiago', 18000, 45, true, false, true, false, true),
  ('e0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000002', 'ROAD', 'FTL', 'PE', 'Lima', 'CL', 'Santiago', 24000, 60, true, true, true, true, true),
  ('e0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000003', 'ROAD', 'FTL', 'PE', 'Lima', 'CL', 'Santiago', 15000, 35, false, false, false, false, true)
ON CONFLICT (id) DO NOTHING;

-- 6. Carrier Service Categories Mapping
INSERT INTO carrier_service_cargo_categories (carrier_service_id, cargo_category_id) VALUES
  ('e0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001'),
  ('e0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002'),
  ('e0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001'),
  ('e0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000003'),
  ('e0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000005'),
  ('e0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000001')
ON CONFLICT (carrier_service_id, cargo_category_id) DO NOTHING;

-- 7. Carrier Metrics (International Corridor Lima -> Santiago)
INSERT INTO carrier_metrics (
  id, carrier_id, transport_mode, origin_country, origin_city,
  destination_country, destination_city, completed_freight_requests,
  successful_freight_requests, success_rate, avg_cost, avg_delay_hours, cancellation_rate
) VALUES
  ('f0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'ROAD', 'PE', 'Lima', 'CL', 'Santiago', 42, 40, 0.96, 1760.0, 1.2, 0.02),
  ('f0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000002', 'ROAD', 'PE', 'Lima', 'CL', 'Santiago', 35, 34, 0.98, 1920.0, 0.8, 0.01),
  ('f0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000003', 'ROAD', 'PE', 'Lima', 'CL', 'Santiago', 13, 11, 0.86, 1590.0, 3.4, 0.08)
ON CONFLICT (id) DO NOTHING;

-- 8. Vehicles (Units in Terminal Lima / Callao)
INSERT INTO vehicles (
  id, carrier_id, code, brand, vehicle_type, capacity_kg, volume_m3,
  supports_refrigerated, supports_hazardous, supports_oversized, location, status
) VALUES
  ('v0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'AND-TRK-101', 'Scania', 'Heavy Semi-Trailer 18t', 18000, 45, true, false, false, 'Terminal Lima Callao, PE', 'AVAILABLE'),
  ('v0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', 'AND-TRK-102', 'Scania', 'Box Truck 12t', 12000, 30, false, false, false, 'Terminal Callao, PE', 'AVAILABLE'),
  ('v0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000002', 'INC-TRK-901', 'Volvo', 'Volvo FH Globetrotter 24t', 24000, 60, true, true, true, 'Terminal Ate Central, PE', 'AVAILABLE'),
  ('v0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000003', 'PAC-TRK-301', 'Freightliner', 'Flatbed 15t', 15000, 35, false, false, false, 'Terminal Lima Sur, PE', 'AVAILABLE')
ON CONFLICT (code) DO UPDATE SET status = EXCLUDED.status;

-- 9. Base Freight Request (Golden Flow 1: FR-1042 Lima -> Santiago)
INSERT INTO freight_requests (
  id, organization_id, cargo_category_id, code, origin_country, origin_city,
  destination_country, destination_city, cargo_weight_kg, cargo_volume_m3,
  package_count, service_type, transport_mode, requires_refrigeration,
  is_hazardous, is_fragile, is_oversized, is_high_value, is_stackable, special_instructions,
  required_pickup, delivery_deadline, budget_max, optimization_strategy, status
) VALUES (
  '10000000-0000-0000-0000-000000001042',
  'a0000000-0000-0000-0000-000000000001',
  'c0000000-0000-0000-0000-000000000001',
  'FR-1042',
  'PE', 'Lima',
  'CL', 'Santiago',
  8000, 18.0,
  12, 'FTL', 'ROAD', false,
  false, false, false, false, true,
  'Repuestos para perforadora minera en cajas de madera. Requiere montacargas estándar y trámite MIC/DTA en paso fronterizo Santa Rosa/Chacalluta.',
  NOW() + INTERVAL '2 hours',
  NOW() + INTERVAL '72 hours',
  2000.0, 'BALANCED', 'ASSIGNED'
)
ON CONFLICT (code) DO NOTHING;

-- 10. WebMCP Carrier Offers (Cross-border breakdown)
INSERT INTO carrier_offers (
  id, freight_request_id, carrier_id, vehicle_id, offer_reference,
  transport_mode, service_type, price, currency, price_breakdown,
  customs_coordination_included, customs_notes, required_documents,
  estimated_pickup, estimated_delivery, available_capacity_kg, available_volume_m3,
  valid_until, compatibility_status, status
) VALUES
  (
    '70000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000001042',
    'd0000000-0000-0000-0000-000000000001',
    'v0000000-0000-0000-0000-000000000001',
    'AND-OFF-8821',
    'ROAD',
    'FTL',
    1760.00,
    'USD',
    '{"base_freight": 1500, "border_handling": 180, "insurance": 80}'::jsonb,
    true,
    'Carrier coordina transmisión electrónica MIC/DTA en Santa Rosa-Chacalluta.',
    '["commercial_invoice", "packing_list"]'::jsonb,
    NOW() + INTERVAL '2 hours',
    NOW() + INTERVAL '48 hours',
    18000,
    45,
    NOW() + INTERVAL '6 hours',
    'COMPATIBLE',
    'ACCEPTED'
  ),
  (
    '70000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000001042',
    'd0000000-0000-0000-0000-000000000002',
    'v0000000-0000-0000-0000-000000000003',
    'INC-OFF-9102',
    'ROAD',
    'FTL',
    1920.00,
    'USD',
    '{"base_freight": 1650, "border_handling": 190, "insurance": 80}'::jsonb,
    true,
    'Coordinación de frontera y seguro premium internacional incluidos.',
    '["commercial_invoice", "packing_list"]'::jsonb,
    NOW() + INTERVAL '3 hours',
    NOW() + INTERVAL '44 hours',
    24000,
    60,
    NOW() + INTERVAL '6 hours',
    'COMPATIBLE',
    'PENDING'
  ),
  (
    '70000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000001042',
    'd0000000-0000-0000-0000-000000000003',
    'v0000000-0000-0000-0000-000000000004',
    'PAC-OFF-3011',
    'ROAD',
    'FTL',
    1590.00,
    'USD',
    '{"base_freight": 1400, "border_handling": 120, "insurance": 70}'::jsonb,
    true,
    'Flete básico carretera sin gestión de inspección prioritaria en frontera.',
    '["commercial_invoice", "packing_list"]'::jsonb,
    NOW() + INTERVAL '4 hours',
    NOW() + INTERVAL '60 hours',
    15000,
    35,
    NOW() + INTERVAL '6 hours',
    'COMPATIBLE',
    'PENDING'
  )
ON CONFLICT (offer_reference) DO NOTHING;

-- 11. Freight Decisions
INSERT INTO freight_decisions (
  id, freight_request_id, selected_offer_id, optimization_strategy,
  heuristic_score, confidence_score, decision_reason, requires_review
) VALUES (
  '90000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000001042',
  '70000000-0000-0000-0000-000000000001',
  'BALANCED',
  89.4,
  91.2,
  'Andes Freight ofrece la mejor relación para el corredor Lima-Santiago: $1,760 USD (dentro del presupuesto de $2,000 USD), 96% de puntualidad en 42 viajes internacionales, gestión documental MIC/DTA incluida y unidad Scania R450 disponible de inmediato.',
  false
)
ON CONFLICT (id) DO NOTHING;

-- 12. Booking Confirmed for Golden Flow 1
INSERT INTO bookings (
  id, freight_request_id, carrier_id, offer_id, provider_reference,
  current_location, updated_eta, status, booked_at
) VALUES (
  '80000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000001042',
  'd0000000-0000-0000-0000-000000000001',
  '70000000-0000-0000-0000-000000000001',
  'AND-BOOK-8821',
  'Complejo Fronterizo Santa Rosa (Tacna, PE) / Chacalluta (Arica, CL)',
  NOW() + INTERVAL '24 hours',
  'IN_TRANSIT',
  NOW() - INTERVAL '6 hours'
)
ON CONFLICT (id) DO NOTHING;

-- 13. Booking Events (Milestones Timeline)
INSERT INTO booking_events (
  id, booking_id, event_type, occurred_at, country_code, city, description, source, metadata
) VALUES
  (
    'e1000000-0000-0000-0000-000000000001',
    '80000000-0000-0000-0000-000000000001',
    'CONFIRMED',
    NOW() - INTERVAL '6 hours',
    'PE',
    'Lima',
    'Reserva vinculante confirmada mediante WebMCP con Andes Freight (AND-BOOK-8821).',
    'CARGOMESH_AGENT',
    '{"rate_usd": 1760, "unit": "Scania R450 Heavy Semi-Trailer"}'::jsonb
  ),
  (
    'e1000000-0000-0000-0000-000000000002',
    '80000000-0000-0000-0000-000000000001',
    'PICKUP_SCHEDULED',
    NOW() - INTERVAL '5 hours',
    'PE',
    'Lima',
    'Ventana de recojo programada en Almacén Central Callao (08:00 - 10:00).',
    'CARRIER_WEBMCP',
    '{"dock": "Puerta 4", "driver_ready": true}'::jsonb
  ),
  (
    'e1000000-0000-0000-0000-000000000003',
    '80000000-0000-0000-0000-000000000001',
    'PICKED_UP',
    NOW() - INTERVAL '4 hours',
    'PE',
    'Lima (Callao)',
    'Carga estibada exitosamente (8,000 kg en 12 bultos). Manifiesto de carga emitido.',
    'CARRIER_WEBMCP',
    '{"weight_verified_kg": 8000, "seal_number": "AND-SL-9081"}'::jsonb
  ),
  (
    'e1000000-0000-0000-0000-000000000004',
    '80000000-0000-0000-0000-000000000001',
    'IN_TRANSIT',
    NOW() - INTERVAL '2 hours',
    'PE',
    'Panamericana Sur (Ica)',
    'Unidad en tránsito hacia frontera sur. Velocidad y condiciones nominales.',
    'CARRIER_WEBMCP',
    '{"corridor": "Panamericana Sur PE", "km": 300}'::jsonb
  ),
  (
    'e1000000-0000-0000-0000-000000000005',
    '80000000-0000-0000-0000-000000000001',
    'BORDER_PROCESSING',
    NOW(),
    'PE / CL',
    'Tacna / Arica',
    'Ingreso al Complejo Fronterizo Santa Rosa - Chacalluta. Trámite documental MIC/DTA en proceso.',
    'CARRIER_WEBMCP',
    '{"customs_status": "PROCESSING", "docs_verified": ["commercial_invoice", "packing_list"]}'::jsonb
  )
ON CONFLICT (id) DO NOTHING;

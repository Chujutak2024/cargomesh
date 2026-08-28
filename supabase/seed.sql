-- ============================================================================
-- CargoMesh v4 Deterministic Seed Data (Aligned with Final Frozen UX Contract)
-- ============================================================================

-- 1. Organizations
INSERT INTO organizations (id, name, code, status, default_currency) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'ACME Mining Corp', 'ACME', 'ACTIVE', 'USD'),
  ('a0000000-0000-0000-0000-000000000002', 'Andes Agro Export', 'AGRO', 'ACTIVE', 'USD')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name;

-- 2. Organization Preferences
INSERT INTO organization_preferences (id, organization_id, default_strategy, max_pickup_wait_hours, budget_default, allow_auto_booking, confidence_threshold) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'BALANCED', 2.0, 850.0, true, 85.0)
ON CONFLICT (id) DO NOTHING;

-- 3. Cargo Categories
INSERT INTO cargo_categories (id, code, name, description, active) VALUES
  ('c0000000-0000-0000-0000-000000000001', 'GENERAL', 'Carga General', 'Mercancía paletizada, cajas y bultos estándar', true),
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

-- 5. Carrier Services
INSERT INTO carrier_services (id, carrier_id, transport_mode, service_type, origin_country, origin_region, destination_country, destination_region, max_capacity_kg, max_volume_m3, supports_refrigerated, supports_hazardous, supports_fragile, supports_oversized, active) VALUES
  ('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'ROAD', 'FTL', 'PE', 'Lima', 'PE', 'Arequipa', 18000, 45, true, false, true, false, true),
  ('e0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000002', 'ROAD', 'FTL', 'PE', 'Lima', 'PE', 'Arequipa', 24000, 60, true, true, true, true, true),
  ('e0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000003', 'ROAD', 'FTL', 'PE', 'Lima', 'PE', 'Arequipa', 15000, 35, false, false, false, false, true)
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

-- 7. Carrier Metrics (Historical Data matching Mockups)
INSERT INTO carrier_metrics (id, carrier_id, transport_mode, origin_country, origin_city, destination_country, destination_city, completed_freight_requests, successful_freight_requests, success_rate, avg_cost, avg_delay_hours, cancellation_rate) VALUES
  ('f0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'ROAD', 'PE', 'Lima', 'PE', 'Arequipa', 42, 40, 0.96, 760.0, 1.2, 0.02),
  ('f0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000002', 'ROAD', 'PE', 'Lima', 'PE', 'Arequipa', 35, 34, 0.98, 820.0, 0.8, 0.01),
  ('f0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000003', 'ROAD', 'PE', 'Lima', 'PE', 'Arequipa', 13, 11, 0.86, 690.0, 3.4, 0.08)
ON CONFLICT (id) DO NOTHING;

-- 8. Vehicles (Active units in terminal)
INSERT INTO vehicles (id, carrier_id, code, brand, vehicle_type, capacity_kg, volume_m3, supports_refrigerated, supports_hazardous, supports_oversized, location, status) VALUES
  ('v0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'AND-TRK-101', 'Scania', 'Heavy Semi-Trailer', 18000, 45, true, false, false, 'Terminal Lima Norte', 'AVAILABLE'),
  ('v0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', 'AND-TRK-102', 'Scania', 'Box Truck', 12000, 30, false, false, false, 'Terminal Callao', 'AVAILABLE'),
  ('v0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000002', 'INC-TRK-901', 'Volvo', 'Volvo FH Globetrotter', 24000, 60, true, true, true, 'Terminal Ate Central', 'AVAILABLE'),
  ('v0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000003', 'PAC-TRK-301', 'Freightliner', 'Flatbed', 15000, 35, false, false, false, 'Terminal Lima Sur', 'AVAILABLE')
ON CONFLICT (code) DO UPDATE SET status = EXCLUDED.status;

-- 9. Base Freight Request (Golden Flow 1: FR-1042)
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
  'PE', 'Arequipa',
  8000, 18.0,
  12, 'FTL', 'ROAD', false,
  false, false, false, false, true,
  'Repuestos para perforadora minera en cajas de madera. Requiere montacargas estándar para estiba.',
  NOW() + INTERVAL '2 hours',
  NOW() + INTERVAL '48 hours',
  850.0, 'BALANCED', 'ASSIGNED'
)
ON CONFLICT (code) DO NOTHING;

-- 10. WebMCP Carrier Offers
INSERT INTO carrier_offers (
  id, freight_request_id, carrier_id, vehicle_id, offer_reference,
  transport_mode, service_type, price, currency, estimated_pickup, estimated_delivery,
  available_capacity_kg, available_volume_m3, valid_until, compatibility_status, status
) VALUES
  ('70000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000001042', 'd0000000-0000-0000-0000-000000000001', 'v0000000-0000-0000-0000-000000000001', 'AND-OFF-8821', 'ROAD', 'FTL', 760.00, 'USD', NOW() + INTERVAL '2 hours', NOW() + INTERVAL '18 hours', 18000, 45, NOW() + INTERVAL '6 hours', 'COMPATIBLE', 'ACCEPTED'),
  ('70000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000001042', 'd0000000-0000-0000-0000-000000000002', 'v0000000-0000-0000-0000-000000000003', 'INC-OFF-9102', 'ROAD', 'FTL', 820.00, 'USD', NOW() + INTERVAL '3 hours', NOW() + INTERVAL '16 hours', 24000, 60, NOW() + INTERVAL '6 hours', 'COMPATIBLE', 'PENDING'),
  ('70000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000001042', 'd0000000-0000-0000-0000-000000000003', 'v0000000-0000-0000-0000-000000000004', 'PAC-OFF-3011', 'ROAD', 'FTL', 690.00, 'USD', NOW() + INTERVAL '4 hours', NOW() + INTERVAL '24 hours', 15000, 35, NOW() + INTERVAL '6 hours', 'COMPATIBLE', 'PENDING')
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
  'Andes Freight ofrece el mejor equilibrio: $760 dentro del presupuesto, 96% de puntualidad en 42 viajes históricos y unidad Scania disponible de inmediato.',
  false
)
ON CONFLICT (id) DO NOTHING;

-- 12. Booking Confirmed for Golden Flow 1
INSERT INTO bookings (id, freight_request_id, carrier_id, offer_id, provider_reference, status, booked_at) VALUES
  ('80000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000001042', 'd0000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', 'AND-BOOK-8821', 'CONFIRMED', NOW())
ON CONFLICT (id) DO NOTHING;

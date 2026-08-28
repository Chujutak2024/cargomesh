-- ============================================================================
-- Migration 002: Cross-Border Capabilities, Booking Events Tracking, Checks & RLS
-- ============================================================================

-- 1. Alter carrier_offers to support international cross-border fields
ALTER TABLE carrier_offers 
  ADD COLUMN IF NOT EXISTS price_breakdown JSONB DEFAULT '{"base_freight": 0, "border_handling": 0, "insurance": 0}'::jsonb,
  ADD COLUMN IF NOT EXISTS customs_coordination_included BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS customs_notes TEXT,
  ADD COLUMN IF NOT EXISTS required_documents JSONB DEFAULT '["commercial_invoice", "packing_list"]'::jsonb;

-- 2. Alter bookings to support tracking and ETA updates
ALTER TABLE bookings 
  ADD COLUMN IF NOT EXISTS current_location TEXT DEFAULT 'Terminal Lima Callao, PE',
  ADD COLUMN IF NOT EXISTS updated_eta TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- 3. Create booking_events table for persistent lifecycle milestone tracking
CREATE TABLE IF NOT EXISTS booking_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  country_code TEXT NOT NULL DEFAULT 'PE',
  city TEXT NOT NULL,
  description TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'CARRIER_WEBMCP',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast tracking lookups by booking
CREATE INDEX IF NOT EXISTS idx_booking_events_booking_id ON booking_events(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_events_occurred_at ON booking_events(occurred_at DESC);

-- 4. Add Numerical CHECK Constraints to protect data integrity
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_freight_requests_weight') THEN
    ALTER TABLE freight_requests ADD CONSTRAINT chk_freight_requests_weight CHECK (cargo_weight_kg > 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_carrier_offers_price') THEN
    ALTER TABLE carrier_offers ADD CONSTRAINT chk_carrier_offers_price CHECK (price >= 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_carrier_metrics_success_rate') THEN
    ALTER TABLE carrier_metrics ADD CONSTRAINT chk_carrier_metrics_success_rate CHECK (success_rate >= 0 AND success_rate <= 1.0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_freight_decisions_confidence') THEN
    ALTER TABLE freight_decisions ADD CONSTRAINT chk_freight_decisions_confidence CHECK (confidence_score >= 0 AND confidence_score <= 100.0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_freight_decisions_heuristic') THEN
    ALTER TABLE freight_decisions ADD CONSTRAINT chk_freight_decisions_heuristic CHECK (heuristic_score >= 0 AND heuristic_score <= 100.0);
  END IF;
END $$;

-- 5. Enable Row Level Security (RLS) on all 13 Tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE cargo_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE freight_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE carriers ENABLE ROW LEVEL SECURITY;
ALTER TABLE carrier_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE carrier_service_cargo_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE carrier_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE carrier_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE freight_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_events ENABLE ROW LEVEL SECURITY;

-- 6. Add Read-Access Policies for Public/Authenticated Client Queries (Mutations handled server-side)
DO $$
BEGIN
  -- Organizations
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'organizations_read_policy') THEN
    CREATE POLICY organizations_read_policy ON organizations FOR SELECT TO anon, authenticated USING (true);
  END IF;

  -- Cargo Categories
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'cargo_categories_read_policy') THEN
    CREATE POLICY cargo_categories_read_policy ON cargo_categories FOR SELECT TO anon, authenticated USING (true);
  END IF;

  -- Carriers
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'carriers_read_policy') THEN
    CREATE POLICY carriers_read_policy ON carriers FOR SELECT TO anon, authenticated USING (true);
  END IF;

  -- Carrier Services
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'carrier_services_read_policy') THEN
    CREATE POLICY carrier_services_read_policy ON carrier_services FOR SELECT TO anon, authenticated USING (true);
  END IF;

  -- Carrier Metrics
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'carrier_metrics_read_policy') THEN
    CREATE POLICY carrier_metrics_read_policy ON carrier_metrics FOR SELECT TO anon, authenticated USING (true);
  END IF;

  -- Vehicles
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'vehicles_read_policy') THEN
    CREATE POLICY vehicles_read_policy ON vehicles FOR SELECT TO anon, authenticated USING (true);
  END IF;

  -- Freight Requests Read
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'freight_requests_read_policy') THEN
    CREATE POLICY freight_requests_read_policy ON freight_requests FOR SELECT TO anon, authenticated USING (true);
  END IF;

  -- Carrier Offers Read
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'carrier_offers_read_policy') THEN
    CREATE POLICY carrier_offers_read_policy ON carrier_offers FOR SELECT TO anon, authenticated USING (true);
  END IF;

  -- Freight Decisions Read
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'freight_decisions_read_policy') THEN
    CREATE POLICY freight_decisions_read_policy ON freight_decisions FOR SELECT TO anon, authenticated USING (true);
  END IF;

  -- Bookings Read
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'bookings_read_policy') THEN
    CREATE POLICY bookings_read_policy ON bookings FOR SELECT TO anon, authenticated USING (true);
  END IF;

  -- Booking Events Read
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'booking_events_read_policy') THEN
    CREATE POLICY booking_events_read_policy ON booking_events FOR SELECT TO anon, authenticated USING (true);
  END IF;
END $$;

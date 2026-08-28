-- CargoMesh v4 Schema Definition
-- Optimized for PostgreSQL / Supabase

-- 1. Organizations
CREATE TABLE IF NOT EXISTS organizations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    default_currency TEXT NOT NULL DEFAULT 'USD',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Users
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL DEFAULT 'OPERATIONS',
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Organization Preferences
CREATE TABLE IF NOT EXISTS organization_preferences (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    default_optimization_strategy TEXT NOT NULL DEFAULT 'BALANCED',
    max_pickup_wait_hours NUMERIC NOT NULL DEFAULT 2,
    preferred_carrier_id TEXT,
    preferred_vehicle_brand TEXT,
    budget_default NUMERIC,
    allow_auto_booking BOOLEAN NOT NULL DEFAULT TRUE,
    confidence_threshold NUMERIC NOT NULL DEFAULT 85,
    usual_budget_min NUMERIC,
    usual_budget_max NUMERIC,
    frequent_routes JSONB DEFAULT '[]'::jsonb
);

-- 4. Cargo Categories Catalog
CREATE TABLE IF NOT EXISTS cargo_categories (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    active BOOLEAN NOT NULL DEFAULT TRUE
);

-- 5. Freight Requests
CREATE TABLE IF NOT EXISTS freight_requests (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id),
    requested_by_user_id TEXT NOT NULL REFERENCES users(id),
    cargo_category_id TEXT NOT NULL REFERENCES cargo_categories(id),
    code TEXT NOT NULL UNIQUE,
    origin_country TEXT NOT NULL,
    origin_city TEXT NOT NULL,
    destination_country TEXT NOT NULL,
    destination_city TEXT NOT NULL,
    cargo_weight_kg NUMERIC NOT NULL,
    cargo_volume_m3 NUMERIC,
    package_count INTEGER,
    service_type TEXT NOT NULL DEFAULT 'FTL',
    transport_mode TEXT NOT NULL DEFAULT 'ROAD',
    requires_refrigeration BOOLEAN NOT NULL DEFAULT FALSE,
    is_hazardous BOOLEAN NOT NULL DEFAULT FALSE,
    is_fragile BOOLEAN NOT NULL DEFAULT FALSE,
    is_oversized BOOLEAN NOT NULL DEFAULT FALSE,
    special_instructions TEXT,
    required_pickup TIMESTAMPTZ NOT NULL,
    delivery_deadline TIMESTAMPTZ,
    max_pickup_wait_hours NUMERIC,
    budget_max NUMERIC,
    optimization_strategy TEXT NOT NULL DEFAULT 'BALANCED',
    preferred_carrier_id TEXT,
    preferred_vehicle_brand TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Carriers
CREATE TABLE IF NOT EXISTS carriers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    provider_type TEXT NOT NULL DEFAULT 'CARRIER',
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    description TEXT,
    fleet_size INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Carrier Services
CREATE TABLE IF NOT EXISTS carrier_services (
    id TEXT PRIMARY KEY,
    carrier_id TEXT NOT NULL REFERENCES carriers(id) ON DELETE CASCADE,
    transport_mode TEXT NOT NULL DEFAULT 'ROAD',
    service_type TEXT NOT NULL DEFAULT 'FTL',
    origin_country TEXT NOT NULL,
    origin_region TEXT NOT NULL,
    destination_country TEXT NOT NULL,
    destination_region TEXT NOT NULL,
    max_capacity_kg NUMERIC NOT NULL,
    max_volume_m3 NUMERIC NOT NULL,
    supports_refrigerated BOOLEAN NOT NULL DEFAULT FALSE,
    supports_hazardous BOOLEAN NOT NULL DEFAULT FALSE,
    supports_fragile BOOLEAN NOT NULL DEFAULT FALSE,
    supports_oversized BOOLEAN NOT NULL DEFAULT FALSE,
    active BOOLEAN NOT NULL DEFAULT TRUE
);

-- 8. Vehicles
CREATE TABLE IF NOT EXISTS vehicles (
    id TEXT PRIMARY KEY,
    carrier_id TEXT NOT NULL REFERENCES carriers(id) ON DELETE CASCADE,
    code TEXT NOT NULL UNIQUE,
    brand TEXT NOT NULL,
    vehicle_type TEXT NOT NULL,
    capacity_kg NUMERIC NOT NULL,
    volume_m3 NUMERIC NOT NULL,
    supports_refrigerated BOOLEAN NOT NULL DEFAULT FALSE,
    supports_hazardous BOOLEAN NOT NULL DEFAULT FALSE,
    supports_oversized BOOLEAN NOT NULL DEFAULT FALSE,
    location TEXT,
    status TEXT NOT NULL DEFAULT 'AVAILABLE'
);

-- 9. Carrier Metrics
CREATE TABLE IF NOT EXISTS carrier_metrics (
    id TEXT PRIMARY KEY,
    carrier_id TEXT NOT NULL REFERENCES carriers(id) ON DELETE CASCADE,
    transport_mode TEXT NOT NULL DEFAULT 'ROAD',
    origin_country TEXT NOT NULL,
    origin_city TEXT NOT NULL,
    destination_country TEXT NOT NULL,
    destination_city TEXT NOT NULL,
    completed_freight_requests INTEGER NOT NULL DEFAULT 0,
    successful_freight_requests INTEGER NOT NULL DEFAULT 0,
    success_rate NUMERIC NOT NULL DEFAULT 0.90,
    avg_cost NUMERIC NOT NULL DEFAULT 750,
    avg_delay_hours NUMERIC NOT NULL DEFAULT 1.5,
    cancellation_rate NUMERIC NOT NULL DEFAULT 0.02,
    available_units_count INTEGER NOT NULL DEFAULT 1,
    route_jobs_count INTEGER NOT NULL DEFAULT 10,
    client_history_trips INTEGER DEFAULT 0,
    client_history_ontime INTEGER DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. Carrier Offers
CREATE TABLE IF NOT EXISTS carrier_offers (
    id TEXT PRIMARY KEY,
    freight_request_id TEXT NOT NULL REFERENCES freight_requests(id) ON DELETE CASCADE,
    carrier_id TEXT NOT NULL REFERENCES carriers(id),
    vehicle_id TEXT REFERENCES vehicles(id),
    offer_reference TEXT NOT NULL,
    transport_mode TEXT NOT NULL DEFAULT 'ROAD',
    service_type TEXT NOT NULL DEFAULT 'FTL',
    price NUMERIC NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    estimated_pickup TIMESTAMPTZ NOT NULL,
    estimated_delivery TIMESTAMPTZ NOT NULL,
    estimated_duration_hours NUMERIC NOT NULL,
    available_capacity_kg NUMERIC NOT NULL,
    available_volume_m3 NUMERIC NOT NULL,
    valid_until TIMESTAMPTZ NOT NULL,
    compatibility_status TEXT NOT NULL DEFAULT 'COMPATIBLE',
    scores JSONB,
    status TEXT NOT NULL DEFAULT 'QUOTED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. Freight Decisions
CREATE TABLE IF NOT EXISTS freight_decisions (
    id TEXT PRIMARY KEY,
    freight_request_id TEXT NOT NULL REFERENCES freight_requests(id) ON DELETE CASCADE,
    selected_offer_id TEXT NOT NULL,
    winner_carrier_id TEXT NOT NULL,
    winner_carrier_name TEXT NOT NULL,
    optimization_strategy TEXT NOT NULL,
    heuristic_score NUMERIC NOT NULL,
    second_score NUMERIC NOT NULL,
    confidence_score NUMERIC NOT NULL,
    decision_reason TEXT NOT NULL,
    explanation_bullets JSONB NOT NULL DEFAULT '[]'::jsonb,
    candidate_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
    requires_review BOOLEAN NOT NULL DEFAULT FALSE,
    review_reason TEXT,
    auto_booked BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. Bookings
CREATE TABLE IF NOT EXISTS bookings (
    id TEXT PRIMARY KEY,
    freight_request_id TEXT NOT NULL REFERENCES freight_requests(id),
    carrier_id TEXT NOT NULL REFERENCES carriers(id),
    offer_id TEXT NOT NULL,
    provider_reference TEXT NOT NULL UNIQUE,
    price NUMERIC NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    estimated_delivery TIMESTAMPTZ NOT NULL,
    vehicle_brand TEXT,
    status TEXT NOT NULL DEFAULT 'CONFIRMED',
    booked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

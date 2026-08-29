-- CargoMesh Legacy Baseline Schema (12 foundation tables + bootstrap baseline data)
-- Created to allow fresh clones to rebuild the database via `supabase db reset`.

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  status text not null default 'ACTIVE',
  default_currency text not null default 'USD',
  created_at timestamptz not null default now(),
  constraint organizations_default_currency_check check (default_currency in ('USD', 'PEN')),
  constraint organizations_status_check check (status in ('ACTIVE', 'INACTIVE'))
);

create table if not exists public.cargo_categories (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.carriers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  provider_type text not null default 'CARRIER',
  status text not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  constraint carriers_provider_type_check check (provider_type in ('OWNER_OPERATOR', 'SMALL_FLEET', 'CARRIER', 'ENTERPRISE_CARRIER')),
  constraint carriers_status_check check (status in ('ACTIVE', 'INACTIVE'))
);

create table if not exists public.organization_preferences (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  default_strategy text not null default 'BALANCED',
  max_pickup_wait_hours numeric(8,2) not null default 2,
  preferred_carrier_id uuid references public.carriers(id),
  preferred_vehicle_brand text,
  budget_default numeric(14,2),
  allow_auto_booking boolean not null default true,
  confidence_threshold numeric(5,2) not null default 85,
  created_at timestamptz not null default now()
);

create table if not exists public.carrier_services (
  id uuid primary key default gen_random_uuid(),
  carrier_id uuid not null references public.carriers(id) on delete cascade,
  transport_mode text not null default 'ROAD',
  service_type text not null default 'FTL',
  origin_country text not null,
  origin_region text,
  destination_country text not null,
  destination_region text,
  max_capacity_kg numeric(14,2) not null,
  max_volume_m3 numeric(14,3),
  supports_refrigerated boolean not null default false,
  temperature_min_c numeric(6,2),
  temperature_max_c numeric(6,2),
  supports_hazardous boolean not null default false,
  supports_fragile boolean not null default false,
  supports_oversized boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.carrier_service_cargo_categories (
  carrier_service_id uuid not null references public.carrier_services(id) on delete cascade,
  cargo_category_id uuid not null references public.cargo_categories(id) on delete cascade,
  primary key (carrier_service_id, cargo_category_id)
);

create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  carrier_id uuid not null references public.carriers(id) on delete cascade,
  code text not null unique,
  brand text,
  vehicle_type text,
  capacity_kg numeric(14,2) not null,
  volume_m3 numeric(14,3),
  supports_refrigerated boolean not null default false,
  supports_hazardous boolean not null default false,
  supports_oversized boolean not null default false,
  location text,
  status text not null default 'AVAILABLE',
  created_at timestamptz not null default now(),
  constraint vehicles_status_check check (status in ('AVAILABLE', 'ASSIGNED', 'IN_TRANSIT', 'UNAVAILABLE', 'BREAKDOWN'))
);

create table if not exists public.carrier_metrics (
  id uuid primary key default gen_random_uuid(),
  carrier_id uuid not null references public.carriers(id) on delete cascade,
  cargo_category_id uuid references public.cargo_categories(id),
  transport_mode text not null default 'ROAD',
  origin_country text not null,
  origin_city text not null,
  destination_country text not null,
  destination_city text not null,
  completed_freight_requests integer not null default 0,
  successful_freight_requests integer not null default 0,
  success_rate numeric(5,2) not null default 0,
  avg_cost numeric(14,2),
  avg_delay_hours numeric(10,2),
  cancellation_rate numeric(5,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.freight_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  cargo_category_id uuid not null references public.cargo_categories(id),
  code text not null unique,
  origin_country text not null,
  origin_city text not null,
  destination_country text not null,
  destination_city text not null,
  cargo_weight_kg numeric(14,2) not null,
  cargo_volume_m3 numeric(14,3),
  package_count integer,
  service_type text not null default 'FTL',
  transport_mode text not null default 'ROAD',
  requires_refrigeration boolean not null default false,
  temperature_min_c numeric(6,2),
  temperature_max_c numeric(6,2),
  is_hazardous boolean not null default false,
  is_fragile boolean not null default false,
  is_oversized boolean not null default false,
  is_high_value boolean not null default false,
  is_stackable boolean not null default true,
  special_instructions text,
  required_pickup timestamptz not null,
  delivery_deadline timestamptz,
  budget_max numeric(14,2),
  optimization_strategy text not null default 'BALANCED',
  status text not null default 'PENDING',
  created_at timestamptz not null default now()
);

create table if not exists public.carrier_offers (
  id uuid primary key default gen_random_uuid(),
  freight_request_id uuid not null references public.freight_requests(id) on delete cascade,
  carrier_id uuid not null references public.carriers(id) on delete cascade,
  vehicle_id uuid references public.vehicles(id),
  offer_reference text unique,
  transport_mode text not null default 'ROAD',
  service_type text not null default 'FTL',
  price numeric(14,2) not null,
  currency text not null default 'USD',
  estimated_pickup timestamptz not null,
  estimated_delivery timestamptz not null,
  available_capacity_kg numeric(14,2) not null,
  available_volume_m3 numeric(14,3),
  valid_until timestamptz not null,
  compatibility_status text not null default 'ELIGIBLE',
  compatibility_notes jsonb,
  status text not null default 'RECEIVED',
  created_at timestamptz not null default now()
);

create table if not exists public.freight_decisions (
  id uuid primary key default gen_random_uuid(),
  freight_request_id uuid not null references public.freight_requests(id) on delete cascade,
  selected_offer_id uuid references public.carrier_offers(id),
  optimization_strategy text not null default 'BALANCED',
  heuristic_score numeric(6,2),
  confidence_score numeric(6,2),
  decision_reason text,
  candidate_snapshot jsonb,
  requires_review boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  freight_request_id uuid not null references public.freight_requests(id) on delete cascade,
  carrier_id uuid not null references public.carriers(id) on delete cascade,
  offer_id uuid not null references public.carrier_offers(id) on delete cascade,
  provider_reference text,
  status text not null default 'PENDING_PROVIDER_CONFIRMATION',
  booked_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Baseline Bootstrap Data
insert into public.organizations (id, name, code, status, default_currency)
values
  ('a0000000-0000-0000-0000-000000000001', 'ACME Mining', 'ACME', 'ACTIVE', 'USD')
on conflict (code) do nothing;

insert into public.cargo_categories (id, code, name, description, active)
values
  ('c0000000-0000-0000-0000-000000000001', 'GENERAL', 'General Cargo', 'Standard palletized or packaged general freight', true),
  ('c0000000-0000-0000-0000-000000000002', 'FOOD', 'Food & Perishables', 'Perishable food requiring hygiene and temperature monitoring', true),
  ('c0000000-0000-0000-0000-000000000003', 'PHARMA', 'Pharmaceuticals', 'High-value medical and pharmaceutical products', true),
  ('c0000000-0000-0000-0000-000000000004', 'CHEMICAL', 'Chemicals & Hazmat', 'Chemical substances requiring safety documentation', true),
  ('c0000000-0000-0000-0000-000000000005', 'MACHINERY', 'Machinery & Heavy Industrial', 'Industrial equipment, machinery components and spare parts', true),
  ('c0000000-0000-0000-0000-000000000006', 'CONSTRUCTION', 'Construction Materials', 'Heavy building materials and structural equipment', true),
  ('c0000000-0000-0000-0000-000000000007', 'AGRICULTURAL', 'Agricultural Products', 'Bulk and sacked raw agricultural commodities', true),
  ('c0000000-0000-0000-0000-000000000008', 'LIQUID', 'Liquids & Bulk', 'Liquid cargo requiring specialized tanker transport', true)
on conflict (code) do nothing;

insert into public.carriers (id, name, code, provider_type, status)
values
  ('b0000000-0000-0000-0000-000000000001', 'Andes Freight', 'ANDES', 'ENTERPRISE_CARRIER', 'ACTIVE'),
  ('b0000000-0000-0000-0000-000000000002', 'Inca Express', 'INCA', 'ENTERPRISE_CARRIER', 'ACTIVE'),
  ('b0000000-0000-0000-0000-000000000003', 'Pacific Logistics', 'PACIFIC', 'ENTERPRISE_CARRIER', 'ACTIVE')
on conflict (code) do nothing;

insert into public.organization_preferences (
  organization_id, default_strategy, max_pickup_wait_hours, budget_default, allow_auto_booking, confidence_threshold
)
select id, 'BALANCED', 2, 2000, false, 85
from public.organizations
where code = 'ACME'
on conflict do nothing;

insert into public.carrier_services (
  id, carrier_id, transport_mode, service_type, origin_country, origin_region,
  destination_country, destination_region, max_capacity_kg, max_volume_m3,
  supports_refrigerated, supports_hazardous, supports_fragile, supports_oversized, active
)
values
  ('d0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'ROAD', 'FTL', 'PE', 'Callao', 'CL', 'Santiago', 18000, 55, false, false, true, false, true),
  ('d0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', 'ROAD', 'FTL', 'PE', 'Callao', 'CL', 'Santiago', 24000, 70, false, false, true, false, true),
  ('d0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000003', 'ROAD', 'FTL', 'PE', 'Callao', 'CL', 'Santiago', 15000, 45, false, false, true, false, true)
on conflict do nothing;

insert into public.carrier_service_cargo_categories (carrier_service_id, cargo_category_id)
select cs.id, cc.id
from public.carrier_services cs
cross join public.cargo_categories cc
where cc.code in ('MACHINERY', 'GENERAL', 'CONSTRUCTION')
on conflict do nothing;

insert into public.vehicles (
  id, carrier_id, code, brand, vehicle_type, capacity_kg, volume_m3,
  supports_refrigerated, supports_hazardous, supports_oversized, location, status
)
values
  ('e0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'AND-TRK-101', 'Scania', 'TRACTOR_TRAILER', 18000, 55, false, false, false, 'Callao, PE', 'AVAILABLE'),
  ('e0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', 'INC-TRK-201', 'Volvo', 'TRACTOR_TRAILER', 24000, 70, false, false, false, 'Callao, PE', 'AVAILABLE'),
  ('e0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000003', 'PAC-TRK-301', 'Freightliner', 'TRACTOR_TRAILER', 15000, 45, false, false, false, 'Callao, PE', 'AVAILABLE')
on conflict (code) do nothing;

insert into public.carrier_metrics (
  id, carrier_id, cargo_category_id, transport_mode, origin_country, origin_city,
  destination_country, destination_city, completed_freight_requests, successful_freight_requests,
  success_rate, avg_cost, avg_delay_hours, cancellation_rate, created_at, updated_at
)
values
  ('f1000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000005', 'ROAD', 'PE', 'Callao', 'CL', 'Santiago', 100, 96, 96, 1732, 1.5, 2, now(), now()),
  ('f1000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000005', 'ROAD', 'PE', 'Callao', 'CL', 'Santiago', 50, 49, 98, 1880, 0.8, 1, now(), now()),
  ('f1000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000005', 'ROAD', 'PE', 'Callao', 'CL', 'Santiago', 50, 43, 86, 1650, 3.2, 5, now(), now())
on conflict do nothing;

insert into public.freight_requests (
  id, organization_id, cargo_category_id, code, origin_country, origin_city,
  destination_country, destination_city, cargo_weight_kg, cargo_volume_m3,
  package_count, service_type, transport_mode, requires_refrigeration,
  is_hazardous, is_fragile, is_oversized, is_high_value, is_stackable,
  special_instructions, required_pickup, delivery_deadline, budget_max,
  optimization_strategy, status
)
values (
  'f2000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'c0000000-0000-0000-0000-000000000005',
  'FR-1042',
  'PE', 'Callao',
  'CL', 'Santiago',
  8000, 18,
  10, 'FTL', 'ROAD', false,
  false, false, false, true, false,
  'Carga transfronteriza. Coordinar documentación aduanera y mantener trazabilidad.',
  now() + interval '1 day 13 hours',
  now() + interval '4 days 13 hours',
  2000,
  'BALANCED',
  'PENDING'
)
on conflict (code) do nothing;

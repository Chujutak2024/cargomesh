-- HAC-29 schema migration. Frozen V1 cutoff: e289801f209902ebfe8e54b39c50ce62a16c4b6f
-- SHA-256 uses UTF-8 / LF normalized source content.
-- Source: supabase/migrations/20260828200000_baseline_legacy_schema.sql SHA-256: 0084024f7c86096826a91881d1125399344830ea00f29ee262714958abcb7687
-- Source: supabase/migrations/20260828233233_add_cargomesh_identity_and_intent_contract.sql SHA-256: f435f93c1fea5a51ca62438b88a8826505d5eb0cd3d1f69a154a193f61099be2
-- Source: supabase/migrations/20260828233302_add_cargomesh_observability_and_booking_events.sql SHA-256: d1209b8a897d8defc26104fdf4501b0d1eae21b81ea52a8baf8f9c6cf368c053
-- Source: supabase/migrations/20260828233343_add_cargomesh_runtime_contract.sql SHA-256: a007dbc51bf137dc052ab23a79d518069596cdbefbe50854718a1d1adf2f6a76
-- Source: supabase/migrations/20260828233435_add_cargomesh_domain_constraints.sql SHA-256: 44bd3d461ade51747820bea3513f261cb0953a35b0cf9efb9ae20dff1ad8e046
-- Source: supabase/migrations/20260828233524_add_carrier_offers_carrier_fk_index.sql SHA-256: c6e9ea2c2335294517dd5aed822326a5ce0e2a53c929c584b31067a7f4b0bc6c
-- Source: supabase/migrations/20260829003215_align_golden_flow_and_reset_runtime.sql SHA-256: cad1fca7c8ce9682ca865b53393436b38d643dcfbfae78d62c7219a99dff7646
-- Source: supabase/migrations/20260829003327_secure_cargomesh_data_api_with_rls.sql SHA-256: 40fcd939c18856669ee2780bc9da35842e98591c10e89b93c2b5a4463eeaafa0
-- Source: supabase/migrations/20260829005625_add_organization_cargo_profiles_and_unitized_intake.sql SHA-256: 30f3364007f95dabb708a79d3c11994743c89b279a31ddbb48a50d21583ed194
-- Source: supabase/migrations/20260829010551_add_freight_request_org_cargo_profile_fk_index.sql SHA-256: f30e41be92413e2b1bb26a1437050f9ea0dc75fe671386c3b47fa764e7caaf5e
-- Source: supabase/migrations/20260829011002_add_cargo_category_intake_guidance.sql SHA-256: f664d4cf51017ca4581ed33d01caa67a994b8050d2ec28e42421de8abad99c9b
-- Source: supabase/migrations/20260830040348_c02_result_bridge_idempotency.sql SHA-256: 0ad94074c45cf87a64d7ebbe86cd4a2b078393d1140d0a4aa8c527c51cc44bbc
-- Source: supabase/migrations/20260830182517_int02a_generalize_result_bridge.sql SHA-256: 5d88e4ca457c31fbca116b4292706a987385bb3583a44c523832adaf5ad25879
-- Source: supabase/migrations/20260830210000_int02a_orchestration_run_api.sql SHA-256: c7a4238bbebc5978ac65efef58058b6b96941fa7596d1ac98cb992f6f8190903
-- Source: supabase/migrations/20260831062736_c03_booking_bridge.sql SHA-256: 0bcd62a8bcf872f42e787b0316ce66cf49ceccaf478435fef46276844b805b90
-- Source: supabase/migrations/20260901045832_c_release_service_role_base_grants.sql SHA-256: 59fd4d858e88967c59a267cc766c5a6d387b41922d9d4e802059b2c716aafecf
-- Source: supabase/migrations/20260902065645_c_d1_recommendation_draft_writer.sql SHA-256: f19441fce3d00c4aa89b85f828e3a62fdcf9b0856821e62bc6e2a879e7cca1be
-- Source: supabase/migrations/20260902170000_c_manual_intake_writer.sql SHA-256: ba0c3b980f3af5b4e85c5e2f259e21ed566bf61d6d8aa77e781cc963615656ca
-- Source: supabase/migrations/20260902213000_c_restrict_freight_request_writes.sql SHA-256: 71d99234079d7542ba35eec994a24477d9032dc941f4398381ebb31a740cf3e1
-- Source: supabase/migrations/20260918120000_c_draft_creation_idempotency.sql SHA-256: 71ba64cbfa9b827217f982bd1b42a83b8f5d3aee790335fd711db11c035cdbca
-- Source: supabase/migrations/20260922053512_v2_road_facilities_services.sql SHA-256: 7f79a3e87075762bfae4c9c7e9ad040a44863b44b03d37540a5b43fa67f4cd05
-- Schema-ready compatibility is not feature-live. No V1 fixture is executed here.
-- Source: 20260828200000_baseline_legacy_schema.sql
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


-- Source: 20260828233233_add_cargomesh_identity_and_intent_contract.sql

create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  corporate_email text not null,
  role text not null,
  status text not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_members_role_check check (role in ('OWNER', 'REQUESTER', 'SUPERVISOR')),
  constraint organization_members_status_check check (status in ('ACTIVE', 'INACTIVE', 'INVITED')),
  constraint organization_members_org_user_unique unique (organization_id, auth_user_id)
);

alter table public.organizations
  add column if not exists legal_name text,
  add column if not exists country_code text,
  add column if not exists business_identifier_type text,
  add column if not exists business_identifier_value text,
  add column if not exists verified_corporate_email text,
  add column if not exists corporate_phone text,
  add column if not exists updated_at timestamptz not null default now();

create unique index organizations_business_identifier_unique
  on public.organizations (country_code, business_identifier_type, business_identifier_value)
  where business_identifier_value is not null;

alter table public.organization_preferences
  add column if not exists allow_auto_recovery boolean not null default false,
  add column if not exists anomaly_threshold_pct numeric(5,2) not null default 30,
  add column if not exists billing_mode text not null default 'INVOICE',
  add column if not exists selection_mode text not null default 'ASSISTED',
  add column if not exists updated_at timestamptz not null default now();

alter table public.freight_requests
  add column if not exists requested_by_member_id uuid references public.organization_members(id),
  add column if not exists origin_address text,
  add column if not exists pickup_contact_name text,
  add column if not exists pickup_contact_phone text,
  add column if not exists destination_address text,
  add column if not exists receiver_name text,
  add column if not exists receiver_company text,
  add column if not exists receiver_phone text,
  add column if not exists cargo_description text,
  add column if not exists cargo_entry_method text not null default 'TOTAL_WEIGHT',
  add column if not exists pickup_mode text not null default 'SCHEDULED',
  add column if not exists pickup_window_start timestamptz,
  add column if not exists pickup_window_end timestamptz,
  add column if not exists available_documents jsonb not null default '[]'::jsonb,
  add column if not exists cross_border boolean not null default false,
  add column if not exists confirmed_at timestamptz,
  add column if not exists confirmed_by_member_id uuid references public.organization_members(id),
  add column if not exists updated_at timestamptz not null default now();

alter table public.carriers
  add column if not exists provider_url text,
  add column if not exists supports_webmcp boolean not null default true,
  add column if not exists updated_at timestamptz not null default now();

create unique index carriers_provider_url_unique
  on public.carriers (provider_url)
  where provider_url is not null;

alter table public.carrier_services
  add column if not exists supports_cross_border boolean not null default false,
  add column if not exists customs_coordination_included boolean not null default false,
  add column if not exists provider_service_code text,
  add column if not exists updated_at timestamptz not null default now();

alter table public.vehicles
  add column if not exists model text,
  add column if not exists license_plate text,
  add column if not exists updated_at timestamptz not null default now();

create unique index vehicles_license_plate_unique
  on public.vehicles (license_plate)
  where license_plate is not null;

alter table public.carrier_metrics
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade,
  add column if not exists route_completed_freight_requests integer not null default 0,
  add column if not exists average_route_cost numeric(12,2),
  add column if not exists organization_completed_freight_requests integer not null default 0,
  add column if not exists organization_successful_freight_requests integer not null default 0;

create index organization_members_auth_user_idx on public.organization_members (auth_user_id);
create index organization_members_org_status_idx on public.organization_members (organization_id, status);
create unique index organization_preferences_org_unique on public.organization_preferences (organization_id);
create index organization_preferences_preferred_carrier_idx on public.organization_preferences (preferred_carrier_id) where preferred_carrier_id is not null;
create index freight_requests_org_status_created_idx on public.freight_requests (organization_id, status, created_at desc);
create index freight_requests_cargo_category_idx on public.freight_requests (cargo_category_id);
create index freight_requests_requester_idx on public.freight_requests (requested_by_member_id) where requested_by_member_id is not null;
create index freight_requests_confirmed_by_idx on public.freight_requests (confirmed_by_member_id) where confirmed_by_member_id is not null;
create index carrier_services_carrier_idx on public.carrier_services (carrier_id);
create index carrier_service_categories_category_idx on public.carrier_service_cargo_categories (cargo_category_id);
create index vehicles_carrier_idx on public.vehicles (carrier_id);
create index carrier_metrics_carrier_idx on public.carrier_metrics (carrier_id);
create index carrier_metrics_category_idx on public.carrier_metrics (cargo_category_id) where cargo_category_id is not null;
create index carrier_metrics_organization_idx on public.carrier_metrics (organization_id) where organization_id is not null;
;

-- Source: 20260828233302_add_cargomesh_observability_and_booking_events.sql

create table public.orchestration_runs (
  id uuid primary key default gen_random_uuid(),
  freight_request_id uuid not null references public.freight_requests(id) on delete cascade,
  run_type text not null,
  status text not null default 'RUNNING',
  previous_run_id uuid references public.orchestration_runs(id),
  created_by_member_id uuid references public.organization_members(id),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  constraint orchestration_runs_type_check check (run_type in ('INITIAL', 'RECOVERY')),
  constraint orchestration_runs_status_check check (status in ('RUNNING', 'OPTIONS_READY', 'FAILED', 'CANCELLED', 'NO_MATCH')),
  constraint orchestration_runs_completion_check check (completed_at is null or completed_at >= started_at)
);

create table public.orchestration_events (
  id uuid primary key default gen_random_uuid(),
  orchestration_run_id uuid not null references public.orchestration_runs(id) on delete cascade,
  carrier_id uuid references public.carriers(id),
  provider_url text,
  event_type text not null,
  tool_name text,
  tool_call_id text,
  input_payload jsonb,
  output_payload jsonb,
  status text not null default 'SUCCEEDED',
  duration_ms integer,
  persisted_entity_type text,
  persisted_entity_id uuid,
  created_at timestamptz not null default now(),
  constraint orchestration_events_status_check check (status in ('STARTED', 'SUCCEEDED', 'FAILED', 'SKIPPED')),
  constraint orchestration_events_duration_check check (duration_ms is null or duration_ms >= 0)
);

create table public.booking_events (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  provider_event_id text not null,
  event_type text not null,
  provider_booking_status text,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint booking_events_provider_status_check check (
    provider_booking_status is null
    or provider_booking_status in (
      'PENDING_PROVIDER_CONFIRMATION',
      'CONFIRMED',
      'REJECTED',
      'EXPIRED',
      'IN_TRANSIT',
      'DELIVERED',
      'CANCELLED'
    )
  ),
  constraint booking_events_provider_event_unique unique (booking_id, provider_event_id)
);

create unique index orchestration_events_tool_call_unique
  on public.orchestration_events (tool_call_id)
  where tool_call_id is not null;
create index orchestration_runs_request_created_idx
  on public.orchestration_runs (freight_request_id, created_at desc);
create index orchestration_runs_previous_idx
  on public.orchestration_runs (previous_run_id)
  where previous_run_id is not null;
create index orchestration_runs_created_by_idx
  on public.orchestration_runs (created_by_member_id)
  where created_by_member_id is not null;
create index orchestration_events_run_created_idx
  on public.orchestration_events (orchestration_run_id, created_at);
create index orchestration_events_carrier_idx
  on public.orchestration_events (carrier_id)
  where carrier_id is not null;
create index booking_events_booking_occurred_idx
  on public.booking_events (booking_id, occurred_at);

alter table public.organization_members enable row level security;
alter table public.orchestration_runs enable row level security;
alter table public.orchestration_events enable row level security;
alter table public.booking_events enable row level security;

revoke all privileges on
  public.organization_members,
  public.orchestration_runs,
  public.orchestration_events,
  public.booking_events
from anon, authenticated;

grant all privileges on
  public.organization_members,
  public.orchestration_runs,
  public.orchestration_events,
  public.booking_events
to service_role;
;

-- Source: 20260828233343_add_cargomesh_runtime_contract.sql

alter table public.carrier_offers
  add column if not exists orchestration_run_id uuid references public.orchestration_runs(id) on delete cascade,
  add column if not exists tool_call_id text,
  add column if not exists provider_offer_reference text,
  add column if not exists quote_breakdown jsonb not null default '{}'::jsonb,
  add column if not exists transit_hours numeric(10,2),
  add column if not exists availability_class text,
  add column if not exists availability_score numeric(5,2),
  add column if not exists reliability_score numeric(5,2),
  add column if not exists route_operations integer not null default 0,
  add column if not exists organization_history_score numeric(5,2) not null default 50,
  add column if not exists final_score numeric(8,4),
  add column if not exists supersedes_offer_id uuid references public.carrier_offers(id);

alter table public.carrier_offers
  drop constraint if exists carrier_offers_status_check;
alter table public.carrier_offers
  add constraint carrier_offers_status_check check (status in (
    'QUOTED', 'ACCEPTED', 'REJECTED',
    'RECEIVED', 'ELIGIBLE', 'INELIGIBLE',
    'SELECTED', 'EXPIRED', 'SUPERSEDED'
  ));

create unique index carrier_offers_tool_call_unique
  on public.carrier_offers (tool_call_id)
  where tool_call_id is not null;
create unique index carrier_offers_run_provider_reference_unique
  on public.carrier_offers (orchestration_run_id, carrier_id, provider_offer_reference)
  where orchestration_run_id is not null and provider_offer_reference is not null;
create index carrier_offers_request_carrier_idx
  on public.carrier_offers (freight_request_id, carrier_id);
create index carrier_offers_run_status_idx
  on public.carrier_offers (orchestration_run_id, status)
  where orchestration_run_id is not null;
create index carrier_offers_vehicle_idx
  on public.carrier_offers (vehicle_id)
  where vehicle_id is not null;
create index carrier_offers_supersedes_idx
  on public.carrier_offers (supersedes_offer_id)
  where supersedes_offer_id is not null;

alter table public.freight_decisions
  add column orchestration_run_id uuid not null references public.orchestration_runs(id) on delete cascade,
  add column previous_decision_id uuid references public.freight_decisions(id),
  add column decision_version integer not null default 1,
  add column decision_type text not null default 'INITIAL',
  add column recommended_offer_id uuid references public.carrier_offers(id),
  add column ranking_snapshot jsonb not null default '[]'::jsonb,
  add column subscores jsonb not null default '{}'::jsonb,
  add column confidence_components jsonb not null default '{}'::jsonb,
  add column anomaly_evidence jsonb not null default '{}'::jsonb,
  add column selection_mode text,
  add column selected_by_member_id uuid references public.organization_members(id),
  add column selected_at timestamptz;

alter table public.freight_decisions
  add constraint freight_decisions_version_positive check (decision_version > 0),
  add constraint freight_decisions_type_check check (decision_type in ('INITIAL', 'RECOVERY')),
  add constraint freight_decisions_selection_mode_check check (
    selection_mode is null or selection_mode in ('ASSISTED', 'SMART_AUTO')
  ),
  add constraint freight_decisions_request_version_unique unique (freight_request_id, decision_version),
  add constraint freight_decisions_run_unique unique (orchestration_run_id);

create index freight_decisions_recommended_offer_idx
  on public.freight_decisions (recommended_offer_id)
  where recommended_offer_id is not null;
create index freight_decisions_selected_offer_idx
  on public.freight_decisions (selected_offer_id)
  where selected_offer_id is not null;
create index freight_decisions_previous_idx
  on public.freight_decisions (previous_decision_id)
  where previous_decision_id is not null;
create index freight_decisions_selected_by_idx
  on public.freight_decisions (selected_by_member_id)
  where selected_by_member_id is not null;

alter table public.bookings
  add column freight_decision_id uuid not null references public.freight_decisions(id),
  add column provider_booking_status text not null default 'PENDING_PROVIDER_CONFIRMATION',
  add column idempotency_key text not null,
  add column provider_response_deadline timestamptz not null,
  add column authorization_context jsonb not null default '{}'::jsonb,
  add column selection_mode text not null default 'ASSISTED',
  add column selected_by_member_id uuid references public.organization_members(id),
  add column replaces_booking_id uuid references public.bookings(id),
  add column payment_mode text not null default 'INVOICE',
  add column payment_status text not null default 'NOT_REQUIRED',
  add column payment_provider_reference text,
  add column payment_url text,
  add column confirmed_at timestamptz,
  add column rejected_at timestamptz,
  add column expired_at timestamptz,
  add column cancelled_at timestamptz,
  add column updated_at timestamptz not null default now();

alter table public.bookings
  drop constraint if exists bookings_status_check;
alter table public.bookings
  alter column status set default 'PENDING_PROVIDER_CONFIRMATION';
alter table public.bookings
  add constraint bookings_status_check check (status in (
    'PENDING_PROVIDER_CONFIRMATION', 'CONFIRMED', 'REJECTED',
    'EXPIRED', 'IN_TRANSIT', 'COMPLETED', 'CANCELLED',
    'DISRUPTED', 'REBOOKED'
  )),
  add constraint bookings_provider_status_check check (provider_booking_status in (
    'PENDING_PROVIDER_CONFIRMATION', 'CONFIRMED', 'REJECTED',
    'EXPIRED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED'
  )),
  add constraint bookings_selection_mode_check check (selection_mode in ('ASSISTED', 'SMART_AUTO')),
  add constraint bookings_payment_mode_check check (payment_mode in (
    'CORPORATE_ACCOUNT', 'INVOICE', 'EXTERNAL_CHECKOUT', 'TOKENIZED_PAYMENT_METHOD'
  )),
  add constraint bookings_payment_status_check check (payment_status in (
    'NOT_REQUIRED', 'PENDING', 'PAID', 'FAILED', 'REFUNDED'
  )),
  add constraint bookings_idempotency_unique unique (idempotency_key);

create unique index bookings_active_request_unique
  on public.bookings (freight_request_id)
  where status in ('PENDING_PROVIDER_CONFIRMATION', 'CONFIRMED', 'IN_TRANSIT');
create unique index bookings_provider_reference_unique
  on public.bookings (carrier_id, provider_reference)
  where provider_reference is not null;
create index bookings_request_idx on public.bookings (freight_request_id);
create index bookings_carrier_idx on public.bookings (carrier_id);
create index bookings_offer_idx on public.bookings (offer_id);
create index bookings_decision_idx on public.bookings (freight_decision_id);
create index bookings_selected_by_idx on public.bookings (selected_by_member_id)
  where selected_by_member_id is not null;
create index bookings_replaces_idx on public.bookings (replaces_booking_id)
  where replaces_booking_id is not null;
;

-- Source: 20260828233435_add_cargomesh_domain_constraints.sql

alter table public.organization_preferences
  add constraint organization_preferences_confidence_range
    check (confidence_threshold between 0 and 100),
  add constraint organization_preferences_anomaly_range
    check (anomaly_threshold_pct between 0 and 100),
  add constraint organization_preferences_billing_mode_check
    check (billing_mode in ('CORPORATE_ACCOUNT', 'INVOICE', 'EXTERNAL_CHECKOUT', 'TOKENIZED_PAYMENT_METHOD')),
  add constraint organization_preferences_selection_mode_check
    check (selection_mode in ('ASSISTED', 'SMART_AUTO'));

alter table public.freight_requests
  add constraint freight_requests_cargo_entry_method_check
    check (cargo_entry_method in ('TOTAL_WEIGHT', 'UNITS', 'PACKAGES', 'PALLETS', 'LOTS')),
  add constraint freight_requests_pickup_mode_check
    check (pickup_mode in ('ASAP', 'SCHEDULED')),
  add constraint freight_requests_weight_positive check (cargo_weight_kg > 0),
  add constraint freight_requests_budget_positive check (budget_max is null or budget_max > 0),
  add constraint freight_requests_pickup_window_check check (
    pickup_window_end is null or pickup_window_start is null or pickup_window_end > pickup_window_start
  );

alter table public.carrier_metrics
  add constraint carrier_metrics_counts_nonnegative check (
    completed_freight_requests >= 0
    and successful_freight_requests >= 0
    and route_completed_freight_requests >= 0
    and organization_completed_freight_requests >= 0
    and organization_successful_freight_requests >= 0
  ),
  add constraint carrier_metrics_success_rate_range check (success_rate between 0 and 100);

alter table public.carrier_offers
  add constraint carrier_offers_scores_range check (
    (availability_score is null or availability_score between 0 and 100)
    and (reliability_score is null or reliability_score between 0 and 100)
    and organization_history_score between 0 and 100
    and (final_score is null or final_score between 0 and 100)
  ),
  add constraint carrier_offers_transit_positive check (transit_hours is null or transit_hours > 0),
  add constraint carrier_offers_route_operations_nonnegative check (route_operations >= 0);

alter table public.freight_decisions
  add constraint freight_decisions_confidence_range check (
    confidence_score is null or confidence_score between 0 and 100
  );
;

-- Source: 20260828233524_add_carrier_offers_carrier_fk_index.sql
create index carrier_offers_carrier_idx on public.carrier_offers (carrier_id);;

-- Source: 20260829003215_align_golden_flow_and_reset_runtime.sql
alter table public.carrier_offers
  alter column offer_reference drop not null,
  alter column orchestration_run_id set not null,
  alter column tool_call_id set not null,
  alter column provider_offer_reference set not null,
  alter column transit_hours set not null,
  alter column availability_class set not null,
  alter column availability_score set not null,
  alter column reliability_score set not null,
  alter column status set default 'RECEIVED';

alter table public.carrier_offers drop constraint if exists carrier_offers_status_check;
alter table public.carrier_offers add constraint carrier_offers_status_check
check(status in ('RECEIVED','ELIGIBLE','INELIGIBLE','SELECTED','EXPIRED','SUPERSEDED'));

alter table public.freight_requests drop constraint if exists freight_requests_status_check;
alter table public.freight_requests add constraint freight_requests_status_check
check(status in ('DRAFT','PENDING','ORCHESTRATING','AWAITING_SELECTION','BOOKING','BOOKED','FAILED','CANCELLED'));
;

-- Source: 20260829003327_secure_cargomesh_data_api_with_rls.sql

create schema if not exists private;
revoke all on schema private from public;
revoke all on schema private from anon;
grant usage on schema private to authenticated;

create or replace function private.is_organization_member(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members om
    where om.organization_id = target_organization_id
      and om.auth_user_id = (select auth.uid())
      and om.status = 'ACTIVE'
  );
$$;

create or replace function private.has_organization_role(
  target_organization_id uuid,
  allowed_roles text[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members om
    where om.organization_id = target_organization_id
      and om.auth_user_id = (select auth.uid())
      and om.status = 'ACTIVE'
      and om.role = any(allowed_roles)
  );
$$;

create or replace function private.has_any_organization()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members om
    where om.auth_user_id = (select auth.uid())
      and om.status = 'ACTIVE'
  );
$$;

revoke all on function private.is_organization_member(uuid) from public, anon, authenticated;
revoke all on function private.has_organization_role(uuid,text[]) from public, anon, authenticated;
revoke all on function private.has_any_organization() from public, anon, authenticated;
grant execute on function private.is_organization_member(uuid) to authenticated;
grant execute on function private.has_organization_role(uuid,text[]) to authenticated;
grant execute on function private.has_any_organization() to authenticated;

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.organization_preferences enable row level security;
alter table public.cargo_categories enable row level security;
alter table public.freight_requests enable row level security;
alter table public.carriers enable row level security;
alter table public.carrier_services enable row level security;
alter table public.carrier_service_cargo_categories enable row level security;
alter table public.carrier_metrics enable row level security;
alter table public.vehicles enable row level security;
alter table public.orchestration_runs enable row level security;
alter table public.orchestration_events enable row level security;
alter table public.carrier_offers enable row level security;
alter table public.freight_decisions enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_events enable row level security;

revoke all privileges on table
  public.organizations,
  public.organization_members,
  public.organization_preferences,
  public.cargo_categories,
  public.freight_requests,
  public.carriers,
  public.carrier_services,
  public.carrier_service_cargo_categories,
  public.carrier_metrics,
  public.vehicles,
  public.orchestration_runs,
  public.orchestration_events,
  public.carrier_offers,
  public.freight_decisions,
  public.bookings,
  public.booking_events
from anon, authenticated;

grant select on table
  public.organizations,
  public.organization_members,
  public.organization_preferences,
  public.cargo_categories,
  public.freight_requests,
  public.carriers,
  public.carrier_services,
  public.carrier_service_cargo_categories,
  public.carrier_metrics,
  public.vehicles,
  public.orchestration_runs,
  public.orchestration_events,
  public.carrier_offers,
  public.freight_decisions,
  public.bookings,
  public.booking_events
to authenticated;

grant insert, update on table public.freight_requests to authenticated;
grant update on table public.organization_preferences to authenticated;

drop policy if exists organizations_member_select on public.organizations;
create policy organizations_member_select on public.organizations
for select to authenticated
using ((select private.is_organization_member(id)));

drop policy if exists organization_members_member_select on public.organization_members;
create policy organization_members_member_select on public.organization_members
for select to authenticated
using ((select private.is_organization_member(organization_id)));

drop policy if exists organization_preferences_member_select on public.organization_preferences;
create policy organization_preferences_member_select on public.organization_preferences
for select to authenticated
using ((select private.is_organization_member(organization_id)));

drop policy if exists organization_preferences_owner_update on public.organization_preferences;
create policy organization_preferences_owner_update on public.organization_preferences
for update to authenticated
using ((select private.has_organization_role(organization_id,array['OWNER','SUPERVISOR']::text[])))
with check ((select private.has_organization_role(organization_id,array['OWNER','SUPERVISOR']::text[])));

drop policy if exists cargo_categories_member_select on public.cargo_categories;
create policy cargo_categories_member_select on public.cargo_categories
for select to authenticated
using ((select private.has_any_organization()));

drop policy if exists freight_requests_member_select on public.freight_requests;
create policy freight_requests_member_select on public.freight_requests
for select to authenticated
using ((select private.is_organization_member(organization_id)));

drop policy if exists freight_requests_member_insert on public.freight_requests;
create policy freight_requests_member_insert on public.freight_requests
for insert to authenticated
with check ((select private.has_organization_role(organization_id,array['OWNER','SUPERVISOR','REQUESTER']::text[])));

drop policy if exists freight_requests_member_update on public.freight_requests;
create policy freight_requests_member_update on public.freight_requests
for update to authenticated
using ((select private.has_organization_role(organization_id,array['OWNER','SUPERVISOR','REQUESTER']::text[])))
with check ((select private.has_organization_role(organization_id,array['OWNER','SUPERVISOR','REQUESTER']::text[])));

drop policy if exists carriers_member_select on public.carriers;
create policy carriers_member_select on public.carriers
for select to authenticated
using ((select private.has_any_organization()));

drop policy if exists carrier_services_member_select on public.carrier_services;
create policy carrier_services_member_select on public.carrier_services
for select to authenticated
using ((select private.has_any_organization()));

drop policy if exists carrier_service_categories_member_select on public.carrier_service_cargo_categories;
create policy carrier_service_categories_member_select on public.carrier_service_cargo_categories
for select to authenticated
using ((select private.has_any_organization()));

drop policy if exists vehicles_member_select on public.vehicles;
create policy vehicles_member_select on public.vehicles
for select to authenticated
using ((select private.has_any_organization()));

drop policy if exists carrier_metrics_member_select on public.carrier_metrics;
create policy carrier_metrics_member_select on public.carrier_metrics
for select to authenticated
using (
  (select private.has_any_organization())
  and (
    organization_id is null
    or (select private.is_organization_member(organization_id))
  )
);

drop policy if exists orchestration_runs_member_select on public.orchestration_runs;
create policy orchestration_runs_member_select on public.orchestration_runs
for select to authenticated
using (
  exists (
    select 1 from public.freight_requests fr
    where fr.id=orchestration_runs.freight_request_id
      and (select private.is_organization_member(fr.organization_id))
  )
);

drop policy if exists orchestration_events_member_select on public.orchestration_events;
create policy orchestration_events_member_select on public.orchestration_events
for select to authenticated
using (
  exists (
    select 1
    from public.orchestration_runs r
    join public.freight_requests fr on fr.id=r.freight_request_id
    where r.id=orchestration_events.orchestration_run_id
      and (select private.is_organization_member(fr.organization_id))
  )
);

drop policy if exists carrier_offers_member_select on public.carrier_offers;
create policy carrier_offers_member_select on public.carrier_offers
for select to authenticated
using (
  exists (
    select 1 from public.freight_requests fr
    where fr.id=carrier_offers.freight_request_id
      and (select private.is_organization_member(fr.organization_id))
  )
);

drop policy if exists freight_decisions_member_select on public.freight_decisions;
create policy freight_decisions_member_select on public.freight_decisions
for select to authenticated
using (
  exists (
    select 1 from public.freight_requests fr
    where fr.id=freight_decisions.freight_request_id
      and (select private.is_organization_member(fr.organization_id))
  )
);

drop policy if exists bookings_member_select on public.bookings;
create policy bookings_member_select on public.bookings
for select to authenticated
using (
  exists (
    select 1 from public.freight_requests fr
    where fr.id=bookings.freight_request_id
      and (select private.is_organization_member(fr.organization_id))
  )
);

drop policy if exists booking_events_member_select on public.booking_events;
create policy booking_events_member_select on public.booking_events
for select to authenticated
using (
  exists (
    select 1
    from public.bookings b
    join public.freight_requests fr on fr.id=b.freight_request_id
    where b.id=booking_events.booking_id
      and (select private.is_organization_member(fr.organization_id))
  )
);

alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
;

-- Source: 20260829005625_add_organization_cargo_profiles_and_unitized_intake.sql
create table public.organization_cargo_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  cargo_category_id uuid not null references public.cargo_categories(id),
  profile_name text not null,
  default_entry_method text not null,
  typical_entry_quantity numeric(12,2),
  typical_unit_weight_kg numeric(12,2),
  typical_units_per_entry integer not null default 1,
  typical_length_cm numeric(10,2),
  typical_width_cm numeric(10,2),
  typical_height_cm numeric(10,2),
  default_requirements jsonb not null default '{}'::jsonb,
  preferred_vehicle_classes jsonb not null default '[]'::jsonb,
  priority smallint not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_cargo_profiles_org_name_unique
    unique (organization_id, profile_name),
  constraint organization_cargo_profiles_org_id_id_unique
    unique (organization_id, id),
  constraint organization_cargo_profiles_entry_method_check
    check (default_entry_method in ('TOTAL_WEIGHT','UNITS','PACKAGES','PALLETS','LOTS','SACKS')),
  constraint organization_cargo_profiles_quantity_positive
    check (typical_entry_quantity is null or typical_entry_quantity > 0),
  constraint organization_cargo_profiles_unit_weight_positive
    check (typical_unit_weight_kg is null or typical_unit_weight_kg > 0),
  constraint organization_cargo_profiles_units_per_entry_positive
    check (typical_units_per_entry > 0),
  constraint organization_cargo_profiles_dimensions_positive
    check (
      (typical_length_cm is null or typical_length_cm > 0)
      and (typical_width_cm is null or typical_width_cm > 0)
      and (typical_height_cm is null or typical_height_cm > 0)
    ),
  constraint organization_cargo_profiles_requirements_object
    check (jsonb_typeof(default_requirements) = 'object'),
  constraint organization_cargo_profiles_vehicle_classes_array
    check (jsonb_typeof(preferred_vehicle_classes) = 'array')
);

create index organization_cargo_profiles_org_active_idx
  on public.organization_cargo_profiles (organization_id, priority, profile_name)
  where active;

create index organization_cargo_profiles_category_idx
  on public.organization_cargo_profiles (cargo_category_id);

alter table public.freight_requests
  add column cargo_profile_id uuid,
  add column entry_quantity numeric(12,2),
  add column entry_unit_weight_kg numeric(12,2),
  add column units_per_entry integer,
  add column entry_length_cm numeric(10,2),
  add column entry_width_cm numeric(10,2),
  add column entry_height_cm numeric(10,2),
  add column cargo_specifications jsonb not null default '{}'::jsonb;

alter table public.freight_requests
  add constraint freight_requests_organization_cargo_profile_fkey
  foreign key (organization_id, cargo_profile_id)
  references public.organization_cargo_profiles (organization_id, id);

create index freight_requests_cargo_profile_idx
  on public.freight_requests (cargo_profile_id)
  where cargo_profile_id is not null;

alter table public.freight_requests
  drop constraint freight_requests_cargo_entry_method_check;

alter table public.freight_requests
  add constraint freight_requests_cargo_entry_method_check
  check (cargo_entry_method in ('TOTAL_WEIGHT','UNITS','PACKAGES','PALLETS','LOTS','SACKS'));

alter table public.freight_requests
  add constraint freight_requests_entry_quantity_positive
    check (entry_quantity is null or entry_quantity > 0),
  add constraint freight_requests_entry_unit_weight_positive
    check (entry_unit_weight_kg is null or entry_unit_weight_kg > 0),
  add constraint freight_requests_units_per_entry_positive
    check (units_per_entry is null or units_per_entry > 0),
  add constraint freight_requests_entry_dimensions_positive
    check (
      (entry_length_cm is null or entry_length_cm > 0)
      and (entry_width_cm is null or entry_width_cm > 0)
      and (entry_height_cm is null or entry_height_cm > 0)
    ),
  add constraint freight_requests_cargo_specifications_object
    check (jsonb_typeof(cargo_specifications) = 'object'),
  add constraint freight_requests_unitized_intake_complete
    check (
      status = 'DRAFT'
      or cargo_entry_method = 'TOTAL_WEIGHT'
      or (
        entry_quantity is not null
        and entry_unit_weight_kg is not null
        and units_per_entry is not null
      )
    ) not valid,
  add constraint freight_requests_unitized_weight_matches_total
    check (
      cargo_entry_method = 'TOTAL_WEIGHT'
      or entry_quantity is null
      or entry_unit_weight_kg is null
      or units_per_entry is null
      or abs(cargo_weight_kg - (entry_quantity * entry_unit_weight_kg * units_per_entry)) <= 0.01
    ) not valid,
  add constraint freight_requests_unitized_volume_matches_total
    check (
      cargo_volume_m3 is null
      or entry_quantity is null
      or units_per_entry is null
      or entry_length_cm is null
      or entry_width_cm is null
      or entry_height_cm is null
      or abs(
        cargo_volume_m3
        - (
          entry_quantity * units_per_entry
          * entry_length_cm * entry_width_cm * entry_height_cm
          / 1000000
        )
      ) <= 0.01
    ) not valid;

alter table public.freight_requests
  validate constraint freight_requests_unitized_intake_complete;

alter table public.freight_requests
  validate constraint freight_requests_unitized_weight_matches_total;

alter table public.freight_requests
  validate constraint freight_requests_unitized_volume_matches_total;

alter table public.organization_cargo_profiles enable row level security;

revoke all privileges on table public.organization_cargo_profiles from anon, authenticated;
grant select, insert, update on table public.organization_cargo_profiles to authenticated;
grant all privileges on table public.organization_cargo_profiles to service_role;

create policy organization_cargo_profiles_member_select
on public.organization_cargo_profiles
for select to authenticated
using ((select private.is_organization_member(organization_id)));

create policy organization_cargo_profiles_manager_insert
on public.organization_cargo_profiles
for insert to authenticated
with check ((select private.has_organization_role(
  organization_id,
  array['OWNER','SUPERVISOR']::text[]
)));

create policy organization_cargo_profiles_manager_update
on public.organization_cargo_profiles
for update to authenticated
using ((select private.has_organization_role(
  organization_id,
  array['OWNER','SUPERVISOR']::text[]
)))
with check ((select private.has_organization_role(
  organization_id,
  array['OWNER','SUPERVISOR']::text[]
)));

-- Source: 20260829010551_add_freight_request_org_cargo_profile_fk_index.sql
create index freight_requests_org_cargo_profile_idx
  on public.freight_requests (organization_id, cargo_profile_id)
  where cargo_profile_id is not null;

-- Source: 20260829011002_add_cargo_category_intake_guidance.sql
alter table public.cargo_categories
  add column recommended_entry_methods jsonb not null default '["TOTAL_WEIGHT"]'::jsonb,
  add column intake_specification_schema jsonb not null default '{"fields":[]}'::jsonb,
  add column suggested_requirements jsonb not null default '{}'::jsonb,
  add column recommended_vehicle_classes jsonb not null default '[]'::jsonb,
  add column updated_at timestamptz not null default now();

alter table public.cargo_categories
  add constraint cargo_categories_entry_methods_array
    check (jsonb_typeof(recommended_entry_methods) = 'array'),
  add constraint cargo_categories_intake_schema_object
    check (jsonb_typeof(intake_specification_schema) = 'object'),
  add constraint cargo_categories_requirements_object
    check (jsonb_typeof(suggested_requirements) = 'object'),
  add constraint cargo_categories_vehicle_classes_array
    check (jsonb_typeof(recommended_vehicle_classes) = 'array');


-- Source: 20260830040348_c02_result_bridge_idempotency.sql
-- C-02 Result Bridge and Decision Engine persistence contract.
-- Both RPCs are intentionally service-role-only and SECURITY INVOKER. The
-- Next.js server validates the authenticated organization member before using
-- its isolated admin client, while these functions provide database atomicity.

alter table public.orchestration_events
  add column if not exists schema_version text,
  add column if not exists started_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists idempotency_payload jsonb;

alter table public.orchestration_events
  drop constraint if exists orchestration_events_schema_version_check;
alter table public.orchestration_events
  add constraint orchestration_events_schema_version_check
  check (schema_version is null or schema_version = '1.0');

alter table public.orchestration_events
  drop constraint if exists orchestration_events_tool_timeline_check;
alter table public.orchestration_events
  add constraint orchestration_events_tool_timeline_check
  check (
    started_at is null
    or completed_at is null
    or completed_at >= started_at
  );

create or replace function public.record_provider_result(
  p_tool_call_id text,
  p_orchestration_run_id uuid,
  p_freight_request_id uuid,
  p_carrier_id uuid,
  p_provider_url text,
  p_tool_name text,
  p_tool_input jsonb,
  p_tool_output jsonb,
  p_started_at timestamptz,
  p_completed_at timestamptz,
  p_schema_version text
)
returns table (
  event_id uuid,
  record_id uuid,
  record_type text,
  result_status text,
  deduplicated boolean
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_run public.orchestration_runs%rowtype;
  v_request public.freight_requests%rowtype;
  v_carrier public.carriers%rowtype;
  v_event public.orchestration_events%rowtype;
  v_existing_offer public.carrier_offers%rowtype;
  v_offer public.carrier_offers%rowtype;
  v_idempotency_payload jsonb;
  v_quote jsonb;
  v_duration_ms integer;
  v_availability_score numeric(5,2);
  v_reliability_score numeric(5,2) := 0;
  v_route_operations integer := 0;
  v_organization_history_score numeric(5,2) := 50;
  v_historical_average numeric(14,2);
  v_org_completed integer := 0;
  v_org_successful integer := 0;
begin
  if p_tool_call_id is null or btrim(p_tool_call_id) = '' then
    raise exception 'INVALID_ARGUMENT: tool_call_id is required' using errcode = '22023';
  end if;
  if p_schema_version <> '1.0' then
    raise exception 'UNSUPPORTED_SCHEMA_VERSION: expected 1.0' using errcode = '22023';
  end if;
  if p_tool_name <> 'quote_freight' then
    raise exception 'UNSUPPORTED_TOOL: only quote_freight is accepted by C-02' using errcode = '22023';
  end if;
  if p_completed_at < p_started_at then
    raise exception 'INVALID_TIMELINE: completed_at precedes started_at' using errcode = '22023';
  end if;
  if jsonb_typeof(p_tool_input) <> 'object'
    or p_tool_input ->> 'freight_request_id' is distinct from p_freight_request_id::text
  then
    raise exception 'CORRELATION_ERROR: tool input does not belong to freight request'
      using errcode = '22023';
  end if;

  -- Serialize the same tool call so a concurrent retry always observes the
  -- first committed event before mutable run state is evaluated.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_tool_call_id, 0)
  );

  select * into v_run
  from public.orchestration_runs
  where id = p_orchestration_run_id;

  if not found then
    raise exception 'ORCHESTRATION_RUN_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_run.freight_request_id <> p_freight_request_id then
    raise exception 'CORRELATION_ERROR: run does not belong to freight request' using errcode = '22023';
  end if;
  select * into v_request
  from public.freight_requests
  where id = p_freight_request_id;

  if not found then
    raise exception 'FREIGHT_REQUEST_NOT_FOUND' using errcode = 'P0002';
  end if;

  v_idempotency_payload := jsonb_build_object(
    'toolCallId', p_tool_call_id,
    'orchestrationRunId', p_orchestration_run_id,
    'freightRequestId', p_freight_request_id,
    'carrierId', p_carrier_id,
    'providerUrl', p_provider_url,
    'toolName', p_tool_name,
    'toolInput', coalesce(p_tool_input, 'null'::jsonb),
    'toolOutput', coalesce(p_tool_output, 'null'::jsonb),
    'startedAt', p_started_at,
    'completedAt', p_completed_at,
    'schemaVersion', p_schema_version
  );

  -- Idempotency is stable across the run lifecycle. An exact retry must keep
  -- succeeding after OPTIONS_READY/NO_MATCH; a changed payload must conflict.
  select * into v_event
  from public.orchestration_events
  where tool_call_id = p_tool_call_id;

  if found then
    if v_event.idempotency_payload = v_idempotency_payload then
      return query select
        v_event.id,
        v_event.persisted_entity_id,
        v_event.persisted_entity_type,
        'DEDUPLICATED'::text,
        true;
      return;
    end if;

    raise exception 'IDEMPOTENCY_CONFLICT: tool_call_id was already used with a different payload'
      using errcode = 'P0001';
  end if;

  if v_run.status <> 'RUNNING' then
    raise exception 'RUN_NOT_ACTIVE: orchestration run must be RUNNING' using errcode = '55000';
  end if;

  select * into v_carrier
  from public.carriers
  where id = p_carrier_id
    and status = 'ACTIVE'
    and supports_webmcp = true;

  if not found then
    raise exception 'CARRIER_NOT_AVAILABLE' using errcode = 'P0002';
  end if;
  if v_carrier.provider_url is distinct from p_provider_url then
    raise exception 'PROVIDER_URL_MISMATCH' using errcode = '22023';
  end if;

  v_duration_ms := greatest(
    0,
    floor(extract(epoch from (p_completed_at - p_started_at)) * 1000)::integer
  );

  begin
    insert into public.orchestration_events (
      orchestration_run_id,
      carrier_id,
      provider_url,
      event_type,
      tool_name,
      tool_call_id,
      input_payload,
      output_payload,
      status,
      duration_ms,
      schema_version,
      started_at,
      completed_at,
      idempotency_payload
    ) values (
      p_orchestration_run_id,
      p_carrier_id,
      p_provider_url,
      'PROVIDER_TOOL_RESULT_RECORDED',
      p_tool_name,
      p_tool_call_id,
      p_tool_input,
      p_tool_output,
      case when coalesce((p_tool_output ->> 'ok')::boolean, false) then 'SUCCEEDED' else 'FAILED' end,
      v_duration_ms,
      p_schema_version,
      p_started_at,
      p_completed_at,
      v_idempotency_payload
    )
    returning * into v_event;
  exception when unique_violation then
    select * into v_event
    from public.orchestration_events
    where tool_call_id = p_tool_call_id;

    if found and v_event.idempotency_payload = v_idempotency_payload then
      return query select
        v_event.id,
        v_event.persisted_entity_id,
        v_event.persisted_entity_type,
        'DEDUPLICATED'::text,
        true;
      return;
    end if;

    raise exception 'IDEMPOTENCY_CONFLICT: tool_call_id was already used with a different payload'
      using errcode = 'P0001';
  end;

  if jsonb_typeof(p_tool_output) <> 'object' or not (p_tool_output ? 'ok') then
    raise exception 'INVALID_TOOL_ENVELOPE' using errcode = '22023';
  end if;

  if not (p_tool_output ->> 'ok')::boolean then
    return query select v_event.id, null::uuid, null::text, 'INSERTED'::text, false;
    return;
  end if;

  v_quote := p_tool_output -> 'data';
  if jsonb_typeof(v_quote) <> 'object'
    or v_quote ->> 'schemaVersion' <> p_schema_version
    or v_quote ->> 'freightRequestId' <> p_freight_request_id::text
    or coalesce(v_quote ->> 'providerOfferReference', '') = ''
    or coalesce(v_quote ->> 'currency', '') <> 'USD'
    or (v_quote ->> 'price')::numeric <= 0
    or (v_quote ->> 'transitHours')::numeric <= 0
    or (v_quote ->> 'availableCapacityKg')::numeric < 0
    or v_quote ->> 'availabilityClass' not in (
      'EXACT_CONFIRMED_SLOT',
      'AVAILABLE_IN_WINDOW',
      'LIMITED_WINDOW',
      'WAITLIST',
      'UNAVAILABLE'
    )
  then
    raise exception 'INVALID_PROVIDER_QUOTE' using errcode = '22023';
  end if;

  if (v_quote ->> 'estimatedDelivery')::timestamptz < (v_quote ->> 'estimatedPickup')::timestamptz then
    raise exception 'INVALID_PROVIDER_QUOTE_TIMELINE' using errcode = '22023';
  end if;

  v_availability_score := case v_quote ->> 'availabilityClass'
    when 'EXACT_CONFIRMED_SLOT' then 100
    when 'AVAILABLE_IN_WINDOW' then 90
    when 'LIMITED_WINDOW' then 60
    when 'WAITLIST' then 30
    else 0
  end;

  select
    cm.success_rate,
    cm.route_completed_freight_requests,
    coalesce(cm.average_route_cost, cm.avg_cost)
  into
    v_reliability_score,
    v_route_operations,
    v_historical_average
  from public.carrier_metrics cm
  where cm.carrier_id = p_carrier_id
    and cm.organization_id is null
    and cm.transport_mode = v_request.transport_mode
    and cm.origin_country = v_request.origin_country
    and cm.origin_city = v_request.origin_city
    and cm.destination_country = v_request.destination_country
    and cm.destination_city = v_request.destination_city
    and (cm.cargo_category_id is null or cm.cargo_category_id = v_request.cargo_category_id)
  order by (cm.cargo_category_id = v_request.cargo_category_id) desc
  limit 1;

  v_reliability_score := coalesce(v_reliability_score, 0);
  v_route_operations := coalesce(v_route_operations, 0);

  select
    cm.organization_completed_freight_requests,
    cm.organization_successful_freight_requests
  into v_org_completed, v_org_successful
  from public.carrier_metrics cm
  where cm.carrier_id = p_carrier_id
    and cm.organization_id = v_request.organization_id
    and cm.transport_mode = v_request.transport_mode
    and cm.origin_country = v_request.origin_country
    and cm.origin_city = v_request.origin_city
    and cm.destination_country = v_request.destination_country
    and cm.destination_city = v_request.destination_city
    and (cm.cargo_category_id is null or cm.cargo_category_id = v_request.cargo_category_id)
  order by (cm.cargo_category_id = v_request.cargo_category_id) desc
  limit 1;

  if coalesce(v_org_completed, 0) > 0 then
    v_organization_history_score := least(
      100,
      greatest(0, v_org_successful::numeric / v_org_completed::numeric * 100)
    );
  end if;

  select * into v_existing_offer
  from public.carrier_offers
  where orchestration_run_id = p_orchestration_run_id
    and carrier_id = p_carrier_id
    and provider_offer_reference = v_quote ->> 'providerOfferReference';

  if found then
    if v_existing_offer.price = (v_quote ->> 'price')::numeric
      and v_existing_offer.currency = v_quote ->> 'currency'
      and v_existing_offer.transit_hours = (v_quote ->> 'transitHours')::numeric
      and v_existing_offer.availability_class = v_quote ->> 'availabilityClass'
      and v_existing_offer.quote_breakdown = coalesce(v_quote -> 'priceBreakdown', '{}'::jsonb)
    then
      update public.orchestration_events
      set persisted_entity_type = 'CARRIER_OFFER', persisted_entity_id = v_existing_offer.id
      where id = v_event.id;

      return query select
        v_event.id,
        v_existing_offer.id,
        'CARRIER_OFFER'::text,
        'DEDUPLICATED'::text,
        true;
      return;
    end if;

    raise exception 'PROVIDER_OFFER_CONFLICT: provider reference was reused with different commercial data'
      using errcode = 'P0001';
  end if;

  begin
    insert into public.carrier_offers (
    freight_request_id,
    carrier_id,
    orchestration_run_id,
    tool_call_id,
    provider_offer_reference,
    transport_mode,
    service_type,
    price,
    currency,
    quote_breakdown,
    estimated_pickup,
    estimated_delivery,
    transit_hours,
    available_capacity_kg,
    valid_until,
    availability_class,
    availability_score,
    reliability_score,
    route_operations,
    organization_history_score,
    compatibility_status,
    compatibility_notes,
    status
  ) values (
    p_freight_request_id,
    p_carrier_id,
    p_orchestration_run_id,
    p_tool_call_id,
    v_quote ->> 'providerOfferReference',
    v_request.transport_mode,
    v_request.service_type,
    (v_quote ->> 'price')::numeric,
    v_quote ->> 'currency',
    coalesce(v_quote -> 'priceBreakdown', '{}'::jsonb),
    (v_quote ->> 'estimatedPickup')::timestamptz,
    (v_quote ->> 'estimatedDelivery')::timestamptz,
    (v_quote ->> 'transitHours')::numeric,
    (v_quote ->> 'availableCapacityKg')::numeric,
    (v_quote ->> 'validUntil')::timestamptz,
    v_quote ->> 'availabilityClass',
    v_availability_score,
    v_reliability_score,
    v_route_operations,
    v_organization_history_score,
    'ELIGIBLE',
    jsonb_build_object(
      'schemaVersion', p_schema_version,
      'crossBorderSupported', coalesce((v_quote ->> 'crossBorderSupported')::boolean, false),
      'customsCoordinationIncluded', coalesce((v_quote ->> 'customsCoordinationIncluded')::boolean, false),
      'requiredDocuments', coalesce(v_quote -> 'requiredDocuments', '[]'::jsonb),
      'borderHandlingNotes', v_quote -> 'borderHandlingNotes',
      'historicalAverageRouteCost', to_jsonb(v_historical_average)
    ),
    'RECEIVED'
    )
    returning * into v_offer;
  exception when unique_violation then
    -- A concurrent retry can pass the pre-check before the first transaction commits.
    -- Resolve the winning row using the same commercial-payload rule instead of
    -- leaking a database uniqueness error or creating a second offer.
    select * into v_existing_offer
    from public.carrier_offers
    where orchestration_run_id = p_orchestration_run_id
      and carrier_id = p_carrier_id
      and provider_offer_reference = v_quote ->> 'providerOfferReference';

    if found
      and v_existing_offer.price = (v_quote ->> 'price')::numeric
      and v_existing_offer.currency = v_quote ->> 'currency'
      and v_existing_offer.transit_hours = (v_quote ->> 'transitHours')::numeric
      and v_existing_offer.availability_class = v_quote ->> 'availabilityClass'
      and v_existing_offer.quote_breakdown = coalesce(v_quote -> 'priceBreakdown', '{}'::jsonb)
    then
      update public.orchestration_events
      set persisted_entity_type = 'CARRIER_OFFER', persisted_entity_id = v_existing_offer.id
      where id = v_event.id;

      return query select
        v_event.id,
        v_existing_offer.id,
        'CARRIER_OFFER'::text,
        'DEDUPLICATED'::text,
        true;
      return;
    end if;

    raise exception 'PROVIDER_OFFER_CONFLICT: provider reference was reused with different commercial data'
      using errcode = 'P0001';
  end;

  update public.orchestration_events
  set persisted_entity_type = 'CARRIER_OFFER', persisted_entity_id = v_offer.id
  where id = v_event.id;

  return query select
    v_event.id,
    v_offer.id,
    'CARRIER_OFFER'::text,
    'INSERTED'::text,
    false;
end;
$$;

revoke execute on function public.record_provider_result(
  text, uuid, uuid, uuid, text, text, jsonb, jsonb, timestamptz, timestamptz, text
) from public, anon, authenticated;
grant execute on function public.record_provider_result(
  text, uuid, uuid, uuid, text, text, jsonb, jsonb, timestamptz, timestamptz, text
) to service_role;

create or replace function public.persist_balanced_decision(
  p_orchestration_run_id uuid,
  p_freight_request_id uuid,
  p_ranking jsonb,
  p_candidate_snapshot jsonb,
  p_confidence_score numeric,
  p_confidence_components jsonb,
  p_subscores jsonb,
  p_anomaly_evidence jsonb,
  p_recommended_offer_id uuid,
  p_requires_review boolean
)
returns table (
  decision_id uuid,
  run_status text
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_run public.orchestration_runs%rowtype;
  v_existing_decision public.freight_decisions%rowtype;
  v_decision public.freight_decisions%rowtype;
  v_previous_decision public.freight_decisions%rowtype;
  v_decision_version integer;
  v_top_raw_score numeric(8,4);
  v_option jsonb;
begin
  select * into v_run
  from public.orchestration_runs
  where id = p_orchestration_run_id;

  if not found then
    raise exception 'ORCHESTRATION_RUN_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_run.freight_request_id <> p_freight_request_id then
    raise exception 'CORRELATION_ERROR: run does not belong to freight request' using errcode = '22023';
  end if;

  select * into v_existing_decision
  from public.freight_decisions
  where orchestration_run_id = p_orchestration_run_id;

  if found then
    return query select v_existing_decision.id, 'OPTIONS_READY'::text;
    return;
  end if;

  if jsonb_typeof(p_ranking) <> 'object'
    or jsonb_typeof(p_ranking -> 'options') <> 'array'
  then
    raise exception 'INVALID_RANKING_PAYLOAD' using errcode = '22023';
  end if;

  for v_option in select value from jsonb_array_elements(p_ranking -> 'options')
  loop
    update public.carrier_offers
    set
      final_score = (v_option ->> 'rawScore')::numeric,
      status = case when (v_option ->> 'eligible')::boolean then 'ELIGIBLE' else 'INELIGIBLE' end,
      compatibility_status = case when (v_option ->> 'eligible')::boolean then 'ELIGIBLE' else 'INELIGIBLE' end
    where id = (v_option ->> 'offerId')::uuid
      and orchestration_run_id = p_orchestration_run_id;

    if not found then
      raise exception 'RANKING_OFFER_MISMATCH' using errcode = '22023';
    end if;
  end loop;

  if p_recommended_offer_id is null then
    update public.orchestration_runs
    set status = 'NO_MATCH', completed_at = now(), error_code = null, error_message = null
    where id = p_orchestration_run_id;

    update public.freight_requests
    set status = 'PENDING', updated_at = now()
    where id = p_freight_request_id;

    return query select null::uuid, 'NO_MATCH'::text;
    return;
  end if;

  if not exists (
    select 1
    from public.carrier_offers
    where id = p_recommended_offer_id
      and orchestration_run_id = p_orchestration_run_id
      and status = 'ELIGIBLE'
  ) then
    raise exception 'RECOMMENDED_OFFER_MISMATCH' using errcode = '22023';
  end if;

  select * into v_previous_decision
  from public.freight_decisions
  where freight_request_id = p_freight_request_id
  order by decision_version desc
  limit 1;

  v_decision_version := coalesce(v_previous_decision.decision_version, 0) + 1;
  v_top_raw_score := (p_ranking -> 'options' -> 0 ->> 'rawScore')::numeric;

  insert into public.freight_decisions (
    freight_request_id,
    orchestration_run_id,
    previous_decision_id,
    decision_version,
    decision_type,
    recommended_offer_id,
    optimization_strategy,
    heuristic_score,
    confidence_score,
    decision_reason,
    candidate_snapshot,
    ranking_snapshot,
    subscores,
    confidence_components,
    anomaly_evidence,
    requires_review
  ) values (
    p_freight_request_id,
    p_orchestration_run_id,
    v_previous_decision.id,
    v_decision_version,
    v_run.run_type,
    p_recommended_offer_id,
    'BALANCED',
    v_top_raw_score,
    p_confidence_score,
    'Deterministic BALANCED ranking over eligible runtime offers.',
    p_candidate_snapshot,
    p_ranking -> 'options',
    p_subscores,
    p_confidence_components,
    p_anomaly_evidence,
    p_requires_review
  )
  returning * into v_decision;

  update public.orchestration_runs
  set status = 'OPTIONS_READY', completed_at = now(), error_code = null, error_message = null
  where id = p_orchestration_run_id;

  update public.freight_requests
  set status = 'AWAITING_SELECTION', updated_at = now()
  where id = p_freight_request_id;

  return query select v_decision.id, 'OPTIONS_READY'::text;
end;
$$;

revoke execute on function public.persist_balanced_decision(
  uuid, uuid, jsonb, jsonb, numeric, jsonb, jsonb, jsonb, uuid, boolean
) from public, anon, authenticated;
grant execute on function public.persist_balanced_decision(
  uuid, uuid, jsonb, jsonb, numeric, jsonb, jsonb, jsonb, uuid, boolean
) to service_role;

-- Source: 20260830182517_int02a_generalize_result_bridge.sql
-- INT-02A: preserve the discovered carrier service and record every provider
-- tool call through one idempotent Result Bridge. The existing C-02 function
-- remains the quote persistence primitive; this overload adds the canonical
-- browser-runner envelope and handles coverage/capacity/technical events.

alter table public.orchestration_events
  add column if not exists carrier_service_id uuid references public.carrier_services(id),
  add column if not exists navigation_url text,
  add column if not exists attempt_number integer,
  add column if not exists execution_status text,
  add column if not exists technical_error jsonb;

alter table public.carrier_offers
  add column if not exists carrier_service_id uuid references public.carrier_services(id);

alter table public.orchestration_events
  drop constraint if exists orchestration_events_attempt_number_check;
alter table public.orchestration_events
  add constraint orchestration_events_attempt_number_check
  check (attempt_number is null or attempt_number > 0);

alter table public.orchestration_events
  drop constraint if exists orchestration_events_execution_status_check;
alter table public.orchestration_events
  add constraint orchestration_events_execution_status_check
  check (execution_status is null or execution_status in ('COMPLETED', 'TECHNICAL_ERROR'));

create index if not exists orchestration_events_carrier_service_idx
  on public.orchestration_events (carrier_service_id);
create index if not exists carrier_offers_carrier_service_idx
  on public.carrier_offers (carrier_service_id);

create or replace function public.record_provider_result(
  p_tool_call_id text,
  p_orchestration_run_id uuid,
  p_freight_request_id uuid,
  p_carrier_id uuid,
  p_carrier_service_id uuid,
  p_provider_url text,
  p_navigation_url text,
  p_tool_name text,
  p_attempt_number integer,
  p_tool_input jsonb,
  p_tool_output jsonb,
  p_started_at timestamptz,
  p_completed_at timestamptz,
  p_duration_ms integer,
  p_execution_status text,
  p_technical_error jsonb,
  p_cargomesh_origin text,
  p_schema_version text
)
returns table (
  event_id uuid,
  record_id uuid,
  record_type text,
  result_status text,
  deduplicated boolean
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_run public.orchestration_runs%rowtype;
  v_carrier public.carriers%rowtype;
  v_service public.carrier_services%rowtype;
  v_event public.orchestration_events%rowtype;
  v_legacy_result record;
  v_idempotency_payload jsonb;
  v_output_ok boolean;
  v_registered_navigation_base text;
  v_navigation_base text;
  v_navigation_fragment text;
  v_expected_navigation_url text;
begin
  if p_tool_call_id is null or btrim(p_tool_call_id) = '' then
    raise exception 'INVALID_ARGUMENT: tool_call_id is required' using errcode = '22023';
  end if;
  if p_schema_version <> '1.0' then
    raise exception 'UNSUPPORTED_SCHEMA_VERSION: expected 1.0' using errcode = '22023';
  end if;
  if p_tool_name not in ('check_service_coverage', 'check_capacity', 'quote_freight') then
    raise exception 'UNSUPPORTED_TOOL: INT-02A provider tool is required' using errcode = '22023';
  end if;
  if p_attempt_number is null or p_attempt_number < 1 then
    raise exception 'INVALID_ATTEMPT_NUMBER' using errcode = '22023';
  end if;
  if p_completed_at < p_started_at or p_duration_ms < 0 then
    raise exception 'INVALID_TIMELINE' using errcode = '22023';
  end if;
  if p_duration_ms <> floor(extract(epoch from (p_completed_at - p_started_at)) * 1000)::integer then
    raise exception 'INVALID_DURATION' using errcode = '22023';
  end if;
  if p_execution_status not in ('COMPLETED', 'TECHNICAL_ERROR') then
    raise exception 'INVALID_EXECUTION_STATUS' using errcode = '22023';
  end if;
  if p_tool_call_id <> concat_ws(
    ':',
    'cm',
    'int02a',
    'v1',
    p_orchestration_run_id,
    p_freight_request_id,
    p_carrier_id,
    p_carrier_service_id,
    p_tool_name,
    p_attempt_number
  ) then
    raise exception 'INVALID_TOOL_CALL_ID: canonical INT-02A identity required'
      using errcode = '22023';
  end if;
  if p_execution_status = 'COMPLETED' and (p_tool_output is null or p_technical_error is not null) then
    raise exception 'INVALID_EXECUTION_RESULT: completed calls require output without technical error'
      using errcode = '22023';
  end if;
  if p_execution_status = 'TECHNICAL_ERROR' and p_technical_error is null then
    raise exception 'INVALID_EXECUTION_RESULT: technical errors require evidence'
      using errcode = '22023';
  end if;
  if jsonb_typeof(p_tool_input) <> 'object' then
    raise exception 'INVALID_TOOL_INPUT' using errcode = '22023';
  end if;
  if p_tool_name = 'quote_freight'
    and p_tool_input ->> 'freight_request_id' is distinct from p_freight_request_id::text
  then
    raise exception 'CORRELATION_ERROR: quote input does not belong to freight request'
      using errcode = '22023';
  end if;
  if p_tool_output is not null
    and (jsonb_typeof(p_tool_output) <> 'object' or not (p_tool_output ? 'ok'))
  then
    raise exception 'INVALID_TOOL_ENVELOPE' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_tool_call_id, 0)
  );

  select * into v_run
  from public.orchestration_runs
  where id = p_orchestration_run_id;

  if not found then
    raise exception 'ORCHESTRATION_RUN_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_run.freight_request_id <> p_freight_request_id then
    raise exception 'CORRELATION_ERROR: run does not belong to freight request' using errcode = '22023';
  end if;

  v_idempotency_payload := jsonb_build_object(
    'schemaVersion', p_schema_version,
    'toolCallId', p_tool_call_id,
    'orchestrationRunId', p_orchestration_run_id,
    'freightRequestId', p_freight_request_id,
    'carrierId', p_carrier_id,
    'matchingServiceId', p_carrier_service_id,
    'providerUrl', p_provider_url,
    'navigationUrl', p_navigation_url,
    'toolName', p_tool_name,
    'attemptNumber', p_attempt_number,
    'toolInput', coalesce(p_tool_input, 'null'::jsonb),
    'toolOutput', coalesce(p_tool_output, 'null'::jsonb),
    'startedAt', p_started_at,
    'completedAt', p_completed_at,
    'durationMs', p_duration_ms,
    'status', p_execution_status,
    'technicalError', coalesce(p_technical_error, 'null'::jsonb)
  );

  select * into v_event
  from public.orchestration_events
  where tool_call_id = p_tool_call_id;

  if found then
    if v_event.idempotency_payload = v_idempotency_payload then
      return query select
        v_event.id,
        v_event.persisted_entity_id,
        v_event.persisted_entity_type,
        'DEDUPLICATED'::text,
        true;
      return;
    end if;
    raise exception 'IDEMPOTENCY_CONFLICT: tool_call_id was already used with a different payload'
      using errcode = 'P0001';
  end if;

  if v_run.status <> 'RUNNING' then
    raise exception 'RUN_NOT_ACTIVE: orchestration run must be RUNNING' using errcode = '55000';
  end if;

  select * into v_carrier
  from public.carriers
  where id = p_carrier_id and status = 'ACTIVE' and supports_webmcp = true;

  if not found then
    raise exception 'CARRIER_NOT_AVAILABLE' using errcode = 'P0002';
  end if;
  if v_carrier.provider_url is distinct from p_provider_url then
    raise exception 'PROVIDER_URL_MISMATCH' using errcode = '22023';
  end if;

  select * into v_service
  from public.carrier_services
  where id = p_carrier_service_id
    and carrier_id = p_carrier_id
    and active = true
    and provider_service_code is not null;

  if not found then
    raise exception 'CARRIER_SERVICE_MISMATCH' using errcode = '22023';
  end if;

  -- Rebuild the expected URL from the registered provider URL. Internal
  -- providers must resolve against CargoMesh itself; external providers keep
  -- their own origin, pathname and every registered base query parameter.
  if p_provider_url is null
    or btrim(p_provider_url) = ''
    or v_carrier.provider_url is null
    or p_cargomesh_origin is null
    or p_cargomesh_origin !~ '^https?://[^/?#]+$'
    or p_navigation_url is null
    or btrim(p_navigation_url) = ''
    or p_navigation_url !~ '^https?://'
    or v_carrier.provider_url ~ '[?&]serviceId='
  then
    raise exception 'INVALID_PROVIDER_NAVIGATION' using errcode = '22023';
  end if;

  v_registered_navigation_base := case
    when left(v_carrier.provider_url, 1) = '/'
      then p_cargomesh_origin || v_carrier.provider_url
    else v_carrier.provider_url
  end;
  if v_registered_navigation_base ~ '^https?://[^/?#]+([?#]|$)' then
    v_registered_navigation_base := pg_catalog.regexp_replace(
      v_registered_navigation_base,
      '^(https?://[^/?#]+)([?#]|$)',
      E'\\1/\\2'
    );
  end if;
  v_navigation_fragment := coalesce(
    substring(v_registered_navigation_base from '(#.*)$'),
    ''
  );
  v_navigation_base := split_part(v_registered_navigation_base, '#', 1);
  v_expected_navigation_url := v_navigation_base
    || case when position('?' in v_navigation_base) > 0 then '&' else '?' end
    || 'serviceId=' || p_carrier_service_id::text
    || v_navigation_fragment;

  if p_navigation_url <> v_expected_navigation_url
    or (
      select count(*)
      from pg_catalog.regexp_matches(p_navigation_url, '[?&]serviceId=', 'g')
    ) <> 1
  then
    raise exception 'INVALID_PROVIDER_NAVIGATION' using errcode = '22023';
  end if;

  if p_tool_output is not null then
    v_output_ok := coalesce((p_tool_output ->> 'ok')::boolean, false);
    if v_output_ok
      and p_tool_name in ('check_service_coverage', 'check_capacity')
      and (
        jsonb_typeof(p_tool_output -> 'data') <> 'object'
        or p_tool_output -> 'data' ->> 'schemaVersion' <> p_schema_version
        or p_tool_output -> 'data' ->> 'providerServiceCode' is distinct from v_service.provider_service_code
      )
    then
      raise exception 'PROVIDER_SERVICE_CODE_MISMATCH' using errcode = '22023';
    end if;
  else
    v_output_ok := false;
  end if;

  -- Successful/error quote envelopes continue through the verified C-02 quote
  -- persistence primitive. Null technical outputs and non-quote tools create
  -- observability events only and can never create CarrierOffer rows.
  if p_tool_name = 'quote_freight' and p_tool_output is not null then
    select * into v_legacy_result
    from public.record_provider_result(
      p_tool_call_id,
      p_orchestration_run_id,
      p_freight_request_id,
      p_carrier_id,
      p_provider_url,
      p_tool_name,
      p_tool_input,
      p_tool_output,
      p_started_at,
      p_completed_at,
      p_schema_version
    );

    update public.orchestration_events
    set carrier_service_id = p_carrier_service_id,
        navigation_url = p_navigation_url,
        attempt_number = p_attempt_number,
        duration_ms = p_duration_ms,
        execution_status = p_execution_status,
        technical_error = p_technical_error,
        idempotency_payload = v_idempotency_payload
    where id = v_legacy_result.event_id;

    if v_legacy_result.record_type = 'CARRIER_OFFER' and v_legacy_result.record_id is not null then
      update public.carrier_offers
      set carrier_service_id = p_carrier_service_id
      where id = v_legacy_result.record_id;
    end if;

    return query select
      v_legacy_result.event_id::uuid,
      v_legacy_result.record_id::uuid,
      v_legacy_result.record_type::text,
      v_legacy_result.result_status::text,
      v_legacy_result.deduplicated::boolean;
    return;
  end if;

  insert into public.orchestration_events (
    orchestration_run_id,
    carrier_id,
    carrier_service_id,
    provider_url,
    navigation_url,
    event_type,
    tool_name,
    tool_call_id,
    attempt_number,
    input_payload,
    output_payload,
    status,
    duration_ms,
    execution_status,
    technical_error,
    schema_version,
    started_at,
    completed_at,
    idempotency_payload
  ) values (
    p_orchestration_run_id,
    p_carrier_id,
    p_carrier_service_id,
    p_provider_url,
    p_navigation_url,
    'PROVIDER_TOOL_RESULT_RECORDED',
    p_tool_name,
    p_tool_call_id,
    p_attempt_number,
    p_tool_input,
    p_tool_output,
    case when v_output_ok and p_execution_status = 'COMPLETED' then 'SUCCEEDED' else 'FAILED' end,
    p_duration_ms,
    p_execution_status,
    p_technical_error,
    p_schema_version,
    p_started_at,
    p_completed_at,
    v_idempotency_payload
  ) returning * into v_event;

  return query select v_event.id, null::uuid, null::text, 'INSERTED'::text, false;
end;
$$;

revoke execute on function public.record_provider_result(
  text, uuid, uuid, uuid, uuid, text, text, text, integer,
  jsonb, jsonb, timestamptz, timestamptz, integer, text, jsonb, text, text
) from public, anon, authenticated;
grant execute on function public.record_provider_result(
  text, uuid, uuid, uuid, uuid, text, text, text, integer,
  jsonb, jsonb, timestamptz, timestamptz, integer, text, jsonb, text, text
) to service_role;

-- Source: 20260830210000_int02a_orchestration_run_api.sql
-- INT-02A: create an auditable, idempotent orchestration run before a
-- browser-runner executes any WebMCP provider tool. CandidateProvider keeps
-- its frozen contract; this snapshot only makes the discovered set immutable
-- for the lifecycle of one run.

alter table public.orchestration_runs
  add column if not exists idempotency_key text,
  add column if not exists candidate_snapshot jsonb not null default '[]'::jsonb,
  add column if not exists result_snapshot jsonb;

alter table public.orchestration_runs
  drop constraint if exists orchestration_runs_idempotency_key_check;
alter table public.orchestration_runs
  add constraint orchestration_runs_idempotency_key_check
  check (
    idempotency_key is null
    or (btrim(idempotency_key) <> '' and length(idempotency_key) <= 200)
  );

alter table public.orchestration_runs
  drop constraint if exists orchestration_runs_candidate_snapshot_check;
alter table public.orchestration_runs
  add constraint orchestration_runs_candidate_snapshot_check
  check (jsonb_typeof(candidate_snapshot) = 'array');

alter table public.orchestration_runs
  drop constraint if exists orchestration_runs_result_snapshot_check;
alter table public.orchestration_runs
  add constraint orchestration_runs_result_snapshot_check
  check (result_snapshot is null or jsonb_typeof(result_snapshot) = 'object');

create unique index if not exists orchestration_runs_request_idempotency_unique
  on public.orchestration_runs (freight_request_id, idempotency_key)
  where idempotency_key is not null;

create or replace function public.start_orchestration_run(
  p_freight_request_id uuid,
  p_created_by_member_id uuid,
  p_idempotency_key text,
  p_candidate_snapshot jsonb
)
returns table (
  orchestration_run_id uuid,
  freight_request_id uuid,
  status text,
  deduplicated boolean,
  candidate_snapshot jsonb
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_request public.freight_requests%rowtype;
  v_member public.organization_members%rowtype;
  v_existing public.orchestration_runs%rowtype;
  v_run public.orchestration_runs%rowtype;
begin
  if p_freight_request_id is null or p_created_by_member_id is null then
    raise exception 'INVALID_ARGUMENT: freight request and member are required'
      using errcode = '22023';
  end if;
  if p_idempotency_key is null
    or btrim(p_idempotency_key) = ''
    or length(p_idempotency_key) > 200
  then
    raise exception 'INVALID_ARGUMENT: idempotency key must be between 1 and 200 characters'
      using errcode = '22023';
  end if;
  if jsonb_typeof(p_candidate_snapshot) <> 'array' then
    raise exception 'INVALID_ARGUMENT: candidate snapshot must be an array'
      using errcode = '22023';
  end if;

  select om.* into v_member
  from public.organization_members as om
  where om.id = p_created_by_member_id
    and om.status = 'ACTIVE';

  if not found then
    raise exception 'FORBIDDEN: active organization membership is required'
      using errcode = '42501';
  end if;

  -- A replay is legal after the request advances from PENDING. Resolve it
  -- before locking or checking the mutable request state.
  select r.* into v_existing
  from public.orchestration_runs as r
  where r.freight_request_id = p_freight_request_id
    and r.idempotency_key = p_idempotency_key;

  if found then
    return query select
      v_existing.id,
      v_existing.freight_request_id,
      v_existing.status,
      true,
      v_existing.candidate_snapshot;
    return;
  end if;

  -- Serialise distinct start attempts for the same FreightRequest. The second
  -- request sees ORCHESTRATING after this lock is released and cannot create a
  -- competing initial run with another idempotency key.
  select * into v_request
  from public.freight_requests
  where id = p_freight_request_id
  for update;

  if not found then
    raise exception 'NOT_FOUND: FreightRequest not found' using errcode = 'P0002';
  end if;
  if v_request.organization_id <> v_member.organization_id then
    raise exception 'CORRELATION_ERROR: member does not belong to FreightRequest organization'
      using errcode = '22023';
  end if;

  -- Recheck after obtaining the lock, so a concurrent exact replay returns
  -- the canonical run instead of a request-state conflict.
  select r.* into v_existing
  from public.orchestration_runs as r
  where r.freight_request_id = p_freight_request_id
    and r.idempotency_key = p_idempotency_key;

  if found then
    return query select
      v_existing.id,
      v_existing.freight_request_id,
      v_existing.status,
      true,
      v_existing.candidate_snapshot;
    return;
  end if;

  if v_request.status <> 'PENDING' then
    raise exception 'FREIGHT_REQUEST_NOT_READY: expected PENDING, got %', v_request.status
      using errcode = 'P0001';
  end if;

  insert into public.orchestration_runs (
    freight_request_id,
    run_type,
    status,
    created_by_member_id,
    idempotency_key,
    candidate_snapshot
  ) values (
    p_freight_request_id,
    'INITIAL',
    'RUNNING',
    p_created_by_member_id,
    p_idempotency_key,
    p_candidate_snapshot
  )
  returning * into v_run;

  update public.freight_requests
  set status = 'ORCHESTRATING', updated_at = now()
  where id = p_freight_request_id;

  return query select
    v_run.id,
    v_run.freight_request_id,
    v_run.status,
    false,
    v_run.candidate_snapshot;
end;
$$;

revoke all on function public.start_orchestration_run(uuid, uuid, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.start_orchestration_run(uuid, uuid, text, jsonb)
  to service_role;

-- C-02 deliberately avoids a synthetic FreightDecision for NO_MATCH. Persist
-- the immutable ranking on the run as well, so the INT-02A read model can
-- explain both success and NO_MATCH without rerunning BALANCED during GET.
create or replace function public.persist_balanced_decision(
  p_orchestration_run_id uuid,
  p_freight_request_id uuid,
  p_ranking jsonb,
  p_candidate_snapshot jsonb,
  p_confidence_score numeric,
  p_confidence_components jsonb,
  p_subscores jsonb,
  p_anomaly_evidence jsonb,
  p_recommended_offer_id uuid,
  p_requires_review boolean
)
returns table (
  decision_id uuid,
  run_status text
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_run public.orchestration_runs%rowtype;
  v_existing_decision public.freight_decisions%rowtype;
  v_decision public.freight_decisions%rowtype;
  v_previous_decision public.freight_decisions%rowtype;
  v_decision_version integer;
  v_top_raw_score numeric(8,4);
  v_option jsonb;
begin
  select * into v_run
  from public.orchestration_runs
  where id = p_orchestration_run_id;

  if not found then
    raise exception 'ORCHESTRATION_RUN_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_run.freight_request_id <> p_freight_request_id then
    raise exception 'CORRELATION_ERROR: run does not belong to freight request' using errcode = '22023';
  end if;
  if jsonb_typeof(p_ranking) <> 'object'
    or jsonb_typeof(p_ranking -> 'options') <> 'array'
  then
    raise exception 'INVALID_RANKING_PAYLOAD' using errcode = '22023';
  end if;

  select * into v_existing_decision
  from public.freight_decisions
  where orchestration_run_id = p_orchestration_run_id;

  if found then
    update public.orchestration_runs
    set result_snapshot = p_ranking
    where id = p_orchestration_run_id;
    return query select v_existing_decision.id, 'OPTIONS_READY'::text;
    return;
  end if;

  for v_option in select value from jsonb_array_elements(p_ranking -> 'options')
  loop
    update public.carrier_offers
    set
      final_score = (v_option ->> 'rawScore')::numeric,
      status = case when (v_option ->> 'eligible')::boolean then 'ELIGIBLE' else 'INELIGIBLE' end,
      compatibility_status = case when (v_option ->> 'eligible')::boolean then 'ELIGIBLE' else 'INELIGIBLE' end
    where id = (v_option ->> 'offerId')::uuid
      and orchestration_run_id = p_orchestration_run_id;

    if not found then
      raise exception 'RANKING_OFFER_MISMATCH' using errcode = '22023';
    end if;
  end loop;

  if p_recommended_offer_id is null then
    update public.orchestration_runs
    set
      status = 'NO_MATCH',
      completed_at = now(),
      error_code = null,
      error_message = null,
      result_snapshot = p_ranking
    where id = p_orchestration_run_id;

    update public.freight_requests
    set status = 'PENDING', updated_at = now()
    where id = p_freight_request_id;

    return query select null::uuid, 'NO_MATCH'::text;
    return;
  end if;

  if not exists (
    select 1
    from public.carrier_offers
    where id = p_recommended_offer_id
      and orchestration_run_id = p_orchestration_run_id
      and status = 'ELIGIBLE'
  ) then
    raise exception 'RECOMMENDED_OFFER_MISMATCH' using errcode = '22023';
  end if;

  select * into v_previous_decision
  from public.freight_decisions
  where freight_request_id = p_freight_request_id
  order by decision_version desc
  limit 1;

  v_decision_version := coalesce(v_previous_decision.decision_version, 0) + 1;
  v_top_raw_score := (p_ranking -> 'options' -> 0 ->> 'rawScore')::numeric;

  insert into public.freight_decisions (
    freight_request_id,
    orchestration_run_id,
    previous_decision_id,
    decision_version,
    decision_type,
    recommended_offer_id,
    optimization_strategy,
    heuristic_score,
    confidence_score,
    decision_reason,
    candidate_snapshot,
    ranking_snapshot,
    subscores,
    confidence_components,
    anomaly_evidence,
    requires_review
  ) values (
    p_freight_request_id,
    p_orchestration_run_id,
    v_previous_decision.id,
    v_decision_version,
    v_run.run_type,
    p_recommended_offer_id,
    'BALANCED',
    v_top_raw_score,
    p_confidence_score,
    'Deterministic BALANCED ranking over eligible runtime offers.',
    p_candidate_snapshot,
    p_ranking -> 'options',
    p_subscores,
    p_confidence_components,
    p_anomaly_evidence,
    p_requires_review
  )
  returning * into v_decision;

  update public.orchestration_runs
  set
    status = 'OPTIONS_READY',
    completed_at = now(),
    error_code = null,
    error_message = null,
    result_snapshot = p_ranking
  where id = p_orchestration_run_id;

  update public.freight_requests
  set status = 'AWAITING_SELECTION', updated_at = now()
  where id = p_freight_request_id;

  return query select v_decision.id, 'OPTIONS_READY'::text;
end;
$$;

-- Source: 20260831062736_c03_booking_bridge.sql
-- C-03 â€” Booking Bridge
--
-- Provider tools are intentionally unable to create CargoMesh bookings.  This
-- migration stores the server-issued authorization separately and exposes
-- service-role-only persistence functions for the two booking tools.

create table public.booking_authorizations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  freight_request_id uuid not null references public.freight_requests(id) on delete cascade,
  freight_decision_id uuid not null references public.freight_decisions(id) on delete restrict,
  offer_id uuid not null references public.carrier_offers(id) on delete restrict,
  carrier_id uuid not null references public.carriers(id) on delete restrict,
  carrier_service_id uuid not null references public.carrier_services(id) on delete restrict,
  selected_by_member_id uuid not null references public.organization_members(id) on delete restrict,
  selection_mode text not null check (selection_mode in ('ASSISTED', 'SMART_AUTO')),
  authorization_kind text not null check (authorization_kind in ('HUMAN_SELECTION', 'AUTO_BOOKING_POLICY')),
  booking_idempotency_key text not null,
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  consumed_booking_id uuid references public.bookings(id) on delete set null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint booking_authorizations_idempotency_unique unique (booking_idempotency_key),
  constraint booking_authorizations_expiry_check check (expires_at > issued_at)
);

create index booking_authorizations_request_idx
  on public.booking_authorizations (freight_request_id, created_at desc);
create index booking_authorizations_offer_idx
  on public.booking_authorizations (offer_id)
  where revoked_at is null;

create table public.booking_bridge_calls (
  bridge_call_id text primary key,
  authorization_id uuid not null references public.booking_authorizations(id) on delete cascade,
  booking_id uuid not null references public.bookings(id) on delete cascade,
  tool_name text not null check (tool_name in ('book_freight', 'get_provider_booking_status')),
  canonical_payload jsonb not null,
  created_at timestamptz not null default now()
);

create index booking_bridge_calls_booking_idx
  on public.booking_bridge_calls (booking_id, created_at);

alter table public.booking_authorizations enable row level security;
alter table public.booking_bridge_calls enable row level security;

revoke all on table public.booking_authorizations, public.booking_bridge_calls from anon, authenticated;
grant all on table public.booking_authorizations, public.booking_bridge_calls to service_role;

create policy booking_authorizations_member_select
on public.booking_authorizations
for select to authenticated
using ((select private.is_organization_member(organization_id)));

create policy booking_bridge_calls_member_select
on public.booking_bridge_calls
for select to authenticated
using (
  exists (
    select 1
    from public.booking_authorizations ba
    where ba.id = booking_bridge_calls.authorization_id
      and (select private.is_organization_member(ba.organization_id))
  )
);

create or replace function public.prepare_booking_authorization(
  p_freight_request_id uuid,
  p_offer_id uuid,
  p_selected_by_member_id uuid,
  p_selection_mode text,
  p_booking_idempotency_key text
)
returns table (
  authorization_reference uuid,
  freight_decision_id uuid,
  freight_request_id uuid,
  offer_id uuid,
  carrier_id uuid,
  matching_service_id uuid,
  provider_offer_reference text,
  authorization_kind text,
  selection_mode text,
  booking_idempotency_key text,
  expires_at timestamptz,
  deduplicated boolean
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_request public.freight_requests%rowtype;
  v_offer public.carrier_offers%rowtype;
  v_decision public.freight_decisions%rowtype;
  v_member public.organization_members%rowtype;
  v_preferences public.organization_preferences%rowtype;
  v_existing public.booking_authorizations%rowtype;
  v_authorization public.booking_authorizations%rowtype;
  v_authorization_kind text;
begin
  if p_selection_mode not in ('ASSISTED', 'SMART_AUTO') then
    raise exception 'INVALID_SELECTION_MODE' using errcode = '22023';
  end if;
  if p_booking_idempotency_key is null or btrim(p_booking_idempotency_key) = '' then
    raise exception 'INVALID_BOOKING_IDEMPOTENCY_KEY' using errcode = '22023';
  end if;

  select * into v_existing
  from public.booking_authorizations ba
  where ba.booking_idempotency_key = p_booking_idempotency_key;

  if found then
    if v_existing.freight_request_id = p_freight_request_id
      and v_existing.offer_id = p_offer_id
      and v_existing.selected_by_member_id = p_selected_by_member_id
      and v_existing.selection_mode = p_selection_mode
      and v_existing.revoked_at is null
    then
      return query select
        v_existing.id,
        v_existing.freight_decision_id,
        v_existing.freight_request_id,
        v_existing.offer_id,
        v_existing.carrier_id,
        v_existing.carrier_service_id,
        coalesce((select co.provider_offer_reference from public.carrier_offers co where co.id = v_existing.offer_id), ''),
        v_existing.authorization_kind,
        v_existing.selection_mode,
        v_existing.booking_idempotency_key,
        v_existing.expires_at,
        true;
      return;
    end if;
    raise exception 'IDEMPOTENCY_CONFLICT: booking idempotency key was already used with a different selection'
      using errcode = 'P0001';
  end if;

  select * into v_request
  from public.freight_requests fr
  where fr.id = p_freight_request_id;
  if not found then
    raise exception 'FREIGHT_REQUEST_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_request.status <> 'AWAITING_SELECTION' then
    raise exception 'FREIGHT_REQUEST_NOT_READY_FOR_BOOKING' using errcode = '55000';
  end if;

  select * into v_member
  from public.organization_members om
  where om.id = p_selected_by_member_id
    and om.organization_id = v_request.organization_id
    and om.status = 'ACTIVE';
  if not found then
    raise exception 'AUTHORIZATION_MEMBER_MISMATCH' using errcode = '42501';
  end if;

  select * into v_offer
  from public.carrier_offers co
  where co.id = p_offer_id
    and co.freight_request_id = p_freight_request_id
    and co.status = 'ELIGIBLE'
    and co.valid_until > now();
  if not found or v_offer.carrier_service_id is null or v_offer.provider_offer_reference is null then
    raise exception 'BOOKING_OFFER_NOT_ELIGIBLE' using errcode = '22023';
  end if;

  select * into v_decision
  from public.freight_decisions fd
  where fd.freight_request_id = p_freight_request_id
  order by fd.decision_version desc
  limit 1;
  if not found then
    raise exception 'FREIGHT_DECISION_NOT_FOUND' using errcode = 'P0002';
  end if;

  if p_selection_mode = 'SMART_AUTO' then
    select * into v_preferences
    from public.organization_preferences op
    where op.organization_id = v_request.organization_id;
    if not found or not v_preferences.allow_auto_booking or v_member.role not in ('OWNER', 'SUPERVISOR') then
      raise exception 'SMART_AUTO_NOT_AUTHORIZED' using errcode = '42501';
    end if;
    if v_decision.recommended_offer_id is distinct from p_offer_id then
      raise exception 'SMART_AUTO_REQUIRES_RECOMMENDED_OFFER' using errcode = '22023';
    end if;
    v_authorization_kind := 'AUTO_BOOKING_POLICY';
  else
    v_authorization_kind := 'HUMAN_SELECTION';
  end if;

  update public.freight_decisions fd
  set selected_offer_id = p_offer_id,
      selection_mode = p_selection_mode,
      selected_by_member_id = p_selected_by_member_id,
      selected_at = now()
  where fd.id = v_decision.id;

  insert into public.booking_authorizations (
    organization_id, freight_request_id, freight_decision_id, offer_id,
    carrier_id, carrier_service_id, selected_by_member_id, selection_mode,
    authorization_kind, booking_idempotency_key
  ) values (
    v_request.organization_id, p_freight_request_id, v_decision.id, p_offer_id,
    v_offer.carrier_id, v_offer.carrier_service_id, p_selected_by_member_id, p_selection_mode,
    v_authorization_kind, p_booking_idempotency_key
  ) returning * into v_authorization;

  update public.freight_requests fr
  set status = 'BOOKING', updated_at = now()
  where fr.id = p_freight_request_id;

  return query select
    v_authorization.id,
    v_authorization.freight_decision_id,
    v_authorization.freight_request_id,
    v_authorization.offer_id,
    v_authorization.carrier_id,
    v_authorization.carrier_service_id,
    v_offer.provider_offer_reference,
    v_authorization.authorization_kind,
    v_authorization.selection_mode,
    v_authorization.booking_idempotency_key,
    v_authorization.expires_at,
    false;
end;
$$;

create or replace function public.assert_booking_bridge_identity(
  p_authorization public.booking_authorizations,
  p_canonical_payload jsonb,
  p_tool_name text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_carrier public.carriers%rowtype;
  v_service public.carrier_services%rowtype;
  v_cargomesh_origin text;
  v_provider_url text;
  v_navigation_url text;
  v_navigation_base text;
  v_navigation_fragment text;
  v_expected_navigation_url text;
begin
  if jsonb_typeof(p_canonical_payload) <> 'object'
    or p_canonical_payload ->> 'authorizationReference' is distinct from p_authorization.id::text
    or p_canonical_payload ->> 'freightRequestId' is distinct from p_authorization.freight_request_id::text
    or p_canonical_payload ->> 'offerId' is distinct from p_authorization.offer_id::text
    or p_canonical_payload ->> 'carrierId' is distinct from p_authorization.carrier_id::text
    or p_canonical_payload ->> 'matchingServiceId' is distinct from p_authorization.carrier_service_id::text
    or p_canonical_payload ->> 'toolName' is distinct from p_tool_name
  then
    raise exception 'BOOKING_AUTHORIZATION_CORRELATION_ERROR' using errcode = '22023';
  end if;

  select * into v_carrier from public.carriers c where c.id = p_authorization.carrier_id;
  select * into v_service from public.carrier_services cs where cs.id = p_authorization.carrier_service_id and cs.carrier_id = p_authorization.carrier_id and cs.active = true;
  if not found or v_carrier.provider_url is null or btrim(v_carrier.provider_url) = '' then
    raise exception 'BOOKING_PROVIDER_NOT_REGISTERED' using errcode = '22023';
  end if;

  v_cargomesh_origin := p_canonical_payload ->> 'cargomeshOrigin';
  v_provider_url := p_canonical_payload ->> 'providerUrl';
  v_navigation_url := p_canonical_payload ->> 'navigationUrl';
  if v_cargomesh_origin is null
    or v_cargomesh_origin !~ '^https?://[^/?#]+$'
    or v_provider_url is distinct from v_carrier.provider_url
    or v_navigation_url is null
    or v_navigation_url !~ '^https?://'
    or v_carrier.provider_url ~ '[?&]serviceId='
  then
    raise exception 'INVALID_BOOKING_PROVIDER_NAVIGATION' using errcode = '22023';
  end if;

  v_navigation_base := case
    when left(v_carrier.provider_url, 1) = '/' then v_cargomesh_origin || v_carrier.provider_url
    else v_carrier.provider_url
  end;
  if v_navigation_base ~ '^https?://[^/?#]+([?#]|$)' then
    v_navigation_base := pg_catalog.regexp_replace(v_navigation_base, '^(https?://[^/?#]+)([?#]|$)', E'\\1/\\2');
  end if;
  v_navigation_fragment := coalesce(substring(v_navigation_base from '(#.*)$'), '');
  v_navigation_base := split_part(v_navigation_base, '#', 1);
  v_expected_navigation_url := v_navigation_base
    || case when position('?' in v_navigation_base) > 0 then '&' else '?' end
    || 'serviceId=' || p_authorization.carrier_service_id::text
    || v_navigation_fragment;
  if v_navigation_url <> v_expected_navigation_url
    or (select count(*) from pg_catalog.regexp_matches(v_navigation_url, '[?&]serviceId=', 'g')) <> 1
  then
    raise exception 'INVALID_BOOKING_PROVIDER_NAVIGATION' using errcode = '22023';
  end if;
end;
$$;

-- The booking/status RPCs are defined above to keep their public signatures
-- stable.  Replace them after the shared identity guard is available.
create or replace function public.record_provider_booking_result(
  p_bridge_call_id text,
  p_authorization_reference uuid,
  p_canonical_payload jsonb,
  p_provider_reference text,
  p_provider_booking_status text,
  p_provider_response_deadline timestamptz,
  p_payment_required boolean,
  p_payment_url text,
  p_provider_idempotent_replay boolean
)
returns table (booking_id uuid, result_status text, deduplicated boolean)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_authorization public.booking_authorizations%rowtype;
  v_existing_call public.booking_bridge_calls%rowtype;
  v_existing_booking public.bookings%rowtype;
  v_booking public.bookings%rowtype;
  v_offer_reference text;
  v_booking_status text;
begin
  if p_bridge_call_id is null or btrim(p_bridge_call_id) = ''
    or p_provider_reference is null or btrim(p_provider_reference) = ''
    or p_provider_booking_status not in ('PENDING_PROVIDER_CONFIRMATION', 'CONFIRMED', 'REJECTED', 'EXPIRED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED')
    or p_provider_response_deadline is null or jsonb_typeof(p_canonical_payload) <> 'object'
  then raise exception 'INVALID_BOOKING_PROVIDER_RESULT' using errcode = '22023'; end if;

  select * into v_existing_call from public.booking_bridge_calls bbc where bbc.bridge_call_id = p_bridge_call_id;
  if found then
    if v_existing_call.tool_name = 'book_freight' and v_existing_call.canonical_payload = p_canonical_payload then
      return query select v_existing_call.booking_id, 'DEDUPLICATED'::text, true; return;
    end if;
    raise exception 'IDEMPOTENCY_CONFLICT: bridge_call_id was already used with a different payload' using errcode = 'P0001';
  end if;

  select * into v_authorization from public.booking_authorizations ba where ba.id = p_authorization_reference for update;
  if not found then raise exception 'BOOKING_AUTHORIZATION_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_authorization.revoked_at is not null or v_authorization.expires_at <= now() then raise exception 'BOOKING_AUTHORIZATION_EXPIRED' using errcode = '55000'; end if;
  perform public.assert_booking_bridge_identity(v_authorization, p_canonical_payload, 'book_freight');
  select co.provider_offer_reference into v_offer_reference from public.carrier_offers co where co.id = v_authorization.offer_id;
  if p_canonical_payload #>> '{toolInput,freight_request_id}' is distinct from v_authorization.freight_request_id::text
    or p_canonical_payload #>> '{toolInput,provider_offer_reference}' is distinct from v_offer_reference
    or p_canonical_payload #>> '{toolInput,idempotency_key}' is distinct from v_authorization.booking_idempotency_key
    or p_canonical_payload #>> '{toolInput,authorization_context,authorization_reference}' is distinct from v_authorization.id::text
    or p_canonical_payload #>> '{toolInput,authorization_context,authorized_by}' is distinct from v_authorization.authorization_kind
    or p_canonical_payload #>> '{toolInput,selection_mode}' is distinct from v_authorization.selection_mode
    or p_canonical_payload #>> '{toolOutput,data,freightRequestId}' is distinct from v_authorization.freight_request_id::text
    or p_canonical_payload #>> '{toolOutput,data,providerOfferReference}' is distinct from v_offer_reference
    or p_canonical_payload #>> '{toolOutput,data,providerReference}' is distinct from p_provider_reference
    or p_canonical_payload #>> '{toolOutput,data,providerBookingStatus}' is distinct from p_provider_booking_status
    or (p_canonical_payload #>> '{toolOutput,data,providerResponseDeadline}')::timestamptz is distinct from p_provider_response_deadline
    or (p_canonical_payload #>> '{toolOutput,data,idempotentReplay}')::boolean is distinct from p_provider_idempotent_replay
  then raise exception 'BOOKING_AUTHORIZATION_CORRELATION_ERROR' using errcode = '22023'; end if;

  select * into v_existing_booking from public.bookings b where b.idempotency_key = v_authorization.booking_idempotency_key;
  if found then
    if v_existing_booking.freight_request_id = v_authorization.freight_request_id and v_existing_booking.offer_id = v_authorization.offer_id and v_existing_booking.carrier_id = v_authorization.carrier_id and v_existing_booking.provider_reference = p_provider_reference and v_existing_booking.provider_response_deadline = p_provider_response_deadline then
      insert into public.booking_bridge_calls (bridge_call_id, authorization_id, booking_id, tool_name, canonical_payload) values (p_bridge_call_id, v_authorization.id, v_existing_booking.id, 'book_freight', p_canonical_payload);
      return query select v_existing_booking.id, 'DEDUPLICATED'::text, true; return;
    end if;
    raise exception 'IDEMPOTENCY_CONFLICT: booking idempotency key has a different provider result' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.bookings b where b.freight_request_id = v_authorization.freight_request_id and b.status in ('PENDING_PROVIDER_CONFIRMATION', 'CONFIRMED', 'IN_TRANSIT')) then
    raise exception 'BOOKING_ALREADY_EXISTS: active booking already exists for this FreightRequest' using errcode = '23505';
  end if;

  v_booking_status := case p_provider_booking_status when 'DELIVERED' then 'COMPLETED' else p_provider_booking_status end;
  insert into public.bookings (freight_request_id, carrier_id, offer_id, provider_reference, status, freight_decision_id, provider_booking_status, idempotency_key, provider_response_deadline, authorization_context, selection_mode, selected_by_member_id, replaces_booking_id, payment_mode, payment_status, payment_url, confirmed_at, rejected_at, expired_at, cancelled_at, updated_at)
  values (v_authorization.freight_request_id, v_authorization.carrier_id, v_authorization.offer_id, p_provider_reference, v_booking_status, v_authorization.freight_decision_id, p_provider_booking_status, v_authorization.booking_idempotency_key, p_provider_response_deadline, jsonb_build_object('authorizationReference', v_authorization.id, 'authorizedBy', v_authorization.authorization_kind), v_authorization.selection_mode, v_authorization.selected_by_member_id, v_authorization.replaces_booking_id, case when p_payment_required then 'EXTERNAL_CHECKOUT' else 'INVOICE' end, case when p_payment_required then 'PENDING' else 'NOT_REQUIRED' end, p_payment_url, case when p_provider_booking_status = 'CONFIRMED' then now() else null end, case when p_provider_booking_status = 'REJECTED' then now() else null end, case when p_provider_booking_status = 'EXPIRED' then now() else null end, case when p_provider_booking_status = 'CANCELLED' then now() else null end, now())
  returning * into v_booking;
  insert into public.booking_events (booking_id, provider_event_id, event_type, provider_booking_status, payload, occurred_at) values (v_booking.id, 'booking-bridge:' || p_bridge_call_id, 'BOOKING_REQUESTED', p_provider_booking_status, jsonb_build_object('providerReference', p_provider_reference, 'paymentRequired', p_payment_required, 'paymentUrl', p_payment_url, 'providerIdempotentReplay', p_provider_idempotent_replay), now());
  insert into public.booking_bridge_calls (bridge_call_id, authorization_id, booking_id, tool_name, canonical_payload) values (p_bridge_call_id, v_authorization.id, v_booking.id, 'book_freight', p_canonical_payload);
  update public.booking_authorizations ba set consumed_booking_id = v_booking.id, updated_at = now() where ba.id = v_authorization.id;
  update public.freight_requests fr set status = case when v_booking.status = 'CONFIRMED' then 'BOOKED' else 'BOOKING' end, updated_at = now() where fr.id = v_authorization.freight_request_id;
  return query select v_booking.id, 'INSERTED'::text, false;
end;
$$;

create or replace function public.record_provider_booking_status(
  p_bridge_call_id text,
  p_authorization_reference uuid,
  p_booking_id uuid,
  p_canonical_payload jsonb,
  p_provider_reference text,
  p_provider_booking_status text,
  p_payment_status text,
  p_events jsonb
)
returns table (booking_id uuid, result_status text, deduplicated boolean)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_authorization public.booking_authorizations%rowtype;
  v_booking public.bookings%rowtype;
  v_existing_call public.booking_bridge_calls%rowtype;
  v_event jsonb;
  v_event_id text;
  v_event_type text;
  v_event_status text;
  v_event_occurred_at timestamptz;
  v_status text;
begin
  if p_bridge_call_id is null or btrim(p_bridge_call_id) = ''
    or p_provider_reference is null or btrim(p_provider_reference) = ''
    or p_provider_booking_status not in ('PENDING_PROVIDER_CONFIRMATION', 'CONFIRMED', 'REJECTED', 'EXPIRED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED')
    or p_payment_status not in ('NOT_REQUIRED', 'PENDING', 'PAID', 'FAILED', 'REFUNDED')
    or jsonb_typeof(p_canonical_payload) <> 'object'
    or jsonb_typeof(p_events) <> 'array'
  then
    raise exception 'INVALID_BOOKING_PROVIDER_STATUS' using errcode = '22023';
  end if;

  select * into v_existing_call from public.booking_bridge_calls where bridge_call_id = p_bridge_call_id;
  if found then
    if v_existing_call.tool_name = 'get_provider_booking_status' and v_existing_call.canonical_payload = p_canonical_payload then
      return query select v_existing_call.booking_id, 'DEDUPLICATED'::text, true;
      return;
    end if;
    raise exception 'IDEMPOTENCY_CONFLICT: bridge_call_id was already used with a different payload'
      using errcode = 'P0001';
  end if;

  select * into v_authorization from public.booking_authorizations ba where ba.id = p_authorization_reference;
  if not found then
    raise exception 'BOOKING_AUTHORIZATION_NOT_FOUND' using errcode = 'P0002';
  end if;
  perform public.assert_booking_bridge_identity(v_authorization, p_canonical_payload, 'get_provider_booking_status');
  if p_canonical_payload ->> 'bookingId' is distinct from p_booking_id::text
    or p_canonical_payload #>> '{toolInput,provider_reference}' is distinct from p_provider_reference
    or p_canonical_payload #>> '{toolOutput,data,providerReference}' is distinct from p_provider_reference
    or p_canonical_payload #>> '{toolOutput,data,providerBookingStatus}' is distinct from p_provider_booking_status
    or p_canonical_payload #>> '{toolOutput,data,paymentStatus}' is distinct from p_payment_status
  then
    raise exception 'BOOKING_STATUS_CORRELATION_ERROR' using errcode = '22023';
  end if;
  select * into v_booking from public.bookings b where b.id = p_booking_id for update;
  if not found or v_booking.freight_request_id <> v_authorization.freight_request_id
    or v_booking.provider_reference <> p_provider_reference then
    raise exception 'BOOKING_STATUS_CORRELATION_ERROR' using errcode = '22023';
  end if;

  for v_event in select value from jsonb_array_elements(p_events)
  loop
    if jsonb_typeof(v_event) <> 'object' then
      raise exception 'INVALID_PROVIDER_EVENT' using errcode = '22023';
    end if;
    v_event_id := v_event ->> 'providerEventId';
    v_event_type := v_event ->> 'eventType';
    v_event_status := v_event ->> 'providerBookingStatus';
    begin
      v_event_occurred_at := (v_event ->> 'occurredAt')::timestamptz;
    exception when others then
      raise exception 'INVALID_PROVIDER_EVENT' using errcode = '22023';
    end;
    if v_event_id is null or btrim(v_event_id) = '' or v_event_type is null or btrim(v_event_type) = ''
      or v_event_status not in ('PENDING_PROVIDER_CONFIRMATION', 'CONFIRMED', 'REJECTED', 'EXPIRED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED') then
      raise exception 'INVALID_PROVIDER_EVENT' using errcode = '22023';
    end if;
    insert into public.booking_events (
      booking_id, provider_event_id, event_type, provider_booking_status, payload, occurred_at
    ) values (
      v_booking.id, v_event_id, v_event_type, v_event_status,
      jsonb_build_object('location', v_event -> 'location', 'description', v_event ->> 'description'),
      v_event_occurred_at
    ) on conflict on constraint booking_events_provider_event_unique do nothing;
  end loop;

  v_status := case p_provider_booking_status when 'DELIVERED' then 'COMPLETED' else p_provider_booking_status end;
  update public.bookings
  set provider_booking_status = p_provider_booking_status,
      status = v_status,
      payment_status = p_payment_status,
      confirmed_at = case when p_provider_booking_status = 'CONFIRMED' then coalesce(confirmed_at, now()) else confirmed_at end,
      rejected_at = case when p_provider_booking_status = 'REJECTED' then coalesce(rejected_at, now()) else rejected_at end,
      expired_at = case when p_provider_booking_status = 'EXPIRED' then coalesce(expired_at, now()) else expired_at end,
      cancelled_at = case when p_provider_booking_status = 'CANCELLED' then coalesce(cancelled_at, now()) else cancelled_at end,
      updated_at = now()
  where id = v_booking.id
  returning * into v_booking;

  insert into public.booking_bridge_calls (bridge_call_id, authorization_id, booking_id, tool_name, canonical_payload)
  values (p_bridge_call_id, v_authorization.id, v_booking.id, 'get_provider_booking_status', p_canonical_payload);

  update public.freight_requests
  set status = case
    when v_booking.status = 'CONFIRMED' then 'BOOKED'
    when v_booking.status in ('REJECTED', 'EXPIRED', 'CANCELLED') then 'AWAITING_SELECTION'
    else 'BOOKING'
  end,
  updated_at = now()
  where id = v_booking.freight_request_id;

  return query select v_booking.id, 'INSERTED'::text, false;
end;
$$;

revoke execute on function public.prepare_booking_authorization(uuid, uuid, uuid, text, text) from public, anon, authenticated;
revoke execute on function public.assert_booking_bridge_identity(public.booking_authorizations, jsonb, text) from public, anon, authenticated;
revoke execute on function public.record_provider_booking_result(text, uuid, jsonb, text, text, timestamptz, boolean, text, boolean) from public, anon, authenticated;
revoke execute on function public.record_provider_booking_status(text, uuid, uuid, jsonb, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.prepare_booking_authorization(uuid, uuid, uuid, text, text) to service_role;
grant execute on function public.assert_booking_bridge_identity(public.booking_authorizations, jsonb, text) to service_role;
grant execute on function public.record_provider_booking_result(text, uuid, jsonb, text, text, timestamptz, boolean, text, boolean) to service_role;
grant execute on function public.record_provider_booking_status(text, uuid, uuid, jsonb, text, text, text, jsonb) to service_role;

alter table public.booking_authorizations
  add column replaces_booking_id uuid references public.bookings(id) on delete restrict;

create index booking_authorizations_replaces_idx
  on public.booking_authorizations (replaces_booking_id)
  where replaces_booking_id is not null;

create or replace function public.prepare_booking_recovery(
  p_replaces_booking_id uuid,
  p_replacement_offer_id uuid,
  p_selected_by_member_id uuid,
  p_selection_mode text,
  p_booking_idempotency_key text
)
returns table (
  authorization_reference uuid,
  freight_decision_id uuid,
  freight_request_id uuid,
  offer_id uuid,
  carrier_id uuid,
  matching_service_id uuid,
  provider_offer_reference text,
  authorization_kind text,
  selection_mode text,
  booking_idempotency_key text,
  expires_at timestamptz,
  deduplicated boolean
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_replaced_booking public.bookings%rowtype;
  v_authorization public.booking_authorizations%rowtype;
begin
  select * into v_authorization
  from public.booking_authorizations ba
  where ba.booking_idempotency_key = p_booking_idempotency_key;
  if found then
    if v_authorization.replaces_booking_id = p_replaces_booking_id
      and v_authorization.offer_id = p_replacement_offer_id
      and v_authorization.selected_by_member_id is not distinct from p_selected_by_member_id
      and v_authorization.selection_mode = p_selection_mode
    then
      return query
      select
        v_authorization.id,
        v_authorization.freight_decision_id,
        v_authorization.freight_request_id,
        v_authorization.offer_id,
        v_authorization.carrier_id,
        v_authorization.carrier_service_id,
        o.provider_offer_reference,
        v_authorization.authorization_kind,
        v_authorization.selection_mode,
        v_authorization.booking_idempotency_key,
        v_authorization.expires_at,
        true
      from public.carrier_offers o
      where o.id = v_authorization.offer_id;
      return;
    end if;

    raise exception 'IDEMPOTENCY_CONFLICT: booking recovery key was already used with a different selection'
      using errcode = 'P0001';
  end if;

  select * into v_replaced_booking
  from public.bookings b
  where b.id = p_replaces_booking_id
  for update;
  if not found then
    raise exception 'BOOKING_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_replaced_booking.status not in ('REJECTED', 'EXPIRED', 'CANCELLED') then
    raise exception 'BOOKING_NOT_RECOVERABLE' using errcode = '55000';
  end if;

  return query
  select * from public.prepare_booking_authorization(
    v_replaced_booking.freight_request_id,
    p_replacement_offer_id,
    p_selected_by_member_id,
    p_selection_mode,
    p_booking_idempotency_key
  );

  select * into v_authorization
  from public.booking_authorizations ba
  where ba.booking_idempotency_key = p_booking_idempotency_key;
  update public.booking_authorizations ba
  set replaces_booking_id = p_replaces_booking_id,
      updated_at = now()
  where ba.id = v_authorization.id;
  update public.bookings b
  set status = 'REBOOKED', updated_at = now()
  where b.id = p_replaces_booking_id;
end;
$$;

create or replace function public.reset_demo_booking_runtime(
  p_freight_request_id uuid
)
returns table (
  freight_request_id uuid,
  deleted_bookings integer,
  deleted_authorizations integer
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_request public.freight_requests%rowtype;
  v_deleted_authorizations integer := 0;
  v_deleted_bookings integer := 0;
begin
  select * into v_request
  from public.freight_requests fr
  where fr.id = p_freight_request_id
  for update;
  if not found then
    raise exception 'FREIGHT_REQUEST_NOT_FOUND' using errcode = 'P0002';
  end if;
  -- This endpoint is intentionally for the reproducible demo only. It cannot
  -- erase booking history from an arbitrary tenant request.
  if v_request.code <> 'FR-1042' then
    raise exception 'DEMO_RUNTIME_ONLY' using errcode = '42501';
  end if;

  delete from public.booking_authorizations ba
  where ba.freight_request_id = p_freight_request_id;
  get diagnostics v_deleted_authorizations = row_count;

  delete from public.bookings b
  where b.freight_request_id = p_freight_request_id;
  get diagnostics v_deleted_bookings = row_count;

  update public.freight_decisions fd
  set selected_offer_id = null,
      selection_mode = null,
      selected_by_member_id = null,
      selected_at = null
  where fd.freight_request_id = p_freight_request_id;
  update public.freight_requests fr
  set status = case
    when exists (select 1 from public.freight_decisions fd where fd.freight_request_id = p_freight_request_id)
      then 'AWAITING_SELECTION'
    else 'PENDING'
  end,
  updated_at = now()
  where fr.id = p_freight_request_id;

  return query select p_freight_request_id, v_deleted_bookings, v_deleted_authorizations;
end;
$$;

revoke execute on function public.prepare_booking_recovery(uuid, uuid, uuid, text, text) from public, anon, authenticated;
revoke execute on function public.reset_demo_booking_runtime(uuid) from public, anon, authenticated;
grant execute on function public.prepare_booking_recovery(uuid, uuid, uuid, text, text) to service_role;
grant execute on function public.reset_demo_booking_runtime(uuid) to service_role;

-- Source: 20260901045832_c_release_service_role_base_grants.sql
begin;

-- Server-only routes use the Supabase service-role key. The legacy baseline
-- intentionally revoked Data API access, but did not explicitly restore the
-- corresponding server-role grants for these pre-existing tables. Keep public
-- roles unchanged; RLS continues to govern authenticated reads.
grant all privileges on table
  public.bookings,
  public.cargo_categories,
  public.carrier_metrics,
  public.carrier_offers,
  public.carrier_service_cargo_categories,
  public.carrier_services,
  public.carriers,
  public.freight_decisions,
  public.freight_requests,
  public.organization_preferences,
  public.organizations,
  public.vehicles
to service_role;

commit;

-- Source: 20260902065645_c_d1_recommendation_draft_writer.sql
-- D1-01: optimistic concurrency token for the commercial FreightRequest draft.
-- The writer stays in the authenticated Next.js boundary; this migration grants
-- no new public privileges and leaves the existing RLS policies unchanged.
alter table public.freight_requests
  add column if not exists draft_version integer not null default 1;

alter table public.freight_requests
  drop constraint if exists freight_requests_draft_version_positive;

alter table public.freight_requests
  add constraint freight_requests_draft_version_positive
    check (draft_version >= 1);

create index if not exists freight_requests_org_draft_version_idx
  on public.freight_requests (organization_id, draft_version);

-- Source: 20260902170000_c_manual_intake_writer.sql
-- C-owned DDL for the authenticated manual FreightRequest intake writer.
-- Scenario/demo data belongs in supabase/scenarios and is deliberately absent.

alter table public.freight_requests
  add column if not exists origin_region text,
  add column if not exists destination_region text;

alter table public.freight_requests
  drop constraint if exists freight_requests_origin_region_not_blank,
  add constraint freight_requests_origin_region_not_blank
    check (origin_region is null or length(btrim(origin_region)) > 0),
  drop constraint if exists freight_requests_destination_region_not_blank,
  add constraint freight_requests_destination_region_not_blank
    check (destination_region is null or length(btrim(destination_region)) > 0);

-- Source: 20260902213000_c_restrict_freight_request_writes.sql
-- Restrict direct FreightRequest mutations to the same active-manager roles
-- accepted by the authenticated server-side intake writers.  The authenticated
-- table grants remain necessary because the Next.js route executes with the
-- caller's JWT; RLS is the authorization boundary.

drop policy if exists freight_requests_member_insert on public.freight_requests;
create policy freight_requests_member_insert on public.freight_requests
for insert to authenticated
with check ((select private.has_organization_role(
  organization_id,
  array['OWNER','SUPERVISOR']::text[]
)));

drop policy if exists freight_requests_member_update on public.freight_requests;
create policy freight_requests_member_update on public.freight_requests
for update to authenticated
using ((select private.has_organization_role(
  organization_id,
  array['OWNER','SUPERVISOR']::text[]
)))
with check ((select private.has_organization_role(
  organization_id,
  array['OWNER','SUPERVISOR']::text[]
)));

-- Source: 20260918120000_c_draft_creation_idempotency.sql
-- Structural only. Existing form-created requests keep both columns NULL.
alter table public.freight_requests
  add column creation_idempotency_key uuid,
  add column creation_payload_hash text,
  add constraint freight_requests_creation_receipt_check check (
    (creation_idempotency_key is null and creation_payload_hash is null)
    or (creation_idempotency_key is not null and creation_payload_hash is not null
        and requested_by_member_id is not null
        and creation_payload_hash ~ '^[0-9a-f]{64}$')
  );

create unique index freight_requests_creation_idempotency_idx
  on public.freight_requests (organization_id, requested_by_member_id, creation_idempotency_key)
  where creation_idempotency_key is not null;

-- Even a direct authenticated Data API client cannot reserve another
-- member's idempotency key. Existing manager INSERT policy still applies.
create policy freight_requests_creation_receipt_owner on public.freight_requests
as restrictive for insert to authenticated
with check (
  creation_idempotency_key is null or exists (
    select 1 from public.organization_members m
    where m.id = requested_by_member_id
      and m.organization_id = freight_requests.organization_id
      and m.auth_user_id = (select auth.uid())
      and m.status = 'ACTIVE' and m.role in ('OWNER', 'SUPERVISOR')
  )
);

-- Editing a draft must not detach it from its original creation receipt.
create function private.guard_freight_creation_receipt()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.creation_idempotency_key is distinct from old.creation_idempotency_key
    or new.creation_payload_hash is distinct from old.creation_payload_hash
    or (old.creation_idempotency_key is not null and (
      new.organization_id is distinct from old.organization_id
      or new.requested_by_member_id is distinct from old.requested_by_member_id
      or new.code is distinct from old.code
    )) then
    raise exception 'Creation receipt is immutable' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_freight_creation_receipt() from public;
create trigger guard_freight_creation_receipt
  before update on public.freight_requests
  for each row execute function private.guard_freight_creation_receipt();

-- Source: 20260922053512_v2_road_facilities_services.sql
-- HAC-21: additive V2 ROAD geography. Existing V1 service origin/destination
-- columns and legacy seeds never imply V2 coverage.

create table public.facilities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  name text not null,
  facility_type text not null default 'SHIPPER_SITE'
    check (facility_type in ('SHIPPER_SITE', 'WAREHOUSE', 'DISTRIBUTION_CENTER', 'OTHER')),
  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  region_code text,
  city text not null,
  postal_code text,
  address_line text not null,
  latitude numeric(9,6),
  longitude numeric(9,6),
  access_notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint facilities_code_nonblank check (length(btrim(code)) > 0),
  constraint facilities_name_nonblank check (length(btrim(name)) > 0),
  constraint facilities_address_nonblank check (length(btrim(address_line)) > 0),
  constraint facilities_coordinates_pair check ((latitude is null) = (longitude is null)),
  constraint facilities_latitude_range check (latitude between -90 and 90),
  constraint facilities_longitude_range check (longitude between -180 and 180),
  constraint facilities_org_code_unique unique (organization_id, code),
  constraint facilities_id_org_unique unique (id, organization_id)
);

create index facilities_org_active_idx on public.facilities (organization_id, active);

create table public.carrier_depots (
  id uuid primary key default gen_random_uuid(),
  carrier_id uuid not null references public.carriers(id) on delete cascade,
  code text not null,
  name text not null,
  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  region_code text,
  city text not null,
  postal_code text,
  address_line text,
  latitude numeric(9,6),
  longitude numeric(9,6),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint carrier_depots_code_nonblank check (length(btrim(code)) > 0),
  constraint carrier_depots_name_nonblank check (length(btrim(name)) > 0),
  constraint carrier_depots_coordinates_pair check ((latitude is null) = (longitude is null)),
  constraint carrier_depots_latitude_range check (latitude between -90 and 90),
  constraint carrier_depots_longitude_range check (longitude between -180 and 180),
  constraint carrier_depots_carrier_code_unique unique (carrier_id, code)
);

create index carrier_depots_carrier_active_idx on public.carrier_depots (carrier_id, active);

-- An area describes one side of a service. Exclusions override inclusions in
-- the application service; missing or stale evidence yields unknown, not yes.
create table public.service_areas (
  id uuid primary key default gen_random_uuid(),
  carrier_service_id uuid not null references public.carrier_services(id) on delete cascade,
  area_role text not null check (area_role in ('PICKUP', 'DELIVERY')),
  coverage text not null check (coverage in ('INCLUDE', 'EXCLUDE')),
  granularity text not null check (granularity in ('COUNTRY', 'REGION', 'CITY', 'POSTAL_CODE')),
  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  region_code text,
  city text,
  postal_code text,
  fulfilment_source text not null check (fulfilment_source in ('OWN', 'PARTNER')),
  partner_reference text,
  evidence_reference text not null,
  verified_at timestamptz not null,
  valid_from timestamptz not null,
  valid_until timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint service_areas_id_service_unique unique (id, carrier_service_id),
  constraint service_areas_location_shape check (
    (granularity = 'COUNTRY' and region_code is null and city is null and postal_code is null)
    or (granularity = 'REGION' and region_code is not null and city is null and postal_code is null)
    or (granularity = 'CITY' and city is not null and postal_code is null)
    or (granularity = 'POSTAL_CODE' and postal_code is not null)
  ),
  constraint service_areas_partner_reference check (
    (fulfilment_source = 'OWN' and partner_reference is null)
    or (fulfilment_source = 'PARTNER' and coalesce(length(btrim(partner_reference)), 0) > 0)
  ),
  constraint service_areas_evidence_nonblank check (length(btrim(evidence_reference)) > 0),
  constraint service_areas_valid_window check (valid_until is null or valid_until > valid_from)
);

create index service_areas_service_role_active_idx
  on public.service_areas (carrier_service_id, area_role, active);
create index service_areas_geography_idx
  on public.service_areas (country_code, region_code, city, postal_code);

-- A lane is explicitly directed. The optional WITHIN_AREA shape is still an
-- explicit pickup-area -> delivery-area declaration, never inferred from a depot.
create table public.service_lanes (
  id uuid primary key default gen_random_uuid(),
  carrier_service_id uuid not null references public.carrier_services(id) on delete cascade,
  pickup_area_id uuid not null,
  delivery_area_id uuid not null,
  lane_kind text not null default 'DIRECT' check (lane_kind in ('DIRECT', 'WITHIN_AREA')),
  transport_mode text not null default 'ROAD' check (transport_mode = 'ROAD'),
  evidence_reference text not null check (length(btrim(evidence_reference)) > 0),
  verified_at timestamptz not null,
  valid_from timestamptz not null,
  valid_until timestamptz,
  cross_border_review_required boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint service_lanes_areas_distinct check (pickup_area_id <> delivery_area_id),
  constraint service_lanes_valid_window check (valid_until is null or valid_until > valid_from),
  constraint service_lanes_pickup_same_service foreign key (pickup_area_id, carrier_service_id)
    references public.service_areas(id, carrier_service_id) on delete cascade,
  constraint service_lanes_delivery_same_service foreign key (delivery_area_id, carrier_service_id)
    references public.service_areas(id, carrier_service_id) on delete cascade,
  constraint service_lanes_direction_unique unique (carrier_service_id, pickup_area_id, delivery_area_id)
);

create index service_lanes_pickup_idx on public.service_lanes (pickup_area_id);
create index service_lanes_delivery_idx on public.service_lanes (delivery_area_id);
create index service_lanes_service_active_idx on public.service_lanes (carrier_service_id, active);

create function private.validate_v2_road_lane()
returns trigger language plpgsql set search_path = '' as $$
declare
  pickup public.service_areas%rowtype;
  delivery public.service_areas%rowtype;
  service_mode text;
begin
  select transport_mode into service_mode from public.carrier_services where id = new.carrier_service_id;
  if service_mode is distinct from 'ROAD' then
    raise exception 'V2 ROAD lane requires a ROAD carrier service' using errcode = '23514';
  end if;
  select * into pickup from public.service_areas where id = new.pickup_area_id;
  select * into delivery from public.service_areas where id = new.delivery_area_id;
  if pickup.area_role is distinct from 'PICKUP' or pickup.coverage is distinct from 'INCLUDE'
     or delivery.area_role is distinct from 'DELIVERY' or delivery.coverage is distinct from 'INCLUDE' then
    raise exception 'V2 ROAD lane endpoints must be included pickup/delivery areas' using errcode = '23514';
  end if;
  if new.lane_kind = 'WITHIN_AREA' and
     (pickup.country_code, pickup.region_code, pickup.city, pickup.postal_code)
       is distinct from
     (delivery.country_code, delivery.region_code, delivery.city, delivery.postal_code) then
    raise exception 'WITHIN_AREA lane endpoints must describe the same geography' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger validate_v2_road_lane_before_write
before insert or update on public.service_lanes
for each row execute function private.validate_v2_road_lane();
revoke all on function private.validate_v2_road_lane() from public, anon, authenticated;

-- Keep validated endpoints stable after a lane is published. Catalog changes
-- must deactivate/recreate the lane instead of silently changing its meaning.
create function private.guard_v2_road_area_update()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (new.carrier_service_id, new.area_role, new.coverage,
      new.granularity, new.country_code, new.region_code, new.city, new.postal_code)
      is distinct from
     (old.carrier_service_id, old.area_role, old.coverage,
      old.granularity, old.country_code, old.region_code, old.city, old.postal_code)
     and exists (
       select 1 from public.service_lanes l
       where l.pickup_area_id = old.id or l.delivery_area_id = old.id
     ) then
    raise exception 'Referenced V2 ROAD area geography and role are immutable'
      using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger guard_v2_road_area_before_update
before update on public.service_areas
for each row execute function private.guard_v2_road_area_update();
revoke all on function private.guard_v2_road_area_update() from public, anon, authenticated;

-- Existing DRAFT -> PENDING, idempotency key and draft_version remain intact.
-- Nullable references permit old requests to survive an additive migration.
alter table public.freight_requests
  add column origin_facility_id uuid,
  add column destination_facility_id uuid,
  add constraint freight_requests_origin_facility_same_org foreign key (origin_facility_id, organization_id)
    references public.facilities(id, organization_id),
  add constraint freight_requests_destination_facility_same_org foreign key (destination_facility_id, organization_id)
    references public.facilities(id, organization_id);

create index freight_requests_origin_facility_idx on public.freight_requests (origin_facility_id)
  where origin_facility_id is not null;
create index freight_requests_destination_facility_idx on public.freight_requests (destination_facility_id)
  where destination_facility_id is not null;

alter table public.facilities enable row level security;
alter table public.carrier_depots enable row level security;
alter table public.service_areas enable row level security;
alter table public.service_lanes enable row level security;

revoke all on public.facilities, public.carrier_depots, public.service_areas, public.service_lanes
  from anon, authenticated;
grant select on public.facilities, public.carrier_depots, public.service_areas, public.service_lanes
  to authenticated;
grant insert on public.facilities to authenticated;
grant update (code, name, facility_type, country_code, region_code, city, postal_code,
  address_line, latitude, longitude, access_notes, active, updated_at)
  on public.facilities to authenticated;

create policy facilities_member_select on public.facilities for select to authenticated
using ((select private.is_organization_member(organization_id)));
create policy facilities_manager_insert on public.facilities for insert to authenticated
with check ((select private.has_organization_role(organization_id, array['OWNER','SUPERVISOR']::text[])));
create policy facilities_manager_update on public.facilities for update to authenticated
using ((select private.has_organization_role(organization_id, array['OWNER','SUPERVISOR']::text[])))
with check ((select private.has_organization_role(organization_id, array['OWNER','SUPERVISOR']::text[])));

-- Carrier self-service identity does not exist yet: catalog writes are server-only.
create policy carrier_depots_member_select on public.carrier_depots for select to authenticated
using ((select private.has_any_organization()));
create policy service_areas_member_select on public.service_areas for select to authenticated
using ((select private.has_any_organization()));
create policy service_lanes_member_select on public.service_lanes for select to authenticated
using ((select private.has_any_organization()));

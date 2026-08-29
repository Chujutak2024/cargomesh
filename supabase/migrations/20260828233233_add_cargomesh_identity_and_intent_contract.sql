
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

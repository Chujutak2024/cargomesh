
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


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

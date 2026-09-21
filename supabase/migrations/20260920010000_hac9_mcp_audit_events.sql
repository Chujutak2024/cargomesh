-- HAC-9: authenticated, organization-scoped evidence for the local MCP endpoint.
create table public.mcp_audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  member_id uuid not null references public.organization_members(id),
  source text not null default 'mcp' check (source = 'mcp'),
  tool_name text not null,
  request_id text,
  started_at timestamptz not null,
  duration_ms integer not null check (duration_ms >= 0),
  http_status integer not null,
  status text not null check (status in ('success', 'error')),
  input_payload jsonb,
  output_payload jsonb,
  created_at timestamptz not null default now()
);

create index mcp_audit_events_organization_started_idx
  on public.mcp_audit_events (organization_id, started_at desc);
alter table public.mcp_audit_events enable row level security;

create policy mcp_audit_events_member_select on public.mcp_audit_events
  for select to authenticated
  using ((select private.is_organization_member(organization_id)));

-- Only the authenticated server writer using the service role can insert;
-- a browser session must not forge the evidence displayed to the jury.
grant select on public.mcp_audit_events to authenticated;
grant select, insert on public.mcp_audit_events to service_role;

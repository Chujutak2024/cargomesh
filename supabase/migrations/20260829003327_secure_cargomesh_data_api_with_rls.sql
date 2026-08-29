
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

-- HAC-40 production structures; no synthetic data or hosted application.
create table private.v2_workflow_receipts (
 organization_id uuid not null references public.organizations(id), member_id uuid not null references public.organization_members(id),
 idempotency_key uuid not null, payload_hash text not null check(payload_hash~'^[0-9a-f]{64}$'),result jsonb not null,
 created_at timestamptz not null default now(),primary key(organization_id,member_id,idempotency_key));
alter table private.v2_workflow_receipts enable row level security;
revoke all on private.v2_workflow_receipts from public,anon,authenticated,service_role;

create function private.workflow_member(o uuid,m uuid,w boolean) returns void language plpgsql security definer set search_path='' as $$begin
 if not exists(select 1 from public.organization_members mm join public.organizations oo on oo.id=mm.organization_id
  where mm.id=m and mm.organization_id=o and mm.auth_user_id=auth.uid() and mm.status='ACTIVE' and oo.status='ACTIVE'
  and (not w or mm.role in ('OWNER','SUPERVISOR'))) then raise exception 'FORBIDDEN_WORKFLOW' using errcode='PT403';end if;
end;$$;
create function private.workflow_carrier(c uuid) returns void language plpgsql security definer set search_path='' as $$begin
 if c is null or not exists(select 1 from private.v2_catalog_grants g where g.auth_user_id=auth.uid()
  and g.revoked_at is null and (g.expires_at is null or g.expires_at>now())
  and (g.permission='CATALOG_ADMIN' or g.permission='CARRIER_EDITOR' and g.carrier_id=c))
 then raise exception 'FORBIDDEN_WORKFLOW' using errcode='PT403';end if;end;$$;
create function private.workflow_admin() returns void language plpgsql security definer set search_path='' as $$begin
 if not exists(select 1 from private.v2_catalog_grants g where g.auth_user_id=auth.uid() and g.permission='CATALOG_ADMIN'
  and g.revoked_at is null and (g.expires_at is null or g.expires_at>now())) then raise exception 'FORBIDDEN_WORKFLOW' using errcode='PT403';end if;end;$$;
create function private.workflow_evidence(e jsonb,s timestamptz,t timestamptz) returns boolean language sql stable set search_path='' as $$
 select e is not null and e->>'reference' is not null and e->>'provider' is not null and e->>'provenanceStatus' in ('VERIFIED','SIMULATED')
 and (e->>'observedAt')::timestamptz<=now() and (e->>'observedAt')::timestamptz<=s
 and (e->>'validUntil')::timestamptz>=t and (e->>'validUntil')::timestamptz>now();$$;
create function private.workflow_guard() returns trigger language plpgsql security invoker set search_path='' as $$begin
 if current_user<>'postgres' then raise exception 'WORKFLOW_COMMAND_REQUIRED' using errcode='42501';end if;
 if tg_op='DELETE' then raise exception 'WORKFLOW_HISTORY_IMMUTABLE' using errcode='PT400';end if;
 if tg_op='UPDATE' and (new.id<>old.id or new.organization_id is distinct from old.organization_id
  or new.carrier_id is distinct from old.carrier_id or new.freight_request_id is distinct from old.freight_request_id
  or new.parent_id is distinct from old.parent_id or new.created_at<>old.created_at) then
  raise exception 'IMMUTABLE_WORKFLOW_SCOPE' using errcode='PT400';end if;return new;end;$$;

-- TABLES generated from a closed vocabulary, with concrete foreign keys below.
create function private.workflow_validate_periods(v jsonb) returns void language plpgsql set search_path='' as $$declare x jsonb;begin
 if jsonb_typeof(v)='object' then
  if v ? 'startsAt' and v ? 'endsAt' and (v->>'endsAt')::timestamptz<=(v->>'startsAt')::timestamptz
   or v->>'validUntil' is not null and v->>'observedAt' is not null and (v->>'validUntil')::timestamptz<=(v->>'observedAt')::timestamptz
   or v ? 'weights' and v#>'{weights,distance}' is not null and abs((v#>>'{weights,distance}')::numeric+(v#>>'{weights,duration}')::numeric-1)>0.000000001
   then raise exception 'VALIDATION_ERROR' using errcode='PT400';end if;
  for x in select value from jsonb_each(v) loop perform private.workflow_validate_periods(x);end loop;
 elsif jsonb_typeof(v)='array' then for x in select value from jsonb_array_elements(v) loop perform private.workflow_validate_periods(x);end loop;end if;
end;$$;

create table public.logistics_nodes (
 id uuid primary key default gen_random_uuid(), organization_id uuid references public.organizations(id),
 carrier_id uuid references public.carriers(id),freight_request_id uuid references public.freight_requests(id),parent_id uuid,
 kind text not null default 'nodes' check(kind='nodes'),status text not null,version integer not null default 1 check(version>0),
 data jsonb not null check(jsonb_typeof(data)='object'),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(id,organization_id),unique(id,carrier_id));
alter table public.logistics_nodes enable row level security;
revoke all on public.logistics_nodes from public,anon,authenticated,service_role;
create index logistics_nodes_tenant_idx on public.logistics_nodes(organization_id,created_at,id);
create index logistics_nodes_carrier_idx on public.logistics_nodes(carrier_id,created_at,id) where carrier_id is not null;
create index logistics_nodes_request_idx on public.logistics_nodes(freight_request_id) where freight_request_id is not null;
create index logistics_nodes_parent_idx on public.logistics_nodes(parent_id) where parent_id is not null;
create trigger workflow_guard before insert or update or delete on public.logistics_nodes for each row execute function private.workflow_guard();
create table public.route_corridors (
 id uuid primary key default gen_random_uuid(), organization_id uuid references public.organizations(id),
 carrier_id uuid references public.carriers(id),freight_request_id uuid references public.freight_requests(id),parent_id uuid,
 kind text not null default 'corridors' check(kind='corridors'),status text not null,version integer not null default 1 check(version>0),
 data jsonb not null check(jsonb_typeof(data)='object'),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(id,organization_id),unique(id,carrier_id));
alter table public.route_corridors enable row level security;
revoke all on public.route_corridors from public,anon,authenticated,service_role;
create index route_corridors_tenant_idx on public.route_corridors(organization_id,created_at,id);
create index route_corridors_carrier_idx on public.route_corridors(carrier_id,created_at,id) where carrier_id is not null;
create index route_corridors_request_idx on public.route_corridors(freight_request_id) where freight_request_id is not null;
create index route_corridors_parent_idx on public.route_corridors(parent_id) where parent_id is not null;
create trigger workflow_guard before insert or update or delete on public.route_corridors for each row execute function private.workflow_guard();
create table public.route_planning_policies (
 id uuid primary key default gen_random_uuid(), organization_id uuid references public.organizations(id),
 carrier_id uuid references public.carriers(id),freight_request_id uuid references public.freight_requests(id),parent_id uuid,
 kind text not null default 'route-policies' check(kind='route-policies'),status text not null,version integer not null default 1 check(version>0),
 data jsonb not null check(jsonb_typeof(data)='object'),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(id,organization_id),unique(id,carrier_id));
alter table public.route_planning_policies enable row level security;
revoke all on public.route_planning_policies from public,anon,authenticated,service_role;
create index route_planning_policies_tenant_idx on public.route_planning_policies(organization_id,created_at,id);
create index route_planning_policies_carrier_idx on public.route_planning_policies(carrier_id,created_at,id) where carrier_id is not null;
create index route_planning_policies_request_idx on public.route_planning_policies(freight_request_id) where freight_request_id is not null;
create index route_planning_policies_parent_idx on public.route_planning_policies(parent_id) where parent_id is not null;
create trigger workflow_guard before insert or update or delete on public.route_planning_policies for each row execute function private.workflow_guard();
create table public.route_conditions (
 id uuid primary key default gen_random_uuid(), organization_id uuid references public.organizations(id),
 carrier_id uuid references public.carriers(id),freight_request_id uuid references public.freight_requests(id),parent_id uuid,
 kind text not null default 'conditions' check(kind='conditions'),status text not null,version integer not null default 1 check(version>0),
 data jsonb not null check(jsonb_typeof(data)='object'),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(id,organization_id),unique(id,carrier_id));
alter table public.route_conditions enable row level security;
revoke all on public.route_conditions from public,anon,authenticated,service_role;
create index route_conditions_tenant_idx on public.route_conditions(organization_id,created_at,id);
create index route_conditions_carrier_idx on public.route_conditions(carrier_id,created_at,id) where carrier_id is not null;
create index route_conditions_request_idx on public.route_conditions(freight_request_id) where freight_request_id is not null;
create index route_conditions_parent_idx on public.route_conditions(parent_id) where parent_id is not null;
create trigger workflow_guard before insert or update or delete on public.route_conditions for each row execute function private.workflow_guard();
create table public.route_resource_limits (
 id uuid primary key default gen_random_uuid(), organization_id uuid references public.organizations(id),
 carrier_id uuid references public.carriers(id),freight_request_id uuid references public.freight_requests(id),parent_id uuid,
 kind text not null default 'limits' check(kind='limits'),status text not null,version integer not null default 1 check(version>0),
 data jsonb not null check(jsonb_typeof(data)='object'),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(id,organization_id),unique(id,carrier_id));
alter table public.route_resource_limits enable row level security;
revoke all on public.route_resource_limits from public,anon,authenticated,service_role;
create index route_resource_limits_tenant_idx on public.route_resource_limits(organization_id,created_at,id);
create index route_resource_limits_carrier_idx on public.route_resource_limits(carrier_id,created_at,id) where carrier_id is not null;
create index route_resource_limits_request_idx on public.route_resource_limits(freight_request_id) where freight_request_id is not null;
create index route_resource_limits_parent_idx on public.route_resource_limits(parent_id) where parent_id is not null;
create trigger workflow_guard before insert or update or delete on public.route_resource_limits for each row execute function private.workflow_guard();
create table public.scoring_policies (
 id uuid primary key default gen_random_uuid(), organization_id uuid references public.organizations(id),
 carrier_id uuid references public.carriers(id),freight_request_id uuid references public.freight_requests(id),parent_id uuid,
 kind text not null default 'scoring-policies' check(kind='scoring-policies'),status text not null,version integer not null default 1 check(version>0),
 data jsonb not null check(jsonb_typeof(data)='object'),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(id,organization_id),unique(id,carrier_id));
alter table public.scoring_policies enable row level security;
revoke all on public.scoring_policies from public,anon,authenticated,service_role;
create index scoring_policies_tenant_idx on public.scoring_policies(organization_id,created_at,id);
create index scoring_policies_carrier_idx on public.scoring_policies(carrier_id,created_at,id) where carrier_id is not null;
create index scoring_policies_request_idx on public.scoring_policies(freight_request_id) where freight_request_id is not null;
create index scoring_policies_parent_idx on public.scoring_policies(parent_id) where parent_id is not null;
create trigger workflow_guard before insert or update or delete on public.scoring_policies for each row execute function private.workflow_guard();
create table public.v2_carrier_metrics (
 id uuid primary key default gen_random_uuid(), organization_id uuid references public.organizations(id),
 carrier_id uuid references public.carriers(id),freight_request_id uuid references public.freight_requests(id),parent_id uuid,
 kind text not null default 'metrics' check(kind='metrics'),status text not null,version integer not null default 1 check(version>0),
 data jsonb not null check(jsonb_typeof(data)='object'),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(id,organization_id),unique(id,carrier_id));
alter table public.v2_carrier_metrics enable row level security;
revoke all on public.v2_carrier_metrics from public,anon,authenticated,service_role;
create index v2_carrier_metrics_tenant_idx on public.v2_carrier_metrics(organization_id,created_at,id);
create index v2_carrier_metrics_carrier_idx on public.v2_carrier_metrics(carrier_id,created_at,id) where carrier_id is not null;
create index v2_carrier_metrics_request_idx on public.v2_carrier_metrics(freight_request_id) where freight_request_id is not null;
create index v2_carrier_metrics_parent_idx on public.v2_carrier_metrics(parent_id) where parent_id is not null;
create trigger workflow_guard before insert or update or delete on public.v2_carrier_metrics for each row execute function private.workflow_guard();
create table public.route_plans (
 id uuid primary key default gen_random_uuid(), organization_id uuid references public.organizations(id),
 carrier_id uuid references public.carriers(id),freight_request_id uuid references public.freight_requests(id),parent_id uuid,
 kind text not null default 'routes' check(kind='routes'),status text not null,version integer not null default 1 check(version>0),
 data jsonb not null check(jsonb_typeof(data)='object'),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(id,organization_id),unique(id,carrier_id));
alter table public.route_plans enable row level security;
revoke all on public.route_plans from public,anon,authenticated,service_role;
create index route_plans_tenant_idx on public.route_plans(organization_id,created_at,id);
create index route_plans_carrier_idx on public.route_plans(carrier_id,created_at,id) where carrier_id is not null;
create index route_plans_request_idx on public.route_plans(freight_request_id) where freight_request_id is not null;
create index route_plans_parent_idx on public.route_plans(parent_id) where parent_id is not null;
create trigger workflow_guard before insert or update or delete on public.route_plans for each row execute function private.workflow_guard();
create table public.transport_plan_candidates (
 id uuid primary key default gen_random_uuid(), organization_id uuid references public.organizations(id),
 carrier_id uuid references public.carriers(id),freight_request_id uuid references public.freight_requests(id),parent_id uuid,
 kind text not null default 'plans' check(kind='plans'),status text not null,version integer not null default 1 check(version>0),
 data jsonb not null check(jsonb_typeof(data)='object'),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(id,organization_id),unique(id,carrier_id));
alter table public.transport_plan_candidates enable row level security;
revoke all on public.transport_plan_candidates from public,anon,authenticated,service_role;
create index transport_plan_candidates_tenant_idx on public.transport_plan_candidates(organization_id,created_at,id);
create index transport_plan_candidates_carrier_idx on public.transport_plan_candidates(carrier_id,created_at,id) where carrier_id is not null;
create index transport_plan_candidates_request_idx on public.transport_plan_candidates(freight_request_id) where freight_request_id is not null;
create index transport_plan_candidates_parent_idx on public.transport_plan_candidates(parent_id) where parent_id is not null;
create trigger workflow_guard before insert or update or delete on public.transport_plan_candidates for each row execute function private.workflow_guard();
create table public.carrier_opportunities (
 id uuid primary key default gen_random_uuid(), organization_id uuid references public.organizations(id),
 carrier_id uuid references public.carriers(id),freight_request_id uuid references public.freight_requests(id),parent_id uuid,
 kind text not null default 'opportunities' check(kind='opportunities'),status text not null,version integer not null default 1 check(version>0),
 data jsonb not null check(jsonb_typeof(data)='object'),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(id,organization_id),unique(id,carrier_id));
alter table public.carrier_opportunities enable row level security;
revoke all on public.carrier_opportunities from public,anon,authenticated,service_role;
create index carrier_opportunities_tenant_idx on public.carrier_opportunities(organization_id,created_at,id);
create index carrier_opportunities_carrier_idx on public.carrier_opportunities(carrier_id,created_at,id) where carrier_id is not null;
create index carrier_opportunities_request_idx on public.carrier_opportunities(freight_request_id) where freight_request_id is not null;
create index carrier_opportunities_parent_idx on public.carrier_opportunities(parent_id) where parent_id is not null;
create trigger workflow_guard before insert or update or delete on public.carrier_opportunities for each row execute function private.workflow_guard();
create table public.v2_carrier_offers (
 id uuid primary key default gen_random_uuid(), organization_id uuid references public.organizations(id),
 carrier_id uuid references public.carriers(id),freight_request_id uuid references public.freight_requests(id),parent_id uuid,
 kind text not null default 'offers' check(kind='offers'),status text not null,version integer not null default 1 check(version>0),
 data jsonb not null check(jsonb_typeof(data)='object'),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(id,organization_id),unique(id,carrier_id));
alter table public.v2_carrier_offers enable row level security;
revoke all on public.v2_carrier_offers from public,anon,authenticated,service_role;
create index v2_carrier_offers_tenant_idx on public.v2_carrier_offers(organization_id,created_at,id);
create index v2_carrier_offers_carrier_idx on public.v2_carrier_offers(carrier_id,created_at,id) where carrier_id is not null;
create index v2_carrier_offers_request_idx on public.v2_carrier_offers(freight_request_id) where freight_request_id is not null;
create index v2_carrier_offers_parent_idx on public.v2_carrier_offers(parent_id) where parent_id is not null;
create trigger workflow_guard before insert or update or delete on public.v2_carrier_offers for each row execute function private.workflow_guard();
create table public.v2_rankings (
 id uuid primary key default gen_random_uuid(), organization_id uuid references public.organizations(id),
 carrier_id uuid references public.carriers(id),freight_request_id uuid references public.freight_requests(id),parent_id uuid,
 kind text not null default 'ranking' check(kind='ranking'),status text not null,version integer not null default 1 check(version>0),
 data jsonb not null check(jsonb_typeof(data)='object'),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(id,organization_id),unique(id,carrier_id));
alter table public.v2_rankings enable row level security;
revoke all on public.v2_rankings from public,anon,authenticated,service_role;
create index v2_rankings_tenant_idx on public.v2_rankings(organization_id,created_at,id);
create index v2_rankings_carrier_idx on public.v2_rankings(carrier_id,created_at,id) where carrier_id is not null;
create index v2_rankings_request_idx on public.v2_rankings(freight_request_id) where freight_request_id is not null;
create index v2_rankings_parent_idx on public.v2_rankings(parent_id) where parent_id is not null;
create trigger workflow_guard before insert or update or delete on public.v2_rankings for each row execute function private.workflow_guard();
create table public.selection_decisions (
 id uuid primary key default gen_random_uuid(), organization_id uuid references public.organizations(id),
 carrier_id uuid references public.carriers(id),freight_request_id uuid references public.freight_requests(id),parent_id uuid,
 kind text not null default 'decisions' check(kind='decisions'),status text not null,version integer not null default 1 check(version>0),
 data jsonb not null check(jsonb_typeof(data)='object'),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(id,organization_id),unique(id,carrier_id));
alter table public.selection_decisions enable row level security;
revoke all on public.selection_decisions from public,anon,authenticated,service_role;
create index selection_decisions_tenant_idx on public.selection_decisions(organization_id,created_at,id);
create index selection_decisions_carrier_idx on public.selection_decisions(carrier_id,created_at,id) where carrier_id is not null;
create index selection_decisions_request_idx on public.selection_decisions(freight_request_id) where freight_request_id is not null;
create index selection_decisions_parent_idx on public.selection_decisions(parent_id) where parent_id is not null;
create trigger workflow_guard before insert or update or delete on public.selection_decisions for each row execute function private.workflow_guard();
create table public.v2_bookings (
 id uuid primary key default gen_random_uuid(), organization_id uuid references public.organizations(id),
 carrier_id uuid references public.carriers(id),freight_request_id uuid references public.freight_requests(id),parent_id uuid,
 kind text not null default 'bookings' check(kind='bookings'),status text not null,version integer not null default 1 check(version>0),
 data jsonb not null check(jsonb_typeof(data)='object'),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(id,organization_id),unique(id,carrier_id));
alter table public.v2_bookings enable row level security;
revoke all on public.v2_bookings from public,anon,authenticated,service_role;
create index v2_bookings_tenant_idx on public.v2_bookings(organization_id,created_at,id);
create index v2_bookings_carrier_idx on public.v2_bookings(carrier_id,created_at,id) where carrier_id is not null;
create index v2_bookings_request_idx on public.v2_bookings(freight_request_id) where freight_request_id is not null;
create index v2_bookings_parent_idx on public.v2_bookings(parent_id) where parent_id is not null;
create trigger workflow_guard before insert or update or delete on public.v2_bookings for each row execute function private.workflow_guard();
create table public.operational_incidents (
 id uuid primary key default gen_random_uuid(), organization_id uuid references public.organizations(id),
 carrier_id uuid references public.carriers(id),freight_request_id uuid references public.freight_requests(id),parent_id uuid,
 kind text not null default 'incidents' check(kind='incidents'),status text not null,version integer not null default 1 check(version>0),
 data jsonb not null check(jsonb_typeof(data)='object'),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(id,organization_id),unique(id,carrier_id));
alter table public.operational_incidents enable row level security;
revoke all on public.operational_incidents from public,anon,authenticated,service_role;
create index operational_incidents_tenant_idx on public.operational_incidents(organization_id,created_at,id);
create index operational_incidents_carrier_idx on public.operational_incidents(carrier_id,created_at,id) where carrier_id is not null;
create index operational_incidents_request_idx on public.operational_incidents(freight_request_id) where freight_request_id is not null;
create index operational_incidents_parent_idx on public.operational_incidents(parent_id) where parent_id is not null;
create trigger workflow_guard before insert or update or delete on public.operational_incidents for each row execute function private.workflow_guard();
create table public.incident_updates (
 id uuid primary key default gen_random_uuid(), organization_id uuid references public.organizations(id),
 carrier_id uuid references public.carriers(id),freight_request_id uuid references public.freight_requests(id),parent_id uuid,
 kind text not null default 'incident-updates' check(kind='incident-updates'),status text not null,version integer not null default 1 check(version>0),
 data jsonb not null check(jsonb_typeof(data)='object'),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(id,organization_id),unique(id,carrier_id));
alter table public.incident_updates enable row level security;
revoke all on public.incident_updates from public,anon,authenticated,service_role;
create index incident_updates_tenant_idx on public.incident_updates(organization_id,created_at,id);
create index incident_updates_carrier_idx on public.incident_updates(carrier_id,created_at,id) where carrier_id is not null;
create index incident_updates_request_idx on public.incident_updates(freight_request_id) where freight_request_id is not null;
create index incident_updates_parent_idx on public.incident_updates(parent_id) where parent_id is not null;
create trigger workflow_guard before insert or update or delete on public.incident_updates for each row execute function private.workflow_guard();
create table public.asset_status_events (
 id uuid primary key default gen_random_uuid(), organization_id uuid references public.organizations(id),
 carrier_id uuid references public.carriers(id),freight_request_id uuid references public.freight_requests(id),parent_id uuid,
 kind text not null default 'asset-events' check(kind='asset-events'),status text not null,version integer not null default 1 check(version>0),
 data jsonb not null check(jsonb_typeof(data)='object'),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(id,organization_id),unique(id,carrier_id));
alter table public.asset_status_events enable row level security;
revoke all on public.asset_status_events from public,anon,authenticated,service_role;
create index asset_status_events_tenant_idx on public.asset_status_events(organization_id,created_at,id);
create index asset_status_events_carrier_idx on public.asset_status_events(carrier_id,created_at,id) where carrier_id is not null;
create index asset_status_events_request_idx on public.asset_status_events(freight_request_id) where freight_request_id is not null;
create index asset_status_events_parent_idx on public.asset_status_events(parent_id) where parent_id is not null;
create trigger workflow_guard before insert or update or delete on public.asset_status_events for each row execute function private.workflow_guard();
create table public.execution_events (
 id uuid primary key default gen_random_uuid(), organization_id uuid references public.organizations(id),
 carrier_id uuid references public.carriers(id),freight_request_id uuid references public.freight_requests(id),parent_id uuid,
 kind text not null default 'execution-events' check(kind='execution-events'),status text not null,version integer not null default 1 check(version>0),
 data jsonb not null check(jsonb_typeof(data)='object'),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(id,organization_id),unique(id,carrier_id));
alter table public.execution_events enable row level security;
revoke all on public.execution_events from public,anon,authenticated,service_role;
create index execution_events_tenant_idx on public.execution_events(organization_id,created_at,id);
create index execution_events_carrier_idx on public.execution_events(carrier_id,created_at,id) where carrier_id is not null;
create index execution_events_request_idx on public.execution_events(freight_request_id) where freight_request_id is not null;
create index execution_events_parent_idx on public.execution_events(parent_id) where parent_id is not null;
create trigger workflow_guard before insert or update or delete on public.execution_events for each row execute function private.workflow_guard();
create table public.capacity_consolidations (
 id uuid primary key default gen_random_uuid(), organization_id uuid references public.organizations(id),
 carrier_id uuid references public.carriers(id),freight_request_id uuid references public.freight_requests(id),parent_id uuid,
 kind text not null default 'consolidations' check(kind='consolidations'),status text not null,version integer not null default 1 check(version>0),
 data jsonb not null check(jsonb_typeof(data)='object'),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(id,organization_id),unique(id,carrier_id));
alter table public.capacity_consolidations enable row level security;
revoke all on public.capacity_consolidations from public,anon,authenticated,service_role;
create index capacity_consolidations_tenant_idx on public.capacity_consolidations(organization_id,created_at,id);
create index capacity_consolidations_carrier_idx on public.capacity_consolidations(carrier_id,created_at,id) where carrier_id is not null;
create index capacity_consolidations_request_idx on public.capacity_consolidations(freight_request_id) where freight_request_id is not null;
create index capacity_consolidations_parent_idx on public.capacity_consolidations(parent_id) where parent_id is not null;
create trigger workflow_guard before insert or update or delete on public.capacity_consolidations for each row execute function private.workflow_guard();

alter table public.capacity_consolidations add column carrier_service_id uuid not null,add column calendar_id uuid not null references public.capacity_calendars(id),add column route_id uuid not null references public.route_plans(id),add constraint consolidation_service_fk foreign key(carrier_service_id,carrier_id) references public.carrier_services(id,carrier_id);
alter table public.route_corridors add column origin_node_id uuid not null references public.logistics_nodes(id),add column destination_node_id uuid not null references public.logistics_nodes(id),add constraint corridor_directed check(origin_node_id<>destination_node_id);
alter table public.route_conditions add constraint condition_corridor_fk foreign key(parent_id) references public.route_corridors(id);
alter table public.route_resource_limits add column carrier_service_id uuid not null,add column asset_id uuid references public.transport_assets(id),add column combination_id uuid references public.vehicle_combinations(id),add column corridor_id uuid not null references public.route_corridors(id),add constraint resource_limit_source check((asset_id is null)<>(combination_id is null)),add constraint resource_limit_service_fk foreign key(carrier_service_id,carrier_id) references public.carrier_services(id,carrier_id);
alter table public.route_plans add column policy_id uuid not null references public.route_planning_policies(id);
alter table public.transport_plan_candidates add column route_plan_id uuid not null references public.route_plans(id),add column request_version integer not null;
alter table public.carrier_opportunities add constraint opportunity_plan_fk foreign key(parent_id) references public.transport_plan_candidates(id);
alter table public.v2_carrier_offers add constraint offer_opportunity_fk foreign key(parent_id) references public.carrier_opportunities(id),add column plan_id uuid not null references public.transport_plan_candidates(id),add column supersedes_offer_id uuid references public.v2_carrier_offers(id);
alter table public.v2_rankings add column policy_id uuid not null references public.scoring_policies(id);
alter table public.selection_decisions add column plan_id uuid not null references public.transport_plan_candidates(id),add column selected_by uuid not null references public.organization_members(id);
alter table public.v2_bookings add column decision_id uuid not null references public.selection_decisions(id),add column offer_id uuid not null references public.v2_carrier_offers(id),add constraint one_booking_per_offer_decision unique(decision_id,offer_id);
alter table public.incident_updates add constraint incident_update_incident_fk foreign key(parent_id) references public.operational_incidents(id);
alter table public.operational_incidents add constraint incident_execution_fk foreign key(parent_id) references public.transport_executions(id);
alter table public.execution_events add constraint execution_event_execution_fk foreign key(parent_id) references public.transport_executions(id);
alter table public.asset_status_events add constraint asset_event_asset_fk foreign key(parent_id) references public.transport_assets(id);
alter table public.transport_executions add column booking_id uuid references public.v2_bookings(id),add column data jsonb not null default '{}',add constraint execution_booking_service_unique unique(booking_id,carrier_service_id);
alter table public.capacity_reservations add column booking_id uuid references public.v2_bookings(id),add column plan_assignment_id uuid,add column expires_at timestamptz,add column version integer not null default 1 check(version>0),add column updated_at timestamptz not null default now();
create index capacity_reservations_booking_idx on public.capacity_reservations(booking_id);
create index execution_booking_idx on public.transport_executions(booking_id);
create table public.route_legs(id uuid primary key default gen_random_uuid(),route_plan_id uuid not null references public.route_plans(id),corridor_id uuid not null references public.route_corridors(id),sequence integer not null check(sequence>0),data jsonb not null,unique(route_plan_id,sequence),unique(id,route_plan_id));
create table public.route_waypoints(id uuid primary key default gen_random_uuid(),route_leg_id uuid not null references public.route_legs(id),sequence integer not null check(sequence>0),data jsonb not null,unique(route_leg_id,sequence));
create table public.plan_resources(id uuid primary key default gen_random_uuid(),plan_id uuid not null references public.transport_plan_candidates(id),carrier_id uuid not null references public.carriers(id),carrier_service_id uuid not null,calendar_id uuid not null references public.capacity_calendars(id),asset_id uuid references public.transport_assets(id),capacity_pool_id uuid references public.capacity_pools(id),combination_id uuid references public.vehicle_combinations(id),data jsonb not null,unique(id,plan_id),foreign key(carrier_service_id,carrier_id) references public.carrier_services(id,carrier_id),check((asset_id is null)<>(capacity_pool_id is null)));
create table public.plan_leg_assignments(id uuid primary key default gen_random_uuid(),plan_id uuid not null references public.transport_plan_candidates(id),route_leg_id uuid not null references public.route_legs(id),resource_id uuid not null,carrier_service_id uuid not null references public.carrier_services(id),lane_id uuid not null references public.service_lanes(id),sequence integer not null check(sequence>0),starts_at timestamptz not null,ends_at timestamptz not null,data jsonb not null,foreign key(resource_id,plan_id) references public.plan_resources(id,plan_id),check(ends_at>starts_at));
create table public.load_allocations(id uuid primary key default gen_random_uuid(),assignment_id uuid not null references public.plan_leg_assignments(id),unit_index integer not null check(unit_index>=0),quantity integer not null check(quantity>0),assigned_weight_kg numeric not null check(assigned_weight_kg>0),assigned_volume_m3 numeric not null check(assigned_volume_m3>0),data jsonb not null,unique(assignment_id,unit_index));
alter table public.capacity_reservations add constraint reservation_plan_assignment_fk foreign key(plan_assignment_id) references public.plan_leg_assignments(id);
alter table public.capacity_reservations add column consolidation_id uuid references public.capacity_consolidations(id);
alter table public.capacity_reservations add column parent_reservation_id uuid references public.capacity_reservations(id),add constraint reservation_parent_not_self check(parent_reservation_id is distinct from id);
alter table public.transport_executions add column consolidation_id uuid references public.capacity_consolidations(id);
alter table public.capacity_reservations drop constraint capacity_reservations_no_overlap;
alter table public.capacity_reservations add constraint capacity_reservations_no_overlap exclude using gist(capacity_calendar_id with =,tstzrange(starts_at,ends_at,'[)') with &&) where(status in ('HELD','CONFIRMED') and consolidation_id is null);
create index reservations_consolidation_idx on public.capacity_reservations(consolidation_id) where consolidation_id is not null;
create table public.selection_offers(decision_id uuid not null references public.selection_decisions(id),offer_id uuid not null references public.v2_carrier_offers(id),primary key(decision_id,offer_id));
create table public.ranked_options(id uuid primary key default gen_random_uuid(),ranking_id uuid not null references public.v2_rankings(id),offer_id uuid not null references public.v2_carrier_offers(id),position integer,score numeric,data jsonb not null,bundle_key text not null,unique(ranking_id,bundle_key));
create unique index scoring_policy_version_unique on public.scoring_policies((data#>>'{policy,version}'));create unique index route_policy_version_unique on public.route_planning_policies((data->>'version'));
alter table public.route_legs enable row level security;revoke all on public.route_legs from public,anon,authenticated,service_role;
alter table public.route_waypoints enable row level security;revoke all on public.route_waypoints from public,anon,authenticated,service_role;
alter table public.plan_resources enable row level security;revoke all on public.plan_resources from public,anon,authenticated,service_role;
alter table public.plan_leg_assignments enable row level security;revoke all on public.plan_leg_assignments from public,anon,authenticated,service_role;
alter table public.load_allocations enable row level security;revoke all on public.load_allocations from public,anon,authenticated,service_role;
alter table public.selection_offers enable row level security;revoke all on public.selection_offers from public,anon,authenticated,service_role;
alter table public.ranked_options enable row level security;revoke all on public.ranked_options from public,anon,authenticated,service_role;
create function private.workflow_table(k text) returns text language plpgsql immutable set search_path='' as $$begin case k
when 'nodes' then return 'logistics_nodes';
when 'corridors' then return 'route_corridors';
when 'route-policies' then return 'route_planning_policies';
when 'conditions' then return 'route_conditions';
when 'limits' then return 'route_resource_limits';
when 'scoring-policies' then return 'scoring_policies';
when 'metrics' then return 'v2_carrier_metrics';
when 'routes' then return 'route_plans';
when 'plans' then return 'transport_plan_candidates';
when 'opportunities' then return 'carrier_opportunities';
when 'offers' then return 'v2_carrier_offers';
when 'ranking' then return 'v2_rankings';
when 'decisions' then return 'selection_decisions';
when 'bookings' then return 'v2_bookings';
when 'incidents' then return 'operational_incidents';
when 'incident-updates' then return 'incident_updates';
when 'asset-events' then return 'asset_status_events';
when 'execution-events' then return 'execution_events';
when 'consolidations' then return 'capacity_consolidations';
when 'holds' then return 'capacity_reservations';when 'executions' then return 'transport_executions';else raise exception 'VALIDATION_ERROR' using errcode='PT400';end case;end;$$;
create function private.workflow_record(k text,i uuid) returns jsonb language plpgsql security definer set search_path='' as $$declare r record;begin
if k='holds' then select h.*,c.carrier_id into r from public.capacity_reservations h join public.capacity_calendars c on c.id=h.capacity_calendar_id where h.id=i;
return jsonb_build_object('id',r.id,'organizationId',(select organization_id from public.v2_bookings where id=r.booking_id),'carrierId',r.carrier_id,'requestId',r.freight_request_id,'kind',k,'status',r.status,'version',r.version,'createdAt',r.created_at,'updatedAt',r.updated_at,'data',jsonb_build_object('bookingId',r.booking_id,'assignmentId',r.plan_assignment_id,'calendarId',r.capacity_calendar_id,'window',jsonb_build_object('startsAt',r.starts_at,'endsAt',r.ends_at),'expiresAt',r.expires_at,'active',r.status='CONFIRMED' or r.status='HELD' and r.expires_at>now(),'consolidationId',r.consolidation_id,'parentReservationId',r.parent_reservation_id,'capacityCommitted',r.committed_capacity,'evidence',r.evidence));
elsif k='executions' then select * into r from public.transport_executions where id=i;return jsonb_build_object('id',r.id,'organizationId',r.organization_id,'carrierId',r.carrier_id,'requestId',r.freight_request_id,'kind',k,'status',r.status,'version',r.version,'createdAt',r.created_at,'updatedAt',r.updated_at,'data',r.data||jsonb_build_object('bookingId',r.booking_id,'serviceId',r.carrier_service_id,'plannedWindow',jsonb_build_object('startsAt',r.planned_starts_at,'endsAt',r.planned_ends_at),'actualStartedAt',r.actual_started_at,'actualCompletedAt',r.actual_completed_at,'lastKnownPosition',r.last_known_position));
end if;execute format('select * from public.%I where id=$1',private.workflow_table(k)) into r using i;
return jsonb_build_object('id',r.id,'organizationId',r.organization_id,'carrierId',r.carrier_id,'requestId',r.freight_request_id,'kind',k,'status',r.status,'version',r.version,'createdAt',r.created_at,'updatedAt',r.updated_at,'data',r.data);end;$$;
revoke select on public.capacity_reservations from authenticated;grant select(id,capacity_calendar_id,starts_at,ends_at,status) on public.capacity_reservations to authenticated;
create function private.workflow_request(o uuid,r uuid) returns public.freight_requests language plpgsql security definer set search_path='' as $$declare q public.freight_requests;begin
 select * into q from public.freight_requests where id=r and organization_id=o and v2_contract_version='2.0';
 if q.id is null then raise exception 'WORKFLOW_NOT_FOUND' using errcode='PT404';end if;return q;end;$$;
create function private.workflow_scope(o uuid,c uuid,k text,i uuid) returns jsonb language plpgsql security definer set search_path='' as $$declare r jsonb;begin
 r:=private.workflow_record(k,i);if r->>'id' is null then raise exception 'WORKFLOW_NOT_FOUND' using errcode='PT404';end if;
 if c is not null then perform private.workflow_carrier(c);if (r->>'carrierId')::uuid is distinct from c then raise exception 'WORKFLOW_NOT_FOUND' using errcode='PT404';end if;
 elsif (r->>'organizationId')::uuid is distinct from o then raise exception 'WORKFLOW_NOT_FOUND' using errcode='PT404';end if;return r;end;$$;
create function private.workflow_area(a uuid,l jsonb,s timestamptz,t timestamptz) returns text language plpgsql security definer set search_path='' as $$declare r public.service_areas;begin
 select * into r from public.service_areas where id=a;
 if r.id is null or not r.active or r.valid_from>s or r.valid_until<t then return 'ineligible';end if;
 if r.country_code<>l->>'countryCode' or r.region_code is not null and lower(r.region_code)<>lower(coalesce(l->>'region',''))
 or r.city is not null and lower(r.city)<>lower(coalesce(l->>'city','')) then return 'ineligible';end if;
 if r.granularity in ('POLYGON','POINTS','POSTAL_CODE') or r.evidence_reference is null or r.verified_at is null or r.verified_at>now()
 or r.valid_until is null or r.fulfilment_partner_id is not null then return 'unknown';end if;return 'eligible';end;$$;

create function private.workflow_route(o uuid,qid uuid,ids jsonb,policy uuid,rid uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare q public.freight_requests;p public.route_planning_policies;c public.route_corridors;n1 public.logistics_nodes;n2 public.logistics_nodes;
 next_id uuid;prev uuid;seq integer:=0;leg uuid;x jsonb;origin jsonb;dest jsonb;reasons jsonb:='[]';distance numeric:=0;duration numeric:=0;known_distance boolean:=true;known_duration boolean:=true;
begin
 q:=private.workflow_request(o,qid);select * into p from public.route_planning_policies where id=policy and status='ACTIVE';
 if p.id is null then raise exception 'WORKFLOW_NOT_FOUND' using errcode='PT404';end if;
 insert into public.route_plans(id,organization_id,freight_request_id,status,policy_id,data) values(rid,o,qid,'unknown',policy,'{}');
 for next_id in select value::uuid from jsonb_array_elements_text(ids) loop
  seq:=seq+1;select * into c from public.route_corridors where id=next_id and status='ACTIVE';
  if c.id is null then raise exception 'WORKFLOW_NOT_FOUND' using errcode='PT404';end if;
  select * into n1 from public.logistics_nodes where id=c.origin_node_id;select * into n2 from public.logistics_nodes where id=c.destination_node_id;
  if seq>1 and prev<>c.origin_node_id then raise exception 'DISCONTINUOUS_ROUTE' using errcode='PT400';end if;
  if seq=1 then origin:=n1.data->'location';end if;dest:=n2.data->'location';prev:=c.destination_node_id;
  if not coalesce(q.v2_snapshot->'acceptedModes',jsonb_build_array(q.v2_snapshot->>'transportMode')) ? (c.data->>'mode') then raise exception 'ROUTE_MODE_MISMATCH' using errcode='PT400';end if;
  if n1.data#>>'{location,countryCode}'<>n2.data#>>'{location,countryCode}' and not exists(select 1 from jsonb_array_elements(c.data->'restrictions') req_rule where (req_rule->>'required')::boolean) then reasons:=reasons||'"BORDER_RULES_UNKNOWN"'::jsonb;end if;
  if c.data->>'mode'<>'ROAD' then reasons:=reasons||'"MODE_ADAPTER_UNVERIFIED"'::jsonb;end if;
  if n1.status<>'ACTIVE' or n2.status<>'ACTIVE' then raise exception 'NODE_INACTIVE' using errcode='PT400';end if;
  if not private.workflow_evidence(c.data->'source',q.pickup_window_start,q.delivery_window_end) or not private.workflow_evidence(n1.data->'source',q.pickup_window_start,q.delivery_window_end)
    or not private.workflow_evidence(n2.data->'source',q.pickup_window_start,q.delivery_window_end) then reasons:=reasons||'"ROUTE_SOURCE_UNKNOWN"'::jsonb;end if;
  for x in select value from jsonb_array_elements(c.data->'restrictions') union all select value from jsonb_array_elements(p.data->'constraints') loop
   if (x->>'required')::boolean and (not private.workflow_evidence(x->'evidence',q.pickup_window_start,q.delivery_window_end)
     or not exists(select 1 from jsonb_array_elements(coalesce(q.v2_snapshot#>'{cargoSpecification,availableDocuments}','[]')) doc where doc->>'code'=x->>'code'
       and doc->>'reference' is not null and (doc->>'issuedAt')::timestamptz<=now() and (doc->>'validUntil')::timestamptz>=q.delivery_window_end))
   then reasons:=reasons||jsonb_build_array('PERMIT_REQUIRED:'||(x->>'code'));end if;
  end loop;
  for x in select data from public.route_conditions where parent_id=c.id and status='ACTIVE'
    and (data->>'observedAt')::timestamptz<=now() and ((data->>'validUntil') is null or (data->>'validUntil')::timestamptz>now()) loop
   if x->>'kind'='CLOSURE' and x->>'confidence' in ('VERIFIED','SIMULATED') then reasons:=reasons||'"ROUTE_CLOSED"'::jsonb;
   else reasons:=reasons||jsonb_build_array('ROUTE_CONDITION:'||(x->>'kind'));end if;
  end loop;
  if c.data->>'estimatedDistanceKm' is null then known_distance:=false;else distance:=distance+(c.data->>'estimatedDistanceKm')::numeric;end if;
  if c.data->>'estimatedDurationSeconds' is null then known_duration:=false;else duration:=duration+(c.data->>'estimatedDurationSeconds')::numeric;end if;
  leg:=gen_random_uuid();insert into public.route_legs(id,route_plan_id,corridor_id,sequence,data) values(leg,rid,c.id,seq,
   jsonb_build_object('sequence',seq,'mode',c.data->'mode','origin',n1.data->'location','destination',n2.data->'location',
    'borderRequirements',c.data->'restrictions','estimatedDistanceKm',c.data->'estimatedDistanceKm','estimatedDurationSeconds',c.data->'estimatedDurationSeconds','waypoints',c.data->'waypoints','conditions',coalesce((select jsonb_agg(data) from public.route_conditions where parent_id=c.id and status='ACTIVE' and (data->>'observedAt')::timestamptz<=now() and ((data->>'validUntil') is null or (data->>'validUntil')::timestamptz>now())),'[]'::jsonb),'source',c.data->'source','corridorVersion',c.version,'originNodeVersion',n1.version,'destinationNodeVersion',n2.version));
  insert into public.route_waypoints(route_leg_id,sequence,data) select leg,ordinality,value from jsonb_array_elements(c.data->'waypoints') with ordinality;
 end loop;
 if lower(origin->>'city')<>lower(q.v2_snapshot#>>'{origin,city}') or origin->>'countryCode'<>q.v2_snapshot#>>'{origin,countryCode}'
 or lower(dest->>'city')<>lower(q.v2_snapshot#>>'{destination,city}') or dest->>'countryCode'<>q.v2_snapshot#>>'{destination,countryCode}' then raise exception 'ROUTE_REQUEST_ENDPOINT_MISMATCH' using errcode='PT400';end if;
 if (q.v2_snapshot#>>'{origin,lat}') is not null and origin->'lat' is distinct from q.v2_snapshot#>'{origin,lat}'
 or (q.v2_snapshot#>>'{origin,lng}') is not null and origin->'lng' is distinct from q.v2_snapshot#>'{origin,lng}'
 or (q.v2_snapshot#>>'{destination,lat}') is not null and dest->'lat' is distinct from q.v2_snapshot#>'{destination,lat}'
 or (q.v2_snapshot#>>'{destination,lng}') is not null and dest->'lng' is distinct from q.v2_snapshot#>'{destination,lng}' then reasons:=reasons||'"ENDPOINT_CONNECTOR_UNKNOWN"'::jsonb;end if;
 if known_duration and duration>extract(epoch from(q.delivery_window_end-q.pickup_window_start)) then reasons:=reasons||'"ROUTE_WINDOW_EXCEEDED"'::jsonb;end if;
 update public.route_plans set status=case when reasons ? 'ROUTE_CLOSED' or reasons ? 'ROUTE_WINDOW_EXCEEDED' then 'ineligible' when jsonb_array_length(reasons)>0 then 'unknown' else 'eligible' end,
 data=jsonb_build_object('origin',origin,'destination',dest,'corridorIds',ids,'policyId',policy,'policyVersion',p.version,'estimatedDistanceKm',case when known_distance then distance end,
  'estimatedDurationSeconds',case when known_duration then duration end,'geographicSource',jsonb_build_object('kind','PUBLISHED_CORRIDORS','references',ids),
  'confidence',case when jsonb_array_length(reasons)>0 then 'UNKNOWN' when exists(select 1 from public.route_corridors where id in(select value::uuid from jsonb_array_elements_text(ids)) and data#>>'{source,provenanceStatus}'='SIMULATED') or exists(select 1 from public.route_legs l join public.route_corridors cc on cc.id=l.corridor_id join public.logistics_nodes n on n.id in(cc.origin_node_id,cc.destination_node_id) where l.route_plan_id=rid and n.data#>>'{source,provenanceStatus}'='SIMULATED') then 'SIMULATED' else 'VERIFIED' end,'estimatedTolls',null,'borderCostEstimate',null,'reasons',reasons,
  'legs',(select jsonb_agg(data||jsonb_build_object('id',id,'corridorId',corridor_id) order by sequence) from public.route_legs where route_plan_id=rid)) where id=rid;
 return private.workflow_record('routes',rid);end;$$;

create function private.workflow_current_plan(i uuid) returns boolean language plpgsql security definer set search_path='' as $$declare p public.transport_plan_candidates;r public.route_plans;q public.freight_requests;begin
 select * into p from public.transport_plan_candidates where id=i;select * into q from public.freight_requests where id=p.freight_request_id;
 select * into r from public.route_plans where id=p.route_plan_id;
 return coalesce(p.status='eligible' and p.request_version=q.draft_version and not exists(select 1 from public.route_legs l join public.route_corridors c on c.id=l.corridor_id
  where l.route_plan_id=r.id and (c.status<>'ACTIVE' or c.version<>(l.data->>'corridorVersion')::integer or not private.workflow_evidence(c.data->'source',q.pickup_window_start,q.delivery_window_end))),false);
end;$$;

create function private.read_v2_workflow(p_organization_id uuid,p_member_id uuid,p_kind text,p_context jsonb,p_limit integer,p_offset integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare t text;i uuid;c uuid:=(p_context->>'carrierId')::uuid;q uuid:=(p_context->>'requestId')::uuid;parent uuid:=(p_context->>'parentId')::uuid;
 ident uuid:=(p_context->>'id')::uuid;rows jsonb:='[]';r jsonb;begin
 perform private.workflow_member(p_organization_id,p_member_id,false);t:=private.workflow_table(p_kind);
 if p_limit not between 1 and 100 or p_offset not between 0 and 100000 or p_limit is null or p_offset is null then raise exception 'VALIDATION_ERROR' using errcode='PT400';end if;
 if c is not null then perform private.workflow_carrier(c);end if;
 if p_kind in ('limits','metrics','consolidations','asset-events') and c is null then raise exception 'FORBIDDEN_WORKFLOW' using errcode='PT403';end if;
 if q is not null then perform private.workflow_request(p_organization_id,q);end if;
 if parent is not null and p_kind in ('incidents','execution-events') then perform private.workflow_scope(p_organization_id,c,'executions',parent);
 elsif parent is not null and p_kind='incident-updates' then perform private.workflow_scope(p_organization_id,c,'incidents',parent);
 elsif p_kind='asset-events' then perform private.workflow_carrier(c);if not exists(select 1 from public.transport_assets where id=parent and carrier_id=c) then raise exception 'WORKFLOW_NOT_FOUND' using errcode='PT404';end if;end if;
 if parent is not null and p_kind in ('holds','executions') then perform private.workflow_scope(p_organization_id,c,'bookings',parent);end if;
 if p_kind='holds' then
  for i in select h.id from public.capacity_reservations h join public.v2_bookings b on b.id=h.booking_id where
   (c is null and b.organization_id=p_organization_id or c is not null and b.carrier_id=c) and (parent is null or h.booking_id=parent) and (ident is null or h.id=ident) order by h.created_at,h.id limit p_limit offset p_offset loop rows:=rows||jsonb_build_array(private.workflow_record(p_kind,i));end loop;
 elsif p_kind='executions' then
  for i in select id from public.transport_executions where (c is null and organization_id=p_organization_id or c is not null and carrier_id=c)
   and booking_id is not null and (parent is null or booking_id=parent) and (ident is null or id=ident) order by created_at,id limit p_limit offset p_offset loop rows:=rows||jsonb_build_array(private.workflow_record(p_kind,i));end loop;
 else
  for i in execute format('select id from public.%I where (($1 is null and (organization_id=$2 or organization_id is null)) or ($1 is not null and carrier_id=$1)) and ($3 is null or freight_request_id=$3) and ($4 is null or parent_id=$4) and ($5 is null or id=$5) order by created_at,id limit $6 offset $7',t)
   using c,p_organization_id,q,parent,ident,p_limit,p_offset loop rows:=rows||jsonb_build_array(private.workflow_record(p_kind,i));end loop;
 end if;return rows;end;$$;
create function public.read_v2_workflow(p_organization_id uuid,p_member_id uuid,p_kind text,p_context jsonb,p_limit integer,p_offset integer) returns jsonb language sql security definer set search_path='' as $$select private.read_v2_workflow(p_organization_id,p_member_id,p_kind,p_context,p_limit,p_offset);$$;
revoke all on function public.read_v2_workflow(uuid,uuid,text,jsonb,integer,integer) from public,anon,service_role;
grant execute on function public.read_v2_workflow(uuid,uuid,text,jsonb,integer,integer) to authenticated;


create function private.workflow_evaluate_plan(pid uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.transport_plan_candidates;r public.route_plans;q public.freight_requests;a record;u jsonb;x jsonb;
 s public.carrier_services;cal public.capacity_calendars;asset public.transport_assets;pool public.capacity_pools;combo public.vehicle_combinations;
 lane public.service_lanes;lim public.route_resource_limits;corr public.route_corridors;reasons jsonb:='[]';pending jsonb:='[]';w numeric;v numeric;
 capw numeric;capv numeric;dims jsonb;win_s timestamptz;win_e timestamptz;idx integer;total integer;peakw numeric;peakv numeric;usedw numeric;usedv numeric;pt timestamptz;leg record;loc jsonb;req text;assessments jsonb:='[]';provenance text:='VERIFIED';
begin
 select * into p from public.transport_plan_candidates where id=pid;select * into r from public.route_plans where id=p.route_plan_id;
 select * into q from public.freight_requests where id=p.freight_request_id;
 if q.id is null or p.request_version<>q.draft_version then reasons:=reasons||'"REQUEST_VERSION_CHANGED"'::jsonb;end if;
 if not exists(select 1 from public.route_planning_policies where id=r.policy_id and status='ACTIVE' and version=(r.data->>'policyVersion')::integer) then pending:=pending||'"ROUTE_POLICY_CHANGED"'::jsonb;end if;
 if r.data->>'confidence'='SIMULATED' then provenance:='SIMULATED';end if;
 if r.status<>'eligible' then pending:=pending||coalesce(r.data->'reasons','[]');end if;
 for leg in select * from public.route_legs where route_plan_id=r.id order by sequence loop
  select * into corr from public.route_corridors where id=leg.corridor_id;
  if exists(select 1 from public.logistics_nodes n where n.id in(corr.origin_node_id,corr.destination_node_id) and (n.status<>'ACTIVE' or not private.workflow_evidence(n.data->'source',q.pickup_window_start,q.delivery_window_end) or n.version<>case when n.id=corr.origin_node_id then (leg.data->>'originNodeVersion')::integer else (leg.data->>'destinationNodeVersion')::integer end)) then pending:=pending||'"ROUTE_NODE_CHANGED"'::jsonb;end if;
  if corr.status<>'ACTIVE' or corr.version<>(leg.data->>'corridorVersion')::integer then pending:=pending||'"CORRIDOR_CHANGED"'::jsonb;end if;
  if not private.workflow_evidence(corr.data->'source',q.pickup_window_start,q.delivery_window_end) then pending:=pending||'"CORRIDOR_EVIDENCE_EXPIRED"'::jsonb;end if;
  if exists(select 1 from public.route_conditions where parent_id=corr.id and status='ACTIVE' and data->>'kind'='CLOSURE'
   and (data->>'observedAt')::timestamptz<=now() and ((data->>'validUntil') is null or (data->>'validUntil')::timestamptz>now())) then reasons:=reasons||'"ROUTE_CLOSED"'::jsonb;end if;
  for idx,u in select (ordinality-1)::integer,value from jsonb_array_elements(q.v2_snapshot#>'{cargoSpecification,units}') with ordinality loop
   select coalesce(sum(l.quantity),0) into total from public.load_allocations l join public.plan_leg_assignments aa on aa.id=l.assignment_id
    where aa.plan_id=p.id and aa.route_leg_id=leg.id and l.unit_index=idx;
   if total<>(u->>'quantity')::integer then reasons:=reasons||'"INCOMPLETE_LOAD_ALLOCATION"'::jsonb;end if;
  end loop;
  if not exists(select 1 from public.plan_leg_assignments where plan_id=p.id and route_leg_id=leg.id) then reasons:=reasons||'"UNCOVERED_ROUTE_LEG"'::jsonb;end if;
 end loop;
 for a in select aa.*,pr.asset_id,pr.capacity_pool_id,pr.combination_id,pr.calendar_id,pr.data as resource_data,rl.data as leg_data,rl.corridor_id
  from public.plan_leg_assignments aa join public.plan_resources pr on pr.id=aa.resource_id join public.route_legs rl on rl.id=aa.route_leg_id
  where aa.plan_id=p.id order by aa.sequence,aa.id loop
  win_s:=a.starts_at;win_e:=a.ends_at;select * into s from public.carrier_services where id=a.carrier_service_id;
  select * into lane from public.service_lanes where id=a.lane_id;select * into cal from public.capacity_calendars where id=a.calendar_id;
  select * into asset from public.transport_assets where id=a.asset_id;select * into pool from public.capacity_pools where id=a.capacity_pool_id;
  select * into combo from public.vehicle_combinations where id=a.combination_id;
  w:=coalesce((a.data#>>'{capacityNeeded,weightKg}')::numeric,0);v:=coalesce((a.data#>>'{capacityNeeded,volumeM3}')::numeric,0);
  if not exists(select 1 from public.carriers carrier where carrier.id=s.carrier_id and carrier.status='ACTIVE') then reasons:=reasons||'"CARRIER_INACTIVE"'::jsonb;end if;
  if not s.active or s.transport_mode<>a.leg_data->>'mode' or s.service_type<>coalesce(q.v2_snapshot->>'serviceType','FTL') then reasons:=reasons||'"SERVICE_MISMATCH"'::jsonb;end if;
  if not exists(select 1 from public.carrier_service_cargo_categories where carrier_service_id=s.id and cargo_category_id=q.cargo_category_id) then reasons:=reasons||'"CARGO_CATEGORY_UNSUPPORTED"'::jsonb;end if;
  if lane.carrier_service_id<>s.id or not lane.active or lane.valid_from>win_s or lane.valid_until<win_e or lane.transport_mode<>s.transport_mode then reasons:=reasons||'"LANE_MISMATCH"'::jsonb;end if;
  if lane.evidence_reference is null or lane.verified_at is null or lane.verified_at>now() or lane.valid_until is null then pending:=pending||'"LANE_EVIDENCE_UNKNOWN"'::jsonb;end if;
  if private.workflow_area(lane.pickup_area_id,a.leg_data->'origin',win_s,win_e)<>'eligible'
   or private.workflow_area(lane.delivery_area_id,a.leg_data->'destination',win_s,win_e)<>'eligible' then pending:=pending||'"SERVICE_AREA_NOT_VERIFIED"'::jsonb;end if;
  if exists(select 1 from public.service_areas aa where aa.carrier_service_id=s.id and aa.coverage='EXCLUDE' and aa.active and
    (private.workflow_area(aa.id,a.leg_data->'origin',win_s,win_e)='eligible' or private.workflow_area(aa.id,a.leg_data->'destination',win_s,win_e)='eligible')) then reasons:=reasons||'"SERVICE_AREA_EXCLUDED"'::jsonb;end if;
  if lane.cross_border_prohibited and a.leg_data#>>'{origin,countryCode}'<>a.leg_data#>>'{destination,countryCode}' then reasons:=reasons||'"CROSS_BORDER_PROHIBITED"'::jsonb;end if;
  if lane.cross_border_review_required then pending:=pending||'"BORDER_REQUIRES_REVIEW"'::jsonb;end if;
  if win_s<q.pickup_window_start or win_e>q.delivery_window_end or win_s>=win_e then reasons:=reasons||'"ASSIGNMENT_WINDOW_MISMATCH"'::jsonb;end if;
  if a.sequence=1 and win_s>q.pickup_window_end or a.sequence=(select max(sequence) from public.route_legs where route_plan_id=r.id) and win_e<q.delivery_window_start then reasons:=reasons||'"PICKUP_DELIVERY_WINDOW_MISMATCH"'::jsonb;end if;
  if a.leg_data->>'estimatedDurationSeconds' is null then pending:=pending||'"TRANSIT_UNKNOWN"'::jsonb;
  elsif (a.leg_data->>'estimatedDurationSeconds')::numeric>extract(epoch from(win_e-win_s)) then reasons:=reasons||'"LEG_DURATION_EXCEEDS_WINDOW"'::jsonb;end if;
  if exists(select 1 from public.plan_leg_assignments b where b.plan_id=p.id and b.sequence=a.sequence+1 and b.starts_at<a.ends_at) then reasons:=reasons||'"TRANSFER_WINDOW_MISMATCH"'::jsonb;end if;
  if cal.carrier_service_id<>s.id or cal.transport_asset_id is distinct from a.asset_id or cal.capacity_pool_id is distinct from a.capacity_pool_id then reasons:=reasons||'"RESOURCE_SCOPE_MISMATCH"'::jsonb;end if;
  if (cal.ready_pickup_area_id is null or private.workflow_area(cal.ready_pickup_area_id,a.leg_data->'origin',win_s,win_e)<>'eligible') and not exists(select 1 from public.plan_leg_assignments prev_a join public.plan_resources prev_r on prev_r.id=prev_a.resource_id join public.route_legs prev_leg on prev_leg.id=prev_a.route_leg_id
   where prev_a.plan_id=p.id and prev_a.sequence=a.sequence-1 and prev_r.calendar_id=cal.id and prev_a.ends_at<=win_s and prev_leg.data->'destination'=a.leg_data->'origin') then pending:=pending||'"READY_PICKUP_POSITION_UNKNOWN"'::jsonb;end if;
  if not cal.complete or cal.observed_at is null or cal.observed_at>now() or cal.valid_until is null or cal.valid_until<win_e
   or cal.provenance_status not in ('VERIFIED','SIMULATED') or not private.crew_windows_cover(cal.available_windows,win_s,win_e) then pending:=pending||'"RESOURCE_WINDOW_UNKNOWN"'::jsonb;end if;
  if exists(select 1 from public.capacity_reservations rr where rr.capacity_calendar_id=cal.id and rr.status in ('HELD','CONFIRMED')
   and tstzrange(rr.starts_at,rr.ends_at,'[)')&&tstzrange(win_s,win_e,'[)') and rr.plan_assignment_id is distinct from a.id and not(s.service_type='LTL' and private.workflow_trip_compatible(rr.consolidation_id,p.id,s.id,cal.id,win_s,win_e)))
   or exists(select 1 from public.scheduled_maintenances mm where mm.transport_asset_id=a.asset_id and mm.status in ('SCHEDULED','IN_PROGRESS') and tstzrange(mm.starts_at,mm.ends_at,'[)')&&tstzrange(win_s,win_e,'[)'))
   or exists(select 1 from public.repositioning_blocks bb where bb.capacity_calendar_id=cal.id and bb.status in ('PLANNED','IN_PROGRESS') and tstzrange(bb.starts_at,bb.ends_at,'[)')&&tstzrange(win_s,win_e,'[)'))
   or exists(select 1 from public.vehicle_assignments vv where vv.transport_asset_id=a.asset_id and vv.status in ('PROPOSED','CONFIRMED') and tstzrange(vv.starts_at,vv.ends_at,'[)')&&tstzrange(win_s,win_e,'[)')
    and not exists(select 1 from public.transport_executions same_e where same_e.id=vv.execution_id and private.workflow_trip_compatible(same_e.consolidation_id,p.id,s.id,cal.id,win_s,win_e))
    and not exists(select 1 from public.transport_executions ee join public.v2_bookings bb on bb.id=ee.booking_id join public.v2_carrier_offers oo on oo.id=bb.offer_id where ee.id=vv.execution_id and oo.plan_id=p.id and (oo.data->'coveredAssignmentIds') ? a.id::text)) then reasons:=reasons||'"RESOURCE_OCCUPIED"'::jsonb;end if;
  if a.asset_id is not null and (not asset.active or asset.operating_status<>'AVAILABLE') or a.capacity_pool_id is not null and not pool.active then reasons:=reasons||'"RESOURCE_INACTIVE"'::jsonb;end if;
  if a.resource_data->>'role'='AUXILIARY' then
   if w<>0 or v<>0 or a.asset_id is not null and asset.asset_role<>'ESCORT' then reasons:=reasons||'"AUXILIARY_CANNOT_CARRY"'::jsonb;end if;continue;
  end if;
  if a.asset_id is not null and asset.asset_role<>'CARRIER' then reasons:=reasons||'"AUXILIARY_CANNOT_CARRY"'::jsonb;end if;
  capw:=case when a.asset_id is not null then asset.max_weight_kg else pool.max_weight_kg end;
  capv:=case when a.asset_id is not null then asset.max_volume_m3 else pool.max_volume_m3 end;
  dims:=asset.usable_dimensions;
  if q.required_equipment_code is not null and q.required_equipment_code<>coalesce(asset.equipment_code,pool.equipment_code) then reasons:=reasons||'"EQUIPMENT_MISMATCH"'::jsonb;end if;
  if a.asset_id is not null and asset.evidence is null or a.capacity_pool_id is not null and (pool.evidence is null or pool.starts_at>win_s or pool.ends_at<win_e) then pending:=pending||'"RESOURCE_EVIDENCE_UNKNOWN"'::jsonb;end if;
  select * into lim from public.route_resource_limits where carrier_service_id=s.id and corridor_id=a.corridor_id and status='ACTIVE'
   and (a.combination_id is null and asset_id=a.asset_id or a.combination_id is not null and combination_id=a.combination_id) order by created_at desc,id limit 1;
  if lim.id is null or not private.workflow_evidence(lim.data->'source',win_s,win_e) then pending:=pending||'"ROUTE_MANUFACTURER_LIMITS_UNKNOWN"'::jsonb;
  else
   capw:=least(capw,(lim.data->>'manufacturerPayloadLimitKg')::numeric,(lim.data->>'routeGrossLimitKg')::numeric-(lim.data->>'combinedTareKg')::numeric);
   capv:=least(capv,(lim.data->>'usableVolumeM3')::numeric);dims:=lim.data->'usableDimensions';
   if a.combination_id is not null then
    if combo.status<>'COUPLED' or combo.starts_at>win_s or combo.ends_at<win_e or not (lim.data->>'compatibilityConfirmed')::boolean
      or not private.crew_evidence(combo.compatibility_evidence,win_s,win_e) then pending:=pending||'"COMBINATION_COMPATIBILITY_UNKNOWN"'::jsonb;end if;
    if combo.combined_tare_kg is distinct from (lim.data->>'combinedTareKg')::numeric then pending:=pending||'"COMBINATION_TARE_MISMATCH"'::jsonb;end if;
    if combo.combined_tare_kg is null or combo.gross_weight_limit_kg is null then pending:=pending||'"COMBINATION_LIMITS_UNKNOWN"'::jsonb;
    else capw:=least((lim.data->>'manufacturerPayloadLimitKg')::numeric,(lim.data->>'routeGrossLimitKg')::numeric-combo.combined_tare_kg,combo.gross_weight_limit_kg-combo.combined_tare_kg);end if;
    if not exists(select 1 from public.vehicle_combination_assets where combination_id=combo.id and transport_asset_id=asset.id) then reasons:=reasons||'"INVALID_COMBINATION_MEMBER"'::jsonb;end if;
    if exists(select 1 from public.vehicle_combination_assets m join public.transport_assets aa on aa.id=m.transport_asset_id
     left join public.capacity_calendars cc on cc.transport_asset_id=aa.id where m.combination_id=combo.id and
     (not aa.active or aa.operating_status<>'AVAILABLE' or cc.id is null or cc.carrier_service_id<>s.id or cc.observed_at is null or cc.observed_at>now() or not cc.complete or cc.valid_until<win_e or cc.provenance_status not in ('VERIFIED','SIMULATED') or not private.crew_windows_cover(cc.available_windows,win_s,win_e)
      or exists(select 1 from public.capacity_reservations rr where rr.capacity_calendar_id=cc.id and rr.status in ('HELD','CONFIRMED') and rr.plan_assignment_id is distinct from a.id and not (s.service_type='LTL' and private.workflow_trip_compatible(rr.consolidation_id,p.id,s.id,cal.id,win_s,win_e)) and tstzrange(rr.starts_at,rr.ends_at,'[)')&&tstzrange(win_s,win_e,'[)'))
      or exists(select 1 from public.scheduled_maintenances mm where mm.transport_asset_id=aa.id and mm.status in ('SCHEDULED','IN_PROGRESS') and tstzrange(mm.starts_at,mm.ends_at,'[)')&&tstzrange(win_s,win_e,'[)')))) then pending:=pending||'"COMBINATION_MEMBER_UNAVAILABLE"'::jsonb;end if;
   end if;
  end if;
  capw:=least(capw,s.max_capacity_kg);capv:=least(capv,s.max_volume_m3);
  if s.service_type='LTL' then
   peakw:=0;peakv:=0;
   for pt in select win_s union select greatest(rr.starts_at,win_s) from public.capacity_reservations rr where rr.capacity_calendar_id=cal.id and rr.status in ('HELD','CONFIRMED') and rr.plan_assignment_id is distinct from a.id and rr.starts_at<win_e and rr.ends_at>win_s loop
    select coalesce(sum((rr.committed_capacity->>'weightKg')::numeric),0),coalesce(sum((rr.committed_capacity->>'volumeM3')::numeric),0) into usedw,usedv from public.capacity_reservations rr where rr.capacity_calendar_id=cal.id and rr.plan_assignment_id is distinct from a.id and rr.status in ('HELD','CONFIRMED') and rr.starts_at<=pt and rr.ends_at>pt;
    peakw:=greatest(peakw,usedw);peakv:=greatest(peakv,usedv);
   end loop;capw:=capw-peakw;capv:=capv-peakv;
  end if;
  if not private.workflow_evidence((select data->'limitsEvidence' from public.route_corridors where id=a.corridor_id),win_s,win_e) then pending:=pending||'"CORRIDOR_LIMITS_UNKNOWN"'::jsonb;
  else capw:=least(capw,(select least((data->>'payloadLimitKg')::numeric,(data->>'grossWeightLimitKg')::numeric-(lim.data->>'combinedTareKg')::numeric) from public.route_corridors where id=a.corridor_id));end if;
  if (select data->'usableDimensions' from public.route_corridors where id=a.corridor_id) is null then pending:=pending||'"CORRIDOR_DIMENSIONS_UNKNOWN"'::jsonb;
  else dims:=jsonb_build_object('length',least((dims->>'length')::numeric,(select (data#>>'{usableDimensions,length}')::numeric from public.route_corridors where id=a.corridor_id)),'width',least((dims->>'width')::numeric,(select (data#>>'{usableDimensions,width}')::numeric from public.route_corridors where id=a.corridor_id)),'height',least((dims->>'height')::numeric,(select (data#>>'{usableDimensions,height}')::numeric from public.route_corridors where id=a.corridor_id)));end if;
  if capw is null or capv is null or dims is null then pending:=pending||'"CAPACITY_DIMENSIONS_UNKNOWN"'::jsonb;
  elsif w>capw or v>capv then reasons:=reasons||'"OVER_CAPACITY"'::jsonb;end if;
  for idx in select unit_index from public.load_allocations where assignment_id=a.id loop
   u:=q.v2_snapshot#>'{cargoSpecification,units}'->idx;
   if dims is not null and ((u#>>'{dimensionsCm,length}')::numeric>(dims->>'length')::numeric or (u#>>'{dimensionsCm,width}')::numeric>(dims->>'width')::numeric or (u#>>'{dimensionsCm,height}')::numeric>(dims->>'height')::numeric) then reasons:=reasons||'"PIECE_DIMENSIONS_EXCEEDED"'::jsonb;end if;
  end loop;
  if a.asset_id is not null and not exists(select 1 from public.asset_cargo_capabilities cc where cc.transport_asset_id=asset.id and cc.cargo_category_id=q.cargo_category_id and cc.active and cc.evidence is not null and cc.verified_at<=now() and cc.valid_until>=win_e) then pending:=pending||'"CARGO_CAPABILITY_UNKNOWN"'::jsonb;end if;
  if q.v2_snapshot#>>'{cargoSpecification,temperatureRange,minCelsius}' is not null and not exists(select 1 from public.asset_cargo_capabilities cc where cc.transport_asset_id=asset.id and cc.cargo_category_id=q.cargo_category_id and cc.active and cc.evidence is not null and cc.verified_at<=now() and cc.valid_until>=win_e
   and cc.temperature_min_c<=(q.v2_snapshot#>>'{cargoSpecification,temperatureRange,minCelsius}')::numeric and cc.temperature_max_c>=(q.v2_snapshot#>>'{cargoSpecification,temperatureRange,maxCelsius}')::numeric) then pending:=pending||'"TEMPERATURE_CAPABILITY_UNKNOWN"'::jsonb;end if;
  for req in select jsonb_array_elements_text(q.v2_snapshot#>'{cargoSpecification,requirements}') loop
   if not exists(select 1 from public.asset_cargo_capabilities cc join public.cargo_capability_definitions dd on dd.id=cc.definition_id where cc.transport_asset_id=asset.id and cc.cargo_category_id=q.cargo_category_id and cc.active and dd.active
     and cc.valid_until>=win_e and dd.valid_until>=win_e and dd.requirements ? req and cc.evidence is not null and dd.evidence is not null) then pending:=pending||jsonb_build_array('REQUIREMENT_UNVERIFIED:'||req);end if;
  end loop;
  if cal.provenance_status='SIMULATED' or lim.data#>>'{source,provenanceStatus}'='SIMULATED' or coalesce(asset.evidence,pool.evidence,'') like 'fixture:%' or lane.evidence_reference like 'fixture:%' then provenance:='SIMULATED';end if;
  assessments:=assessments||jsonb_build_array(jsonb_build_object('assignmentId',a.id,'resourceId',a.resource_id,'applicableCapacity',jsonb_build_object('weightKg',greatest(capw,0),'volumeM3',greatest(capv,0),'usableDimensions',dims),
   'verificationSource',jsonb_build_object('calendarId',cal.id,'calendarVersion',cal.version,'limitsId',lim.id,'limitsVersion',lim.version,'corridorId',a.corridor_id,'source',lim.data->'source','laneId',lane.id)));
  if exists(select 1 from public.plan_leg_assignments bb join public.plan_resources rr on rr.id=bb.resource_id where bb.plan_id=p.id and bb.id<>a.id and bb.sequence=a.sequence
   and (rr.calendar_id=cal.id or a.combination_id is not null and rr.asset_id in(select transport_asset_id from public.vehicle_combination_assets where combination_id=a.combination_id))) then reasons:=reasons||'"RESOURCE_DOUBLE_COUNTED"'::jsonb;end if;
 end loop;
 return jsonb_build_object('eligibility',case when jsonb_array_length(reasons)>0 then 'ineligible' when jsonb_array_length(pending)>0 then 'unknown' else 'eligible' end,
  'exclusionReasons',reasons,'pendingRequirements',pending,'evaluatedAt',now(),'provenance',case when jsonb_array_length(reasons)>0 or jsonb_array_length(pending)>0 then 'UNKNOWN' else provenance end,'resourceAssessments',assessments);end;$$;
create or replace function private.workflow_current_plan(i uuid) returns boolean language sql security definer set search_path='' as $$select private.workflow_evaluate_plan(i)->>'eligibility'='eligible';$$;

create function private.workflow_build_plan(o uuid,qid uuid,v jsonb,pid uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare q public.freight_requests;r public.route_plans;a jsonb;l jsonb;u jsonb;leg public.route_legs;svc public.carrier_services;res uuid;assign uuid;
 idx integer;qty integer;w numeric;vol numeric;state jsonb;begin
 q:=private.workflow_request(o,qid);select * into r from public.route_plans where id=(v->>'routeId')::uuid and organization_id=o and freight_request_id=qid;
 if r.id is null then raise exception 'WORKFLOW_NOT_FOUND' using errcode='PT404';end if;
 insert into public.transport_plan_candidates(id,organization_id,freight_request_id,route_plan_id,request_version,status,data) values(pid,o,qid,r.id,q.draft_version,'unknown','{}');
 for a in select value from jsonb_array_elements(v->'assignments') loop
  select * into leg from public.route_legs where route_plan_id=r.id and sequence=(a->>'legSequence')::integer;
  select * into svc from public.carrier_services where id=(a->>'serviceId')::uuid;
  if leg.id is null or svc.id is null then raise exception 'INVALID_PLAN_REFERENCE' using errcode='PT400';end if;
  res:=gen_random_uuid();assign:=gen_random_uuid();
  insert into public.plan_resources(id,plan_id,carrier_id,carrier_service_id,calendar_id,asset_id,capacity_pool_id,combination_id,data) values(res,pid,svc.carrier_id,svc.id,(a->>'calendarId')::uuid,(a->>'assetId')::uuid,(a->>'capacityPoolId')::uuid,(a->>'combinationId')::uuid,
   jsonb_build_object('role',a->'role','equipment',coalesce((select equipment_code from public.transport_assets where id=(a->>'assetId')::uuid),(select equipment_code from public.capacity_pools where id=(a->>'capacityPoolId')::uuid)),'units',1,'window',a->'window','availability','UNKNOWN','applicableCapacity',null,'verificationSource',null));
  insert into public.plan_leg_assignments(id,plan_id,route_leg_id,resource_id,carrier_service_id,lane_id,sequence,starts_at,ends_at,data) values(assign,pid,leg.id,res,svc.id,(a->>'laneId')::uuid,leg.sequence,(a#>>'{window,startsAt}')::timestamptz,(a#>>'{window,endsAt}')::timestamptz,'{}');
  w:=0;vol:=0;
  for l in select value from jsonb_array_elements(a->'allocations') loop
   idx:=(l->>'unitIndex')::integer;qty:=(l->>'quantity')::integer;u:=q.v2_snapshot#>'{cargoSpecification,units}'->idx;
   if u is null or qty<1 or qty>(u->>'quantity')::integer then raise exception 'INVALID_LOAD_ALLOCATION' using errcode='PT400';end if;
   insert into public.load_allocations(assignment_id,unit_index,quantity,assigned_weight_kg,assigned_volume_m3,data) values(assign,idx,qty,qty*(u->>'weightPerUnitKg')::numeric,qty*(u->>'volumePerUnitM3')::numeric,
    jsonb_build_object('handlingRequirements',q.v2_snapshot#>'{cargoSpecification,requirements}','verification','UNKNOWN','indivisible',u->'indivisible','dimensionsCm',u->'dimensionsCm'));
   w:=w+qty*(u->>'weightPerUnitKg')::numeric;vol:=vol+qty*(u->>'volumePerUnitM3')::numeric;
  end loop;
  update public.plan_leg_assignments set data=jsonb_build_object('sequence',leg.sequence,'window',a->'window','responsibility',jsonb_build_object('carrierId',svc.carrier_id,'serviceId',svc.id),
   'coverage','UNKNOWN','availability','UNKNOWN','capacityNeeded',jsonb_build_object('weightKg',w,'volumeM3',vol),'evidence','[]'::jsonb) where id=assign;
 end loop;
 state:=private.workflow_evaluate_plan(pid);
 update public.plan_resources rr set data=rr.data||jsonb_build_object('availability',state->>'provenance','applicableCapacity',a.value->'applicableCapacity','verificationSource',a.value->'verificationSource')
  from jsonb_array_elements(state->'resourceAssessments') a where rr.plan_id=pid and rr.id=(a.value->>'resourceId')::uuid;
 update public.plan_leg_assignments set data=data||jsonb_build_object('coverage',state->>'provenance','availability',state->>'provenance') where plan_id=pid;
 update public.load_allocations set data=data||jsonb_build_object('verification',state->>'provenance') where assignment_id in(select id from public.plan_leg_assignments where plan_id=pid);
 update public.transport_plan_candidates set status=state->>'eligibility',data=state||jsonb_build_object('routeId',r.id,'requestVersion',q.draft_version,
  'proposedWindow',jsonb_build_object('startsAt',q.pickup_window_start,'endsAt',q.delivery_window_end),'coverage',state->>'provenance','availability',state->>'provenance',
  'assignments',(select jsonb_agg(aa.data||jsonb_build_object('id',aa.id,'resourceId',aa.resource_id,'serviceId',aa.carrier_service_id,'carrierId',rr.carrier_id,'resource',rr.data||jsonb_build_object('assetId',rr.asset_id,'poolId',rr.capacity_pool_id,'calendarId',rr.calendar_id,'combinationId',rr.combination_id),'allocations',coalesce((select jsonb_agg(ll.data||jsonb_build_object('unitIndex',ll.unit_index,'quantity',ll.quantity,'assignedWeightKg',ll.assigned_weight_kg,'assignedVolumeM3',ll.assigned_volume_m3)) from public.load_allocations ll where ll.assignment_id=aa.id),'[]'::jsonb))) from public.plan_leg_assignments aa join public.plan_resources rr on rr.id=aa.resource_id where aa.plan_id=pid)) where id=pid;
 return private.workflow_record('plans',pid);end;$$;

create function private.workflow_offer_capacity(i uuid) returns boolean language plpgsql security definer set search_path='' as $$
declare oo public.v2_carrier_offers;pt timestamptz;w numeric;v numeric;begin
 select * into oo from public.v2_carrier_offers where id=i;
 if oo.data->'reservableCapacity'='null'::jsonb or oo.data#>>'{reservableCapacity,volumeM3}' is null then return false;end if;
 for pt in select starts_at from public.plan_leg_assignments where plan_id=oo.plan_id and oo.data->'coveredAssignmentIds' ? id::text loop
  select coalesce(sum((data#>>'{capacityNeeded,weightKg}')::numeric),0),coalesce(sum((data#>>'{capacityNeeded,volumeM3}')::numeric),0) into w,v from public.plan_leg_assignments
   where plan_id=oo.plan_id and oo.data->'coveredAssignmentIds' ? id::text and starts_at<=pt and ends_at>pt;
  if w>(oo.data#>>'{reservableCapacity,weightKg}')::numeric or v>(oo.data#>>'{reservableCapacity,volumeM3}')::numeric then return false;end if;
 end loop;return true;end;$$;
create function private.workflow_offer_current(i uuid) returns boolean language plpgsql security definer set search_path='' as $$declare r public.v2_carrier_offers;begin
 select * into r from public.v2_carrier_offers where id=i;
 return coalesce(r.status='RECEIVED' and (r.data->>'issuedAt')::timestamptz<=now() and (r.data#>>'{validity,startsAt}')::timestamptz<=now()
  and (r.data#>>'{validity,endsAt}')::timestamptz>now() and not exists(select 1 from jsonb_array_elements(r.data->'breakdown') x where x->>'treatment' in ('UNKNOWN','ESTIMATED','EXCLUDED'))
  and private.workflow_evidence(r.data#>'{source,evidence}',(r.data#>>'{validity,startsAt}')::timestamptz,now())
  and not exists(select 1 from jsonb_array_elements(r.data->'breakdown') x where not private.workflow_evidence(x->'source',(r.data#>>'{validity,startsAt}')::timestamptz,now()))
  and private.workflow_offer_capacity(r.id) and private.workflow_current_plan(r.plan_id),false);end;$$;
create function private.workflow_offer(o uuid,m uuid,c uuid,oppid uuid,v jsonb,i uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare opp public.carrier_opportunities;p public.transport_plan_candidates;old public.v2_carrier_offers;a uuid;svc uuid;sumc numeric;ver integer:=1;
services jsonb;payload jsonb;begin
 perform private.workflow_carrier(c);select * into opp from public.carrier_opportunities where id=oppid and carrier_id=c;
 if opp.id is null then raise exception 'WORKFLOW_NOT_FOUND' using errcode='PT404';end if;
 if opp.status not in ('SENT','ACCEPTED','OFFERED') or (opp.data->>'responseDeadline')::timestamptz<=now() then raise exception 'OPPORTUNITY_NOT_OPEN' using errcode='PT409';end if;
 if (v->>'planCandidateId')::uuid<>opp.parent_id then raise exception 'OFFER_CONTEXT_MISMATCH' using errcode='PT400';end if;
 if not ((v->'coveredAssignmentIds') <@ (opp.data->'assignmentIds')) or jsonb_array_length(v->'coveredAssignmentIds')<>(select count(distinct value) from jsonb_array_elements_text(v->'coveredAssignmentIds')) then raise exception 'OFFER_ASSIGNMENT_MISMATCH' using errcode='PT400';end if;
 for a in select value::uuid from jsonb_array_elements_text(v->'coveredAssignmentIds') loop
  if not exists(select 1 from public.plan_leg_assignments aa join public.plan_resources rr on rr.id=aa.resource_id where aa.id=a and aa.plan_id=opp.parent_id and rr.carrier_id=c) then raise exception 'OFFER_ASSIGNMENT_MISMATCH' using errcode='PT400';end if;
 end loop;
 select jsonb_agg(distinct aa.carrier_service_id) into services from public.plan_leg_assignments aa where aa.id in(select value::uuid from jsonb_array_elements_text(v->'coveredAssignmentIds'));
 if not (services @> (v->'coveredServiceIds') and services <@ (v->'coveredServiceIds')) or jsonb_array_length(v->'coveredServiceIds')<>jsonb_array_length(services) then raise exception 'OFFER_SERVICE_MISMATCH' using errcode='PT400';end if;
 select sum(case when x->>'kind'='DISCOUNT' then -1 else 1 end*round((x#>>'{amount,amount}')::numeric*100)) into sumc from jsonb_array_elements(v->'breakdown') x where x->>'treatment'='QUOTED';
 if sumc is null or sumc<>round((v#>>'{price,amount}')::numeric*100) or (v#>>'{price,amount}')::numeric<=0 or (v#>>'{price,amount}')::numeric*100<>round((v#>>'{price,amount}')::numeric*100)
 or exists(select 1 from jsonb_array_elements(v->'breakdown') comp where comp#>>'{amount,amount}' is not null and (comp#>>'{amount,amount}')::numeric*100<>round((comp#>>'{amount,amount}')::numeric*100))
 or exists(select 1 from jsonb_array_elements(v->'breakdown') x where x->>'treatment' in ('QUOTED','INCLUDED') and x->'amount'='null'::jsonb) then raise exception 'OFFER_BREAKDOWN_MISMATCH' using errcode='PT400';end if;
 if (v#>>'{validity,endsAt}')::timestamptz<=(v#>>'{validity,startsAt}')::timestamptz or (v->>'issuedAt')::timestamptz>now()
  or (v->>'estimatedDeliveryAt') is not null and (v->>'estimatedPickupAt') is not null and (v->>'estimatedDeliveryAt')::timestamptz<=(v->>'estimatedPickupAt')::timestamptz then raise exception 'VALIDATION_ERROR' using errcode='PT400';end if;
 if v->>'supersedesOfferId' is not null then
  select * into old from public.v2_carrier_offers where id=(v->>'supersedesOfferId')::uuid and parent_id=oppid and carrier_id=c for update;
  if old.id is null or old.status<>'RECEIVED' or exists(select 1 from public.selection_offers so join public.selection_decisions d on d.id=so.decision_id where so.offer_id=old.id and d.status='SELECTED') then raise exception 'OFFER_CANNOT_SUPERSEDE' using errcode='PT409';end if;
  ver:=(old.data->>'offerVersion')::integer+1;update public.v2_carrier_offers set status='SUPERSEDED',version=version+1,updated_at=now() where id=old.id;
 end if;
 payload:=v-'schemaVersion'||jsonb_build_object('id',i,'requestId',opp.freight_request_id,'opportunityId',opp.id,'carrierId',c,'offerVersion',ver,'status','RECEIVED',
  'source',v->'source'||jsonb_build_object('issuerId',m));
 insert into public.v2_carrier_offers(id,organization_id,carrier_id,freight_request_id,parent_id,status,plan_id,supersedes_offer_id,data) values(i,opp.organization_id,c,opp.freight_request_id,oppid,'RECEIVED',opp.parent_id,(v->>'supersedesOfferId')::uuid,payload);
 update public.carrier_opportunities set status='OFFERED',version=version+1,updated_at=now() where id=oppid;
 return private.workflow_record('offers',i);end;$$;

create function private.workflow_ranking(o uuid,qid uuid,policy uuid,i uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare pp public.scoring_policies;r public.v2_carrier_offers;m public.v2_carrier_metrics;reason text;weights jsonb;excluded jsonb:='[]';
 eligible jsonb:='[]';entry jsonb;bundle jsonb;states jsonb;next_states jsonb;covered jsonb;all_required jsonb;planid uuid;
 total_cost numeric;transit numeric;reliability numeric;minc numeric;maxc numeric;mint numeric;maxt numeric;options jsonb;
begin
 perform private.workflow_request(o,qid);select * into pp from public.scoring_policies where id=policy and status='ACTIVE';
 if pp.id is null then raise exception 'WORKFLOW_NOT_FOUND' using errcode='PT404';end if;
 weights:=pp.data#>'{policy,weights}';
 insert into public.v2_rankings(id,organization_id,freight_request_id,policy_id,status,data) values(i,o,qid,policy,'MATERIALIZED','{}');
 for r in select * from public.v2_carrier_offers where organization_id=o and freight_request_id=qid order by id loop
  reason:=null;select * into m from public.v2_carrier_metrics where carrier_id=r.carrier_id and (data#>>'{period,endsAt}')::timestamptz<=now()
   and (data->>'sampleSize')::integer>0 and data->>'corridorId' is null and data->>'mode'='ROAD'
   and private.workflow_evidence(data->'source',(data#>>'{period,startsAt}')::timestamptz,now()) order by created_at desc,id limit 1;
  if not private.workflow_current_plan(r.plan_id) then reason:='PLAN_NOT_ELIGIBLE';
  elsif not private.workflow_offer_current(r.id) then reason:='OFFER_NOT_CURRENT_OR_COMPARABLE';
  elsif (weights->>'transit')::numeric>0 and r.data->>'transitDurationSeconds' is null then reason:='TRANSIT_UNKNOWN';
  elsif (weights->>'reliability')::numeric>0 and (m.id is null or m.data->>'onTimeRate' is null) then reason:='RELIABILITY_UNKNOWN';end if;
  if reason is null then eligible:=eligible||jsonb_build_array(jsonb_build_object('offerId',r.id,'planId',r.plan_id,'assignments',r.data->'coveredAssignmentIds',
    'costCents',round((r.data#>>'{price,amount}')::numeric*100),'transit',r.data->'transitDurationSeconds','reliability',m.data->'onTimeRate','metricId',m.id));
  else excluded:=excluded||jsonb_build_array(jsonb_build_object('offerId',r.id,'reason',reason));end if;
 end loop;
 -- Exhaustive disjoint covers in stable offer UUID order. A declared complexity limit fails the command,
 -- never silently drops candidates or promises an optimum over an incomplete universe.
 for planid in select distinct (x->>'planId')::uuid from jsonb_array_elements(eligible) x loop
  select jsonb_agg(id order by id) into all_required from public.plan_leg_assignments where plan_id=planid;
  states:=jsonb_build_array(jsonb_build_object('offerIds','[]'::jsonb,'assignments','[]'::jsonb,'costCents',0,'transit',0,'reliability',1,'metrics','[]'::jsonb));
  for entry in select value from jsonb_array_elements(eligible) where (value->>'planId')::uuid=planid order by value->>'offerId' loop
   next_states:=states;
   for bundle in select value from jsonb_array_elements(states) loop
    if not exists(select 1 from jsonb_array_elements_text(bundle->'assignments') x where entry->'assignments' ? x.value) then
     next_states:=next_states||jsonb_build_array(jsonb_build_object('offerIds',bundle->'offerIds'||jsonb_build_array(entry->'offerId'),
      'assignments',(bundle->'assignments')||(entry->'assignments'),'costCents',(bundle->>'costCents')::numeric+(entry->>'costCents')::numeric,
      'transit',case when entry->>'transit' is null or bundle->>'transit' is null then null else (bundle->>'transit')::numeric+(entry->>'transit')::numeric end,
      'reliability',case when entry->>'reliability' is null or bundle->>'reliability' is null then null else least((bundle->>'reliability')::numeric,(entry->>'reliability')::numeric) end,
      'metrics',bundle->'metrics'||jsonb_build_array(entry->'metricId')));
    end if;
   end loop;
   if jsonb_array_length(next_states)>65536 then raise exception 'RANKING_COMPLEXITY_LIMIT' using errcode='PT409';end if;states:=next_states;
  end loop;
  for bundle in select value from jsonb_array_elements(states) where value->'assignments' @> all_required and value->'assignments' <@ all_required loop
   insert into public.ranked_options(ranking_id,offer_id,bundle_key,data) values(i,(bundle#>>'{offerIds,0}')::uuid,(bundle->'offerIds')::text,
    bundle||jsonb_build_object('planId',planid,'policyVersion',pp.data#>'{policy,version}','transitAggregation','SUM_ISSUER_DURATIONS','reliabilityAggregation','MIN_CARRIER_ON_TIME'));
  end loop;
  if not exists(select 1 from public.ranked_options where ranking_id=i and (data->>'planId')::uuid=planid) then excluded:=excluded||jsonb_build_array(jsonb_build_object('planId',planid,'reason','INCOMPLETE_OFFER_COVERAGE'));end if;
 end loop;
 select min((data->>'costCents')::numeric),max((data->>'costCents')::numeric),min((data->>'transit')::numeric),max((data->>'transit')::numeric) into minc,maxc,mint,maxt from public.ranked_options where ranking_id=i;
 update public.ranked_options set score=(case when maxc=minc then 1 else (maxc-(data->>'costCents')::numeric)/(maxc-minc) end)*(weights->>'cost')::numeric
  +(case when data->>'transit' is null then 0 when maxt=mint then 1 else (maxt-(data->>'transit')::numeric)/(maxt-mint) end)*(weights->>'transit')::numeric
  +coalesce((data->>'reliability')::numeric,0)*(weights->>'reliability')::numeric,
  data=data||jsonb_build_object('explanation',jsonb_build_object('weights',weights,'dimensions',jsonb_build_object('cost',case when maxc=minc then 1 else (maxc-(data->>'costCents')::numeric)/(maxc-minc) end,
   'transit',case when data->>'transit' is null then null when maxt=mint then 1 else (maxt-(data->>'transit')::numeric)/(maxt-mint) end,'reliability',data->'reliability')),'missingData','[]'::jsonb) where ranking_id=i;
 with ranks as(select id,row_number() over(order by score desc,bundle_key) n from public.ranked_options where ranking_id=i)
 update public.ranked_options rr set position=ranks.n from ranks where rr.id=ranks.id;
 select coalesce(jsonb_agg(data||jsonb_build_object('offerId',offer_id,'score',score,'position',position) order by position),'[]') into options from public.ranked_options where ranking_id=i;
 update public.v2_rankings set data=jsonb_build_object('policyVersion',pp.data#>'{policy,version}','policyId',policy,'options',options,'excluded',excluded,'evaluatedAt',now(),
  'algorithmVersion','DISJOINT_COVER_V1','universe','CURRENT_PERSISTED_OFFERS','completeWithinUniverse',true) where id=i;
 return private.workflow_record('ranking',i);end;$$;

create function private.workflow_selection(o uuid,m uuid,qid uuid,v jsonb,i uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.transport_plan_candidates;r public.v2_carrier_offers;oid uuid;cover uuid;covered uuid[]:='{}';required integer;begin
 perform private.workflow_request(o,qid);select * into p from public.transport_plan_candidates where id=(v->>'planId')::uuid and organization_id=o and freight_request_id=qid;
 if not exists(select 1 from public.freight_requests where id=qid and organization_id=o and status='PENDING') then raise exception 'SUBMITTED_REQUEST_REQUIRED' using errcode='PT409';end if;
 if p.id is null then raise exception 'WORKFLOW_NOT_FOUND' using errcode='PT404';end if;
 if not private.workflow_current_plan(p.id) then raise exception 'PLAN_NOT_ELIGIBLE' using errcode='PT409';end if;
 if v->>'policyId' is not null and not exists(select 1 from public.scoring_policies where id=(v->>'policyId')::uuid and status='ACTIVE') then raise exception 'WORKFLOW_NOT_FOUND' using errcode='PT404';end if;
 for oid in select value::uuid from jsonb_array_elements_text(v->'selectedOfferIds') loop
  select * into r from public.v2_carrier_offers where id=oid and organization_id=o and freight_request_id=qid and plan_id=p.id;
  if r.id is null or not private.workflow_offer_current(oid) then raise exception 'OFFER_NOT_CURRENT' using errcode='PT409';end if;
  for cover in select value::uuid from jsonb_array_elements_text(r.data->'coveredAssignmentIds') loop
   if cover=any(covered) then raise exception 'OVERLAPPING_OFFER_COVERAGE' using errcode='PT400';end if;covered:=array_append(covered,cover);
  end loop;
 end loop;
 select count(*) into required from public.plan_leg_assignments where plan_id=p.id;
 if cardinality(covered)<>required or exists(select 1 from public.plan_leg_assignments where plan_id=p.id and not(id=any(covered))) then raise exception 'INCOMPLETE_OFFER_COVERAGE' using errcode='PT400';end if;
 if jsonb_array_length(v->'selectedOfferIds')<>(select count(distinct value) from jsonb_array_elements_text(v->'selectedOfferIds')) then raise exception 'INVALID_OFFER_SELECTION' using errcode='PT400';end if;
 if exists(select 1 from jsonb_array_elements_text(v->'consideredOfferIds') x where not exists(select 1 from public.v2_carrier_offers where id=x.value::uuid and organization_id=o and freight_request_id=qid)) then raise exception 'INVALID_CONSIDERED_OFFER' using errcode='PT400';end if;
 insert into public.selection_decisions(id,organization_id,freight_request_id,status,plan_id,selected_by,data) values(i,o,qid,'SELECTED',p.id,m,
  v-'schemaVersion'||jsonb_build_object('selectedAt',now(),'selectedBy',m,'selectedPlanId',p.id,'status','SELECTED','policyVersion',(select data#>'{policy,version}' from public.scoring_policies where id=(v->>'policyId')::uuid)));
 insert into public.selection_offers(decision_id,offer_id) select i,value::uuid from jsonb_array_elements_text(v->'selectedOfferIds');return private.workflow_record('decisions',i);end;$$;

-- Releases are compound local commands; external provider cancellation remains a separate adapter result.
create function private.workflow_release_execution(i uuid) returns void language plpgsql security definer set search_path='' as $$begin
 update public.driver_assignments set status='RELEASED',version=version+1,updated_at=now() where execution_id=i and status in ('PROPOSED','CONFIRMED');
 update public.vehicle_assignments set status='RELEASED',version=version+1,updated_at=now() where execution_id=i and status in ('PROPOSED','CONFIRMED');
 update public.capacity_reservations set status='RELEASED',version=version+1,updated_at=now() where execution_id=i and status in ('HELD','CONFIRMED');
 -- Movement invalidates the former ready-pickup assertion. Reconfirm availability/location through
 -- an evidenced calendar command; releasing a commitment does not teleport the physical resource.
 if exists(select 1 from public.transport_executions where id=i and status='IN_PROGRESS') then
  update public.capacity_calendars cc set complete=false,provenance_status='UNKNOWN',observed_at=now(),valid_until=null
   where cc.id in(select capacity_calendar_id from public.capacity_reservations where execution_id=i)
   and not exists(select 1 from public.capacity_reservations rr where rr.capacity_calendar_id=cc.id and rr.status in ('HELD','CONFIRMED'));
 end if;
end;$$;
create function private.workflow_release_booking(i uuid,allow_running boolean) returns void language plpgsql security definer set search_path='' as $$declare e uuid;begin
 if not allow_running and exists(select 1 from public.transport_executions where booking_id=i and status='IN_PROGRESS') then raise exception 'EXECUTION_IN_PROGRESS' using errcode='PT409';end if;
 for e in select id from public.transport_executions where booking_id=i and status in ('PLANNED','IN_PROGRESS') order by id loop
  perform private.workflow_release_execution(e);
  update public.transport_executions set status='CANCELLED',version=version+1,updated_at=now() where id=e;
 end loop;
 update public.capacity_reservations set status='RELEASED',version=version+1,updated_at=now() where booking_id=i and status in ('HELD','CONFIRMED');
end;$$;
create function private.workflow_expire_holds() returns void language plpgsql security definer set search_path='' as $$begin
 update public.capacity_reservations set status='RELEASED',version=version+1,updated_at=now() where booking_id is not null and status='HELD' and expires_at<=now();end;$$;

create function private.workflow_same_trip(a uuid,b uuid) returns boolean language sql stable security definer set search_path='' as $$
select exists(select 1 from public.transport_executions aa join public.transport_executions bb on bb.consolidation_id=aa.consolidation_id
 join public.capacity_consolidations cc on cc.id=aa.consolidation_id where aa.id=a and bb.id=b and aa.carrier_id=bb.carrier_id
 and aa.carrier_service_id=bb.carrier_service_id and cc.status='OPEN' and private.workflow_evidence(cc.data->'evidence',aa.planned_starts_at,aa.planned_ends_at));$$;
create function private.workflow_trip_compatible(batch uuid,pid uuid,sid uuid,calid uuid,s timestamptz,t timestamptz) returns boolean language sql stable security definer set search_path='' as $$
select exists(select 1 from public.capacity_consolidations cc join public.route_plans rr on rr.id=cc.route_id
 join public.transport_plan_candidates pp on pp.id=pid join public.route_plans pr on pr.id=pp.route_plan_id
 join public.freight_requests fq on fq.id=pp.freight_request_id join public.carrier_services ss on ss.id=cc.carrier_service_id where cc.id=batch and cc.status='OPEN' and cc.carrier_service_id=sid and cc.calendar_id=calid
 and cc.data->'cargoCategoryIds' ? fq.cargo_category_id::text and coalesce(fq.v2_snapshot#>'{cargoSpecification,requirements}','[]'::jsonb) <@ (cc.data->'compatibleRequirementCodes') and ss.service_type='LTL' and ss.transport_mode='ROAD' and rr.data->'corridorIds'=pr.data->'corridorIds'

 and (cc.data#>>'{window,startsAt}')::timestamptz<=s and (cc.data#>>'{window,endsAt}')::timestamptz>=t and private.workflow_evidence(cc.data->'evidence',s,t));$$;
create function private.workflow_reservation_sharing() returns trigger language plpgsql security definer set search_path='' as $$
declare cal public.capacity_calendars;svc public.carrier_services;w numeric;v numeric;maxw numeric;maxv numeric;pt timestamptz;pid uuid;begin
 if new.status not in ('HELD','CONFIRMED') then return new;end if;
 select * into cal from public.capacity_calendars where id=new.capacity_calendar_id for update;select * into svc from public.carrier_services where id=cal.carrier_service_id;
 if exists(select 1 from public.capacity_reservations rr where rr.id<>new.id and rr.capacity_calendar_id=cal.id and rr.status in ('HELD','CONFIRMED') and tstzrange(rr.starts_at,rr.ends_at,'[)')&&tstzrange(new.starts_at,new.ends_at,'[)')
  and (new.consolidation_id is null or rr.consolidation_id is null or rr.consolidation_id<>new.consolidation_id)) then if new.consolidation_id is null and not exists(select 1 from public.capacity_reservations other_res where other_res.id<>new.id and other_res.capacity_calendar_id=cal.id and other_res.consolidation_id is not null and other_res.status in ('HELD','CONFIRMED') and tstzrange(other_res.starts_at,other_res.ends_at,'[)')&&tstzrange(new.starts_at,new.ends_at,'[)')) then raise exception 'FLEET_COMMITMENT_CONFLICT' using errcode='23P01';else raise exception 'FLEET_COMMITMENT_CONFLICT' using errcode='PT409';end if;end if;
 if new.parent_reservation_id is not null then
  if not exists(select 1 from public.capacity_reservations root_res join public.plan_leg_assignments aa on aa.id=root_res.plan_assignment_id join public.plan_resources pr on pr.id=aa.resource_id join public.vehicle_combination_assets mm on mm.combination_id=pr.combination_id
   where root_res.id=new.parent_reservation_id and root_res.id<>new.id and root_res.booking_id=new.booking_id and root_res.plan_assignment_id=new.plan_assignment_id and root_res.execution_id=new.execution_id and root_res.consolidation_id is not distinct from new.consolidation_id
   and root_res.starts_at=new.starts_at and root_res.ends_at=new.ends_at and mm.transport_asset_id=cal.transport_asset_id and new.committed_capacity=jsonb_build_object('weightKg',0,'volumeM3',0)) then raise exception 'INVALID_GROUP_COMMITMENT' using errcode='PT400';end if;
  return new;
 end if;
 if new.consolidation_id is null then return new;end if;
 select plan_id into pid from public.plan_leg_assignments where id=new.plan_assignment_id;
 if new.committed_capacity is null or new.booking_id is null or new.execution_id is null or not private.workflow_trip_compatible(new.consolidation_id,pid,svc.id,cal.id,new.starts_at,new.ends_at)
  or not exists(select 1 from public.transport_executions where id=new.execution_id and consolidation_id=new.consolidation_id)
  or not exists(select 1 from public.v2_bookings bb join public.v2_carrier_offers oo on oo.id=bb.offer_id where bb.id=new.booking_id and oo.plan_id=pid and bb.freight_request_id=new.freight_request_id and bb.carrier_id=svc.carrier_id)
  then raise exception 'INVALID_CONSOLIDATION_COMMITMENT' using errcode='PT400';end if;
 select least(a.max_weight_kg,svc.max_capacity_kg),least(a.max_volume_m3,svc.max_volume_m3) into maxw,maxv from public.transport_assets a where a.id=cal.transport_asset_id;
 if maxw is null or maxv is null then raise exception 'FLEET_EVIDENCE_REQUIRED' using errcode='PT409';end if;
 if not exists(select 1 from public.route_resource_limits ll join public.route_legs rl on rl.corridor_id=ll.corridor_id join public.capacity_consolidations cc on cc.route_id=rl.route_plan_id where cc.id=new.consolidation_id and ll.carrier_service_id=svc.id and (ll.asset_id=cal.transport_asset_id or exists(select 1 from public.vehicle_combination_assets mm where mm.combination_id=ll.combination_id and mm.transport_asset_id=cal.transport_asset_id)) and ll.status='ACTIVE' and private.workflow_evidence(ll.data->'source',new.starts_at,new.ends_at)) then raise exception 'FLEET_EVIDENCE_REQUIRED' using errcode='PT409';end if;
 -- Effective manufacturer/jurisdiction limits must constrain the shared peak too.
 select least(maxw,min(least((ll.data->>'manufacturerPayloadLimitKg')::numeric,(ll.data->>'routeGrossLimitKg')::numeric-(ll.data->>'combinedTareKg')::numeric,(select (ccorr.data->>'payloadLimitKg')::numeric from public.route_corridors ccorr where ccorr.id=ll.corridor_id),(select (ccorr.data->>'grossWeightLimitKg')::numeric-(ll.data->>'combinedTareKg')::numeric from public.route_corridors ccorr where ccorr.id=ll.corridor_id)))),least(maxv,min((ll.data->>'usableVolumeM3')::numeric)) into maxw,maxv
 from public.route_resource_limits ll join public.route_legs rl on rl.corridor_id=ll.corridor_id join public.capacity_consolidations cc on cc.route_id=rl.route_plan_id
 where cc.id=new.consolidation_id and ll.carrier_service_id=svc.id and (ll.asset_id=cal.transport_asset_id or exists(select 1 from public.vehicle_combination_assets mm where mm.combination_id=ll.combination_id and mm.transport_asset_id=cal.transport_asset_id)) and ll.status='ACTIVE' and private.workflow_evidence(ll.data->'source',new.starts_at,new.ends_at);
 if maxw is null or maxv is null then raise exception 'FLEET_EVIDENCE_REQUIRED' using errcode='PT409';end if;
 for pt in select new.starts_at union select greatest(rr.starts_at,new.starts_at) from public.capacity_reservations rr where rr.id<>new.id and rr.capacity_calendar_id=cal.id and rr.status in ('HELD','CONFIRMED') and rr.starts_at<new.ends_at and rr.ends_at>new.starts_at loop
  select coalesce(sum((rr.committed_capacity->>'weightKg')::numeric),0),coalesce(sum((rr.committed_capacity->>'volumeM3')::numeric),0) into w,v from public.capacity_reservations rr where rr.id<>new.id and rr.capacity_calendar_id=cal.id and rr.status in ('HELD','CONFIRMED') and rr.starts_at<=pt and rr.ends_at>pt;
  if w+(new.committed_capacity->>'weightKg')::numeric>maxw or v+(new.committed_capacity->>'volumeM3')::numeric>maxv then raise exception 'LTL_RESIDUAL_CAPACITY_EXCEEDED' using errcode='PT409';end if;
 end loop;return new;end;$$;
create trigger z_workflow_reservation_sharing before insert or update on public.capacity_reservations for each row execute function private.workflow_reservation_sharing();

create function private.workflow_combination_commitment(resid uuid,combo uuid,weight numeric,volume numeric) returns boolean language plpgsql security definer set search_path='' as $$declare r public.capacity_reservations;a public.plan_leg_assignments;p public.plan_resources;begin
 select * into r from public.capacity_reservations where id=resid;select * into a from public.plan_leg_assignments where id=r.plan_assignment_id;select * into p from public.plan_resources where id=a.resource_id;
 return coalesce(r.status='CONFIRMED' and p.combination_id=combo and weight<=(a.data#>>'{capacityNeeded,weightKg}')::numeric and volume<=(a.data#>>'{capacityNeeded,volumeM3}')::numeric and private.workflow_current_plan(a.plan_id),false);end;$$;



create function private.workflow_carrier_status_guard() returns trigger language plpgsql security definer set search_path='' as $$begin
 if new.status is distinct from old.status then
  perform 1 from public.carrier_services where carrier_id=new.id order by id for update;
  if new.status<>'ACTIVE' and exists(select 1 from public.capacity_reservations rr join public.v2_bookings bb on bb.id=rr.booking_id where bb.carrier_id=new.id and rr.status in ('HELD','CONFIRMED')) then raise exception 'CARRIER_HAS_COMMITMENTS' using errcode='PT409';end if;
 end if;return new;end;$$;
create trigger z_workflow_carrier_status_guard before update on public.carriers for each row execute function private.workflow_carrier_status_guard();
create function private.workflow_validate(a text,v jsonb) returns void language plpgsql set search_path='' as $$declare s json;begin case a
when 'nodes.publish' then s:='{"type":"object","properties":{"schemaVersion":{"type":"string","const":"2.0"},"active":{"type":"boolean"},"kind":{"type":"string","enum":["PORT","TERMINAL","BORDER","HUB"]},"name":{"type":"string","minLength":1,"maxLength":2000,"pattern":"\\S"},"location":{"type":"object","properties":{"label":{"type":"string","minLength":1,"pattern":"\\S"},"countryCode":{"type":"string","pattern":"^[A-Z]{2}$"},"region":{"type":["string","null"]},"city":{"type":"string","minLength":1,"pattern":"\\S"},"lat":{"anyOf":[{"type":"number","minimum":-90,"maximum":90},{"type":"null"}]},"lng":{"anyOf":[{"type":"number","minimum":-180,"maximum":180},{"type":"null"}]}},"required":["label","countryCode","region","city","lat","lng"],"additionalProperties":false},"jurisdiction":{"anyOf":[{"type":"string","minLength":1,"maxLength":2000,"pattern":"\\S"},{"type":"null"}]},"source":{"type":"object","properties":{"reference":{"type":"string","minLength":1,"maxLength":500,"pattern":"\\S"},"provider":{"type":"string","minLength":1,"maxLength":150,"pattern":"\\S"},"observedAt":{"type":"string","format":"date-time"},"validUntil":{"anyOf":[{"type":"string","format":"date-time"},{"type":"null"}]},"provenanceStatus":{"type":"string","enum":["VERIFIED","ESTIMATED","SIMULATED","UNKNOWN"]}},"required":["reference","provider","observedAt","validUntil","provenanceStatus"],"additionalProperties":false},"verifiedAt":{"anyOf":[{"type":"string","format":"date-time"},{"type":"null"}]}},"required":["schemaVersion","active","kind","name","location","jurisdiction","source","verifiedAt"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}'::json;
when 'corridors.publish' then s:='{"type":"object","properties":{"schemaVersion":{"type":"string","const":"2.0"},"active":{"type":"boolean"},"originNodeId":{"type":"string","format":"uuid"},"destinationNodeId":{"type":"string","format":"uuid"},"mode":{"type":"string","enum":["ROAD","RAIL","SEA","AIR"]},"estimatedDistanceKm":{"anyOf":[{"type":"number","minimum":0},{"type":"null"}]},"estimatedDurationSeconds":{"anyOf":[{"type":"number","exclusiveMinimum":0},{"type":"null"}]},"restrictions":{"type":"array","items":{"type":"object","properties":{"code":{"type":"string","minLength":1,"maxLength":2000,"pattern":"\\S"},"description":{"type":"string","minLength":1,"maxLength":2000,"pattern":"\\S"},"required":{"type":"boolean"},"evidence":{"anyOf":[{"type":"object","properties":{"reference":{"type":"string","minLength":1,"maxLength":500,"pattern":"\\S"},"provider":{"type":"string","minLength":1,"maxLength":150,"pattern":"\\S"},"observedAt":{"type":"string","format":"date-time"},"validUntil":{"anyOf":[{"type":"string","format":"date-time"},{"type":"null"}]},"provenanceStatus":{"type":"string","enum":["VERIFIED","ESTIMATED","SIMULATED","UNKNOWN"]}},"required":["reference","provider","observedAt","validUntil","provenanceStatus"],"additionalProperties":false},{"type":"null"}]}},"required":["code","description","required","evidence"],"additionalProperties":false},"maxItems":100},"source":{"type":"object","properties":{"reference":{"type":"string","minLength":1,"maxLength":500,"pattern":"\\S"},"provider":{"type":"string","minLength":1,"maxLength":150,"pattern":"\\S"},"observedAt":{"type":"string","format":"date-time"},"validUntil":{"anyOf":[{"type":"string","format":"date-time"},{"type":"null"}]},"provenanceStatus":{"type":"string","enum":["VERIFIED","ESTIMATED","SIMULATED","UNKNOWN"]}},"required":["reference","provider","observedAt","validUntil","provenanceStatus"],"additionalProperties":false},"version":{"type":"string","minLength":1,"maxLength":2000,"pattern":"\\S"},"validUntil":{"anyOf":[{"type":"string","format":"date-time"},{"type":"null"}]},"grossWeightLimitKg":{"anyOf":[{"type":"number","exclusiveMinimum":0},{"type":"null"}]},"payloadLimitKg":{"anyOf":[{"type":"number","exclusiveMinimum":0},{"type":"null"}]},"usableDimensions":{"anyOf":[{"type":"object","properties":{"length":{"type":"number","exclusiveMinimum":0},"width":{"type":"number","exclusiveMinimum":0},"height":{"type":"number","exclusiveMinimum":0}},"required":["length","width","height"],"additionalProperties":false},{"type":"null"}]},"limitsEvidence":{"anyOf":[{"type":"object","properties":{"reference":{"type":"string","minLength":1,"maxLength":500,"pattern":"\\S"},"provider":{"type":"string","minLength":1,"maxLength":150,"pattern":"\\S"},"observedAt":{"type":"string","format":"date-time"},"validUntil":{"anyOf":[{"type":"string","format":"date-time"},{"type":"null"}]},"provenanceStatus":{"type":"string","enum":["VERIFIED","ESTIMATED","SIMULATED","UNKNOWN"]}},"required":["reference","provider","observedAt","validUntil","provenanceStatus"],"additionalProperties":false},{"type":"null"}]},"waypoints":{"type":"array","items":{"type":"object","properties":{"kind":{"type":"string","enum":["FUEL","REST","BORDER","TRANSFER"]},"location":{"type":"object","properties":{"label":{"type":"string","minLength":1,"pattern":"\\S"},"countryCode":{"type":"string","pattern":"^[A-Z]{2}$"},"region":{"type":["string","null"]},"city":{"type":"string","minLength":1,"pattern":"\\S"},"lat":{"anyOf":[{"type":"number","minimum":-90,"maximum":90},{"type":"null"}]},"lng":{"anyOf":[{"type":"number","minimum":-180,"maximum":180},{"type":"null"}]}},"required":["label","countryCode","region","city","lat","lng"],"additionalProperties":false},"source":{"type":"object","properties":{"reference":{"type":"string","minLength":1,"maxLength":500,"pattern":"\\S"},"provider":{"type":"string","minLength":1,"maxLength":150,"pattern":"\\S"},"observedAt":{"type":"string","format":"date-time"},"validUntil":{"anyOf":[{"type":"string","format":"date-time"},{"type":"null"}]},"provenanceStatus":{"type":"string","enum":["VERIFIED","ESTIMATED","SIMULATED","UNKNOWN"]}},"required":["reference","provider","observedAt","validUntil","provenanceStatus"],"additionalProperties":false},"verifiedAt":{"anyOf":[{"type":"string","format":"date-time"},{"type":"null"}]}},"required":["kind","location","source","verifiedAt"],"additionalProperties":false},"maxItems":100}},"required":["schemaVersion","active","originNodeId","destinationNodeId","mode","estimatedDistanceKm","estimatedDurationSeconds","restrictions","source","version","validUntil","grossWeightLimitKg","payloadLimitKg","usableDimensions","limitsEvidence","waypoints"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}'::json;
when 'route-policies.publish' then s:='{"type":"object","properties":{"schemaVersion":{"type":"string","const":"2.0"},"active":{"type":"boolean"},"version":{"type":"string","minLength":1,"maxLength":2000,"pattern":"\\S"},"objective":{"type":"string","enum":["SHORTEST","FASTEST","WEIGHTED"]},"constraints":{"type":"array","items":{"type":"object","properties":{"code":{"type":"string","minLength":1,"maxLength":2000,"pattern":"\\S"},"description":{"type":"string","minLength":1,"maxLength":2000,"pattern":"\\S"},"required":{"type":"boolean"},"evidence":{"anyOf":[{"type":"object","properties":{"reference":{"type":"string","minLength":1,"maxLength":500,"pattern":"\\S"},"provider":{"type":"string","minLength":1,"maxLength":150,"pattern":"\\S"},"observedAt":{"type":"string","format":"date-time"},"validUntil":{"anyOf":[{"type":"string","format":"date-time"},{"type":"null"}]},"provenanceStatus":{"type":"string","enum":["VERIFIED","ESTIMATED","SIMULATED","UNKNOWN"]}},"required":["reference","provider","observedAt","validUntil","provenanceStatus"],"additionalProperties":false},{"type":"null"}]}},"required":["code","description","required","evidence"],"additionalProperties":false},"maxItems":100},"weights":{"type":"object","properties":{"distance":{"type":"number","minimum":0,"maximum":1},"duration":{"type":"number","minimum":0,"maximum":1}},"required":["distance","duration"],"additionalProperties":false},"missingDataRule":{"type":"string","const":"UNKNOWN"}},"required":["schemaVersion","active","version","objective","constraints","weights","missingDataRule"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}'::json;
when 'conditions.publish' then s:='{"type":"object","properties":{"schemaVersion":{"type":"string","const":"2.0"},"active":{"type":"boolean"},"corridorId":{"type":"string","format":"uuid"},"kind":{"type":"string","enum":["CLOSURE","DELAY","HAZARD","RESTRICTION"]},"location":{"type":"object","properties":{"label":{"type":"string","minLength":1,"pattern":"\\S"},"countryCode":{"type":"string","pattern":"^[A-Z]{2}$"},"region":{"type":["string","null"]},"city":{"type":"string","minLength":1,"pattern":"\\S"},"lat":{"anyOf":[{"type":"number","minimum":-90,"maximum":90},{"type":"null"}]},"lng":{"anyOf":[{"type":"number","minimum":-180,"maximum":180},{"type":"null"}]}},"required":["label","countryCode","region","city","lat","lng"],"additionalProperties":false},"observedAt":{"type":"string","format":"date-time"},"validUntil":{"anyOf":[{"type":"string","format":"date-time"},{"type":"null"}]},"source":{"type":"object","properties":{"reference":{"type":"string","minLength":1,"maxLength":500,"pattern":"\\S"},"provider":{"type":"string","minLength":1,"maxLength":150,"pattern":"\\S"},"observedAt":{"type":"string","format":"date-time"},"validUntil":{"anyOf":[{"type":"string","format":"date-time"},{"type":"null"}]},"provenanceStatus":{"type":"string","enum":["VERIFIED","ESTIMATED","SIMULATED","UNKNOWN"]}},"required":["reference","provider","observedAt","validUntil","provenanceStatus"],"additionalProperties":false},"confidence":{"type":"string","enum":["VERIFIED","ESTIMATED","SIMULATED","UNKNOWN"]}},"required":["schemaVersion","active","corridorId","kind","location","observedAt","validUntil","source","confidence"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}'::json;
when 'limits.publish' then s:='{"type":"object","properties":{"schemaVersion":{"type":"string","const":"2.0"},"active":{"type":"boolean"},"serviceId":{"type":"string","format":"uuid"},"assetId":{"anyOf":[{"type":"string","format":"uuid"},{"type":"null"}]},"combinationId":{"anyOf":[{"type":"string","format":"uuid"},{"type":"null"}]},"corridorId":{"type":"string","format":"uuid"},"manufacturerPayloadLimitKg":{"type":"number","exclusiveMinimum":0},"routeGrossLimitKg":{"type":"number","exclusiveMinimum":0},"combinedTareKg":{"type":"number","minimum":0},"usableVolumeM3":{"type":"number","exclusiveMinimum":0},"usableDimensions":{"type":"object","properties":{"length":{"type":"number","exclusiveMinimum":0},"width":{"type":"number","exclusiveMinimum":0},"height":{"type":"number","exclusiveMinimum":0}},"required":["length","width","height"],"additionalProperties":false},"compatibilityConfirmed":{"type":"boolean"},"source":{"type":"object","properties":{"reference":{"type":"string","minLength":1,"maxLength":500,"pattern":"\\S"},"provider":{"type":"string","minLength":1,"maxLength":150,"pattern":"\\S"},"observedAt":{"type":"string","format":"date-time"},"validUntil":{"anyOf":[{"type":"string","format":"date-time"},{"type":"null"}]},"provenanceStatus":{"type":"string","enum":["VERIFIED","ESTIMATED","SIMULATED","UNKNOWN"]}},"required":["reference","provider","observedAt","validUntil","provenanceStatus"],"additionalProperties":false}},"required":["schemaVersion","active","serviceId","assetId","combinationId","corridorId","manufacturerPayloadLimitKg","routeGrossLimitKg","combinedTareKg","usableVolumeM3","usableDimensions","compatibilityConfirmed","source"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}'::json;
when 'scoring-policies.publish' then s:='{"type":"object","properties":{"schemaVersion":{"type":"string","const":"2.0"},"active":{"type":"boolean"},"policy":{"type":"object","properties":{"version":{"type":"string","minLength":1,"maxLength":100,"pattern":"\\S"},"objective":{"type":"string","enum":["LOWEST_COST","FASTEST","WEIGHTED"]},"weights":{"type":"object","properties":{"cost":{"type":"number","minimum":0,"maximum":1},"transit":{"type":"number","minimum":0,"maximum":1},"reliability":{"type":"number","minimum":0,"maximum":1}},"required":["cost","transit","reliability"],"additionalProperties":false},"missingDataRule":{"type":"string","const":"EXCLUDE"},"tieBreaker":{"type":"string","const":"OFFER_ID_ASC"}},"required":["version","objective","weights","missingDataRule","tieBreaker"],"additionalProperties":false}},"required":["schemaVersion","active","policy"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}'::json;
when 'metrics.publish' then s:='{"type":"object","properties":{"schemaVersion":{"type":"string","const":"2.0"},"period":{"type":"object","properties":{"startsAt":{"type":"string","format":"date-time"},"endsAt":{"type":"string","format":"date-time"}},"required":["startsAt","endsAt"],"additionalProperties":false},"corridorId":{"anyOf":[{"type":"string","format":"uuid"},{"type":"null"}]},"mode":{"anyOf":[{"type":"string","enum":["ROAD","RAIL","SEA","AIR"]},{"type":"null"}]},"sampleSize":{"type":"integer","exclusiveMinimum":0},"onTimeRate":{"anyOf":[{"type":"number","minimum":0,"maximum":1},{"type":"null"}]},"successfulDeliveryRate":{"anyOf":[{"type":"number","minimum":0,"maximum":1},{"type":"null"}]},"source":{"type":"object","properties":{"reference":{"type":"string","minLength":1,"maxLength":500,"pattern":"\\S"},"provider":{"type":"string","minLength":1,"maxLength":150,"pattern":"\\S"},"observedAt":{"type":"string","format":"date-time"},"validUntil":{"anyOf":[{"type":"string","format":"date-time"},{"type":"null"}]},"provenanceStatus":{"type":"string","enum":["VERIFIED","ESTIMATED","SIMULATED","UNKNOWN"]}},"required":["reference","provider","observedAt","validUntil","provenanceStatus"],"additionalProperties":false}},"required":["schemaVersion","period","corridorId","mode","sampleSize","onTimeRate","successfulDeliveryRate","source"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}'::json;
when 'routes.create' then s:='{"type":"object","properties":{"schemaVersion":{"type":"string","const":"2.0"},"corridorIds":{"type":"array","items":{"type":"string","format":"uuid"},"minItems":1,"maxItems":100,"uniqueItems":true},"policyId":{"type":"string","format":"uuid"}},"required":["schemaVersion","corridorIds","policyId"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}'::json;
when 'plans.create' then s:='{"type":"object","properties":{"schemaVersion":{"type":"string","const":"2.0"},"routeId":{"type":"string","format":"uuid"},"assignments":{"type":"array","items":{"type":"object","properties":{"legSequence":{"type":"integer","exclusiveMinimum":0},"serviceId":{"type":"string","format":"uuid"},"laneId":{"type":"string","format":"uuid"},"calendarId":{"type":"string","format":"uuid"},"assetId":{"anyOf":[{"type":"string","format":"uuid"},{"type":"null"}]},"capacityPoolId":{"anyOf":[{"type":"string","format":"uuid"},{"type":"null"}]},"combinationId":{"anyOf":[{"type":"string","format":"uuid"},{"type":"null"}]},"role":{"type":"string","enum":["LOAD_BEARING","AUXILIARY"]},"window":{"type":"object","properties":{"startsAt":{"type":"string","format":"date-time"},"endsAt":{"type":"string","format":"date-time"}},"required":["startsAt","endsAt"],"additionalProperties":false},"allocations":{"type":"array","items":{"type":"object","properties":{"unitIndex":{"type":"integer","minimum":0},"quantity":{"type":"integer","exclusiveMinimum":0}},"required":["unitIndex","quantity"],"additionalProperties":false},"maxItems":100}},"required":["legSequence","serviceId","laneId","calendarId","assetId","capacityPoolId","combinationId","role","window","allocations"],"additionalProperties":false},"minItems":1,"maxItems":100}},"required":["schemaVersion","routeId","assignments"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}'::json;
when 'opportunities.create' then s:='{"type":"object","properties":{"schemaVersion":{"type":"string","const":"2.0"},"planId":{"type":"string","format":"uuid"},"carrierId":{"type":"string","format":"uuid"},"assignmentIds":{"type":"array","items":{"type":"string","format":"uuid"},"minItems":1,"maxItems":100,"uniqueItems":true},"responseDeadline":{"type":"string","format":"date-time"},"responseChannel":{"type":"string","enum":["MANUAL","API","MCP"]}},"required":["schemaVersion","planId","carrierId","assignmentIds","responseDeadline","responseChannel"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}'::json;
when 'opportunities.respond' then s:='{"type":"object","properties":{"schemaVersion":{"type":"string","const":"2.0"},"expectedVersion":{"type":"integer","exclusiveMinimum":0},"note":{"type":"string","minLength":1,"maxLength":2000,"pattern":"\\S"},"evidence":{"type":"object","properties":{"reference":{"type":"string","minLength":1,"maxLength":500,"pattern":"\\S"},"provider":{"type":"string","minLength":1,"maxLength":150,"pattern":"\\S"},"observedAt":{"type":"string","format":"date-time"},"validUntil":{"anyOf":[{"type":"string","format":"date-time"},{"type":"null"}]},"provenanceStatus":{"type":"string","enum":["VERIFIED","ESTIMATED","SIMULATED","UNKNOWN"]}},"required":["reference","provider","observedAt","validUntil","provenanceStatus"],"additionalProperties":false},"response":{"type":"string","enum":["ACCEPTED","DECLINED"]}},"required":["schemaVersion","expectedVersion","note","evidence","response"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}'::json;
when 'offers.create' then s:='{"type":"object","properties":{"carrierReference":{"type":"string","minLength":1,"maxLength":200,"pattern":"\\S"},"planCandidateId":{"type":"string","format":"uuid"},"coveredServiceIds":{"type":"array","items":{"type":"string","format":"uuid"},"minItems":1,"uniqueItems":true},"coveredAssignmentIds":{"type":"array","items":{"type":"string","format":"uuid"},"minItems":1,"uniqueItems":true},"price":{"type":"object","properties":{"amount":{"type":"number","minimum":0,"maximum":10000000000},"currency":{"type":"string","const":"USD"}},"required":["amount","currency"],"additionalProperties":false},"breakdown":{"type":"array","items":{"type":"object","properties":{"kind":{"type":"string","enum":["TRANSPORT","FUEL","TOLL","HANDLING","SPECIAL_EQUIPMENT","BORDER","TAX","DISCOUNT","OTHER"]},"amount":{"anyOf":[{"type":"object","properties":{"amount":{"type":"number","minimum":0,"maximum":10000000000},"currency":{"type":"string","const":"USD"}},"required":["amount","currency"],"additionalProperties":false},{"type":"null"}]},"treatment":{"type":"string","enum":["INCLUDED","QUOTED","ESTIMATED","EXCLUDED","UNKNOWN"]},"source":{"type":"object","properties":{"reference":{"type":"string","minLength":1,"maxLength":500,"pattern":"\\S"},"provider":{"type":"string","minLength":1,"maxLength":150,"pattern":"\\S"},"observedAt":{"type":"string","format":"date-time"},"validUntil":{"anyOf":[{"type":"string","format":"date-time"},{"type":"null"}]},"provenanceStatus":{"type":"string","enum":["VERIFIED","ESTIMATED","SIMULATED","UNKNOWN"]}},"required":["reference","provider","observedAt","validUntil","provenanceStatus"],"additionalProperties":false},"observedAt":{"type":"string","format":"date-time"},"details":{"anyOf":[{"type":"string","maxLength":1000},{"type":"null"}]}},"required":["kind","amount","treatment","source","observedAt","details"],"additionalProperties":false},"minItems":1},"validity":{"type":"object","properties":{"startsAt":{"type":"string","format":"date-time"},"endsAt":{"type":"string","format":"date-time"}},"required":["startsAt","endsAt"],"additionalProperties":false},"issuedAt":{"type":"string","format":"date-time"},"estimatedPickupAt":{"anyOf":[{"type":"string","format":"date-time"},{"type":"null"}]},"estimatedDeliveryAt":{"anyOf":[{"type":"string","format":"date-time"},{"type":"null"}]},"transitDurationSeconds":{"anyOf":[{"type":"number","exclusiveMinimum":0},{"type":"null"}]},"reservableCapacity":{"anyOf":[{"type":"object","properties":{"weightKg":{"type":"number","minimum":0},"volumeM3":{"anyOf":[{"type":"number","minimum":0},{"type":"null"}]}},"required":["weightKg","volumeM3"],"additionalProperties":false},{"type":"null"}]},"commercialTerms":{"type":"array","items":{"type":"object","properties":{"code":{"type":"string","minLength":1,"pattern":"\\S"},"description":{"type":"string","minLength":1,"maxLength":2000,"pattern":"\\S"}},"required":["code","description"],"additionalProperties":false}},"evidence":{"type":"array","items":{"type":"object","properties":{"reference":{"type":"string","minLength":1,"maxLength":500,"pattern":"\\S"},"provider":{"type":"string","minLength":1,"maxLength":150,"pattern":"\\S"},"observedAt":{"type":"string","format":"date-time"},"validUntil":{"anyOf":[{"type":"string","format":"date-time"},{"type":"null"}]},"provenanceStatus":{"type":"string","enum":["VERIFIED","ESTIMATED","SIMULATED","UNKNOWN"]}},"required":["reference","provider","observedAt","validUntil","provenanceStatus"],"additionalProperties":false},"minItems":1},"supersedesOfferId":{"anyOf":[{"type":"string","format":"uuid"},{"type":"null"}]},"schemaVersion":{"type":"string","const":"2.0"},"source":{"type":"object","properties":{"channel":{"type":"string","enum":["MANUAL","API","MCP"]},"evidence":{"type":"object","properties":{"reference":{"type":"string","minLength":1,"maxLength":500,"pattern":"\\S"},"provider":{"type":"string","minLength":1,"maxLength":150,"pattern":"\\S"},"observedAt":{"type":"string","format":"date-time"},"validUntil":{"anyOf":[{"type":"string","format":"date-time"},{"type":"null"}]},"provenanceStatus":{"type":"string","enum":["VERIFIED","ESTIMATED","SIMULATED","UNKNOWN"]}},"required":["reference","provider","observedAt","validUntil","provenanceStatus"],"additionalProperties":false}},"required":["channel","evidence"],"additionalProperties":false}},"required":["carrierReference","planCandidateId","coveredServiceIds","coveredAssignmentIds","price","breakdown","validity","issuedAt","estimatedPickupAt","estimatedDeliveryAt","transitDurationSeconds","reservableCapacity","commercialTerms","evidence","supersedesOfferId","schemaVersion","source"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}'::json;
when 'offers.withdraw' then s:='{"type":"object","properties":{"schemaVersion":{"type":"string","const":"2.0"},"expectedVersion":{"type":"integer","exclusiveMinimum":0},"note":{"type":"string","minLength":1,"maxLength":2000,"pattern":"\\S"},"evidence":{"type":"object","properties":{"reference":{"type":"string","minLength":1,"maxLength":500,"pattern":"\\S"},"provider":{"type":"string","minLength":1,"maxLength":150,"pattern":"\\S"},"observedAt":{"type":"string","format":"date-time"},"validUntil":{"anyOf":[{"type":"string","format":"date-time"},{"type":"null"}]},"provenanceStatus":{"type":"string","enum":["VERIFIED","ESTIMATED","SIMULATED","UNKNOWN"]}},"required":["reference","provider","observedAt","validUntil","provenanceStatus"],"additionalProperties":false}},"required":["schemaVersion","expectedVersion","note","evidence"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}'::json;
when 'ranking.create' then s:='{"type":"object","properties":{"schemaVersion":{"type":"string","const":"2.0"},"policyId":{"type":"string","format":"uuid"}},"required":["schemaVersion","policyId"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}'::json;
when 'decisions.create' then s:='{"type":"object","properties":{"schemaVersion":{"type":"string","const":"2.0"},"planId":{"type":"string","format":"uuid"},"selectedOfferIds":{"type":"array","items":{"type":"string","format":"uuid"},"minItems":1,"maxItems":100,"uniqueItems":true},"rationale":{"type":"string","minLength":1,"maxLength":2000,"pattern":"\\S"},"policyId":{"anyOf":[{"type":"string","format":"uuid"},{"type":"null"}]},"consideredOfferIds":{"type":"array","items":{"type":"string","format":"uuid"},"maxItems":100,"uniqueItems":true},"evidence":{"type":"array","items":{"type":"object","properties":{"reference":{"type":"string","minLength":1,"maxLength":500,"pattern":"\\S"},"provider":{"type":"string","minLength":1,"maxLength":150,"pattern":"\\S"},"observedAt":{"type":"string","format":"date-time"},"validUntil":{"anyOf":[{"type":"string","format":"date-time"},{"type":"null"}]},"provenanceStatus":{"type":"string","enum":["VERIFIED","ESTIMATED","SIMULATED","UNKNOWN"]}},"required":["reference","provider","observedAt","validUntil","provenanceStatus"],"additionalProperties":false},"minItems":1,"maxItems":100}},"required":["schemaVersion","planId","selectedOfferIds","rationale","policyId","consideredOfferIds","evidence"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}'::json;
when 'decisions.revoke' then s:='{"type":"object","properties":{"schemaVersion":{"type":"string","const":"2.0"},"expectedVersion":{"type":"integer","exclusiveMinimum":0},"note":{"type":"string","minLength":1,"maxLength":2000,"pattern":"\\S"},"evidence":{"type":"object","properties":{"reference":{"type":"string","minLength":1,"maxLength":500,"pattern":"\\S"},"provider":{"type":"string","minLength":1,"maxLength":150,"pattern":"\\S"},"observedAt":{"type":"string","format":"date-time"},"validUntil":{"anyOf":[{"type":"string","format":"date-time"},{"type":"null"}]},"provenanceStatus":{"type":"string","enum":["VERIFIED","ESTIMATED","SIMULATED","UNKNOWN"]}},"required":["reference","provider","observedAt","validUntil","provenanceStatus"],"additionalProperties":false}},"required":["schemaVersion","expectedVersion","note","evidence"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}'::json;
when 'bookings.create' then s:='{"type":"object","properties":{"schemaVersion":{"type":"string","const":"2.0"},"decisionId":{"type":"string","format":"uuid"},"offerId":{"type":"string","format":"uuid"},"authorization":{"type":"string","const":"AUTHORIZE"},"evidence":{"type":"object","properties":{"reference":{"type":"string","minLength":1,"maxLength":500,"pattern":"\\S"},"provider":{"type":"string","minLength":1,"maxLength":150,"pattern":"\\S"},"observedAt":{"type":"string","format":"date-time"},"validUntil":{"anyOf":[{"type":"string","format":"date-time"},{"type":"null"}]},"provenanceStatus":{"type":"string","enum":["VERIFIED","ESTIMATED","SIMULATED","UNKNOWN"]}},"required":["reference","provider","observedAt","validUntil","provenanceStatus"],"additionalProperties":false}},"required":["schemaVersion","decisionId","offerId","authorization","evidence"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}'::json;
when 'bookings.confirm' then s:='{"type":"object","properties":{"schemaVersion":{"type":"string","const":"2.0"},"expectedVersion":{"type":"integer","exclusiveMinimum":0},"note":{"type":"string","minLength":1,"maxLength":2000,"pattern":"\\S"},"evidence":{"type":"object","properties":{"reference":{"type":"string","minLength":1,"maxLength":500,"pattern":"\\S"},"provider":{"type":"string","minLength":1,"maxLength":150,"pattern":"\\S"},"observedAt":{"type":"string","format":"date-time"},"validUntil":{"anyOf":[{"type":"string","format":"date-time"},{"type":"null"}]},"provenanceStatus":{"type":"string","enum":["VERIFIED","ESTIMATED","SIMULATED","UNKNOWN"]}},"required":["reference","provider","observedAt","validUntil","provenanceStatus"],"additionalProperties":false},"carrierReference":{"type":"string","minLength":1,"maxLength":2000,"pattern":"\\S"},"confirmation":{"type":"string","enum":["CONFIRMED","REJECTED"]}},"required":["schemaVersion","expectedVersion","note","evidence","carrierReference","confirmation"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}'::json;
when 'bookings.cancel' then s:='{"type":"object","properties":{"schemaVersion":{"type":"string","const":"2.0"},"expectedVersion":{"type":"integer","exclusiveMinimum":0},"note":{"type":"string","minLength":1,"maxLength":2000,"pattern":"\\S"},"evidence":{"type":"object","properties":{"reference":{"type":"string","minLength":1,"maxLength":500,"pattern":"\\S"},"provider":{"type":"string","minLength":1,"maxLength":150,"pattern":"\\S"},"observedAt":{"type":"string","format":"date-time"},"validUntil":{"anyOf":[{"type":"string","format":"date-time"},{"type":"null"}]},"provenanceStatus":{"type":"string","enum":["VERIFIED","ESTIMATED","SIMULATED","UNKNOWN"]}},"required":["reference","provider","observedAt","validUntil","provenanceStatus"],"additionalProperties":false}},"required":["schemaVersion","expectedVersion","note","evidence"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}'::json;
when 'consolidations.create' then s:='{"type":"object","properties":{"schemaVersion":{"type":"string","const":"2.0"},"serviceId":{"type":"string","format":"uuid"},"calendarId":{"type":"string","format":"uuid"},"routeId":{"type":"string","format":"uuid"},"window":{"type":"object","properties":{"startsAt":{"type":"string","format":"date-time"},"endsAt":{"type":"string","format":"date-time"}},"required":["startsAt","endsAt"],"additionalProperties":false},"cargoCategoryIds":{"type":"array","items":{"type":"string","format":"uuid"},"minItems":1,"maxItems":100,"uniqueItems":true},"compatibleRequirementCodes":{"type":"array","items":{"type":"string","minLength":1,"maxLength":2000,"pattern":"\\S"},"maxItems":100},"evidence":{"type":"object","properties":{"reference":{"type":"string","minLength":1,"maxLength":500,"pattern":"\\S"},"provider":{"type":"string","minLength":1,"maxLength":150,"pattern":"\\S"},"observedAt":{"type":"string","format":"date-time"},"validUntil":{"anyOf":[{"type":"string","format":"date-time"},{"type":"null"}]},"provenanceStatus":{"type":"string","enum":["VERIFIED","ESTIMATED","SIMULATED","UNKNOWN"]}},"required":["reference","provider","observedAt","validUntil","provenanceStatus"],"additionalProperties":false}},"required":["schemaVersion","serviceId","calendarId","routeId","window","cargoCategoryIds","compatibleRequirementCodes","evidence"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}'::json;
when 'consolidations.close' then s:='{"type":"object","properties":{"schemaVersion":{"type":"string","const":"2.0"},"expectedVersion":{"type":"integer","exclusiveMinimum":0},"note":{"type":"string","minLength":1,"maxLength":2000,"pattern":"\\S"},"evidence":{"type":"object","properties":{"reference":{"type":"string","minLength":1,"maxLength":500,"pattern":"\\S"},"provider":{"type":"string","minLength":1,"maxLength":150,"pattern":"\\S"},"observedAt":{"type":"string","format":"date-time"},"validUntil":{"anyOf":[{"type":"string","format":"date-time"},{"type":"null"}]},"provenanceStatus":{"type":"string","enum":["VERIFIED","ESTIMATED","SIMULATED","UNKNOWN"]}},"required":["reference","provider","observedAt","validUntil","provenanceStatus"],"additionalProperties":false}},"required":["schemaVersion","expectedVersion","note","evidence"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}'::json;
when 'holds.create' then s:='{"type":"object","properties":{"schemaVersion":{"type":"string","const":"2.0"},"bookingId":{"type":"string","format":"uuid"},"assignmentId":{"type":"string","format":"uuid"},"expiresAt":{"type":"string","format":"date-time"},"consolidationId":{"anyOf":[{"type":"string","format":"uuid"},{"type":"null"}],"default":null},"evidence":{"type":"object","properties":{"reference":{"type":"string","minLength":1,"maxLength":500,"pattern":"\\S"},"provider":{"type":"string","minLength":1,"maxLength":150,"pattern":"\\S"},"observedAt":{"type":"string","format":"date-time"},"validUntil":{"anyOf":[{"type":"string","format":"date-time"},{"type":"null"}]},"provenanceStatus":{"type":"string","enum":["VERIFIED","ESTIMATED","SIMULATED","UNKNOWN"]}},"required":["reference","provider","observedAt","validUntil","provenanceStatus"],"additionalProperties":false}},"required":["schemaVersion","bookingId","assignmentId","expiresAt","evidence"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}'::json;
when 'holds.confirm' then s:='{"type":"object","properties":{"schemaVersion":{"type":"string","const":"2.0"},"expectedVersion":{"type":"integer","exclusiveMinimum":0},"note":{"type":"string","minLength":1,"maxLength":2000,"pattern":"\\S"},"evidence":{"type":"object","properties":{"reference":{"type":"string","minLength":1,"maxLength":500,"pattern":"\\S"},"provider":{"type":"string","minLength":1,"maxLength":150,"pattern":"\\S"},"observedAt":{"type":"string","format":"date-time"},"validUntil":{"anyOf":[{"type":"string","format":"date-time"},{"type":"null"}]},"provenanceStatus":{"type":"string","enum":["VERIFIED","ESTIMATED","SIMULATED","UNKNOWN"]}},"required":["reference","provider","observedAt","validUntil","provenanceStatus"],"additionalProperties":false}},"required":["schemaVersion","expectedVersion","note","evidence"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}'::json;
when 'holds.release' then s:='{"type":"object","properties":{"schemaVersion":{"type":"string","const":"2.0"},"expectedVersion":{"type":"integer","exclusiveMinimum":0},"note":{"type":"string","minLength":1,"maxLength":2000,"pattern":"\\S"},"evidence":{"type":"object","properties":{"reference":{"type":"string","minLength":1,"maxLength":500,"pattern":"\\S"},"provider":{"type":"string","minLength":1,"maxLength":150,"pattern":"\\S"},"observedAt":{"type":"string","format":"date-time"},"validUntil":{"anyOf":[{"type":"string","format":"date-time"},{"type":"null"}]},"provenanceStatus":{"type":"string","enum":["VERIFIED","ESTIMATED","SIMULATED","UNKNOWN"]}},"required":["reference","provider","observedAt","validUntil","provenanceStatus"],"additionalProperties":false}},"required":["schemaVersion","expectedVersion","note","evidence"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}'::json;
when 'executions.create' then s:='{"type":"object","properties":{"schemaVersion":{"type":"string","const":"2.0"},"bookingId":{"type":"string","format":"uuid"},"serviceId":{"type":"string","format":"uuid"}},"required":["schemaVersion","bookingId","serviceId"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}'::json;
when 'executions.start' then s:='{"type":"object","properties":{"schemaVersion":{"type":"string","const":"2.0"},"expectedVersion":{"type":"integer","exclusiveMinimum":0},"note":{"type":"string","minLength":1,"maxLength":2000,"pattern":"\\S"},"evidence":{"type":"object","properties":{"reference":{"type":"string","minLength":1,"maxLength":500,"pattern":"\\S"},"provider":{"type":"string","minLength":1,"maxLength":150,"pattern":"\\S"},"observedAt":{"type":"string","format":"date-time"},"validUntil":{"anyOf":[{"type":"string","format":"date-time"},{"type":"null"}]},"provenanceStatus":{"type":"string","enum":["VERIFIED","ESTIMATED","SIMULATED","UNKNOWN"]}},"required":["reference","provider","observedAt","validUntil","provenanceStatus"],"additionalProperties":false}},"required":["schemaVersion","expectedVersion","note","evidence"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}'::json;
when 'executions.complete' then s:='{"type":"object","properties":{"schemaVersion":{"type":"string","const":"2.0"},"expectedVersion":{"type":"integer","exclusiveMinimum":0},"note":{"type":"string","minLength":1,"maxLength":2000,"pattern":"\\S"},"evidence":{"type":"object","properties":{"reference":{"type":"string","minLength":1,"maxLength":500,"pattern":"\\S"},"provider":{"type":"string","minLength":1,"maxLength":150,"pattern":"\\S"},"observedAt":{"type":"string","format":"date-time"},"validUntil":{"anyOf":[{"type":"string","format":"date-time"},{"type":"null"}]},"provenanceStatus":{"type":"string","enum":["VERIFIED","ESTIMATED","SIMULATED","UNKNOWN"]}},"required":["reference","provider","observedAt","validUntil","provenanceStatus"],"additionalProperties":false}},"required":["schemaVersion","expectedVersion","note","evidence"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}'::json;
when 'executions.cancel' then s:='{"type":"object","properties":{"schemaVersion":{"type":"string","const":"2.0"},"expectedVersion":{"type":"integer","exclusiveMinimum":0},"note":{"type":"string","minLength":1,"maxLength":2000,"pattern":"\\S"},"evidence":{"type":"object","properties":{"reference":{"type":"string","minLength":1,"maxLength":500,"pattern":"\\S"},"provider":{"type":"string","minLength":1,"maxLength":150,"pattern":"\\S"},"observedAt":{"type":"string","format":"date-time"},"validUntil":{"anyOf":[{"type":"string","format":"date-time"},{"type":"null"}]},"provenanceStatus":{"type":"string","enum":["VERIFIED","ESTIMATED","SIMULATED","UNKNOWN"]}},"required":["reference","provider","observedAt","validUntil","provenanceStatus"],"additionalProperties":false}},"required":["schemaVersion","expectedVersion","note","evidence"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}'::json;
when 'executions.position' then s:='{"type":"object","properties":{"schemaVersion":{"type":"string","const":"2.0"},"expectedVersion":{"type":"integer","exclusiveMinimum":0},"note":{"type":"string","minLength":1,"maxLength":2000,"pattern":"\\S"},"evidence":{"type":"object","properties":{"reference":{"type":"string","minLength":1,"maxLength":500,"pattern":"\\S"},"provider":{"type":"string","minLength":1,"maxLength":150,"pattern":"\\S"},"observedAt":{"type":"string","format":"date-time"},"validUntil":{"anyOf":[{"type":"string","format":"date-time"},{"type":"null"}]},"provenanceStatus":{"type":"string","enum":["VERIFIED","ESTIMATED","SIMULATED","UNKNOWN"]}},"required":["reference","provider","observedAt","validUntil","provenanceStatus"],"additionalProperties":false},"location":{"type":"object","properties":{"label":{"type":"string","minLength":1,"pattern":"\\S"},"countryCode":{"type":"string","pattern":"^[A-Z]{2}$"},"region":{"type":["string","null"]},"city":{"type":"string","minLength":1,"pattern":"\\S"},"lat":{"anyOf":[{"type":"number","minimum":-90,"maximum":90},{"type":"null"}]},"lng":{"anyOf":[{"type":"number","minimum":-180,"maximum":180},{"type":"null"}]}},"required":["label","countryCode","region","city","lat","lng"],"additionalProperties":false},"observedAt":{"type":"string","format":"date-time"},"correlationId":{"type":"string","minLength":1,"maxLength":2000,"pattern":"\\S"}},"required":["schemaVersion","expectedVersion","note","evidence","location","observedAt","correlationId"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}'::json;
when 'incidents.create' then s:='{"type":"object","properties":{"schemaVersion":{"type":"string","const":"2.0"},"kind":{"type":"string","minLength":1,"maxLength":2000,"pattern":"\\S"},"severity":{"type":"string","enum":["INFO","WARNING","CRITICAL"]},"occurredAt":{"type":"string","format":"date-time"},"location":{"anyOf":[{"type":"object","properties":{"label":{"type":"string","minLength":1,"pattern":"\\S"},"countryCode":{"type":"string","pattern":"^[A-Z]{2}$"},"region":{"type":["string","null"]},"city":{"type":"string","minLength":1,"pattern":"\\S"},"lat":{"anyOf":[{"type":"number","minimum":-90,"maximum":90},{"type":"null"}]},"lng":{"anyOf":[{"type":"number","minimum":-180,"maximum":180},{"type":"null"}]}},"required":["label","countryCode","region","city","lat","lng"],"additionalProperties":false},{"type":"null"}]},"description":{"type":"string","minLength":1,"maxLength":2000,"pattern":"\\S"},"evidence":{"type":"array","items":{"type":"object","properties":{"reference":{"type":"string","minLength":1,"maxLength":500,"pattern":"\\S"},"provider":{"type":"string","minLength":1,"maxLength":150,"pattern":"\\S"},"observedAt":{"type":"string","format":"date-time"},"validUntil":{"anyOf":[{"type":"string","format":"date-time"},{"type":"null"}]},"provenanceStatus":{"type":"string","enum":["VERIFIED","ESTIMATED","SIMULATED","UNKNOWN"]}},"required":["reference","provider","observedAt","validUntil","provenanceStatus"],"additionalProperties":false},"minItems":1,"maxItems":100}},"required":["schemaVersion","kind","severity","occurredAt","location","description","evidence"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}'::json;
when 'incidents.update' then s:='{"type":"object","properties":{"schemaVersion":{"type":"string","const":"2.0"},"expectedVersion":{"type":"integer","exclusiveMinimum":0},"note":{"type":"string","minLength":1,"maxLength":2000,"pattern":"\\S"},"evidence":{"type":"object","properties":{"reference":{"type":"string","minLength":1,"maxLength":500,"pattern":"\\S"},"provider":{"type":"string","minLength":1,"maxLength":150,"pattern":"\\S"},"observedAt":{"type":"string","format":"date-time"},"validUntil":{"anyOf":[{"type":"string","format":"date-time"},{"type":"null"}]},"provenanceStatus":{"type":"string","enum":["VERIFIED","ESTIMATED","SIMULATED","UNKNOWN"]}},"required":["reference","provider","observedAt","validUntil","provenanceStatus"],"additionalProperties":false},"action":{"type":"string","enum":["NOTE","RESOLVE","REOPEN"]}},"required":["schemaVersion","expectedVersion","note","evidence","action"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}'::json;
when 'asset-events.create' then s:='{"type":"object","properties":{"schemaVersion":{"type":"string","const":"2.0"},"expectedVersion":{"type":"integer","exclusiveMinimum":0},"note":{"type":"string","minLength":1,"maxLength":2000,"pattern":"\\S"},"evidence":{"type":"object","properties":{"reference":{"type":"string","minLength":1,"maxLength":500,"pattern":"\\S"},"provider":{"type":"string","minLength":1,"maxLength":150,"pattern":"\\S"},"observedAt":{"type":"string","format":"date-time"},"validUntil":{"anyOf":[{"type":"string","format":"date-time"},{"type":"null"}]},"provenanceStatus":{"type":"string","enum":["VERIFIED","ESTIMATED","SIMULATED","UNKNOWN"]}},"required":["reference","provider","observedAt","validUntil","provenanceStatus"],"additionalProperties":false},"next":{"type":"string","enum":["AVAILABLE","IN_SERVICE","MAINTENANCE","OUT_OF_SERVICE"]},"reason":{"type":"string","minLength":1,"maxLength":2000,"pattern":"\\S"}},"required":["schemaVersion","expectedVersion","note","evidence","next","reason"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}'::json;
else raise exception 'VALIDATION_ERROR' using errcode='PT400';end case;if not coalesce(extensions.jsonb_matches_schema(s,v),false) then raise exception 'VALIDATION_ERROR' using errcode='PT400';end if;end;$$;
create function private.command_v2_workflow(p_organization_id uuid,p_member_id uuid,p_action text,p_context jsonb,p_key uuid,p_value jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare k text:=split_part(p_action,'.',1);op text:=split_part(p_action,'.',2);t text;c uuid:=(p_context->>'carrierId')::uuid;
 qid uuid:=(p_context->>'requestId')::uuid;parent uuid:=(p_context->>'parentId')::uuid;ident uuid:=(p_context->>'id')::uuid;
 i uuid:=coalesce(ident,gen_random_uuid());rid uuid;old jsonb;v jsonb:=p_value;result jsonb;h text;receipt private.v2_workflow_receipts;
 o uuid:=p_organization_id;new_status text;expected integer;pub boolean:=op='publish';q public.freight_requests;plan public.transport_plan_candidates;
 opp public.carrier_opportunities;offer public.v2_carrier_offers;b public.v2_bookings;e public.transport_executions;hold public.capacity_reservations;
 ass public.plan_leg_assignments;res public.plan_resources;rowid uuid;ref uuid;svc uuid;payload jsonb;window_start timestamptz;window_end timestamptz;
begin
 perform private.workflow_member(p_organization_id,p_member_id,false);
 if p_key is null or jsonb_typeof(p_context)<>'object' or (p_context-'carrierId'-'requestId'-'parentId'-'id')<>'{}'::jsonb then raise exception 'VALIDATION_ERROR' using errcode='PT400';end if;
 if pub and ident is not null then
  if jsonb_typeof(v)<>'object' or (v-'expectedVersion'-'value')<>'{}'::jsonb then raise exception 'VALIDATION_ERROR' using errcode='PT400';end if;
  expected:=(v->>'expectedVersion')::integer;v:=v->'value';
 end if;
 perform private.workflow_validate(p_action,v);perform private.workflow_validate_periods(v);t:=private.workflow_table(k);
 if op in ('respond','withdraw','revoke','confirm','release','cancel','start','complete','position','update','close') and ident is null
  or op='create' and ident is not null
  or k in ('routes','plans','opportunities','ranking','decisions') and op='create' and qid is null
  or p_action in ('offers.create','incidents.create','asset-events.create') and parent is null
  then raise exception 'VALIDATION_ERROR' using errcode='PT400';end if;
 if p_action in ('routes.create','plans.create','opportunities.create','ranking.create','decisions.create','decisions.revoke','bookings.create','holds.create','executions.create') then
  if c is not null then raise exception 'VALIDATION_ERROR' using errcode='PT400';end if;
  perform private.workflow_member(o,p_member_id,true);
 end if;
 if p_action in ('opportunities.respond','offers.create','offers.withdraw','holds.confirm','bookings.confirm','executions.start','executions.complete','executions.cancel','executions.position','incidents.create','incidents.update') and c is null then raise exception 'FORBIDDEN_WORKFLOW' using errcode='PT403';end if;
 if k='consolidations' and c is null then raise exception 'FORBIDDEN_WORKFLOW' using errcode='PT403';end if;
 -- Shared deterministic ordering with fleet/crew; native commands serialize affected commitments.
 -- Broad service lock deliberately favors correctness until narrower measured lock scopes are introduced.
 perform 1 from public.carrier_services order by id for update;
 if c is not null then perform private.workflow_carrier(c);end if;
 if k in ('limits','metrics','asset-events') and c is null then raise exception 'FORBIDDEN_WORKFLOW' using errcode='PT403';end if;
 if pub and k not in ('limits','metrics') then perform private.workflow_admin();
 elsif c is null then perform private.workflow_member(o,p_member_id,true);end if;
 if qid is not null then q:=private.workflow_request(o,qid);end if;
 if ident is not null then
  if pub and k not in ('limits','metrics') then old:=private.workflow_record(k,ident);
  else old:=private.workflow_scope(o,c,k,ident);end if;
  if old->>'id' is null then raise exception 'WORKFLOW_NOT_FOUND' using errcode='PT404';end if;
  if qid is not null and (old->>'requestId')::uuid is distinct from qid then raise exception 'WORKFLOW_NOT_FOUND' using errcode='PT404';end if;
  if not pub then expected:=(v->>'expectedVersion')::integer;end if;
 end if;
 perform private.workflow_expire_holds();
 -- Recheck actor/grant and target scope before receipt lookup, including revoked-access replays.
 h:=private.hash_v2_freight_payload(jsonb_build_object('action',p_action,'context',p_context,'value',p_value));
 perform pg_advisory_xact_lock(hashtextextended(o::text||':'||p_member_id::text||':'||p_key::text,0));
 select * into receipt from private.v2_workflow_receipts where organization_id=o and member_id=p_member_id and idempotency_key=p_key;
 if found then if receipt.payload_hash<>h then raise exception 'IDEMPOTENCY_CONFLICT' using errcode='PT409';end if;return jsonb_build_object('record',receipt.result,'replay',true);end if;
 if ident is not null and (expected is null or expected<1 or expected<>(old->>'version')::integer) then raise exception 'STALE_DRAFT' using errcode='PT409';end if;
 if pub then
  new_status:=case when coalesce((v->>'active')::boolean,true) then 'ACTIVE' else 'INACTIVE' end;
  if k='limits' then
   if not exists(select 1 from public.carrier_services where id=(v->>'serviceId')::uuid and carrier_id=c)
    or v->>'assetId' is not null and not exists(select 1 from public.transport_assets where id=(v->>'assetId')::uuid and carrier_id=c and carrier_service_id=(v->>'serviceId')::uuid)
    or v->>'combinationId' is not null and not exists(select 1 from public.vehicle_combinations where id=(v->>'combinationId')::uuid and carrier_id=c and carrier_service_id=(v->>'serviceId')::uuid)
    then raise exception 'INVALID_LIMIT_REFERENCE' using errcode='PT400';end if;
   if (v->>'combinedTareKg')::numeric>=(v->>'routeGrossLimitKg')::numeric then raise exception 'VALIDATION_ERROR' using errcode='PT400';end if;
  elsif k='corridors' and v->>'originNodeId'=v->>'destinationNodeId' then raise exception 'VALIDATION_ERROR' using errcode='PT400';
  elsif k='scoring-policies' and (abs((v#>>'{policy,weights,cost}')::numeric+(v#>>'{policy,weights,transit}')::numeric+(v#>>'{policy,weights,reliability}')::numeric-1)>0.000000001 or v#>>'{policy,objective}'='LOWEST_COST' and (v#>>'{policy,weights,cost}')::numeric<>1 or v#>>'{policy,objective}'='FASTEST' and (v#>>'{policy,weights,transit}')::numeric<>1) then raise exception 'SCORING_POLICY_INVALID' using errcode='PT400';
  elsif k='route-policies' and abs((v#>>'{weights,distance}')::numeric+(v#>>'{weights,duration}')::numeric-1)>0.000000001 then raise exception 'VALIDATION_ERROR' using errcode='PT400';
  elsif k='metrics' and (v#>>'{period,endsAt}')::timestamptz>now() then raise exception 'METRIC_PERIOD_NOT_FINISHED' using errcode='PT400';end if;
  if ident is null then
   if k='corridors' then insert into public.route_corridors(id,status,data,origin_node_id,destination_node_id) values(i,new_status,v,(v->>'originNodeId')::uuid,(v->>'destinationNodeId')::uuid);
   elsif k='limits' then insert into public.route_resource_limits(id,carrier_id,status,data,carrier_service_id,asset_id,combination_id,corridor_id) values(i,c,new_status,v,(v->>'serviceId')::uuid,(v->>'assetId')::uuid,(v->>'combinationId')::uuid,(v->>'corridorId')::uuid);
   else execute format('insert into public.%I(id,carrier_id,parent_id,status,data) values($1,$2,$3,$4,$5)',t) using i,c,case when k='conditions' then (v->>'corridorId')::uuid end,new_status,v;end if;
  else
   if k='scoring-policies' and old#>'{data,policy}' is distinct from v->'policy'
    or k='route-policies' and ((old->'data')-'active') is distinct from (v-'active') then raise exception 'POLICY_VERSION_IMMUTABLE' using errcode='PT400';end if;
   if k='corridors' and (old#>'{data,originNodeId}' is distinct from v->'originNodeId' or old#>'{data,destinationNodeId}' is distinct from v->'destinationNodeId')
   or k='conditions' and old#>'{data,corridorId}' is distinct from v->'corridorId'
   or k='limits' and (old#>'{data,serviceId}' is distinct from v->'serviceId' or old#>'{data,assetId}' is distinct from v->'assetId' or old#>'{data,combinationId}' is distinct from v->'combinationId' or old#>'{data,corridorId}' is distinct from v->'corridorId') then raise exception 'IMMUTABLE_WORKFLOW_SCOPE' using errcode='PT400';end if;
   execute format('update public.%I set data=$1,status=$2,version=version+1,updated_at=now() where id=$3',t) using v,new_status,i;
  end if;
  result:=private.workflow_record(k,i);
 elsif p_action='routes.create' then result:=private.workflow_route(o,qid,v->'corridorIds',(v->>'policyId')::uuid,i);
 elsif p_action='plans.create' then result:=private.workflow_build_plan(o,qid,v,i);
 elsif p_action='opportunities.create' then
  select * into plan from public.transport_plan_candidates where id=(v->>'planId')::uuid and organization_id=o and freight_request_id=qid;
  if plan.id is null then raise exception 'WORKFLOW_NOT_FOUND' using errcode='PT404';end if;
  if (v->>'responseDeadline')::timestamptz<=now() or (v->>'responseDeadline')::timestamptz>q.pickup_window_end then raise exception 'INVALID_RESPONSE_DEADLINE' using errcode='PT400';end if;
  if exists(select 1 from jsonb_array_elements_text(v->'assignmentIds') x where not exists(select 1 from public.plan_leg_assignments aa join public.plan_resources rr on rr.id=aa.resource_id where aa.id=x.value::uuid and aa.plan_id=plan.id and rr.carrier_id=(v->>'carrierId')::uuid)) then raise exception 'OPPORTUNITY_ASSIGNMENT_MISMATCH' using errcode='PT400';end if;
  insert into public.carrier_opportunities(id,organization_id,carrier_id,freight_request_id,parent_id,status,data) values(i,o,(v->>'carrierId')::uuid,qid,plan.id,'SENT',v||jsonb_build_object('sentAt',now(),'cargoSpecification',q.v2_snapshot->'cargoSpecification','origin',q.v2_snapshot->'origin','destination',q.v2_snapshot->'destination',
   'assignmentSnapshots',(select jsonb_agg(aa.data||jsonb_build_object('id',aa.id,'serviceId',aa.carrier_service_id,'resource',rr.data,'routeLeg',rl.data)) from public.plan_leg_assignments aa join public.plan_resources rr on rr.id=aa.resource_id join public.route_legs rl on rl.id=aa.route_leg_id where aa.plan_id=plan.id and (v->'assignmentIds') ? aa.id::text)));result:=private.workflow_record(k,i);
 elsif p_action='opportunities.respond' then
  if c is null then raise exception 'FORBIDDEN_WORKFLOW' using errcode='PT403';end if;
  select * into opp from public.carrier_opportunities where id=i;
  if opp.status not in ('SENT','ACCEPTED') or (opp.data->>'responseDeadline')::timestamptz<=now() then raise exception 'OPPORTUNITY_NOT_OPEN' using errcode='PT409';end if;
  update public.carrier_opportunities set status=v->>'response',data=data||jsonb_build_object('response',v->'response','responseNote',v->'note','responseEvidence',v->'evidence','respondedAt',now(),'respondedBy',p_member_id),version=version+1,updated_at=now() where id=i;result:=private.workflow_record(k,i);
 elsif p_action='offers.create' then result:=private.workflow_offer(o,p_member_id,c,parent,v,i);
 elsif p_action='offers.withdraw' then
  if c is null then raise exception 'FORBIDDEN_WORKFLOW' using errcode='PT403';end if;
  if old->>'status'<>'RECEIVED' or exists(select 1 from public.v2_bookings where offer_id=i and status not in ('CANCELLED','REJECTED')) then raise exception 'OFFER_COMMITTED' using errcode='PT409';end if;
  update public.v2_carrier_offers set status='WITHDRAWN',version=version+1,updated_at=now(),data=data||jsonb_build_object('status','WITHDRAWN','withdrawal',v,'withdrawnAt',now()) where id=i;result:=private.workflow_record(k,i);
 elsif p_action='ranking.create' then result:=private.workflow_ranking(o,qid,(v->>'policyId')::uuid,i);
 elsif p_action='decisions.create' then result:=private.workflow_selection(o,p_member_id,qid,v,i);
 elsif p_action='decisions.revoke' then
  if old->>'status'<>'SELECTED' then raise exception 'INVALID_DECISION_STATE' using errcode='PT409';end if;
  if exists(select 1 from public.v2_bookings where decision_id=i and status not in ('CANCELLED','REJECTED')) then raise exception 'CANCEL_BOOKINGS_FIRST' using errcode='PT409';end if;
  update public.selection_decisions set status='REVOKED',version=version+1,updated_at=now(),data=data||jsonb_build_object('status','REVOKED','revocation',v,'revokedAt',now()) where id=i;result:=private.workflow_record(k,i);
 elsif p_action='bookings.create' then
  ref:=(v->>'decisionId')::uuid;perform private.workflow_scope(o,null,'decisions',ref);
  if not exists(select 1 from public.selection_decisions where id=ref and status='SELECTED') or not exists(select 1 from public.selection_offers where decision_id=ref and offer_id=(v->>'offerId')::uuid)
   or not private.workflow_offer_current((v->>'offerId')::uuid) then raise exception 'DECISION_OFFER_NOT_CURRENT' using errcode='PT409';end if;
  select * into offer from public.v2_carrier_offers where id=(v->>'offerId')::uuid;
  insert into public.v2_bookings(id,organization_id,carrier_id,freight_request_id,status,decision_id,offer_id,data) values(i,o,offer.carrier_id,offer.freight_request_id,'AUTHORIZED',ref,offer.id,
   jsonb_build_object('carrierReference',null,'confirmedAt',null,'authorizedAt',now(),'authorizedBy',p_member_id,'authorizationStatus','AUTHORIZED','carrierConfirmationStatus','PENDING','capacityEvidence','[]'::jsonb,'authorizationEvidence',v->'evidence'));result:=private.workflow_record(k,i);
 elsif p_action='executions.create' then
  ref:=(v->>'bookingId')::uuid;payload:=private.workflow_scope(o,c,'bookings',ref);select * into b from public.v2_bookings where id=ref;
  if b.status not in ('AUTHORIZED','CONFIRMED') then raise exception 'BOOKING_NOT_AUTHORIZED' using errcode='PT409';end if;
  select min(aa.starts_at),max(aa.ends_at) into window_start,window_end from public.plan_leg_assignments aa join public.v2_carrier_offers oo on aa.plan_id=oo.plan_id
   where oo.id=b.offer_id and aa.carrier_service_id=(v->>'serviceId')::uuid and oo.data->'coveredAssignmentIds' ? aa.id::text;
  if window_start is null then raise exception 'EXECUTION_SERVICE_NOT_BOOKED' using errcode='PT400';end if;
  insert into public.transport_executions(id,organization_id,freight_request_id,carrier_id,carrier_service_id,booking_id,status,planned_starts_at,planned_ends_at,data)
   values(i,b.organization_id,b.freight_request_id,b.carrier_id,(v->>'serviceId')::uuid,ref,'PLANNED',window_start,window_end,jsonb_build_object('createdBy',p_member_id));result:=private.workflow_record(k,i);
 elsif p_action='consolidations.create' then
  if not exists(select 1 from public.carrier_services ss join public.capacity_calendars cc on cc.carrier_service_id=ss.id where ss.id=(v->>'serviceId')::uuid and ss.carrier_id=c and ss.service_type='LTL' and ss.transport_mode='ROAD' and cc.id=(v->>'calendarId')::uuid and cc.transport_asset_id is not null)
   or not exists(select 1 from public.route_plans rr join public.transport_plan_candidates pp on pp.route_plan_id=rr.id join public.carrier_opportunities oo on oo.parent_id=pp.id where rr.id=(v->>'routeId')::uuid and oo.carrier_id=c)
   or not private.workflow_evidence(v->'evidence',(v#>>'{window,startsAt}')::timestamptz,(v#>>'{window,endsAt}')::timestamptz) then raise exception 'CONSOLIDATION_EVIDENCE_REQUIRED' using errcode='PT409';end if;
  insert into public.capacity_consolidations(id,carrier_id,status,data,carrier_service_id,calendar_id,route_id) values(i,c,'OPEN',v,(v->>'serviceId')::uuid,(v->>'calendarId')::uuid,(v->>'routeId')::uuid);result:=private.workflow_record(k,i);
 elsif p_action='consolidations.close' then
  if old->>'status'<>'OPEN' or exists(select 1 from public.capacity_reservations where consolidation_id=i and status in ('HELD','CONFIRMED')) then raise exception 'CONSOLIDATION_HAS_COMMITMENTS' using errcode='PT409';end if;
  update public.capacity_consolidations set status='CLOSED',version=version+1,updated_at=now(),data=data||jsonb_build_object('closure',v) where id=i;result:=private.workflow_record(k,i);
 elsif p_action='holds.create' then
  payload:=private.workflow_scope(o,null,'bookings',(v->>'bookingId')::uuid);select * into b from public.v2_bookings where id=(v->>'bookingId')::uuid;
  select * into offer from public.v2_carrier_offers where id=b.offer_id;
  select * into ass from public.plan_leg_assignments where id=(v->>'assignmentId')::uuid and plan_id=offer.plan_id;
  select * into res from public.plan_resources where id=ass.resource_id;
  if b.status not in ('AUTHORIZED','CONFIRMED') or not private.workflow_offer_current(offer.id) or ass.id is null
    or not offer.data->'coveredAssignmentIds' ? ass.id::text then raise exception 'BOOKING_ASSIGNMENT_NOT_CURRENT' using errcode='PT409';end if;
  select * into e from public.transport_executions where booking_id=b.id and carrier_service_id=ass.carrier_service_id and status='PLANNED';
  if e.id is null then raise exception 'PLANNED_EXECUTION_REQUIRED' using errcode='PT409';end if;
  if v->>'consolidationId' is not null then
   if not private.workflow_trip_compatible((v->>'consolidationId')::uuid,ass.plan_id,ass.carrier_service_id,res.calendar_id,ass.starts_at,ass.ends_at) then raise exception 'CONSOLIDATION_ROUTE_MISMATCH' using errcode='PT400';end if;
   if e.consolidation_id is not null and e.consolidation_id<>(v->>'consolidationId')::uuid then raise exception 'IMMUTABLE_EXECUTION_TRIP' using errcode='PT400';end if;
   update public.transport_executions set consolidation_id=(v->>'consolidationId')::uuid where id=e.id;
  end if;
  if (v->>'expiresAt')::timestamptz<=now() or (v->>'expiresAt')::timestamptz>ass.ends_at or not private.workflow_evidence(v->'evidence',ass.starts_at,ass.ends_at) then raise exception 'HOLD_EVIDENCE_OR_EXPIRY_INVALID' using errcode='PT400';end if;
  payload:=jsonb_build_object('reference',v#>'{evidence,reference}','verifiedAt',v#>'{evidence,observedAt}','validUntil',v#>'{evidence,validUntil}','provenanceStatus',v#>'{evidence,provenanceStatus}');
  insert into public.capacity_reservations(id,capacity_calendar_id,freight_request_id,starts_at,ends_at,status,booking_id,plan_assignment_id,execution_id,expires_at,committed_capacity,source,reference,evidence,consolidation_id)
  values(i,res.calendar_id,b.freight_request_id,ass.starts_at,ass.ends_at,'HELD',b.id,ass.id,e.id,(v->>'expiresAt')::timestamptz,ass.data->'capacityNeeded',v#>>'{evidence,provider}',v#>>'{evidence,reference}',payload,(v->>'consolidationId')::uuid);
  if res.combination_id is not null then
   for rowid in select cc.id from public.vehicle_combination_assets mm join public.capacity_calendars cc on cc.transport_asset_id=mm.transport_asset_id where mm.combination_id=res.combination_id and cc.id<>res.calendar_id order by cc.id loop
    insert into public.capacity_reservations(capacity_calendar_id,freight_request_id,starts_at,ends_at,status,booking_id,plan_assignment_id,execution_id,expires_at,committed_capacity,source,reference,evidence,parent_reservation_id,consolidation_id)
    values(rowid,b.freight_request_id,ass.starts_at,ass.ends_at,'HELD',b.id,ass.id,e.id,(v->>'expiresAt')::timestamptz,jsonb_build_object('weightKg',0,'volumeM3',0),v#>>'{evidence,provider}',v#>>'{evidence,reference}',payload,i,(v->>'consolidationId')::uuid);
   end loop;
  end if;result:=private.workflow_record(k,i);
 elsif p_action in ('holds.confirm','holds.release') then
  select * into hold from public.capacity_reservations where id=i;select * into b from public.v2_bookings where id=hold.booking_id;
  if hold.parent_reservation_id is not null then raise exception 'GROUP_HOLD_REQUIRED' using errcode='PT400';end if;
  if p_action='holds.confirm' then
   if c is null then raise exception 'FORBIDDEN_WORKFLOW' using errcode='PT403';end if;
   if hold.status<>'HELD' or hold.expires_at<=now() or b.status not in ('AUTHORIZED','CONFIRMED') then raise exception 'HOLD_EXPIRED_OR_NOT_ACTIVE' using errcode='PT409';end if;
   if not private.workflow_current_plan((select plan_id from public.v2_carrier_offers where id=b.offer_id)) or not private.workflow_evidence(v->'evidence',hold.starts_at,hold.ends_at) then raise exception 'PLAN_OR_EVIDENCE_NOT_CURRENT' using errcode='PT409';end if;
   update public.capacity_reservations set status='CONFIRMED',version=version+1,updated_at=now() where id=i or parent_reservation_id=i;
  else
   if b.status='CONFIRMED' or exists(select 1 from public.vehicle_assignments where capacity_reservation_id=i and status='CONFIRMED') or exists(select 1 from public.transport_executions where id=hold.execution_id and status='IN_PROGRESS') then raise exception 'CANCEL_EXECUTION_OR_BOOKING_FIRST' using errcode='PT409';end if;
   update public.capacity_reservations set status='RELEASED',version=version+1,updated_at=now() where id=i or parent_reservation_id=i;
  end if;result:=private.workflow_record(k,i);
 elsif p_action='bookings.confirm' then
  if c is null then raise exception 'FORBIDDEN_WORKFLOW' using errcode='PT403';end if;
  select * into b from public.v2_bookings where id=i;
  if b.status<>'AUTHORIZED' then raise exception 'INVALID_BOOKING_STATE' using errcode='PT409';end if;
  if v->>'confirmation'='REJECTED' then perform private.workflow_release_booking(b.id,false);new_status:='REJECTED';
  else
   select * into offer from public.v2_carrier_offers where id=b.offer_id;
   if not private.workflow_evidence(v->'evidence',(offer.data#>>'{validity,startsAt}')::timestamptz,now()) then raise exception 'CONFIRMATION_EVIDENCE_REQUIRED' using errcode='PT409';end if;
   if not private.workflow_offer_current(offer.id) or exists(select 1 from jsonb_array_elements_text(offer.data->'coveredAssignmentIds') x where not exists(select 1 from public.capacity_reservations rr where rr.booking_id=b.id and rr.plan_assignment_id=x.value::uuid and rr.status='CONFIRMED')) then raise exception 'CAPACITY_COMMITMENT_REQUIRED' using errcode='PT409';end if;
   new_status:='CONFIRMED';
  end if;
  update public.v2_bookings set status=new_status,version=version+1,updated_at=now(),data=data||jsonb_build_object('carrierConfirmationStatus',new_status,'carrierReference',v->'carrierReference','confirmedAt',case when new_status='CONFIRMED' then now() end,'confirmationEvidence',v->'evidence','confirmedBy',p_member_id,'capacityEvidence',coalesce((select jsonb_agg(private.workflow_record('holds',rr.id)) from public.capacity_reservations rr where rr.booking_id=i and rr.status='CONFIRMED'),'[]'::jsonb)) where id=i;result:=private.workflow_record(k,i);
 elsif p_action='bookings.cancel' then
  select * into b from public.v2_bookings where id=i;
  if b.status in ('CANCELLED','REJECTED','COMPLETED') then raise exception 'INVALID_BOOKING_STATE' using errcode='PT409';end if;
  perform private.workflow_release_booking(b.id,c is not null);
  update public.v2_bookings set status='CANCELLED',version=version+1,updated_at=now(),data=data||jsonb_build_object('authorizationStatus','REVOKED','carrierConfirmationStatus','CANCELLED','cancellation',v,'cancelledAt',now(),'cancelledBy',p_member_id) where id=i;result:=private.workflow_record(k,i);
 elsif k='executions' then
  if c is null then raise exception 'FORBIDDEN_WORKFLOW' using errcode='PT403';end if;
  select * into e from public.transport_executions where id=i;select * into b from public.v2_bookings where id=e.booking_id;
  if p_action='executions.start' then
   if e.status<>'PLANNED' or b.status<>'CONFIRMED' or now()<e.planned_starts_at or now()>=e.planned_ends_at then raise exception 'EXECUTION_NOT_READY' using errcode='PT409';end if;
   if not private.workflow_current_plan((select plan_id from public.v2_carrier_offers where id=b.offer_id)) then raise exception 'PLAN_NOT_ELIGIBLE' using errcode='PT409';end if;
   if not exists(select 1 from public.driver_assignments where execution_id=i and status='CONFIRMED' and role='PRIMARY')
    or exists(select 1 from public.plan_leg_assignments aa join public.plan_resources rr on rr.id=aa.resource_id join public.v2_carrier_offers oo on oo.plan_id=aa.plan_id where oo.id=b.offer_id and aa.carrier_service_id=e.carrier_service_id and rr.asset_id is not null and not exists(select 1 from public.vehicle_assignments vv where vv.execution_id=e.id and vv.transport_asset_id=rr.asset_id and vv.status='CONFIRMED')) or (select count(*) from public.driver_assignments where execution_id=i and status='CONFIRMED' and role='PRIMARY')<(select count(distinct rr.id) from public.plan_leg_assignments aa join public.plan_resources rr on rr.id=aa.resource_id join public.v2_carrier_offers oo on oo.plan_id=aa.plan_id where oo.id=b.offer_id and aa.carrier_service_id=e.carrier_service_id and rr.asset_id is not null and rr.data->>'role'='LOAD_BEARING') then raise exception 'CONFIRMED_CREW_REQUIRED' using errcode='PT409';end if;
   update public.transport_executions set status='IN_PROGRESS',actual_started_at=now(),version=version+1,updated_at=now() where id=i;
  elsif p_action in ('executions.complete','executions.cancel') then
   if p_action='executions.complete' and e.status<>'IN_PROGRESS' or p_action='executions.cancel' and e.status not in ('PLANNED','IN_PROGRESS') then raise exception 'INVALID_EXECUTION_STATE' using errcode='PT409';end if;
   if p_action='executions.cancel' then
    perform private.workflow_release_booking(b.id,true);
    update public.v2_bookings set status='CANCELLED',version=version+1,updated_at=now(),data=data||jsonb_build_object('authorizationStatus','REVOKED','carrierConfirmationStatus','CANCELLED','cancellation',v,'cancelledAt',now(),'cancelledBy',p_member_id,'triggerExecutionId',i) where id=b.id;
   else
    perform private.workflow_release_execution(i);
    update public.transport_executions set status='COMPLETED',actual_completed_at=now(),version=version+1,updated_at=now() where id=i;
   end if;
   if p_action='executions.complete' and not exists(select 1 from jsonb_array_elements_text((select data->'coveredServiceIds' from public.v2_carrier_offers where id=b.offer_id)) ss where not exists(select 1 from public.transport_executions ee where ee.booking_id=b.id and ee.carrier_service_id=ss.value::uuid and ee.status='COMPLETED')) then update public.v2_bookings set status='COMPLETED',version=version+1,updated_at=now() where id=b.id;end if;
  elsif p_action='executions.position' then
   if not private.workflow_evidence(v->'evidence',(v->>'observedAt')::timestamptz,now()) then raise exception 'POSITION_EVIDENCE_REQUIRED' using errcode='PT409';end if;
   if e.status<>'IN_PROGRESS' or (v->>'observedAt')::timestamptz>now() or (e.data->>'lastObservedAt')::timestamptz>=(v->>'observedAt')::timestamptz then raise exception 'POSITION_OUT_OF_ORDER' using errcode='PT409';end if;
   update public.transport_executions set last_known_position=v->'location',data=data||jsonb_build_object('lastObservedAt',v->'observedAt','positionEvidence',v->'evidence'),version=version+1,updated_at=now() where id=i;
  else raise exception 'VALIDATION_ERROR' using errcode='PT400';end if;
  insert into public.execution_events(organization_id,carrier_id,freight_request_id,parent_id,status,data) values(e.organization_id,e.carrier_id,e.freight_request_id,i,'RECORDED',v||jsonb_build_object('action',p_action,'at',now(),'actorId',p_member_id));result:=private.workflow_record(k,i);
 elsif p_action='incidents.create' then
  payload:=private.workflow_scope(o,c,'executions',parent);select * into e from public.transport_executions where id=parent;
  if c is null or e.status not in ('PLANNED','IN_PROGRESS') or (v->>'occurredAt')::timestamptz>now() then raise exception 'INCIDENT_NOT_ALLOWED' using errcode='PT409';end if;
  insert into public.operational_incidents(id,organization_id,carrier_id,freight_request_id,parent_id,status,data) values(i,e.organization_id,e.carrier_id,e.freight_request_id,parent,'OPEN',v||jsonb_build_object('reportedBy',p_member_id,'status','OPEN'));result:=private.workflow_record(k,i);
 elsif p_action='incidents.update' then
  if c is null then raise exception 'FORBIDDEN_WORKFLOW' using errcode='PT403';end if;
  if v->>'action'='RESOLVE' and old->>'status'<>'OPEN' or v->>'action'='REOPEN' and old->>'status'<>'RESOLVED' then raise exception 'INVALID_INCIDENT_STATE' using errcode='PT409';end if;
  new_status:=case when v->>'action'='RESOLVE' then 'RESOLVED' when v->>'action'='REOPEN' then 'OPEN' else old->>'status' end;
  insert into public.incident_updates(organization_id,carrier_id,freight_request_id,parent_id,status,data) values((old->>'organizationId')::uuid,c,(old->>'requestId')::uuid,i,'RECORDED',v||jsonb_build_object('at',now(),'actorId',p_member_id));
  update public.operational_incidents set status=new_status,data=data||jsonb_build_object('status',new_status),version=version+1,updated_at=now() where id=i;result:=private.workflow_record(k,i);
 elsif p_action='asset-events.create' then
  if not exists(select 1 from public.transport_assets where id=parent and carrier_id=c and version=(v->>'expectedVersion')::integer) then raise exception 'STALE_DRAFT' using errcode='PT409';end if;
  if exists(select 1 from public.transport_assets where id=parent and operating_status=v->>'next') then raise exception 'INVALID_ASSET_TRANSITION' using errcode='PT409';end if;
  payload:=jsonb_build_object('at',now(),'previous',(select operating_status from public.transport_assets where id=parent),'next',v->'next','reason',v->'reason','evidence',v->'evidence','actorId',p_member_id);
  update public.transport_assets set operating_status=v->>'next',condition_reason=v->>'reason',active=v->>'next' in ('AVAILABLE','IN_SERVICE') where id=parent;
  insert into public.asset_status_events(id,carrier_id,parent_id,status,data) values(i,c,parent,'RECORDED',payload);result:=private.workflow_record(k,i);
 else raise exception 'VALIDATION_ERROR' using errcode='PT400';end if;
 insert into private.v2_workflow_receipts(organization_id,member_id,idempotency_key,payload_hash,result) values(o,p_member_id,p_key,h,result);
 return jsonb_build_object('record',result,'replay',false);end;$$;
create function public.command_v2_workflow(p_organization_id uuid,p_member_id uuid,p_action text,p_context jsonb,p_key uuid,p_value jsonb) returns jsonb language sql security definer set search_path='' as $$select private.command_v2_workflow(p_organization_id,p_member_id,p_action,p_context,p_key,p_value);$$;
revoke all on function public.command_v2_workflow(uuid,uuid,text,jsonb,uuid,jsonb) from public,anon,service_role;
grant execute on function public.command_v2_workflow(uuid,uuid,text,jsonb,uuid,jsonb) to authenticated;


create or replace function private.guard_v2_crew() returns trigger language plpgsql set search_path='' as $$
declare e public.transport_executions%rowtype;d public.drivers%rowtype;a public.transport_assets%rowtype;w jsonb;
 c public.vehicle_combinations%rowtype;r public.capacity_reservations%rowtype;cal public.capacity_calendars%rowtype;
 sec numeric;occupied_weight numeric;occupied_volume numeric;point_at timestamptz;service_class text;begin
 if current_user<>'postgres' or tg_op='DELETE' then raise exception 'COMMAND_REQUIRED' using errcode='42501';end if;
 if tg_op='UPDATE' then
  if new.id<>old.id or new.carrier_id<>old.carrier_id or new.carrier_service_id<>old.carrier_service_id then raise exception 'IMMUTABLE_FLEET_SCOPE' using errcode='PT400';end if;
  new.version:=old.version+1;new.updated_at:=now();
 end if;
 perform 1 from public.carrier_services where id=new.carrier_service_id and carrier_id=new.carrier_id and transport_mode='ROAD';
 if not found then raise exception 'INVALID_CATALOG_REFERENCE' using errcode='PT400';end if;
 if tg_table_name='drivers' then
  for w in select x from jsonb_array_elements(new.available_windows)x loop
   if (w->>'endsAt')::timestamptz<=(w->>'startsAt')::timestamptz then raise exception 'VALIDATION_ERROR' using errcode='PT400';end if;
  end loop;
  if not exists(select 1 from pg_timezone_names where name=new.license_timezone) then raise exception 'VALIDATION_ERROR' using errcode='PT400';end if;
  if new.carrier_operator_id is not null and not exists(select 1 from public.carrier_operators where id=new.carrier_operator_id and carrier_id=new.carrier_id and status='ACTIVE') then raise exception 'INVALID_CATALOG_REFERENCE' using errcode='PT400';end if;
  if tg_op='UPDATE' and exists(select 1 from public.driver_assignments where driver_id=old.id and status in ('PROPOSED','CONFIRMED') and ends_at>now()) then raise exception 'FLEET_COMMITMENT_CONFLICT' using errcode='PT409';end if;
 elsif tg_table_name='vehicle_combinations' then
  if tg_op='UPDATE' and exists(select 1 from public.vehicle_assignments where vehicle_combination_id=old.id and status in ('PROPOSED','CONFIRMED') and ends_at>now()) then raise exception 'FLEET_COMMITMENT_CONFLICT' using errcode='PT409';end if;
  if new.status='COUPLED' and not private.crew_evidence(new.compatibility_evidence,new.starts_at,new.ends_at) then raise exception 'FLEET_EVIDENCE_REQUIRED' using errcode='PT409';end if;
 else
  select * into e from public.transport_executions where id=new.execution_id;
  if e.id is null or e.carrier_id<>new.carrier_id or e.carrier_service_id<>new.carrier_service_id
   or new.starts_at<e.planned_starts_at or new.ends_at>e.planned_ends_at or e.status in ('CANCELLED','COMPLETED') then raise exception 'INVALID_CATALOG_REFERENCE' using errcode='PT400';end if;
  if tg_op='UPDATE' then
   if new.execution_id<>old.execution_id or (old.status in ('RELEASED','CANCELLED') and new.status<>old.status)
    or (old.status='CONFIRMED' and new.status='PROPOSED') then raise exception 'INVALID_ASSIGNMENT_TRANSITION' using errcode='PT400';end if;
  end if;
  if tg_table_name='driver_assignments' then
   if tg_op='UPDATE' and new.driver_id<>old.driver_id then raise exception 'IMMUTABLE_ASSIGNMENT_SOURCE' using errcode='PT400';end if;
   select * into d from public.drivers where id=new.driver_id for update;
   if d.id is null or d.carrier_id<>new.carrier_id or d.carrier_service_id<>new.carrier_service_id then raise exception 'INVALID_CATALOG_REFERENCE' using errcode='PT400';end if;
   if new.status='CONFIRMED' then
    if not private.crew_evidence(new.evidence,new.starts_at,new.ends_at) or not private.crew_evidence(new.policy_evidence,new.starts_at,new.ends_at)
     or not private.crew_evidence(d.evidence,new.starts_at,new.ends_at) or d.duty_starts_at is null or d.maximum_duty_seconds is null
     or jsonb_array_length(new.accepted_license_classes)=0 then raise exception 'FLEET_EVIDENCE_REQUIRED' using errcode='PT409';end if;
    if d.duty_status not in ('AVAILABLE','ON_DUTY') or ((d.license_valid_until+1)::timestamp at time zone d.license_timezone)<new.ends_at
     or not(new.accepted_license_classes ? d.license_class) or not(d.qualifications @> new.required_qualifications)
     or new.starts_at<d.duty_starts_at or new.ends_at>d.duty_ends_at or not private.crew_windows_cover(d.available_windows,new.starts_at,new.ends_at)
    then raise exception 'FLEET_COMMITMENT_CONFLICT' using errcode='PT409';end if;
    select coalesce(sum(extract(epoch from ends_at-starts_at)),0) into sec from public.driver_assignments
     where driver_id=new.driver_id and id<>new.id and status in ('PROPOSED','CONFIRMED') and tstzrange(starts_at,ends_at,'[)')&&tstzrange(d.duty_starts_at,d.duty_ends_at,'[)');
    if sec+d.used_duty_seconds+extract(epoch from new.ends_at-new.starts_at)>d.maximum_duty_seconds then raise exception 'FLEET_COMMITMENT_CONFLICT' using errcode='PT409';end if;
   end if;
  else
   if tg_op='UPDATE' and (new.transport_asset_id<>old.transport_asset_id or new.vehicle_combination_id is distinct from old.vehicle_combination_id
    or old.capacity_reservation_id is not null and new.capacity_reservation_id is distinct from old.capacity_reservation_id) then raise exception 'IMMUTABLE_ASSIGNMENT_SOURCE' using errcode='PT400';end if;
   select * into a from public.transport_assets where id=new.transport_asset_id for update;
   if a.id is null or a.carrier_id<>new.carrier_id or a.carrier_service_id<>new.carrier_service_id or a.mode<>'ROAD' then raise exception 'INVALID_CATALOG_REFERENCE' using errcode='PT400';end if;
   if a.asset_role='ESCORT' and ((new.capacity_committed->>'weightKg')::numeric>0 or (new.capacity_committed->>'volumeM3')::numeric>0) then raise exception 'VALIDATION_ERROR' using errcode='PT400';end if;
   if new.vehicle_combination_id is not null then
    select * into c from public.vehicle_combinations where id=new.vehicle_combination_id;
    if c.id is null or not exists(select 1 from public.vehicle_combination_assets where combination_id=c.id and transport_asset_id=a.id)
     or c.status<>'COUPLED' or c.starts_at>new.starts_at or c.ends_at<new.ends_at then raise exception 'INVALID_CATALOG_REFERENCE' using errcode='PT400';end if;
    -- One combined carrying assignment: cannot count tractor and trailer separately.
    if new.status in ('PROPOSED','CONFIRMED') and exists(select 1 from public.vehicle_assignments v where v.id<>new.id and v.status in ('PROPOSED','CONFIRMED')
     and (v.vehicle_combination_id=c.id or v.transport_asset_id in(select transport_asset_id from public.vehicle_combination_assets where combination_id=c.id))
     and tstzrange(v.starts_at,v.ends_at,'[)')&&tstzrange(new.starts_at,new.ends_at,'[)')) then raise exception 'FLEET_COMMITMENT_CONFLICT' using errcode='PT409';end if;
   elsif new.status in ('PROPOSED','CONFIRMED') and exists(select 1 from public.vehicle_combination_assets m where m.transport_asset_id=a.id and m.active
    and tstzrange(m.starts_at,m.ends_at,'[)')&&tstzrange(new.starts_at,new.ends_at,'[)')) then raise exception 'FLEET_COMMITMENT_CONFLICT' using errcode='PT409';end if;
   if new.status in ('PROPOSED','CONFIRMED') then
    if exists(select 1 from public.capacity_reservations rr join public.capacity_calendars cc on cc.id=rr.capacity_calendar_id where cc.transport_asset_id=a.id
     and rr.id is distinct from new.capacity_reservation_id and rr.status in ('HELD','CONFIRMED')
     and (new.capacity_reservation_id is not null or rr.execution_id is distinct from new.execution_id) and not private.workflow_same_trip(rr.execution_id,new.execution_id)
     and tstzrange(rr.starts_at,rr.ends_at,'[)')&&tstzrange(new.starts_at,new.ends_at,'[)')) then raise exception 'FLEET_COMMITMENT_CONFLICT' using errcode='PT409';end if;
    select s.service_type into service_class from public.carrier_services s where s.id=new.carrier_service_id;
    if exists(select 1 from public.vehicle_assignments v where v.transport_asset_id=a.id and v.id<>new.id and v.status in ('PROPOSED','CONFIRMED')
      and tstzrange(v.starts_at,v.ends_at,'[)')&&tstzrange(new.starts_at,new.ends_at,'[)') and (service_class='FTL' or v.execution_id<>new.execution_id and not private.workflow_same_trip(v.execution_id,new.execution_id)))
    then raise exception 'FLEET_COMMITMENT_CONFLICT' using errcode='PT409';end if;
    for point_at in select new.starts_at union select greatest(v.starts_at,new.starts_at) from public.vehicle_assignments v where v.transport_asset_id=a.id
      and v.id<>new.id and v.status in ('PROPOSED','CONFIRMED') and v.starts_at<new.ends_at and v.ends_at>new.starts_at loop
     select coalesce(sum((capacity_committed->>'weightKg')::numeric),0),coalesce(sum((capacity_committed->>'volumeM3')::numeric),0)
      into occupied_weight,occupied_volume from public.vehicle_assignments where transport_asset_id=a.id and id<>new.id and status in ('PROPOSED','CONFIRMED') and starts_at<=point_at and ends_at>point_at;
     if a.max_weight_kg is not null and occupied_weight+(new.capacity_committed->>'weightKg')::numeric>a.max_weight_kg
      or a.max_volume_m3 is not null and occupied_volume+(new.capacity_committed->>'volumeM3')::numeric>a.max_volume_m3
      or exists(select 1 from public.carrier_services s where s.id=new.carrier_service_id and (
       s.max_capacity_kg is not null and occupied_weight+(new.capacity_committed->>'weightKg')::numeric>s.max_capacity_kg
       or s.max_volume_m3 is not null and occupied_volume+(new.capacity_committed->>'volumeM3')::numeric>s.max_volume_m3)) then raise exception 'FLEET_COMMITMENT_CONFLICT' using errcode='PT409';end if;
    end loop;
    if not a.active or exists(select 1 from public.scheduled_maintenances where transport_asset_id=a.id and status in ('SCHEDULED','IN_PROGRESS') and tstzrange(starts_at,ends_at,'[)')&&tstzrange(new.starts_at,new.ends_at,'[)'))
     or exists(select 1 from public.repositioning_blocks b join public.capacity_calendars cc on cc.id=b.capacity_calendar_id where cc.transport_asset_id=a.id and b.status in ('PLANNED','IN_PROGRESS')
       and tstzrange(b.starts_at,b.ends_at,'[)')&&tstzrange(new.starts_at,new.ends_at,'[)')) then raise exception 'FLEET_COMMITMENT_CONFLICT' using errcode='PT409';end if;
   end if;
   if new.status='CONFIRMED' then
    if not private.crew_evidence(new.evidence,new.starts_at,new.ends_at) then raise exception 'FLEET_EVIDENCE_REQUIRED' using errcode='PT409';end if;
    select * into r from public.capacity_reservations where id=new.capacity_reservation_id for update;
    select * into cal from public.capacity_calendars where id=r.capacity_calendar_id;
    if r.id is null or r.status<>'CONFIRMED' or r.execution_id is distinct from new.execution_id or r.freight_request_id is distinct from e.freight_request_id
     or cal.transport_asset_id is distinct from a.id or cal.carrier_id<>new.carrier_id or cal.carrier_service_id<>new.carrier_service_id
     or r.starts_at>new.starts_at or r.ends_at<new.ends_at then raise exception 'FLEET_COMMITMENT_CONFLICT' using errcode='PT409';end if;
    if not private.crew_evidence(r.evidence,new.starts_at,new.ends_at) or r.committed_capacity is null
      or a.asset_role='CARRIER' and (a.evidence is null or new.vehicle_combination_id is null and (a.max_weight_kg is null or a.max_volume_m3 is null))
      or not cal.complete or cal.provenance_status not in ('VERIFIED','SIMULATED') or cal.observed_at is null or cal.observed_at>now() or cal.valid_until is null or cal.valid_until<new.ends_at
      or not private.crew_windows_cover(cal.available_windows,new.starts_at,new.ends_at) then raise exception 'FLEET_EVIDENCE_REQUIRED' using errcode='PT409';end if;
    select coalesce(sum((capacity_committed->>'weightKg')::numeric),0),coalesce(sum((capacity_committed->>'volumeM3')::numeric),0) into occupied_weight,occupied_volume
     from public.vehicle_assignments where capacity_reservation_id=r.id and id<>new.id and status='CONFIRMED';
    if occupied_weight+(new.capacity_committed->>'weightKg')::numeric>(r.committed_capacity->>'weightKg')::numeric
     or occupied_volume+(new.capacity_committed->>'volumeM3')::numeric>(r.committed_capacity->>'volumeM3')::numeric then raise exception 'FLEET_COMMITMENT_CONFLICT' using errcode='PT409';end if;
    if new.vehicle_combination_id is not null then
     if not private.workflow_combination_commitment(new.capacity_reservation_id,new.vehicle_combination_id,(new.capacity_committed->>'weightKg')::numeric,(new.capacity_committed->>'volumeM3')::numeric) then raise exception 'FLEET_EVIDENCE_REQUIRED' using errcode='PT409';end if;
    end if;
   end if;
  end if;
 end if;return new;end;$$;

create or replace function private.guard_v2_crew_dependencies() returns trigger language plpgsql security definer set search_path='' as $$declare asset_id uuid;sid uuid;begin
 if tg_table_name='capacity_reservations' then
  select transport_asset_id,carrier_service_id into asset_id,sid from public.capacity_calendars where id=new.capacity_calendar_id;
  perform 1 from public.carrier_services where id=sid for update;
  if tg_op='UPDATE' and exists(select 1 from public.vehicle_assignments where capacity_reservation_id=old.id and status='CONFIRMED') then
   if new.status<>'CONFIRMED' or new.capacity_calendar_id<>old.capacity_calendar_id or new.execution_id is distinct from old.execution_id
    or new.starts_at<>old.starts_at or new.ends_at<>old.ends_at or new.committed_capacity is distinct from old.committed_capacity
    or new.evidence is distinct from old.evidence or new.freight_request_id is distinct from old.freight_request_id then raise exception 'FLEET_COMMITMENT_CONFLICT' using errcode='PT409';end if;
  end if;
  if new.status in ('HELD','CONFIRMED') and exists(select 1 from public.vehicle_assignments where transport_asset_id=asset_id and status in ('PROPOSED','CONFIRMED')
   and capacity_reservation_id is distinct from new.id and (status='CONFIRMED' or execution_id is distinct from new.execution_id or capacity_reservation_id is not null) and not private.workflow_same_trip(execution_id,new.execution_id)
   and tstzrange(starts_at,ends_at,'[)')&&tstzrange(new.starts_at,new.ends_at,'[)')) then raise exception 'FLEET_COMMITMENT_CONFLICT' using errcode='PT409';end if;
 elsif tg_table_name in ('transport_assets','capacity_calendars') then
  if tg_table_name='capacity_calendars' then
   if new.complete=false and new.provenance_status='UNKNOWN' and new.valid_until is null
   and (to_jsonb(new)-array['complete','provenance_status','observed_at','valid_until'])=(to_jsonb(old)-array['complete','provenance_status','observed_at','valid_until'])
   and not exists(select 1 from public.vehicle_assignments where transport_asset_id=new.transport_asset_id and status in ('PROPOSED','CONFIRMED') and ends_at>now()) then return new;end if;
  end if;
  if tg_table_name='transport_assets' then asset_id:=new.id;else asset_id:=new.transport_asset_id;end if;
  if exists(select 1 from public.vehicle_assignments where transport_asset_id=asset_id and status in ('PROPOSED','CONFIRMED') and ends_at>now())
   or exists(select 1 from public.vehicle_combination_assets where transport_asset_id=asset_id and active and ends_at>now()) then raise exception 'FLEET_COMMITMENT_CONFLICT' using errcode='PT409';end if;
 else
  if tg_table_name='scheduled_maintenances' then asset_id:=new.transport_asset_id;else select transport_asset_id into asset_id from public.capacity_calendars where id=new.capacity_calendar_id;end if;
  if new.status in ('SCHEDULED','IN_PROGRESS','PLANNED') and exists(select 1 from public.vehicle_assignments where transport_asset_id=asset_id and status in ('PROPOSED','CONFIRMED')
   and tstzrange(starts_at,ends_at,'[)')&&tstzrange(new.starts_at,new.ends_at,'[)')) then raise exception 'FLEET_COMMITMENT_CONFLICT' using errcode='PT409';end if;
 end if;return new;end;$$;
revoke all on function private.workflow_member(uuid,uuid,boolean) from public,anon,authenticated,service_role;
revoke all on function private.workflow_carrier(uuid) from public,anon,authenticated,service_role;
revoke all on function private.workflow_admin() from public,anon,authenticated,service_role;
revoke all on function private.workflow_evidence(jsonb,timestamptz,timestamptz) from public,anon,authenticated,service_role;
revoke all on function private.workflow_guard() from public,anon,authenticated,service_role;
revoke all on function private.workflow_validate_periods(jsonb) from public,anon,authenticated,service_role;
revoke all on function private.workflow_table(text) from public,anon,authenticated,service_role;
revoke all on function private.workflow_record(text,uuid) from public,anon,authenticated,service_role;
revoke all on function private.workflow_request(uuid,uuid) from public,anon,authenticated,service_role;
revoke all on function private.workflow_scope(uuid,uuid,text,uuid) from public,anon,authenticated,service_role;
revoke all on function private.workflow_area(uuid,jsonb,timestamptz,timestamptz) from public,anon,authenticated,service_role;
revoke all on function private.workflow_route(uuid,uuid,jsonb,uuid,uuid) from public,anon,authenticated,service_role;
revoke all on function private.workflow_current_plan(uuid) from public,anon,authenticated,service_role;
revoke all on function private.read_v2_workflow(uuid,uuid,text,jsonb,integer,integer) from public,anon,authenticated,service_role;
revoke all on function private.workflow_evaluate_plan(uuid) from public,anon,authenticated,service_role;
revoke all on function private.workflow_current_plan(uuid) from public,anon,authenticated,service_role;
revoke all on function private.workflow_build_plan(uuid,uuid,jsonb,uuid) from public,anon,authenticated,service_role;
revoke all on function private.workflow_offer_capacity(uuid) from public,anon,authenticated,service_role;
revoke all on function private.workflow_offer_current(uuid) from public,anon,authenticated,service_role;
revoke all on function private.workflow_offer(uuid,uuid,uuid,uuid,jsonb,uuid) from public,anon,authenticated,service_role;
revoke all on function private.workflow_ranking(uuid,uuid,uuid,uuid) from public,anon,authenticated,service_role;
revoke all on function private.workflow_selection(uuid,uuid,uuid,jsonb,uuid) from public,anon,authenticated,service_role;
revoke all on function private.workflow_release_execution(uuid) from public,anon,authenticated,service_role;
revoke all on function private.workflow_release_booking(uuid,boolean) from public,anon,authenticated,service_role;
revoke all on function private.workflow_expire_holds() from public,anon,authenticated,service_role;
revoke all on function private.workflow_same_trip(uuid,uuid) from public,anon,authenticated,service_role;
revoke all on function private.workflow_trip_compatible(uuid,uuid,uuid,uuid,timestamptz,timestamptz) from public,anon,authenticated,service_role;
revoke all on function private.workflow_reservation_sharing() from public,anon,authenticated,service_role;
revoke all on function private.workflow_combination_commitment(uuid,uuid,numeric,numeric) from public,anon,authenticated,service_role;
revoke all on function private.workflow_carrier_status_guard() from public,anon,authenticated,service_role;
revoke all on function private.workflow_validate(text,jsonb) from public,anon,authenticated,service_role;
revoke all on function private.command_v2_workflow(uuid,uuid,text,jsonb,uuid,jsonb) from public,anon,authenticated,service_role;
revoke all on function private.guard_v2_crew() from public,anon,authenticated,service_role;
revoke all on function private.guard_v2_crew_dependencies() from public,anon,authenticated,service_role;
create index capacity_consolidations_calendar_id_fkey_fk_idx on public.capacity_consolidations(calendar_id);
create index capacity_consolidations_route_id_fkey_fk_idx on public.capacity_consolidations(route_id);
create index consolidation_service_fk_fk_idx on public.capacity_consolidations(carrier_service_id,carrier_id);
create index capacity_reservations_freight_request_id_fkey_fk_idx on public.capacity_reservations(freight_request_id);
create index capacity_reservations_parent_reservation_id_fke_fk_idx on public.capacity_reservations(parent_reservation_id);
create index reservation_plan_assignment_fk_fk_idx on public.capacity_reservations(plan_assignment_id);
create index plan_leg_assignments_carrier_service_id_fkey_fk_idx on public.plan_leg_assignments(carrier_service_id);
create index plan_leg_assignments_lane_id_fkey_fk_idx on public.plan_leg_assignments(lane_id);
create index plan_leg_assignments_plan_id_fkey_fk_idx on public.plan_leg_assignments(plan_id);
create index plan_leg_assignments_resource_id_plan_id_fkey_fk_idx on public.plan_leg_assignments(resource_id,plan_id);
create index plan_leg_assignments_route_leg_id_fkey_fk_idx on public.plan_leg_assignments(route_leg_id);
create index plan_resources_asset_id_fkey_fk_idx on public.plan_resources(asset_id);
create index plan_resources_calendar_id_fkey_fk_idx on public.plan_resources(calendar_id);
create index plan_resources_capacity_pool_id_fkey_fk_idx on public.plan_resources(capacity_pool_id);
create index plan_resources_carrier_id_fkey_fk_idx on public.plan_resources(carrier_id);
create index plan_resources_carrier_service_id_carrier_id_fk_fk_idx on public.plan_resources(carrier_service_id,carrier_id);
create index plan_resources_combination_id_fkey_fk_idx on public.plan_resources(combination_id);
create index plan_resources_plan_id_fkey_fk_idx on public.plan_resources(plan_id);
create index ranked_options_offer_id_fkey_fk_idx on public.ranked_options(offer_id);
create index route_corridors_destination_node_id_fkey_fk_idx on public.route_corridors(destination_node_id);
create index route_corridors_origin_node_id_fkey_fk_idx on public.route_corridors(origin_node_id);
create index route_legs_corridor_id_fkey_fk_idx on public.route_legs(corridor_id);
create index route_plans_policy_id_fkey_fk_idx on public.route_plans(policy_id);
create index resource_limit_service_fk_fk_idx on public.route_resource_limits(carrier_service_id,carrier_id);
create index route_resource_limits_asset_id_fkey_fk_idx on public.route_resource_limits(asset_id);
create index route_resource_limits_combination_id_fkey_fk_idx on public.route_resource_limits(combination_id);
create index route_resource_limits_corridor_id_fkey_fk_idx on public.route_resource_limits(corridor_id);
create index selection_decisions_plan_id_fkey_fk_idx on public.selection_decisions(plan_id);
create index selection_decisions_selected_by_fkey_fk_idx on public.selection_decisions(selected_by);
create index selection_offers_offer_id_fkey_fk_idx on public.selection_offers(offer_id);
create index transport_executions_carrier_id_fkey_fk_idx on public.transport_executions(carrier_id);
create index transport_executions_carrier_service_id_carrier_fk_idx on public.transport_executions(carrier_service_id,carrier_id);
create index transport_executions_consolidation_id_fkey_fk_idx on public.transport_executions(consolidation_id);
create index transport_plan_candidates_route_plan_id_fkey_fk_idx on public.transport_plan_candidates(route_plan_id);
create index v2_bookings_offer_id_fkey_fk_idx on public.v2_bookings(offer_id);
create index v2_carrier_offers_plan_id_fkey_fk_idx on public.v2_carrier_offers(plan_id);
create index v2_carrier_offers_supersedes_offer_id_fkey_fk_idx on public.v2_carrier_offers(supersedes_offer_id);
create index v2_rankings_policy_id_fkey_fk_idx on public.v2_rankings(policy_id);

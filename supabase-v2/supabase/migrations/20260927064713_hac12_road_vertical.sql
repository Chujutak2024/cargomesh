-- HAC-12 ROAD vertical. Structural data only; scenario rows live in supabase/scenarios.
-- PostgreSQL applies each migration in one transaction. Legacy V1 tables remain intact.

alter table public.freight_requests
  add column v2_snapshot jsonb,
  add column v2_creation_payload jsonb,
  add column v2_contract_version text,
  add column delivery_window_start timestamptz,
  add column delivery_window_end timestamptz,
  add column required_equipment_code text,
  add column budget_currency text,
  add column pickup_contact_email text,
  add column recipient_contact_email text,
  add constraint freight_requests_v2_snapshot_shape check (
    v2_snapshot is null or
    (jsonb_typeof(v2_snapshot) = 'object' and
     jsonb_typeof(v2_creation_payload) = 'object' and
     v2_contract_version = '2.0' and
     v2_snapshot ->> 'schemaVersion' = '2.0' and
     v2_snapshot ? 'cargoSpecification' and
     v2_snapshot ? 'contacts' and
     budget_currency is distinct from 'PEN')
  ),
  add constraint freight_requests_v2_delivery_window check (
    delivery_window_start is null or
    (delivery_window_end is not null and delivery_window_end > delivery_window_start)
  ),
  add constraint freight_requests_v2_budget_currency check (
    budget_currency is null or budget_currency = 'USD'
  );

create index freight_requests_v2_org_created_idx
  on public.freight_requests (organization_id, created_at desc)
  where v2_contract_version = '2.0';

-- One carrying asset belongs to one published ROAD service for this cut.
alter table public.carrier_services
  add constraint carrier_services_id_carrier_unique unique (id, carrier_id);

create table public.transport_assets (
  id uuid primary key default gen_random_uuid(),
  carrier_id uuid not null references public.carriers(id),
  carrier_service_id uuid not null,
  code text not null,
  mode text not null default 'ROAD' check (mode = 'ROAD'),
  equipment_code text not null,
  asset_role text not null default 'CARRIER' check (asset_role in ('CARRIER','ESCORT')),
  plate text,
  axle_config text,
  max_weight_kg numeric(14,2) check (max_weight_kg > 0),
  max_volume_m3 numeric(14,3) check (max_volume_m3 > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (carrier_id, code),
  unique (id, carrier_service_id),
  foreign key (carrier_service_id, carrier_id)
    references public.carrier_services(id, carrier_id)
);
create index transport_assets_service_active_idx
  on public.transport_assets(carrier_service_id, active);

create table public.asset_cargo_capabilities (
  transport_asset_id uuid not null references public.transport_assets(id) on delete cascade,
  cargo_category_id uuid not null references public.cargo_categories(id),
  temperature_min_c numeric(6,2),
  temperature_max_c numeric(6,2),
  certifications jsonb not null default '[]'::jsonb
    check (jsonb_typeof(certifications) = 'array'),
  primary key (transport_asset_id, cargo_category_id),
  check (temperature_min_c is null or temperature_max_c is null
    or temperature_max_c >= temperature_min_c)
);
create index asset_cargo_capabilities_category_idx
  on public.asset_cargo_capabilities(cargo_category_id);

-- A capacity pool is contracted capacity, not a fictitious individual truck.
create table public.capacity_pools (
  id uuid primary key default gen_random_uuid(),
  carrier_id uuid not null references public.carriers(id),
  carrier_service_id uuid not null,
  code text not null,
  equipment_code text,
  max_weight_kg numeric(14,2) check (max_weight_kg > 0),
  max_volume_m3 numeric(14,3) check (max_volume_m3 > 0),
  supported_cargo_category_ids uuid[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (carrier_id, code),
  unique (id, carrier_service_id),
  foreign key (carrier_service_id, carrier_id)
    references public.carrier_services(id, carrier_id)
);
create index capacity_pools_service_active_idx
  on public.capacity_pools(carrier_service_id, active);

create table public.capacity_calendars (
  id uuid primary key default gen_random_uuid(),
  carrier_service_id uuid not null references public.carrier_services(id),
  transport_asset_id uuid,
  capacity_pool_id uuid,
  complete boolean not null default false,
  available_windows jsonb not null default '[]'::jsonb
    check (jsonb_typeof(available_windows) = 'array'),
  source_reference text not null check (length(btrim(source_reference)) > 0),
  provenance_status text not null default 'UNKNOWN'
    check (provenance_status in ('VERIFIED','ESTIMATED','SIMULATED','UNKNOWN')),
  observed_at timestamptz,
  valid_until timestamptz,
  version integer not null default 1 check (version > 0),
  updated_at timestamptz not null default now(),
  constraint capacity_calendars_xor_source_chk
    check (num_nonnulls(transport_asset_id, capacity_pool_id) = 1),
  foreign key (transport_asset_id, carrier_service_id)
    references public.transport_assets(id, carrier_service_id),
  foreign key (capacity_pool_id, carrier_service_id)
    references public.capacity_pools(id, carrier_service_id)
);
create unique index capacity_calendars_asset_unique
  on public.capacity_calendars(transport_asset_id) where transport_asset_id is not null;
create unique index capacity_calendars_pool_unique
  on public.capacity_calendars(capacity_pool_id) where capacity_pool_id is not null;
create index capacity_calendars_service_idx
  on public.capacity_calendars(carrier_service_id);

create table public.capacity_reservations (
  id uuid primary key default gen_random_uuid(),
  capacity_calendar_id uuid not null references public.capacity_calendars(id) on delete cascade,
  freight_request_id uuid references public.freight_requests(id),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null check (status in ('HELD','CONFIRMED','RELEASED')),
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index capacity_reservations_calendar_window_idx
  on public.capacity_reservations(capacity_calendar_id, starts_at, ends_at)
  where status in ('HELD','CONFIRMED');

create table public.scheduled_maintenances (
  id uuid primary key default gen_random_uuid(),
  transport_asset_id uuid not null references public.transport_assets(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text not null,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index scheduled_maintenances_asset_window_idx
  on public.scheduled_maintenances(transport_asset_id, starts_at, ends_at);

create table public.repositioning_blocks (
  id uuid primary key default gen_random_uuid(),
  capacity_calendar_id uuid not null references public.capacity_calendars(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text not null,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index repositioning_blocks_calendar_window_idx
  on public.repositioning_blocks(capacity_calendar_id, starts_at, ends_at);

-- No carrier self-service principal exists in Sprint 2. Only authenticated
-- organization members can read the catalog; writes remain service-only.
alter table public.transport_assets enable row level security;
alter table public.asset_cargo_capabilities enable row level security;
alter table public.capacity_pools enable row level security;
alter table public.capacity_calendars enable row level security;
alter table public.capacity_reservations enable row level security;
alter table public.scheduled_maintenances enable row level security;
alter table public.repositioning_blocks enable row level security;

revoke all on public.transport_assets, public.asset_cargo_capabilities,
  public.capacity_pools, public.capacity_calendars, public.capacity_reservations,
  public.scheduled_maintenances, public.repositioning_blocks from anon, authenticated;
-- Expose only evaluator inputs. Plate, maintenance reason and the freight
-- request behind another carrier's reservation are not public catalog data.
grant select (id, carrier_id, carrier_service_id, equipment_code, asset_role,
  max_weight_kg, max_volume_m3, active) on public.transport_assets to authenticated;
grant select (transport_asset_id, cargo_category_id, temperature_min_c,
  temperature_max_c, certifications) on public.asset_cargo_capabilities to authenticated;
grant select (id, carrier_id, carrier_service_id, equipment_code,
  max_weight_kg, max_volume_m3, supported_cargo_category_ids, active)
  on public.capacity_pools to authenticated;
grant select (id, carrier_service_id, transport_asset_id, capacity_pool_id,
  complete, available_windows, source_reference, provenance_status,
  observed_at, valid_until, version, updated_at)
  on public.capacity_calendars to authenticated;
grant select (capacity_calendar_id, starts_at, ends_at, status)
  on public.capacity_reservations to authenticated;
grant select (transport_asset_id, starts_at, ends_at)
  on public.scheduled_maintenances to authenticated;
grant select (capacity_calendar_id, starts_at, ends_at)
  on public.repositioning_blocks to authenticated;

create policy transport_assets_member_select on public.transport_assets
  for select to authenticated using ((select private.has_any_organization()));
create policy asset_cargo_capabilities_member_select on public.asset_cargo_capabilities
  for select to authenticated using ((select private.has_any_organization()));
create policy capacity_pools_member_select on public.capacity_pools
  for select to authenticated using ((select private.has_any_organization()));
create policy capacity_calendars_member_select on public.capacity_calendars
  for select to authenticated using ((select private.has_any_organization()));
create policy capacity_reservations_member_select on public.capacity_reservations
  for select to authenticated using ((select private.has_any_organization()));
create policy scheduled_maintenances_member_select on public.scheduled_maintenances
  for select to authenticated using ((select private.has_any_organization()));
create policy repositioning_blocks_member_select on public.repositioning_blocks
  for select to authenticated using ((select private.has_any_organization()));

-- RLS intentionally hides another tenant's facility from ordinary SELECT.
-- This private helper reveals no row or location, only the contractual error
-- distinction after verifying the caller's active authoring membership.
create function private.assert_v2_facility_not_foreign(
  p_facility_id uuid, p_organization_id uuid
) returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null or not exists (
    select 1 from public.organization_members om
      where om.organization_id = p_organization_id
        and om.auth_user_id = (select auth.uid())
        and om.status = 'ACTIVE' and om.role in ('OWNER','SUPERVISOR')
  ) then
    raise exception 'FORBIDDEN_TENANT' using errcode = 'PT403';
  end if;
  if exists (
    select 1 from public.facilities f
      where f.id = p_facility_id and f.organization_id <> p_organization_id
  ) then
    raise exception 'FORBIDDEN_TENANT' using errcode = 'PT403';
  end if;
end;
$$;
revoke all on function private.assert_v2_facility_not_foreign(uuid,uuid)
  from public, anon, authenticated;
grant execute on function private.assert_v2_facility_not_foreign(uuid,uuid)
  to authenticated;

-- The draft, its creation receipt, and canonical facility snapshots are one
-- PostgreSQL statement. An exception aborts all of them; no partial success.
create function public.create_v2_freight_request(
  p_organization_id uuid,
  p_member_id uuid,
  p_idempotency_key uuid,
  p_payload_hash text,
  p_payload jsonb
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_member public.organization_members%rowtype;
  v_category public.cargo_categories%rowtype;
  v_origin public.facilities%rowtype;
  v_destination public.facilities%rowtype;
  v_origin_json jsonb;
  v_destination_json jsonb;
  v_payload jsonb;
  v_cargo jsonb;
  v_request public.freight_requests%rowtype;
  v_id uuid;
  v_replay boolean := false;
begin
  if p_idempotency_key is null or p_payload_hash !~ '^[0-9a-f]{64}$'
     or jsonb_typeof(p_payload) is distinct from 'object'
     or p_payload ->> 'schemaVersion' is distinct from '2.0'
     or p_payload -> 'acceptedModes' is distinct from '["ROAD"]'::jsonb
     or (p_payload ? 'budget' and p_payload -> 'budget' <> 'null'::jsonb
         and p_payload #>> '{budget,currency}' is distinct from 'USD') then
    raise exception 'VALIDATION_ERROR' using errcode = 'PT400';
  end if;
  if p_payload ? 'organizationId'
     and p_payload ->> 'organizationId' is distinct from p_organization_id::text then
    raise exception 'FORBIDDEN_TENANT' using errcode = 'PT403';
  end if;

  select * into v_member from public.organization_members
    where id = p_member_id and organization_id = p_organization_id
      and status = 'ACTIVE' and role in ('OWNER','SUPERVISOR');
  if not found or (current_user <> 'service_role'
                   and v_member.auth_user_id is distinct from auth.uid()) then
    raise exception 'FORBIDDEN_TENANT' using errcode = 'PT403';
  end if;

  select * into v_request from public.freight_requests
    where organization_id = p_organization_id
      and requested_by_member_id = p_member_id
      and creation_idempotency_key = p_idempotency_key;
  if found then
    if v_request.creation_payload_hash is distinct from p_payload_hash
       or v_request.v2_creation_payload is distinct from p_payload then
      raise exception 'IDEMPOTENCY_CONFLICT' using errcode = 'PT409';
    end if;
    v_replay := true;
  else
    select * into v_category from public.cargo_categories
      where code = p_payload #>> '{cargoSpecification,categoryCode}' and active;
    if not found then
      raise exception 'VALIDATION_ERROR' using errcode = 'PT400';
    end if;

    if p_payload #>> '{origin,facilityId}' is not null then
      select * into v_origin from public.facilities
        where id = (p_payload #>> '{origin,facilityId}')::uuid and active;
      if not found then
        perform private.assert_v2_facility_not_foreign(
          (p_payload #>> '{origin,facilityId}')::uuid, p_organization_id);
        raise exception 'VALIDATION_ERROR' using errcode = 'PT400';
      end if;
      if v_origin.organization_id <> p_organization_id then
        raise exception 'FORBIDDEN_TENANT' using errcode = 'PT403';
      end if;
      v_origin_json := jsonb_build_object(
        'facilityId', v_origin.id, 'label', v_origin.name,
        'countryCode', v_origin.country_code, 'region', v_origin.region_code,
        'city', v_origin.city, 'lat', v_origin.latitude, 'lng', v_origin.longitude);
    else
      if coalesce(p_payload #>> '{origin,label}', '') = ''
         or coalesce(p_payload #>> '{origin,countryCode}', '') = ''
         or coalesce(p_payload #>> '{origin,city}', '') = '' then
        raise exception 'VALIDATION_ERROR' using errcode = 'PT400';
      end if;
      v_origin_json := jsonb_build_object(
        'facilityId', null, 'label', p_payload #>> '{origin,label}',
        'countryCode', p_payload #>> '{origin,countryCode}',
        'region', p_payload #>> '{origin,region}',
        'city', p_payload #>> '{origin,city}', 'lat', null, 'lng', null);
    end if;

    if p_payload #>> '{destination,facilityId}' is not null then
      select * into v_destination from public.facilities
        where id = (p_payload #>> '{destination,facilityId}')::uuid and active;
      if not found then
        perform private.assert_v2_facility_not_foreign(
          (p_payload #>> '{destination,facilityId}')::uuid, p_organization_id);
        raise exception 'VALIDATION_ERROR' using errcode = 'PT400';
      end if;
      if v_destination.organization_id <> p_organization_id then
        raise exception 'FORBIDDEN_TENANT' using errcode = 'PT403';
      end if;
      v_destination_json := jsonb_build_object(
        'facilityId', v_destination.id, 'label', v_destination.name,
        'countryCode', v_destination.country_code, 'region', v_destination.region_code,
        'city', v_destination.city, 'lat', v_destination.latitude, 'lng', v_destination.longitude);
    else
      if coalesce(p_payload #>> '{destination,label}', '') = ''
         or coalesce(p_payload #>> '{destination,countryCode}', '') = ''
         or coalesce(p_payload #>> '{destination,city}', '') = '' then
        raise exception 'VALIDATION_ERROR' using errcode = 'PT400';
      end if;
      v_destination_json := jsonb_build_object(
        'facilityId', null, 'label', p_payload #>> '{destination,label}',
        'countryCode', p_payload #>> '{destination,countryCode}',
        'region', p_payload #>> '{destination,region}',
        'city', p_payload #>> '{destination,city}', 'lat', null, 'lng', null);
    end if;

    v_cargo := p_payload -> 'cargoSpecification';
    v_payload := p_payload || jsonb_build_object(
      'organizationId', p_organization_id,
      'origin', v_origin_json,
      'destination', v_destination_json);
    v_id := gen_random_uuid();
    insert into public.freight_requests (
      id, organization_id, requested_by_member_id, cargo_category_id, code,
      origin_country, origin_city, origin_region, origin_address, origin_facility_id,
      destination_country, destination_city, destination_region, destination_address,
      destination_facility_id, cargo_weight_kg, cargo_volume_m3, package_count,
      service_type, transport_mode, required_pickup, pickup_window_start,
      pickup_window_end, delivery_deadline, delivery_window_start, delivery_window_end,
      budget_max, budget_currency, cargo_description, cargo_specifications,
      pickup_contact_name, pickup_contact_phone, pickup_contact_email,
      receiver_name, receiver_phone, recipient_contact_email,
      required_equipment_code, status, draft_version, v2_contract_version,
      v2_snapshot, v2_creation_payload, creation_idempotency_key, creation_payload_hash
    ) values (
      v_id, p_organization_id, p_member_id, v_category.id,
      'V2-' || replace(v_id::text, '-', ''),
      v_origin_json ->> 'countryCode', v_origin_json ->> 'city',
      v_origin_json ->> 'region', v_origin_json ->> 'label', v_origin.id,
      v_destination_json ->> 'countryCode', v_destination_json ->> 'city',
      v_destination_json ->> 'region', v_destination_json ->> 'label', v_destination.id,
      (v_cargo ->> 'totalWeightKg')::numeric,
      (v_cargo ->> 'totalVolumeM3')::numeric,
      (select sum((unit ->> 'quantity')::integer)
       from jsonb_array_elements(v_cargo -> 'units') as unit),
      'FTL', 'ROAD', (p_payload #>> '{pickupWindow,startsAt}')::timestamptz,
      (p_payload #>> '{pickupWindow,startsAt}')::timestamptz,
      (p_payload #>> '{pickupWindow,endsAt}')::timestamptz,
      (p_payload #>> '{deliveryWindow,endsAt}')::timestamptz,
      (p_payload #>> '{deliveryWindow,startsAt}')::timestamptz,
      (p_payload #>> '{deliveryWindow,endsAt}')::timestamptz,
      nullif(p_payload #>> '{budget,amount}', '')::numeric,
      p_payload #>> '{budget,currency}', v_cargo ->> 'description', v_cargo,
      p_payload #>> '{contacts,pickup,name}',
      p_payload #>> '{contacts,pickup,phoneE164}',
      p_payload #>> '{contacts,pickup,email}',
      p_payload #>> '{contacts,recipient,name}',
      p_payload #>> '{contacts,recipient,phoneE164}',
      p_payload #>> '{contacts,recipient,email}',
      p_payload ->> 'requiredEquipment', 'DRAFT', 1, '2.0', v_payload,
      p_payload, p_idempotency_key, p_payload_hash
    ) on conflict (organization_id, requested_by_member_id, creation_idempotency_key)
      where creation_idempotency_key is not null do nothing
    returning * into v_request;
    if not found then
      select * into v_request from public.freight_requests
        where organization_id = p_organization_id
          and requested_by_member_id = p_member_id
          and creation_idempotency_key = p_idempotency_key;
      if v_request.creation_payload_hash is distinct from p_payload_hash
         or v_request.v2_creation_payload is distinct from p_payload then
        raise exception 'IDEMPOTENCY_CONFLICT' using errcode = 'PT409';
      end if;
      v_replay := true;
    end if;
  end if;

  return jsonb_build_object(
    'id', v_request.id, 'referenceCode', v_request.code,
    'organizationId', v_request.organization_id, 'status', v_request.status,
    'draftVersion', v_request.draft_version, 'snapshot', v_request.v2_snapshot,
    'createdAt', v_request.created_at, 'updatedAt', v_request.updated_at,
    'payloadHash', v_request.creation_payload_hash,
    'idempotentReplay', v_replay);
end;
$$;
revoke all on function public.create_v2_freight_request(uuid,uuid,uuid,text,jsonb)
  from public, anon, authenticated;
grant execute on function public.create_v2_freight_request(uuid,uuid,uuid,text,jsonb)
  to authenticated, service_role;

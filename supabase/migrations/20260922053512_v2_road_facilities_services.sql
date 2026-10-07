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

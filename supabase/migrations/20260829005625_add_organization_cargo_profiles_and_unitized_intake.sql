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

insert into public.organization_cargo_profiles (
  organization_id,
  cargo_category_id,
  profile_name,
  default_entry_method,
  typical_entry_quantity,
  typical_unit_weight_kg,
  typical_units_per_entry,
  typical_length_cm,
  typical_width_cm,
  typical_height_cm,
  default_requirements,
  preferred_vehicle_classes,
  priority,
  active
)
select
  o.id,
  cc.id,
  'Repuestos y maquinaria minera',
  'PALLETS',
  10,
  800,
  1,
  120,
  100,
  150,
  jsonb_build_object(
    'cross_border', true,
    'is_high_value', true,
    'is_stackable', false,
    'requires_refrigeration', false,
    'customs_coordination_required', true
  ),
  jsonb_build_array('TRACTOR_TRAILER'),
  100,
  true
from public.organizations o
join public.cargo_categories cc on cc.code = 'MACHINERY'
where o.code = 'ACME'
on conflict (organization_id, profile_name) do update
set cargo_category_id = excluded.cargo_category_id,
    default_entry_method = excluded.default_entry_method,
    typical_entry_quantity = excluded.typical_entry_quantity,
    typical_unit_weight_kg = excluded.typical_unit_weight_kg,
    typical_units_per_entry = excluded.typical_units_per_entry,
    typical_length_cm = excluded.typical_length_cm,
    typical_width_cm = excluded.typical_width_cm,
    typical_height_cm = excluded.typical_height_cm,
    default_requirements = excluded.default_requirements,
    preferred_vehicle_classes = excluded.preferred_vehicle_classes,
    priority = excluded.priority,
    active = excluded.active,
    updated_at = now();

update public.freight_requests fr
set cargo_profile_id = p.id,
    entry_quantity = 10,
    entry_unit_weight_kg = 800,
    units_per_entry = 1,
    entry_length_cm = 120,
    entry_width_cm = 100,
    entry_height_cm = 150,
    cargo_specifications = jsonb_build_object(
      'handling_unit', 'PALLET',
      'contents', 'Repuestos y componentes de maquinaria minera',
      'customs_coordination_required', true,
      'recommended_vehicle_class', 'TRACTOR_TRAILER'
    ),
    updated_at = now()
from public.organization_cargo_profiles p
join public.organizations o on o.id = p.organization_id
where fr.organization_id = o.id
  and fr.code = 'FR-1042'
  and o.code = 'ACME'
  and p.profile_name = 'Repuestos y maquinaria minera';

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

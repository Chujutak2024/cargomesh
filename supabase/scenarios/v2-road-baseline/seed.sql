\set ON_ERROR_STOP on
\if :{?local_only}
\else
  \set local_only 0
\endif
\if :local_only
\else
  do $$ begin
    raise exception 'V2_QA_LOCAL_ONLY: pass psql -v local_only=1; never run this seed on hosted Supabase';
  end $$;
\endif

begin;

-- Local-only, synthetic CP-3 fixture. This is not a migration or hosted seed.
insert into public.organizations (id, code, name, status, default_currency)
values
  ('c2300000-0000-4000-8000-000000000001', 'QA-V2-A', '[SYNTHETIC] V2 ROAD tenant A', 'ACTIVE', 'PEN'),
  ('c2300000-0000-4000-8000-000000000002', 'QA-V2-B', '[SYNTHETIC] V2 ROAD tenant B', 'ACTIVE', 'PEN')
on conflict (id) do nothing;

-- Fixed credentials exist solely for local Auth token tests. Never deploy them.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
values
  ('00000000-0000-0000-0000-000000000000', 'c2310000-0000-4000-8000-000000000001',
   'authenticated', 'authenticated', 'qa-v2-a@cargomesh.test',
   extensions.crypt('LOCAL_ONLY_CARGOMESH_QA_V2_2026!', extensions.gen_salt('bf')),
   now(), '{"provider":"email","providers":["email"]}', '{"fixture":"HAC-23 tenant A"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'c2310000-0000-4000-8000-000000000002',
   'authenticated', 'authenticated', 'qa-v2-b@cargomesh.test',
   extensions.crypt('LOCAL_ONLY_CARGOMESH_QA_V2_2026!', extensions.gen_salt('bf')),
   now(), '{"provider":"email","providers":["email"]}', '{"fixture":"HAC-23 tenant B"}', now(), now(), '', '', '', '')
on conflict (id) do nothing;

insert into auth.identities (
  id, user_id, identity_data, provider, provider_id, created_at, updated_at
)
values
  ('c2310000-0000-4000-8000-000000000001', 'c2310000-0000-4000-8000-000000000001',
   '{"sub":"c2310000-0000-4000-8000-000000000001","email":"qa-v2-a@cargomesh.test"}',
   'email', 'qa-v2-a@cargomesh.test', now(), now()),
  ('c2310000-0000-4000-8000-000000000002', 'c2310000-0000-4000-8000-000000000002',
   '{"sub":"c2310000-0000-4000-8000-000000000002","email":"qa-v2-b@cargomesh.test"}',
   'email', 'qa-v2-b@cargomesh.test', now(), now())
on conflict (provider, provider_id) do nothing;

insert into public.organization_members (
  id, organization_id, auth_user_id, display_name, corporate_email, role, status
)
values
  ('c2320000-0000-4000-8000-000000000001', 'c2300000-0000-4000-8000-000000000001',
   'c2310000-0000-4000-8000-000000000001', 'Synthetic QA A', 'qa-v2-a@cargomesh.test', 'SUPERVISOR', 'ACTIVE'),
  ('c2320000-0000-4000-8000-000000000002', 'c2300000-0000-4000-8000-000000000002',
   'c2310000-0000-4000-8000-000000000002', 'Synthetic QA B', 'qa-v2-b@cargomesh.test', 'SUPERVISOR', 'ACTIVE')
on conflict (id) do nothing;

insert into public.facilities (
  id, organization_id, code, name, facility_type, country_code, city, address_line
)
values
  ('c2330000-0000-4000-8000-000000000001', 'c2300000-0000-4000-8000-000000000001',
   'QA-A-LIMA', '[SYNTHETIC] A pickup on covered lane', 'SHIPPER_SITE', 'PE', 'Lima', 'Synthetic Lima address'),
  ('c2330000-0000-4000-8000-000000000002', 'c2300000-0000-4000-8000-000000000001',
   'QA-A-AREQUIPA', '[SYNTHETIC] B delivery on covered lane', 'WAREHOUSE', 'PE', 'Arequipa', 'Synthetic Arequipa address'),
  ('c2330000-0000-4000-8000-000000000003', 'c2300000-0000-4000-8000-000000000001',
   'QA-A-PIURA', '[SYNTHETIC] Uncovered site', 'SHIPPER_SITE', 'PE', 'Piura', 'Synthetic Piura address'),
  ('c2330000-0000-4000-8000-000000000004', 'c2300000-0000-4000-8000-000000000002',
   'QA-B-LIMA', '[SYNTHETIC] Other tenant site', 'SHIPPER_SITE', 'PE', 'Lima', 'Other tenant synthetic address')
on conflict (id) do nothing;

insert into public.carriers (id, name, code, provider_type, status, supports_webmcp)
values ('c2340000-0000-4000-8000-000000000001', '[SYNTHETIC] QA ROAD carrier',
        'QA_V2_ROAD', 'CARRIER', 'ACTIVE', false)
on conflict (id) do nothing;

-- Physical depot in Piura is deliberately not service coverage.
insert into public.carrier_depots (id, carrier_id, code, name, country_code, city)
values ('c2350000-0000-4000-8000-000000000001',
        'c2340000-0000-4000-8000-000000000001', 'QA-PIURA',
        '[SYNTHETIC] Depot without coverage', 'PE', 'Piura')
on conflict (id) do nothing;

-- Legacy origin/destination columns are required metadata, not V2 coverage proof.
insert into public.carrier_services (
  id, carrier_id, transport_mode, service_type, origin_country, origin_region,
  destination_country, destination_region, max_capacity_kg, max_volume_m3,
  active, provider_service_code
)
values ('c2360000-0000-4000-8000-000000000001',
        'c2340000-0000-4000-8000-000000000001', 'ROAD', 'FTL', 'PE', 'Lima',
        'PE', 'Arequipa', 10000, 30, true, 'QA-V2-ROAD-A-B')
on conflict (id) do nothing;

-- Both reverse endpoint roles exist: only the B-to-A lane is absent.
insert into public.service_areas (
  id, carrier_service_id, area_role, coverage, granularity, country_code, city,
  fulfilment_source, evidence_reference, verified_at, valid_from
)
values
  ('c2370000-0000-4000-8000-000000000001', 'c2360000-0000-4000-8000-000000000001',
   'PICKUP', 'INCLUDE', 'CITY', 'PE', 'Lima', 'OWN', 'qa-v2:pickup-A', '2026-09-22T12:00:00Z', '2026-09-01T00:00:00Z'),
  ('c2370000-0000-4000-8000-000000000002', 'c2360000-0000-4000-8000-000000000001',
   'DELIVERY', 'INCLUDE', 'CITY', 'PE', 'Arequipa', 'OWN', 'qa-v2:delivery-B', '2026-09-22T12:00:00Z', '2026-09-01T00:00:00Z'),
  ('c2370000-0000-4000-8000-000000000003', 'c2360000-0000-4000-8000-000000000001',
   'PICKUP', 'INCLUDE', 'CITY', 'PE', 'Arequipa', 'OWN', 'qa-v2:pickup-B', '2026-09-22T12:00:00Z', '2026-09-01T00:00:00Z'),
  ('c2370000-0000-4000-8000-000000000004', 'c2360000-0000-4000-8000-000000000001',
   'DELIVERY', 'INCLUDE', 'CITY', 'PE', 'Lima', 'OWN', 'qa-v2:delivery-A', '2026-09-22T12:00:00Z', '2026-09-01T00:00:00Z')
on conflict (id) do nothing;

insert into public.service_lanes (
  id, carrier_service_id, pickup_area_id, delivery_area_id, lane_kind,
  evidence_reference, verified_at, valid_from
)
values ('c2380000-0000-4000-8000-000000000001',
        'c2360000-0000-4000-8000-000000000001',
        'c2370000-0000-4000-8000-000000000001',
        'c2370000-0000-4000-8000-000000000002',
        'DIRECT', 'qa-v2:lane-A-to-B', '2026-09-22T12:00:00Z', '2026-09-01T00:00:00Z')
on conflict (id) do nothing;

commit;

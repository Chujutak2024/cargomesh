\if :{?local_only}
\else
\set local_only 0
\endif
\if :local_only
\else
DO $$
BEGIN
    RAISE EXCEPTION 'HAC44_LOCAL_ONLY';
END
$$;
\endif
DO $$
BEGIN
    IF inet_server_addr() IS NOT NULL AND inet_server_addr()::text NOT IN(
        '127.0.0.1',
        '::1'
    ) THEN
        RAISE EXCEPTION 'HAC44_LOCAL_SOCKET_REQUIRED';
    END IF;
END
$$;
\set ON_ERROR_STOP on
\if :{?local_only}
\else
\set local_only 0
\endif
\if :local_only
\else
do $$
begin
    raise exception 'V2_QA_LOCAL_ONLY: pass psql -v local_only=1; never run this seed on hosted Supabase';
end
$$;
\endif
begin;
\ir control.sql
-- Local-only, synthetic CP-3 fixture. This is not a migration or hosted seed.
insert into public.organizations(
    id,
    code,
    name,
    status,
    default_currency
) values(
    'd4400000-0000-4000-8000-000000000001',
    'HAC44-FULL-A',
    '[SYNTHETIC] V2 ROAD tenant A',
    'ACTIVE',
    'USD'
),
(
    'd4400000-0000-4000-8000-000000000002',
    'HAC44-FULL-B',
    '[SYNTHETIC] V2 ROAD tenant B',
    'ACTIVE',
    'USD'
) on conflict(
    id
) do nothing;
-- LOCAL_ONLY_AUTH_PLACEHOLDER: synthetic local users, no password login or stored tokens.
insert into auth.users(
    id,
    instance_id,
    aud,
    role,
    email,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
) values(
    'd4410000-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'local-only-hac44-1@cargomesh.test',
    now(),
    '{
        "fixture": "LOCAL_ONLY_AUTH_PLACEHOLDER"
    }',
    '{}',
    now(),
    now(),
    '',
    '',
    '',
    ''
);
insert into auth.users(
    id,
    instance_id,
    aud,
    role,
    email,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
) values(
    'd4410000-0000-4000-8000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'local-only-hac44-2@cargomesh.test',
    now(),
    '{
        "fixture": "LOCAL_ONLY_AUTH_PLACEHOLDER"
    }',
    '{}',
    now(),
    now(),
    '',
    '',
    '',
    ''
);
insert into auth.users(
    id,
    instance_id,
    aud,
    role,
    email,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
) values(
    'd4410000-0000-4000-8000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'local-only-hac44-3@cargomesh.test',
    now(),
    '{
        "fixture": "LOCAL_ONLY_AUTH_PLACEHOLDER"
    }',
    '{}',
    now(),
    now(),
    '',
    '',
    '',
    ''
);
insert into public.organization_members(
    id,
    organization_id,
    auth_user_id,
    display_name,
    corporate_email,
    role,
    status
) values(
    'd4420000-0000-4000-8000-000000000001',
    'd4400000-0000-4000-8000-000000000001',
    'd4410000-0000-4000-8000-000000000001',
    'Synthetic QA A',
    'qa-v2-a@cargomesh.test',
    'OWNER',
    'ACTIVE'
),
(
    'd4420000-0000-4000-8000-000000000002',
    'd4400000-0000-4000-8000-000000000002',
    'd4410000-0000-4000-8000-000000000002',
    'Synthetic QA B',
    'qa-v2-b@cargomesh.test',
    'OWNER',
    'ACTIVE'
) on conflict(
    id
) do nothing;
insert into public.facilities(
    id,
    organization_id,
    code,
    name,
    facility_type,
    country_code,
    city,
    address_line
) values(
    'd4430000-0000-4000-8000-000000000001',
    'd4400000-0000-4000-8000-000000000001',
    'QA-A-LIMA',
    '[SYNTHETIC] A pickup on covered lane',
    'SHIPPER_SITE',
    'PE',
    'Lima',
    'Synthetic Lima address'
),
(
    'd4430000-0000-4000-8000-000000000002',
    'd4400000-0000-4000-8000-000000000001',
    'QA-A-AREQUIPA',
    '[SYNTHETIC] B delivery on covered lane',
    'WAREHOUSE',
    'PE',
    'Arequipa',
    'Synthetic Arequipa address'
),
(
    'd4430000-0000-4000-8000-000000000003',
    'd4400000-0000-4000-8000-000000000001',
    'QA-A-PIURA',
    '[SYNTHETIC] Uncovered site',
    'SHIPPER_SITE',
    'PE',
    'Piura',
    'Synthetic Piura address'
),
(
    'd4430000-0000-4000-8000-000000000004',
    'd4400000-0000-4000-8000-000000000002',
    'QA-B-LIMA',
    '[SYNTHETIC] Other tenant site',
    'SHIPPER_SITE',
    'PE',
    'Lima',
    'Other tenant synthetic address'
) on conflict(
    id
) do nothing;
insert into public.carriers(
    id,
    name,
    code,
    provider_type,
    status,
    supports_webmcp
) values(
    'd4440000-0000-4000-8000-000000000001',
    '[SYNTHETIC] QA ROAD carrier',
    'HAC44_FULL_QA_ROAD',
    'CARRIER',
    'ACTIVE',
    false
) on conflict(
    id
) do nothing;
-- Physical depot in Piura is deliberately not service coverage.
insert into public.carrier_depots(
    id,
    carrier_id,
    code,
    name,
    country_code,
    city,
    address_line
) values(
    'd4450000-0000-4000-8000-000000000001',
    'd4440000-0000-4000-8000-000000000001',
    'HAC44_PIURA',
    '[SYNTHETIC] Depot without coverage',
    'PE',
    'Piura',
    'LOCAL_ONLY Synthetic Piura depot address'
) on conflict(
    id
) do nothing;
-- Legacy origin/destination columns are required metadata, not V2 coverage proof.
insert into public.carrier_services(
    id,
    carrier_id,
    transport_mode,
    service_type,
    origin_country,
    origin_region,
    destination_country,
    destination_region,
    max_capacity_kg,
    max_volume_m3,
    active,
    provider_service_code
) values(
    'd4460000-0000-4000-8000-000000000001',
    'd4440000-0000-4000-8000-000000000001',
    'ROAD',
    'FTL',
    'PE',
    'Lima',
    'PE',
    'Arequipa',
    10000,
    30,
    true,
    'HAC44-FULL-ROAD-A-B'
) on conflict(
    id
) do nothing;
-- Both reverse endpoint roles exist: only the B-to-A lane is absent.
insert into public.service_areas(
    id,
    carrier_service_id,
    area_role,
    coverage,
    granularity,
    country_code,
    city,
    fulfilment_source,
    evidence_reference,
    verified_at,
    valid_from
) values(
    'd4470000-0000-4000-8000-000000000001',
    'd4460000-0000-4000-8000-000000000001',
    'PICKUP',
    'INCLUDE',
    'CITY',
    'PE',
    'Lima',
    'OWN',
    'qa-v2:pickup-A',
    '2026-09-22T12:00:00Z',
    '2026-09-01T00:00:00Z'
),
(
    'd4470000-0000-4000-8000-000000000002',
    'd4460000-0000-4000-8000-000000000001',
    'DELIVERY',
    'INCLUDE',
    'CITY',
    'PE',
    'Arequipa',
    'OWN',
    'qa-v2:delivery-B',
    '2026-09-22T12:00:00Z',
    '2026-09-01T00:00:00Z'
),
(
    'd4470000-0000-4000-8000-000000000003',
    'd4460000-0000-4000-8000-000000000001',
    'PICKUP',
    'INCLUDE',
    'CITY',
    'PE',
    'Arequipa',
    'OWN',
    'qa-v2:pickup-B',
    '2026-09-22T12:00:00Z',
    '2026-09-01T00:00:00Z'
),
(
    'd4470000-0000-4000-8000-000000000004',
    'd4460000-0000-4000-8000-000000000001',
    'DELIVERY',
    'INCLUDE',
    'CITY',
    'PE',
    'Lima',
    'OWN',
    'qa-v2:delivery-A',
    '2026-09-22T12:00:00Z',
    '2026-09-01T00:00:00Z'
) on conflict(
    id
) do nothing;
insert into public.service_lanes(
    id,
    carrier_service_id,
    pickup_area_id,
    delivery_area_id,
    lane_kind,
    evidence_reference,
    verified_at,
    valid_from
) values(
    'd4480000-0000-4000-8000-000000000001',
    'd4460000-0000-4000-8000-000000000001',
    'd4470000-0000-4000-8000-000000000001',
    'd4470000-0000-4000-8000-000000000002',
    'DIRECT',
    'qa-v2:lane-A-to-B',
    '2026-09-22T12:00:00Z',
    '2026-09-01T00:00:00Z'
) on conflict(
    id
) do nothing;
-- HAC-29: second covered service. Copy baseline nominal maxima, not availability.
insert into public.carriers(
    id,
    name,
    code,
    provider_type,
    status,
    supports_webmcp
) values(
    'd4490000-0000-4000-8000-000000000001',
    '[SYNTHETIC] QA unknown capacity carrier',
    'HAC44_FULL_QA_UNKNOWN',
    'CARRIER',
    'ACTIVE',
    false
) on conflict(
    id
) do nothing;
insert into public.carrier_services(
    id,
    carrier_id,
    transport_mode,
    service_type,
    origin_country,
    origin_region,
    destination_country,
    destination_region,
    max_capacity_kg,
    max_volume_m3,
    active,
    provider_service_code
) values(
    'd44a0000-0000-4000-8000-000000000001',
    'd4490000-0000-4000-8000-000000000001',
    'ROAD',
    'FTL',
    'PE',
    'Lima',
    'PE',
    'Arequipa',
    10000,
    30,
    true,
    'HAC44-FULL-ROAD-UNKNOWN'
) on conflict(
    id
) do nothing;
insert into public.service_areas(
    id,
    carrier_service_id,
    area_role,
    coverage,
    granularity,
    country_code,
    city,
    fulfilment_source,
    evidence_reference,
    verified_at,
    valid_from
) values(
    'd44b0000-0000-4000-8000-000000000001',
    'd44a0000-0000-4000-8000-000000000001',
    'PICKUP',
    'INCLUDE',
    'CITY',
    'PE',
    'Lima',
    'OWN',
    'qa-v2:unknown-pickup',
    '2026-09-22T12:00:00Z',
    '2026-09-01T00:00:00Z'
),
(
    'd44b0000-0000-4000-8000-000000000002',
    'd44a0000-0000-4000-8000-000000000001',
    'DELIVERY',
    'INCLUDE',
    'CITY',
    'PE',
    'Arequipa',
    'OWN',
    'qa-v2:unknown-delivery',
    '2026-09-22T12:00:00Z',
    '2026-09-01T00:00:00Z'
) on conflict(
    id
) do nothing;
insert into public.service_lanes(
    id,
    carrier_service_id,
    pickup_area_id,
    delivery_area_id,
    lane_kind,
    evidence_reference,
    verified_at,
    valid_from
) values(
    'd44c0000-0000-4000-8000-000000000001',
    'd44a0000-0000-4000-8000-000000000001',
    'd44b0000-0000-4000-8000-000000000001',
    'd44b0000-0000-4000-8000-000000000002',
    'DIRECT',
    'qa-v2:unknown-lane',
    '2026-09-22T12:00:00Z',
    '2026-09-01T00:00:00Z'
) on conflict(
    id
) do nothing;
-- BLOCKED HAC-12: no asset, pool, calendar or reservation tables are manufactured here.
insert into public.organization_members(
    id,
    organization_id,
    auth_user_id,
    display_name,
    corporate_email,
    role,
    status
) values(
    'd4420000-0000-4000-8000-000000000003',
    'd4400000-0000-4000-8000-000000000001',
    'd4410000-0000-4000-8000-000000000003',
    'LOCAL_ONLY revoked actor',
    'local-only-hac44-3@cargomesh.test',
    'REQUESTER',
    'INACTIVE'
);
insert into private.v2_catalog_grants(
    auth_user_id,
    permission
) values(
    'd4410000-0000-4000-8000-000000000001',
    'CATALOG_ADMIN'
);
insert into private.v2_catalog_grants(
    auth_user_id,
    carrier_id,
    permission
) values(
    'd4410000-0000-4000-8000-000000000002',
    'd4490000-0000-4000-8000-000000000001',
    'CARRIER_EDITOR'
);
insert into public.carrier_operators(
    id,
    carrier_id,
    auth_user_id,
    display_name,
    role,
    status,
    verified_at
) values(
    'd44b0000-0000-4000-8000-000000000001',
    'd4440000-0000-4000-8000-000000000001',
    'd4410000-0000-4000-8000-000000000001',
    'LOCAL_ONLY operator',
    'ADMIN',
    'ACTIVE',
    now()
);
insert into public.mcp_account_links(
    id,
    auth_user_id,
    organization_member_id,
    oauth_client_id,
    organization_id,
    scopes,
    status,
    expires_at,
    linked_by_user_id
) values(
    'd44c0000-0000-4000-8000-000000000001',
    'd4410000-0000-4000-8000-000000000001',
    'd4420000-0000-4000-8000-000000000001',
    'hac44-local-only-synthetic-client',
    'd4400000-0000-4000-8000-000000000001',
    array[
        'mcp:tools'
    ],
    'ACTIVE',
    now() + interval '1 day',
    'd4410000-0000-4000-8000-000000000001'
);
commit;
\ir workflow-seed.sql
\ir ltl-seed.sql
\ir complete-seed.sql

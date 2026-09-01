\set ON_ERROR_STOP on

BEGIN;

-- Setup Test Organizations and Auth Users
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  ('00000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'supervisor@acme.cargomesh.test', extensions.crypt('LOCAL_ONLY_CARGOMESH_DEMO_2026!', extensions.gen_salt('bf')), now(), '{"provider":"email"}', '{"full_name":"Demo Supervisor"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'requester@acme.cargomesh.test', extensions.crypt('LOCAL_ONLY_CARGOMESH_DEMO_2026!', extensions.gen_salt('bf')), now(), '{"provider":"email"}', '{"full_name":"Demo Requester"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'owner@beta.cargomesh.test', extensions.crypt('LOCAL_ONLY_CARGOMESH_DEMO_2026!', extensions.gen_salt('bf')), now(), '{"provider":"email"}', '{"full_name":"Demo Beta Owner"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'no-org@cargomesh.test', extensions.crypt('LOCAL_ONLY_CARGOMESH_DEMO_2026!', extensions.gen_salt('bf')), now(), '{"provider":"email"}', '{"full_name":"Demo User Without Organization"}', now(), now())
ON CONFLICT (id) DO NOTHING;

-- Organization B (Beta Logistics)
INSERT INTO public.organizations (id, name, code, status, default_currency, legal_name, country_code, business_identifier_type, business_identifier_value)
VALUES ('a0000000-0000-0000-0000-000000000002', 'Beta Logistics', 'ORGB', 'ACTIVE', 'USD', 'Beta Logistics S.A.C.', 'PE', 'RUC', '20987654321')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.organization_preferences (organization_id, default_strategy, budget_default, allow_auto_booking, selection_mode)
VALUES ('a0000000-0000-0000-0000-000000000002', 'FASTEST', 3500, false, 'ASSISTED')
ON CONFLICT DO NOTHING;

-- Organization Memberships
INSERT INTO public.organization_members (id, organization_id, auth_user_id, display_name, corporate_email, role, status)
VALUES
  ('e0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', 'Ana Supervisor', 'ana.supervisor@acmemining.pe', 'SUPERVISOR', 'ACTIVE'),
  ('e0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 'Pedro Requester', 'pedro.requester@acmemining.pe', 'REQUESTER', 'ACTIVE'),
  ('e0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000004', 'Roberto Beta', 'roberto.owner@betalogistics.pe', 'OWNER', 'ACTIVE')
ON CONFLICT (organization_id, auth_user_id) DO NOTHING;

-- Freight Request for Org B
INSERT INTO public.freight_requests (
  id, organization_id, cargo_category_id, code, origin_country, origin_city, destination_country, destination_city,
  cargo_weight_kg, cargo_volume_m3, package_count, service_type, transport_mode, required_pickup, status
)
SELECT
  'f2000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', cc.id, 'FR-9999', 'PE', 'Lima', 'PE', 'Arequipa',
  2500, 10, 5, 'FTL', 'ROAD', now() + interval '2 days', 'PENDING'
FROM public.cargo_categories cc WHERE cc.code = 'GENERAL'
ON CONFLICT (code) DO NOTHING;

-- Cargo Profile for Org B
INSERT INTO public.organization_cargo_profiles (
  id, organization_id, cargo_category_id, profile_name, default_entry_method, typical_entry_quantity, typical_unit_weight_kg, typical_units_per_entry, priority, active
)
SELECT
  'c1000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', cc.id, 'Standard Palletized Goods', 'PALLETS', 5, 500, 1, 10, true
FROM public.cargo_categories cc WHERE cc.code = 'GENERAL'
ON CONFLICT (organization_id, profile_name) DO NOTHING;

COMMIT;

-- ============================================================================
-- TEST SUITE EXECUTION
-- ============================================================================

DO $$
DECLARE
  v_count integer;
  v_code text;
  v_updated integer;
  v_error_thrown boolean;
BEGIN
  RAISE NOTICE '---------------------------------------------------------';
  RAISE NOTICE 'CARGOMESH AUTOMATED VALIDATION SUITE';
  RAISE NOTICE '---------------------------------------------------------';

  -- --------------------------------------------------------------------------
  -- SECTION 1: ANON ROLE VALIDATION (MUST BE FULLY BLOCKED)
  -- --------------------------------------------------------------------------
  RAISE NOTICE '[1/5] Testing anon role blocking...';
  
  -- Set anon context
  PERFORM set_config('role', 'anon', true);
  PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);

  BEGIN
    SELECT count(*) INTO v_count FROM public.organizations;
    IF v_count <> 0 THEN
      RAISE EXCEPTION 'FAIL: anon was able to select % rows from organizations', v_count;
    END IF;
  EXCEPTION WHEN insufficient_privilege THEN
    -- Expected behavior if SELECT is revoked
    NULL;
  END;

  BEGIN
    SELECT count(*) INTO v_count FROM public.freight_requests;
    IF v_count <> 0 THEN
      RAISE EXCEPTION 'FAIL: anon was able to select % rows from freight_requests', v_count;
    END IF;
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;

  BEGIN
    SELECT count(*) INTO v_count FROM public.organization_preferences;
    IF v_count <> 0 THEN
      RAISE EXCEPTION 'FAIL: anon was able to select % rows from organization_preferences', v_count;
    END IF;
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;

  RAISE NOTICE '  PASS: anon is completely blocked from reading private entities.';

  -- --------------------------------------------------------------------------
  -- SECTION 2: MULTI-TENANT ISOLATION (ACME vs ORGB)
  -- --------------------------------------------------------------------------
  RAISE NOTICE '[2/5] Testing multi-tenant isolation...';

  -- Switch to ACME OWNER
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', '{"sub":"d0000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

  -- ACME OWNER should see exactly 1 organization (ACME)
  SELECT count(*), min(code) INTO v_count, v_code FROM public.organizations;
  IF v_count <> 1 OR v_code <> 'ACME' THEN
    RAISE EXCEPTION 'FAIL: ACME OWNER saw % orgs (expected 1 ACME, got %)', v_count, v_code;
  END IF;

  -- ACME OWNER should see only ACME freight requests (FR-1042)
  SELECT count(*), min(code) INTO v_count, v_code FROM public.freight_requests;
  IF v_count <> 1 OR v_code <> 'FR-1042' THEN
    RAISE EXCEPTION 'FAIL: ACME OWNER saw % requests (expected 1 FR-1042, got %)', v_count, v_code;
  END IF;

  -- ACME OWNER should see only ACME cargo profiles
  SELECT count(*) INTO v_count FROM public.organization_cargo_profiles;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'FAIL: ACME OWNER saw % cargo profiles (expected 1)', v_count;
  END IF;

  -- Switch to ORG B OWNER
  PERFORM set_config('request.jwt.claims', '{"sub":"d0000000-0000-0000-0000-000000000004","role":"authenticated"}', true);

  -- ORG B OWNER should see exactly 1 organization (ORGB)
  SELECT count(*), min(code) INTO v_count, v_code FROM public.organizations;
  IF v_count <> 1 OR v_code <> 'ORGB' THEN
    RAISE EXCEPTION 'FAIL: ORG B OWNER saw % orgs (expected 1 ORGB, got %)', v_count, v_code;
  END IF;

  -- ORG B OWNER should see only FR-9999 (NOT FR-1042)
  SELECT count(*), min(code) INTO v_count, v_code FROM public.freight_requests;
  IF v_count <> 1 OR v_code <> 'FR-9999' THEN
    RAISE EXCEPTION 'FAIL: ORG B OWNER saw % requests (expected 1 FR-9999, got %)', v_count, v_code;
  END IF;

  -- Switch to user with NO org
  PERFORM set_config('request.jwt.claims', '{"sub":"d0000000-0000-0000-0000-000000000005","role":"authenticated"}', true);
  SELECT count(*) INTO v_count FROM public.organizations;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'FAIL: User without org saw % orgs (expected 0)', v_count;
  END IF;
  SELECT count(*) INTO v_count FROM public.freight_requests;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'FAIL: User without org saw % requests (expected 0)', v_count;
  END IF;

  RAISE NOTICE '  PASS: Multi-tenant boundary between ACME and Org B is 100%% strictly isolated.';

  -- --------------------------------------------------------------------------
  -- SECTION 3: ROLE PERMISSIONS (OWNER, SUPERVISOR, REQUESTER)
  -- --------------------------------------------------------------------------
  RAISE NOTICE '[3/5] Testing role permissions (OWNER, SUPERVISOR, REQUESTER)...';

  -- REQUESTER: Can read ACME preferences, but CANNOT update them
  PERFORM set_config('request.jwt.claims', '{"sub":"d0000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
  
  UPDATE public.organization_preferences
  SET budget_default = 9999
  WHERE organization_id = 'a0000000-0000-0000-0000-000000000001';
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> 0 THEN
    RAISE EXCEPTION 'FAIL: REQUESTER was able to update organization_preferences!';
  END IF;

  -- SUPERVISOR: CAN update preferences
  PERFORM set_config('request.jwt.claims', '{"sub":"d0000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
  
  UPDATE public.organization_preferences
  SET budget_default = 2100
  WHERE organization_id = 'a0000000-0000-0000-0000-000000000001';
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> 1 THEN
    RAISE EXCEPTION 'FAIL: SUPERVISOR failed to update organization_preferences!';
  END IF;

  -- OWNER: CAN update preferences
  PERFORM set_config('request.jwt.claims', '{"sub":"d0000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
  
  UPDATE public.organization_preferences
  SET budget_default = 2000
  WHERE organization_id = 'a0000000-0000-0000-0000-000000000001';
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> 1 THEN
    RAISE EXCEPTION 'FAIL: OWNER failed to update organization_preferences!';
  END IF;

  RAISE NOTICE '  PASS: Role permissions strictly enforced (OWNER & SUPERVISOR have write, REQUESTER restricted).';

  -- --------------------------------------------------------------------------
  -- SECTION 4: GOLDEN FLOW DATA ACCURACY (FR-1042)
  -- --------------------------------------------------------------------------
  RAISE NOTICE '[4/5] Testing Golden Flow FR-1042 contract requirements...';

  -- Restore postgres superuser role for data inspection
  PERFORM set_config('role', 'postgres', true);

  -- FR-1042 assertions
  SELECT count(*) INTO v_count
  FROM public.freight_requests fr
  JOIN public.cargo_categories cc ON cc.id = fr.cargo_category_id
  WHERE fr.code = 'FR-1042'
    AND fr.cargo_weight_kg = 8000
    AND fr.cargo_volume_m3 = 18
    AND fr.package_count = 10
    AND fr.cargo_entry_method = 'PALLETS'
    AND fr.entry_quantity = 10
    AND fr.entry_unit_weight_kg = 800
    AND fr.cross_border = true
    AND fr.is_high_value = true
    AND fr.is_stackable = false
    AND fr.requires_refrigeration = false
    AND fr.origin_country = 'PE' AND fr.origin_city = 'Callao'
    AND fr.destination_country = 'CL' AND fr.destination_city = 'Santiago'
    AND cc.code = 'MACHINERY';

  IF v_count <> 1 THEN
    RAISE EXCEPTION 'FAIL: FR-1042 does not strictly match the 8,000 kg / 18 m3 / MACHINERY Golden Flow contract!';
  END IF;

  -- Carrier corridor assertions (3 Enterprise Carriers)
  SELECT count(*) INTO v_count
  FROM public.carrier_services cs
  JOIN public.carriers c ON c.id = cs.carrier_id
  WHERE c.code IN ('ANDES', 'INCA', 'PACIFIC')
    AND cs.origin_country = 'PE' AND cs.destination_country = 'CL'
    AND cs.supports_cross_border = true;

  IF v_count <> 3 THEN
    RAISE EXCEPTION 'FAIL: Expected 3 carriers with cross-border PE->CL services, found %', v_count;
  END IF;

  RAISE NOTICE '  PASS: Golden Flow FR-1042 contract (10 pallets x 800kg = 8,000kg, 18m3, Machinery, PE->CL) verified.';

  -- --------------------------------------------------------------------------
  -- SECTION 5: DOMAIN CONSTRAINTS & REJECTION VALIDATION
  -- --------------------------------------------------------------------------
  RAISE NOTICE '[5/5] Testing domain constraints and invalid payload rejections...';

  -- Test 5.1: Negative weight rejection
  v_error_thrown := false;
  BEGIN
    INSERT INTO public.freight_requests (
      organization_id, cargo_category_id, code, origin_country, origin_city, destination_country, destination_city,
      cargo_weight_kg, required_pickup, status
    ) VALUES (
      'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000005', 'FR-ERR-NEG-WEIGHT', 'PE', 'Callao', 'CL', 'Santiago',
      -500, now() + interval '1 day', 'PENDING'
    );
  EXCEPTION WHEN check_violation THEN
    v_error_thrown := true;
  END;
  IF NOT v_error_thrown THEN
    RAISE EXCEPTION 'FAIL: Negative cargo_weight_kg was not rejected!';
  END IF;

  -- Test 5.2: Inconsistent unitized weight rejection (10 * 800 != 5000)
  v_error_thrown := false;
  BEGIN
    INSERT INTO public.freight_requests (
      organization_id, cargo_category_id, code, origin_country, origin_city, destination_country, destination_city,
      cargo_weight_kg, cargo_entry_method, entry_quantity, entry_unit_weight_kg, units_per_entry, required_pickup, status
    ) VALUES (
      'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000005', 'FR-ERR-INCONSISTENT', 'PE', 'Callao', 'CL', 'Santiago',
      5000, 'PALLETS', 10, 800, 1, now() + interval '1 day', 'PENDING'
    );
  EXCEPTION WHEN check_violation THEN
    v_error_thrown := true;
  END;
  IF NOT v_error_thrown THEN
    RAISE EXCEPTION 'FAIL: Inconsistent unitized weight vs total weight was not rejected!';
  END IF;

  -- Test 5.3: Invalid pickup window (end before start)
  v_error_thrown := false;
  BEGIN
    INSERT INTO public.freight_requests (
      organization_id, cargo_category_id, code, origin_country, origin_city, destination_country, destination_city,
      cargo_weight_kg, pickup_window_start, pickup_window_end, required_pickup, status
    ) VALUES (
      'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000005', 'FR-ERR-WINDOW', 'PE', 'Callao', 'CL', 'Santiago',
      8000, now() + interval '2 days', now() + interval '1 day', now() + interval '2 days', 'PENDING'
    );
  EXCEPTION WHEN check_violation THEN
    v_error_thrown := true;
  END;
  IF NOT v_error_thrown THEN
    RAISE EXCEPTION 'FAIL: Invalid pickup window (end < start) was not rejected!';
  END IF;

  RAISE NOTICE '  PASS: All domain constraints and invalid payload rejections verified.';

  RAISE NOTICE '---------------------------------------------------------';
  RAISE NOTICE 'ALL 5 VALIDATION SUITES PASSED SUCCESSFULLY! (100%% GREEN)';
  RAISE NOTICE '---------------------------------------------------------';
END $$;

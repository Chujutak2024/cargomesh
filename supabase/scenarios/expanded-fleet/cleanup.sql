begin;

-- =============================================================================
-- CLEANUP: EXPANDED FLEET SCENARIO
-- Removes only the synthetic fleet vehicles, services, and roadmap carriers.
-- Core carriers (Andes, Inca, Pacific), FR-1042, and base vehicles remain untouched.
-- =============================================================================

delete from public.carrier_service_cargo_categories
where carrier_service_id in (
  'd2000000-0000-0000-0000-000000000001',
  'd2000000-0000-0000-0000-000000000002',
  'd2000000-0000-0000-0000-000000000003'
);

delete from public.vehicles
where id between 'e0000000-0000-0000-0000-000000000001' and 'e0000000-0000-0000-0000-000000000028';

delete from public.carrier_services
where id in (
  'd2000000-0000-0000-0000-000000000001',
  'd2000000-0000-0000-0000-000000000002',
  'd2000000-0000-0000-0000-000000000003'
);

delete from public.carriers
where id in (
  'b2000000-0000-0000-0000-000000000001',
  'b2000000-0000-0000-0000-000000000002',
  'b2000000-0000-0000-0000-000000000003'
);

commit;

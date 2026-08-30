begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
select plan(17);

select ok(
  to_regprocedure('public.record_provider_result(text,uuid,uuid,uuid,uuid,text,text,text,integer,jsonb,jsonb,timestamp with time zone,timestamp with time zone,integer,text,jsonb,text,text)') is not null,
  'INT-02A Result Bridge overload exists'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.record_provider_result(text,uuid,uuid,uuid,uuid,text,text,text,integer,jsonb,jsonb,timestamp with time zone,timestamp with time zone,integer,text,jsonb,text,text)',
    'EXECUTE'
  ),
  'authenticated cannot execute the INT-02A Result Bridge directly'
);
select has_column('public', 'orchestration_events', 'carrier_service_id', 'events preserve matchingServiceId');
select has_column('public', 'carrier_offers', 'carrier_service_id', 'offers preserve matchingServiceId');

set local role service_role;

insert into public.orchestration_runs (id, freight_request_id, run_type, status, created_by_member_id)
values
  ('90000000-0000-0000-0000-000000000003', 'f2000000-0000-0000-0000-000000000001', 'INITIAL', 'RUNNING', 'e0000000-0000-0000-0000-000000000001'),
  ('90000000-0000-0000-0000-000000000004', 'f2000000-0000-0000-0000-000000000001', 'INITIAL', 'RUNNING', 'e0000000-0000-0000-0000-000000000001');

select results_eq(
  $$
    select result_status, deduplicated, record_type
    from public.record_provider_result(
      'cm:int02a:v1:90000000-0000-0000-0000-000000000003:f2000000-0000-0000-0000-000000000001:b0000000-0000-0000-0000-000000000001:d0000000-0000-0000-0000-000000000001:check_service_coverage:1',
      '90000000-0000-0000-0000-000000000003',
      'f2000000-0000-0000-0000-000000000001',
      'b0000000-0000-0000-0000-000000000001',
      'd0000000-0000-0000-0000-000000000001',
      '/providers/andes',
      'http://localhost:3000/providers/andes?serviceId=d0000000-0000-0000-0000-000000000001',
      'check_service_coverage',
      1,
      '{"origin":"Callao, PE","destination":"Santiago, CL","transport_mode":"ROAD","service_type":"FTL","cargo_category":"MACHINERY"}'::jsonb,
      '{"ok":true,"data":{"schemaVersion":"1.0","providerServiceCode":"ANDES-PECL-FTL","supported":true,"crossBorderSupported":true,"corridor":{"origin":"Callao, PE","destination":"Santiago, CL"},"customsCoordinationAvailable":true,"serviceNotes":["Compatible"]}}'::jsonb,
      '2026-08-30T12:00:00Z',
      '2026-08-30T12:00:00.120Z',
      120,
      'COMPLETED',
      null,
      'http://localhost:3000',
      '1.0'
    )
  $$,
  $$ values ('INSERTED'::text, false, null::text) $$,
  'coverage creates only an orchestration event'
);
select is((select count(*)::integer from public.carrier_offers), 0, 'coverage creates no CarrierOffer');
select results_eq(
  $$
    select carrier_service_id, status, execution_status
    from public.orchestration_events
    where orchestration_run_id = '90000000-0000-0000-0000-000000000003'
  $$,
  $$ values ('d0000000-0000-0000-0000-000000000001'::uuid, 'SUCCEEDED'::text, 'COMPLETED'::text) $$,
  'coverage event preserves service identity and execution status'
);

update public.orchestration_runs
set status = 'NO_MATCH', completed_at = now()
where id = '90000000-0000-0000-0000-000000000003';

select results_eq(
  $$
    select result_status, deduplicated
    from public.record_provider_result(
      'cm:int02a:v1:90000000-0000-0000-0000-000000000003:f2000000-0000-0000-0000-000000000001:b0000000-0000-0000-0000-000000000001:d0000000-0000-0000-0000-000000000001:check_service_coverage:1',
      '90000000-0000-0000-0000-000000000003', 'f2000000-0000-0000-0000-000000000001',
      'b0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001',
      '/providers/andes', 'http://localhost:3000/providers/andes?serviceId=d0000000-0000-0000-0000-000000000001',
      'check_service_coverage', 1,
      '{"origin":"Callao, PE","destination":"Santiago, CL","transport_mode":"ROAD","service_type":"FTL","cargo_category":"MACHINERY"}'::jsonb,
      '{"ok":true,"data":{"schemaVersion":"1.0","providerServiceCode":"ANDES-PECL-FTL","supported":true,"crossBorderSupported":true,"corridor":{"origin":"Callao, PE","destination":"Santiago, CL"},"customsCoordinationAvailable":true,"serviceNotes":["Compatible"]}}'::jsonb,
      '2026-08-30T12:00:00Z', '2026-08-30T12:00:00.120Z', 120, 'COMPLETED', null, 'http://localhost:3000', '1.0'
    )
  $$,
  $$ values ('DEDUPLICATED'::text, true) $$,
  'exact replay remains idempotent after the run closes'
);

select throws_ok(
  $$
    select * from public.record_provider_result(
      'cm:int02a:v1:90000000-0000-0000-0000-000000000003:f2000000-0000-0000-0000-000000000001:b0000000-0000-0000-0000-000000000001:d0000000-0000-0000-0000-000000000001:check_service_coverage:1',
      '90000000-0000-0000-0000-000000000003', 'f2000000-0000-0000-0000-000000000001',
      'b0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001',
      '/providers/andes', 'http://localhost:3000/providers/andes?serviceId=d0000000-0000-0000-0000-000000000001',
      'check_service_coverage', 1,
      '{"origin":"Lima, PE","destination":"Santiago, CL","transport_mode":"ROAD","service_type":"FTL","cargo_category":"MACHINERY"}'::jsonb,
      '{"ok":true,"data":{"schemaVersion":"1.0","providerServiceCode":"ANDES-PECL-FTL","supported":true,"crossBorderSupported":true,"corridor":{"origin":"Callao, PE","destination":"Santiago, CL"},"customsCoordinationAvailable":true,"serviceNotes":["Compatible"]}}'::jsonb,
      '2026-08-30T12:00:00Z', '2026-08-30T12:00:00.120Z', 120, 'COMPLETED', null, 'http://localhost:3000', '1.0'
    )
  $$,
  'P0001', null,
  'same toolCallId with changed payload conflicts'
);

select throws_ok(
  $$
    select * from public.record_provider_result(
      'cm:int02a:v1:90000000-0000-0000-0000-000000000004:f2000000-0000-0000-0000-000000000001:b0000000-0000-0000-0000-000000000001:d0000000-0000-0000-0000-000000000002:check_capacity:1',
      '90000000-0000-0000-0000-000000000004', 'f2000000-0000-0000-0000-000000000001',
      'b0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002',
      '/providers/andes', 'http://localhost:3000/providers/andes?serviceId=d0000000-0000-0000-0000-000000000002',
      'check_capacity', 1,
      '{"origin":"Callao, PE","destination":"Santiago, CL","cargo_weight_kg":8000,"cargo_category":"MACHINERY","pickup_mode":"ASAP"}'::jsonb,
      null, '2026-08-30T12:01:00Z', '2026-08-30T12:01:00.100Z', 100,
      'TECHNICAL_ERROR', '{"code":"TIMEOUT","message":"Timed out","retryable":true}'::jsonb, 'http://localhost:3000', '1.0'
    )
  $$,
  '22023', null,
  'a service belonging to another carrier is rejected'
);

select throws_ok(
  $$
    select * from public.record_provider_result(
      'cm:int02a:v1:90000000-0000-0000-0000-000000000004:f2000000-0000-0000-0000-000000000001:b0000000-0000-0000-0000-000000000001:d0000000-0000-0000-0000-000000000001:check_service_coverage:2',
      '90000000-0000-0000-0000-000000000004', 'f2000000-0000-0000-0000-000000000001',
      'b0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001',
      '/providers/andes', 'https://unrelated.example/providers/andes?serviceId=d0000000-0000-0000-0000-000000000001',
      'check_service_coverage', 2,
      '{"origin":"Callao, PE","destination":"Santiago, CL","transport_mode":"ROAD","service_type":"FTL","cargo_category":"MACHINERY"}'::jsonb,
      null, '2026-08-30T12:03:00Z', '2026-08-30T12:03:00.100Z', 100,
      'TECHNICAL_ERROR', '{"code":"TIMEOUT","message":"Timed out","retryable":true}'::jsonb, 'http://localhost:3000', '1.0'
    )
  $$,
  '22023', null,
  'a provider navigation URL on another origin is rejected'
);

select throws_ok(
  $$
    select * from public.record_provider_result(
      'cm:int02a:v1:90000000-0000-0000-0000-000000000004:f2000000-0000-0000-0000-000000000001:b0000000-0000-0000-0000-000000000001:d0000000-0000-0000-0000-000000000001:check_service_coverage:3',
      '90000000-0000-0000-0000-000000000004', 'f2000000-0000-0000-0000-000000000001',
      'b0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001',
      '/providers/andes', 'http://localhost:3000/providers/not-andes?serviceId=d0000000-0000-0000-0000-000000000001',
      'check_service_coverage', 3,
      '{"origin":"Callao, PE","destination":"Santiago, CL","transport_mode":"ROAD","service_type":"FTL","cargo_category":"MACHINERY"}'::jsonb,
      null, '2026-08-30T12:03:00Z', '2026-08-30T12:03:00.100Z', 100,
      'TECHNICAL_ERROR', '{"code":"TIMEOUT","message":"Timed out","retryable":true}'::jsonb, 'http://localhost:3000', '1.0'
    )
  $$,
  '22023', null,
  'a provider navigation URL on another pathname is rejected'
);

select throws_ok(
  $$
    select * from public.record_provider_result(
      'cm:int02a:v1:90000000-0000-0000-0000-000000000004:f2000000-0000-0000-0000-000000000001:b0000000-0000-0000-0000-000000000001:d0000000-0000-0000-0000-000000000001:check_service_coverage:4',
      '90000000-0000-0000-0000-000000000004', 'f2000000-0000-0000-0000-000000000001',
      'b0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001',
      '/providers/andes', 'http://localhost:3000/providers/andes?serviceId=d0000000-0000-0000-0000-000000000001&serviceId=d0000000-0000-0000-0000-000000000001',
      'check_service_coverage', 4,
      '{"origin":"Callao, PE","destination":"Santiago, CL","transport_mode":"ROAD","service_type":"FTL","cargo_category":"MACHINERY"}'::jsonb,
      null, '2026-08-30T12:03:00Z', '2026-08-30T12:03:00.100Z', 100,
      'TECHNICAL_ERROR', '{"code":"TIMEOUT","message":"Timed out","retryable":true}'::jsonb, 'http://localhost:3000', '1.0'
    )
  $$,
  '22023', null,
  'a provider navigation URL with duplicate serviceId is rejected'
);

select results_eq(
  $$
    select result_status, record_type
    from public.record_provider_result(
      'cm:int02a:v1:90000000-0000-0000-0000-000000000004:f2000000-0000-0000-0000-000000000001:b0000000-0000-0000-0000-000000000001:d0000000-0000-0000-0000-000000000001:check_capacity:1',
      '90000000-0000-0000-0000-000000000004', 'f2000000-0000-0000-0000-000000000001',
      'b0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001',
      '/providers/andes', 'http://localhost:3000/providers/andes?serviceId=d0000000-0000-0000-0000-000000000001',
      'check_capacity', 1,
      '{"origin":"Callao, PE","destination":"Santiago, CL","cargo_weight_kg":8000,"cargo_category":"MACHINERY","pickup_mode":"ASAP"}'::jsonb,
      null, '2026-08-30T12:01:00Z', '2026-08-30T12:01:00.100Z', 100,
      'TECHNICAL_ERROR', '{"code":"TIMEOUT","message":"Timed out","retryable":true}'::jsonb, 'http://localhost:3000', '1.0'
    )
  $$,
  $$ values ('INSERTED'::text, null::text) $$,
  'technical failure records an event without an offer'
);
select results_eq(
  $$
    select output_payload is null, status, execution_status
    from public.orchestration_events
    where tool_name = 'check_capacity' and orchestration_run_id = '90000000-0000-0000-0000-000000000004'
  $$,
  $$ values (true, 'FAILED'::text, 'TECHNICAL_ERROR'::text) $$,
  'technical event preserves nullable output and failure evidence'
);

select results_eq(
  $$
    select result_status, record_type
    from public.record_provider_result(
      'cm:int02a:v1:90000000-0000-0000-0000-000000000004:f2000000-0000-0000-0000-000000000001:b0000000-0000-0000-0000-000000000001:d0000000-0000-0000-0000-000000000001:quote_freight:1',
      '90000000-0000-0000-0000-000000000004', 'f2000000-0000-0000-0000-000000000001',
      'b0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001',
      '/providers/andes', 'http://localhost:3000/providers/andes?serviceId=d0000000-0000-0000-0000-000000000001',
      'quote_freight', 1,
      '{"freight_request_id":"f2000000-0000-0000-0000-000000000001"}'::jsonb,
      '{"ok":true,"data":{"schemaVersion":"1.0","freightRequestId":"f2000000-0000-0000-0000-000000000001","providerOfferReference":"AND-OFF-INT02A","price":1760,"currency":"USD","priceBreakdown":{"lineHaul":1500,"handling":115,"customsCoordination":145},"estimatedPickup":"2026-08-30T12:00:00Z","estimatedDelivery":"2026-08-31T19:00:00Z","transitHours":31,"availableCapacityKg":10000,"availabilityClass":"AVAILABLE_IN_WINDOW","crossBorderSupported":true,"customsCoordinationIncluded":true,"requiredDocuments":["commercial_invoice","packing_list"],"borderHandlingNotes":"Included","validUntil":"2026-08-30T18:00:00Z"}}'::jsonb,
      '2026-08-30T12:02:00Z', '2026-08-30T12:02:00.120Z', 120, 'COMPLETED', null, 'http://localhost:3000', '1.0'
    )
  $$,
  $$ values ('INSERTED'::text, 'CARRIER_OFFER'::text) $$,
  'quote success continues to create a CarrierOffer'
);
select is(
  (select carrier_service_id from public.carrier_offers where provider_offer_reference = 'AND-OFF-INT02A'),
  'd0000000-0000-0000-0000-000000000001'::uuid,
  'CarrierOffer preserves the exact discovered service'
);

select * from finish();
rollback;

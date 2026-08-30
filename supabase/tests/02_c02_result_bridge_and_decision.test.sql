begin;
select plan(29);

select ok(
  to_regprocedure('public.record_provider_result(text,uuid,uuid,uuid,text,text,jsonb,jsonb,timestamp with time zone,timestamp with time zone,text)') is not null,
  'record_provider_result RPC exists'
);
select ok(
  to_regprocedure('public.persist_balanced_decision(uuid,uuid,jsonb,jsonb,numeric,jsonb,jsonb,jsonb,uuid,boolean)') is not null,
  'persist_balanced_decision RPC exists'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.record_provider_result(text,uuid,uuid,uuid,text,text,jsonb,jsonb,timestamp with time zone,timestamp with time zone,text)',
    'EXECUTE'
  ),
  'authenticated cannot execute the privileged Result Bridge RPC directly'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.persist_balanced_decision(uuid,uuid,jsonb,jsonb,numeric,jsonb,jsonb,jsonb,uuid,boolean)',
    'EXECUTE'
  ),
  'authenticated cannot execute decision persistence directly'
);
select ok(
  not has_table_privilege('authenticated', 'public.carrier_offers', 'INSERT'),
  'authenticated has no direct CarrierOffer insert privilege'
);
select ok(
  not has_table_privilege('authenticated', 'public.orchestration_events', 'INSERT'),
  'authenticated has no direct orchestration event insert privilege'
);

set local role service_role;

insert into public.orchestration_runs (
  id,
  freight_request_id,
  run_type,
  status,
  created_by_member_id
) values (
  '90000000-0000-0000-0000-000000000001',
  'f2000000-0000-0000-0000-000000000001',
  'INITIAL',
  'RUNNING',
  'e0000000-0000-0000-0000-000000000001'
);

select results_eq(
  $$
    select result_status, deduplicated, record_type
    from public.record_provider_result(
      'c02-tool-call-1',
      '90000000-0000-0000-0000-000000000001',
      'f2000000-0000-0000-0000-000000000001',
      'b0000000-0000-0000-0000-000000000001',
      '/providers/andes',
      'quote_freight',
      '{"freight_request_id":"f2000000-0000-0000-0000-000000000001"}'::jsonb,
      '{"ok":true,"data":{"schemaVersion":"1.0","freightRequestId":"f2000000-0000-0000-0000-000000000001","providerOfferReference":"AND-OFF-C02","price":1760,"currency":"USD","priceBreakdown":{"lineHaul":1500,"handling":115,"customsCoordination":145},"estimatedPickup":"2026-08-30T12:00:00Z","estimatedDelivery":"2026-08-31T19:00:00Z","transitHours":31,"availableCapacityKg":10000,"availabilityClass":"AVAILABLE_IN_WINDOW","crossBorderSupported":true,"customsCoordinationIncluded":true,"requiredDocuments":["commercial_invoice","packing_list"],"borderHandlingNotes":"Included","validUntil":"2026-08-30T18:00:00Z"}}'::jsonb,
      '2026-08-29T12:00:00Z',
      '2026-08-29T12:00:00.120Z',
      '1.0'
    )
  $$,
  $$ values ('INSERTED'::text, false, 'CARRIER_OFFER'::text) $$,
  'first ingestion creates a CarrierOffer and event'
);

select is((select count(*)::integer from public.carrier_offers), 1, 'one offer was inserted');
select is((select count(*)::integer from public.orchestration_events), 1, 'one event was inserted');

select results_eq(
  $$
    select result_status, deduplicated, record_type
    from public.record_provider_result(
      'c02-tool-call-1',
      '90000000-0000-0000-0000-000000000001',
      'f2000000-0000-0000-0000-000000000001',
      'b0000000-0000-0000-0000-000000000001',
      '/providers/andes',
      'quote_freight',
      '{"freight_request_id":"f2000000-0000-0000-0000-000000000001"}'::jsonb,
      '{"ok":true,"data":{"schemaVersion":"1.0","freightRequestId":"f2000000-0000-0000-0000-000000000001","providerOfferReference":"AND-OFF-C02","price":1760,"currency":"USD","priceBreakdown":{"lineHaul":1500,"handling":115,"customsCoordination":145},"estimatedPickup":"2026-08-30T12:00:00Z","estimatedDelivery":"2026-08-31T19:00:00Z","transitHours":31,"availableCapacityKg":10000,"availabilityClass":"AVAILABLE_IN_WINDOW","crossBorderSupported":true,"customsCoordinationIncluded":true,"requiredDocuments":["commercial_invoice","packing_list"],"borderHandlingNotes":"Included","validUntil":"2026-08-30T18:00:00Z"}}'::jsonb,
      '2026-08-29T12:00:00Z',
      '2026-08-29T12:00:00.120Z',
      '1.0'
    )
  $$,
  $$ values ('DEDUPLICATED'::text, true, 'CARRIER_OFFER'::text) $$,
  'same tool_call_id and same payload is deduplicated'
);

select results_eq(
  $$ select (select count(*) from public.carrier_offers)::integer, (select count(*) from public.orchestration_events)::integer $$,
  $$ values (1, 1) $$,
  'exact retry creates neither an offer nor an event'
);

select throws_ok(
  $$
    select * from public.record_provider_result(
      'c02-tool-call-1',
      '90000000-0000-0000-0000-000000000001',
      'f2000000-0000-0000-0000-000000000001',
      'b0000000-0000-0000-0000-000000000001',
      '/providers/andes',
      'quote_freight',
      '{"freight_request_id":"f2000000-0000-0000-0000-000000000001"}'::jsonb,
      '{"ok":true,"data":{"schemaVersion":"1.0","freightRequestId":"f2000000-0000-0000-0000-000000000001","providerOfferReference":"AND-OFF-C02","price":1761,"currency":"USD","priceBreakdown":{"lineHaul":1501,"handling":115,"customsCoordination":145},"estimatedPickup":"2026-08-30T12:00:00Z","estimatedDelivery":"2026-08-31T19:00:00Z","transitHours":31,"availableCapacityKg":10000,"availabilityClass":"AVAILABLE_IN_WINDOW","crossBorderSupported":true,"customsCoordinationIncluded":true,"requiredDocuments":["commercial_invoice","packing_list"],"borderHandlingNotes":"Included","validUntil":"2026-08-30T18:00:00Z"}}'::jsonb,
      '2026-08-29T12:00:00Z',
      '2026-08-29T12:00:00.120Z',
      '1.0'
    )
  $$,
  'P0001',
  null,
  'same tool_call_id with different payload raises an idempotency conflict'
);

select results_eq(
  $$
    select result_status, deduplicated
    from public.record_provider_result(
      'c02-tool-call-2',
      '90000000-0000-0000-0000-000000000001',
      'f2000000-0000-0000-0000-000000000001',
      'b0000000-0000-0000-0000-000000000001',
      '/providers/andes',
      'quote_freight',
      '{"freight_request_id":"f2000000-0000-0000-0000-000000000001"}'::jsonb,
      '{"ok":true,"data":{"schemaVersion":"1.0","freightRequestId":"f2000000-0000-0000-0000-000000000001","providerOfferReference":"AND-OFF-C02","price":1760,"currency":"USD","priceBreakdown":{"lineHaul":1500,"handling":115,"customsCoordination":145},"estimatedPickup":"2026-08-30T12:00:00Z","estimatedDelivery":"2026-08-31T19:00:00Z","transitHours":31,"availableCapacityKg":10000,"availabilityClass":"AVAILABLE_IN_WINDOW","crossBorderSupported":true,"customsCoordinationIncluded":true,"requiredDocuments":["commercial_invoice","packing_list"],"borderHandlingNotes":"Included","validUntil":"2026-08-30T18:00:00Z"}}'::jsonb,
      '2026-08-29T12:00:01Z',
      '2026-08-29T12:00:01.120Z',
      '1.0'
    )
  $$,
  $$ values ('DEDUPLICATED'::text, true) $$,
  'same provider reference in the run links a second event to the existing offer'
);

select is((select count(*)::integer from public.carrier_offers), 1, 'provider tuple dedupe keeps one offer');
select is((select count(*)::integer from public.orchestration_events), 2, 'provider tuple dedupe preserves both tool events');

set local role authenticated;
set local "request.jwt.claims" to '{"sub":"d0000000-0000-0000-0000-000000000001","role":"authenticated"}';

select is((select count(*)::integer from public.carrier_offers), 1, 'ACME member can read its runtime offer');
select is((select count(*)::integer from public.orchestration_events), 2, 'ACME member can read its runtime events');

set local "request.jwt.claims" to '{"sub":"00000000-0000-0000-0000-000000000099","role":"authenticated"}';

select is((select count(*)::integer from public.carrier_offers), 0, 'non-member cannot read the runtime offer');
select is((select count(*)::integer from public.orchestration_events), 0, 'non-member cannot read runtime events');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.carrier_offers'::regclass),
  'RLS remains enabled on carrier_offers'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.orchestration_events'::regclass),
  'RLS remains enabled on orchestration_events'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.freight_decisions'::regclass),
  'RLS remains enabled on freight_decisions'
);

set local role service_role;

select results_eq(
  $$
    select decision_id is not null, run_status
    from public.persist_balanced_decision(
      '90000000-0000-0000-0000-000000000001',
      'f2000000-0000-0000-0000-000000000001',
      jsonb_build_object(
        'orchestrationRunId', '90000000-0000-0000-0000-000000000001',
        'strategy', 'BALANCED',
        'recommendedOfferId', (select id from public.carrier_offers limit 1),
        'decisionConfidence', 84,
        'options', jsonb_build_array(jsonb_build_object(
          'offerId', (select id from public.carrier_offers limit 1),
          'rank', 1,
          'rawScore', 93,
          'roundedScore', 93,
          'eligible', true,
          'reasons', jsonb_build_array('Single eligible option')
        ))
      ),
      '{"scoringVersion":"BALANCED_V1","candidates":[]}'::jsonb,
      84,
      '{"candidateSeparation":0}'::jsonb,
      '{}'::jsonb,
      '{}'::jsonb,
      (select id from public.carrier_offers limit 1),
      true
    )
  $$,
  $$ values (true, 'OPTIONS_READY'::text) $$,
  'one eligible offer persists an immutable decision and OPTIONS_READY'
);

select is(
  (select count(*)::integer from public.freight_decisions where orchestration_run_id = '90000000-0000-0000-0000-000000000001'),
  1,
  'one FreightDecision exists for the evaluated run'
);
select results_eq(
  $$
    select
      (select status from public.orchestration_runs where id = '90000000-0000-0000-0000-000000000001'),
      (select status from public.freight_requests where id = 'f2000000-0000-0000-0000-000000000001')
  $$,
  $$ values ('OPTIONS_READY'::text, 'AWAITING_SELECTION'::text) $$,
  'successful ranking updates run and request states atomically'
);

set local role authenticated;
set local "request.jwt.claims" to '{"sub":"d0000000-0000-0000-0000-000000000001","role":"authenticated"}';
select is((select count(*)::integer from public.freight_decisions), 1, 'ACME member can read its decision');

set local role service_role;
insert into public.orchestration_runs (
  id,
  freight_request_id,
  run_type,
  status,
  created_by_member_id
) values (
  '90000000-0000-0000-0000-000000000002',
  'f2000000-0000-0000-0000-000000000001',
  'INITIAL',
  'RUNNING',
  'e0000000-0000-0000-0000-000000000001'
);

select results_eq(
  $$
    select decision_id is null, run_status
    from public.persist_balanced_decision(
      '90000000-0000-0000-0000-000000000002',
      'f2000000-0000-0000-0000-000000000001',
      '{"orchestrationRunId":"90000000-0000-0000-0000-000000000002","strategy":"BALANCED","recommendedOfferId":null,"decisionConfidence":0,"options":[]}'::jsonb,
      '{"scoringVersion":"BALANCED_V1","candidates":[]}'::jsonb,
      0,
      '{"candidateSeparation":0}'::jsonb,
      '{}'::jsonb,
      '{}'::jsonb,
      null,
      true
    )
  $$,
  $$ values (true, 'NO_MATCH'::text) $$,
  'zero offers produces NO_MATCH without a winning decision'
);
select is(
  (select count(*)::integer from public.freight_decisions where orchestration_run_id = '90000000-0000-0000-0000-000000000002'),
  0,
  'NO_MATCH does not create a synthetic FreightDecision'
);
select results_eq(
  $$
    select
      (select status from public.orchestration_runs where id = '90000000-0000-0000-0000-000000000002'),
      (select status from public.freight_requests where id = 'f2000000-0000-0000-0000-000000000001')
  $$,
  $$ values ('NO_MATCH'::text, 'PENDING'::text) $$,
  'NO_MATCH returns the request to an editable and retryable state'
);

select * from finish();
rollback;

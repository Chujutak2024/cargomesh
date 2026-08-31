begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
select plan(40);

select ok(
  to_regprocedure('public.prepare_booking_authorization(uuid,uuid,uuid,text,text)') is not null,
  'server-side booking authorization RPC exists'
);
select ok(
  to_regprocedure('public.record_provider_booking_result(text,uuid,jsonb,text,text,timestamp with time zone,boolean,text,boolean)') is not null,
  'separate provider booking bridge RPC exists'
);
select ok(
  to_regprocedure('public.record_provider_booking_status(text,uuid,uuid,jsonb,text,text,text,jsonb)') is not null,
  'separate provider status bridge RPC exists'
);
select ok((select relrowsecurity from pg_class where oid = 'public.booking_authorizations'::regclass), 'RLS is enabled on booking authorizations');
select ok((select relrowsecurity from pg_class where oid = 'public.booking_bridge_calls'::regclass), 'RLS is enabled on booking bridge calls');
select ok(not has_table_privilege('authenticated', 'public.booking_authorizations', 'INSERT'), 'authenticated cannot issue booking authorizations directly');
select ok(not has_table_privilege('authenticated', 'public.booking_bridge_calls', 'INSERT'), 'authenticated cannot insert bridge calls directly');
select ok(not has_function_privilege('authenticated', 'public.prepare_booking_authorization(uuid,uuid,uuid,text,text)', 'EXECUTE'), 'authenticated cannot prepare a booking authorization directly');
select ok(not has_function_privilege('authenticated', 'public.record_provider_booking_result(text,uuid,jsonb,text,text,timestamp with time zone,boolean,text,boolean)', 'EXECUTE'), 'authenticated cannot record a booking directly');
select ok(not has_function_privilege('authenticated', 'public.assert_booking_bridge_identity(public.booking_authorizations,jsonb,text)', 'EXECUTE'), 'authenticated cannot invoke the booking correlation helper');

set local role service_role;

create function pg_temp.c03_book_payload(p_authorization uuid, p_deadline timestamptz, p_replay boolean)
returns jsonb language sql as $c03$
  select jsonb_build_object(
    'schemaVersion', '1.0',
    'cargomeshOrigin', 'http://localhost:3000',
    'authorizationReference', p_authorization,
    'freightRequestId', 'f2000000-0000-0000-0000-000000000001',
    'offerId', '92000000-0000-0000-0000-000000000001',
    'carrierId', 'b0000000-0000-0000-0000-000000000001',
    'matchingServiceId', 'd0000000-0000-0000-0000-000000000001',
    'providerUrl', '/providers/andes',
    'navigationUrl', 'http://localhost:3000/providers/andes?serviceId=d0000000-0000-0000-0000-000000000001',
    'toolName', 'book_freight',
    'toolInput', jsonb_build_object(
      'freight_request_id', 'f2000000-0000-0000-0000-000000000001',
      'provider_offer_reference', 'AND-OFF-C03',
      'idempotency_key', 'c03-booking-key-1',
      'authorization_context', jsonb_build_object('authorization_reference', p_authorization, 'authorized_by', 'HUMAN_SELECTION'),
      'selection_mode', 'ASSISTED'
    ),
    'toolOutput', jsonb_build_object('ok', true, 'data', jsonb_build_object(
      'freightRequestId', 'f2000000-0000-0000-0000-000000000001',
      'providerOfferReference', 'AND-OFF-C03',
      'providerReference', 'AND-BOOK-C03',
      'providerBookingStatus', 'PENDING_PROVIDER_CONFIRMATION',
      'providerResponseDeadline', p_deadline,
      'idempotentReplay', p_replay
    ))
  );
$c03$;

create function pg_temp.c03_status_payload(p_authorization uuid, p_booking uuid, p_status text)
returns jsonb language sql as $c03$
  select jsonb_build_object(
    'schemaVersion', '1.0',
    'cargomeshOrigin', 'http://localhost:3000',
    'authorizationReference', p_authorization,
    'bookingId', p_booking,
    'freightRequestId', 'f2000000-0000-0000-0000-000000000001',
    'offerId', '92000000-0000-0000-0000-000000000001',
    'carrierId', 'b0000000-0000-0000-0000-000000000001',
    'matchingServiceId', 'd0000000-0000-0000-0000-000000000001',
    'providerUrl', '/providers/andes',
    'navigationUrl', 'http://localhost:3000/providers/andes?serviceId=d0000000-0000-0000-0000-000000000001',
    'toolName', 'get_provider_booking_status',
    'toolInput', jsonb_build_object('provider_reference', 'AND-BOOK-C03'),
    'toolOutput', jsonb_build_object('ok', true, 'data', jsonb_build_object(
      'providerReference', 'AND-BOOK-C03',
      'providerBookingStatus', p_status,
      'paymentStatus', 'NOT_REQUIRED'
    ))
  );
$c03$;

insert into public.orchestration_runs (id, freight_request_id, run_type, status, created_by_member_id)
values ('91000000-0000-0000-0000-000000000001', 'f2000000-0000-0000-0000-000000000001', 'INITIAL', 'OPTIONS_READY', 'e0000000-0000-0000-0000-000000000001');

insert into public.carrier_offers (
  id, orchestration_run_id, freight_request_id, carrier_id, carrier_service_id,
  tool_call_id, provider_offer_reference, price, currency, estimated_pickup,
  estimated_delivery, transit_hours, available_capacity_kg, availability_class,
  availability_score, reliability_score, status, valid_until
) values (
  '92000000-0000-0000-0000-000000000001',
  '91000000-0000-0000-0000-000000000001',
  'f2000000-0000-0000-0000-000000000001',
  'b0000000-0000-0000-0000-000000000001',
  'd0000000-0000-0000-0000-000000000001',
  'c03-quote-1', 'AND-OFF-C03', 1760, 'USD', now() + interval '1 day',
  now() + interval '2 days', 31, 10000, 'AVAILABLE_IN_WINDOW', 90, 96,
  'ELIGIBLE', now() + interval '6 hours'
);

insert into public.freight_decisions (
  id, freight_request_id, orchestration_run_id, decision_version, decision_type,
  recommended_offer_id, optimization_strategy, ranking_snapshot, subscores,
  confidence_components, anomaly_evidence
) values (
  '93000000-0000-0000-0000-000000000001',
  'f2000000-0000-0000-0000-000000000001',
  '91000000-0000-0000-0000-000000000001', 1, 'INITIAL',
  '92000000-0000-0000-0000-000000000001', 'BALANCED', '[]', '{}', '{}', '{}'
);

update public.freight_requests set status = 'AWAITING_SELECTION' where id = 'f2000000-0000-0000-0000-000000000001';

select results_eq(
  $$
    select authorization_kind, selection_mode, deduplicated
    from public.prepare_booking_authorization(
      'f2000000-0000-0000-0000-000000000001',
      '92000000-0000-0000-0000-000000000001',
      'e0000000-0000-0000-0000-000000000001',
      'ASSISTED', 'c03-booking-key-1'
    )
  $$,
  $$ values ('HUMAN_SELECTION'::text, 'ASSISTED'::text, false) $$,
  'ASSISTED issues a server-side human authorization'
);
select is((select status from public.freight_requests where id = 'f2000000-0000-0000-0000-000000000001'), 'BOOKING', 'preparation moves the request to BOOKING');
select is((select selected_offer_id from public.freight_decisions where id = '93000000-0000-0000-0000-000000000001'), '92000000-0000-0000-0000-000000000001', 'the selected offer is persisted by the server');

select results_eq(
  $$
    select deduplicated
    from public.prepare_booking_authorization(
      'f2000000-0000-0000-0000-000000000001',
      '92000000-0000-0000-0000-000000000001',
      'e0000000-0000-0000-0000-000000000001',
      'ASSISTED', 'c03-booking-key-1'
    )
  $$,
  $$ values (true) $$,
  'same booking selection key is deduplicated'
);
select throws_ok(
  $$
    select * from public.prepare_booking_authorization(
      'f2000000-0000-0000-0000-000000000001',
      '92000000-0000-0000-0000-000000000001',
      'e0000000-0000-0000-0000-000000000001',
      'SMART_AUTO', 'c03-booking-key-1'
    )
  $$,
  'P0001', null, 'same booking key with a different selection conflicts'
);

select results_eq(
  $$
    select result_status, deduplicated
    from public.record_provider_booking_result(
      'cm:booking:v1:call-1',
      (select id from public.booking_authorizations where booking_idempotency_key = 'c03-booking-key-1'),
       pg_temp.c03_book_payload((select id from public.booking_authorizations where booking_idempotency_key = 'c03-booking-key-1'), now() + interval '15 minutes', false),
      'AND-BOOK-C03', 'PENDING_PROVIDER_CONFIRMATION', now() + interval '15 minutes', false, null, false
    )
  $$,
  $$ values ('INSERTED'::text, false) $$,
  'provider book result creates one CargoMesh booking'
);
select results_eq(
  $$ select status, provider_booking_status, payment_status from public.bookings $$,
  $$ values ('PENDING_PROVIDER_CONFIRMATION'::text, 'PENDING_PROVIDER_CONFIRMATION'::text, 'NOT_REQUIRED'::text) $$,
  'provider result persists internal and provider booking state separately'
);
select is((select count(*)::integer from public.booking_events), 1, 'booking result creates an auditable booking event');

select results_eq(
  $$
    select result_status, deduplicated
    from public.record_provider_booking_result(
      'cm:booking:v1:call-1',
      (select id from public.booking_authorizations where booking_idempotency_key = 'c03-booking-key-1'),
       pg_temp.c03_book_payload((select id from public.booking_authorizations where booking_idempotency_key = 'c03-booking-key-1'), (select provider_response_deadline from public.bookings), false),
      'AND-BOOK-C03', 'PENDING_PROVIDER_CONFIRMATION',
       (select provider_response_deadline from public.bookings), false, null, false
    )
  $$,
  $$ values ('DEDUPLICATED'::text, true) $$,
  'same bridge call and canonical payload deduplicates after booking exists'
);
select results_eq(
  $$
    select result_status, deduplicated
    from public.record_provider_booking_result(
      'cm:booking:v1:call-1:provider-replay',
      (select id from public.booking_authorizations where booking_idempotency_key = 'c03-booking-key-1'),
      pg_temp.c03_book_payload(
        (select id from public.booking_authorizations where booking_idempotency_key = 'c03-booking-key-1'),
        (select provider_response_deadline from public.bookings),
        true
      ),
      'AND-BOOK-C03', 'PENDING_PROVIDER_CONFIRMATION',
      (select provider_response_deadline from public.bookings), false, null, true
    )
  $$,
  $$ values ('DEDUPLICATED'::text, true) $$,
  'provider replay with a distinct bridge call deduplicates against the existing booking'
);
select is(
  (select count(*)::integer from public.bookings),
  1,
  'provider replay with a distinct bridge call never creates a duplicate booking'
);
select throws_ok(
  $$
    select * from public.record_provider_booking_result(
      'cm:booking:v1:call-1',
      (select id from public.booking_authorizations where booking_idempotency_key = 'c03-booking-key-1'),
       jsonb_set(pg_temp.c03_book_payload((select id from public.booking_authorizations where booking_idempotency_key = 'c03-booking-key-1'), (select provider_response_deadline from public.bookings), false), '{toolOutput,data,providerReference}', '"DIFFERENT"'::jsonb),
      'AND-BOOK-C03', 'PENDING_PROVIDER_CONFIRMATION',
      (select provider_response_deadline from public.bookings), false, null, false
    )
  $$,
  'P0001', null, 'different booking payload with the same bridge call conflicts'
);

select results_eq(
  $$
    select result_status, deduplicated
    from public.record_provider_booking_status(
      'cm:booking:v1:status-1',
      (select id from public.booking_authorizations where booking_idempotency_key = 'c03-booking-key-1'),
      (select id from public.bookings),
       pg_temp.c03_status_payload((select id from public.booking_authorizations where booking_idempotency_key = 'c03-booking-key-1'), (select id from public.bookings), 'CONFIRMED'),
      'AND-BOOK-C03', 'CONFIRMED', 'NOT_REQUIRED',
      jsonb_build_array(jsonb_build_object(
        'providerEventId', 'AND-EVENT-C03-1',
        'eventType', 'BOOKING_CONFIRMED',
        'providerBookingStatus', 'CONFIRMED',
        'occurredAt', now(),
        'location', null,
        'description', 'Provider confirmed booking'
      ))
    )
  $$,
  $$ values ('INSERTED'::text, false) $$,
  'status bridge records provider confirmation and nullable location'
);
select results_eq(
  $$ select status, provider_booking_status from public.bookings $$,
  $$ values ('CONFIRMED'::text, 'CONFIRMED'::text) $$,
  'confirmation updates the CargoMesh booking state'
);
select is((select status from public.freight_requests where id = 'f2000000-0000-0000-0000-000000000001'), 'BOOKED', 'confirmation moves the FreightRequest to BOOKED');
select is((select count(*)::integer from public.booking_events), 2, 'provider event is persisted exactly once');

select ok(not has_table_privilege('authenticated', 'public.booking_authorizations', 'SELECT'), 'authorization contexts stay server-only');
select ok(not has_table_privilege('authenticated', 'public.booking_bridge_calls', 'SELECT'), 'booking bridge audit payloads stay server-only');
select ok(not has_function_privilege('authenticated', 'public.record_provider_booking_status(text,uuid,uuid,jsonb,text,text,text,jsonb)', 'EXECUTE'), 'authenticated cannot record provider status directly');
select is((select count(*)::integer from public.booking_bridge_calls), 3, 'service role retained three independent bridge audit calls');

set local role service_role;
insert into public.carrier_offers (
  id, orchestration_run_id, freight_request_id, carrier_id, carrier_service_id,
  tool_call_id, provider_offer_reference, price, currency, estimated_pickup,
  estimated_delivery, transit_hours, available_capacity_kg, availability_class,
  availability_score, reliability_score, status, valid_until
) values (
  '92000000-0000-0000-0000-000000000002',
  '91000000-0000-0000-0000-000000000001',
  'f2000000-0000-0000-0000-000000000001',
  'b0000000-0000-0000-0000-000000000002',
  'd0000000-0000-0000-0000-000000000002',
  'c03-quote-2', 'INC-OFF-C03', 1880, 'USD', now() + interval '1 day',
  now() + interval '2 days', 34, 10000, 'AVAILABLE_IN_WINDOW', 88, 98,
  'ELIGIBLE', now() + interval '6 hours'
);

select results_eq(
  $$
    select result_status, deduplicated
    from public.record_provider_booking_status(
      'cm:booking:v1:status-reject',
      (select id from public.booking_authorizations where booking_idempotency_key = 'c03-booking-key-1'),
      (select id from public.bookings),
      pg_temp.c03_status_payload((select id from public.booking_authorizations where booking_idempotency_key = 'c03-booking-key-1'), (select id from public.bookings), 'REJECTED'),
      'AND-BOOK-C03', 'REJECTED', 'NOT_REQUIRED',
      jsonb_build_array(jsonb_build_object(
        'providerEventId', 'AND-EVENT-C03-REJECT',
        'eventType', 'BOOKING_REJECTED',
        'providerBookingStatus', 'REJECTED',
        'occurredAt', now(),
        'location', null,
        'description', 'Provider rejected booking'
      ))
    )
  $$,
  $$ values ('INSERTED'::text, false) $$,
  'a provider rejection is persisted as rejection, never confirmation'
);
select results_eq(
  $$ select status, provider_booking_status from public.bookings $$,
  $$ values ('REJECTED'::text, 'REJECTED'::text) $$,
  'rejection remains explicitly visible on the booking'
);
select is((select status from public.freight_requests where id = 'f2000000-0000-0000-0000-000000000001'), 'AWAITING_SELECTION', 'rejection makes the request recoverable');
select results_eq(
  $$
    select authorization_kind, offer_id, deduplicated
    from public.prepare_booking_recovery(
      (select id from public.bookings),
      '92000000-0000-0000-0000-000000000002',
      'e0000000-0000-0000-0000-000000000001',
      'ASSISTED', 'c03-booking-recovery-key-1'
    )
  $$,
  $$ values ('HUMAN_SELECTION'::text, '92000000-0000-0000-0000-000000000002'::uuid, false) $$,
  'recovery authorizes an eligible remaining carrier'
);
select is((select status from public.bookings), 'REBOOKED', 'recovery retains causal history instead of deleting the rejected booking');
select is((select replaces_booking_id from public.booking_authorizations where booking_idempotency_key = 'c03-booking-recovery-key-1'), (select id from public.bookings), 'recovery authorization records the booking it replaces');
select results_eq(
  $$
    select authorization_kind, offer_id, deduplicated
    from public.prepare_booking_recovery(
      (select id from public.bookings),
      '92000000-0000-0000-0000-000000000002',
      'e0000000-0000-0000-0000-000000000001',
      'ASSISTED', 'c03-booking-recovery-key-1'
    )
  $$,
  $$ values ('HUMAN_SELECTION'::text, '92000000-0000-0000-0000-000000000002'::uuid, true) $$,
  'same recovery key replays even after the original booking becomes REBOOKED'
);
select ok(not has_function_privilege('authenticated', 'public.reset_demo_booking_runtime(uuid)', 'EXECUTE'), 'authenticated cannot reset the demo runtime directly');
select results_eq(
  $$ select deleted_bookings, deleted_authorizations from public.reset_demo_booking_runtime('f2000000-0000-0000-0000-000000000001') $$,
  $$ values (1, 2) $$,
  'demo reset removes only its booking runtime records'
);
select results_eq(
  $$ select deleted_bookings, deleted_authorizations from public.reset_demo_booking_runtime('f2000000-0000-0000-0000-000000000001') $$,
  $$ values (0, 0) $$,
  'a second demo reset is safely idempotent'
);

select * from finish();
rollback;

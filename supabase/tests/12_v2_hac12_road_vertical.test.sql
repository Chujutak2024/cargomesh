-- HAC-12: run against the clean V2 profile after the v2-road-baseline scenario.
-- The entire test rolls back; it never leaves a draft or receipt behind.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
select plan(43);

select has_column('public', 'service_lanes', 'planned_transit_minutes',
  'lane transit duration is persisted');
select has_column('public', 'service_lanes', 'transit_provenance_status',
  'lane transit provenance is persisted');
select has_column('public', 'service_lanes', 'cross_border_prohibited',
  'documented border prohibition is persisted');
select has_column('public', 'service_lanes', 'cross_border_prohibition_reference',
  'border prohibition requires a source reference');
select has_column('public', 'capacity_calendars', 'ready_pickup_area_id',
  'resource pickup readiness is persisted');
select ok(has_column_privilege('authenticated', 'public.capacity_calendars',
  'ready_pickup_area_id', 'SELECT'), 'authenticated evaluator can read pickup readiness');
select ok(not has_column_privilege('anon', 'public.capacity_calendars',
  'ready_pickup_area_id', 'SELECT'), 'anonymous caller cannot read pickup readiness');
select throws_ok($$
  update public.service_lanes set cross_border_prohibited = true
  where id = 'c2380000-0000-4000-8000-000000000001'
$$, '23514', null, 'a border prohibition without source evidence is rejected');

create function pg_temp.hac12_payload() returns jsonb language sql as $$
  select '{
    "schemaVersion":"2.0",
    "origin":{"facilityId":"c2330000-0000-4000-8000-000000000001","label":"browser assertion ignored"},
    "destination":{"facilityId":"c2330000-0000-4000-8000-000000000002"},
    "pickupWindow":{"startsAt":"2026-10-01T10:00:00Z","endsAt":"2026-10-01T12:00:00Z"},
    "deliveryWindow":{"startsAt":"2026-10-02T10:00:00Z","endsAt":"2026-10-02T12:00:00Z"},
    "acceptedModes":["ROAD"],
    "requiredEquipment":null,
    "cargoSpecification":{
      "categoryCode":"GENERAL","description":"Synthetic test cargo",
      "packaging":"PALLET","totalWeightKg":1000,"totalVolumeM3":2,
      "divisible":true,"requirements":[],
      "units":[{"packageType":"PALLET","quantity":1,"weightPerUnitKg":1000,
        "volumePerUnitM3":2,"dimensionsCm":{"length":100,"width":100,"height":200},
        "indivisible":false,"stackable":true}]
    },
    "contacts":{
      "pickup":{"name":"QA Pickup","phoneE164":"+51911111111"},
      "recipient":{"name":"QA Recipient","phoneE164":"+51922222222"}
    },
    "budget":{"amount":500,"currency":"USD"}
  }'::jsonb;
$$;

set local role authenticated;
set local "request.jwt.claims" to '{"sub":"c2310000-0000-4000-8000-000000000001","role":"authenticated"}';

select lives_ok($$
  select public.create_v2_freight_request(
    'c2300000-0000-4000-8000-000000000001',
    'c2320000-0000-4000-8000-000000000001',
    'a1200000-0000-4000-8000-000000000001',
    repeat('a',64), pg_temp.hac12_payload())
$$, 'one transaction creates V2 draft plus receipt');
select is((select count(*)::integer from public.freight_requests
  where creation_idempotency_key = 'a1200000-0000-4000-8000-000000000001'), 1,
  'exactly one draft exists');
select is((select v2_snapshot #>> '{origin,label}' from public.freight_requests
  where creation_idempotency_key = 'a1200000-0000-4000-8000-000000000001'),
  '[SYNTHETIC] A pickup on covered lane', 'facility canonical label overrides browser assertion');
select is((select v2_snapshot #>> '{contacts,recipient,phoneE164}' from public.freight_requests
  where creation_idempotency_key = 'a1200000-0000-4000-8000-000000000001'),
  '+51922222222', 'recipient survives persistence');
select is((select budget_currency from public.freight_requests
  where creation_idempotency_key = 'a1200000-0000-4000-8000-000000000001'),
  'USD', 'USD is explicit in the V2 row');
select is((public.create_v2_freight_request(
    'c2300000-0000-4000-8000-000000000001',
    'c2320000-0000-4000-8000-000000000001',
    'a1200000-0000-4000-8000-000000000001',
    repeat('a',64), pg_temp.hac12_payload())->>'idempotentReplay'),
  'true', 'same key and hash replay');
select throws_ok($$
  select public.create_v2_freight_request(
    'c2300000-0000-4000-8000-000000000001',
    'c2320000-0000-4000-8000-000000000001',
    'a1200000-0000-4000-8000-000000000001',
    repeat('b',64), pg_temp.hac12_payload())
$$, 'PT409', 'IDEMPOTENCY_CONFLICT', 'different hash fails closed');
select throws_ok($$
  select public.create_v2_freight_request(
    'c2300000-0000-4000-8000-000000000001',
    'c2320000-0000-4000-8000-000000000001',
    'a1200000-0000-4000-8000-000000000001',
    repeat('a',64), jsonb_set(pg_temp.hac12_payload(), '{budget,amount}', '501'::jsonb))
$$, 'PT409', 'IDEMPOTENCY_CONFLICT', 'same claimed hash cannot hide a changed payload');
select throws_ok($$
  select public.create_v2_freight_request(
    'c2300000-0000-4000-8000-000000000001',
    'c2320000-0000-4000-8000-000000000001',
    'a1200000-0000-4000-8000-000000000002',
    repeat('a',64), jsonb_set(pg_temp.hac12_payload(), '{origin,facilityId}',
      '"c2330000-0000-4000-8000-000000000004"'::jsonb))
$$, 'PT403', 'FORBIDDEN_TENANT', 'foreign facility rejects with contractual 403');
select throws_ok($$
  select public.create_v2_freight_request(
    'c2300000-0000-4000-8000-000000000001',
    'c2320000-0000-4000-8000-000000000001',
    'a1200000-0000-4000-8000-000000000005',
    repeat('a',64), jsonb_set(pg_temp.hac12_payload(), '{destination,facilityId}',
      '"c2330000-0000-4000-8000-000000000004"'::jsonb))
$$, 'PT403', 'FORBIDDEN_TENANT', 'foreign destination also rejects with 403');
select throws_ok($$
  select public.create_v2_freight_request(
    'c2300000-0000-4000-8000-000000000001',
    'c2320000-0000-4000-8000-000000000001',
    'a1200000-0000-4000-8000-000000000006',
    repeat('a',64), jsonb_set(pg_temp.hac12_payload(), '{origin,facilityId}',
      '"ffffffff-ffff-4fff-8fff-ffffffffffff"'::jsonb))
$$, 'PT400', 'VALIDATION_ERROR', 'missing facility remains a validation error');
select is((select count(*)::integer from public.freight_requests
  where creation_idempotency_key = 'a1200000-0000-4000-8000-000000000002'), 0,
  'failed foreign facility leaves no receipt');
select throws_ok($$
  select public.create_v2_freight_request(
    'c2300000-0000-4000-8000-000000000002',
    'c2320000-0000-4000-8000-000000000002',
    'a1200000-0000-4000-8000-000000000003',
    repeat('a',64), pg_temp.hac12_payload())
$$, 'PT403', 'FORBIDDEN_TENANT', 'actor cannot impersonate another tenant');
select throws_ok($$
  select public.create_v2_freight_request(
    'c2300000-0000-4000-8000-000000000001',
    'c2320000-0000-4000-8000-000000000001',
    'a1200000-0000-4000-8000-000000000004',
    repeat('a',64), jsonb_set(pg_temp.hac12_payload(), '{budget,currency}', '"PEN"'::jsonb))
$$, 'PT400', 'VALIDATION_ERROR', 'PEN is rejected in MVP V2');
select is((select count(*)::integer from public.freight_requests
  where creation_idempotency_key in (
    'a1200000-0000-4000-8000-000000000002',
    'a1200000-0000-4000-8000-000000000003',
    'a1200000-0000-4000-8000-000000000004')), 0,
  'all failed mutations rolled back');


-- Independent review R-01: no direct client can rewrite a canonical V2 draft.
select throws_ok($$
  update public.freight_requests
  set v2_snapshot = jsonb_set(v2_snapshot, '{origin,city}', '"Piura"'::jsonb)
  where creation_idempotency_key = 'a1200000-0000-4000-8000-000000000001'
$$, 'PT409', 'V2_DRAFT_MUTATION_UNSUPPORTED', 'authenticated snapshot overwrite is blocked');
select throws_ok($$
  update public.freight_requests set draft_version = draft_version + 1
  where creation_idempotency_key = 'a1200000-0000-4000-8000-000000000001'
$$, 'PT409', 'V2_DRAFT_MUTATION_UNSUPPORTED', 'incrementing a version does not bypass canonical writes');
select throws_ok($$
  update public.freight_requests set v2_contract_version = null
  where creation_idempotency_key = 'a1200000-0000-4000-8000-000000000001'
$$, 'PT409', 'V2_DRAFT_MUTATION_UNSUPPORTED', 'removing the V2 marker is blocked');
select is((select draft_version from public.freight_requests
  where creation_idempotency_key = 'a1200000-0000-4000-8000-000000000001'), 1,
  'blocked writes leave the version unchanged');
select is((select v2_snapshot #>> '{origin,city}' from public.freight_requests
  where creation_idempotency_key = 'a1200000-0000-4000-8000-000000000001'), 'Lima',
  'blocked writes preserve the canonical city');

-- R-03: direct RPC cannot bypass the relationship between units and totals.
select throws_ok($$
  select public.create_v2_freight_request(
    'c2300000-0000-4000-8000-000000000001', 'c2320000-0000-4000-8000-000000000001',
    'a1200000-0000-4000-8000-000000000008', repeat('a',64),
    jsonb_set(pg_temp.hac12_payload(), '{cargoSpecification,units,0,quantity}', '100'::jsonb))
$$, 'PT400', 'VALIDATION_ERROR', 'quantity mismatch fails before persistence');
select throws_ok($$
  select public.create_v2_freight_request(
    'c2300000-0000-4000-8000-000000000001', 'c2320000-0000-4000-8000-000000000001',
    'a1200000-0000-4000-8000-000000000009', repeat('a',64),
    jsonb_set(pg_temp.hac12_payload(), '{cargoSpecification,totalVolumeM3}', '1'::jsonb))
$$, 'PT400', 'VALIDATION_ERROR', 'volume mismatch fails before persistence');
select is((select count(*)::integer from public.freight_requests
  where creation_idempotency_key in ('a1200000-0000-4000-8000-000000000008',
    'a1200000-0000-4000-8000-000000000009')), 0, 'invalid totals leave no receipts');

-- R-05: manual coordinates survive; they are not verified facilities or routes.
select lives_ok($$
  select public.create_v2_freight_request(
    'c2300000-0000-4000-8000-000000000001', 'c2320000-0000-4000-8000-000000000001',
    'a1200000-0000-4000-8000-000000000010', repeat('a',64),
    jsonb_set(jsonb_set(pg_temp.hac12_payload(), '{origin}',
      '{"label":"Manual Lima","countryCode":"PE","city":"Lima","lat":-12.0464,"lng":-77.1181}'::jsonb),
      '{destination}', '{"label":"Manual Arequipa","countryCode":"PE","city":"Arequipa","lat":-16.4,"lng":-71.53}'::jsonb))
$$, 'manual origin and destination coordinates are accepted together');
select is((select v2_snapshot #>> '{origin,lat}' from public.freight_requests
  where creation_idempotency_key = 'a1200000-0000-4000-8000-000000000010'), '-12.0464',
  'manual origin latitude survives');
select is((select v2_snapshot #>> '{destination,lng}' from public.freight_requests
  where creation_idempotency_key = 'a1200000-0000-4000-8000-000000000010'), '-71.53',
  'manual destination longitude survives');
select ok((select origin_facility_id is null and destination_facility_id is null
  from public.freight_requests where creation_idempotency_key = 'a1200000-0000-4000-8000-000000000010'),
  'manual pins do not invent facility identities');
select throws_ok($$
  select public.create_v2_freight_request(
    'c2300000-0000-4000-8000-000000000001', 'c2320000-0000-4000-8000-000000000001',
    'a1200000-0000-4000-8000-000000000011', repeat('a',64),
    jsonb_set(pg_temp.hac12_payload(), '{origin}',
      '{"label":"Manual Lima","countryCode":"PE","city":"Lima","lat":-12.0464}'::jsonb))
$$, 'PT400', 'VALIDATION_ERROR', 'incomplete manual coordinate pair is rejected by RPC');
select throws_ok($$
  select public.create_v2_freight_request(
    'c2300000-0000-4000-8000-000000000001', 'c2320000-0000-4000-8000-000000000001',
    'a1200000-0000-4000-8000-000000000012', repeat('a',64),
    jsonb_set(pg_temp.hac12_payload(), '{destination}',
      '{"label":"Manual Arequipa","countryCode":"PE","city":"Arequipa","lat":-96,"lng":-71}'::jsonb))
$$, 'PT400', 'VALIDATION_ERROR', 'out-of-range manual coordinate is rejected by RPC');
select lives_ok($$
  select public.create_v2_freight_request(
    'c2300000-0000-4000-8000-000000000001', 'c2320000-0000-4000-8000-000000000001',
    'a1200000-0000-4000-8000-000000000013', repeat('a',64),
    jsonb_set(pg_temp.hac12_payload(), '{origin}',
      '{"label":"Manual Lima","countryCode":"PE","city":"Lima"}'::jsonb))
$$, 'manual location without coordinates remains supported');
select ok((select v2_snapshot #>> '{origin,lat}' is null and v2_snapshot #>> '{origin,lng}' is null
  from public.freight_requests where creation_idempotency_key = 'a1200000-0000-4000-8000-000000000013'),
  'missing manual coordinates stay unknown');

-- Fail after PostgreSQL has inserted the draft. The trigger and its function exist
-- only inside this test transaction; the failure must undo the row and receipt.
reset role;
create function pg_temp.hac12_abort_after_insert() returns trigger
language plpgsql as $$
begin
  raise exception 'HAC12_FORCED_AFTER_INSERT' using errcode = 'P0001';
end;
$$;
create trigger hac12_abort_after_insert after insert on public.freight_requests
for each row when (new.creation_idempotency_key = 'a1200000-0000-4000-8000-000000000007')
execute function pg_temp.hac12_abort_after_insert();
set local role authenticated;
select throws_ok($$
  select public.create_v2_freight_request(
    'c2300000-0000-4000-8000-000000000001',
    'c2320000-0000-4000-8000-000000000001',
    'a1200000-0000-4000-8000-000000000007',
    repeat('a',64), pg_temp.hac12_payload())
$$, 'P0001', 'HAC12_FORCED_AFTER_INSERT', 'post-insert failure propagates');
select is((select count(*)::integer from public.freight_requests
  where creation_idempotency_key = 'a1200000-0000-4000-8000-000000000007'), 0,
  'post-insert failure rolls back the draft and embedded receipt');


reset role;
drop trigger hac12_abort_after_insert on public.freight_requests;
set local role authenticated;
select lives_ok($$
  select public.create_v2_freight_request(
    'c2300000-0000-4000-8000-000000000001', 'c2320000-0000-4000-8000-000000000001',
    'a1200000-0000-4000-8000-000000000007', repeat('a',64), pg_temp.hac12_payload())
$$, 'same creation key succeeds after the forced failure is removed');
select is((select count(*)::integer from public.freight_requests
  where creation_idempotency_key = 'a1200000-0000-4000-8000-000000000007'), 1,
  'retry after rollback creates exactly one complete receipt');

select * from finish();
rollback;

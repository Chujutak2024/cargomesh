-- HAC-12: run against the clean V2 profile after the v2-road-baseline scenario.
-- The entire test rolls back; it never leaves a draft or receipt behind.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
select plan(15);

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

select * from finish();
rollback;

-- Requires the existing local ACME/FR-1042 scenario, like tests 01 and 07.
-- No remote execution. All test rows are rolled back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
select plan(13);

create function pg_temp.insert_creation_test(request_code text, request_key uuid, request_hash text, supplied_member uuid default null)
returns void language sql as $$
  insert into public.freight_requests (
    organization_id, cargo_category_id, requested_by_member_id, code,
    origin_country, origin_city, destination_country, destination_city,
    cargo_weight_kg, required_pickup, status, creation_idempotency_key, creation_payload_hash
  ) select f.organization_id, f.cargo_category_id, coalesce(supplied_member, m.id), request_code,
    f.origin_country, f.origin_city, f.destination_country, f.destination_city,
    1600, now() + interval '1 day', 'DRAFT', request_key, request_hash
  from public.freight_requests f join public.organization_members m
    on m.organization_id = f.organization_id
    and m.auth_user_id = 'd0000000-0000-0000-0000-000000000001'::uuid
  where f.code = 'FR-1042';
$$;

set local role authenticated;
set local "request.jwt.claims" to '{"sub":"d0000000-0000-0000-0000-000000000001","role":"authenticated"}';
select lives_ok(
  $$select pg_temp.insert_creation_test('MCP-IDEM-1', '94000000-0000-4000-8000-000000000001', repeat('a',64))$$,
  'authenticated supervisor can persist a keyed draft'
);
select is((select count(*)::integer from public.freight_requests where code = 'MCP-IDEM-1'), 1,
  'test fixture actually inserted one request');
select throws_ok(
  $$select pg_temp.insert_creation_test('MCP-IDEM-2', '94000000-0000-4000-8000-000000000001', repeat('a',64))$$,
  '23505', null, 'unique index rejects duplicate key even with a new request code'
);
select throws_ok(
  $$select pg_temp.insert_creation_test('MCP-IDEM-3', '94000000-0000-4000-8000-000000000001', repeat('b',64))$$,
  '23505', null, 'different payload cannot reuse the key'
);
select throws_ok(
  $$update public.freight_requests set creation_payload_hash = repeat('b',64) where code = 'MCP-IDEM-1'$$,
  '23514', null, 'draft updates cannot rewrite the creation fingerprint'
);
select throws_ok(
  $$update public.freight_requests set creation_idempotency_key = null, creation_payload_hash = null where code = 'MCP-IDEM-1'$$,
  '23514', null, 'draft updates cannot release the key'
);
select lives_ok(
  $$update public.freight_requests set draft_version = draft_version + 1 where code = 'MCP-IDEM-1'$$,
  'normal draft editing remains possible'
);
select throws_ok(
  $$select pg_temp.insert_creation_test('MCP-IDEM-4', '94000000-0000-4000-8000-000000000002', 'bad-hash')$$,
  '23514', null, 'malformed fingerprints are rejected'
);
select lives_ok(
  $$select pg_temp.insert_creation_test('MCP-LEGACY-1', null, null)$$,
  'existing non-keyed creation remains compatible'
);
select throws_ok(
  $$select pg_temp.insert_creation_test('MCP-SPOOF-1', '94000000-0000-4000-8000-000000000003', repeat('a',64), 'ffffffff-0000-4000-8000-000000000001')$$,
  '42501', null, 'RLS rejects receipts attributed to a different member before FK checks'
);
reset role;
update public.organization_members set role = 'REQUESTER'
  where auth_user_id = 'd0000000-0000-0000-0000-000000000001'::uuid;
set local role authenticated;
select throws_ok(
  $$select pg_temp.insert_creation_test('MCP-REQUESTER-1', '94000000-0000-4000-8000-000000000004', repeat('a',64))$$,
  '42501', null, 'REQUESTER cannot create keyed drafts'
);
set local role anon;
select throws_ok(
  $$select pg_temp.insert_creation_test('MCP-ANON-1', '94000000-0000-4000-8000-000000000005', repeat('a',64))$$,
  '42501', null, 'anonymous callers cannot create drafts'
);
reset role;
select ok((select relrowsecurity from pg_class where oid = 'public.freight_requests'::regclass),
  'RLS remains enabled');
select * from finish();
rollback;

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
select plan(14);

select ok(
  to_regprocedure('public.start_orchestration_run(uuid,uuid,text,jsonb)') is not null,
  'INT-02A start_orchestration_run RPC exists'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.start_orchestration_run(uuid,uuid,text,jsonb)',
    'EXECUTE'
  ),
  'authenticated cannot call the privileged start-run RPC directly'
);
select has_column('public', 'orchestration_runs', 'idempotency_key', 'run stores an idempotency key');
select has_column('public', 'orchestration_runs', 'candidate_snapshot', 'run stores immutable candidates');
select has_column('public', 'orchestration_runs', 'result_snapshot', 'run stores the final BALANCED ranking');

set local role service_role;

select results_eq(
  $$
    select status, deduplicated, jsonb_array_length(candidate_snapshot)
    from public.start_orchestration_run(
      'f2000000-0000-0000-0000-000000000001',
      'e0000000-0000-0000-0000-000000000001',
      'cm:int02a:start:fr-1042:1',
      '[{
        "carrierId":"b0000000-0000-0000-0000-000000000001",
        "carrierCode":"GENERIC-CARRIER",
        "displayName":"Generic Carrier",
        "providerUrl":"/providers/generic-carrier",
        "matchingServiceId":"d0000000-0000-0000-0000-000000000001"
      }]'::jsonb
    )
  $$,
  $$ values ('RUNNING'::text, false, 1) $$,
  'first start creates a RUNNING run with its candidate snapshot'
);
select results_eq(
  $$
    select status, idempotency_key, jsonb_array_length(candidate_snapshot)
    from public.orchestration_runs
    where freight_request_id = 'f2000000-0000-0000-0000-000000000001'
      and idempotency_key = 'cm:int02a:start:fr-1042:1'
  $$,
  $$ values ('RUNNING'::text, 'cm:int02a:start:fr-1042:1'::text, 1) $$,
  'run persists the canonical idempotency identity and snapshot'
);
select is(
  (select status from public.freight_requests where id = 'f2000000-0000-0000-0000-000000000001'),
  'ORCHESTRATING'::text,
  'first start advances the FreightRequest to ORCHESTRATING'
);

select results_eq(
  $$
    select deduplicated, jsonb_array_length(candidate_snapshot)
    from public.start_orchestration_run(
      'f2000000-0000-0000-0000-000000000001',
      'e0000000-0000-0000-0000-000000000001',
      'cm:int02a:start:fr-1042:1',
      '[]'::jsonb
    )
  $$,
  $$ values (true, 1) $$,
  'exact start replay returns the original snapshot rather than replacing it'
);
select is(
  (
    select count(*)::integer
    from public.orchestration_runs
    where freight_request_id = 'f2000000-0000-0000-0000-000000000001'
      and idempotency_key = 'cm:int02a:start:fr-1042:1'
  ),
  1,
  'exact start replay creates no second run'
);

select throws_ok(
  $$
    select * from public.start_orchestration_run(
      'f2000000-0000-0000-0000-000000000001',
      'e0000000-0000-0000-0000-000000000001',
      'cm:int02a:start:fr-1042:other-key',
      '[]'::jsonb
    )
  $$,
  'P0001',
  null,
  'a different key cannot create a competing initial run while ORCHESTRATING'
);

select results_eq(
  $$
    select decision_id is null, run_status
    from public.persist_balanced_decision(
      (select id from public.orchestration_runs where idempotency_key = 'cm:int02a:start:fr-1042:1'),
      'f2000000-0000-0000-0000-000000000001',
      jsonb_build_object(
        'orchestrationRunId',
        (select id::text from public.orchestration_runs where idempotency_key = 'cm:int02a:start:fr-1042:1'),
        'strategy', 'BALANCED',
        'recommendedOfferId', null,
        'decisionConfidence', 0,
        'options', jsonb_build_array()
      ),
      '{"scoringVersion":"BALANCED_V1","candidates":[]}'::jsonb,
      0,
      '{}'::jsonb,
      '{}'::jsonb,
      '{}'::jsonb,
      null,
      true
    )
  $$,
  $$ values (true, 'NO_MATCH'::text) $$,
  'NO_MATCH remains decisionless but closes the run'
);
select is(
  (
    select result_snapshot -> 'options'
    from public.orchestration_runs
    where idempotency_key = 'cm:int02a:start:fr-1042:1'
  ),
  '[]'::jsonb,
  'NO_MATCH persists its ranking on the run for the read-only ViewModel'
);

insert into public.organizations (id, name, code, default_currency, status)
values (
  'a0000000-0000-0000-0000-000000000099',
  'Isolated organization',
  'ISO99',
  'USD',
  'ACTIVE'
);
insert into public.organization_members (
  id, organization_id, auth_user_id, display_name, corporate_email, role, status
) values (
  'e0000000-0000-0000-0000-000000000099',
  'a0000000-0000-0000-0000-000000000099',
  'd0000000-0000-0000-0000-000000000001',
  'Isolated owner',
  'isolated@example.test',
  'OWNER',
  'ACTIVE'
);
select throws_ok(
  $$
    select * from public.start_orchestration_run(
      'f2000000-0000-0000-0000-000000000001',
      'e0000000-0000-0000-0000-000000000099',
      'cm:int02a:start:wrong-organization',
      '[]'::jsonb
    )
  $$,
  '22023',
  null,
  'a member from another organization cannot start this FreightRequest run'
);

select * from finish();
rollback;

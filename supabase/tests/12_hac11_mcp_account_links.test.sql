-- HAC-11 local-only pgTAP. Requires the HAC-29 V2 bootstrap, HAC-11 migration,
-- and synthetic v2-road-baseline scenario. Nothing in this file is a migration.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
select plan(14);

insert into public.mcp_account_links (
  auth_user_id, organization_member_id, oauth_client_id, organization_id,
  scopes, expires_at, linked_by_user_id
) values (
  'c2310000-0000-4000-8000-000000000001',
  'c2320000-0000-4000-8000-000000000001', 'alexa-a',
  'c2300000-0000-4000-8000-000000000001', array['mcp:tools'],
  now() + interval '1 day', 'c2310000-0000-4000-8000-000000000001'
), (
  'c2310000-0000-4000-8000-000000000002',
  'c2320000-0000-4000-8000-000000000002', 'alexa-b',
  'c2300000-0000-4000-8000-000000000002', array['mcp:tools'],
  now() + interval '1 day', 'c2310000-0000-4000-8000-000000000002'
);

-- T1
select is((select count(*)::integer from public.mcp_account_links), 2,
  'synthetic links are inserted only inside the rolled-back test');

-- T2: cross-tenant member FK — member from org B cannot be bound to org A
select throws_ok($$insert into public.mcp_account_links (
  auth_user_id, organization_member_id, oauth_client_id, organization_id,
  scopes, expires_at, linked_by_user_id
) values (
  'c2310000-0000-4000-8000-000000000001',
  'c2320000-0000-4000-8000-000000000002', 'wrong-member',
  'c2300000-0000-4000-8000-000000000001', array['mcp:tools'],
  now() + interval '1 day', 'c2310000-0000-4000-8000-000000000001'
)$$, '23503', null, 'foreign member cannot be bound to another tenant');

-- T3: unique user+client constraint
select throws_ok($$insert into public.mcp_account_links (
  auth_user_id, organization_member_id, oauth_client_id, organization_id,
  scopes, expires_at, linked_by_user_id
) values (
  'c2310000-0000-4000-8000-000000000001',
  'c2320000-0000-4000-8000-000000000001', 'alexa-a',
  'c2300000-0000-4000-8000-000000000001', array['mcp:tools'],
  now() + interval '1 day', 'c2310000-0000-4000-8000-000000000001'
)$$, '23505', null, 'one user/client binding is unique');

-- T4: invalid scope
select throws_ok($$insert into public.mcp_account_links (
  auth_user_id, organization_member_id, oauth_client_id, organization_id,
  scopes, expires_at, linked_by_user_id
) values (
  'c2310000-0000-4000-8000-000000000001',
  'c2320000-0000-4000-8000-000000000001', 'bad-scope',
  'c2300000-0000-4000-8000-000000000001', array['mcp:service'],
  now() + interval '1 day', 'c2310000-0000-4000-8000-000000000001'
)$$, '23514', null, 'only the user tools scope is accepted');

-- T5-T7: RLS — tenant A bearer
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"c2310000-0000-4000-8000-000000000001","role":"authenticated"}';
select is((select count(*)::integer from public.mcp_account_links), 1,
  'tenant A sees only its own active link');
select is((select count(*)::integer from public.mcp_account_links where oauth_client_id = 'alexa-b'), 0,
  'tenant A cannot see a foreign client link');
select throws_ok($$update public.mcp_account_links set status = 'REVOKED'$$, '42501', null,
  'user bearer cannot revoke a link directly');
reset role;

-- T8: revoked link invisible via RLS
update public.mcp_account_links set status = 'REVOKED', revoked_at = now(),
  revoked_by_user_id = auth_user_id where oauth_client_id = 'alexa-a';
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"c2310000-0000-4000-8000-000000000001","role":"authenticated"}';
select is((select count(*)::integer from public.mcp_account_links), 0,
  'revoked link is invisible to the user bearer');
reset role;

-- T9: expired link invisible via RLS (restore to ACTIVE first, then expire)
update public.mcp_account_links set status = 'ACTIVE', revoked_at = null,
  revoked_by_user_id = null, linked_at = now() - interval '2 days',
  expires_at = now() - interval '1 minute'
  where oauth_client_id = 'alexa-a';
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"c2310000-0000-4000-8000-000000000001","role":"authenticated"}';
select is((select count(*)::integer from public.mcp_account_links), 0,
  'expired link is invisible to the user bearer');
reset role;

-- ──────────────────────────────────────────────────────────────────────────────
-- T10: authenticated cannot INSERT — no client write policy exists.
-- The consent endpoint must provision links; no direct INSERT path for bearers.
-- ──────────────────────────────────────────────────────────────────────────────
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"c2310000-0000-4000-8000-000000000002","role":"authenticated"}';
select throws_ok($$
  insert into public.mcp_account_links (
    auth_user_id, organization_member_id, oauth_client_id, organization_id,
    scopes, expires_at, linked_by_user_id
  ) values (
    'c2310000-0000-4000-8000-000000000002',
    'c2320000-0000-4000-8000-000000000002', 'alexa-b-new',
    'c2300000-0000-4000-8000-000000000002', array['mcp:tools'],
    now() + interval '1 day', 'c2310000-0000-4000-8000-000000000002'
  )
$$, '42501', null,
  'authenticated bearer has no INSERT grant on mcp_account_links');
reset role;

-- ──────────────────────────────────────────────────────────────────────────────
-- T11: partial revocation — status REVOKED but revoked_at NULL violates
-- mcp_account_links_revocation_valid.  Revocation must be atomic; you cannot
-- set the status without the timestamp and actor, and vice-versa.
-- ──────────────────────────────────────────────────────────────────────────────
select throws_ok($$
  insert into public.mcp_account_links (
    auth_user_id, organization_member_id, oauth_client_id, organization_id,
    scopes, status, expires_at, revoked_by_user_id, linked_by_user_id
  ) values (
    'c2310000-0000-4000-8000-000000000001',
    'c2320000-0000-4000-8000-000000000001', 'partial-revoke-no-ts',
    'c2300000-0000-4000-8000-000000000001', array['mcp:tools'],
    'REVOKED', now() + interval '1 day',
    'c2310000-0000-4000-8000-000000000001',
    'c2310000-0000-4000-8000-000000000001'
  )
$$, '23514', null,
  'REVOKED status without revoked_at violates revocation_valid constraint');

-- ──────────────────────────────────────────────────────────────────────────────
-- T12: partial revocation — status ACTIVE but revoked_at set violates the same
-- constraint.  An ACTIVE link cannot carry a revocation timestamp.
-- ──────────────────────────────────────────────────────────────────────────────
select throws_ok($$
  insert into public.mcp_account_links (
    auth_user_id, organization_member_id, oauth_client_id, organization_id,
    scopes, status, expires_at, revoked_at, linked_by_user_id
  ) values (
    'c2310000-0000-4000-8000-000000000001',
    'c2320000-0000-4000-8000-000000000001', 'active-with-revoked-ts',
    'c2300000-0000-4000-8000-000000000001', array['mcp:tools'],
    'ACTIVE', now() + interval '1 day',
    now(),
    'c2310000-0000-4000-8000-000000000001'
  )
$$, '23514', null,
  'ACTIVE status with revoked_at set violates revocation_valid constraint');

-- ──────────────────────────────────────────────────────────────────────────────
-- T13: lifetime_valid — expires_at must be strictly after linked_at.
-- A link that expires at creation time is a consent-window bug, not a feature.
-- ──────────────────────────────────────────────────────────────────────────────
select throws_ok($$
  insert into public.mcp_account_links (
    auth_user_id, organization_member_id, oauth_client_id, organization_id,
    scopes, linked_at, expires_at, linked_by_user_id
  ) values (
    'c2310000-0000-4000-8000-000000000001',
    'c2320000-0000-4000-8000-000000000001', 'zero-lifetime',
    'c2300000-0000-4000-8000-000000000001', array['mcp:tools'],
    '2026-10-01T12:00:00Z', '2026-10-01T12:00:00Z',
    'c2310000-0000-4000-8000-000000000001'
  )
$$, '23514', null,
  'expires_at equal to linked_at violates lifetime_valid constraint');

-- ──────────────────────────────────────────────────────────────────────────────
-- T14: RLS hides the link when the underlying organization_members row is not
-- ACTIVE.  The policy joins organization_members with status = 'ACTIVE'; an
-- inactive or departed member must not be able to use a previously issued link.
-- This is the fail-closed guarantee: consent is revoked automatically when
-- membership lapses, without touching mcp_account_links directly.
-- ──────────────────────────────────────────────────────────────────────────────

-- First restore alexa-a to a clean ACTIVE, non-expired state so T14 starts fresh.
update public.mcp_account_links
  set status = 'ACTIVE', revoked_at = null, revoked_by_user_id = null,
      expires_at = now() + interval '1 day'
  where oauth_client_id = 'alexa-a';

-- Deactivate the org-A member row (simulates membership lapse / departure).
update public.organization_members
  set status = 'INACTIVE'
  where id = 'c2320000-0000-4000-8000-000000000001';

set local role authenticated;
set local "request.jwt.claims" to '{"sub":"c2310000-0000-4000-8000-000000000001","role":"authenticated"}';
select is((select count(*)::integer from public.mcp_account_links
           where oauth_client_id = 'alexa-a'), 0,
  'RLS hides the link when the underlying org membership is no longer ACTIVE');
reset role;

-- Restore membership so rollback is clean (though rollback handles it anyway).
update public.organization_members
  set status = 'ACTIVE'
  where id = 'c2320000-0000-4000-8000-000000000001';

select * from finish();
rollback;

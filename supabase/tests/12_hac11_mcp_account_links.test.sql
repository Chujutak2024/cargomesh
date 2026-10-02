-- HAC-11 local-only pgTAP. Requires the HAC-29 V2 bootstrap, HAC-11 migration,
-- and synthetic v2-road-baseline scenario. Nothing in this file is a migration.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
select plan(9);

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

select is((select count(*)::integer from public.mcp_account_links), 2,
  'synthetic links are inserted only inside the rolled-back test');
select throws_ok($$insert into public.mcp_account_links (
  auth_user_id, organization_member_id, oauth_client_id, organization_id,
  scopes, expires_at, linked_by_user_id
) values (
  'c2310000-0000-4000-8000-000000000001',
  'c2320000-0000-4000-8000-000000000002', 'wrong-member',
  'c2300000-0000-4000-8000-000000000001', array['mcp:tools'],
  now() + interval '1 day', 'c2310000-0000-4000-8000-000000000001'
)$$, '23503', null, 'foreign member cannot be bound to another tenant');
select throws_ok($$insert into public.mcp_account_links (
  auth_user_id, organization_member_id, oauth_client_id, organization_id,
  scopes, expires_at, linked_by_user_id
) values (
  'c2310000-0000-4000-8000-000000000001',
  'c2320000-0000-4000-8000-000000000001', 'alexa-a',
  'c2300000-0000-4000-8000-000000000001', array['mcp:tools'],
  now() + interval '1 day', 'c2310000-0000-4000-8000-000000000001'
)$$, '23505', null, 'one user/client binding is unique');
select throws_ok($$insert into public.mcp_account_links (
  auth_user_id, organization_member_id, oauth_client_id, organization_id,
  scopes, expires_at, linked_by_user_id
) values (
  'c2310000-0000-4000-8000-000000000001',
  'c2320000-0000-4000-8000-000000000001', 'bad-scope',
  'c2300000-0000-4000-8000-000000000001', array['mcp:service'],
  now() + interval '1 day', 'c2310000-0000-4000-8000-000000000001'
)$$, '23514', null, 'only the user tools scope is accepted');

set local role authenticated;
set local "request.jwt.claims" to '{"sub":"c2310000-0000-4000-8000-000000000001","role":"authenticated"}';
select is((select count(*)::integer from public.mcp_account_links), 1,
  'tenant A sees only its own active link');
select is((select count(*)::integer from public.mcp_account_links where oauth_client_id = 'alexa-b'), 0,
  'tenant A cannot see a foreign client link');
select throws_ok($$update public.mcp_account_links set status = 'REVOKED'$$, '42501', null,
  'user bearer cannot revoke a link directly');
reset role;

update public.mcp_account_links set status = 'REVOKED', revoked_at = now(),
  revoked_by_user_id = auth_user_id where oauth_client_id = 'alexa-a';
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"c2310000-0000-4000-8000-000000000001","role":"authenticated"}';
select is((select count(*)::integer from public.mcp_account_links), 0,
  'revoked link is invisible to the user bearer');
reset role;

update public.mcp_account_links set status = 'ACTIVE', revoked_at = null,
  revoked_by_user_id = null, expires_at = now() - interval '1 minute'
  where oauth_client_id = 'alexa-a';
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"c2310000-0000-4000-8000-000000000001","role":"authenticated"}';
select is((select count(*)::integer from public.mcp_account_links), 0,
  'expired link is invisible to the user bearer');
reset role;

select * from finish();
rollback;

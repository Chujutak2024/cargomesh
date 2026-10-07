-- Dedicated local scenario, no hosted changes; test transaction rolls back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path=extensions,public;
select no_plan();
create temporary table org_input(value jsonb);
insert into org_input values ('{"schemaVersion":"2.0","code":"HAC40-ORG","commercialName":"QA Shipper",
  "legalName":null,"taxIdType":null,"taxIdValue":null,"countryCode":"PE",
  "corporateEmail":"qa@example.com","corporatePhone":"+51999000111","defaultCurrency":"USD","status":"ACTIVE"}');
grant select on org_input to authenticated;
select ok((select relrowsecurity from pg_class where oid='private.v2_organization_command_receipts'::regclass),'private receipt RLS');
set local role anon;
select throws_ok($$select public.command_v2_organization(null,null,null,null,'{}')$$,'42501',null,'anonymous call blocked');
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"c2310000-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok($$select public.command_v2_organization('c2300000-0000-4000-8000-000000000002',
  'c2320000-0000-4000-8000-000000000002','d0500000-0000-4000-8000-000000000001',1,(select value from org_input))$$,
  'PT403','FORBIDDEN_TENANT','foreign actor rejected before lookup');
select throws_ok($$select public.command_v2_organization('c2300000-0000-4000-8000-000000000001',
  'c2320000-0000-4000-8000-000000000001','d0500000-0000-4000-8000-000000000001',1,
  (select value from org_input))$$,'PT403','FORBIDDEN_TENANT','REQUESTER cannot revise legal organization');
reset role;
-- The baseline member is REQUESTER. Role change is this test's rolled-back setup.
update public.organization_members set role='OWNER' where id='c2320000-0000-4000-8000-000000000001';
set local role authenticated;
select throws_ok($$select public.command_v2_organization('c2300000-0000-4000-8000-000000000001',
  'c2320000-0000-4000-8000-000000000001','d0500000-0000-4000-8000-000000000001',1,
  jsonb_set((select value from org_input),'{taxIdType}','"RUC"'))$$,'PT400','VALIDATION_ERROR','paired tax identifiers required');
select throws_ok($$select public.command_v2_organization('c2300000-0000-4000-8000-000000000001',
  'c2320000-0000-4000-8000-000000000001','d0500000-0000-4000-8000-000000000001',1,
  (select value from org_input)||'{"verifiedAt":"2026-10-04T00:00:00Z"}')$$,'PT400','VALIDATION_ERROR','cannot forge verification');
select is((public.command_v2_organization('c2300000-0000-4000-8000-000000000001',
  'c2320000-0000-4000-8000-000000000001','d0500000-0000-4000-8000-000000000001',1,
  (select value from org_input))#>>'{row,version}')::integer,2,'valid revision after invalid attempts');
select is((public.command_v2_organization('c2300000-0000-4000-8000-000000000001',
  'c2320000-0000-4000-8000-000000000001','d0500000-0000-4000-8000-000000000001',1,
  (select value from org_input))->>'replay'),'true','retry old version returns original receipt');
select throws_ok($$select public.command_v2_organization('c2300000-0000-4000-8000-000000000001',
  'c2320000-0000-4000-8000-000000000001','d0500000-0000-4000-8000-000000000001',1,
  jsonb_set((select value from org_input),'{commercialName}','"Changed"'))$$,'PT409','IDEMPOTENCY_CONFLICT','key cannot change payload');
select throws_ok($$select public.command_v2_organization('c2300000-0000-4000-8000-000000000001',
  'c2320000-0000-4000-8000-000000000001','d0500000-0000-4000-8000-000000000002',1,
  (select value from org_input))$$,'PT409','STALE_DRAFT','stale new command rejected');
select throws_ok($$select * from private.v2_organization_command_receipts$$,'42501',null,'client cannot access receipts');
select throws_ok($$update public.organizations set name='Bypass' where id='c2300000-0000-4000-8000-000000000001'$$,
  '42501',null,'client has no direct organization update grant');
set local role service_role;
select throws_ok($$update public.organizations set name='Bypass' where id='c2300000-0000-4000-8000-000000000001'$$,
  'PT403','DIRECT_ORGANIZATION_MUTATION_FORBIDDEN','managed organization blocks service-role bypass');
select throws_ok($$update public.organizations set v2_command_managed=false where id='c2300000-0000-4000-8000-000000000001'$$,
  'PT403','DIRECT_ORGANIZATION_MUTATION_FORBIDDEN','service role cannot strip command protection');
reset role;
select is((select count(*)::integer from private.v2_organization_command_receipts where organization_id='c2300000-0000-4000-8000-000000000001'),1,'failed mutations do not consume keys');
select is((select corporate_email from public.organizations where id='c2300000-0000-4000-8000-000000000001'),'qa@example.com','descriptive email persisted');
select isnt((select verified_corporate_email from public.organizations where id='c2300000-0000-4000-8000-000000000001'),'qa@example.com','revision does not claim verified contact');
select * from finish();
rollback;

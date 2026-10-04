-- Requires the explicit local V2 baseline scenario. All test writes roll back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
select no_plan();
create temporary table facility_input(value jsonb);
insert into facility_input values ('{
  "schemaVersion":"2.0","code":"HAC40-QA","name":"QA warehouse","facilityType":"WAREHOUSE",
  "location":{"label":"QA address","countryCode":"PE","region":"Lima","city":"Lima","lat":-12,"lng":-77},
  "active":true,"accessRestrictions":[{"code":"TRUCK_ENTRY","description":"Confirm entrance","evidenceReference":null}],
  "operatingHours":{"timezone":"America/Lima","weekly":[{"dayOfWeek":1,"opensAt":"08:00","closesAt":"18:00"}]}
}');
grant select on facility_input to authenticated, anon;
create temporary table facility_result(value jsonb);
grant select,insert on facility_result to authenticated;
select ok((select relrowsecurity from pg_class where oid='private.v2_facility_command_receipts'::regclass), 'private receipt RLS enabled');
set local role anon;
select throws_ok($$select public.command_v2_facility('c2300000-0000-4000-8000-000000000001',
  'c2320000-0000-4000-8000-000000000001','d0400000-0000-4000-8000-000000000001',null,null,
  (select value from facility_input))$$,'42501',null,'anon cannot call facility mutation');
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"c2310000-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok($$select public.command_v2_facility('c2300000-0000-4000-8000-000000000002',
  'c2320000-0000-4000-8000-000000000002','d0400000-0000-4000-8000-000000000001',null,null,
  (select value from facility_input))$$,'PT403','FORBIDDEN_TENANT','cannot forge another tenant/member');
select throws_ok($$select public.command_v2_facility('c2300000-0000-4000-8000-000000000001',
  'c2320000-0000-4000-8000-000000000001','d0400000-0000-4000-8000-000000000001',null,null,
  jsonb_set((select value from facility_input),'{operatingHours,timezone}','"Fake/Lima"'))$$,
  'PT400','VALIDATION_ERROR','invalid timezone rejected without consuming key');
select throws_ok($$select public.command_v2_facility('c2300000-0000-4000-8000-000000000001',
  'c2320000-0000-4000-8000-000000000001','d0400000-0000-4000-8000-000000000001',null,null,
  jsonb_set((select value from facility_input),'{location,lng}','null'))$$,
  'PT400','VALIDATION_ERROR','unpaired coordinates rejected');
insert into facility_result select public.command_v2_facility('c2300000-0000-4000-8000-000000000001',
  'c2320000-0000-4000-8000-000000000001','d0400000-0000-4000-8000-000000000001',null,null,
  (select value from facility_input));
select is((select value->>'replay' from facility_result),'false','positive create after invalid attempts');
select is((select (value#>>'{row,version}')::integer from facility_result),1,'creation starts at version one');
select is((public.command_v2_facility('c2300000-0000-4000-8000-000000000001',
  'c2320000-0000-4000-8000-000000000001','d0400000-0000-4000-8000-000000000001',null,null,
  (select value from facility_input))->>'replay'),'true','same key and payload replay atomically');
select throws_ok($$select public.command_v2_facility('c2300000-0000-4000-8000-000000000001',
  'c2320000-0000-4000-8000-000000000001','d0400000-0000-4000-8000-000000000001',null,null,
  jsonb_set((select value from facility_input),'{name}','"Changed"'))$$,
  'PT409','IDEMPOTENCY_CONFLICT','different payload cannot overwrite receipt');
select throws_ok($$update public.facilities set name='Direct bypass' where code='HAC40-QA'$$,
  'PT403','FACILITY_COMMAND_REQUIRED','managed row rejects direct UPDATE');
select throws_ok($$update public.facilities set v2_command_managed=false where code='HAC40-QA'$$,
  '42501',null,'managed marker cannot be stripped through column grants');
select throws_ok($$insert into public.facilities(organization_id,code,name,country_code,city,address_line,v2_command_managed)
  values('c2300000-0000-4000-8000-000000000001','FORGED','Forged','PE','Lima','QA',true)$$,
  'PT403','FACILITY_COMMAND_REQUIRED','direct managed INSERT rejected');
select throws_ok($$select * from private.v2_facility_command_receipts$$,'42501',null,'receipts not writable/readable through client grants');
select lives_ok($$select public.command_v2_facility('c2300000-0000-4000-8000-000000000001',
  'c2320000-0000-4000-8000-000000000001','d0400000-0000-4000-8000-000000000002',
  (select (value#>>'{row,id}')::uuid from facility_result),1,
  jsonb_set((select value from facility_input),'{name}','"Revision two"'))$$,'versioned revision succeeds');
select is((select version from public.facilities where code='HAC40-QA'),2,'version increases once');
select throws_ok($$select public.command_v2_facility('c2300000-0000-4000-8000-000000000001',
  'c2320000-0000-4000-8000-000000000001','d0400000-0000-4000-8000-000000000003',
  (select (value#>>'{row,id}')::uuid from facility_result),1,
  (select value from facility_input))$$,'PT409','STALE_DRAFT','stale revision rejected');
select is((select name from public.facilities where code='HAC40-QA'),'Revision two','failed revision preserves successful value');
select is((public.command_v2_facility('c2300000-0000-4000-8000-000000000001',
  'c2320000-0000-4000-8000-000000000001','d0400000-0000-4000-8000-000000000001',null,null,
  (select value from facility_input))#>>'{row,version}'),'1','creation replay returns original snapshot after revision');
set local "request.jwt.claims" to '{"sub":"c2310000-0000-4000-8000-000000000002","role":"authenticated"}';
select is((select count(*)::integer from public.facilities where code='HAC40-QA'),0,'tenant B cannot read new tenant A facility');
select throws_ok($$select public.command_v2_facility('c2300000-0000-4000-8000-000000000002',
  'c2320000-0000-4000-8000-000000000002','d0400000-0000-4000-8000-000000000004',
  (select (value#>>'{row,id}')::uuid from facility_result),2,(select value from facility_input))$$,
  'PT404','FACILITY_NOT_FOUND','foreign facility id does not disclose row');
reset role;
select is((select count(*)::integer from private.v2_facility_command_receipts
  where idempotency_key in ('d0400000-0000-4000-8000-000000000003','d0400000-0000-4000-8000-000000000004')),0,
  'failed commands leave no receipts');
select * from finish();
rollback;

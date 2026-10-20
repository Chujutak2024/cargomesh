-- Part of HAC-52. Self-contained fixture; no password, seed or bank-marker dependency.
-- Run through the explicit V2 pgTAP profile on a local database. All writes roll back.
\set ON_ERROR_STOP on
begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
insert into auth.users(id,aud,role,email) values
 ('52a30000-0000-4000-8000-000000000001','authenticated','authenticated','hac52-pgtap-pe@example.invalid'),
 ('52a30000-0000-4000-8000-000000000002','authenticated','authenticated','hac52-pgtap-bo@example.invalid');
insert into public.organizations(id,code,name,country_code) values
 ('52a00000-0000-4000-8000-000000000001','HAC52_PGTAP_PE','[SYNTHETIC] HAC52 pgTAP PE','PE'),
 ('52a00000-0000-4000-8000-000000000002','HAC52_PGTAP_BO','[SYNTHETIC] HAC52 pgTAP BO','BO');
insert into public.organization_members(id,organization_id,auth_user_id,display_name,corporate_email,role,status) values
 ('52a20000-0000-4000-8000-000000000001','52a00000-0000-4000-8000-000000000001','52a30000-0000-4000-8000-000000000001','HAC52 pgTAP PE','hac52-pgtap-pe@example.invalid','OWNER','ACTIVE'),
 ('52a20000-0000-4000-8000-000000000002','52a00000-0000-4000-8000-000000000002','52a30000-0000-4000-8000-000000000002','HAC52 pgTAP BO','hac52-pgtap-bo@example.invalid','OWNER','ACTIVE');
insert into public.facilities(id,organization_id,code,name,facility_type,country_code,city,address_line,latitude,longitude,operating_hours)
select ('52a10000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 case when n<=3 then '52a00000-0000-4000-8000-000000000001'::uuid else '52a00000-0000-4000-8000-000000000002'::uuid end,
 'HAC52_PGTAP_'||n,'[SYNTHETIC] pgTAP address '||n,'WAREHOUSE',
 case when n<=3 then 'PE' else 'BO' end,case when n<=3 then 'Lima' else 'La Paz' end,
 'Fictional pgTAP Street '||n,case when n<=3 then -12 else -16 end,case when n<=3 then -77 else -68 end,
 case when n=3 then null else jsonb_build_object('timezone',case when n<=3 then 'America/Lima' else 'America/La_Paz' end,
 'weekly',jsonb_build_array(jsonb_build_object('dayOfWeek',1,'opensAt','08:00','closesAt','18:00'))) end
from generate_series(1,6) n;
insert into public.organization_preferences(id,organization_id,allow_auto_booking,objective,maximum_wait_minutes,preferred_mode,preferred_equipment,valid_until)
values('52a50000-0000-4000-8000-000000000001','52a00000-0000-4000-8000-000000000001',false,'WEIGHTED',120,'ROAD','BOX_TRUCK','2027-01-01T12:00:00Z');
select '52a30000-0000-4000-8000-000000000001' as pe_user, '52a30000-0000-4000-8000-000000000002' as bo_user \gset
select no_plan();
set local role authenticated;
select set_config('request.jwt.claims',json_build_object('sub',:'pe_user','role','authenticated')::text,true);
select ok(auth.uid()=:'pe_user'::uuid,'positive control: real synthetic PE identity under authenticated');
select is((select count(*) from public.facilities where organization_id='52a00000-0000-4000-8000-000000000001' and active),3::bigint,'PE member reads three active own addresses');
select is((select count(*) from public.facilities where organization_id='52a00000-0000-4000-8000-000000000002'),0::bigint,'PE member cannot read BO facilities after own positive control');
select ok(exists(select 1 from public.facilities where id='52a10000-0000-4000-8000-000000000001' and operating_hours is not null),'known-hours positive control exists');
select ok(exists(select 1 from public.facilities where id='52a10000-0000-4000-8000-000000000003' and operating_hours is null),'unknown hours remain null rather than invented open hours');
select ok(private.hac52_valid_facility_hours('{"timezone":"America/Lima","weekly":[{"dayOfWeek":1,"opensAt":"08:00","closesAt":"24:00"}]}'),'civil-hour positive control permits midnight close');
select ok(not private.hac52_valid_facility_hours('{"timezone":"Fake/Place","weekly":[]}'),'invalid IANA rejected with a valid control');
select throws_ok($$select * from private.v2_client_action_confirmations$$,'42501',null,'authenticated cannot bypass confirmation RPCs with direct table access');

select set_config('cm.hac52.value','{"schemaVersion":"2.0","code":"HAC52_CONFIRM_CONTROL","name":"[SYNTHETIC] Confirmation control","facilityType":"WAREHOUSE","location":{"label":"Fictional Test Street 52","countryCode":"PE","region":"Lima","city":"Lima","lat":-12,"lng":-77},"active":false,"accessRestrictions":[],"operatingHours":null}',true);
select set_config('cm.hac52.confirmation',(public.prepare_v2_client_action('52a00000-0000-4000-8000-000000000001','52a20000-0000-4000-8000-000000000001','facility.create',null,null,'52ef0000-0000-4000-8000-000000000001',current_setting('cm.hac52.value')::jsonb)->>'id'),true);
select ok((public.prepare_v2_client_action('52a00000-0000-4000-8000-000000000001','52a20000-0000-4000-8000-000000000001','facility.create',null,null,'52ef0000-0000-4000-8000-000000000001',current_setting('cm.hac52.value')::jsonb)->>'requiresConfirmation')::boolean,'proposal explicitly requests confirmation');
select is((select count(*) from public.facilities where code='HAC52_CONFIRM_CONTROL'),0::bigint,'prepare does not perform the proposed business action');
select throws_ok($$select public.prepare_v2_client_action('52a00000-0000-4000-8000-000000000001','52a20000-0000-4000-8000-000000000001','facility.create',null,null,'52ef0000-0000-4000-8000-000000000001',jsonb_set(current_setting('cm.hac52.value')::jsonb,'{name}','"Different"'))$$,'PT409','IDEMPOTENCY_CONFLICT','proposal key conflicts on different payload');
select lives_ok($$select public.confirm_v2_client_action('52a00000-0000-4000-8000-000000000001','52a20000-0000-4000-8000-000000000001',current_setting('cm.hac52.confirmation')::uuid)$$,'confirmed action uses the real Facility domain command');
select is((select count(*) from public.facilities where code='HAC52_CONFIRM_CONTROL'),1::bigint,'confirmation creates exactly one persisted control');
select ok((public.confirm_v2_client_action('52a00000-0000-4000-8000-000000000001','52a20000-0000-4000-8000-000000000001',current_setting('cm.hac52.confirmation')::uuid)->>'idempotentReplay')::boolean,'confirmed action replay is stable');

select lives_ok($$select public.command_v2_catalog('52a00000-0000-4000-8000-000000000001','52a20000-0000-4000-8000-000000000001','preferences',null,null,'52a50000-0000-4000-8000-000000000001','52ef0000-0000-4000-8000-000000000002',1,jsonb_set(public.read_v2_catalog('52a00000-0000-4000-8000-000000000001','52a20000-0000-4000-8000-000000000001','preferences',null,null,'52a50000-0000-4000-8000-000000000001',1,0)->0->'value','{maximumWaitMinutes}','90'))$$,'owner revises persisted preferences');
select throws_ok($$select public.command_v2_catalog('52a00000-0000-4000-8000-000000000001','52a20000-0000-4000-8000-000000000001','preferences',null,null,'52a50000-0000-4000-8000-000000000001','52ef0000-0000-4000-8000-000000000003',1,public.read_v2_catalog('52a00000-0000-4000-8000-000000000001','52a20000-0000-4000-8000-000000000001','preferences',null,null,'52a50000-0000-4000-8000-000000000001',1,0)->0->'value')$$,'PT409','STALE_DRAFT','old preference version conflicts after successful control');

select set_config('request.jwt.claims',json_build_object('sub',:'bo_user','role','authenticated')::text,true);
select is((select count(*) from public.facilities where organization_id='52a00000-0000-4000-8000-000000000002' and active),3::bigint,'BO positive control reads its three active facilities');
select is((select count(*) from public.facilities where organization_id='52a00000-0000-4000-8000-000000000001'),0::bigint,'BO cannot read PE addresses');
select throws_ok($$select public.confirm_v2_client_action('52a00000-0000-4000-8000-000000000001','52a20000-0000-4000-8000-000000000001',current_setting('cm.hac52.confirmation')::uuid)$$,'PT403','FORBIDDEN_TENANT','BO cannot confirm a PE proposal');
select throws_ok($$select public.command_v2_facility('52a00000-0000-4000-8000-000000000001','52a20000-0000-4000-8000-000000000001','52ef0000-0000-4000-8000-000000000004','52a10000-0000-4000-8000-000000000001',1,current_setting('cm.hac52.value')::jsonb)$$,'PT403','FORBIDDEN_TENANT','BO cannot edit PE facilities');

reset role;
-- Temporary Carrier-only control is rolled back; no commercial catalog is seeded.
insert into public.carriers(id,code,name,status) values('52cf0000-0000-4000-8000-000000000001','HAC52_CARRIER_CONTROL','[SYNTHETIC] Carrier-only test control','ACTIVE');
insert into public.carrier_operators(id,carrier_id,auth_user_id,display_name,role,email,status,verified_at)
values('52cf0000-0000-4000-8000-000000000002','52cf0000-0000-4000-8000-000000000001',:'pe_user','Synthetic Carrier-only control','ADMIN','hac52-carrier-control@example.invalid','ACTIVE',now()-interval '1 minute');
insert into private.v2_catalog_grants(auth_user_id,carrier_id,permission,expires_at)
values(:'pe_user','52cf0000-0000-4000-8000-000000000001','CARRIER_EDITOR',now()+interval '1 hour');
update public.organization_members set status='INACTIVE' where id='52a20000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claims',json_build_object('sub',:'pe_user','role','authenticated')::text,true);
select ok(jsonb_array_length(public.read_v2_carrier_portal_access())=1,'Carrier-only positive control has real authorized Carrier access');
select is((select count(*) from public.organization_members where auth_user_id=auth.uid() and status='ACTIVE'),0::bigint,'Carrier-only account has no active Client membership');
select is((select count(*) from public.facilities),0::bigint,'Carrier access grants no Client Facility reads');
select throws_ok($$select public.prepare_v2_client_action('52a00000-0000-4000-8000-000000000001','52a20000-0000-4000-8000-000000000001','facility.create',null,null,'52ef0000-0000-4000-8000-000000000005',current_setting('cm.hac52.value')::jsonb)$$,'PT403','FORBIDDEN_TENANT','Carrier-only account cannot prepare Client writes');
reset role;
update public.organization_members set status='ACTIVE',role='REQUESTER' where id='52a20000-0000-4000-8000-000000000001';
set local role authenticated;
select ok(exists(select 1 from public.facilities where id='52a10000-0000-4000-8000-000000000001'),'Requester positive control can read own Facility');
select throws_ok($$select public.prepare_v2_client_action('52a00000-0000-4000-8000-000000000001','52a20000-0000-4000-8000-000000000001','facility.create',null,null,'52ef0000-0000-4000-8000-000000000006',current_setting('cm.hac52.value')::jsonb)$$,'PT403','FORBIDDEN_TENANT','Requester cannot prepare a Facility mutation');
reset role;
update public.organization_members set role='SUPERVISOR' where id='52a20000-0000-4000-8000-000000000001';
set local role authenticated;
select lives_ok($$select public.prepare_v2_client_action('52a00000-0000-4000-8000-000000000001','52a20000-0000-4000-8000-000000000001','facility.create',null,null,'52ef0000-0000-4000-8000-000000000007',current_setting('cm.hac52.value')::jsonb)$$,'Supervisor positive control can prepare Facility actions');
select throws_ok($$select public.prepare_v2_client_action('52a00000-0000-4000-8000-000000000001','52a20000-0000-4000-8000-000000000001','organization.revise','52a00000-0000-4000-8000-000000000001',1,'52ef0000-0000-4000-8000-000000000008','{}')$$,'PT403','FORBIDDEN_TENANT','Supervisor cannot prepare owner-only organization revisions');
reset role;
update public.organization_members set status='INACTIVE' where id='52a20000-0000-4000-8000-000000000001';
insert into public.organizations(id,code,name) values('52cf0000-0000-4000-8000-000000000003','HAC52_EMPTY_CONTROL','[SYNTHETIC] Empty organization control');
insert into public.organization_members(id,organization_id,auth_user_id,display_name,corporate_email,role,status)
values('52cf0000-0000-4000-8000-000000000004','52cf0000-0000-4000-8000-000000000003',:'pe_user','Synthetic empty-org control','hac52-empty@example.invalid','OWNER','ACTIVE');
set local role authenticated;
select ok(exists(select 1 from public.organizations where id='52cf0000-0000-4000-8000-000000000003'),'empty organization has a valid authenticated membership positive control');
select is((select count(*) from public.facilities where organization_id='52cf0000-0000-4000-8000-000000000003'),0::bigint,'authorized organization with zero facilities returns real empty data');
select * from finish();
rollback;

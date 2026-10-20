-- Self-contained security/atomicity checks. No business seed; all fixtures roll back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
insert into auth.users(id,aud,role,email) select ('50f30000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'authenticated','authenticated','visual-check-'||n||'@example.invalid' from generate_series(1,3)n;
insert into public.organizations(id,code,name) select ('50f00000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'VISUAL_CHECK_'||n,'[SYNTHETIC] Visual checks '||n from generate_series(1,2)n;
insert into public.organization_members(id,organization_id,auth_user_id,display_name,corporate_email,role,status)
select ('50f20000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,('50f00000-0000-4000-8000-'||lpad((case when n=2 then 2 else 1 end)::text,12,'0'))::uuid,
 ('50f30000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'Visual tester '||n,'visual-check-'||n||'@example.invalid',case when n=3 then 'REQUESTER' else 'OWNER' end,'ACTIVE' from generate_series(1,3)n;
insert into public.facilities(id,organization_id,code,name,facility_type,country_code,city,address_line)
select ('50f10000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,('50f00000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'VISUAL_SITE_'||n,'[SYNTHETIC] Visual site '||n,'WAREHOUSE','PE','Lima','Fictional visual check street' from generate_series(1,2)n;
select set_config('cm.visual.facilities',md5((select jsonb_agg(to_jsonb(f) order by id)::text from public.facilities f)),true);
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"50f30000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select ok(auth.uid()='50f30000-0000-4000-8000-000000000001'::uuid,'positive control: authenticated owner identity');
select is(public.facility_visual_reference_v2('50f00000-0000-4000-8000-000000000001','50f20000-0000-4000-8000-000000000001','50f10000-0000-4000-8000-000000000001',null,null,null)#>>'{data,version}','0','unassigned facility reads without creating a row');
select is(public.facility_visual_reference_v2('50f00000-0000-4000-8000-000000000001','50f20000-0000-4000-8000-000000000001','50f10000-0000-4000-8000-000000000001','compact',0,'50ff0000-0000-4000-8000-000000000001')#>>'{data,version}','1','owner saves explicit model at initial version');
select is((select template_id from public.facility_visual_references where facility_id='50f10000-0000-4000-8000-000000000001'),'compact','saved model read back under RLS');
select ok((public.facility_visual_reference_v2('50f00000-0000-4000-8000-000000000001','50f20000-0000-4000-8000-000000000001','50f10000-0000-4000-8000-000000000001','compact',0,'50ff0000-0000-4000-8000-000000000001')#>>'{meta,idempotentReplay}')::boolean,'same key/payload replays before stale-version check');
select throws_ok($$select public.facility_visual_reference_v2('50f00000-0000-4000-8000-000000000001','50f20000-0000-4000-8000-000000000001','50f10000-0000-4000-8000-000000000001','cold',0,'50ff0000-0000-4000-8000-000000000001')$$,'PT409','IDEMPOTENCY_CONFLICT','same key with different model conflicts');
select throws_ok($$select public.facility_visual_reference_v2('50f00000-0000-4000-8000-000000000001','50f20000-0000-4000-8000-000000000001','50f10000-0000-4000-8000-000000000001','cold',0,'50ff0000-0000-4000-8000-000000000002')$$,'PT409','STALE_DRAFT','concurrent initial write cannot overwrite existing reference');
select throws_ok($$select public.facility_visual_reference_v2('50f00000-0000-4000-8000-000000000002','50f20000-0000-4000-8000-000000000002','50f10000-0000-4000-8000-000000000002',null,null,null)$$,'PT403','FORBIDDEN_TENANT','forged foreign membership cannot read');
select throws_ok($$select public.facility_visual_reference_v2('50f00000-0000-4000-8000-000000000001','50f20000-0000-4000-8000-000000000001','50f10000-0000-4000-8000-000000000002',null,null,null)$$,'PT404','FACILITY_NOT_FOUND','own member cannot reference foreign facility');
select throws_ok($$select public.facility_visual_reference_v2('50f00000-0000-4000-8000-000000000001','50f20000-0000-4000-8000-000000000001','50f10000-0000-4000-8000-000000000001','invented',1,'50ff0000-0000-4000-8000-000000000003')$$,'PT400','VALIDATION_ERROR','unknown model rejected by SQL boundary');
select is(public.facility_visual_reference_v2('50f00000-0000-4000-8000-000000000001','50f20000-0000-4000-8000-000000000001','50f10000-0000-4000-8000-000000000001',null,1,'50ff0000-0000-4000-8000-000000000004')#>>'{data,version}','2','clearing reference increments version, preserving concurrency history');
select ok((select template_id is null from public.facility_visual_references where facility_id='50f10000-0000-4000-8000-000000000001'),'clear leaves no inferred/default architecture');
select ok(not has_table_privilege('authenticated','public.facility_visual_references','INSERT,UPDATE,DELETE'),'direct writes have no grants');
select throws_ok($$select * from private.facility_visual_receipts$$,'42501',null,'private receipts inaccessible');
select set_config('request.jwt.claims','{"sub":"50f30000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select is(public.facility_visual_reference_v2('50f00000-0000-4000-8000-000000000001','50f20000-0000-4000-8000-000000000003','50f10000-0000-4000-8000-000000000001',null,null,null)#>>'{data,version}','2','Requester can read saved reference');
select throws_ok($$select public.facility_visual_reference_v2('50f00000-0000-4000-8000-000000000001','50f20000-0000-4000-8000-000000000003','50f10000-0000-4000-8000-000000000001','cold',2,'50ff0000-0000-4000-8000-000000000005')$$,'PT403','FORBIDDEN_TENANT','Requester cannot change reference');
reset role;
update public.organization_members set role='SUPERVISOR' where id='50f20000-0000-4000-8000-000000000003';
set local role authenticated;
select is(public.facility_visual_reference_v2('50f00000-0000-4000-8000-000000000001','50f20000-0000-4000-8000-000000000003','50f10000-0000-4000-8000-000000000001','retail-store',2,'50ff0000-0000-4000-8000-000000000006')#>>'{data,version}','3','Supervisor can save reference');
select set_config('request.jwt.claims','{"sub":"50f30000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select is((select count(*) from public.facility_visual_references),0::bigint,'foreign organization RLS hides owner saved reference');
reset role;
update public.organizations set status='INACTIVE' where id='50f00000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"50f30000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select throws_ok($$select public.facility_visual_reference_v2('50f00000-0000-4000-8000-000000000001','50f20000-0000-4000-8000-000000000001','50f10000-0000-4000-8000-000000000001',null,null,null)$$,'PT403','FORBIDDEN_TENANT','inactive organization cannot read');
reset role;
select ok(not has_function_privilege('anon','public.facility_visual_reference_v2(uuid,uuid,uuid,text,integer,uuid)','EXECUTE'),'anonymous API execute denied');
select ok(not has_function_privilege('service_role','public.facility_visual_reference_v2(uuid,uuid,uuid,text,integer,uuid)','EXECUTE'),'no service role shortcut');
select is(md5((select jsonb_agg(to_jsonb(f) order by id)::text from public.facilities f)),current_setting('cm.visual.facilities'),'business Facility records unchanged by visual commands');
select * from finish();
rollback;

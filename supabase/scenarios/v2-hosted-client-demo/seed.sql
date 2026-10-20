-- Operator-reviewed hosted package; synthetic company only. Not the guarded local seed.
-- Authorized target: cargomesh-v2 / yhimeajpzicjbxpbzsyh. Existing Carrier identity retained.
begin;
select pg_advisory_xact_lock(hashtextextended('cargomesh:hosted-client-data-20261020',0));
do $$ begin
 if (select count(*) from supabase_migrations.schema_migrations where version in('20261019030218','20261020000100','20261020000200'))<>3 then raise exception 'CLIENT_SCHEMA_REQUIRED';end if;
 if exists(select 1 from public.organizations where id='52000000-0000-4000-8000-000000000001' or code='HAC52_PE') then raise exception 'COMPANY_ALREADY_EXISTS_INSPECT_BEFORE_RERUN';end if;
 if exists(select 1 from public.facilities where id in('52010000-0000-4000-8000-000000000001','52010000-0000-4000-8000-000000000002','52010000-0000-4000-8000-000000000003')) then raise exception 'FACILITY_ID_COLLISION';end if;
 if not exists(select 1 from auth.users where id='6af3db90-e5f0-45e3-b112-c082244f182d' and email ~* '^(hac[0-9]+[-_]|qa-v2-|demo).*[.](invalid|test)$' and email_confirmed_at is not null) then raise exception 'CONFIRMED_SYNTHETIC_OPERATOR_REQUIRED';end if;
 if exists(select 1 from public.organization_members where auth_user_id='6af3db90-e5f0-45e3-b112-c082244f182d') then raise exception 'DEMO_IDENTITY_ALREADY_HAS_CLIENT_MEMBERSHIP';end if;
end $$;
insert into public.organizations(id,code,name,country_code,default_currency,status,created_at,updated_at)
values('52000000-0000-4000-8000-000000000001','HAC52_PE','[SYNTHETIC] Pacific Produce','PE','USD','ACTIVE','2026-10-19T12:00:00Z','2026-10-19T12:00:00Z');
insert into public.facilities(id,organization_id,code,name,facility_type,country_code,region_code,city,address_line,latitude,longitude,active,access_restrictions,operating_hours,created_at,updated_at) values
('52010000-0000-4000-8000-000000000001','52000000-0000-4000-8000-000000000001','PE_LIMA','[SYNTHETIC] Lima pickup warehouse','WAREHOUSE','PE','Lima','Lima','Fictional Pacific Avenue 101',-12.0464,-77.0428,true,'[]',null,'2026-10-19T12:00:00Z','2026-10-19T12:00:00Z'),
('52010000-0000-4000-8000-000000000002','52000000-0000-4000-8000-000000000001','PE_AREQUIPA','[SYNTHETIC] Arequipa distribution center','WAREHOUSE','PE','Arequipa','Arequipa','Fictional Volcano Avenue 202',-16.409,-71.5375,true,'[]',null,'2026-10-19T12:00:00Z','2026-10-19T12:00:00Z'),
('52010000-0000-4000-8000-000000000003','52000000-0000-4000-8000-000000000001','PE_TACNA','[SYNTHETIC] Tacna delivery address','WAREHOUSE','PE','Tacna','Tacna','Fictional Southern Street 303',-18.0146,-70.2536,true,'[]',null,'2026-10-19T12:00:00Z','2026-10-19T12:00:00Z');
insert into public.organization_members(id,organization_id,auth_user_id,display_name,corporate_email,role,status,verified_at)
select '52020000-0000-4000-8000-000000000002','52000000-0000-4000-8000-000000000001',id,'[SYNTHETIC] Pacific Produce Operator',email,'SUPERVISOR','ACTIVE',now() from auth.users where id='6af3db90-e5f0-45e3-b112-c082244f182d';
commit;
select jsonb_build_object('company',(select name from public.organizations where id='52000000-0000-4000-8000-000000000001'),'facilities',(select count(*) from public.facilities where organization_id='52000000-0000-4000-8000-000000000001'),'operator',(select role from public.organization_members where id='52020000-0000-4000-8000-000000000002')) as activation;

select jsonb_object_agg(fixture, rows) from (
select 'ACME' as fixture, count(*) as rows from public.organizations where id='a0000000-0000-0000-0000-000000000001'
union all select 'FR-1042',count(*) from public.freight_requests where id='f2000000-0000-0000-0000-000000000001'
union all select 'Andes',count(*) from public.carriers where id='b0000000-0000-0000-0000-000000000001'
union all select 'Inca',count(*) from public.carriers where id='b0000000-0000-0000-0000-000000000002'
union all select 'Pacific',count(*) from public.carriers where id='b0000000-0000-0000-0000-000000000003'
union all select 'demo_user',count(*) from auth.users where id='d0000000-0000-0000-0000-000000000001'
union all select 'demo_identity',count(*) from auth.identities where id='d0000000-0000-0000-0000-000000000001'
union all select 'demo_member',count(*) from public.organization_members where id='e0000000-0000-0000-0000-000000000001'
union all select 'demo_vehicles',count(*) from public.vehicles where id in ('e0000000-0000-0000-0000-000000000001','e0000000-0000-0000-0000-000000000002','e0000000-0000-0000-0000-000000000003')
) fixtures;

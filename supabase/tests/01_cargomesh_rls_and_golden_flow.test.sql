begin;
create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;
select plan(21);

-- 1. Schema Structure
select has_table('public', 'organizations', 'organizations table exists');
select has_table('public', 'freight_requests', 'freight_requests table exists');
select has_table('public', 'organization_cargo_profiles', 'organization_cargo_profiles table exists');
select has_table('public', 'organization_members', 'organization_members table exists');

-- 2. RLS Status on Tables
select ok((select relrowsecurity from pg_class where relname = 'organizations'), 'RLS is enabled on organizations');
select ok((select relrowsecurity from pg_class where relname = 'freight_requests'), 'RLS is enabled on freight_requests');
select ok((select relrowsecurity from pg_class where relname = 'organization_preferences'), 'RLS is enabled on organization_preferences');
select ok((select relrowsecurity from pg_class where relname = 'organization_cargo_profiles'), 'RLS is enabled on organization_cargo_profiles');

-- 3. Golden Flow FR-1042 Contract Assertions
select results_eq(
  $$ select cargo_weight_kg::integer, cargo_volume_m3::integer, package_count, cargo_entry_method, cross_border, is_high_value, is_stackable from public.freight_requests where code = 'FR-1042' $$,
  $$ values (8000, 18, 10, 'PALLETS', true, true, false) $$,
  'FR-1042 matches Golden Flow contract (8000 kg, 18 m3, 10 pallets, cross-border, high-value)'
);

select results_eq(
  $$ select count(*)::integer from public.carrier_services cs join public.carriers c on c.id = cs.carrier_id where c.code in ('ANDES','INCA','PACIFIC') and cs.origin_country='PE' and cs.destination_country='CL' and cs.supports_cross_border=true $$,
  $$ values (3) $$,
  'Three enterprise carriers configured for PE->CL cross-border corridor'
);

select results_eq(
  $$ select corporate_email, role, status from public.organization_members where auth_user_id = 'd0000000-0000-0000-0000-000000000001'::uuid $$,
  $$ values ('demo.operator@cargomesh.test'::text, 'SUPERVISOR'::text, 'ACTIVE'::text) $$,
  'Local demo member is synthetic, active, and least-privileged for demo reset'
);

-- 4. Anonymous Access Rejection (Zero Table Privileges -> 42501 permission denied)
set local role anon;
set local "request.jwt.claims" to '{"role":"anon"}';

select throws_ok(
  $$ select count(*) from public.organizations $$,
  '42501',
  NULL,
  'anon role is completely denied SELECT on organizations'
);

select throws_ok(
  $$ select count(*) from public.freight_requests $$,
  '42501',
  NULL,
  'anon role is completely denied SELECT on freight_requests'
);

-- 5. Authenticated ACME SUPERVISOR Isolation
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"d0000000-0000-0000-0000-000000000001","role":"authenticated"}';

select results_eq(
  $$ select code from public.organizations $$,
  $$ values ('ACME') $$,
  'ACME SUPERVISOR sees exactly ACME organization'
);

select results_eq(
  $$ select code from public.freight_requests $$,
  $$ values ('FR-1042') $$,
  'ACME SUPERVISOR sees exactly ACME freight requests'
);

select results_eq(
  $$ select count(*)::integer from public.organization_cargo_profiles $$,
  $$ values (1) $$,
  'ACME SUPERVISOR sees ACME cargo profiles'
);

-- 6. User without organization (Authenticated but not active member of any org)
set local "request.jwt.claims" to '{"sub":"00000000-0000-0000-0000-000000000099","role":"authenticated"}';

select results_eq(
  $$ select count(*)::integer from public.organizations $$,
  $$ values (0) $$,
  'User without organization sees 0 organizations'
);

select results_eq(
  $$ select count(*)::integer from public.freight_requests $$,
  $$ values (0) $$,
  'User without organization sees 0 freight requests'
);

-- 7. FreightRequest writes are manager-only; REQUESTER cannot bypass writers
-- through the authenticated table grant.
select ok(
  not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'freight_requests'
      and policyname in ('freight_requests_member_insert', 'freight_requests_member_update')
      and (coalesce(qual, '') || ' ' || coalesce(with_check, '')) ilike '%REQUESTER%'
  ),
  'FreightRequest insert and update policies exclude REQUESTER'
);

select ok(
  (select coalesce(with_check, '') ilike '%OWNER%' and coalesce(with_check, '') ilike '%SUPERVISOR%'
   from pg_policies
   where schemaname = 'public'
     and tablename = 'freight_requests'
     and policyname = 'freight_requests_member_insert')
  and
  (select coalesce(qual, '') ilike '%OWNER%' and coalesce(qual, '') ilike '%SUPERVISOR%'
   from pg_policies
   where schemaname = 'public'
     and tablename = 'freight_requests'
     and policyname = 'freight_requests_member_update'),
  'FreightRequest writes retain active OWNER and SUPERVISOR authorization'
);

-- 8. Check Constraint Violations (As Authorized ACME Member)
set local "request.jwt.claims" to '{"sub":"d0000000-0000-0000-0000-000000000001","role":"authenticated"}';

select throws_ok(
  $$ insert into public.freight_requests (organization_id, cargo_category_id, code, origin_country, origin_city, destination_country, destination_city, cargo_weight_kg, required_pickup, status) values ('a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000005', 'FR-ERR-NEG', 'PE', 'Callao', 'CL', 'Santiago', -100, now() + interval '1 day', 'PENDING') $$,
  '23514',
  NULL,
  'Negative cargo_weight_kg is rejected by check constraint'
);

select * from finish();
rollback;

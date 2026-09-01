-- CargoMesh Seed Data
-- 1. Local-only Demo User for Supabase Auth
-- 2. ACME Mining SUPERVISOR Member Linkage
--
-- This credential is intentionally public and exists only for `supabase db reset`.
-- Never reuse the email or password in a hosted Supabase project.

-- Create demo user in auth.users
insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  recovery_sent_at,
  last_sign_in_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
)
values (
  '00000000-0000-0000-0000-000000000000',
  'd0000000-0000-0000-0000-000000000001',
  'authenticated',
  'authenticated',
  'demo.operator@cargomesh.test',
  extensions.crypt('LOCAL_ONLY_CARGOMESH_DEMO_2026!', extensions.gen_salt('bf')),
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"CargoMesh Demo Operator"}',
  now(),
  now(),
  '',
  '',
  '',
  ''
)
on conflict (id) do nothing;

-- Create identity
insert into auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  provider_id,
  last_sign_in_at,
  created_at,
  updated_at
)
values (
  'd0000000-0000-0000-0000-000000000001',
  'd0000000-0000-0000-0000-000000000001',
  format('{"sub":"%s","email":"%s"}', 'd0000000-0000-0000-0000-000000000001', 'demo.operator@cargomesh.test')::jsonb,
  'email',
  'demo.operator@cargomesh.test',
  now(),
  now(),
  now()
)
on conflict (provider, provider_id) do nothing;

-- Link with the least privilege that still supports SMART_AUTO and demo reset.
insert into public.organization_members (
  id,
  organization_id,
  auth_user_id,
  display_name,
  corporate_email,
  role,
  status
)
values (
  'e0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'd0000000-0000-0000-0000-000000000001',
  'CargoMesh Demo Operator',
  'demo.operator@cargomesh.test',
  'SUPERVISOR',
  'ACTIVE'
)
on conflict (organization_id, auth_user_id) do update set
  role = excluded.role,
  status = excluded.status;

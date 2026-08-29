-- CargoMesh Seed Data
-- 1. Demo User for Supabase Auth
-- 2. ACME Mining OWNER Member Linkage

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
  'carlos.mendoza@acmemining.pe',
  extensions.crypt('CargoMesh2026!', extensions.gen_salt('bf')),
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Carlos Mendoza"}',
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
  format('{"sub":"%s","email":"%s"}', 'd0000000-0000-0000-0000-000000000001', 'carlos.mendoza@acmemining.pe')::jsonb,
  'email',
  'carlos.mendoza@acmemining.pe',
  now(),
  now(),
  now()
)
on conflict (provider, provider_id) do nothing;

-- Link as OWNER of ACME Mining in organization_members
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
  'Carlos Mendoza',
  'carlos.mendoza@acmemining.pe',
  'OWNER',
  'ACTIVE'
)
on conflict (organization_id, auth_user_id) do update set
  role = excluded.role,
  status = excluded.status;

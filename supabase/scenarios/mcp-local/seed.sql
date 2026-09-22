-- Local MCP integration fixture. Apply only to the local Supabase database.
-- Uses the same intentionally public, local-only password as supabase/seed.sql.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  recovery_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, email_change,
  email_change_token_new, recovery_token
) values (
  '00000000-0000-0000-0000-000000000000',
  'd0000000-0000-0000-0000-000000000002',
  'authenticated', 'authenticated', 'mcp.requester@cargomesh.test',
  extensions.crypt('LOCAL_ONLY_CARGOMESH_DEMO_2026!', extensions.gen_salt('bf')),
  now(), now(), now(), '{"provider":"email","providers":["email"]}',
  '{"full_name":"CargoMesh MCP Requester"}', now(), now(), '', '', '', ''
) on conflict (id) do nothing;

insert into auth.identities (
  id, user_id, identity_data, provider, provider_id,
  last_sign_in_at, created_at, updated_at
) values (
  'd0000000-0000-0000-0000-000000000002',
  'd0000000-0000-0000-0000-000000000002',
  '{"sub":"d0000000-0000-0000-0000-000000000002","email":"mcp.requester@cargomesh.test"}'::jsonb,
  'email', 'mcp.requester@cargomesh.test', now(), now(), now()
) on conflict (provider, provider_id) do nothing;

insert into public.organization_members (
  id, organization_id, auth_user_id, display_name, corporate_email, role, status
) values (
  'e0000000-0000-0000-0000-000000000002',
  'a0000000-0000-0000-0000-000000000001',
  'd0000000-0000-0000-0000-000000000002',
  'CargoMesh MCP Requester', 'mcp.requester@cargomesh.test',
  'REQUESTER', 'ACTIVE'
) on conflict (organization_id, auth_user_id) do update set
  role = excluded.role, status = excluded.status;

-- Separate local tenant for MCP RLS denial checks.
insert into public.organizations (id, name, code, default_currency, status)
values ('a0000000-0000-0000-0000-000000000098', 'MCP Isolated Tenant', 'MCP-ISOLATED', 'USD', 'ACTIVE')
on conflict (id) do nothing;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  recovery_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, email_change,
  email_change_token_new, recovery_token
) values (
  '00000000-0000-0000-0000-000000000000',
  'd0000000-0000-0000-0000-000000000099',
  'authenticated', 'authenticated', 'mcp.isolated@cargomesh.test',
  extensions.crypt('LOCAL_ONLY_CARGOMESH_DEMO_2026!', extensions.gen_salt('bf')),
  now(), now(), now(), '{"provider":"email","providers":["email"]}',
  '{"full_name":"MCP Isolated Member"}', now(), now(), '', '', '', ''
) on conflict (id) do nothing;

insert into auth.identities (
  id, user_id, identity_data, provider, provider_id,
  last_sign_in_at, created_at, updated_at
) values (
  'd0000000-0000-0000-0000-000000000099',
  'd0000000-0000-0000-0000-000000000099',
  '{"sub":"d0000000-0000-0000-0000-000000000099","email":"mcp.isolated@cargomesh.test"}'::jsonb,
  'email', 'mcp.isolated@cargomesh.test', now(), now(), now()
) on conflict (provider, provider_id) do nothing;

insert into public.organization_members (
  id, organization_id, auth_user_id, display_name, corporate_email, role, status
) values (
  'e0000000-0000-0000-0000-000000000098',
  'a0000000-0000-0000-0000-000000000098',
  'd0000000-0000-0000-0000-000000000099',
  'MCP Isolated Member', 'mcp.isolated@cargomesh.test',
  'REQUESTER', 'ACTIVE'
) on conflict (organization_id, auth_user_id) do update set
  role = excluded.role, status = excluded.status;

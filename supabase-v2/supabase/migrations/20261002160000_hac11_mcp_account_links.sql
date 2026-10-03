-- HAC-11: identity binding only. Provisioning/revocation remains server-owned
-- until the OAuth consent flow can prove the client and selected organization.
alter table public.organization_members
  add constraint organization_members_identity_tuple_unique
  unique (id, organization_id, auth_user_id);

create table public.mcp_account_links (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  organization_member_id uuid not null,
  oauth_client_id text not null,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  scopes text[] not null,
  status text not null default 'ACTIVE',
  linked_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  linked_by_user_id uuid not null references auth.users(id),
  revoked_by_user_id uuid references auth.users(id),
  revocation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mcp_account_links_member_identity_fk
    foreign key (organization_member_id, organization_id, auth_user_id)
    references public.organization_members(id, organization_id, auth_user_id),
  constraint mcp_account_links_user_client_unique unique (auth_user_id, oauth_client_id),
  constraint mcp_account_links_client_valid check
    (length(oauth_client_id) between 1 and 256 and oauth_client_id !~ '[[:space:]]'),
  constraint mcp_account_links_scope_valid check
    (cardinality(scopes) = 1 and scopes @> array['mcp:tools']::text[]),
  constraint mcp_account_links_status_valid check (status in ('ACTIVE', 'REVOKED')),
  constraint mcp_account_links_lifetime_valid check (expires_at > linked_at),
  constraint mcp_account_links_revocation_valid check
    ((status = 'ACTIVE' and revoked_at is null and revoked_by_user_id is null)
     or (status = 'REVOKED' and revoked_at is not null and revoked_by_user_id is not null)),
  constraint mcp_account_links_revocation_time_valid check
    (revoked_at is null or revoked_at >= linked_at)
);

create index mcp_account_links_org_status_idx
  on public.mcp_account_links (organization_id, status);
create index mcp_account_links_expiry_idx
  on public.mcp_account_links (expires_at) where status = 'ACTIVE';

alter table public.mcp_account_links enable row level security;
revoke all on public.mcp_account_links from anon, authenticated;
grant select on public.mcp_account_links to authenticated;

create policy mcp_account_links_owner_select on public.mcp_account_links
  for select to authenticated using (
    auth_user_id = (select auth.uid())
    and status = 'ACTIVE' and revoked_at is null and expires_at > now()
    and exists (
      select 1 from public.organization_members as member
      where member.id = organization_member_id
        and member.organization_id = mcp_account_links.organization_id
        and member.auth_user_id = (select auth.uid())
        and member.status = 'ACTIVE'
    )
  );

-- No client write policy. A later consent endpoint must perform verified,
-- atomic provisioning and revocation without granting business tools service_role.

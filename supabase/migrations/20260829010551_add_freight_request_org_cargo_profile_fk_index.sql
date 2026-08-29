create index freight_requests_org_cargo_profile_idx
  on public.freight_requests (organization_id, cargo_profile_id)
  where cargo_profile_id is not null;

-- Restrict direct FreightRequest mutations to the same active-manager roles
-- accepted by the authenticated server-side intake writers.  The authenticated
-- table grants remain necessary because the Next.js route executes with the
-- caller's JWT; RLS is the authorization boundary.

drop policy if exists freight_requests_member_insert on public.freight_requests;
create policy freight_requests_member_insert on public.freight_requests
for insert to authenticated
with check ((select private.has_organization_role(
  organization_id,
  array['OWNER','SUPERVISOR']::text[]
)));

drop policy if exists freight_requests_member_update on public.freight_requests;
create policy freight_requests_member_update on public.freight_requests
for update to authenticated
using ((select private.has_organization_role(
  organization_id,
  array['OWNER','SUPERVISOR']::text[]
)))
with check ((select private.has_organization_role(
  organization_id,
  array['OWNER','SUPERVISOR']::text[]
)));

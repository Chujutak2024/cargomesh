-- D1-01: optimistic concurrency token for the commercial FreightRequest draft.
-- The writer stays in the authenticated Next.js boundary; this migration grants
-- no new public privileges and leaves the existing RLS policies unchanged.
alter table public.freight_requests
  add column if not exists draft_version integer not null default 1;

alter table public.freight_requests
  drop constraint if exists freight_requests_draft_version_positive;

alter table public.freight_requests
  add constraint freight_requests_draft_version_positive
    check (draft_version >= 1);

create index if not exists freight_requests_org_draft_version_idx
  on public.freight_requests (organization_id, draft_version);

-- C-owned DDL for the authenticated manual FreightRequest intake writer.
-- Scenario/demo data belongs in supabase/scenarios and is deliberately absent.

alter table public.freight_requests
  add column if not exists origin_region text,
  add column if not exists destination_region text;

alter table public.freight_requests
  drop constraint if exists freight_requests_origin_region_not_blank,
  add constraint freight_requests_origin_region_not_blank
    check (origin_region is null or length(btrim(origin_region)) > 0),
  drop constraint if exists freight_requests_destination_region_not_blank,
  add constraint freight_requests_destination_region_not_blank
    check (destination_region is null or length(btrim(destination_region)) > 0);

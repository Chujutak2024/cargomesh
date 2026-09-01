begin;

-- Server-only routes use the Supabase service-role key. The legacy baseline
-- intentionally revoked Data API access, but did not explicitly restore the
-- corresponding server-role grants for these pre-existing tables. Keep public
-- roles unchanged; RLS continues to govern authenticated reads.
grant all privileges on table
  public.bookings,
  public.cargo_categories,
  public.carrier_metrics,
  public.carrier_offers,
  public.carrier_service_cargo_categories,
  public.carrier_services,
  public.carriers,
  public.freight_decisions,
  public.freight_requests,
  public.organization_preferences,
  public.organizations,
  public.vehicles
to service_role;

commit;

-- HAC-12: keep temporal feasibility unknown until a lane transit plan and
-- pickup readiness for the same carrying resource have explicit provenance.
alter table public.service_lanes
  add column planned_transit_minutes integer
    check (planned_transit_minutes > 0),
  add column transit_provenance_status text not null default 'UNKNOWN'
    check (transit_provenance_status in ('VERIFIED', 'ESTIMATED', 'SIMULATED', 'UNKNOWN')),
  add column cross_border_prohibited boolean not null default false,
  add column cross_border_prohibition_reference text,
  add constraint service_lanes_border_prohibition_evidence
    check (not cross_border_prohibited or
      coalesce(length(btrim(cross_border_prohibition_reference)), 0) > 0);

alter table public.capacity_calendars
  add column ready_pickup_area_id uuid,
  add constraint capacity_calendars_ready_pickup_same_service
    foreign key (ready_pickup_area_id, carrier_service_id)
    references public.service_areas(id, carrier_service_id);

grant select (ready_pickup_area_id) on public.capacity_calendars to authenticated;

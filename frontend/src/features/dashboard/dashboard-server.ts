import "server-only";

import type { AuthenticatedMemberContext } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  buildDashboardViewModel,
  type PersistedDashboardBooking,
  type PersistedDashboardRequest,
  type PersistedDashboardRun,
} from "./dashboard-view-model";
import { buildDashboardOperationsMap } from "./dashboard-map";

export async function getOrganizationDashboard(
  member: AuthenticatedMemberContext,
  locale = "es-PE",
) {
  const supabase = await createServerSupabaseClient();
  const { data: requestData, error: requestError } = await supabase
    .from("freight_requests")
    .select("id,code,organization_id,status,origin_address,origin_city,origin_country,destination_address,destination_city,destination_country,cross_border,cargo_description,cargo_entry_method,cargo_weight_kg,cargo_volume_m3,transport_mode,service_type,required_pickup,updated_at")
    .eq("organization_id", member.organizationId)
    .order("updated_at", { ascending: false })
    .limit(50);

  if (requestError) {
    throw new Error("DASHBOARD_UNAVAILABLE: No fue posible cargar las solicitudes.");
  }

  const requests = (requestData ?? []) as unknown as PersistedDashboardRequest[];
  if (requests.length === 0) {
    return { ...buildDashboardViewModel(member.organizationId, [], [], [], locale), map: null };
  }

  const [{ data: bookingData, error: bookingError }, { data: runData, error: runError }] = await Promise.all([
    supabase.from("bookings")
      .select("id,freight_request_id,status,provider_booking_status,updated_at")
      .in("freight_request_id", requests.map((request) => request.id))
      .order("updated_at", { ascending: false }),
    supabase.from("orchestration_runs")
      .select("id,freight_request_id,status,created_at")
      .in("freight_request_id", requests.map((request) => request.id))
      .order("created_at", { ascending: false }),
  ]);

  if (bookingError || runError) {
    throw new Error("DASHBOARD_UNAVAILABLE: No fue posible cargar los estados de booking.");
  }

  const model = buildDashboardViewModel(
    member.organizationId,
    requests,
    (bookingData ?? []) as unknown as PersistedDashboardBooking[],
    (runData ?? []) as unknown as PersistedDashboardRun[],
    locale,
  );
  const persistedBookingData = (bookingData ?? []) as unknown as Array<{ id: string; freight_request_id: string; status: string; provider_booking_status: string; updated_at: string }>;
  const activeBooking = persistedBookingData.find((booking) =>
    ["CONFIRMED", "IN_TRANSIT"].includes(booking.status) || ["CONFIRMED", "IN_TRANSIT"].includes(booking.provider_booking_status),
  );
  let eventData: Array<{ provider_event_id: string; event_type: string; occurred_at: string; payload: unknown }> = [];
  if (activeBooking) {
    const { data } = await supabase.from("booking_events")
      .select("provider_event_id,event_type,occurred_at,payload")
      .eq("booking_id", activeBooking.id).order("occurred_at", { ascending: true });
    eventData = (data ?? []) as unknown as typeof eventData;
  }
  return {
    ...model,
    map: buildDashboardOperationsMap(requests, persistedBookingData, eventData),
  };
}

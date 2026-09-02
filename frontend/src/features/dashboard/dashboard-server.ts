import "server-only";

import type { AuthenticatedMemberContext } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  buildDashboardViewModel,
  type PersistedDashboardBooking,
  type PersistedDashboardRequest,
  type PersistedDashboardRun,
} from "./dashboard-view-model";

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
  if (!activeBooking) return { ...model, map: null };
  const request = requests.find((item) => item.id === activeBooking.freight_request_id);
  if (!request) return { ...model, map: null };
  const { data: eventData } = await supabase.from("booking_events")
    .select("provider_event_id,event_type,occurred_at,payload")
    .eq("booking_id", activeBooking.id).order("occurred_at", { ascending: true });
  const checkpoints = ((eventData ?? []) as unknown as Array<{ provider_event_id: string; event_type: string; occurred_at: string; payload: unknown }>).flatMap((event) => {
    const payload = event.payload;
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return [];
    const location = (payload as Record<string, unknown>).location;
    if (!location || typeof location !== "object" || Array.isArray(location)) return [];
    const locationRecord = location as Record<string, unknown>;
    const city = typeof locationRecord.city === "string" ? locationRecord.city : null;
    const countryCode = typeof locationRecord.countryCode === "string" ? locationRecord.countryCode : null;
    return city && countryCode ? [{ id: event.provider_event_id, city, countryCode, label: event.event_type, occurredAt: event.occurred_at }] : [];
  });
  return { ...model, map: {
    bookingId: activeBooking.id, requestCode: request.code,
    origin: { city: request.origin_city, countryCode: request.origin_country },
    destination: { city: request.destination_city, countryCode: request.destination_country },
    checkpoints,
  } };
}

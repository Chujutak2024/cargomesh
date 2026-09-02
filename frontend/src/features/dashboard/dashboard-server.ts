import "server-only";

import type { AuthenticatedMemberContext } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  buildDashboardViewModel,
  type PersistedDashboardBooking,
  type PersistedDashboardRequest,
} from "./dashboard-view-model";

export async function getOrganizationDashboard(
  member: AuthenticatedMemberContext,
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
    return buildDashboardViewModel(member.organizationId, [], []);
  }

  const { data: bookingData, error: bookingError } = await supabase
    .from("bookings")
    .select("freight_request_id,status,provider_booking_status,updated_at")
    .in("freight_request_id", requests.map((request) => request.id))
    .order("updated_at", { ascending: false });

  if (bookingError) {
    throw new Error("DASHBOARD_UNAVAILABLE: No fue posible cargar los estados de booking.");
  }

  return buildDashboardViewModel(
    member.organizationId,
    requests,
    (bookingData ?? []) as unknown as PersistedDashboardBooking[],
  );
}

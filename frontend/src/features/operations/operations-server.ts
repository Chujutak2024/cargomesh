import "server-only";

import type { AuthenticatedMemberContext } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database.types";
import { getBookingViewModel } from "@/features/booking/booking-bridge";

export type DispatchQueueItem = {
  id: string; requestCode: string; status: string; runType: string;
  startedAt: string; completedAt: string | null; candidateCount: number; errorMessage: string | null;
};

export type TrackingListItem = {
  bookingId: string; requestCode: string; status: string; providerStatus: string;
  origin: string; destination: string; updatedAt: string; eventCount: number;
};

type OrganizationRow = { name: string; legal_name: string | null; code: string; country_code: string | null; business_identifier_type: string | null; business_identifier_value: string | null; corporate_phone: string | null; verified_corporate_email: string | null; default_currency: string; status: string };
type MemberRow = { id: string; display_name: string; corporate_email: string; role: string; status: string };
type PreferenceRow = { selection_mode: string; default_strategy: string; billing_mode: string; budget_default: number | null; confidence_threshold: number; anomaly_threshold_pct: number; max_pickup_wait_hours: number; allow_auto_booking: boolean; allow_auto_recovery: boolean };
type RequestCodeRow = { id: string; code: string };
type RequestRouteRow = RequestCodeRow & { origin_city: string; origin_country: string; destination_city: string; destination_country: string };
type RunRow = { id: string; freight_request_id: string; status: string; run_type: string; started_at: string; completed_at: string | null; candidate_snapshot: Json; error_message: string | null };
type BookingListRow = { id: string; freight_request_id: string; status: string; provider_booking_status: string; updated_at: string };

export async function getOrganizationProfile(member: AuthenticatedMemberContext) {
  const supabase = await createServerSupabaseClient();
  const [{ data: organization, error }, { data: members }, { data: preferences }] = await Promise.all([
    supabase.from("organizations").select("name,legal_name,code,country_code,business_identifier_type,business_identifier_value,corporate_phone,verified_corporate_email,default_currency,status").eq("id", member.organizationId).single(),
    supabase.from("organization_members").select("id,display_name,corporate_email,role,status").eq("organization_id", member.organizationId).order("display_name"),
    supabase.from("organization_preferences").select("selection_mode,default_strategy,billing_mode,budget_default,confidence_threshold,anomaly_threshold_pct,max_pickup_wait_hours,allow_auto_booking,allow_auto_recovery").eq("organization_id", member.organizationId).maybeSingle(),
  ]);
  if (error || !organization) throw new Error("ORGANIZATION_UNAVAILABLE");
  return { organization: organization as unknown as OrganizationRow, members: (members ?? []) as unknown as MemberRow[], preferences: preferences as unknown as PreferenceRow | null, canEdit: member.role === "OWNER" || member.role === "SUPERVISOR", currentRole: member.role };
}

export async function getExceptions(member: AuthenticatedMemberContext) {
  const supabase = await createServerSupabaseClient();
  const { data: requests, error } = await supabase.from("freight_requests").select("id,code").eq("organization_id", member.organizationId);
  if (error) throw new Error("EXCEPTIONS_UNAVAILABLE");
  if (!requests?.length) return [];
  const codes = new Map((requests as unknown as RequestCodeRow[]).map((request) => [request.id, request.code]));
  const [{ data: bookings }, { data: runs }, { data: decisions }] = await Promise.all([
    supabase.from("bookings").select("id,freight_request_id,status,provider_booking_status,updated_at").in("freight_request_id", [...codes.keys()]).in("status", ["REJECTED", "EXPIRED", "CANCELLED"]),
    supabase.from("orchestration_runs").select("id,freight_request_id,status,error_code,error_message,result_snapshot,updated_at:completed_at").in("freight_request_id", [...codes.keys()]).in("status", ["FAILED", "NO_MATCH"]),
    supabase.from("freight_decisions").select("id,orchestration_run_id,freight_request_id,requires_review,anomaly_evidence,decision_reason,created_at").in("freight_request_id", [...codes.keys()]).eq("requires_review", true),
  ]);
  const bookingItems = ((bookings ?? []) as unknown as BookingListRow[]).map((item) => ({ id: item.id, requestCode: codes.get(item.freight_request_id) ?? item.freight_request_id, kind: item.status, detail: item.provider_booking_status, updatedAt: item.updated_at, href: `/booking/${encodeURIComponent(codes.get(item.freight_request_id) ?? item.freight_request_id)}/status` }));
  const runItems = ((runs ?? []) as unknown as Array<{ id: string; freight_request_id: string; status: string; error_code: string | null; error_message: string | null; updated_at: string | null }>).map((item) => ({ id: item.id, requestCode: codes.get(item.freight_request_id) ?? item.freight_request_id, kind: item.status, detail: item.error_message ?? item.error_code ?? "BALANCED", updatedAt: item.updated_at ?? new Date(0).toISOString(), href: `/dispatch/${item.id}` }));
  const decisionItems = ((decisions ?? []) as unknown as Array<{ id: string; orchestration_run_id: string; freight_request_id: string; decision_reason: string | null; created_at: string }>).map((item) => ({ id: item.id, requestCode: codes.get(item.freight_request_id) ?? item.freight_request_id, kind: "SECURITY_REVIEW", detail: item.decision_reason ?? "BALANCED_REQUIRES_REVIEW", updatedAt: item.created_at, href: `/dispatch/${item.orchestration_run_id}` }));
  return [...bookingItems, ...runItems, ...decisionItems].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getTrackingDetail(member: AuthenticatedMemberContext, bookingId: string) {
  const booking = await getBookingViewModel(bookingId);
  const supabase = await createServerSupabaseClient();
  const { data: request, error } = await supabase.from("freight_requests")
    .select("code,organization_id,origin_city,origin_country,destination_city,destination_country,cargo_description")
    .eq("id", booking.freightRequestId).eq("organization_id", member.organizationId).maybeSingle();
  if (error || !request) throw new Error("TRACKING_NOT_FOUND");
  return { booking, request: request as unknown as { code: string; organization_id: string; origin_city: string; origin_country: string; destination_city: string; destination_country: string; cargo_description: string | null } };
}

function arrayLength(value: Json): number { return Array.isArray(value) ? value.length : 0; }

export async function getDispatchQueue(member: AuthenticatedMemberContext): Promise<DispatchQueueItem[]> {
  const supabase = await createServerSupabaseClient();
  const { data: requests, error: requestError } = await supabase.from("freight_requests")
    .select("id,code").eq("organization_id", member.organizationId);
  if (requestError) throw new Error("DISPATCH_QUEUE_UNAVAILABLE");
  if (!requests?.length) return [];
  const codes = new Map((requests as unknown as RequestCodeRow[]).map((request) => [request.id, request.code]));
  const { data: runs, error } = await supabase.from("orchestration_runs")
    .select("id,freight_request_id,status,run_type,started_at,completed_at,candidate_snapshot,error_message")
    .in("freight_request_id", [...codes.keys()]).order("started_at", { ascending: false });
  if (error) throw new Error("DISPATCH_QUEUE_UNAVAILABLE");
  return ((runs ?? []) as unknown as RunRow[]).map((run) => ({
    id: run.id, requestCode: codes.get(run.freight_request_id) ?? run.freight_request_id,
    status: run.status, runType: run.run_type, startedAt: run.started_at,
    completedAt: run.completed_at, candidateCount: arrayLength(run.candidate_snapshot), errorMessage: run.error_message,
  }));
}

export async function getTrackingList(member: AuthenticatedMemberContext): Promise<TrackingListItem[]> {
  const supabase = await createServerSupabaseClient();
  const { data: requests, error: requestError } = await supabase.from("freight_requests")
    .select("id,code,origin_city,origin_country,destination_city,destination_country")
    .eq("organization_id", member.organizationId);
  if (requestError) throw new Error("TRACKING_UNAVAILABLE");
  if (!requests?.length) return [];
  const byId = new Map((requests as unknown as RequestRouteRow[]).map((request) => [request.id, request]));
  const { data: bookings, error } = await supabase.from("bookings")
    .select("id,freight_request_id,status,provider_booking_status,updated_at")
    .in("freight_request_id", [...byId.keys()])
    .in("status", ["CONFIRMED", "IN_TRANSIT", "COMPLETED"])
    .order("updated_at", { ascending: false });
  if (error) throw new Error("TRACKING_UNAVAILABLE");
  if (!bookings?.length) return [];
  const { data: events, error: eventsError } = await supabase.from("booking_events")
    .select("booking_id").in("booking_id", (bookings as unknown as BookingListRow[]).map((booking) => booking.id));
  if (eventsError) throw new Error("TRACKING_UNAVAILABLE");
  const counts = new Map<string, number>();
  for (const event of (events ?? []) as unknown as Array<{ booking_id: string }>) counts.set(event.booking_id, (counts.get(event.booking_id) ?? 0) + 1);
  return (bookings as unknown as BookingListRow[]).map((booking) => {
    const request = byId.get(booking.freight_request_id)!;
    return {
      bookingId: booking.id, requestCode: request.code, status: booking.status,
      providerStatus: booking.provider_booking_status,
      origin: `${request.origin_city}, ${request.origin_country}`,
      destination: `${request.destination_city}, ${request.destination_country}`,
      updatedAt: booking.updated_at, eventCount: counts.get(booking.id) ?? 0,
    };
  });
}

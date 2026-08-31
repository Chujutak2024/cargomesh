import "server-only";

import { get_candidate_provider_pages } from "@/features/discovery";
import { requireAuthenticatedMember } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database.types";
import {
  BookingBridgeError,
  BOOKING_VIEW_MODEL_SCHEMA_VERSION,
  type BookingBridgePersistenceResult,
  type BookingViewModel,
  type PreparedBookingAuthorization,
  type ResetDemoBookingRuntimeResult,
} from "./contracts";
import {
  assertProviderNavigation,
  parsePrepareBookingInput,
  parsePrepareBookingRecoveryInput,
  parseRecordProviderBookingInput,
  parseRecordProviderBookingStatusInput,
} from "./validation";
import {
  mapBookingDatabaseError,
  requireRequestOrganizationMember,
} from "./server-policy";

type FreightRequestRow = { id: string; organization_id: string };
type BookingRow = {
  id: string;
  freight_request_id: string;
  carrier_id: string;
  offer_id: string;
  provider_reference: string | null;
  status: BookingViewModel["status"];
  provider_booking_status: BookingViewModel["providerBookingStatus"];
  provider_response_deadline: string;
  payment_status: BookingViewModel["paymentStatus"];
  payment_url: string | null;
  selection_mode: BookingViewModel["selectionMode"];
};
type BookingEventRow = {
  provider_event_id: string;
  event_type: string;
  provider_booking_status: BookingViewModel["events"][number]["providerBookingStatus"];
  occurred_at: string;
  payload: Json;
};

async function assertRequestMembership(freightRequestId: string) {
  const session = await createServerSupabaseClient();
  const { data, error } = await session
    .from("freight_requests")
    .select("id,organization_id")
    .eq("id", freightRequestId)
    .maybeSingle();
  if (error) throw new BookingBridgeError("REQUEST_LOOKUP_FAILED", "Unable to load FreightRequest.", 500);
  if (!data) throw new BookingBridgeError("NOT_FOUND", "FreightRequest not found.", 404);
  const request = data as unknown as FreightRequestRow;
  const member = await requireRequestOrganizationMember(request.organization_id, requireAuthenticatedMember);
  return { request, member };
}

async function assertBookingBelongsToRequest(bookingId: string, freightRequestId: string): Promise<void> {
  const session = await createServerSupabaseClient();
  const { data, error } = await session
    .from("bookings")
    .select("id")
    .eq("id", bookingId)
    .eq("freight_request_id", freightRequestId)
    .maybeSingle();
  if (error) throw new BookingBridgeError("BOOKING_LOOKUP_FAILED", "Unable to load booking.", 500);
  if (!data) throw new BookingBridgeError("NOT_FOUND", "Booking not found for this FreightRequest.", 404);
}

async function assertProviderIdentity(
  freightRequestId: string,
  carrierId: string,
  matchingServiceId: string,
  providerUrl: string,
  navigationUrl: string,
  cargomeshOrigin: string,
): Promise<void> {
  assertProviderNavigation(providerUrl, matchingServiceId, navigationUrl, cargomeshOrigin);
  const discovery = await get_candidate_provider_pages(freightRequestId);
  const candidate = discovery?.candidates.find(
    (item) => item.carrierId === carrierId && item.matchingServiceId === matchingServiceId && item.providerUrl === providerUrl,
  );
  if (!candidate) {
    throw new BookingBridgeError(
      "CANDIDATE_MISMATCH",
      "Carrier, providerUrl and matchingServiceId are not a registered candidate.",
      422,
    );
  }
}

export async function prepare_booking(rawInput: unknown): Promise<PreparedBookingAuthorization> {
  const input = parsePrepareBookingInput(rawInput);
  const { member } = await assertRequestMembership(input.freightRequestId);

  if (input.selectionMode === "SMART_AUTO" && member.role !== "OWNER" && member.role !== "SUPERVISOR") {
    throw new BookingBridgeError("FORBIDDEN", "SMART_AUTO requires an OWNER or SUPERVISOR.", 403);
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("prepare_booking_authorization", {
    p_freight_request_id: input.freightRequestId,
    p_offer_id: input.offerId,
    p_selected_by_member_id: member.memberId,
    p_selection_mode: input.selectionMode,
    p_booking_idempotency_key: input.bookingIdempotencyKey,
  });
  if (error) throw mapBookingDatabaseError(error);
  return mapPreparedAuthorization(data);
}

async function mapPreparedAuthorization(
  data: unknown,
): Promise<PreparedBookingAuthorization> {
  const row = (data as Array<{
    authorization_reference: string; freight_decision_id: string; freight_request_id: string; offer_id: string;
    carrier_id: string; matching_service_id: string; provider_offer_reference: string;
    authorization_kind: PreparedBookingAuthorization["authorizationContext"]["authorizedBy"];
    selection_mode: PreparedBookingAuthorization["selectionMode"]; booking_idempotency_key: string;
    expires_at: string; deduplicated: boolean;
  }> | null)?.[0];
  if (!row) throw new BookingBridgeError("BOOKING_BRIDGE_UNAVAILABLE", "Booking authorization returned no result.", 500);
  return {
    authorizationReference: row.authorization_reference, freightDecisionId: row.freight_decision_id,
    freightRequestId: row.freight_request_id, offerId: row.offer_id, carrierId: row.carrier_id,
    matchingServiceId: row.matching_service_id, providerOfferReference: row.provider_offer_reference,
    authorizationContext: { authorizationReference: row.authorization_reference, authorizedBy: row.authorization_kind },
    selectionMode: row.selection_mode, bookingIdempotencyKey: row.booking_idempotency_key,
    expiresAt: row.expires_at, deduplicated: row.deduplicated,
  };
}

export async function prepare_booking_recovery(rawInput: unknown): Promise<PreparedBookingAuthorization> {
  const input = parsePrepareBookingRecoveryInput(rawInput);
  const { member } = await assertRequestMembership(input.freightRequestId);
  await assertBookingBelongsToRequest(input.replacesBookingId, input.freightRequestId);
  if (input.selectionMode === "SMART_AUTO" && member.role !== "OWNER" && member.role !== "SUPERVISOR") {
    throw new BookingBridgeError("FORBIDDEN", "SMART_AUTO requires an OWNER or SUPERVISOR.", 403);
  }
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("prepare_booking_recovery", {
    p_replaces_booking_id: input.replacesBookingId,
    p_replacement_offer_id: input.offerId,
    p_selected_by_member_id: member.memberId,
    p_selection_mode: input.selectionMode,
    p_booking_idempotency_key: input.bookingIdempotencyKey,
  });
  if (error) throw mapBookingDatabaseError(error);
  return mapPreparedAuthorization(data);
}

export async function reset_demo_booking_runtime(freightRequestId: string): Promise<ResetDemoBookingRuntimeResult> {
  const { member } = await assertRequestMembership(freightRequestId);
  if (member.role !== "OWNER" && member.role !== "SUPERVISOR") {
    throw new BookingBridgeError("FORBIDDEN", "Demo reset requires an OWNER or SUPERVISOR.", 403);
  }
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("reset_demo_booking_runtime", { p_freight_request_id: freightRequestId });
  if (error) throw mapBookingDatabaseError(error);
  const row = (data as Array<{ freight_request_id: string; deleted_bookings: number; deleted_authorizations: number }> | null)?.[0];
  if (!row) throw new BookingBridgeError("BOOKING_BRIDGE_UNAVAILABLE", "Demo reset returned no result.", 500);
  return {
    freightRequestId: row.freight_request_id,
    deletedBookings: row.deleted_bookings,
    deletedAuthorizations: row.deleted_authorizations,
  };
}

export async function record_provider_booking(
  rawInput: unknown,
  cargomeshOrigin: string,
): Promise<BookingBridgePersistenceResult> {
  const input = parseRecordProviderBookingInput(rawInput);
  if (!input.toolOutput.ok) {
    throw new BookingBridgeError("PROVIDER_BOOKING_FAILED", input.toolOutput.error.message, 422);
  }
  await assertRequestMembership(input.freightRequestId);
  await assertProviderIdentity(
    input.freightRequestId,
    input.carrierId,
    input.matchingServiceId,
    input.providerUrl,
    input.navigationUrl,
    cargomeshOrigin,
  );
  if (
    input.toolOutput.data.freightRequestId !== input.freightRequestId ||
    input.toolOutput.data.providerOfferReference !== input.toolInput.provider_offer_reference
  ) {
    throw new BookingBridgeError("CORRELATION_ERROR", "Provider booking output does not match the booking input.", 422);
  }

  const canonical = {
    schemaVersion: "1.0",
    cargomeshOrigin: new URL(cargomeshOrigin).origin,
    authorizationReference: input.authorizationReference,
    freightRequestId: input.freightRequestId,
    offerId: input.offerId,
    carrierId: input.carrierId,
    matchingServiceId: input.matchingServiceId,
    providerUrl: input.providerUrl,
    navigationUrl: input.navigationUrl,
    toolName: input.toolName,
    toolInput: input.toolInput,
    toolOutput: input.toolOutput,
  };
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("record_provider_booking_result", {
    p_bridge_call_id: input.bridgeCallId,
    p_authorization_reference: input.authorizationReference,
    p_canonical_payload: canonical as unknown as Json,
    p_provider_reference: input.toolOutput.data.providerReference,
    p_provider_booking_status: input.toolOutput.data.providerBookingStatus,
    p_provider_response_deadline: input.toolOutput.data.providerResponseDeadline,
    p_payment_required: input.toolOutput.data.paymentRequired,
    p_payment_url: input.toolOutput.data.paymentUrl,
    p_provider_idempotent_replay: input.toolOutput.data.idempotentReplay,
  });
  if (error) throw mapBookingDatabaseError(error);
  const row = (data as unknown as Array<{ booking_id: string; result_status: "INSERTED" | "DEDUPLICATED"; deduplicated: boolean }> | null)?.[0];
  if (!row) throw new BookingBridgeError("BOOKING_BRIDGE_UNAVAILABLE", "Booking Bridge returned no persistence result.", 500);
  return { bookingId: row.booking_id, status: row.result_status, deduplicated: row.deduplicated };
}

export async function record_provider_booking_status(
  rawInput: unknown,
  cargomeshOrigin: string,
): Promise<BookingBridgePersistenceResult> {
  const input = parseRecordProviderBookingStatusInput(rawInput);
  if (!input.toolOutput.ok) {
    throw new BookingBridgeError("PROVIDER_STATUS_FAILED", input.toolOutput.error.message, 422);
  }
  await assertRequestMembership(input.freightRequestId);
  await assertProviderIdentity(
    input.freightRequestId,
    input.carrierId,
    input.matchingServiceId,
    input.providerUrl,
    input.navigationUrl,
    cargomeshOrigin,
  );
  if (input.toolOutput.data.providerReference !== input.toolInput.provider_reference) {
    throw new BookingBridgeError("CORRELATION_ERROR", "Provider status output does not match provider_reference.", 422);
  }
  const canonical = {
    schemaVersion: "1.0",
    cargomeshOrigin: new URL(cargomeshOrigin).origin,
    authorizationReference: input.authorizationReference,
    bookingId: input.bookingId,
    freightRequestId: input.freightRequestId,
    offerId: input.offerId,
    carrierId: input.carrierId,
    matchingServiceId: input.matchingServiceId,
    providerUrl: input.providerUrl,
    navigationUrl: input.navigationUrl,
    toolName: input.toolName,
    toolInput: input.toolInput,
    toolOutput: input.toolOutput,
  };
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("record_provider_booking_status", {
    p_bridge_call_id: input.bridgeCallId,
    p_authorization_reference: input.authorizationReference,
    p_booking_id: input.bookingId,
    p_canonical_payload: canonical as unknown as Json,
    p_provider_reference: input.toolOutput.data.providerReference,
    p_provider_booking_status: input.toolOutput.data.providerBookingStatus,
    p_payment_status: input.toolOutput.data.paymentStatus,
    p_events: input.toolOutput.data.events as unknown as Json,
  });
  if (error) throw mapBookingDatabaseError(error);
  const row = (data as unknown as Array<{ booking_id: string; result_status: "INSERTED" | "DEDUPLICATED"; deduplicated: boolean }> | null)?.[0];
  if (!row) throw new BookingBridgeError("BOOKING_BRIDGE_UNAVAILABLE", "Booking status Bridge returned no persistence result.", 500);
  return { bookingId: row.booking_id, status: row.result_status, deduplicated: row.deduplicated };
}

function parseEventPayload(payload: Json): { location: { countryCode: string; city: string } | null; description: string | null } {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) return { location: null, description: null };
  const source = payload as Record<string, unknown>;
  const rawLocation = source.location;
  const location = rawLocation && typeof rawLocation === "object" && !Array.isArray(rawLocation)
    && typeof (rawLocation as Record<string, unknown>).countryCode === "string"
    && typeof (rawLocation as Record<string, unknown>).city === "string"
    ? {
        countryCode: (rawLocation as Record<string, string>).countryCode,
        city: (rawLocation as Record<string, string>).city,
      }
    : null;
  return { location, description: typeof source.description === "string" ? source.description : null };
}

export async function get_booking_view_model(bookingId: string): Promise<BookingViewModel> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(bookingId)) {
    throw new BookingBridgeError("INVALID_ARGUMENT", "bookingId must be a UUID.", 400);
  }
  await requireAuthenticatedMember();
  const session = await createServerSupabaseClient();
  const { data: bookingData, error: bookingError } = await session
    .from("bookings")
    .select("id,freight_request_id,carrier_id,offer_id,provider_reference,status,provider_booking_status,provider_response_deadline,payment_status,payment_url,selection_mode")
    .eq("id", bookingId)
    .maybeSingle();
  if (bookingError) throw new BookingBridgeError("BOOKING_LOOKUP_FAILED", "Unable to load booking.", 500);
  if (!bookingData) throw new BookingBridgeError("NOT_FOUND", "Booking not found.", 404);
  const booking = bookingData as unknown as BookingRow;
  await assertRequestMembership(booking.freight_request_id);

  const { data: eventData, error: eventError } = await session
    .from("booking_events")
    .select("provider_event_id,event_type,provider_booking_status,occurred_at,payload")
    .eq("booking_id", bookingId)
    .order("occurred_at", { ascending: true });
  if (eventError) throw new BookingBridgeError("BOOKING_EVENTS_LOOKUP_FAILED", "Unable to load booking events.", 500);

  const { data: recoveryData, error: recoveryError } = await session
    .from("carrier_offers")
    .select("id")
    .eq("freight_request_id", booking.freight_request_id)
    .eq("status", "ELIGIBLE")
    .neq("id", booking.offer_id)
    .gt("valid_until", new Date().toISOString());
  if (recoveryError) throw new BookingBridgeError("RECOVERY_LOOKUP_FAILED", "Unable to load recovery offers.", 500);
  const canRecover = ["REJECTED", "EXPIRED", "CANCELLED"].includes(booking.status);
  return {
    schemaVersion: BOOKING_VIEW_MODEL_SCHEMA_VERSION,
    bookingId: booking.id,
    freightRequestId: booking.freight_request_id,
    offerId: booking.offer_id,
    carrierId: booking.carrier_id,
    providerReference: booking.provider_reference ?? "",
    status: booking.status,
    providerBookingStatus: booking.provider_booking_status,
    providerResponseDeadline: booking.provider_response_deadline,
    paymentStatus: booking.payment_status,
    paymentUrl: booking.payment_url,
    selectionMode: booking.selection_mode,
    canRecover,
    recoveryOfferIds: canRecover ? ((recoveryData ?? []) as Array<{ id: string }>).map((row) => row.id) : [],
    events: ((eventData ?? []) as unknown as BookingEventRow[]).map((event) => ({
      providerEventId: event.provider_event_id,
      eventType: event.event_type,
      providerBookingStatus: event.provider_booking_status,
      occurredAt: event.occurred_at,
      ...parseEventPayload(event.payload),
    })),
  };
}

export const prepareBooking = prepare_booking;
export const prepareBookingRecovery = prepare_booking_recovery;
export const resetDemoBookingRuntime = reset_demo_booking_runtime;
export const recordProviderBooking = record_provider_booking;
export const recordProviderBookingStatus = record_provider_booking_status;
export const getBookingViewModel = get_booking_view_model;

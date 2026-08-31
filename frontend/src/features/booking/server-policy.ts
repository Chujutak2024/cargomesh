import type { AuthenticatedMemberContext } from "@/lib/supabase/auth";
import { BookingBridgeError } from "./contracts";

export type RequestOrganizationMembershipLookup = (options: {
  organizationId: string;
}) => Promise<AuthenticatedMemberContext>;

export async function requireRequestOrganizationMember(
  organizationId: string,
  lookup: RequestOrganizationMembershipLookup,
): Promise<AuthenticatedMemberContext> {
  if (!organizationId) {
    throw new BookingBridgeError("REQUEST_ORGANIZATION_MISSING", "FreightRequest has no organization.", 500);
  }
  return lookup({ organizationId });
}

export function mapBookingDatabaseError(error: { message: string }): BookingBridgeError {
  const { message } = error;
  if (message.includes("IDEMPOTENCY_CONFLICT")) return new BookingBridgeError("IDEMPOTENCY_CONFLICT", message, 409);
  if (message.includes("BOOKING_ALREADY_EXISTS")) return new BookingBridgeError("BOOKING_ALREADY_EXISTS", message, 409);
  if (message.includes("BOOKING_AUTHORIZATION_EXPIRED")) {
    return new BookingBridgeError("BOOKING_AUTHORIZATION_EXPIRED", message, 409);
  }
  if (message.includes("NOT_FOUND")) return new BookingBridgeError("NOT_FOUND", message, 404);
  if (message.includes("AUTHORIZATION") || message.includes("SMART_AUTO")) {
    return new BookingBridgeError("FORBIDDEN", message, 403);
  }
  if (message.includes("INVALID_") || message.includes("MISMATCH") || message.includes("NOT_ELIGIBLE") || message.includes("NOT_READY")) {
    return new BookingBridgeError("BOOKING_REJECTED", message, 422);
  }
  if (message.includes("EXPIRED")) return new BookingBridgeError("BOOKING_REJECTED", message, 422);
  return new BookingBridgeError("BOOKING_BRIDGE_UNAVAILABLE", message, 500);
}

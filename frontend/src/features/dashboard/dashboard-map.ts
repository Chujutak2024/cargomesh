import type { OperationsMapModel } from "./operations-map-contract";
import type { PersistedDashboardBooking, PersistedDashboardRequest } from "./dashboard-view-model";

type PersistedBookingEvent = {
  provider_event_id: string;
  event_type: string;
  occurred_at: string;
  payload: unknown;
};

const PLANNED_REQUEST_STATUSES = new Set([
  "PENDING",
  "ORCHESTRATING",
  "AWAITING_SELECTION",
  "BOOKING",
]);

function activeBooking(bookings: PersistedDashboardBooking[]) {
  return bookings
    .filter((booking) =>
      ["CONFIRMED", "IN_TRANSIT"].includes(booking.status)
      || ["CONFIRMED", "IN_TRANSIT"].includes(booking.provider_booking_status),
    )
    .sort((left, right) => Date.parse(right.updated_at) - Date.parse(left.updated_at))[0];
}

function checkpointsFrom(events: PersistedBookingEvent[]) {
  return events.flatMap((event) => {
    const payload = event.payload;
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return [];
    const location = (payload as Record<string, unknown>).location;
    if (!location || typeof location !== "object" || Array.isArray(location)) return [];
    const record = location as Record<string, unknown>;
    const city = typeof record.city === "string" ? record.city : null;
    const countryCode = typeof record.countryCode === "string" ? record.countryCode : null;
    return city && countryCode
      ? [{ id: event.provider_event_id, city, countryCode, label: event.event_type, occurredAt: event.occurred_at }]
      : [];
  });
}

/**
 * Produces only persisted planned-route data or persisted carrier checkpoints.
 * It never manufactures a booking, vehicle, ETA, GPS position, or checkpoint.
 */
export function buildDashboardOperationsMap(
  requests: PersistedDashboardRequest[],
  bookings: PersistedDashboardBooking[],
  events: PersistedBookingEvent[] = [],
): OperationsMapModel | null {
  const booking = activeBooking(bookings);
  const request = booking
    ? requests.find((item) => item.id === booking.freight_request_id)
    : requests.find((item) => PLANNED_REQUEST_STATUSES.has(item.status));

  if (!request) return null;

  return {
    bookingId: booking?.id ?? null,
    mode: booking ? "live" : "planned",
    requestCode: request.code,
    origin: { city: request.origin_city, countryCode: request.origin_country },
    destination: { city: request.destination_city, countryCode: request.destination_country },
    checkpoints: booking ? checkpointsFrom(events) : [],
  };
}

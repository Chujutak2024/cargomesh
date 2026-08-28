import { dataStore } from "../freight/store";
import { Booking, DisruptionEvent } from "../freight/types";
import { executeBookFreight, executeQuoteFreight } from "../../webmcp/provider-tools";

export interface DisruptionRecoveryResult {
  event: DisruptionEvent;
  originalBooking: Booking;
  replacementBooking?: Booking;
  rebooked: boolean;
  message: string;
}

export async function simulateAndRecoverDisruption(
  bookingId: string,
  incidentType: DisruptionEvent["incident_type"] = "BREAKDOWN"
): Promise<DisruptionRecoveryResult> {
  const bookings = dataStore.getBookings();
  const booking = bookings.find((b) => b.id === bookingId);
  if (!booking) {
    throw new Error(`Booking ${bookingId} not found.`);
  }

  const request = dataStore.getFreightRequestById(booking.freight_request_id);
  if (!request) {
    throw new Error(`Freight Request ${booking.freight_request_id} not found.`);
  }

  // 1. Mark existing booking & request as disrupted
  dataStore.updateBooking(booking.id, { status: "DISRUPTED" });
  dataStore.updateFreightRequest(request.id, { status: "DISRUPTED" });

  // 2. Discover alternative replacement carriers (excluding the broken carrier)
  const carriers = dataStore.getCarriers().filter((c) => c.id !== booking.carrier_id && c.status === "ACTIVE");
  
  // Prefer high reliability replacement (Inca Logistics)
  const replacementCarrier = carriers.find((c) => c.id === "car-inca") || carriers[0];

  // 3. Request immediate replacement quote via WebMCP
  const replacementQuote = await executeQuoteFreight({
    carrier_id: replacementCarrier.id,
    freight_request_id: request.id,
    origin: `${request.origin_city}, ${request.origin_country}`,
    destination: `${request.destination_city}, ${request.destination_country}`,
    cargo_weight_kg: request.cargo_weight_kg,
    cargo_category: "GENERAL",
  });

  const priceDelta = replacementQuote.price - (booking.price || booking.confirmed_price || 760); // e.g. 820 - 760 = +60
  const etaDeltaHours = -2; // Inca arrives 2 hours earlier

  // Policy threshold: auto-rebook if delta <= $100
  const canAutoRebook = priceDelta <= 100;

  let replacementBooking: Booking | undefined = undefined;
  if (canAutoRebook) {
    replacementBooking = await executeBookFreight({
      carrier_id: replacementCarrier.id,
      freight_request_id: request.id,
      offer_id: replacementQuote.id,
    });
    dataStore.updateFreightRequest(request.id, { status: "REBOOKED" });
  }

  const disruptionEvent: DisruptionEvent = {
    id: `dis-${Date.now()}`,
    booking_id: booking.id,
    freight_request_id: request.id,
    incident_type: incidentType,
    description: `Vehicle breakdown reported during transit at Mile 142. Automatic failover initiated.`,
    detected_at: new Date().toISOString(),
    original_carrier_id: booking.carrier_id,
    original_price: booking.price,
    replacement_carrier_id: replacementCarrier.id,
    location: "Panamericana Sur Km 142",
    severity: "HIGH",
    price_delta: priceDelta,
    eta_delta_hours: etaDeltaHours,
    auto_rebooked: canAutoRebook,
    status: canAutoRebook ? "REBOOKED" : "PENDING_REVIEW",
    created_at: new Date().toISOString(),
  };

  dataStore.createDisruption(disruptionEvent);

  return {
    event: disruptionEvent,
    originalBooking: booking,
    replacementBooking,
    rebooked: canAutoRebook,
    message: canAutoRebook
      ? `Disruption recovered: Autonomously rebooked with ${replacementCarrier.name} (Delta: +$${priceDelta}, ETA: ${etaDeltaHours}h faster).`
      : `Disruption escalated to supervisor queue (Delta +$${priceDelta} exceeds policy).`,
  };
}

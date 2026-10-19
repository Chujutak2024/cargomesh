import type { WorkflowRecordV2 } from "./shipper-model";

type Offer = Extract<WorkflowRecordV2, { kind: "offers" }>;
type Option = Extract<WorkflowRecordV2, { kind: "ranking" }>["data"]["options"][number];
type Booking = Extract<WorkflowRecordV2, { kind: "bookings" }>;
type Decision = Extract<WorkflowRecordV2, { kind: "decisions" }>;

export function offerAvailability(offer: Offer, now = Date.now()) {
  if (offer.data.status === "WITHDRAWN") return "WITHDRAWN" as const;
  if (offer.data.status === "SUPERSEDED") return "SUPERSEDED" as const;
  if (offer.data.status !== "RECEIVED") return "INVALID" as const;
  const startsAt = Date.parse(offer.data.validity.startsAt);
  const endsAt = Date.parse(offer.data.validity.endsAt);
  if (!Number.isFinite(startsAt) || !Number.isFinite(endsAt) || startsAt >= endsAt) return "INVALID" as const;
  if (endsAt <= now) return "EXPIRED" as const;
  if (startsAt > now) return "NOT_STARTED" as const;
  return "AVAILABLE" as const;
}

export function optionAvailability(option: Option | null, offers: Offer[], now = Date.now()) {
  if (!option) return { available: false, reasons: ["NO_SELECTION"] };
  if (!option.offerIds.length) return { available: false, reasons: ["NO_OFFERS"] };
  const byId = new Map(offers.map((offer) => [offer.id, offer]));
  const reasons = option.offerIds.flatMap((id) => {
    const offer = byId.get(id);
    return offer ? (offerAvailability(offer, now) === "AVAILABLE" ? [] : [`${id}: ${offerAvailability(offer, now)}`]) : [`${id}: MISSING`];
  });
  return { available: reasons.length === 0, reasons };
}

export function bookingsStillNeeded(offerIds: string[], bookings: Extract<WorkflowRecordV2, { kind: "bookings" }>[], decisionId?: string) {
  const matching = bookings.filter((booking) => booking.data.decisionId === decisionId);
  // The current booking read DTO omits offerId. Stop instead of guessing which
  // offer remains or issuing a duplicate authorization after a partial failure.
  if (matching.some((booking) => typeof booking.data.offerId !== "string")) return [];
  return offerIds.filter((id) => !matching.some((booking) => booking.data.offerId === id));
}

export function money(amount: number, currency: string, locale: string) {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(amount);
}

export function resolveBookingOffer(booking: Booking, decisions: Decision[], offers: Offer[]) {
  if (typeof booking.data.offerId === "string") return offers.find((offer) => offer.id === booking.data.offerId
    && offer.requestId === booking.requestId) ?? null;
  const decision = decisions.find((item) => item.id === booking.data.decisionId && item.requestId === booking.requestId);
  if (!decision) return null;
  const candidates = offers.filter((offer) => decision.data.selectedOfferIds.includes(offer.id)
    && offer.carrierId === booking.carrierId && offer.requestId === booking.requestId);
  return candidates.length === 1 ? candidates[0] : null;
}

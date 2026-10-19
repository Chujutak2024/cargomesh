import assert from "node:assert/strict";
import test from "node:test";
import { bookingsStillNeeded, offerAvailability, optionAvailability, resolveBookingOffer } from "./commercial-view";
import type { WorkflowRecordV2 } from "./shipper-model";

const id = "10000000-0000-4000-8000-000000000001";
const offer = { id, data: { status: "RECEIVED", validity: { startsAt: "2026-01-01T00:00:00Z", endsAt: "2027-01-01T00:00:00Z" } } } as Extract<WorkflowRecordV2, { kind: "offers" }>;
const option = { offerIds: [id] } as Extract<WorkflowRecordV2, { kind: "ranking" }>["data"]["options"][number];

test("commercial choice requires every current offer, never an expired, withdrawn or missing one", () => {
  const now = Date.parse("2026-10-10T00:00:00Z");
  assert.equal(offerAvailability(offer, now), "AVAILABLE");
  assert.equal(optionAvailability(option, [offer], now).available, true);
  assert.equal(optionAvailability(option, [offer], Date.parse("2027-01-02T00:00:00Z")).available, false);
  assert.deepEqual(optionAvailability(option, [], now).reasons, [`${id}: MISSING`]);
  assert.equal(offerAvailability({ ...offer, data: { ...offer.data, status: "WITHDRAWN" } }, now), "WITHDRAWN");
  assert.deepEqual(optionAvailability({ ...option, offerIds: [] }, [offer], now).reasons, ["NO_OFFERS"]);
  assert.equal(offerAvailability({ ...offer, data: { ...offer.data, validity: { startsAt: "invalid", endsAt: "2027-01-01T00:00:00Z" } } }, now), "INVALID");
});

test("booking retry excludes an offer already authorized by this decision", () => {
  const bookings = [{ data: { decisionId: "decision-1", offerId: id, authorizationStatus: "AUTHORIZED" } }] as unknown as Extract<WorkflowRecordV2, { kind: "bookings" }>[];
  assert.deepEqual(bookingsStillNeeded([id], bookings, "decision-1"), []);
  assert.deepEqual(bookingsStillNeeded([id], [], "decision-1"), [id]);
  const oldDto = [{ data: { decisionId: "decision-1", authorizationStatus: "AUTHORIZED" } }] as unknown as Extract<WorkflowRecordV2, { kind: "bookings" }>[];
  assert.deepEqual(bookingsStillNeeded([id], oldDto, "decision-1"), []);
  const cancelled = [{ data: { decisionId: "decision-1", offerId: id, authorizationStatus: "REVOKED", carrierConfirmationStatus: "CANCELLED" } }] as unknown as Extract<WorkflowRecordV2, { kind: "bookings" }>[];
  assert.deepEqual(bookingsStillNeeded([id], cancelled, "decision-1"), [], "a cancelled row still consumes the decision-offer pair");
});

test("booking price is linked only when persisted decision and carrier identify one offer", () => {
  const carrierId = "10000000-0000-4000-8000-000000000002";
  const first = { ...offer, carrierId };
  const booking = { carrierId, data: { decisionId: "decision-1" } } as unknown as Extract<WorkflowRecordV2, { kind: "bookings" }>;
  const decision = { id: "decision-1", data: { selectedOfferIds: [id] } } as Extract<WorkflowRecordV2, { kind: "decisions" }>;
  assert.equal(resolveBookingOffer(booking, [decision], [first])?.id, id);
  const another = { ...first, id: "10000000-0000-4000-8000-000000000003" };
  const twoOffers = { ...decision, data: { ...decision.data, selectedOfferIds: [id, another.id] } };
  assert.equal(resolveBookingOffer(booking, [twoOffers], [first, another]), null);
  assert.equal(resolveBookingOffer(booking, [], [first]), null);
});

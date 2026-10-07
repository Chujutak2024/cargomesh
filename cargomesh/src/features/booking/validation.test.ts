import assert from "node:assert/strict";
import test from "node:test";
import {
  assertProviderNavigation,
  parsePrepareBookingInput,
  parsePrepareBookingRecoveryInput,
  parseRecordProviderBookingInput,
  parseRecordProviderBookingStatusInput,
} from "./validation";

const ids = {
  authorization: "a0000000-0000-0000-0000-000000000001",
  request: "f2000000-0000-0000-0000-000000000001",
  offer: "c0000000-0000-0000-0000-000000000001",
  carrier: "b0000000-0000-0000-0000-000000000001",
  service: "d0000000-0000-0000-0000-000000000001",
  booking: "a0000000-0000-0000-0000-000000000099",
};

function bookingRecord() {
  return {
    bridgeCallId: "cm:booking:v1:call-1",
    authorizationReference: ids.authorization,
    freightRequestId: ids.request,
    offerId: ids.offer,
    carrierId: ids.carrier,
    matchingServiceId: ids.service,
    providerUrl: "/providers/andes",
    navigationUrl: `http://localhost:3000/providers/andes?serviceId=${ids.service}`,
    toolName: "book_freight",
    toolInput: {
      freight_request_id: ids.request,
      provider_offer_reference: "AND-OFF-8821",
      idempotency_key: "cm:booking:fr-1042:andes:1",
      authorization_context: {
        authorization_reference: ids.authorization,
        authorized_by: "HUMAN_SELECTION",
      },
      selection_mode: "ASSISTED",
    },
    toolOutput: {
      ok: true,
      data: {
        schemaVersion: "1.0",
        freightRequestId: ids.request,
        providerOfferReference: "AND-OFF-8821",
        providerReference: "AND-BOOK-66204226",
        providerBookingStatus: "PENDING_PROVIDER_CONFIRMATION",
        providerResponseDeadline: "2026-08-31T04:09:25.202Z",
        paymentRequired: false,
        paymentUrl: null,
        idempotentReplay: false,
      },
    },
  };
}

test("prepares only a valid server booking selection", () => {
  assert.deepEqual(parsePrepareBookingInput({
    freightRequestId: ids.request,
    offerId: ids.offer,
    selectionMode: "ASSISTED",
    bookingIdempotencyKey: "cm:booking:fr-1042:andes:1",
  }), {
    freightRequestId: ids.request,
    offerId: ids.offer,
    selectionMode: "ASSISTED",
    bookingIdempotencyKey: "cm:booking:fr-1042:andes:1",
  });
  assert.throws(() => parsePrepareBookingInput({ freightRequestId: ids.request, offerId: ids.offer, selectionMode: "AUTO" }));
});

test("requires the failed booking identity for a recovery selection", () => {
  const input = parsePrepareBookingRecoveryInput({
    freightRequestId: ids.request,
    offerId: ids.offer,
    selectionMode: "ASSISTED",
    bookingIdempotencyKey: "cm:booking:fr-1042:inca:recovery:1",
    replacesBookingId: ids.booking,
  });
  assert.equal(input.replacesBookingId, ids.booking);
  assert.throws(() => parsePrepareBookingRecoveryInput({
    freightRequestId: ids.request,
    offerId: ids.offer,
    selectionMode: "ASSISTED",
    bookingIdempotencyKey: "cm:booking:fr-1042:inca:recovery:1",
    replacesBookingId: "not-a-uuid",
  }));
});

test("accepts the A-04 book_freight envelope and correlates its authorization", () => {
  const record = parseRecordProviderBookingInput(bookingRecord());
  assert.equal(record.toolOutput.ok, true);
  assert.equal(record.toolInput.authorization_context.authorization_reference, ids.authorization);
});

test("does not accept a booking result for a different FreightRequest or an impossible payment URL", () => {
  const wrongRequest = bookingRecord();
  wrongRequest.toolInput.freight_request_id = "f2000000-0000-0000-0000-000000000099";
  assert.throws(() => parseRecordProviderBookingInput(wrongRequest));

  const wrongPayment = bookingRecord() as {
    toolOutput: { ok: true; data: { paymentUrl: string | null } };
  };
  wrongPayment.toolOutput.data.paymentUrl = "https://pay.example/checkout";
  assert.throws(() => parseRecordProviderBookingInput(wrongPayment));
});

test("accepts provider status events, including nullable location and REFUNDED", () => {
  const input = bookingRecord();
  const status = {
    ...input,
    bridgeCallId: "cm:booking:v1:status-1",
    bookingId: ids.booking,
    toolName: "get_provider_booking_status",
    toolInput: { provider_reference: "AND-BOOK-66204226" },
    toolOutput: {
      ok: true,
      data: {
        schemaVersion: "1.0",
        providerReference: "AND-BOOK-66204226",
        providerBookingStatus: "CONFIRMED",
        providerStatusReason: null,
        currentLocation: null,
        updatedEta: null,
        providerResponseDeadline: "2026-08-31T04:09:25.202Z",
        paymentStatus: "REFUNDED",
        events: [{
          providerEventId: "AND-EVENT-1",
          eventType: "BOOKING_CONFIRMED",
          providerBookingStatus: "CONFIRMED",
          occurredAt: "2026-08-31T01:00:00.000Z",
          location: null,
          description: "Provider confirmed the booking.",
        }],
      },
    },
  };
  const parsed = parseRecordProviderBookingStatusInput(status);
  assert.equal(parsed.toolOutput.ok && parsed.toolOutput.data.paymentStatus, "REFUNDED");
  assert.equal(parsed.toolOutput.ok && parsed.toolOutput.data.events[0]?.location, null);
});

test("requires the exact registered provider navigation URL", () => {
  const valid = `http://localhost:3000/providers/andes?serviceId=${ids.service}`;
  assert.doesNotThrow(() => assertProviderNavigation("/providers/andes", ids.service, valid, "http://localhost:3000"));
  assert.throws(() => assertProviderNavigation("/providers/andes", ids.service, `https://unrelated.example/providers/andes?serviceId=${ids.service}`, "http://localhost:3000"));
});

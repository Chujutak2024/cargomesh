import assert from "node:assert/strict";
import test from "node:test";

import {
  createBookingPreviewHref,
  getBookingUiFixture,
  resolveBookingOfferSet,
  resolveExplicitBookingUiScenario,
  resolveBookingUiScenario,
} from "./booking-ui-fixtures";

test("resolves booking states only from explicit fixture values", () => {
  assert.equal(resolveBookingUiScenario("confirmed"), "confirmed");
  assert.equal(resolveBookingUiScenario("no-response"), "no-response");
  assert.equal(resolveBookingUiScenario("unknown"), "booking-pending");
  assert.equal(resolveExplicitBookingUiScenario("expired"), "expired");
  assert.equal(resolveExplicitBookingUiScenario(undefined), null);
  assert.equal(resolveBookingOfferSet("zero"), "zero");
  assert.equal(resolveBookingOfferSet("four"), "four");
  assert.equal(resolveBookingOfferSet("unknown"), "three");
});

test("keeps booking fixtures variable for zero, one and N offers", () => {
  const zero = getBookingUiFixture({ requestCode: "FR-1042", scenario: "booking-pending", offerSet: "zero" });
  const one = getBookingUiFixture({ requestCode: "FR-1042", scenario: "booking-pending", offerSet: "one", offerId: "offer-demo-1" });
  const four = getBookingUiFixture({ requestCode: "FR-1042", scenario: "booking-pending", offerSet: "four", offerId: "offer-demo-4" });

  assert.equal(zero.availableOfferCount, 0);
  assert.equal(zero.selectedOffer, null);
  assert.equal(one.availableOfferCount, 1);
  assert.equal(one.selectedOffer?.offerId, "offer-demo-1");
  assert.equal(four.availableOfferCount, 4);
  assert.equal(four.selectedOffer?.offerId, "offer-demo-4");
});

test("never auto-selects a recommendation when the requested offer is absent", () => {
  const fixture = getBookingUiFixture({ requestCode: "FR-1042", scenario: "booking-pending", offerSet: "three" });
  assert.equal(fixture.selectedOffer, null);
  assert.equal(fixture.evidence.find((item) => item.key === "decision")?.payload.selectedOfferId, null);
});

test("creates a local booking preview URL without a booking id", () => {
  const href = createBookingPreviewHref("FR-1042", "offer-demo-2", "three");
  assert.equal(href, "/booking/FR-1042/status?scenario=booking-pending&offers=three&offer=offer-demo-2");
  assert.equal(href.includes("bookingId"), false);
});

test("represents every required visual state without inventing booking identifiers", () => {
  const scenarios = {
    "booking-pending": "BOOKING_PENDING",
    "pending-provider-confirmation": "PENDING_PROVIDER_CONFIRMATION",
    confirmed: "CONFIRMED",
    rejected: "REJECTED",
    expired: "EXPIRED",
    cancelled: "CANCELLED",
    "no-response": "NO_RESPONSE",
    recovery: "RECOVERY",
    error: "RECOVERABLE_ERROR",
  } as const;

  for (const [scenario, expectedStatus] of Object.entries(scenarios) as Array<[keyof typeof scenarios, string]>) {
    const fixture = getBookingUiFixture({ requestCode: "FR-1042", scenario, offerSet: "three", offerId: "offer-demo-1" });
    assert.equal("bookingId" in fixture, false);
    assert.equal(fixture.isFixture, true);
    assert.equal(fixture.status.code, expectedStatus);
  }
});

test("exposes recovery alternatives as fixture-only 0, 1 and N collections", () => {
  const zero = getBookingUiFixture({ requestCode: "FR-1042", scenario: "recovery", offerSet: "zero" });
  const one = getBookingUiFixture({ requestCode: "FR-1042", scenario: "rejected", offerSet: "one" });
  const four = getBookingUiFixture({ requestCode: "FR-1042", scenario: "recovery", offerSet: "four" });
  const pending = getBookingUiFixture({ requestCode: "FR-1042", scenario: "pending-provider-confirmation", offerSet: "four" });

  assert.equal(zero.showRecovery, true);
  assert.equal(zero.recoveryOptions.length, 0);
  assert.equal(one.recoveryOptions.length, 1);
  assert.equal(four.recoveryOptions.length, 4);
  assert.equal(pending.showRecovery, false);
  assert.equal(pending.recoveryOptions.length, 0);
  assert.equal("bookingId" in four.recoveryOptions[0], false);
});

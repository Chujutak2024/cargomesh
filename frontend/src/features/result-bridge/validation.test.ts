import assert from "node:assert/strict";
import test from "node:test";
import { ResultBridgeError } from "./contracts";
import { parseRecordProviderResultInput } from "./validation";

const BASE_INPUT = {
  toolCallId: "tool-call-1",
  orchestrationRunId: "90000000-0000-0000-0000-000000000001",
  freightRequestId: "f0000000-0000-0000-0000-000000000001",
  carrierId: "b0000000-0000-0000-0000-000000000001",
  providerUrl: "/providers/demo",
  toolName: "quote_freight",
  toolInput: { freight_request_id: "f0000000-0000-0000-0000-000000000001" },
  toolOutput: {
    ok: true,
    data: {
      schemaVersion: "1.0",
      freightRequestId: "f0000000-0000-0000-0000-000000000001",
      providerOfferReference: "DEMO-OFF-1",
      price: 1760,
      currency: "USD",
      priceBreakdown: { lineHaul: 1500, handling: 115, customsCoordination: 145 },
      estimatedPickup: "2026-08-30T12:00:00.000Z",
      estimatedDelivery: "2026-08-31T19:00:00.000Z",
      transitHours: 31,
      availableCapacityKg: 10000,
      availabilityClass: "AVAILABLE_IN_WINDOW",
      crossBorderSupported: true,
      customsCoordinationIncluded: true,
      requiredDocuments: ["commercial_invoice", "packing_list"],
      borderHandlingNotes: "Included",
      validUntil: "2026-08-30T18:00:00.000Z",
    },
  },
  startedAt: "2026-08-29T12:00:00.000Z",
  completedAt: "2026-08-29T12:00:00.120Z",
  schemaVersion: "1.0",
} as const;

test("accepts the frozen ProviderToolEnvelope<ProviderQuote> contract", () => {
  const parsed = parseRecordProviderResultInput(BASE_INPUT);
  assert.equal(parsed.toolName, "quote_freight");
  assert.equal(parsed.toolOutput.ok, true);
});

test("accepts a valid technical error envelope without creating fake quote data", () => {
  const parsed = parseRecordProviderResultInput({
    ...BASE_INPUT,
    toolOutput: {
      ok: false,
      error: { code: "PROVIDER_TIMEOUT", message: "Timed out", retryable: true },
    },
  });

  assert.equal(parsed.toolOutput.ok, false);
});

test("rejects a FreightRequest correlation mismatch", () => {
  assert.throws(
    () =>
      parseRecordProviderResultInput({
        ...BASE_INPUT,
        freightRequestId: "f0000000-0000-0000-0000-000000000099",
      }),
    (error) => error instanceof ResultBridgeError && error.code === "INVALID_PROVIDER_RESULT",
  );
});

test("rejects unsafe provider URLs and malformed commercial totals", () => {
  assert.throws(() => parseRecordProviderResultInput({ ...BASE_INPUT, providerUrl: "//evil.com" }));
  assert.throws(() =>
    parseRecordProviderResultInput({
      ...BASE_INPUT,
      toolOutput: {
        ...BASE_INPUT.toolOutput,
        data: { ...BASE_INPUT.toolOutput.data, price: 999 },
      },
    }),
  );
});

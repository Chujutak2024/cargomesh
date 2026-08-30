import assert from "node:assert/strict";
import test from "node:test";
import { ResultBridgeError } from "./contracts";
import { parseRecordProviderResultInput } from "./validation";

const CARGOMESH_ORIGIN = "http://localhost:3000";

function parse(input: unknown) {
  return parseRecordProviderResultInput(input, CARGOMESH_ORIGIN);
}

const BASE_INPUT = {
  toolCallId:
    "cm:int02a:v1:90000000-0000-0000-0000-000000000001:f0000000-0000-0000-0000-000000000001:b0000000-0000-0000-0000-000000000001:40000000-0000-4000-8000-000000000001:quote_freight:1",
  orchestrationRunId: "90000000-0000-0000-0000-000000000001",
  freightRequestId: "f0000000-0000-0000-0000-000000000001",
  carrierId: "b0000000-0000-0000-0000-000000000001",
  matchingServiceId: "40000000-0000-4000-8000-000000000001",
  providerUrl: "/providers/demo",
  navigationUrl:
    "http://localhost:3000/providers/demo?serviceId=40000000-0000-4000-8000-000000000001",
  toolName: "quote_freight",
  attemptNumber: 1,
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
  durationMs: 120,
  status: "COMPLETED",
  technicalError: null,
  schemaVersion: "1.0",
} as const;

test("accepts the frozen ProviderToolEnvelope<ProviderQuote> contract", () => {
  const parsed = parse(BASE_INPUT);
  assert.equal(parsed.toolName, "quote_freight");
  assert.equal(parsed.toolOutput?.ok, true);
});

test("accepts a valid technical error envelope without creating fake quote data", () => {
  const parsed = parse({
    ...BASE_INPUT,
    status: "TECHNICAL_ERROR",
    technicalError: { code: "PROVIDER_TIMEOUT", message: "Timed out", retryable: true },
    toolOutput: {
      ok: false,
      error: { code: "PROVIDER_TIMEOUT", message: "Timed out", retryable: true },
    },
  });

  assert.equal(parsed.toolOutput?.ok, false);
});

test("accepts a nullable output for a technical WebMCP failure", () => {
  const parsed = parse({
    ...BASE_INPUT,
    status: "TECHNICAL_ERROR",
    technicalError: { code: "WEBMCP_EXECUTION_FAILED", message: "Browser failed", retryable: true },
    toolOutput: null,
  });

  assert.equal(parsed.status, "TECHNICAL_ERROR");
  assert.equal(parsed.toolOutput, null);
});

test("accepts coverage and capacity records without fabricating offers", () => {
  const coverage = parse({
    ...BASE_INPUT,
    toolCallId: BASE_INPUT.toolCallId.replace("quote_freight", "check_service_coverage"),
    toolName: "check_service_coverage",
    toolInput: {
      origin: "Callao, PE",
      destination: "Santiago, CL",
      transport_mode: "ROAD",
      service_type: "FTL",
      cargo_category: "GENERAL",
    },
    toolOutput: {
      ok: true,
      data: {
        schemaVersion: "1.0",
        providerServiceCode: "DEMO-FTL",
        supported: true,
        crossBorderSupported: true,
        corridor: { origin: "Callao, PE", destination: "Santiago, CL" },
        customsCoordinationAvailable: true,
        serviceNotes: ["Compatible"],
      },
    },
  });
  assert.equal(coverage.toolName, "check_service_coverage");

  const capacity = parse({
    ...BASE_INPUT,
    toolCallId: BASE_INPUT.toolCallId.replace("quote_freight", "check_capacity"),
    toolName: "check_capacity",
    toolInput: {
      origin: "Callao, PE",
      destination: "Santiago, CL",
      cargo_weight_kg: 8000,
      cargo_category: "GENERAL",
      pickup_mode: "ASAP",
    },
    toolOutput: {
      ok: true,
      data: {
        schemaVersion: "1.0",
        providerServiceCode: "DEMO-FTL",
        available: true,
        availabilityClass: "AVAILABLE_IN_WINDOW",
        availableCapacityKg: 12000,
        availableVolumeM3: 48,
        earliestPickup: "2026-08-30T12:00:00.000Z",
        requestedWindowAvailable: true,
        reportedVehicleType: "TRACTO",
        estimatedDelivery: "2026-08-31T12:00:00.000Z",
        capabilityNotes: ["Available"],
      },
    },
  });
  assert.equal(capacity.toolName, "check_capacity");
});

test("rejects a canonical toolCallId or navigation service mismatch", () => {
  assert.throws(() => parse({ ...BASE_INPUT, toolCallId: "tool-call-1" }));
  assert.throws(() =>
    parse({
      ...BASE_INPUT,
      navigationUrl:
        "http://localhost:3000/providers/demo?serviceId=40000000-0000-4000-8000-000000000099",
    }),
  );
});

test("accepts an HTTPS provider page when it preserves registered base parameters", () => {
  const parsed = parse({
    ...BASE_INPUT,
    providerUrl: "https://provider.example/quote?account=registered&locale=es",
    navigationUrl:
      "https://provider.example/quote?account=registered&locale=es&serviceId=40000000-0000-4000-8000-000000000001",
  });

  assert.equal(
    parsed.navigationUrl,
    "https://provider.example/quote?account=registered&locale=es&serviceId=40000000-0000-4000-8000-000000000001",
  );
});

test("rejects navigation URLs that do not belong to the discovered provider", () => {
  assert.throws(() =>
    parse({
      ...BASE_INPUT,
      navigationUrl:
        "https://unrelated.example/providers/demo?serviceId=40000000-0000-4000-8000-000000000001",
    }),
  );
  assert.throws(() =>
    parse({
      ...BASE_INPUT,
      navigationUrl:
        "http://localhost:3000/providers/other?serviceId=40000000-0000-4000-8000-000000000001",
    }),
  );
  assert.throws(() =>
    parse({
      ...BASE_INPUT,
      navigationUrl:
        "http://localhost:3000/providers/demo?serviceId=40000000-0000-4000-8000-000000000001&serviceId=40000000-0000-4000-8000-000000000001",
    }),
  );
  assert.throws(() =>
    parse({
      ...BASE_INPUT,
      providerUrl: "https://provider.example/quote?account=registered",
      navigationUrl:
        "https://provider.example/quote?account=altered&serviceId=40000000-0000-4000-8000-000000000001",
    }),
  );
});

test("rejects a ProviderQuote FreightRequest correlation mismatch", () => {
  assert.throws(
    () =>
      parse({
        ...BASE_INPUT,
        toolOutput: {
          ...BASE_INPUT.toolOutput,
          data: {
            ...BASE_INPUT.toolOutput.data,
            freightRequestId: "f0000000-0000-0000-0000-000000000099",
          },
        },
      }),
    (error) => error instanceof ResultBridgeError && error.code === "INVALID_PROVIDER_RESULT",
  );
});

test("rejects a quote_freight toolInput correlated to another FreightRequest", () => {
  assert.throws(
    () =>
      parse({
        ...BASE_INPUT,
        toolInput: { freight_request_id: "f0000000-0000-0000-0000-000000000099" },
      }),
    (error) =>
      error instanceof ResultBridgeError &&
      error.code === "INVALID_PROVIDER_RESULT" &&
      /toolInput\.freight_request_id/.test(error.message),
  );
});

test("rejects unsafe provider URLs and malformed commercial totals", () => {
  assert.throws(() => parse({ ...BASE_INPUT, providerUrl: "//evil.com" }));
  assert.throws(() =>
    parse({
      ...BASE_INPUT,
      toolOutput: {
        ...BASE_INPUT.toolOutput,
        data: { ...BASE_INPUT.toolOutput.data, price: 999 },
      },
    }),
  );
});

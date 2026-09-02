import assert from "node:assert/strict";
import test from "node:test";

import { createCheckCapacityTool, type CapacityResult } from "@/features/providers/check-capacity-tool";
import type { ProviderPageConfig, ProviderQuote, ProviderToolEnvelope } from "@/features/providers/contracts";
import { createQuoteFreightTool } from "@/features/providers/quote-freight-tool";
import { parseFreightRequestExecutionIntent } from "@/features/freight-requests/execution-intent-contracts";
import { createFreightIntakeFixture } from "./ui-fixtures";
import {
  applyExecutionIntentToIntake,
  buildProviderRunnerInputs,
  buildRealDispatchPath,
  createInt02aIdempotencyKey,
} from "./int02a-client";

const referenceDate = new Date(2026, 7, 30, 10);
const freightIntakeFixture = createFreightIntakeFixture(referenceDate);
const persistedIntent = parseFreightRequestExecutionIntent({
  schemaVersion: "1.0",
  freightRequestId: freightIntakeFixture.freightRequestId,
  requestCode: "FR-1042",
  status: "PENDING",
  pickupMode: "SCHEDULED",
  requiredPickup: "2026-08-31T13:00:00+00:00",
  pickupWindowStart: "2026-08-31T13:00:00+00:00",
  pickupWindowEnd: "2026-08-31T17:00:00+00:00",
  deliveryDeadline: "2026-09-03T13:00:00+00:00",
  updatedAt: "2026-08-30T20:00:00+00:00",
});

const andesProvider: ProviderPageConfig = {
  carrierId: "carrier-a",
  carrierCode: "ANDES_FIXTURE",
  displayName: "Andes Freight",
  providerUrl: "/providers/andes",
  matchingServiceId: "service-a",
  service: {
    providerServiceCode: "ANDES-PECL-FTL",
    transportMode: "ROAD",
    serviceType: "FTL",
    maxCapacityKg: 18_000,
    maxVolumeM3: 80,
    supportsCrossBorder: true,
  },
};

test("maps the B-02 intake into the public INT-02A runner inputs", () => {
  const inputs = buildProviderRunnerInputs(freightIntakeFixture, persistedIntent);

  assert.equal(inputs.check_service_coverage.transport_mode, "ROAD");
  assert.equal(inputs.check_service_coverage.service_type, "FTL");
  assert.equal(inputs.check_capacity.cargo_weight_kg, 8_000);
  assert.equal(inputs.check_capacity.cargo_volume_m3, 18);
  assert.equal(inputs.quote_freight.freight_request_id, freightIntakeFixture.freightRequestId);
  assert.deepEqual(inputs.quote_freight.available_documents, freightIntakeFixture.documents);
});

test("uses canonical totals instead of rebuilding them from optional entry fields", () => {
  const inputs = buildProviderRunnerInputs({
    ...freightIntakeFixture,
    quantity: 2,
    unitsPerEntry: 3,
    unitWeightKg: 4,
    lengthCm: 5,
    widthCm: 6,
    heightCm: 7,
    totalWeightKg: 1_234,
    totalVolumeM3: 9.5,
  }, persistedIntent);

  assert.equal(inputs.check_capacity.cargo_weight_kg, 1_234);
  assert.equal(inputs.check_capacity.cargo_volume_m3, 9.5);
  assert.equal(inputs.quote_freight.cargo_weight_kg, 1_234);
  assert.equal(inputs.quote_freight.cargo_volume_m3, 9.5);
});

test("rejects an incomplete SCHEDULED pickup window", () => {
  assert.throws(
    () => buildProviderRunnerInputs(
      freightIntakeFixture,
      { ...persistedIntent, pickupWindowEnd: null },
    ),
    /SCHEDULED requiere inicio y fin/,
  );
});

test("uses the persisted FR-1042 reset window and deadline", () => {
  const inputs = buildProviderRunnerInputs(freightIntakeFixture, persistedIntent);

  assert.equal(inputs.check_capacity.pickup_mode, persistedIntent.pickupMode);
  assert.equal(inputs.check_capacity.pickup_window_start, persistedIntent.pickupWindowStart);
  assert.equal(inputs.check_capacity.pickup_window_end, persistedIntent.pickupWindowEnd);
  assert.equal(inputs.check_capacity.delivery_deadline, persistedIntent.deliveryDeadline);
  assert.equal(inputs.quote_freight.pickup_window_end, inputs.check_capacity.pickup_window_end);
  assert.equal(inputs.quote_freight.delivery_deadline, inputs.check_capacity.delivery_deadline);
});

test("server intent prevails when the browser day and timezone differ", () => {
  const intentAcrossDayBoundary = parseFreightRequestExecutionIntent({
    ...persistedIntent,
    requiredPickup: "2026-09-01T00:30:00+14:00",
    pickupWindowStart: "2026-09-01T00:30:00+14:00",
    pickupWindowEnd: "2026-09-01T04:30:00+14:00",
    deliveryDeadline: "2026-09-04T00:30:00+14:00",
  });
  const browserModel = {
    ...freightIntakeFixture,
    pickupWindowStart: "2030-01-01T08:00",
    pickupWindowEnd: "2030-01-01T12:00",
    deliveryDeadline: "2030-01-04T08:00",
  };
  const synchronizedModel = applyExecutionIntentToIntake(
    browserModel,
    intentAcrossDayBoundary,
  );
  const inputs = buildProviderRunnerInputs(browserModel, intentAcrossDayBoundary);

  assert.deepEqual(
    {
      pickupMode: synchronizedModel.pickupMode,
      requiredPickup: synchronizedModel.requiredPickup,
      pickupWindowStart: synchronizedModel.pickupWindowStart,
      pickupWindowEnd: synchronizedModel.pickupWindowEnd,
      deliveryDeadline: synchronizedModel.deliveryDeadline,
    },
    {
      pickupMode: intentAcrossDayBoundary.pickupMode,
      requiredPickup: intentAcrossDayBoundary.requiredPickup,
      pickupWindowStart: intentAcrossDayBoundary.pickupWindowStart,
      pickupWindowEnd: intentAcrossDayBoundary.pickupWindowEnd,
      deliveryDeadline: intentAcrossDayBoundary.deliveryDeadline,
    },
  );
  assert.equal(inputs.check_capacity.pickup_window_start, "2026-08-31T10:30:00.000Z");
  assert.equal(inputs.check_capacity.pickup_window_end, "2026-08-31T14:30:00.000Z");
  assert.equal(inputs.check_capacity.delivery_deadline, "2026-09-03T10:30:00.000Z");
  assert.notEqual(inputs.check_capacity.pickup_window_start, browserModel.pickupWindowStart);
});

test("produces an eligible capacity and quote for the FR-1042 demo window", async () => {
  const inputs = buildProviderRunnerInputs(freightIntakeFixture, persistedIntent);
  const signal = new AbortController().signal;
  const capacity = await createCheckCapacityTool(andesProvider).execute(inputs.check_capacity, { signal }) as ProviderToolEnvelope<CapacityResult>;
  const quote = await createQuoteFreightTool(andesProvider, { now: () => referenceDate }).execute(inputs.quote_freight, { signal }) as ProviderToolEnvelope<ProviderQuote>;

  if (!capacity.ok) assert.fail(capacity.error.message);
  assert.equal(capacity.ok, true);
  assert.equal(capacity.data.available, true);
  if (!quote.ok) assert.fail(quote.error.message);
  assert.equal(quote.ok, true);
  assert.ok(Date.parse(quote.data.estimatedDelivery) <= Date.parse(inputs.quote_freight.delivery_deadline!));
});

test("creates a new idempotency key for each real submission", () => {
  const first = createInt02aIdempotencyKey(freightIntakeFixture.freightRequestId);
  const second = createInt02aIdempotencyKey(freightIntakeFixture.freightRequestId);

  assert.notEqual(first, second);
  assert.match(first, /^cm:int02b:[0-9a-f-]+:[0-9a-f-]+$/i);
  assert.ok(first.length <= 200);
});

test("builds the real dispatch URL from runId without forcing a fixture", () => {
  const runId = "90000000-0000-0000-0000-000000000001";
  const path = buildRealDispatchPath(runId);

  assert.equal(path, `/dispatch/${runId}`);
  assert.equal(path.includes("scenario="), false);
});

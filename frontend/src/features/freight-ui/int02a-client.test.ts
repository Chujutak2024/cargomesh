import assert from "node:assert/strict";
import test from "node:test";

import { createCheckCapacityTool, type CapacityResult } from "@/features/providers/check-capacity-tool";
import type { ProviderPageConfig, ProviderQuote, ProviderToolEnvelope } from "@/features/providers/contracts";
import { createQuoteFreightTool } from "@/features/providers/quote-freight-tool";
import { createFreightIntakeFixture, createFr1042DemoSchedule } from "./ui-fixtures";
import {
  buildProviderRunnerInputs,
  buildRealDispatchPath,
  createInt02aIdempotencyKey,
} from "./int02a-client";

const referenceDate = new Date(2026, 7, 30, 10);
const freightIntakeFixture = createFreightIntakeFixture(referenceDate);

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
  const inputs = buildProviderRunnerInputs(freightIntakeFixture);

  assert.equal(inputs.check_service_coverage.transport_mode, "ROAD");
  assert.equal(inputs.check_service_coverage.service_type, "FTL");
  assert.equal(inputs.check_capacity.cargo_weight_kg, 8_000);
  assert.equal(inputs.check_capacity.cargo_volume_m3, 18);
  assert.equal(inputs.quote_freight.freight_request_id, freightIntakeFixture.freightRequestId);
  assert.deepEqual(inputs.quote_freight.available_documents, freightIntakeFixture.documents);
});

test("rejects an incomplete SCHEDULED pickup window", () => {
  assert.throws(
    () => buildProviderRunnerInputs({ ...freightIntakeFixture, pickupWindowEnd: "" }),
    /SCHEDULED requiere inicio y fin/,
  );
});

test("builds the documented FR-1042 reset window and deadline", () => {
  const schedule = createFr1042DemoSchedule(referenceDate);
  const inputs = buildProviderRunnerInputs(freightIntakeFixture);

  assert.deepEqual(schedule, {
    pickupWindowStart: "2026-08-31T13:00",
    pickupWindowEnd: "2026-08-31T17:00",
    deliveryDeadline: "2026-09-03T13:00",
  });
  assert.ok(Date.parse(inputs.check_capacity.pickup_window_end!) > Date.parse(inputs.check_capacity.pickup_window_start!));
  assert.ok(Date.parse(inputs.check_capacity.delivery_deadline!) > Date.parse(inputs.check_capacity.pickup_window_end!));
  assert.equal(inputs.quote_freight.pickup_window_end, inputs.check_capacity.pickup_window_end);
  assert.equal(inputs.quote_freight.delivery_deadline, inputs.check_capacity.delivery_deadline);
});

test("produces an eligible capacity and quote for the FR-1042 demo window", async () => {
  const inputs = buildProviderRunnerInputs(freightIntakeFixture);
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

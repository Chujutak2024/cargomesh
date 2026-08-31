import assert from "node:assert/strict";
import test from "node:test";

import { freightIntakeFixture } from "./ui-fixtures";
import {
  buildProviderRunnerInputs,
  buildRealDispatchPath,
  createInt02aIdempotencyKey,
} from "./int02a-client";

test("maps the B-02 intake into the public INT-02A runner inputs", () => {
  const inputs = buildProviderRunnerInputs(freightIntakeFixture);

  assert.equal(inputs.check_service_coverage.transport_mode, "ROAD");
  assert.equal(inputs.check_service_coverage.service_type, "FTL");
  assert.equal(inputs.check_capacity.cargo_weight_kg, 8_000);
  assert.equal(inputs.check_capacity.cargo_volume_m3, 18);
  assert.equal(inputs.quote_freight.freight_request_id, freightIntakeFixture.freightRequestId);
  assert.deepEqual(inputs.quote_freight.available_documents, freightIntakeFixture.documents);
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

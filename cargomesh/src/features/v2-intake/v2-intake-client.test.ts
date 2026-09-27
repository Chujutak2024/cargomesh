import assert from "node:assert/strict";
import test from "node:test";

import { INTAKE_OPTIONS_FIXTURE } from "./fixtures/intake-options.fixture";
import {
  ELIGIBLE_UNKNOWN_EVALUATION_FIXTURE,
  ROAD_REQUEST_FIXTURE,
} from "./fixtures/contract-flow.fixture";
import {
  V2IntakeApiError,
  createFreightRequestV2,
  getFreightRequestV2,
  getRoadServiceabilityV2,
  loadIntakeOptions,
} from "./v2-intake-client";
import { mapDraftToCreateFreightRequestV2Input, PROVISIONAL_PROTOTYPE_DRAFT } from "./prototype-model";

const json = (value: unknown, init: ResponseInit = {}) => new Response(JSON.stringify(value), {
  status: 200,
  headers: { "Content-Type": "application/json" },
  ...init,
});

test("GET intake options uses the API response when every selector is covered", async () => {
  let requested = "";
  const result = await loadIntakeOptions(async (input, init) => {
    requested = String(input);
    assert.equal(init?.method, "GET");
    assert.equal(init?.credentials, "same-origin");
    return json(INTAKE_OPTIONS_FIXTURE);
  });
  assert.equal(requested, "/api/v2/intake/options");
  assert.equal(result.source, "api");
  assert.equal(result.fallbackReason, null);
});

test("GET intake options falls back explicitly when the route is absent", async () => {
  const result = await loadIntakeOptions(async () => json({ error: { code: "NOT_FOUND", message: "missing" } }, { status: 404 }));
  assert.equal(result.source, "fixture");
  assert.equal(result.fallbackReason, "NOT_FOUND");
  assert.equal(result.options.meta?.provenanceStatus, "SIMULATED");
});

test("a non-JSON 404 is reported as HTTP_404 instead of a JSON contract failure", async () => {
  const result = await loadIntakeOptions(async () => new Response("Not Found", { status: 404 }));
  assert.equal(result.source, "fixture");
  assert.equal(result.fallbackReason, "HTTP_404");
});

test("POST sends one idempotency key and no client authorization tenant", async () => {
  const payload = mapDraftToCreateFreightRequestV2Input(PROVISIONAL_PROTOTYPE_DRAFT, INTAKE_OPTIONS_FIXTURE.data);
  const response = await createFreightRequestV2(payload, "4bb8037c-4bc4-4e74-bf92-f9a2b1491e9c", async (input, init) => {
    assert.equal(String(input), "/api/v2/freight/requests");
    assert.equal(init?.method, "POST");
    assert.equal(new Headers(init?.headers).get("Idempotency-Key"), "4bb8037c-4bc4-4e74-bf92-f9a2b1491e9c");
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    assert.equal("organizationId" in body, false);
    return json({ schemaVersion: "2.0", data: ROAD_REQUEST_FIXTURE }, { status: 201 });
  });
  assert.equal(response.data.status, "DRAFT");
  assert.equal(response.data.draftVersion, 1);
});

test("GET performs a request round-trip with same-origin authentication", async () => {
  const response = await getFreightRequestV2(ROAD_REQUEST_FIXTURE.id, async (input, init) => {
    assert.equal(String(input), `/api/v2/freight/requests/${ROAD_REQUEST_FIXTURE.id}`);
    assert.equal(init?.credentials, "same-origin");
    return json({ schemaVersion: "2.0", data: ROAD_REQUEST_FIXTURE });
  });
  assert.equal(response.data.referenceCode, ROAD_REQUEST_FIXTURE.referenceCode);
});

test("serviceability GET includes expectedDraftVersion and remains read-only", async () => {
  const response = await getRoadServiceabilityV2(ROAD_REQUEST_FIXTURE.id, 1, async (input, init) => {
    assert.equal(String(input), `/api/v2/freight/requests/${ROAD_REQUEST_FIXTURE.id}/serviceability?expectedDraftVersion=1`);
    assert.equal(init?.method, "GET");
    assert.equal(init?.body, undefined);
    return json({ schemaVersion: "2.0", data: ELIGIBLE_UNKNOWN_EVALUATION_FIXTURE });
  });
  assert.equal(response.data.commercialNotice, "EVALUATION_ONLY_NO_OFFER_OR_BOOKING");
});

test("a legacy or malformed success envelope is rejected instead of treated as V2", async () => {
  const payload = mapDraftToCreateFreightRequestV2Input(PROVISIONAL_PROTOTYPE_DRAFT, INTAKE_OPTIONS_FIXTURE.data);
  await assert.rejects(
    createFreightRequestV2(payload, "key", async () => json({ data: { requestCode: "FR-1042" } }, { status: 201 })),
    (error: unknown) => error instanceof V2IntakeApiError && error.code === "CONTRACT_MISMATCH",
  );
});

test("standard V2 API errors preserve code, status, and retryability", async () => {
  await assert.rejects(
    getFreightRequestV2("missing", async () => json({
      schemaVersion: "2.0",
      error: { code: "REQUEST_NOT_FOUND", message: "Not found", retryable: false },
    }, { status: 404 })),
    (error: unknown) => error instanceof V2IntakeApiError
      && error.code === "REQUEST_NOT_FOUND"
      && error.status === 404
      && error.retryable === false,
  );
});

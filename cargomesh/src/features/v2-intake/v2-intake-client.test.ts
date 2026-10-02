import assert from "node:assert/strict";
import test from "node:test";

import { INTAKE_OPTIONS_FIXTURE } from "./fixtures/intake-options.fixture";
import {
  ELIGIBLE_UNKNOWN_EVALUATION_FIXTURE,
  ROAD_REQUEST_FIXTURE,
} from "./fixtures/contract-flow.fixture";
import { parseIntakeOptionsResponse } from "./intake-options";
import {
  V2IntakeApiError,
  assertFreightRequestRoundTrip,
  assertServiceabilityCorrelation,
  createFreightRequestV2,
  getFreightRequestV2,
  getRoadServiceabilityV2,
  loadIntakeOptions,
  reconcileCandidateSelection,
} from "./v2-intake-client";
import { mapDraftToCreateFreightRequestV2Input, PROVISIONAL_PROTOTYPE_DRAFT } from "./prototype-model";

const json = (value: unknown, init: ResponseInit = {}) => new Response(JSON.stringify(value), {
  status: 200,
  headers: { "Content-Type": "application/json" },
  ...init,
});

const requestEnvelope = (data = ROAD_REQUEST_FIXTURE) => ({
  schemaVersion: "2.0" as const,
  data,
  meta: { idempotentReplay: false, environmentProfile: "v2-clean" as const },
});

test("GET maps the real five-group contract into selector codes", async () => {
  let requested = "";
  const result = await loadIntakeOptions(async (input, init) => {
    requested = String(input);
    assert.equal(init?.method, "GET");
    assert.equal(init?.credentials, "same-origin");
    return json(INTAKE_OPTIONS_FIXTURE);
  }, "api");
  assert.equal(requested, "/api/v2/intake/options");
  assert.equal(result.source, "api");
  assert.equal(result.fixtureReason, null);
  assert.equal(result.options.data.facilities[0].facilityId, INTAKE_OPTIONS_FIXTURE.data.facilities[0].id);
  assert.equal(result.options.data.cargoCategories[2].code, "PHARMA");
  assert.equal(result.options.data.equipmentOptions[0].code, "REEFER_TRUCK");
  assert.equal(result.options.data.packagingOptions[0].verification, "CAPTURE_ONLY");
  assert.equal(result.options.data.requirementOptions[2].verification, "REQUIRES_REVIEW");
});

test("parser preserves HAC-12 guidance objects for all eight cargo categories", () => {
  const parsed = parseIntakeOptionsResponse(structuredClone(INTAKE_OPTIONS_FIXTURE));
  assert.ok(parsed);
  assert.deepEqual(
    parsed.data.cargoCategories.map((category) => category.code),
    ["GENERAL", "FOOD", "PHARMA", "CHEMICAL", "MACHINERY", "CONSTRUCTION", "AGRICULTURAL", "LIQUID"],
  );
  assert.deepEqual(
    parsed.data.cargoCategories[2].guidance,
    INTAKE_OPTIONS_FIXTURE.data.cargoCategories[2].guidance,
  );
  assert.deepEqual(parsed.data.cargoCategories[2].guidance, {
    recommendedEntryMethods: ["PACKAGES", "PALLETS", "LOTS"],
    intakeSpecificationSchema: {
      fields: ["temperature_min_c", "temperature_max_c", "lot_number", "expiration_date", "handling_protocol"],
    },
    suggestedRequirements: {
      requires_temperature_validation: true,
      suggest_fragile: true,
      suggest_high_value: true,
    },
    recommendedVehicleClasses: ["REFRIGERATED_TRUCK", "SECURE_BOX_TRUCK"],
  });

  const obsolete = structuredClone(INTAKE_OPTIONS_FIXTURE) as unknown as {
    data: { cargoCategories: Array<{ guidance: unknown }> };
  };
  obsolete.data.cargoCategories[0].guidance = "legacy string guidance";
  assert.equal(parseIntakeOptionsResponse(obsolete), null);
});

test("facilities: [] is a valid authenticated empty state", async () => {
  const response = structuredClone(INTAKE_OPTIONS_FIXTURE);
  response.data.facilities = [];
  const result = await loadIntakeOptions(async () => json(response), "api");
  assert.equal(result.source, "api");
  assert.deepEqual(result.options.data.facilities, []);
});

for (const [status, code] of [[401, "UNAUTHORIZED"], [403, "FORBIDDEN_TENANT"]] as const) {
  test(`${status} ${code} is exposed and never replaced by the fixture`, async () => {
    await assert.rejects(
      loadIntakeOptions(async () => json({
        schemaVersion: "2.0",
        error: { code, message: code, retryable: false },
      }, { status }), "api"),
      (error: unknown) => error instanceof V2IntakeApiError
        && error.code === code
        && error.status === status,
    );
  });
}

test("an incomplete options contract is exposed instead of activating the fixture", async () => {
  const incomplete = structuredClone(INTAKE_OPTIONS_FIXTURE) as unknown as { data: Record<string, unknown> };
  delete incomplete.data.requirementOptions;
  await assert.rejects(
    loadIntakeOptions(async () => json(incomplete), "api"),
    (error: unknown) => error instanceof V2IntakeApiError && error.code === "OPTIONS_CONTRACT_MISMATCH",
  );
});

test("a network failure is exposed instead of activating the fixture", async () => {
  await assert.rejects(
    loadIntakeOptions(async () => { throw new TypeError("fetch failed"); }, "api"),
    (error: unknown) => error instanceof V2IntakeApiError
      && error.code === "NETWORK_ERROR"
      && error.retryable,
  );
});

test("the simulated fixture requires an explicit development source mode", async () => {
  let called = false;
  const result = await loadIntakeOptions(async () => {
    called = true;
    throw new Error("should not fetch");
  }, "development-fixture");
  assert.equal(called, false);
  assert.equal(result.source, "fixture");
  assert.equal(result.fixtureReason, "EXPLICIT_DEVELOPMENT_FIXTURE");
  assert.equal(result.options.meta?.provenanceStatus, "SIMULATED");
});

test("a non-JSON 404 is reported as HTTP_404", async () => {
  await assert.rejects(
    loadIntakeOptions(async () => new Response("Not Found", { status: 404 }), "api"),
    (error: unknown) => error instanceof V2IntakeApiError && error.code === "HTTP_404",
  );
});

test("GET selection maps backend codes into the POST without client tenant authorization", async () => {
  const loaded = await loadIntakeOptions(async () => json(INTAKE_OPTIONS_FIXTURE), "api");
  const payload = mapDraftToCreateFreightRequestV2Input(PROVISIONAL_PROTOTYPE_DRAFT, loaded.options.data);
  const response = await createFreightRequestV2(payload, "4bb8037c-4bc4-4e74-bf92-f9a2b1491e9c", async (input, init) => {
    assert.equal(String(input), "/api/v2/freight/requests");
    assert.equal(init?.method, "POST");
    assert.equal(new Headers(init?.headers).get("Idempotency-Key"), "4bb8037c-4bc4-4e74-bf92-f9a2b1491e9c");
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    assert.equal("organizationId" in body, false);
    assert.equal((body.origin as { facilityId: string }).facilityId, INTAKE_OPTIONS_FIXTURE.data.facilities[0].id);
    assert.equal((body.cargoSpecification as { categoryCode: string; packaging: string }).categoryCode, "PHARMA");
    assert.equal((body.cargoSpecification as { categoryCode: string; packaging: string }).packaging, "PALLET");
    assert.equal(body.requiredEquipment, "REEFER_TRUCK");
    return json(requestEnvelope(), { status: 201 });
  });
  assert.equal(response.data.status, "DRAFT");
  assert.equal(response.data.draftVersion, 1);
});

test("GET performs a request round-trip with same-origin authentication", async () => {
  const response = await getFreightRequestV2(ROAD_REQUEST_FIXTURE.id, async (input, init) => {
    assert.equal(String(input), `/api/v2/freight/requests/${ROAD_REQUEST_FIXTURE.id}`);
    assert.equal(init?.credentials, "same-origin");
    return json(requestEnvelope());
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

test("POST, GET, and serviceability remain correlated to one request version", () => {
  assert.doesNotThrow(() => assertFreightRequestRoundTrip(ROAD_REQUEST_FIXTURE, structuredClone(ROAD_REQUEST_FIXTURE)));
  assert.doesNotThrow(() => assertServiceabilityCorrelation(ROAD_REQUEST_FIXTURE, ELIGIBLE_UNKNOWN_EVALUATION_FIXTURE));

  assert.throws(
    () => assertFreightRequestRoundTrip(ROAD_REQUEST_FIXTURE, { ...ROAD_REQUEST_FIXTURE, draftVersion: 2 }),
    (error: unknown) => error instanceof V2IntakeApiError && error.code === "REQUEST_CORRELATION_MISMATCH",
  );
  assert.throws(
    () => assertServiceabilityCorrelation(ROAD_REQUEST_FIXTURE, {
      ...ELIGIBLE_UNKNOWN_EVALUATION_FIXTURE,
      evaluatedDraftVersion: 2,
    }),
    (error: unknown) => error instanceof V2IntakeApiError && error.code === "SERVICEABILITY_CORRELATION_MISMATCH",
  );
});

test("card and map selection share one candidate id across refreshed evaluations", () => {
  assert.equal(reconcileCandidateSelection("cand-road-02", ELIGIBLE_UNKNOWN_EVALUATION_FIXTURE), "cand-road-02");
  assert.equal(reconcileCandidateSelection("removed", ELIGIBLE_UNKNOWN_EVALUATION_FIXTURE), "cand-road-01");
  assert.equal(reconcileCandidateSelection("removed", {
    ...ELIGIBLE_UNKNOWN_EVALUATION_FIXTURE,
    overallStatus: "ineligible",
    candidates: [],
    summaryCounts: { totalEvaluated: 0, eligibleCount: 0, unknownCount: 0, ineligibleCount: 0 },
  }), null);
});

test("a legacy or malformed success envelope is rejected instead of treated as V2", async () => {
  const loaded = await loadIntakeOptions(async () => json(INTAKE_OPTIONS_FIXTURE), "api");
  const payload = mapDraftToCreateFreightRequestV2Input(PROVISIONAL_PROTOTYPE_DRAFT, loaded.options.data);
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

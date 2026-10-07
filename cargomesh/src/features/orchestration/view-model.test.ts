import assert from "node:assert/strict";
import test from "node:test";
import { buildOrchestrationViewModel, type ViewModelSource } from "./view-model";

const RUN_ID = "90000000-0000-0000-0000-000000000001";
const REQUEST_ID = "f2000000-0000-0000-0000-000000000001";
const CARRIER_ID = "b0000000-0000-0000-0000-000000000001";
const SERVICE_ID = "d0000000-0000-0000-0000-000000000001";

const candidate = {
  carrierId: CARRIER_ID,
  carrierCode: "GENERIC-CARRIER",
  displayName: "Generic Carrier",
  providerUrl: "/providers/generic-carrier",
  matchingServiceId: SERVICE_ID,
};

function source(overrides: Partial<ViewModelSource> = {}): ViewModelSource {
  return {
    run: {
      id: RUN_ID,
      freight_request_id: REQUEST_ID,
      status: "RUNNING",
      started_at: "2026-08-30T12:00:00.000Z",
      completed_at: null,
      error_code: null,
      error_message: null,
      candidate_snapshot: [candidate],
      result_snapshot: null,
    },
    freightRequest: { id: REQUEST_ID, code: "FR-1042", organization_id: "org-1" },
    events: [],
    offers: [],
    ...overrides,
  } as ViewModelSource;
}

test("loading preserves the immutable candidate snapshot as PENDING", () => {
  const result = buildOrchestrationViewModel(source());

  assert.equal(result.status, "loading");
  assert.equal(result.candidateCount, 1);
  assert.equal(result.completedCandidateCount, 0);
  assert.equal(result.attempts[0].status, "PENDING");
  assert.deepEqual(result.offers, []);
});

test("commercial coverage rejection is visible without a fabricated offer", () => {
  const result = buildOrchestrationViewModel(
    source({
      events: [
        {
          carrier_id: CARRIER_ID,
          carrier_service_id: SERVICE_ID,
          provider_url: candidate.providerUrl,
          tool_name: "check_service_coverage",
          status: "SUCCEEDED",
          execution_status: "COMPLETED",
          output_payload: { ok: true, data: { supported: false } },
          technical_error: null,
          completed_at: "2026-08-30T12:00:01.000Z",
          created_at: "2026-08-30T12:00:01.000Z",
        },
      ],
    }),
  );

  assert.equal(result.status, "loading");
  assert.equal(result.attempts[0].status, "REJECTED");
  assert.deepEqual(result.attempts[0].completedTools, ["check_service_coverage"]);
});

test("success maps persisted BALANCED ranking to a stable offer view", () => {
  const result = buildOrchestrationViewModel(
    source({
      run: {
        ...source().run,
        status: "OPTIONS_READY",
        completed_at: "2026-08-30T12:01:00.000Z",
        result_snapshot: {
          orchestrationRunId: RUN_ID,
          strategy: "BALANCED",
          recommendedOfferId: "offer-1",
          decisionConfidence: 84,
          options: [
            {
              offerId: "offer-1",
              rank: 1,
              rawScore: 93,
              roundedScore: 93,
              eligible: true,
              reasons: ["Single eligible option"],
            },
          ],
        },
      },
      offers: [
        {
          id: "offer-1",
          carrier_id: CARRIER_ID,
          carrier_service_id: SERVICE_ID,
          provider_offer_reference: "GEN-OFF-1",
          price: 1760,
          currency: "USD",
          transit_hours: 31,
        },
      ],
    }),
  );

  assert.equal(result.status, "success");
  assert.equal(result.ranking.decisionConfidence, 84);
  assert.deepEqual(result.offers, [
    {
      offerId: "offer-1",
      carrierId: CARRIER_ID,
      carrierCode: "GENERIC-CARRIER",
      displayName: "Generic Carrier",
      matchingServiceId: SERVICE_ID,
      providerOfferReference: "GEN-OFF-1",
      totalPrice: 1760,
      currency: "USD",
      transitHours: 31,
      rank: 1,
      score: 93,
      eligible: true,
      reasons: ["Single eligible option"],
      recommended: true,
    },
  ]);
});

test("NO_MATCH reads the persisted empty ranking without rescoring", () => {
  const result = buildOrchestrationViewModel(
    source({
      run: {
        ...source().run,
        status: "NO_MATCH",
        completed_at: "2026-08-30T12:01:00.000Z",
        result_snapshot: {
          orchestrationRunId: RUN_ID,
          strategy: "BALANCED",
          recommendedOfferId: null,
          decisionConfidence: 0,
          options: [],
        },
      },
    }),
  );

  assert.equal(result.status, "NO_MATCH");
  assert.equal(result.ranking.recommendedOfferId, null);
  assert.deepEqual(result.offers, []);
});

test("technical provider failures are warnings and do not become NO_MATCH", () => {
  const result = buildOrchestrationViewModel(
    source({
      run: {
        ...source().run,
        status: "FAILED",
        completed_at: "2026-08-30T12:01:00.000Z",
        error_code: "ALL_PROVIDERS_FAILED",
      },
      events: [
        {
          carrier_id: CARRIER_ID,
          carrier_service_id: SERVICE_ID,
          provider_url: candidate.providerUrl,
          tool_name: "check_capacity",
          status: "FAILED",
          execution_status: "TECHNICAL_ERROR",
          output_payload: null,
          technical_error: { code: "WEBMCP_TIMEOUT", message: "Tool timed out", retryable: true },
          completed_at: "2026-08-30T12:00:02.000Z",
          created_at: "2026-08-30T12:00:02.000Z",
        },
      ],
    }),
  );

  assert.equal(result.status, "error");
  assert.equal(result.error.code, "ALL_PROVIDERS_FAILED");
  assert.equal(result.attempts[0].status, "FAILED");
  assert.deepEqual(result.warnings.map((warning) => warning.code), ["WEBMCP_TIMEOUT"]);
});

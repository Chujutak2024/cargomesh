import assert from "node:assert/strict";
import test from "node:test";

import type { CandidateProvider } from "@/features/providers/contracts";

import {
  INT02A_PROVIDER_TOOL_NAMES,
  Int02aApiError,
  runInt02aOrchestration,
  type Int02aFetch,
  type Int02aProviderToolName,
  type ProviderNavigationAdapter,
  type ProviderRunnerInputs,
} from "./index";

const BASE_URL = "http://localhost:3000";
const REQUEST_ID = "22222222-2222-4222-8222-222222222222";
const RUN_ID = "11111111-1111-4111-8111-111111111111";

function candidate(index: number): CandidateProvider {
  return {
    carrierId: `30000000-0000-4000-8000-00000000000${index}`,
    carrierCode: `CARRIER_${index}`,
    displayName: `Carrier ${index}`,
    providerUrl: `/providers/carrier-${index}`,
    matchingServiceId: `40000000-0000-4000-8000-00000000000${index}`,
  };
}

const inputs: ProviderRunnerInputs = {
  check_service_coverage: {
    origin: "Callao, Peru",
    destination: "Santiago, Chile",
    transport_mode: "ROAD",
    service_type: "FTL",
    cargo_category: "MACHINERY",
  },
  check_capacity: {
    origin: "Callao, Peru",
    destination: "Santiago, Chile",
    cargo_weight_kg: 8_000,
    cargo_volume_m3: 18,
    cargo_category: "MACHINERY",
    pickup_mode: "ASAP",
  },
  quote_freight: {
    freight_request_id: REQUEST_ID,
    origin: "Callao, Peru",
    destination: "Santiago, Chile",
    cargo_weight_kg: 8_000,
    cargo_volume_m3: 18,
  },
};

function toolOutput(toolName: Int02aProviderToolName) {
  if (toolName === "check_service_coverage") {
    return { ok: true, data: { supported: true } };
  }
  if (toolName === "check_capacity") {
    return { ok: true, data: { available: true } };
  }
  return {
    ok: true,
    data: {
      schemaVersion: "1.0",
      freightRequestId: REQUEST_ID,
      providerOfferReference: "OFFER-1",
    },
  };
}

function createNavigation(evidence: {
  opened: string[];
  executed: string[];
  cleanup: string[];
}): ProviderNavigationAdapter {
  return {
    async open(navigationUrl) {
      evidence.opened.push(navigationUrl);
      return {
        runtime: {
          async getToolNames() {
            return [...INT02A_PROVIDER_TOOL_NAMES];
          },
          async executeTool(toolName) {
            evidence.executed.push(toolName);
            return toolOutput(toolName);
          },
        },
        async leaveAndGetActiveToolNames(cleanupUrl) {
          evidence.cleanup.push(cleanupUrl);
          return [];
        },
      };
    },
  };
}

type FetchCall = {
  method: string;
  url: string;
  body: unknown;
};

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

function parseBody(init?: RequestInit): unknown {
  return typeof init?.body === "string" ? JSON.parse(init.body) : null;
}

function createApi(
  candidates: CandidateProvider[],
  calls: FetchCall[],
  failRecord = false,
): Int02aFetch {
  return async (input, init) => {
    const url = new URL(String(input));
    const method = init?.method ?? "GET";
    const body = parseBody(init);
    calls.push({ method, url: url.toString(), body });

    if (method === "POST" && url.pathname === "/api/orchestration/runs") {
      return json({
        ok: true,
        data: {
          runId: RUN_ID,
          freightRequestId: REQUEST_ID,
          status: "RUNNING",
          deduplicated: false,
          candidates,
        },
      }, 201);
    }
    if (method === "POST" && url.pathname === "/api/orchestration/record-result") {
      if (failRecord) {
        return json(
          {
            ok: false,
            error: { code: "IDEMPOTENCY_CONFLICT", message: "Conflicting replay." },
          },
          409,
        );
      }
      const record = body as { toolCallId: string };
      return json({
        ok: true,
        data: {
          eventId: `event:${record.toolCallId}`,
          status: "INSERTED",
          deduplicated: false,
        },
      });
    }
    if (method === "POST" && url.pathname === "/api/orchestration/evaluate-offers") {
      return json({ ok: true, data: { status: candidates.length ? "OPTIONS_READY" : "NO_MATCH" } });
    }
    if (method === "GET" && url.pathname === `/api/orchestration/runs/${RUN_ID}`) {
      return json({
        ok: true,
        data: {
          schemaVersion: "1.0",
          runId: RUN_ID,
          freightRequestId: REQUEST_ID,
          status: candidates.length ? "success" : "NO_MATCH",
          offers: [],
        },
      });
    }

    return json({ ok: false, error: { code: "NOT_FOUND", message: "Unexpected request." } }, 404);
  };
}

function runnerEvidence() {
  return {
    opened: [] as string[],
    executed: [] as string[],
    cleanup: [] as string[],
  };
}

test("runs the 0-provider flow and still evaluates and stores the ViewModel evidence", async () => {
  const fetchCalls: FetchCall[] = [];
  const browser = runnerEvidence();
  const result = await runInt02aOrchestration({
    freightRequestId: REQUEST_ID,
    idempotencyKey: "demo:zero",
    baseUrl: BASE_URL,
    navigation: createNavigation(browser),
    createInputs: () => inputs,
    fetcher: createApi([], fetchCalls),
  });

  assert.equal(result.start.candidates.length, 0);
  assert.equal(Object.isFrozen(result.start.candidates), true);
  assert.equal(result.providerCollection.candidateCount, 0);
  assert.deepEqual(result.resultBridge, []);
  assert.deepEqual(browser.opened, []);
  assert.deepEqual(
    fetchCalls.map((call) => `${call.method} ${new URL(call.url).pathname}`),
    [
      "POST /api/orchestration/runs",
      "POST /api/orchestration/evaluate-offers",
      `GET /api/orchestration/runs/${RUN_ID}`,
    ],
  );
  assert.deepEqual(fetchCalls[0]?.body, {
    freightRequestId: REQUEST_ID,
    idempotencyKey: "demo:zero",
  });
  assert.deepEqual(fetchCalls[1]?.body, { orchestrationRunId: RUN_ID });
});

test("uses the immutable N-provider server snapshot and records every WebMCP call", async () => {
  const fetchCalls: FetchCall[] = [];
  const browser = runnerEvidence();
  const result = await runInt02aOrchestration({
    freightRequestId: REQUEST_ID,
    idempotencyKey: "demo:n",
    baseUrl: BASE_URL,
    navigation: createNavigation(browser),
    createInputs: (selectedCandidate) => {
      assert.equal(Object.isFrozen(selectedCandidate), true);
      return inputs;
    },
    fetcher: createApi([candidate(1), candidate(2)], fetchCalls),
  });

  assert.equal(Object.isFrozen(result.start), true);
  assert.equal(Object.isFrozen(result.start.candidates), true);
  assert.equal(result.start.candidates.every(Object.isFrozen), true);
  assert.equal(result.providerCollection.candidateCount, 2);
  assert.equal(result.providerCollection.attempts.every((attempt) => attempt.status === "QUOTED"), true);
  assert.equal(result.providerCollection.attempts.every((attempt) => attempt.cleanup.verified), true);
  assert.equal(result.resultBridge.length, 6);
  assert.deepEqual(
    result.resultBridge.map((entry) => entry.toolName),
    [...INT02A_PROVIDER_TOOL_NAMES, ...INT02A_PROVIDER_TOOL_NAMES],
  );
  assert.deepEqual(browser.executed, [
    ...INT02A_PROVIDER_TOOL_NAMES,
    ...INT02A_PROVIDER_TOOL_NAMES,
  ]);
  assert.deepEqual(browser.cleanup, [`${BASE_URL}/`, `${BASE_URL}/`]);
  assert.equal(
    browser.opened.every((url, index) =>
      new URL(url).searchParams.get("serviceId") === candidate(index + 1).matchingServiceId,
    ),
    true,
  );

  const persistedRecords = fetchCalls
    .filter((call) => new URL(call.url).pathname === "/api/orchestration/record-result")
    .map((call) => call.body as Record<string, unknown>);
  assert.equal(persistedRecords.length, 6);
  assert.equal(persistedRecords.every((record) => record.orchestrationRunId === RUN_ID), true);
  assert.deepEqual(
    fetchCalls.slice(-2).map((call) => `${call.method} ${new URL(call.url).pathname}`),
    [
      "POST /api/orchestration/evaluate-offers",
      `GET /api/orchestration/runs/${RUN_ID}`,
    ],
  );
  assert.deepEqual(result.viewModel, {
    schemaVersion: "1.0",
    runId: RUN_ID,
    freightRequestId: REQUEST_ID,
    status: "success",
    offers: [],
  });
});

test("stops before evaluation when Result Bridge rejects a record", async () => {
  const fetchCalls: FetchCall[] = [];
  const browser = runnerEvidence();

  await assert.rejects(
    runInt02aOrchestration({
      freightRequestId: REQUEST_ID,
      idempotencyKey: "demo:conflict",
      baseUrl: BASE_URL,
      navigation: createNavigation(browser),
      createInputs: () => inputs,
      fetcher: createApi([candidate(1)], fetchCalls, true),
    }),
    (error: unknown) => {
      assert.ok(error instanceof Int02aApiError);
      assert.equal(error.stage, "RECORD_RESULT");
      assert.equal(error.code, "IDEMPOTENCY_CONFLICT");
      assert.equal(error.httpStatus, 409);
      return true;
    },
  );

  assert.equal(browser.cleanup.length, 1);
  assert.equal(
    fetchCalls.some((call) => new URL(call.url).pathname === "/api/orchestration/evaluate-offers"),
    false,
  );
  assert.equal(fetchCalls.some((call) => call.method === "GET"), false);
});

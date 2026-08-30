import assert from "node:assert/strict";
import test from "node:test";

import type { CandidateProvider } from "@/features/providers/contracts";

import {
  createDocumentModelContextAdapter,
  INT02A_PROVIDER_TOOL_NAMES,
  runProviderCollection,
  type Int02aProviderToolName,
  type ProviderNavigationAdapter,
  type ProviderRunnerInputs,
} from "./index";

const RUN_ID = "11111111-1111-4111-8111-111111111111";
const REQUEST_ID = "22222222-2222-4222-8222-222222222222";

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
    cargo_category: "GENERAL",
  },
  check_capacity: {
    origin: "Callao, Peru",
    destination: "Santiago, Chile",
    cargo_weight_kg: 8_000,
    cargo_volume_m3: 24,
    cargo_category: "GENERAL",
    pickup_mode: "ASAP",
  },
  quote_freight: {
    freight_request_id: REQUEST_ID,
    origin: "Callao, Peru",
    destination: "Santiago, Chile",
    cargo_weight_kg: 8_000,
    cargo_volume_m3: 24,
  },
};

type ToolBehavior = (
  input: Record<string, unknown>,
  signal: AbortSignal,
) => unknown | Promise<unknown>;

function createModelContext(
  behaviors: Partial<Record<Int02aProviderToolName, ToolBehavior>> = {},
  executionOrder: string[] = [],
) {
  let activeToolNames = [...INT02A_PROVIDER_TOOL_NAMES];
  const registeredTools = () =>
    activeToolNames.map((name) => ({
      name,
      title: name,
      description: name,
      window: {} as Window,
      origin: "http://localhost:3000",
    }));

  const modelContext = {
    async getTools() {
      return registeredTools();
    },
    async executeTool(
      tool: WebMCP.RegisteredTool,
      input: Record<string, unknown>,
      options?: WebMCP.ModelContextExecuteToolOptions,
    ) {
      executionOrder.push(tool.name);
      const behavior = behaviors[tool.name as Int02aProviderToolName];
      return behavior
        ? behavior(input, options?.signal ?? new AbortController().signal)
        : { ok: true, data: { accepted: true } };
    },
  } as WebMCP.ModelContext;

  return {
    modelContext,
    clearTools() {
      activeToolNames = [];
    },
    getActiveToolNames() {
      return [...activeToolNames];
    },
  };
}

function successfulBehaviors(): Record<Int02aProviderToolName, ToolBehavior> {
  return {
    check_service_coverage: () => ({
      ok: true,
      data: { supported: true },
    }),
    check_capacity: () => ({
      ok: true,
      data: { available: true },
    }),
    quote_freight: (input) => ({
      ok: true,
      data: {
        schemaVersion: "1.0",
        freightRequestId: input.freight_request_id,
        providerOfferReference: "OFFER-1",
      },
    }),
  };
}

function createNavigation(
  behaviorFactory: (candidate: CandidateProvider) => Partial<
    Record<Int02aProviderToolName, ToolBehavior>
  >,
  evidence: { urls: string[]; executionOrder: string[]; cleanupCount: number },
  leaveToolsBehind = false,
): ProviderNavigationAdapter {
  return {
    async open(url, selectedCandidate) {
      evidence.urls.push(url);
      const documentRuntime = createModelContext(
        behaviorFactory(selectedCandidate),
        evidence.executionOrder,
      );

      return {
        runtime: createDocumentModelContextAdapter({
          modelContext: documentRuntime.modelContext,
        }),
        async leaveAndGetActiveToolNames() {
          evidence.cleanupCount += 1;
          if (!leaveToolsBehind) documentRuntime.clearTools();
          return documentRuntime.getActiveToolNames();
        },
      };
    },
  };
}

function createToolCallId(identity: {
  carrierId: string;
  matchingServiceId: string;
  toolName: string;
  attemptNumber: number;
}) {
  return [
    identity.carrierId,
    identity.matchingServiceId,
    identity.toolName,
    identity.attemptNumber,
  ].join(":");
}

function evidence() {
  return { urls: [] as string[], executionOrder: [] as string[], cleanupCount: 0 };
}

test("processes zero candidates without opening a provider document", async () => {
  const observed = evidence();
  const result = await runProviderCollection({
    candidates: [],
    baseUrl: "http://localhost:3000",
    orchestrationRunId: RUN_ID,
    freightRequestId: REQUEST_ID,
    navigation: createNavigation(() => successfulBehaviors(), observed),
    createInputs: () => inputs,
    createToolCallId,
  });

  assert.equal(result.candidateCount, 0);
  assert.equal(result.completedCandidateCount, 0);
  assert.deepEqual(result.attempts, []);
  assert.deepEqual(observed.urls, []);
});

test("uses document.modelContext for one candidate and preserves matchingServiceId", async () => {
  const observed = evidence();
  const selectedCandidate = candidate(1);
  const result = await runProviderCollection({
    candidates: [selectedCandidate],
    baseUrl: "http://localhost:3000/dashboard",
    orchestrationRunId: RUN_ID,
    freightRequestId: REQUEST_ID,
    navigation: createNavigation(() => successfulBehaviors(), observed),
    createInputs: () => inputs,
    createToolCallId,
  });

  assert.equal(result.attempts[0]?.status, "QUOTED");
  assert.equal(result.attempts[0]?.matchingServiceId, selectedCandidate.matchingServiceId);
  assert.equal(
    new URL(observed.urls[0] as string).searchParams.get("serviceId"),
    selectedCandidate.matchingServiceId,
  );
  assert.deepEqual(observed.executionOrder, INT02A_PROVIDER_TOOL_NAMES);
  assert.equal(result.attempts[0]?.calls.length, 3);
  assert.equal(result.attempts[0]?.calls[0]?.attemptNumber, 1);
  assert.equal(result.attempts[0]?.calls[0]?.toolOutput?.ok, true);
  assert.match(result.attempts[0]?.calls[0]?.toolCallId ?? "", /check_service_coverage/);
  assert.equal(result.attempts[0]?.cleanup.verified, true);
  assert.equal(observed.cleanupCount, 1);
});

test("processes N providers without carrier-specific branches", async () => {
  const observed = evidence();
  const candidates = [candidate(1), candidate(2), candidate(3)];
  const result = await runProviderCollection({
    candidates,
    baseUrl: "https://cargomesh.example",
    orchestrationRunId: RUN_ID,
    freightRequestId: REQUEST_ID,
    navigation: createNavigation(() => successfulBehaviors(), observed),
    createInputs: () => inputs,
    createToolCallId,
  });

  assert.equal(result.candidateCount, 3);
  assert.equal(result.completedCandidateCount, 3);
  assert.deepEqual(result.attempts.map((attempt) => attempt.status), [
    "QUOTED",
    "QUOTED",
    "QUOTED",
  ]);
  assert.equal(observed.cleanupCount, 3);
  assert.equal(observed.executionOrder.length, 9);
  assert.equal(
    result.attempts.every(
      (attempt) =>
        new URL(attempt.navigationUrl).searchParams.get("serviceId") ===
        attempt.matchingServiceId,
    ),
    true,
  );
});

test("records a commercial coverage rejection and skips capacity and quote", async () => {
  const observed = evidence();
  const result = await runProviderCollection({
    candidates: [candidate(1)],
    baseUrl: "http://localhost:3000",
    orchestrationRunId: RUN_ID,
    freightRequestId: REQUEST_ID,
    navigation: createNavigation(
      () => ({
        ...successfulBehaviors(),
        check_service_coverage: () => ({
          ok: true,
          data: { supported: false, serviceNotes: ["Unsupported corridor"] },
        }),
      }),
      observed,
    ),
    createInputs: () => inputs,
    createToolCallId,
  });

  assert.equal(result.attempts[0]?.status, "REJECTED");
  assert.equal(result.attempts[0]?.stopReason, "COVERAGE_NOT_SUPPORTED");
  assert.deepEqual(result.attempts[0]?.completedTools, ["check_service_coverage"]);
  assert.deepEqual(observed.executionOrder, ["check_service_coverage"]);
  assert.equal(result.attempts[0]?.cleanup.verified, true);
});

test("records a commercial capacity rejection and skips quote", async () => {
  const observed = evidence();
  const result = await runProviderCollection({
    candidates: [candidate(1)],
    baseUrl: "http://localhost:3000",
    orchestrationRunId: RUN_ID,
    freightRequestId: REQUEST_ID,
    navigation: createNavigation(
      () => ({
        ...successfulBehaviors(),
        check_capacity: () => ({
          ok: true,
          data: { available: false, capabilityNotes: ["Insufficient capacity"] },
        }),
      }),
      observed,
    ),
    createInputs: () => inputs,
    createToolCallId,
  });

  assert.equal(result.attempts[0]?.status, "REJECTED");
  assert.equal(result.attempts[0]?.stopReason, "CAPACITY_NOT_AVAILABLE");
  assert.deepEqual(result.attempts[0]?.completedTools, [
    "check_service_coverage",
    "check_capacity",
  ]);
  assert.deepEqual(observed.executionOrder, [
    "check_service_coverage",
    "check_capacity",
  ]);
  assert.equal(
    result.attempts[0]?.calls.some((call) => call.toolName === "quote_freight"),
    false,
  );
});

test("captures a technical WebMCP error without manufacturing a quote", async () => {
  const observed = evidence();
  const result = await runProviderCollection({
    candidates: [candidate(1)],
    baseUrl: "http://localhost:3000",
    orchestrationRunId: RUN_ID,
    freightRequestId: REQUEST_ID,
    navigation: createNavigation(
      () => ({
        ...successfulBehaviors(),
        check_capacity: () => {
          throw new Error("PROVIDER_TIMEOUT: capacity did not answer.");
        },
      }),
      observed,
    ),
    createInputs: () => inputs,
    createToolCallId,
  });

  const attempt = result.attempts[0];
  assert.equal(attempt?.status, "FAILED");
  assert.equal(attempt?.stopReason, "PROVIDER_TIMEOUT");
  assert.deepEqual(observed.executionOrder, [
    "check_service_coverage",
    "check_capacity",
  ]);
  assert.equal(attempt?.calls[1]?.toolOutput, null);
  assert.equal(
    attempt?.calls.some((call) => call.toolName === "quote_freight"),
    false,
  );
});

test("preserves a technical ProviderToolEnvelope for C without quoting", async () => {
  const observed = evidence();
  const result = await runProviderCollection({
    candidates: [candidate(1)],
    baseUrl: "http://localhost:3000",
    orchestrationRunId: RUN_ID,
    freightRequestId: REQUEST_ID,
    navigation: createNavigation(
      () => ({
        ...successfulBehaviors(),
        check_service_coverage: () => ({
          ok: false,
          error: {
            code: "PROVIDER_UNAVAILABLE",
            message: "Provider is temporarily unavailable.",
            retryable: true,
          },
        }),
      }),
      observed,
    ),
    createInputs: () => inputs,
    createToolCallId,
  });

  const call = result.attempts[0]?.calls[0];
  assert.equal(result.attempts[0]?.status, "FAILED");
  assert.equal(result.attempts[0]?.stopReason, "PROVIDER_UNAVAILABLE");
  assert.equal(call?.status, "TECHNICAL_ERROR");
  assert.deepEqual(call?.toolOutput, {
    ok: false,
    error: {
      code: "PROVIDER_UNAVAILABLE",
      message: "Provider is temporarily unavailable.",
      retryable: true,
    },
  });
  assert.equal(
    result.attempts[0]?.calls.some((item) => item.toolName === "quote_freight"),
    false,
  );
});

test("reports cleanup failure when provider tools survive page abandonment", async () => {
  const observed = evidence();
  const result = await runProviderCollection({
    candidates: [candidate(1)],
    baseUrl: "http://localhost:3000",
    orchestrationRunId: RUN_ID,
    freightRequestId: REQUEST_ID,
    navigation: createNavigation(
      () => successfulBehaviors(),
      observed,
      true,
    ),
    createInputs: () => inputs,
    createToolCallId,
  });

  assert.equal(result.attempts[0]?.cleanup.verified, false);
  assert.equal(
    result.attempts[0]?.warnings.some(
      (issue) => issue.code === "WEBMCP_CLEANUP_FAILED",
    ),
    true,
  );
});

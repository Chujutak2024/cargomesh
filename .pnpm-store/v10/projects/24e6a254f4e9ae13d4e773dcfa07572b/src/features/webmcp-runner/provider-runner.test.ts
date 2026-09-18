import assert from "node:assert/strict";
import test from "node:test";

import type { CandidateProvider } from "@/features/providers/contracts";

import {
  createDocumentModelContextAdapter,
  createInt02aToolCallId,
  INT02A_PROVIDER_TOOL_NAMES,
  replayProviderToolCallRecord,
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
      inputJson: string,
      options?: WebMCP.ModelContextExecuteToolOptions,
    ) {
      executionOrder.push(tool.name);
      const behavior = behaviors[tool.name as Int02aProviderToolName];
      const input = JSON.parse(inputJson) as Record<string, unknown>;
      const output = behavior
        ? behavior(input, options?.signal ?? new AbortController().signal)
        : { ok: true, data: { accepted: true } };
      return JSON.stringify(await output);
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
  evidence: {
    urls: string[];
    cleanupUrls: string[];
    executionOrder: string[];
    cleanupCount: number;
  },
  leaveToolsBehind: boolean | string[] = false,
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
        async leaveAndGetActiveToolNames(cleanupUrl) {
          evidence.cleanupCount += 1;
          evidence.cleanupUrls.push(cleanupUrl);
          if (Array.isArray(leaveToolsBehind)) return [...leaveToolsBehind];
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
  return {
    urls: [] as string[],
    cleanupUrls: [] as string[],
    executionOrder: [] as string[],
    cleanupCount: 0,
  };
}

test("creates the canonical deterministic toolCallId", () => {
  const identity = {
    orchestrationRunId: RUN_ID,
    freightRequestId: REQUEST_ID,
    carrierId: candidate(1).carrierId,
    matchingServiceId: candidate(1).matchingServiceId,
    toolName: "quote_freight" as const,
    attemptNumber: 1,
  };
  const expected = [
    "cm:int02a:v1",
    RUN_ID,
    REQUEST_ID,
    candidate(1).carrierId,
    candidate(1).matchingServiceId,
    "quote_freight",
    "1",
  ].join(":");

  assert.equal(createInt02aToolCallId(identity), expected);
  assert.equal(createInt02aToolCallId({ ...identity }), expected);
});

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
  assert.deepEqual(observed.cleanupUrls, ["http://localhost:3000/"]);
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
  assert.deepEqual(observed.cleanupUrls, [
    "https://cargomesh.example/",
    "https://cargomesh.example/",
    "https://cargomesh.example/",
  ]);
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

test("increments attemptNumber for a new real execution", async () => {
  const observed = evidence();
  const selectedCandidate = candidate(1);
  const commonOptions = {
    candidates: [selectedCandidate],
    baseUrl: "http://localhost:3000",
    orchestrationRunId: RUN_ID,
    freightRequestId: REQUEST_ID,
    navigation: createNavigation(() => successfulBehaviors(), observed),
    createInputs: () => inputs,
  };

  const first = await runProviderCollection({
    ...commonOptions,
    getAttemptNumber: () => 1,
  });
  const second = await runProviderCollection({
    ...commonOptions,
    getAttemptNumber: () => 2,
  });
  const firstCall = first.attempts[0]?.calls[0];
  const secondCall = second.attempts[0]?.calls[0];

  assert.equal(firstCall?.attemptNumber, 1);
  assert.equal(secondCall?.attemptNumber, 2);
  assert.match(firstCall?.toolCallId ?? "", /:1$/);
  assert.match(secondCall?.toolCallId ?? "", /:2$/);
  assert.notEqual(firstCall?.toolCallId, secondCall?.toolCallId);
});

test("replays the complete original record without executing WebMCP again", async () => {
  const observed = evidence();
  const result = await runProviderCollection({
    candidates: [candidate(1)],
    baseUrl: "http://localhost:3000",
    orchestrationRunId: RUN_ID,
    freightRequestId: REQUEST_ID,
    navigation: createNavigation(() => successfulBehaviors(), observed),
    createInputs: () => inputs,
  });
  const original = result.attempts[0]?.calls[2];
  assert.ok(original);
  const executionsBeforeReplay = observed.executionOrder.length;
  let delivered = null as typeof original | null;

  const replayResult = await replayProviderToolCallRecord(original, (record) => {
    delivered = record;
    return "DEDUPLICATED" as const;
  });

  assert.equal(replayResult, "DEDUPLICATED");
  assert.deepEqual(delivered, original);
  assert.notEqual(delivered, original);
  assert.equal(observed.executionOrder.length, executionsBeforeReplay);
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

test("cleanup also fails when only a booking provider tool survives", async () => {
  const observed = evidence();
  const result = await runProviderCollection({
    candidates: [candidate(1)],
    baseUrl: "http://localhost:3000",
    orchestrationRunId: RUN_ID,
    freightRequestId: REQUEST_ID,
    navigation: createNavigation(
      () => successfulBehaviors(),
      observed,
      ["get_provider_booking_status"],
    ),
    createInputs: () => inputs,
    createToolCallId,
  });

  assert.equal(result.attempts[0]?.cleanup.verified, false);
  assert.deepEqual(result.attempts[0]?.cleanup.activeToolNames, [
    "get_provider_booking_status",
  ]);
});

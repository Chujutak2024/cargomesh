import type { CandidateProvider } from "@/features/providers/contracts";

import type {
  ProviderCollectionResult,
  ProviderNavigationAdapter,
  ProviderRunnerInputs,
  ProviderToolCallIdFactory,
  ProviderToolCallRecord,
} from "./contracts";
import { runProviderCollection } from "./provider-runner";

type RunnerClock = () => Date;

export type Int02aFetch = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export type StartedOrchestrationRun = {
  runId: string;
  freightRequestId: string;
  status: "RUNNING" | "OPTIONS_READY" | "NO_MATCH" | "FAILED" | "CANCELLED";
  deduplicated: boolean;
  candidates: readonly Readonly<CandidateProvider>[];
};

export type ResultBridgeEvidence = {
  toolCallId: string;
  toolName: ProviderToolCallRecord["toolName"];
  data: unknown;
};

export type Int02aOrchestrationEvidence = {
  schemaVersion: "1.0";
  start: StartedOrchestrationRun;
  providerCollection: ProviderCollectionResult;
  resultBridge: ResultBridgeEvidence[];
  evaluation: unknown;
  viewModel: unknown;
};

export type RunInt02aOrchestrationOptions = {
  freightRequestId: string;
  idempotencyKey: string;
  baseUrl: string;
  navigation: ProviderNavigationAdapter;
  createInputs(candidate: CandidateProvider): ProviderRunnerInputs;
  createToolCallId?: ProviderToolCallIdFactory;
  getAttemptNumber?(candidate: CandidateProvider): number;
  fetcher?: Int02aFetch;
  signal?: AbortSignal;
  now?: RunnerClock;
};

export type Int02aApiStage =
  | "START_RUN"
  | "RECORD_RESULT"
  | "EVALUATE_OFFERS"
  | "READ_VIEW_MODEL";

export class Int02aApiError extends Error {
  constructor(
    public readonly stage: Int02aApiStage,
    public readonly code: string,
    message: string,
    public readonly httpStatus: number | null,
  ) {
    super(message);
    this.name = "Int02aApiError";
  }
}

type ApiEnvelope = {
  ok: boolean;
  data?: unknown;
  error?: { code?: unknown; message?: unknown };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isApiEnvelope(value: unknown): value is ApiEnvelope {
  return isRecord(value) && typeof value.ok === "boolean";
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function apiError(
  stage: Int02aApiStage,
  response: Response,
  body: unknown,
): Int02aApiError {
  const error = isApiEnvelope(body) && isRecord(body.error) ? body.error : null;
  const code = nonEmptyString(error?.code) ? error.code : `${stage}_FAILED`;
  const message = nonEmptyString(error?.message)
    ? error.message
    : `CargoMesh API request failed during ${stage}.`;

  return new Int02aApiError(stage, code, message, response.status);
}

async function readResponseBody(
  stage: Int02aApiStage,
  response: Response,
): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new Int02aApiError(
      stage,
      `${stage}_INVALID_RESPONSE`,
      `CargoMesh API returned non-JSON content during ${stage}.`,
      response.status,
    );
  }
}

async function requestData(
  stage: Int02aApiStage,
  fetcher: Int02aFetch,
  url: URL,
  init: RequestInit,
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetcher(url, init);
  } catch (error) {
    if (error instanceof Int02aApiError) throw error;
    const message = error instanceof Error ? error.message : String(error);
    throw new Int02aApiError(stage, `${stage}_NETWORK_ERROR`, message, null);
  }

  const body = await readResponseBody(stage, response);
  if (!response.ok || !isApiEnvelope(body) || !body.ok || !("data" in body)) {
    throw apiError(stage, response, body);
  }
  return body.data;
}

function parseCandidate(value: unknown): Readonly<CandidateProvider> {
  if (
    !isRecord(value) ||
    !nonEmptyString(value.carrierId) ||
    !nonEmptyString(value.carrierCode) ||
    !nonEmptyString(value.displayName) ||
    !nonEmptyString(value.providerUrl) ||
    !nonEmptyString(value.matchingServiceId)
  ) {
    throw new Int02aApiError(
      "START_RUN",
      "START_RUN_INVALID_CANDIDATE",
      "The start-run response contains an invalid CandidateProvider.",
      200,
    );
  }

  return Object.freeze({
    carrierId: value.carrierId,
    carrierCode: value.carrierCode,
    displayName: value.displayName,
    providerUrl: value.providerUrl,
    matchingServiceId: value.matchingServiceId,
  });
}

function parseStartedRun(
  value: unknown,
  expectedFreightRequestId: string,
): StartedOrchestrationRun {
  if (
    !isRecord(value) ||
    !nonEmptyString(value.runId) ||
    value.freightRequestId !== expectedFreightRequestId ||
    typeof value.deduplicated !== "boolean" ||
    !Array.isArray(value.candidates)
  ) {
    throw new Int02aApiError(
      "START_RUN",
      "START_RUN_INVALID_RESPONSE",
      "The start-run response does not match the requested FreightRequest.",
      200,
    );
  }

  const statuses = new Set([
    "RUNNING",
    "OPTIONS_READY",
    "NO_MATCH",
    "FAILED",
    "CANCELLED",
  ]);
  if (!nonEmptyString(value.status) || !statuses.has(value.status)) {
    throw new Int02aApiError(
      "START_RUN",
      "START_RUN_INVALID_RESPONSE",
      "The start-run response contains an unsupported run status.",
      200,
    );
  }

  const candidates = Object.freeze(value.candidates.map(parseCandidate));
  return Object.freeze({
    runId: value.runId,
    freightRequestId: expectedFreightRequestId,
    status: value.status as StartedOrchestrationRun["status"],
    deduplicated: value.deduplicated,
    candidates,
  });
}

function assertViewModelIdentity(
  value: unknown,
  runId: string,
  freightRequestId: string,
): void {
  if (
    !isRecord(value) ||
    value.runId !== runId ||
    value.freightRequestId !== freightRequestId
  ) {
    throw new Int02aApiError(
      "READ_VIEW_MODEL",
      "VIEW_MODEL_CORRELATION_ERROR",
      "The orchestration ViewModel does not match the active run.",
      200,
    );
  }
}

function jsonRequest(body: unknown, signal?: AbortSignal): RequestInit {
  return {
    method: "POST",
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal,
  };
}

/**
 * Connects A's browser-native WebMCP runner to C's public orchestration API.
 * It never imports server-only implementations or calls provider handlers.
 */
export async function runInt02aOrchestration(
  options: RunInt02aOrchestrationOptions,
): Promise<Int02aOrchestrationEvidence> {
  if (!nonEmptyString(options.freightRequestId)) {
    throw new Int02aApiError(
      "START_RUN",
      "INVALID_FREIGHT_REQUEST_ID",
      "freightRequestId is required.",
      null,
    );
  }
  if (!nonEmptyString(options.idempotencyKey)) {
    throw new Int02aApiError(
      "START_RUN",
      "INVALID_IDEMPOTENCY_KEY",
      "idempotencyKey is required.",
      null,
    );
  }

  const fetcher = options.fetcher ?? fetch;
  const startData = await requestData(
    "START_RUN",
    fetcher,
    new URL("/api/orchestration/runs", options.baseUrl),
    jsonRequest(
      {
        freightRequestId: options.freightRequestId,
        idempotencyKey: options.idempotencyKey,
      },
      options.signal,
    ),
  );
  const start = parseStartedRun(startData, options.freightRequestId);

  const providerCollection = await runProviderCollection({
    candidates: start.candidates,
    baseUrl: options.baseUrl,
    orchestrationRunId: start.runId,
    freightRequestId: start.freightRequestId,
    navigation: options.navigation,
    createInputs: options.createInputs,
    createToolCallId: options.createToolCallId,
    getAttemptNumber: options.getAttemptNumber,
    signal: options.signal,
    now: options.now,
  });

  const resultBridge: ResultBridgeEvidence[] = [];
  for (const attempt of providerCollection.attempts) {
    for (const record of attempt.calls) {
      const data = await requestData(
        "RECORD_RESULT",
        fetcher,
        new URL("/api/orchestration/record-result", options.baseUrl),
        jsonRequest(record, options.signal),
      );
      resultBridge.push({
        toolCallId: record.toolCallId,
        toolName: record.toolName,
        data: structuredClone(data),
      });
    }
  }

  const evaluation = await requestData(
    "EVALUATE_OFFERS",
    fetcher,
    new URL("/api/orchestration/evaluate-offers", options.baseUrl),
    jsonRequest({ orchestrationRunId: start.runId }, options.signal),
  );

  const viewModel = await requestData(
    "READ_VIEW_MODEL",
    fetcher,
    new URL(`/api/orchestration/runs/${encodeURIComponent(start.runId)}`, options.baseUrl),
    {
      method: "GET",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: options.signal,
    },
  );
  assertViewModelIdentity(viewModel, start.runId, start.freightRequestId);

  return {
    schemaVersion: "1.0",
    start,
    providerCollection,
    resultBridge,
    evaluation: structuredClone(evaluation),
    viewModel: structuredClone(viewModel),
  };
}

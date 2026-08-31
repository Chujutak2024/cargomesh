import { buildProviderNavigationUrl } from "@/features/discovery/provider-navigation";
import type {
  CandidateProvider,
  ProviderToolEnvelope,
} from "@/features/providers/contracts";

import {
  INT02A_PROVIDER_TOOL_NAMES,
  type Int02aProviderToolName,
  type ProviderAttemptResult,
  type ProviderCleanupEvidence,
  type ProviderCollectionResult,
  type ProviderNavigationAdapter,
  type ProviderRunnerInputs,
  type ProviderRunnerWarning,
  type ProviderToolCallIdFactory,
  type ProviderToolCallRecord,
  type WebMcpRuntimeAdapter,
} from "./contracts";
import { createInt02aToolCallId } from "./tool-call-id";

type RunnerClock = () => Date;

export type ExecuteProviderCandidateOptions = {
  candidate: CandidateProvider;
  navigationUrl: string;
  orchestrationRunId: string;
  freightRequestId: string;
  attemptNumber: number;
  inputs: ProviderRunnerInputs;
  runtime: WebMcpRuntimeAdapter;
  createToolCallId?: ProviderToolCallIdFactory;
  signal?: AbortSignal;
  now?: RunnerClock;
};

export type RunProviderCollectionOptions = {
  candidates: readonly CandidateProvider[];
  baseUrl: string;
  orchestrationRunId: string;
  freightRequestId: string;
  navigation: ProviderNavigationAdapter;
  createInputs(candidate: CandidateProvider): ProviderRunnerInputs;
  createToolCallId?: ProviderToolCallIdFactory;
  getAttemptNumber?(candidate: CandidateProvider): number;
  signal?: AbortSignal;
  now?: RunnerClock;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseEnvelope(value: unknown): ProviderToolEnvelope<unknown> | null {
  if (!isRecord(value) || typeof value.ok !== "boolean") return null;

  if (value.ok) {
    return "data" in value ? { ok: true, data: value.data } : null;
  }

  if (
    !isRecord(value.error) ||
    typeof value.error.code !== "string" ||
    typeof value.error.message !== "string" ||
    typeof value.error.retryable !== "boolean"
  ) {
    return null;
  }

  return {
    ok: false,
    error: {
      code: value.error.code,
      message: value.error.message,
      retryable: value.error.retryable,
    },
  };
}

function toTechnicalError(error: unknown, fallbackCode: string) {
  if (error instanceof DOMException && error.name === "AbortError") {
    return {
      code: "ABORTED",
      message: error.message || "Provider tool execution was aborted.",
      retryable: true,
    };
  }

  const message = error instanceof Error ? error.message : String(error);
  const separator = message.indexOf(":");
  const explicitCode = separator > 0 ? message.slice(0, separator).trim() : null;

  return {
    code: explicitCode && /^[A-Z0-9_]+$/.test(explicitCode)
      ? explicitCode
      : fallbackCode,
    message,
    retryable: fallbackCode !== "INVALID_PROVIDER_ENVELOPE",
  };
}

function isCommerciallySupported(envelope: ProviderToolEnvelope<unknown>): boolean | null {
  if (!envelope.ok || !isRecord(envelope.data)) return null;
  return typeof envelope.data.supported === "boolean"
    ? envelope.data.supported
    : null;
}

function isCommerciallyAvailable(envelope: ProviderToolEnvelope<unknown>): boolean | null {
  if (!envelope.ok || !isRecord(envelope.data)) return null;
  return typeof envelope.data.available === "boolean"
    ? envelope.data.available
    : null;
}

function unverifiedCleanup(): ProviderCleanupEvidence {
  return { verified: false, activeToolNames: [] };
}

function warning(
  error: ReturnType<typeof toTechnicalError>,
  toolName: Int02aProviderToolName | null,
): ProviderRunnerWarning {
  return { ...error, toolName };
}

function failedAttempt(
  candidate: CandidateProvider,
  navigationUrl: string,
  issue: ProviderRunnerWarning,
): ProviderAttemptResult {
  return {
    candidate,
    navigationUrl,
    matchingServiceId: candidate.matchingServiceId,
    status: "FAILED",
    completedTools: [],
    stopReason: issue.code,
    calls: [],
    warnings: [issue],
    cleanup: unverifiedCleanup(),
  };
}

async function executeAndRecordTool(
  options: ExecuteProviderCandidateOptions,
  toolName: Int02aProviderToolName,
): Promise<ProviderToolCallRecord> {
  const now = options.now ?? (() => new Date());
  const toolInput = structuredClone(
    options.inputs[toolName],
  ) as Record<string, unknown>;
  const identity = {
    orchestrationRunId: options.orchestrationRunId,
    freightRequestId: options.freightRequestId,
    carrierId: options.candidate.carrierId,
    matchingServiceId: options.candidate.matchingServiceId,
    toolName,
    attemptNumber: options.attemptNumber,
  } as const;
  const toolCallId = (options.createToolCallId ?? createInt02aToolCallId)(
    identity,
  ).trim();

  if (!toolCallId) {
    throw new Error("INVALID_TOOL_CALL_ID: createToolCallId returned an empty value.");
  }

  const started = now();
  let rawOutput: unknown;

  try {
    rawOutput = await options.runtime.executeTool(
      toolName,
      structuredClone(toolInput),
      options.signal ?? new AbortController().signal,
    );
  } catch (error) {
    const completed = now();
    const technicalError = toTechnicalError(error, "WEBMCP_EXECUTION_FAILED");

    return {
      schemaVersion: "1.0",
      ...identity,
      toolCallId,
      providerUrl: options.candidate.providerUrl,
      navigationUrl: options.navigationUrl,
      toolInput,
      toolOutput: null,
      startedAt: started.toISOString(),
      completedAt: completed.toISOString(),
      durationMs: Math.max(0, completed.getTime() - started.getTime()),
      status: "TECHNICAL_ERROR",
      technicalError,
    };
  }

  const completed = now();
  const toolOutput = parseEnvelope(rawOutput);
  const technicalError = !toolOutput
    ? toTechnicalError(
        new Error("Provider returned a malformed ProviderToolEnvelope."),
        "INVALID_PROVIDER_ENVELOPE",
      )
    : toolOutput.ok
      ? null
      : toolOutput.error;

  return {
    schemaVersion: "1.0",
    ...identity,
    toolCallId,
    providerUrl: options.candidate.providerUrl,
    navigationUrl: options.navigationUrl,
    toolInput,
    toolOutput,
    startedAt: started.toISOString(),
    completedAt: completed.toISOString(),
    durationMs: Math.max(0, completed.getTime() - started.getTime()),
    status: technicalError ? "TECHNICAL_ERROR" : "COMPLETED",
    technicalError,
  };
}

export async function executeProviderCandidate(
  options: ExecuteProviderCandidateOptions,
): Promise<ProviderAttemptResult> {
  options.signal?.throwIfAborted();

  let registeredToolNames: string[];
  try {
    registeredToolNames = await options.runtime.getToolNames();
  } catch (error) {
    return failedAttempt(
      options.candidate,
      options.navigationUrl,
      warning(toTechnicalError(error, "WEBMCP_DISCOVERY_FAILED"), null),
    );
  }

  const missingTools = INT02A_PROVIDER_TOOL_NAMES.filter(
    (toolName) => !registeredToolNames.includes(toolName),
  );
  if (missingTools.length > 0) {
    return failedAttempt(
      options.candidate,
      options.navigationUrl,
      {
        code: "WEBMCP_TOOLS_MISSING",
        message: `Missing provider tools: ${missingTools.join(", ")}.`,
        retryable: true,
        toolName: null,
      },
    );
  }

  const calls: ProviderToolCallRecord[] = [];
  const completedTools: Int02aProviderToolName[] = [];
  const warnings: ProviderRunnerWarning[] = [];

  for (const toolName of INT02A_PROVIDER_TOOL_NAMES) {
    const call = await executeAndRecordTool(options, toolName);
    calls.push(call);

    if (call.status === "TECHNICAL_ERROR" || !call.toolOutput) {
      const issue = call.technicalError ?? {
        code: "WEBMCP_EXECUTION_FAILED",
        message: `${toolName} failed without a ProviderToolEnvelope.`,
        retryable: true,
      };
      warnings.push(warning(issue, toolName));

      return {
        candidate: options.candidate,
        navigationUrl: options.navigationUrl,
        matchingServiceId: options.candidate.matchingServiceId,
        status: "FAILED",
        completedTools,
        stopReason: issue.code,
        calls,
        warnings,
        cleanup: unverifiedCleanup(),
      };
    }

    completedTools.push(toolName);

    if (!call.toolOutput.ok) {
      warnings.push(warning(call.toolOutput.error, toolName));
      return {
        candidate: options.candidate,
        navigationUrl: options.navigationUrl,
        matchingServiceId: options.candidate.matchingServiceId,
        status: "FAILED",
        completedTools,
        stopReason: call.toolOutput.error.code,
        calls,
        warnings,
        cleanup: unverifiedCleanup(),
      };
    }

    if (toolName === "check_service_coverage") {
      const supported = isCommerciallySupported(call.toolOutput);
      if (supported === null) {
        const issue = {
          code: "INVALID_COVERAGE_RESULT",
          message: "Coverage result does not contain data.supported.",
          retryable: false,
        };
        warnings.push(warning(issue, toolName));
        return {
          candidate: options.candidate,
          navigationUrl: options.navigationUrl,
          matchingServiceId: options.candidate.matchingServiceId,
          status: "FAILED",
          completedTools,
          stopReason: issue.code,
          calls,
          warnings,
          cleanup: unverifiedCleanup(),
        };
      }
      if (!supported) {
        return {
          candidate: options.candidate,
          navigationUrl: options.navigationUrl,
          matchingServiceId: options.candidate.matchingServiceId,
          status: "REJECTED",
          completedTools,
          stopReason: "COVERAGE_NOT_SUPPORTED",
          calls,
          warnings,
          cleanup: unverifiedCleanup(),
        };
      }
    }

    if (toolName === "check_capacity") {
      const available = isCommerciallyAvailable(call.toolOutput);
      if (available === null) {
        const issue = {
          code: "INVALID_CAPACITY_RESULT",
          message: "Capacity result does not contain data.available.",
          retryable: false,
        };
        warnings.push(warning(issue, toolName));
        return {
          candidate: options.candidate,
          navigationUrl: options.navigationUrl,
          matchingServiceId: options.candidate.matchingServiceId,
          status: "FAILED",
          completedTools,
          stopReason: issue.code,
          calls,
          warnings,
          cleanup: unverifiedCleanup(),
        };
      }
      if (!available) {
        return {
          candidate: options.candidate,
          navigationUrl: options.navigationUrl,
          matchingServiceId: options.candidate.matchingServiceId,
          status: "REJECTED",
          completedTools,
          stopReason: "CAPACITY_NOT_AVAILABLE",
          calls,
          warnings,
          cleanup: unverifiedCleanup(),
        };
      }
    }
  }

  return {
    candidate: options.candidate,
    navigationUrl: options.navigationUrl,
    matchingServiceId: options.candidate.matchingServiceId,
    status: "QUOTED",
    completedTools,
    stopReason: null,
    calls,
    warnings,
    cleanup: unverifiedCleanup(),
  };
}

function cleanupEvidence(activeToolNames: string[]): ProviderCleanupEvidence {
  const remainingProviderTools = activeToolNames.filter((toolName) =>
    INT02A_PROVIDER_TOOL_NAMES.includes(toolName as Int02aProviderToolName),
  );

  return {
    verified: remainingProviderTools.length === 0,
    activeToolNames: [...activeToolNames],
  };
}

export async function runProviderCollection(
  options: RunProviderCollectionOptions,
): Promise<ProviderCollectionResult> {
  const attempts: ProviderAttemptResult[] = [];
  const collectionWarnings: ProviderRunnerWarning[] = [];
  const cleanupUrl = new URL("/", options.baseUrl).toString();
  const candidates = options.candidates.map((candidate) =>
    Object.freeze({ ...candidate }),
  );

  for (const candidate of candidates) {
    options.signal?.throwIfAborted();

    let navigationUrl: string;
    try {
      navigationUrl = buildProviderNavigationUrl(candidate, options.baseUrl);
      if (new URL(navigationUrl).searchParams.get("serviceId") !== candidate.matchingServiceId) {
        throw new Error(
          "MATCHING_SERVICE_MISMATCH: navigation lost the discovered matchingServiceId.",
        );
      }
    } catch (error) {
      const issue = warning(toTechnicalError(error, "NAVIGATION_URL_FAILED"), null);
      attempts.push(failedAttempt(candidate, candidate.providerUrl, issue));
      collectionWarnings.push(issue);
      continue;
    }

    let session;
    try {
      session = await options.navigation.open(navigationUrl, candidate);
    } catch (error) {
      const issue = warning(toTechnicalError(error, "PROVIDER_NAVIGATION_FAILED"), null);
      attempts.push(failedAttempt(candidate, navigationUrl, issue));
      collectionWarnings.push(issue);
      continue;
    }

    let attempt: ProviderAttemptResult;
    try {
      attempt = await executeProviderCandidate({
        candidate,
        navigationUrl,
        orchestrationRunId: options.orchestrationRunId,
        freightRequestId: options.freightRequestId,
        attemptNumber: (() => {
          const attemptNumber = options.getAttemptNumber?.(candidate) ?? 1;
          if (!Number.isInteger(attemptNumber) || attemptNumber < 1) {
            throw new Error(
              "INVALID_ATTEMPT_NUMBER: attemptNumber must be a positive integer.",
            );
          }
          return attemptNumber;
        })(),
        inputs: options.createInputs(candidate),
        runtime: session.runtime,
        createToolCallId: options.createToolCallId,
        signal: options.signal,
        now: options.now,
      });
    } catch (error) {
      const issue = warning(toTechnicalError(error, "PROVIDER_RUNNER_FAILED"), null);
      attempt = failedAttempt(candidate, navigationUrl, issue);
    }

    try {
      const activeToolNames = await session.leaveAndGetActiveToolNames(cleanupUrl);
      const cleanup = cleanupEvidence(activeToolNames);
      attempt = { ...attempt, cleanup };

      if (!cleanup.verified) {
        const issue: ProviderRunnerWarning = {
          code: "WEBMCP_CLEANUP_FAILED",
          message: "Provider tools remain registered after leaving the provider page.",
          retryable: true,
          toolName: null,
        };
        attempt.warnings = [...attempt.warnings, issue];
        collectionWarnings.push(issue);
      }
    } catch (error) {
      const issue = warning(toTechnicalError(error, "WEBMCP_CLEANUP_FAILED"), null);
      attempt = {
        ...attempt,
        cleanup: unverifiedCleanup(),
        warnings: [...attempt.warnings, issue],
      };
      collectionWarnings.push(issue);
    }

    attempts.push(attempt);
    collectionWarnings.push(...attempt.warnings.filter(
      (issue) => issue.code !== "WEBMCP_CLEANUP_FAILED",
    ));
  }

  return {
    schemaVersion: "1.0",
    orchestrationRunId: options.orchestrationRunId,
    freightRequestId: options.freightRequestId,
    candidateCount: candidates.length,
    completedCandidateCount: attempts.length,
    attempts,
    warnings: collectionWarnings,
  };
}

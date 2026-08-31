import type {
  CandidateProvider,
  ProviderToolEnvelope,
  QuoteFreightInput,
} from "@/features/providers/contracts";

export const INT02A_PROVIDER_TOOL_NAMES = [
  "check_service_coverage",
  "check_capacity",
  "quote_freight",
] as const;

export type Int02aProviderToolName =
  (typeof INT02A_PROVIDER_TOOL_NAMES)[number];

export type CheckServiceCoverageRunnerInput = {
  origin: string;
  destination: string;
  transport_mode: string;
  service_type: string;
  cargo_category: string;
};

export type CheckCapacityRunnerInput = {
  origin: string;
  destination: string;
  cargo_weight_kg: number;
  cargo_volume_m3?: number;
  cargo_category: string;
  pickup_mode: "ASAP" | "SCHEDULED";
  pickup_window_start?: string;
  pickup_window_end?: string;
  delivery_deadline?: string;
  special_requirements?: string[];
};

export type ProviderRunnerInputs = {
  check_service_coverage: CheckServiceCoverageRunnerInput;
  check_capacity: CheckCapacityRunnerInput;
  quote_freight: QuoteFreightInput;
};

export type ProviderToolCallIdentity = {
  orchestrationRunId: string;
  freightRequestId: string;
  carrierId: string;
  matchingServiceId: string;
  toolName: Int02aProviderToolName;
  attemptNumber: number;
};

export type ProviderToolCallIdFactory = (
  identity: ProviderToolCallIdentity,
) => string;

export type ProviderToolTechnicalError = {
  code: string;
  message: string;
  retryable: boolean;
};

export type ProviderToolCallRecord = ProviderToolCallIdentity & {
  schemaVersion: "1.0";
  toolCallId: string;
  providerUrl: string;
  navigationUrl: string;
  toolInput: Record<string, unknown>;
  toolOutput: ProviderToolEnvelope<unknown> | null;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  status: "COMPLETED" | "TECHNICAL_ERROR";
  technicalError: ProviderToolTechnicalError | null;
};

export type ProviderRunnerWarning = ProviderToolTechnicalError & {
  toolName: Int02aProviderToolName | null;
};

export type ProviderCleanupEvidence = {
  verified: boolean;
  activeToolNames: string[];
};

export type ProviderAttemptResult = {
  candidate: CandidateProvider;
  navigationUrl: string;
  matchingServiceId: string;
  status: "REJECTED" | "QUOTED" | "FAILED";
  completedTools: Int02aProviderToolName[];
  stopReason: string | null;
  calls: ProviderToolCallRecord[];
  warnings: ProviderRunnerWarning[];
  cleanup: ProviderCleanupEvidence;
};

export type ProviderCollectionResult = {
  schemaVersion: "1.0";
  orchestrationRunId: string;
  freightRequestId: string;
  candidateCount: number;
  completedCandidateCount: number;
  attempts: ProviderAttemptResult[];
  warnings: ProviderRunnerWarning[];
};

export type WebMcpRuntimeAdapter = {
  getToolNames(): Promise<string[]>;
  executeTool(
    toolName: Int02aProviderToolName,
    input: Record<string, unknown>,
    signal: AbortSignal,
  ): Promise<unknown>;
};

export type ProviderPageSession = {
  runtime: WebMcpRuntimeAdapter;
  /**
   * Abandons the provider document and returns the tool names exposed by the
   * newly active document. A valid cleanup has no INT-02A provider tools.
   */
  leaveAndGetActiveToolNames(cleanupUrl: string): Promise<string[]>;
};

export type ProviderNavigationAdapter = {
  open(
    navigationUrl: string,
    candidate: CandidateProvider,
  ): Promise<ProviderPageSession>;
};

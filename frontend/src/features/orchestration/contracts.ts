import type { FreightRanking } from "@/features/decision-engine/contracts";
import type { CandidateProvider } from "@/features/providers/contracts";

export const ORCHESTRATION_VIEW_MODEL_SCHEMA_VERSION = "1.0" as const;

export type OrchestrationToolName =
  | "check_service_coverage"
  | "check_capacity"
  | "quote_freight";

export type ProviderAttemptStatus =
  | "PENDING"
  | "RUNNING"
  | "REJECTED"
  | "QUOTED"
  | "FAILED";

export type ProviderAttemptView = CandidateProvider & {
  status: ProviderAttemptStatus;
  completedTools: OrchestrationToolName[];
  stopReason: string | null;
};

export type OrchestrationWarning = {
  code: string;
  message: string;
  retryable: boolean;
  carrierId: string | null;
  matchingServiceId: string | null;
  toolName: OrchestrationToolName | null;
};

export type RankedOfferView = {
  offerId: string;
  carrierId: string;
  carrierCode: string;
  displayName: string;
  matchingServiceId: string;
  providerOfferReference: string;
  totalPrice: number;
  currency: "USD";
  transitHours: number;
  rank: number;
  score: number;
  eligible: boolean;
  reasons: string[];
  recommended: boolean;
};

export type OrchestrationViewModelBase = {
  schemaVersion: typeof ORCHESTRATION_VIEW_MODEL_SCHEMA_VERSION;
  runId: string;
  freightRequestId: string;
  requestCode: string;
  startedAt: string;
  completedAt: string | null;
  candidateCount: number;
  completedCandidateCount: number;
  attempts: ProviderAttemptView[];
  warnings: OrchestrationWarning[];
};

export type OrchestrationLoadingViewModel = OrchestrationViewModelBase & {
  status: "loading";
  ranking: null;
  offers: [];
};

export type OrchestrationErrorViewModel = OrchestrationViewModelBase & {
  status: "error";
  error: { code: string; message: string; retryable: boolean };
  ranking: null;
  offers: [];
};

export type OrchestrationNoMatchViewModel = OrchestrationViewModelBase & {
  status: "NO_MATCH";
  reason: string;
  ranking: FreightRanking;
  offers: [];
};

export type OrchestrationSuccessViewModel = OrchestrationViewModelBase & {
  status: "success";
  ranking: FreightRanking;
  offers: RankedOfferView[];
};

export type OrchestrationViewModel =
  | OrchestrationLoadingViewModel
  | OrchestrationErrorViewModel
  | OrchestrationNoMatchViewModel
  | OrchestrationSuccessViewModel;

export type StartOrchestrationRunInput = {
  freightRequestId: string;
  idempotencyKey: string;
};

export type StartOrchestrationRunResult = {
  runId: string;
  freightRequestId: string;
  status: "RUNNING" | "OPTIONS_READY" | "NO_MATCH" | "FAILED" | "CANCELLED";
  deduplicated: boolean;
  candidates: CandidateProvider[];
};

export class OrchestrationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly httpStatus: number,
  ) {
    super(message);
    this.name = "OrchestrationError";
  }
}

import type {
  ProviderQuote,
  ProviderToolEnvelope,
} from "@/features/providers/contracts";
import type { CapacityResult } from "@/features/providers/check-capacity-tool";
import type { ServiceCoverageResult } from "@/features/providers/check-service-coverage-tool";

export type RecordableProviderToolName =
  | "check_service_coverage"
  | "check_capacity"
  | "quote_freight";

export type ProviderToolTechnicalError = {
  code: string;
  message: string;
  retryable: boolean;
};

export type RecordProviderResultInput = {
  toolCallId: string;
  orchestrationRunId: string;
  freightRequestId: string;
  carrierId: string;
  matchingServiceId: string;
  providerUrl: string;
  navigationUrl: string;
  toolName: RecordableProviderToolName;
  attemptNumber: number;
  toolInput: unknown;
  toolOutput: ProviderToolEnvelope<unknown> | null;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  status: "COMPLETED" | "TECHNICAL_ERROR";
  technicalError: ProviderToolTechnicalError | null;
  schemaVersion: "1.0";
};

type ValidatedProviderToolCallBase = Omit<
  RecordProviderResultInput,
  "toolName" | "toolInput" | "toolOutput"
>;

export type ValidatedRecordProviderResultInput =
  | (ValidatedProviderToolCallBase & {
      toolName: "check_service_coverage";
      toolInput: Record<string, unknown>;
      toolOutput: ProviderToolEnvelope<ServiceCoverageResult> | null;
    })
  | (ValidatedProviderToolCallBase & {
      toolName: "check_capacity";
      toolInput: Record<string, unknown>;
      toolOutput: ProviderToolEnvelope<CapacityResult> | null;
    })
  | (ValidatedProviderToolCallBase & {
      toolName: "quote_freight";
      toolInput: Record<string, unknown> & { freight_request_id: string };
      toolOutput: ProviderToolEnvelope<ProviderQuote> | null;
    });

export type RecordProviderResultResult = {
  eventId: string;
  recordId: string | null;
  recordType: "CARRIER_OFFER" | "BOOKING" | "BOOKING_EVENT" | null;
  status: "INSERTED" | "DEDUPLICATED" | "REJECTED";
  deduplicated: boolean;
};

export type RecordProviderResultRpcRow = {
  event_id: string;
  record_id: string | null;
  record_type: "CARRIER_OFFER" | "BOOKING" | "BOOKING_EVENT" | null;
  result_status: "INSERTED" | "DEDUPLICATED" | "REJECTED";
  deduplicated: boolean;
};

export class ResultBridgeError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly httpStatus: number,
  ) {
    super(message);
    this.name = "ResultBridgeError";
  }
}

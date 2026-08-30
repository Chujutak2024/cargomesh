import type {
  ProviderQuote,
  ProviderToolEnvelope,
} from "@/features/providers/contracts";

export type RecordProviderResultInput = {
  toolCallId: string;
  orchestrationRunId: string;
  freightRequestId: string;
  carrierId: string;
  providerUrl: string;
  toolName: string;
  toolInput: unknown;
  toolOutput: ProviderToolEnvelope<unknown>;
  startedAt: string;
  completedAt: string;
  schemaVersion: "1.0";
};

export type ValidatedRecordProviderResultInput = Omit<
  RecordProviderResultInput,
  "toolOutput"
> & {
  toolName: "quote_freight";
  toolOutput: ProviderToolEnvelope<ProviderQuote>;
};

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

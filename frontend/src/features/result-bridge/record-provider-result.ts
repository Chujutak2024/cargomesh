import "server-only";

import { get_candidate_provider_pages } from "@/features/discovery";
import { requireAuthenticatedMember } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database.types";
import {
  ResultBridgeError,
  type RecordProviderResultResult,
  type RecordProviderResultRpcRow,
  type ValidatedRecordProviderResultInput,
} from "./contracts";
import { parseRecordProviderResultInput } from "./validation";

type OrchestrationRunRow = {
  id: string;
  freight_request_id: string;
  status: string;
};

type FreightRequestRow = {
  id: string;
  organization_id: string;
};

function mapDatabaseError(message: string): ResultBridgeError {
  if (message.includes("IDEMPOTENCY_CONFLICT") || message.includes("PROVIDER_OFFER_CONFLICT")) {
    return new ResultBridgeError("IDEMPOTENCY_CONFLICT", message, 409);
  }
  if (message.includes("NOT_FOUND") || message.includes("CARRIER_NOT_AVAILABLE")) {
    return new ResultBridgeError("NOT_FOUND", message, 404);
  }
  if (message.includes("RUN_NOT_ACTIVE")) {
    return new ResultBridgeError("RUN_NOT_ACTIVE", message, 409);
  }
  if (
    message.includes("INVALID_") ||
    message.includes("MISMATCH") ||
    message.includes("CORRELATION_ERROR") ||
    message.includes("UNSUPPORTED_")
  ) {
    return new ResultBridgeError("RESULT_REJECTED", message, 422);
  }
  return new ResultBridgeError("RESULT_BRIDGE_UNAVAILABLE", message, 500);
}

async function persistProviderResult(
  input: ValidatedRecordProviderResultInput,
  cargomeshOrigin: string,
): Promise<RecordProviderResultResult> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("record_provider_result", {
    p_tool_call_id: input.toolCallId,
    p_orchestration_run_id: input.orchestrationRunId,
    p_freight_request_id: input.freightRequestId,
    p_carrier_id: input.carrierId,
    p_carrier_service_id: input.matchingServiceId,
    p_provider_url: input.providerUrl,
    p_navigation_url: input.navigationUrl,
    p_tool_name: input.toolName,
    p_attempt_number: input.attemptNumber,
    p_tool_input: input.toolInput as Json,
    p_tool_output: input.toolOutput as unknown as Json,
    p_started_at: input.startedAt,
    p_completed_at: input.completedAt,
    p_duration_ms: input.durationMs,
    p_execution_status: input.status,
    p_technical_error: input.technicalError as unknown as Json,
    p_cargomesh_origin: cargomeshOrigin,
    p_schema_version: input.schemaVersion,
  });

  if (error) throw mapDatabaseError(error.message);

  const row = (data as unknown as RecordProviderResultRpcRow[] | null)?.[0];
  if (!row) {
    throw new ResultBridgeError(
      "RESULT_BRIDGE_UNAVAILABLE",
      "Result Bridge returned no persistence result.",
      500,
    );
  }

  return {
    eventId: row.event_id,
    recordId: row.record_id,
    recordType: row.record_type,
    status: row.result_status,
    deduplicated: row.deduplicated,
  };
}

export async function record_provider_result(
  rawInput: unknown,
  cargomeshOrigin: string,
): Promise<RecordProviderResultResult> {
  const input = parseRecordProviderResultInput(rawInput, cargomeshOrigin);
  await requireAuthenticatedMember();
  const sessionClient = await createServerSupabaseClient();
  const { data: runData, error: runError } = await sessionClient
    .from("orchestration_runs")
    .select("id,freight_request_id,status")
    .eq("id", input.orchestrationRunId)
    .maybeSingle();

  if (runError) {
    throw new ResultBridgeError("RUN_LOOKUP_FAILED", "Unable to load orchestration run.", 500);
  }
  if (!runData) {
    throw new ResultBridgeError("RUN_NOT_FOUND", "Orchestration run not found.", 404);
  }

  const run = runData as OrchestrationRunRow;
  if (run.freight_request_id !== input.freightRequestId) {
    throw new ResultBridgeError(
      "CORRELATION_ERROR",
      "Orchestration run does not belong to the FreightRequest.",
      422,
    );
  }

  const { data: requestData, error: requestError } = await sessionClient
    .from("freight_requests")
    .select("id,organization_id")
    .eq("id", input.freightRequestId)
    .maybeSingle();

  if (requestError) {
    throw new ResultBridgeError("REQUEST_LOOKUP_FAILED", "Unable to load FreightRequest.", 500);
  }
  if (!requestData) {
    throw new ResultBridgeError("FREIGHT_REQUEST_NOT_FOUND", "FreightRequest not found.", 404);
  }

  const freightRequest = requestData as FreightRequestRow;
  await requireAuthenticatedMember({ organizationId: freightRequest.organization_id });

  // Replays are resolved before checking mutable run/candidate state. RLS has
  // already proven that the caller belongs to the run's organization; the
  // RPC compares the canonical payload and returns either dedupe or conflict.
  const { data: replayEvent, error: replayLookupError } = await sessionClient
    .from("orchestration_events")
    .select("id")
    .eq("tool_call_id", input.toolCallId)
    .maybeSingle();

  if (replayLookupError) {
    throw new ResultBridgeError(
      "REPLAY_LOOKUP_FAILED",
      "Unable to resolve Result Bridge replay.",
      500,
    );
  }
  if (replayEvent) return persistProviderResult(input, cargomeshOrigin);

  if (run.status !== "RUNNING") {
    throw new ResultBridgeError("RUN_NOT_ACTIVE", "Orchestration run must be RUNNING.", 409);
  }

  const discovery = await get_candidate_provider_pages(input.freightRequestId);
  if (!discovery) {
    throw new ResultBridgeError(
      "FREIGHT_REQUEST_NOT_FOUND",
      "FreightRequest not found.",
      404,
    );
  }

  const candidate = discovery.candidates.find(
    (item) =>
      item.carrierId === input.carrierId &&
      item.providerUrl === input.providerUrl &&
      item.matchingServiceId === input.matchingServiceId,
  );
  if (!candidate) {
    throw new ResultBridgeError(
      "CANDIDATE_MISMATCH",
      "Carrier, providerUrl and matchingServiceId are not part of the compatible candidate set.",
      422,
    );
  }

  return persistProviderResult(input, cargomeshOrigin);
}

export const recordProviderResult = record_provider_result;

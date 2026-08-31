import "server-only";

import { get_candidate_provider_pages } from "@/features/discovery";
import type { CandidateProvider } from "@/features/providers/contracts";
import { requireAuthenticatedMember } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database.types";
import {
  OrchestrationError,
  type StartOrchestrationRunResult,
} from "./contracts";
import { parseStartOrchestrationRunInput } from "./start-run-input";

type FreightRequestRow = {
  id: string;
  organization_id: string;
};

type StartRunRpcRow = {
  orchestration_run_id: string;
  freight_request_id: string;
  status: StartOrchestrationRunResult["status"];
  deduplicated: boolean;
  candidate_snapshot: Json;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseCandidateSnapshot(value: Json): CandidateProvider[] {
  if (!Array.isArray(value)) {
    throw new OrchestrationError(
      "ORCHESTRATION_SNAPSHOT_INVALID",
      "The persisted candidate snapshot is not an array.",
      500,
    );
  }

  return value.map((candidate) => {
    if (
      !isRecord(candidate) ||
      typeof candidate.carrierId !== "string" ||
      typeof candidate.carrierCode !== "string" ||
      typeof candidate.displayName !== "string" ||
      typeof candidate.providerUrl !== "string" ||
      typeof candidate.matchingServiceId !== "string"
    ) {
      throw new OrchestrationError(
        "ORCHESTRATION_SNAPSHOT_INVALID",
        "The persisted candidate snapshot has an invalid CandidateProvider.",
        500,
      );
    }
    return {
      carrierId: candidate.carrierId,
      carrierCode: candidate.carrierCode,
      displayName: candidate.displayName,
      providerUrl: candidate.providerUrl,
      matchingServiceId: candidate.matchingServiceId,
    };
  });
}

function mapStartRunError(message: string): OrchestrationError {
  if (message.includes("NOT_FOUND")) {
    return new OrchestrationError("NOT_FOUND", message, 404);
  }
  if (message.includes("FORBIDDEN") || message.includes("CORRELATION_ERROR")) {
    return new OrchestrationError("FORBIDDEN", message, 403);
  }
  if (message.includes("FREIGHT_REQUEST_NOT_READY")) {
    return new OrchestrationError("FREIGHT_REQUEST_NOT_READY", message, 409);
  }
  if (message.includes("INVALID_ARGUMENT")) {
    return new OrchestrationError("INVALID_ARGUMENT", message, 400);
  }
  return new OrchestrationError("ORCHESTRATION_START_FAILED", message, 500);
}

/**
 * Starts an INITIAL orchestration only after the session client has proved
 * membership and RLS access to the request. The service-role RPC is reached
 * only after that boundary and persists the immutable discovery snapshot.
 */
export async function start_orchestration_run(
  rawInput: unknown,
): Promise<StartOrchestrationRunResult> {
  const input = parseStartOrchestrationRunInput(rawInput);
  const member = await requireAuthenticatedMember();
  const sessionClient = await createServerSupabaseClient();

  const { data: requestData, error: requestError } = await sessionClient
    .from("freight_requests")
    .select("id,organization_id")
    .eq("id", input.freightRequestId)
    .maybeSingle();

  if (requestError) {
    throw new OrchestrationError(
      "ORCHESTRATION_START_FAILED",
      "Unable to load FreightRequest before starting orchestration.",
      500,
    );
  }
  if (!requestData) {
    throw new OrchestrationError("NOT_FOUND", "FreightRequest not found.", 404);
  }

  const freightRequest = requestData as unknown as FreightRequestRow;
  await requireAuthenticatedMember({ organizationId: freightRequest.organization_id });

  const discovery = await get_candidate_provider_pages(input.freightRequestId);
  if (!discovery) {
    throw new OrchestrationError("NOT_FOUND", "FreightRequest not found.", 404);
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("start_orchestration_run", {
    p_freight_request_id: input.freightRequestId,
    p_created_by_member_id: member.memberId,
    p_idempotency_key: input.idempotencyKey,
    p_candidate_snapshot: discovery.candidates as unknown as Json,
  });

  if (error) throw mapStartRunError(error.message);

  const row = (data as unknown as StartRunRpcRow[] | null)?.[0];
  if (!row) {
    throw new OrchestrationError(
      "ORCHESTRATION_START_FAILED",
      "The orchestration start RPC returned no result.",
      500,
    );
  }

  return {
    runId: row.orchestration_run_id,
    freightRequestId: row.freight_request_id,
    status: row.status,
    deduplicated: row.deduplicated,
    candidates: parseCandidateSnapshot(row.candidate_snapshot),
  };
}

export const startOrchestrationRun = start_orchestration_run;

import "server-only";

import { requireAuthenticatedMember } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { OrchestrationError, type OrchestrationViewModel } from "./contracts";
import { buildOrchestrationViewModel, type ViewModelSource } from "./view-model";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Reads only persisted, RLS-visible state. It never calls discovery, tools or BALANCED. */
export async function get_orchestration_view_model(
  orchestrationRunId: string,
): Promise<OrchestrationViewModel> {
  if (!UUID_PATTERN.test(orchestrationRunId)) {
    throw new OrchestrationError("INVALID_ARGUMENT", "runId must be a UUID.", 400);
  }

  await requireAuthenticatedMember();
  const supabase = await createServerSupabaseClient();
  const { data: runData, error: runError } = await supabase
    .from("orchestration_runs")
    .select(
      "id,freight_request_id,status,started_at,completed_at,error_code,error_message,candidate_snapshot,result_snapshot",
    )
    .eq("id", orchestrationRunId)
    .maybeSingle();

  if (runError) {
    throw new OrchestrationError("ORCHESTRATION_VIEW_MODEL_FAILED", "Unable to load run.", 500);
  }
  if (!runData) throw new OrchestrationError("NOT_FOUND", "Orchestration run not found.", 404);
  const run = runData as unknown as ViewModelSource["run"];

  const { data: requestData, error: requestError } = await supabase
    .from("freight_requests")
    .select("id,code,organization_id")
    .eq("id", run.freight_request_id)
    .maybeSingle();
  if (requestError) {
    throw new OrchestrationError(
      "ORCHESTRATION_VIEW_MODEL_FAILED",
      "Unable to load FreightRequest.",
      500,
    );
  }
  if (!requestData) throw new OrchestrationError("NOT_FOUND", "FreightRequest not found.", 404);
  const freightRequest = requestData as unknown as ViewModelSource["freightRequest"];
  await requireAuthenticatedMember({ organizationId: freightRequest.organization_id });

  const [{ data: eventData, error: eventError }, { data: offerData, error: offerError }, { data: decisionData, error: decisionError }] =
    await Promise.all([
      supabase
        .from("orchestration_events")
        .select(
          "carrier_id,carrier_service_id,provider_url,tool_name,status,execution_status,output_payload,technical_error,completed_at,created_at",
        )
        .eq("orchestration_run_id", orchestrationRunId),
      supabase
        .from("carrier_offers")
        .select("id,carrier_id,carrier_service_id,provider_offer_reference,price,currency,transit_hours,available_capacity_kg,available_volume_m3,estimated_pickup,estimated_delivery,reliability_score,availability_class,vehicle_id")
        .eq("orchestration_run_id", orchestrationRunId),
      supabase.from("freight_decisions").select("subscores").eq("orchestration_run_id", orchestrationRunId).maybeSingle(),
    ]);

  if (eventError || offerError || decisionError) {
    throw new OrchestrationError(
      "ORCHESTRATION_VIEW_MODEL_FAILED",
      "Unable to load persisted provider results.",
      500,
    );
  }

  return buildOrchestrationViewModel({
    run,
    freightRequest,
    events: eventData ?? [],
    offers: offerData ?? [],
    decisionSubscores: (decisionData as unknown as { subscores: import("@/types/database.types").Json } | null)?.subscores ?? null,
  } as unknown as ViewModelSource);
}

export const getOrchestrationViewModel = get_orchestration_view_model;

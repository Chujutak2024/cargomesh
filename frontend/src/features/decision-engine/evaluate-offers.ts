import "server-only";

import { requireAuthenticatedMember } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database.types";
import { evaluateBalancedOffers } from "./balanced";
import type {
  AvailabilityClass,
} from "@/features/providers/contracts";
import type {
  BalancedDecisionEvaluation,
  BalancedOfferInput,
} from "./contracts";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type EvaluationResult = BalancedDecisionEvaluation & {
  decisionId: string | null;
};

type RunRow = {
  id: string;
  freight_request_id: string;
  status: string;
};

type FreightRequestRow = {
  id: string;
  organization_id: string;
  budget_max: number | null;
  delivery_deadline: string | null;
  cross_border: boolean;
  available_documents: Json;
};

type OfferRow = {
  id: string;
  orchestration_run_id: string;
  carrier_id: string;
  provider_offer_reference: string;
  price: number;
  currency: string;
  transit_hours: number;
  status: string;
  availability_class: string;
  reliability_score: number;
  route_operations: number;
  organization_history_score: number;
  compatibility_notes: Json | null;
  valid_until: string;
  estimated_delivery: string;
};

type CompatibilityNotes = {
  crossBorderSupported?: boolean;
  customsCoordinationIncluded?: boolean;
  requiredDocuments?: string[];
  historicalAverageRouteCost?: number | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function compatibilityNotes(value: Json | null): CompatibilityNotes {
  if (!isRecord(value)) return {};
  return {
    crossBorderSupported:
      typeof value.crossBorderSupported === "boolean" ? value.crossBorderSupported : undefined,
    customsCoordinationIncluded:
      typeof value.customsCoordinationIncluded === "boolean"
        ? value.customsCoordinationIncluded
        : undefined,
    requiredDocuments: Array.isArray(value.requiredDocuments)
      ? value.requiredDocuments.filter((item): item is string => typeof item === "string")
      : undefined,
    historicalAverageRouteCost:
      typeof value.historicalAverageRouteCost === "number"
        ? value.historicalAverageRouteCost
        : null,
  };
}

function normalizedDocuments(value: Json): Set<string> {
  if (!Array.isArray(value)) return new Set();
  return new Set(
    value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim().toUpperCase()),
  );
}

export async function evaluate_offers(
  orchestrationRunId: string,
  options: { now?: Date } = {},
): Promise<EvaluationResult> {
  if (!UUID_PATTERN.test(orchestrationRunId)) {
    throw new Error("INVALID_ARGUMENT: orchestrationRunId must be a UUID.");
  }

  await requireAuthenticatedMember();
  const supabase = await createServerSupabaseClient();
  const { data: runData, error: runError } = await supabase
    .from("orchestration_runs")
    .select("id,freight_request_id,status")
    .eq("id", orchestrationRunId)
    .maybeSingle();

  if (runError) throw new Error("EVALUATION_UNAVAILABLE: Unable to load orchestration run.");
  if (!runData) throw new Error("NOT_FOUND: Orchestration run not found.");
  const run = runData as unknown as RunRow;
  if (run.status !== "RUNNING") throw new Error("RUN_NOT_ACTIVE: Run must be RUNNING.");

  const { data: requestData, error: requestError } = await supabase
    .from("freight_requests")
    .select("id,organization_id,budget_max,delivery_deadline,cross_border,available_documents")
    .eq("id", run.freight_request_id)
    .maybeSingle();

  if (requestError) throw new Error("EVALUATION_UNAVAILABLE: Unable to load FreightRequest.");
  if (!requestData) throw new Error("NOT_FOUND: FreightRequest not found.");
  const request = requestData as unknown as FreightRequestRow;
  await requireAuthenticatedMember({ organizationId: request.organization_id });

  const { data: offerRows, error: offersError } = await supabase
    .from("carrier_offers")
    .select("id,orchestration_run_id,carrier_id,provider_offer_reference,price,currency,transit_hours,status,availability_class,reliability_score,route_operations,organization_history_score,compatibility_notes,valid_until,estimated_delivery")
    .eq("orchestration_run_id", orchestrationRunId);

  if (offersError) throw new Error("EVALUATION_UNAVAILABLE: Unable to load CarrierOffers.");

  const now = options.now ?? new Date();
  const requestDocuments = normalizedDocuments(request.available_documents);
  const offers: BalancedOfferInput[] = ((offerRows ?? []) as unknown as OfferRow[]).map((offer) => {
    const notes = compatibilityNotes(offer.compatibility_notes);
    const ineligibilityReasons: string[] = [];

    if (offer.status !== "RECEIVED" && offer.status !== "ELIGIBLE") {
      ineligibilityReasons.push(`La oferta no puede evaluarse desde el estado ${offer.status}.`);
    }
    if (Date.parse(offer.valid_until) <= now.getTime()) {
      ineligibilityReasons.push("La vigencia de la oferta expiró.");
    }
    if (request.budget_max !== null && Number(offer.price) > Number(request.budget_max)) {
      ineligibilityReasons.push("El precio supera el presupuesto máximo.");
    }
    if (
      request.delivery_deadline !== null &&
      Date.parse(offer.estimated_delivery) > Date.parse(request.delivery_deadline)
    ) {
      ineligibilityReasons.push("La entrega estimada supera el deadline.");
    }
    if (request.cross_border && !notes.crossBorderSupported) {
      ineligibilityReasons.push("El provider no confirmó soporte cross-border.");
    }
    if (request.cross_border && !notes.customsCoordinationIncluded) {
      ineligibilityReasons.push("La coordinación aduanera requerida no está incluida.");
    }

    const missingDocuments = (notes.requiredDocuments ?? []).filter(
      (document) => !requestDocuments.has(document.trim().toUpperCase()),
    );
    if (missingDocuments.length > 0) {
      ineligibilityReasons.push(`Faltan documentos: ${missingDocuments.join(", ")}.`);
    }

    return {
      offerId: offer.id,
      orchestrationRunId: offer.orchestration_run_id,
      carrierId: offer.carrier_id,
      providerOfferReference: offer.provider_offer_reference,
      totalPrice: Number(offer.price),
      currency: offer.currency as "USD",
      transitHours: Number(offer.transit_hours),
      status: offer.status as BalancedOfferInput["status"],
      availabilityClass: offer.availability_class as AvailabilityClass,
      reliabilityScore: Number(offer.reliability_score),
      routeOperations: offer.route_operations,
      organizationHistoryScore: Number(offer.organization_history_score),
      historicalAveragePrice: notes.historicalAverageRouteCost ?? null,
      eligible: ineligibilityReasons.length === 0,
      ineligibilityReasons,
    };
  });

  const evaluation = evaluateBalancedOffers(orchestrationRunId, offers);
  const admin = createAdminClient();
  const { data: persistence, error: persistenceError } = await admin.rpc(
    "persist_balanced_decision",
    {
      p_orchestration_run_id: orchestrationRunId,
      p_freight_request_id: request.id,
      p_ranking: evaluation.ranking as unknown as Json,
      p_candidate_snapshot: evaluation.candidateSnapshot as unknown as Json,
      p_confidence_score: evaluation.ranking.decisionConfidence,
      p_confidence_components: evaluation.confidenceComponents as unknown as Json,
      p_subscores: evaluation.subscores as unknown as Json,
      p_anomaly_evidence: evaluation.anomalyEvidence as unknown as Json,
      // Supabase's generator models nullable RPC parameters as `string`; the
      // database intentionally accepts NULL to persist the NO_MATCH branch.
      p_recommended_offer_id:
        evaluation.ranking.recommendedOfferId ?? (null as unknown as string),
      p_requires_review: evaluation.requiresReview,
    },
  );

  if (persistenceError) {
    throw new Error(`EVALUATION_PERSISTENCE_FAILED: ${persistenceError.message}`);
  }

  const persisted = (persistence as unknown as Array<{
    decision_id: string | null;
    run_status: "OPTIONS_READY" | "NO_MATCH";
  }> | null)?.[0];

  if (!persisted || persisted.run_status !== evaluation.runStatus) {
    throw new Error("EVALUATION_PERSISTENCE_FAILED: Unexpected persistence result.");
  }

  return { ...evaluation, decisionId: persisted.decision_id };
}

export const evaluateOffers = evaluate_offers;

import type { FreightRanking } from "@/features/decision-engine/contracts";
import type { CandidateProvider } from "@/features/providers/contracts";
import type { Json } from "@/types/database.types";
import {
  ORCHESTRATION_VIEW_MODEL_SCHEMA_VERSION,
  OrchestrationError,
  type OrchestrationToolName,
  type OrchestrationViewModel,
  type OrchestrationWarning,
  type ProviderAttemptStatus,
  type ProviderAttemptView,
  type RankedOfferView,
} from "./contracts";

type RunRow = {
  id: string;
  freight_request_id: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  error_code: string | null;
  error_message: string | null;
  candidate_snapshot: Json;
  result_snapshot: Json | null;
};

type FreightRequestRow = {
  id: string;
  code: string;
  organization_id: string;
};

type EventRow = {
  carrier_id: string | null;
  carrier_service_id: string | null;
  provider_url: string | null;
  tool_name: string | null;
  status: string;
  execution_status: string | null;
  output_payload: Json | null;
  technical_error: Json | null;
  completed_at: string | null;
  created_at: string;
};

type OfferRow = {
  id: string;
  carrier_id: string;
  carrier_service_id: string | null;
  provider_offer_reference: string;
  price: number;
  currency: string;
  transit_hours: number;
  available_capacity_kg?: number;
  available_volume_m3?: number | null;
  estimated_pickup?: string;
  estimated_delivery?: string;
  reliability_score?: number;
  availability_class?: string;
  vehicle_id?: string | null;
};

export type ViewModelSource = {
  run: RunRow;
  freightRequest: FreightRequestRow;
  events: EventRow[];
  offers: OfferRow[];
  decisionSubscores?: Json | null;
};

function subscoresFor(value: Json | null | undefined, offerId: string): RankedOfferView["subscores"] {
  if (!isRecord(value) || !isRecord(value[offerId])) return null;
  const row = value[offerId] as Record<string, unknown>;
  const keys = ["cost", "reliability", "eta", "availability", "routeExperience", "organizationHistory"] as const;
  if (!keys.every((key) => typeof row[key] === "number")) return null;
  return Object.fromEntries(keys.map((key) => [key, row[key]])) as NonNullable<RankedOfferView["subscores"]>;
}

type RankingOption = FreightRanking["options"][number];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isToolName(value: string | null): value is OrchestrationToolName {
  return value === "check_service_coverage" || value === "check_capacity" || value === "quote_freight";
}

function snapshotCandidates(value: Json): CandidateProvider[] {
  if (!Array.isArray(value)) {
    throw new OrchestrationError(
      "ORCHESTRATION_SNAPSHOT_INVALID",
      "The candidate snapshot is not an array.",
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
        "The candidate snapshot contains an invalid CandidateProvider.",
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

function eventBelongsToCandidate(event: EventRow, candidate: CandidateProvider): boolean {
  return (
    event.carrier_id === candidate.carrierId &&
    event.carrier_service_id === candidate.matchingServiceId &&
    event.provider_url === candidate.providerUrl
  );
}

function successfulData(value: Json | null): Record<string, unknown> | null {
  if (!isRecord(value) || value.ok !== true || !isRecord(value.data)) return null;
  return value.data;
}

function technicalError(value: Json | null): {
  code: string;
  message: string;
  retryable: boolean;
} | null {
  if (!isRecord(value) || typeof value.code !== "string" || typeof value.message !== "string") {
    return null;
  }
  return {
    code: value.code,
    message: value.message,
    retryable: typeof value.retryable === "boolean" ? value.retryable : true,
  };
}

function toWarning(event: EventRow): OrchestrationWarning | null {
  if (event.execution_status !== "TECHNICAL_ERROR" && event.status !== "FAILED") return null;
  const error = technicalError(event.technical_error);
  return {
    code: error?.code ?? "PROVIDER_TOOL_FAILED",
    message: error?.message ?? "The provider tool did not complete successfully.",
    retryable: error?.retryable ?? true,
    carrierId: event.carrier_id,
    matchingServiceId: event.carrier_service_id,
    toolName: isToolName(event.tool_name) ? event.tool_name : null,
  };
}

function attemptForCandidate(candidate: CandidateProvider, events: EventRow[], offers: OfferRow[]): ProviderAttemptView {
  const candidateEvents = events
    .filter((event) => eventBelongsToCandidate(event, candidate))
    .sort((left, right) => (left.completed_at ?? left.created_at).localeCompare(right.completed_at ?? right.created_at));
  const completedTools = [...new Set(candidateEvents.map((event) => event.tool_name).filter(isToolName))];
  const coverage = candidateEvents.find(
    (event) => event.tool_name === "check_service_coverage" && successfulData(event.output_payload)?.supported === false,
  );
  const capacity = candidateEvents.find(
    (event) => event.tool_name === "check_capacity" && successfulData(event.output_payload)?.available === false,
  );
  const hasQuote = offers.some(
    (offer) =>
      offer.carrier_id === candidate.carrierId && offer.carrier_service_id === candidate.matchingServiceId,
  );
  const hasTechnicalFailure = candidateEvents.some(
    (event) => event.execution_status === "TECHNICAL_ERROR" || event.status === "FAILED",
  );

  let status: ProviderAttemptStatus = "PENDING";
  let stopReason: string | null = null;
  if (hasQuote) {
    status = "QUOTED";
  } else if (coverage) {
    status = "REJECTED";
    stopReason = "The provider rejected service coverage for this request.";
  } else if (capacity) {
    status = "REJECTED";
    stopReason = "The provider reported insufficient capacity for this request.";
  } else if (hasTechnicalFailure) {
    status = "FAILED";
    stopReason = "A provider tool failed before a quote could be persisted.";
  } else if (candidateEvents.length > 0) {
    status = "RUNNING";
  }

  return { ...candidate, status, completedTools, stopReason };
}

function rankingOption(value: unknown): RankingOption | null {
  if (
    !isRecord(value) ||
    typeof value.offerId !== "string" ||
    typeof value.rank !== "number" ||
    typeof value.rawScore !== "number" ||
    typeof value.roundedScore !== "number" ||
    typeof value.eligible !== "boolean" ||
    !Array.isArray(value.reasons) ||
    !value.reasons.every((reason) => typeof reason === "string")
  ) {
    return null;
  }
  return {
    offerId: value.offerId,
    rank: value.rank,
    rawScore: value.rawScore,
    roundedScore: value.roundedScore,
    eligible: value.eligible,
    reasons: value.reasons,
  };
}

function storedRanking(value: Json | null, runId: string): FreightRanking | null {
  if (!isRecord(value) || value.orchestrationRunId !== runId || value.strategy !== "BALANCED") {
    return null;
  }
  if (typeof value.decisionConfidence !== "number" || !Array.isArray(value.options)) return null;
  if (value.recommendedOfferId !== null && typeof value.recommendedOfferId !== "string") return null;

  const options = value.options.map(rankingOption);
  if (options.some((option) => option === null)) return null;
  return {
    orchestrationRunId: runId,
    strategy: "BALANCED",
    recommendedOfferId: value.recommendedOfferId,
    decisionConfidence: value.decisionConfidence,
    options: options as RankingOption[],
  };
}

function noMatchFallback(runId: string): FreightRanking {
  return {
    orchestrationRunId: runId,
    strategy: "BALANCED",
    recommendedOfferId: null,
    decisionConfidence: 0,
    options: [],
  };
}

function rankedOffers(
  offers: OfferRow[],
  candidates: CandidateProvider[],
  ranking: FreightRanking,
  decisionSubscores?: Json | null,
): RankedOfferView[] {
  const candidatesByCarrierService = new Map(
    candidates.map((candidate) => [`${candidate.carrierId}:${candidate.matchingServiceId}`, candidate]),
  );
  const optionsByOfferId = new Map(ranking.options.map((option) => [option.offerId, option]));

  return offers
    .map((offer) => {
      const option = optionsByOfferId.get(offer.id);
      const candidate = offer.carrier_service_id
        ? candidatesByCarrierService.get(`${offer.carrier_id}:${offer.carrier_service_id}`)
        : undefined;
      if (!option || !candidate || !offer.carrier_service_id || offer.currency !== "USD") return null;
      const view: RankedOfferView = {
        offerId: offer.id,
        carrierId: offer.carrier_id,
        carrierCode: candidate.carrierCode,
        displayName: candidate.displayName,
        matchingServiceId: offer.carrier_service_id,
        providerOfferReference: offer.provider_offer_reference,
        totalPrice: Number(offer.price),
        currency: "USD" as const,
        transitHours: Number(offer.transit_hours),
        rank: option.rank,
        score: option.roundedScore,
        eligible: option.eligible,
        reasons: option.reasons,
        recommended: ranking.recommendedOfferId === offer.id,
      };
      if (offer.available_capacity_kg !== undefined) view.availableCapacityKg = offer.available_capacity_kg;
      if (offer.available_volume_m3 !== undefined) view.availableVolumeM3 = offer.available_volume_m3;
      if (offer.estimated_pickup !== undefined) view.estimatedPickup = offer.estimated_pickup;
      if (offer.estimated_delivery !== undefined) view.estimatedDelivery = offer.estimated_delivery;
      if (offer.reliability_score !== undefined) view.reliabilityScore = offer.reliability_score;
      if (offer.availability_class !== undefined) view.availabilityClass = offer.availability_class;
      if (offer.vehicle_id !== undefined) view.vehicleId = offer.vehicle_id;
      const subscores = subscoresFor(decisionSubscores, offer.id);
      if (subscores) view.subscores = subscores;
      return view;
    })
    .filter((offer): offer is RankedOfferView => offer !== null)
    .sort((left, right) => left.rank - right.rank);
}

export function buildOrchestrationViewModel(source: ViewModelSource): OrchestrationViewModel {
  const candidates = snapshotCandidates(source.run.candidate_snapshot);
  const attempts = candidates.map((candidate) => attemptForCandidate(candidate, source.events, source.offers));
  const warnings = source.events
    .map(toWarning)
    .filter((warning): warning is OrchestrationWarning => warning !== null);
  const base = {
    schemaVersion: ORCHESTRATION_VIEW_MODEL_SCHEMA_VERSION,
    runId: source.run.id,
    freightRequestId: source.run.freight_request_id,
    requestCode: source.freightRequest.code,
    startedAt: source.run.started_at,
    completedAt: source.run.completed_at,
    candidateCount: candidates.length,
    completedCandidateCount: attempts.filter((attempt) =>
      attempt.status === "REJECTED" || attempt.status === "QUOTED" || attempt.status === "FAILED",
    ).length,
    attempts,
    warnings,
  } as const;

  if (source.run.status === "RUNNING") {
    return { ...base, status: "loading", ranking: null, offers: [] };
  }
  if (source.run.status === "FAILED" || source.run.status === "CANCELLED") {
    return {
      ...base,
      status: "error",
      error: {
        code: source.run.error_code ?? (source.run.status === "CANCELLED" ? "RUN_CANCELLED" : "RUN_FAILED"),
        message:
          source.run.error_message ??
          (source.run.status === "CANCELLED"
            ? "The orchestration run was cancelled."
            : "The orchestration run failed before it could produce a result."),
        retryable: source.run.status !== "CANCELLED",
      },
      ranking: null,
      offers: [],
    };
  }

  const ranking = storedRanking(source.run.result_snapshot, source.run.id);
  if (source.run.status === "NO_MATCH") {
    return {
      ...base,
      status: "NO_MATCH",
      reason:
        ranking?.options.length === 0
          ? "No compatible provider produced an eligible offer."
          : "BALANCED found no eligible provider offer for this request.",
      ranking: ranking ?? noMatchFallback(source.run.id),
      offers: [],
    };
  }
  if (source.run.status === "OPTIONS_READY" && ranking) {
    return {
      ...base,
      status: "success",
      ranking,
      offers: rankedOffers(source.offers, candidates, ranking, source.decisionSubscores),
    };
  }

  throw new OrchestrationError(
    "ORCHESTRATION_VIEW_MODEL_INVALID",
    `Run ${source.run.id} has unsupported persisted status ${source.run.status}.`,
    500,
  );
}

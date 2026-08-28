import { dataStore } from "../features/freight/store";
import { CarrierMetrics, FreightDecision, FreightRequest } from "../features/freight/types";
import { WebMCPToolDefinition } from "./polyfill";
import { validateHardConstraints } from "../features/decision-engine/hard-constraints";
import { scoreOffers } from "../features/decision-engine/heuristic";
import { evaluateDecisionConfidence } from "../features/decision-engine/confidence";
import { detectPriceAnomaly } from "../features/decision-engine/anomaly";
import { generateExplanation } from "../features/decision-engine/explainability";

// 1. get_organization_context
export async function executeGetOrganizationContext(organizationId: string) {
  const org = dataStore.getOrganization();
  const prefs = dataStore.getPreferences();
  return {
    organization: org,
    preferences: prefs,
    historical_trips_completed: 18,
    trusted_carriers: ["car-andes", "car-inca"],
  };
}

// 2. get_freight_request
export async function executeGetFreightRequest(requestId: string): Promise<FreightRequest | null> {
  return dataStore.getFreightRequestById(requestId);
}

// 3. get_carrier_metrics
export async function executeGetCarrierMetrics(carrierId: string): Promise<CarrierMetrics | null> {
  return dataStore.getMetricsForCarrier(carrierId);
}

// 4. evaluate_offers
export async function executeEvaluateOffers(requestId: string) {
  const request = dataStore.getFreightRequestById(requestId);
  if (!request) throw new Error(`Freight request ${requestId} not found.`);

  const offers = dataStore.getOffers(requestId);
  if (offers.length === 0) throw new Error(`No offers collected for request ${requestId}.`);

  const metricsMap = dataStore.getAllMetrics();
  const prefs = dataStore.getPreferences();

  // Score candidates with Heuristic Engine
  const rankedOffers = scoreOffers(offers, metricsMap, request, prefs);
  const winner = rankedOffers[0];

  // Anomaly check on winner
  const winnerMetrics = metricsMap[winner.carrier_id];
  const anomaly = detectPriceAnomaly(winner.price, winnerMetrics?.avg_cost || winner.price);

  // Confidence check
  const confidence = evaluateDecisionConfidence(rankedOffers, prefs, anomaly.isAnomaly);

  // Generate explainability
  const explanation = generateExplanation(winner, rankedOffers, metricsMap, request);

  const decision: FreightDecision = {
    id: `dec-${Date.now()}`,
    freight_request_id: request.id,
    selected_offer_id: winner.id,
    winner_carrier_id: winner.carrier_id,
    winner_carrier_name: winner.carrier_name,
    optimization_strategy: request.optimization_strategy,
    heuristic_score: winner.scores.total,
    second_score: rankedOffers[1]?.scores.total || 0,
    confidence_score: confidence.confidenceScore,
    decision_reason: explanation.summary,
    explanation_bullets: explanation.winnerBullets,
    candidate_snapshot: rankedOffers,
    requires_review: !confidence.canAutoBook,
    review_reason: !confidence.canAutoBook ? confidence.reason : undefined,
    auto_booked: confidence.canAutoBook,
    created_at: new Date().toISOString(),
  };

  dataStore.saveDecision(decision);

  return {
    decision,
    ranked_candidates: rankedOffers,
    confidence_evaluation: confidence,
    explanation,
  };
}

// 5. record_decision
export async function executeRecordDecision(decision: FreightDecision) {
  return dataStore.saveDecision(decision);
}

// Export WebMCP Tool Definitions
export const CARGOMESH_WEBMCP_TOOLS: WebMCPToolDefinition[] = [
  {
    name: "get_organization_context",
    description: "Fetches enterprise policies, past corridor trips and optimization preferences.",
    inputSchema: {
      type: "object",
      properties: {
        organization_id: { type: "string" },
      },
      required: ["organization_id"],
    },
    execute: async (input: { organization_id: string }) => executeGetOrganizationContext(input.organization_id),
  },
  {
    name: "get_freight_request",
    description: "Retrieves normalized freight request intent and hard operational parameters.",
    inputSchema: {
      type: "object",
      properties: {
        request_id: { type: "string" },
      },
      required: ["request_id"],
    },
    execute: async (input: { request_id: string }) => executeGetFreightRequest(input.request_id),
  },
  {
    name: "get_carrier_metrics",
    description: "Retrieves historical SLA reliability, average delays and corridor experience for a carrier.",
    inputSchema: {
      type: "object",
      properties: {
        carrier_id: { type: "string" },
      },
      required: ["carrier_id"],
    },
    execute: async (input: { carrier_id: string }) => executeGetCarrierMetrics(input.carrier_id),
  },
  {
    name: "evaluate_offers",
    description: "Executes the transparent multicriteria heuristic decision engine and produces an explainable decision.",
    inputSchema: {
      type: "object",
      properties: {
        request_id: { type: "string" },
      },
      required: ["request_id"],
    },
    execute: async (input: { request_id: string }) => executeEvaluateOffers(input.request_id),
  },
];

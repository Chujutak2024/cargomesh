import { dataStore } from "../freight/store";
import {
  Booking,
  CarrierOffer,
  FreightDecision,
  FreightRequest,
  OrchestrationStep,
} from "../freight/types";
import { validateHardConstraints } from "../decision-engine/hard-constraints";
import {
  executeCheckCapacity,
  executeCheckServiceCoverage,
  executeQuoteFreight,
  executeBookFreight,
} from "../../webmcp/provider-tools";
import {
  executeGetOrganizationContext,
  executeGetCarrierMetrics,
  executeEvaluateOffers,
} from "../../webmcp/cargomesh-tools";

export interface AgentExecutionResult {
  freight_request: FreightRequest;
  decision: FreightDecision | null;
  booking: Booking | null;
  steps: OrchestrationStep[];
  success: boolean;
  message: string;
}

export type StepCallback = (step: OrchestrationStep) => void;

export async function runAutonomousDispatchAgent(
  requestId: string,
  onStep?: StepCallback
): Promise<AgentExecutionResult> {
  const steps: OrchestrationStep[] = [];

  function emitStep(
    phase: OrchestrationStep["phase"],
    title: string,
    detail: string,
    toolCalled?: string,
    toolInput?: unknown,
    toolOutput?: unknown,
    status: OrchestrationStep["status"] = "COMPLETED"
  ) {
    const step: OrchestrationStep = {
      id: `step-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      phase,
      title,
      detail,
      tool_called: toolCalled,
      tool_input: toolInput,
      tool_output: toolOutput,
      status,
    };
    steps.push(step);
    if (onStep) {
      onStep(step);
    }
  }

  // --- Step 1: Ingest & Validate Freight Request ---
  const request = dataStore.getFreightRequestById(requestId);
  if (!request) {
    emitStep(
      "VALIDATE",
      "Request Verification Failed",
      `Freight Request ID ${requestId} not found in database.`,
      undefined,
      { requestId },
      undefined,
      "FAILED"
    );
    return {
      freight_request: {} as FreightRequest,
      decision: null,
      booking: null,
      steps,
      success: false,
      message: "Freight request not found",
    };
  }

  emitStep(
    "VALIDATE",
    "Validating Logistics Request Intent",
    `Verified parameters for ${request.code}: Corridor ${request.origin_city} -> ${request.destination_city}, ${request.cargo_weight_kg.toLocaleString()} kg (${request.service_type} ${request.transport_mode}), Strategy: ${request.optimization_strategy}.`,
    "get_freight_request",
    { request_id: request.id },
    { valid: true, cargo_weight: request.cargo_weight_kg, corridor: `${request.origin_city} -> ${request.destination_city}` }
  );

  // Update status to EVALUATING
  dataStore.updateFreightRequest(request.id, { status: "EVALUATING" });

  // --- Step 2: Retrieve Organization Context & Policies ---
  const orgContext = await executeGetOrganizationContext(request.organization_id);
  emitStep(
    "CONTEXT",
    "Retrieving Authorized Enterprise Context",
    `Loaded context for ${orgContext.organization.name}: Auto-book policy: ${orgContext.preferences.allow_auto_booking ? "ENABLED" : "MANUAL"}, Confidence Threshold: ${orgContext.preferences.confidence_threshold}%, Default Budget: $${orgContext.preferences.budget_default || 850} USD.`,
    "get_organization_context",
    { organization_id: request.organization_id },
    orgContext
  );

  // --- Step 3: Discover Provider Capabilities via WebMCP ---
  const carriers = dataStore.getCarriers();
  const services = dataStore.getServices();
  const eligibleCarriers: typeof carriers = [];

  for (const carrier of carriers) {
    // 3a. Check corridor coverage via WebMCP
    const coverageResult = await executeCheckServiceCoverage({
      carrier_id: carrier.id,
      origin: `${request.origin_city}, ${request.origin_country}`,
      destination: `${request.destination_city}, ${request.destination_country}`,
      transport_mode: request.transport_mode,
      cargo_category: "GENERAL",
    });

    // 3b. Check capacity via WebMCP
    const capacityResult = await executeCheckCapacity({
      carrier_id: carrier.id,
      cargo_weight_kg: request.cargo_weight_kg,
      cargo_volume_m3: request.cargo_volume_m3,
      requires_refrigeration: request.requires_refrigeration,
      is_hazardous: request.is_hazardous,
      is_fragile: request.is_fragile,
      is_oversized: request.is_oversized,
      required_pickup: request.required_pickup,
    });

    // 3c. Validate Hard Constraints
    const hardCheck = validateHardConstraints(request, carrier, services);

    if (hardCheck.eligible && coverageResult.supported && capacityResult.available) {
      eligibleCarriers.push(carrier);
      emitStep(
        "DISCOVERY",
        `Discovered Carrier: ${carrier.name}`,
        `WebMCP verification PASS: Active corridor, ${capacityResult.available_units_count} available units with sufficient payload (${capacityResult.max_service_capacity_kg.toLocaleString()} kg max).`,
        "check_service_coverage & check_capacity",
        { carrier_id: carrier.id, corridor: `${request.origin_city} -> ${request.destination_city}` },
        { coverage: coverageResult, capacity: capacityResult }
      );
    } else {
      emitStep(
        "DISCOVERY",
        `Filtered Out: ${carrier.name}`,
        `Hard constraint violation: ${hardCheck.violations.join("; ")}`,
        "check_service_coverage",
        { carrier_id: carrier.id },
        { violations: hardCheck.violations },
        "WARNING"
      );
    }
  }

  if (eligibleCarriers.length === 0) {
    emitStep(
      "DISCOVERY",
      "No Eligible Providers Found",
      "All discovered logistics providers failed mandatory hard constraints.",
      undefined,
      undefined,
      undefined,
      "FAILED"
    );
    dataStore.updateFreightRequest(request.id, { status: "REVIEW_REQUIRED" });
    return {
      freight_request: dataStore.getFreightRequestById(request.id)!,
      decision: null,
      booking: null,
      steps,
      success: false,
      message: "No eligible providers available",
    };
  }

  // --- Step 4: Solicit Binding Quotes via WebMCP ---
  const collectedOffers: CarrierOffer[] = [];
  for (const carrier of eligibleCarriers) {
    const offer = await executeQuoteFreight({
      carrier_id: carrier.id,
      freight_request_id: request.id,
      origin: `${request.origin_city}, ${request.origin_country}`,
      destination: `${request.destination_city}, ${request.destination_country}`,
      cargo_weight_kg: request.cargo_weight_kg,
      cargo_category: "GENERAL",
      requires_refrigeration: request.requires_refrigeration,
      preferred_vehicle_brand: request.preferred_vehicle_brand,
    });
    collectedOffers.push(offer);

    emitStep(
      "QUOTING",
      `Received WebMCP Quote: ${carrier.name}`,
      `Quoted: $${offer.price} ${offer.currency} | Est. Duration: ${offer.estimated_duration_hours}h | Vehicle: ${offer.vehicle_brand} (${offer.vehicle_type || 'FTL'})`,
      "quote_freight",
      { carrier_id: carrier.id, request_id: request.id },
      offer
    );
  }

  dataStore.saveOffers(request.id, collectedOffers);

  // --- Step 5: Ingest Historical Corridor Metrics via WebMCP ---
  const metricsMap = dataStore.getAllMetrics();
  for (const carrier of eligibleCarriers) {
    const metrics = await executeGetCarrierMetrics(carrier.id);
    if (metrics) {
      emitStep(
        "METRICS",
        `Loaded Historical Metrics: ${carrier.name}`,
        `Success Rate: ${(metrics.success_rate * 100).toFixed(0)}% | Avg Delay: ${metrics.avg_delay_hours}h | Completed Corridor Jobs: ${metrics.route_jobs_count} | Past ACME Trips: ${metrics.client_history_trips || 0}`,
        "get_carrier_metrics",
        { carrier_id: carrier.id },
        metrics
      );
    }
  }

  // --- Step 6 & 7: Multicriteria Heuristic Scoring & Decision Evaluation ---
  const evaluationResult = await executeEvaluateOffers(request.id);
  const decision = evaluationResult.decision;
  const winner = evaluationResult.ranked_candidates[0];
  const second = evaluationResult.ranked_candidates[1];

  emitStep(
    "EVALUATION",
    "Heuristic Engine Execution",
    `Evaluated ${collectedOffers.length} candidates under ${request.optimization_strategy} policy. Ranking: #1 ${winner.carrier_name} (Score: ${winner.scores.total}), #2 ${second?.carrier_name || 'None'} (Score: ${second?.scores.total || 0}).`,
    "evaluate_offers",
    { strategy: request.optimization_strategy, candidate_count: collectedOffers.length },
    evaluationResult.ranked_candidates.map((c) => ({
      name: c.carrier_name,
      score: c.scores.total,
      breakdown: c.scores,
    }))
  );

  emitStep(
    "DECISION",
    `Decision Formulated: Winner is ${decision.winner_carrier_name}`,
    `Confidence Score: ${decision.confidence_score}% (Threshold: ${orgContext.preferences.confidence_threshold}%). ${decision.auto_booked ? "Approved for Autonomous Auto-Booking." : "Escalated for Human Review: " + (decision.review_reason || "")}`,
    "record_decision",
    decision,
    { confidence: decision.confidence_score, auto_booked: decision.auto_booked }
  );

  // --- Step 8: Autonomous Auto-Booking or Escalation ---
  let booking: Booking | null = null;
  if (decision.auto_booked) {
    const carrierId = decision.winner_carrier_id || decision.winning_carrier_id || "";
    const offerId = decision.selected_offer_id || decision.winning_offer_id || "";

    booking = await executeBookFreight({
      carrier_id: carrierId,
      freight_request_id: request.id,
      offer_id: offerId,
    });

    emitStep(
      "BOOKING",
      `Autonomous Auto-Book Executed: ${decision.winner_carrier_name || decision.winning_carrier_name}`,
      `Binding dispatch confirmed with reference ${booking.provider_reference}. Final rate: $${booking.price || booking.confirmed_price} ${booking.currency}. Request status updated to ASSIGNED.`,
      "book_freight",
      { carrier_id: carrierId, offer_id: offerId },
      booking
    );
  } else {
    dataStore.updateFreightRequest(request.id, { status: "REVIEW_REQUIRED" });
    emitStep(
      "BOOKING",
      "Escalated to Supervisor Queue",
      `Autonomous dispatch paused. Reason: ${decision.review_reason}`,
      "flag_for_review",
      { request_id: request.id, decision_id: decision.id },
      undefined,
      "WARNING"
    );
  }

  const updatedRequest = dataStore.getFreightRequestById(request.id)!;

  return {
    freight_request: updatedRequest,
    decision,
    booking,
    steps,
    success: true,
    message: decision.auto_booked
      ? `Autonomously dispatched with ${decision.winner_carrier_name}`
      : `Dispatched to supervisor review queue: ${decision.review_reason}`,
  };
}

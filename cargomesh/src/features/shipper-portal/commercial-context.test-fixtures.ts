/** Explicit contract-test records. Never imported by runtime code or installed as fallback data. */
import { WorkflowRecordV2Schema } from "@/shared/schemas/v2/workflow";
import { FreightRequestV2ResponseSchema } from "@/shared/schemas/v2/freight-request";
import { demoRequests } from "@/features/shipper-demo-preview/demo-data";
import { offer, opportunity, id, at, org, request, plan, carrier, service, assignment, ev, period } from "@/features/carrier-portal/commercial-test-fixtures";
import type { CommercialContext } from "./commercial-context";
export { id, carrier, service, org, at };
export function catalogRecord(kind: "carriers" | "services", recordId = kind === "carriers" ? carrier : service) {
  return { id: recordId, organizationId: null, carrierId: kind === "carriers" ? null : carrier, serviceId: null,
    version: 2, createdAt: at, updatedAt: at, value: kind === "carriers"
      ? { schemaVersion: "2.0", code: "CONTRACT_TEST", commercialName: "Contract-test logistics", legalName: null,
        businessIdType: null, businessIdValue: null, registeredCountry: "PE", providerType: "CARRIER", status: "ACTIVE", operationalPhone: null }
      : { schemaVersion: "2.0", mode: "ROAD", serviceClass: "FTL", maxWeightKg: null, maxVolumeM3: null,
        responseChannels: ["MANUAL", "API"], status: "ACTIVE", admittedCargoTypes: [], temperatureRange: null,
        requiredCertifications: [], supportsHazardous: false, supportsFragile: false, supportsOversized: false } };
}
export function commercialFixture(): CommercialContext {
  const req = FreightRequestV2ResponseSchema.shape.data.parse({ ...demoRequests[0], id: request, organizationId: org,
    draftVersion: 1, status: "AWAITING_SELECTION", pickupWindow: period, deliveryWindow: { startsAt: "2026-10-17T12:00:00Z", endsAt: "2026-10-17T18:00:00Z" } });
  const metadata = { organizationId: org, carrierId: null, requestId: request, version: 1, createdAt: at, updatedAt: at };
  const resource = { assetId: id(70), poolId: null, calendarId: id(71), combinationId: null, role: "LOAD_BEARING", equipment: "BOX_TRUCK",
    units: 1, window: period, availability: "SIMULATED", applicableCapacity: null, verificationSource: null };
  const p = WorkflowRecordV2Schema.parse({ ...metadata, id: plan, kind: "plans", status: "eligible", data: { routeId: id(60), requestVersion: 1,
    eligibility: "eligible", evaluatedAt: at, exclusionReasons: [], pendingRequirements: [], provenance: "SIMULATED", proposedWindow: period,
    coverage: "SIMULATED", availability: "SIMULATED", assignments: [], resourceAssessments: [], legAssignments: [{ id: assignment, serviceId: service,
      carrierId: carrier, sequence: 1, window: period, responsibility: { carrierId: carrier, serviceId: service }, coverage: "SIMULATED", availability: "SIMULATED",
      capacityNeeded: { weightKg: 1000, volumeM3: 2 }, evidence: [ev], resources: [{ bindingId: id(72), resourceId: id(73), resource, allocations: [] }] }] } });
  const f = offer(), o = opportunity();
  const rank = WorkflowRecordV2Schema.parse({ ...metadata, id: id(80), kind: "ranking", status: "RANKED", data: { policyId: id(81), policyVersion: "test-policy-v1",
    evaluatedAt: at, algorithmVersion: "DISJOINT_COVER_V1", universe: "CURRENT_PERSISTED_OFFERS", completeWithinUniverse: true, excluded: [],
    options: [{ offerId: f.id, offerIds: [f.id], planId: plan, assignments: [assignment], costCents: 10000, transit: null, reliability: null, metrics: [],
      policyVersion: "test-policy-v1", transitAggregation: "SUM_ISSUER_DURATIONS", reliabilityAggregation: "MIN_CARRIER_ON_TIME", position: 1, score: 1,
      explanation: { weights: { cost: 1, transit: 0, reliability: 0 }, dimensions: { cost: 1, transit: null, reliability: null } }, missingData: [] }] } });
  if (p.kind !== "plans" || rank.kind !== "ranking") throw new Error("Invalid explicit test fixture");
  return { request: req, plans: [p], opportunities: [o], offers: [f], ranking: rank };
}

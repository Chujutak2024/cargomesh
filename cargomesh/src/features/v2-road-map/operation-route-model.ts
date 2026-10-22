import type { WorkflowRecordV2 } from "@/features/shipper-portal/shipper-model";
import type { ProvenanceStatusV2 } from "./road-map-contract";

type Row<K extends WorkflowRecordV2["kind"]> = Extract<WorkflowRecordV2, { kind: K }>;
export type PublicMapSource = { reference: string; provider: string; observedAt: string; validUntil: string | null; provenance: ProvenanceStatusV2 };
export type OperationRouteFacts = {
  geometry: { routeId: string; version: number; source: string | null; provenance: ProvenanceStatusV2; distanceKm: number | null; durationSeconds: number | null; evidence: PublicMapSource[] };
  commercial: { offerId: string; offerVersion: number; offerRecordVersion: number; planId: string; planVersion: number; serviceId: string;
    transitSeconds: number | null; window: { startsAt: string; endsAt: string }; windowSeconds: number | null; source: PublicMapSource;
    corridors: Array<{ id: string; version: number; distanceKm: number | null; declaredDurationSeconds: number | null; drivingSeconds: number | null; source: PublicMapSource; drivingSource: PublicMapSource | null }> };
  eta: { at: string | null; offerId: string; offerVersion: number; issuedAt: string; validity: { startsAt: string; endsAt: string }; source: PublicMapSource };
};

type Evidence = Row<"offers">["data"]["source"]["evidence"];
function source(value: Evidence): PublicMapSource {
  return { reference: value.reference, provider: value.provider, observedAt: value.observedAt, validUntil: value.validUntil, provenance: value.provenanceStatus };
}

/** Whitelist public facts only. Never accept a quote calculation or a Carrier policy. */
export function operationRouteFacts(route: Row<"routes">, offer: Row<"offers">, plan: Row<"plans">,
  execution: Row<"executions">, corridors: Row<"corridors">[]): OperationRouteFacts {
  const window = execution.data.plannedWindow, seconds = (Date.parse(window.endsAt) - Date.parse(window.startsAt)) / 1000;
  return {
    geometry: { routeId: route.id, version: route.version, source: route.data.geographicSource?.kind ?? null,
      provenance: route.data.confidence, distanceKm: route.data.estimatedDistanceKm, durationSeconds: route.data.estimatedDurationSeconds,
      evidence: route.data.legs.map(leg => source(leg.source)) },
    commercial: { offerId: offer.id, offerVersion: offer.data.offerVersion, offerRecordVersion: offer.version, planId: plan.id, planVersion: plan.version,
      serviceId: execution.data.serviceId, transitSeconds: offer.data.transitDurationSeconds, window,
      windowSeconds: Number.isFinite(seconds) && seconds > 0 ? seconds : null, source: source(offer.data.source.evidence),
      corridors: route.data.legs.map(leg => {
        // A current catalog revision must not replace the booked route's historic revision.
        const corridor = corridors.find(row => row.id === leg.corridorId && row.version === leg.corridorVersion);
        const profile = corridor?.data.operatingProfile;
        return { id: leg.corridorId, version: leg.corridorVersion, distanceKm: leg.estimatedDistanceKm,
          declaredDurationSeconds: leg.estimatedDurationSeconds, drivingSeconds: profile?.drivingSeconds ?? null,
          source: source(leg.source), drivingSource: profile ? source(profile.source) : null };
      }) },
    eta: { at: offer.data.estimatedDeliveryAt, offerId: offer.id, offerVersion: offer.data.offerVersion, issuedAt: offer.data.issuedAt,
      validity: offer.data.validity, source: source(offer.data.source.evidence) },
  };
}

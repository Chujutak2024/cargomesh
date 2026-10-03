import { z } from "zod";
import { cargoUnitTotalsV2 } from "@/shared/schemas/v2/freight-request";
import { RoadServiceabilityEvaluationV2ResponseSchema, type RoadCandidateV2 } from
  "@/shared/schemas/v2/serviceability";
import { ResourceEvidenceRequirementCodesV2 } from "@/shared/schemas/v2/intake-options";
import { V2DraftError, getV2Draft, type V2Actor, type V2DraftRepository } from
  "@/server/modules/freight-requests/application/draft-service";
import { evaluateRoad, type RoadService, type Status } from "../domain/evaluate-road";

export interface RoadCatalogRepository {
  listRoadServices(): Promise<RoadService[]>;
}

const RESOURCE_EVIDENCE_CODES = new Set<string>(ResourceEvidenceRequirementCodesV2);

function canCheckResourceRequirement(code: string, hasTemperatureRange: boolean): boolean {
  return RESOURCE_EVIDENCE_CODES.has(code) && (code !== "TEMP_CONTROLLED" || hasTemperatureRange);
}

function combine(a: Status, b: Status): Status {
  if (a === "ineligible" || b === "ineligible") return "ineligible";
  if (a === "unknown" || b === "unknown") return "unknown";
  return "eligible";
}

export async function evaluateV2RoadByRequestId(
  id: string, expectedDraftVersion: number | undefined, actor: V2Actor,
  drafts: V2DraftRepository, catalog: RoadCatalogRepository,
) {
  if (expectedDraftVersion !== undefined && (!Number.isInteger(expectedDraftVersion)
      || expectedDraftVersion < 1)) {
    throw new V2DraftError("VALIDATION_ERROR", "expectedDraftVersion must be a positive integer.", 400);
  }
  const request = (await getV2Draft(id, actor, drafts)).data;
  if (expectedDraftVersion !== undefined && expectedDraftVersion !== request.draftVersion) {
    throw new V2DraftError("STALE_DRAFT", "Draft version does not match.", 409);
  }
  const window = {
    startsAt: request.pickupWindow.startsAt,
    endsAt: request.deliveryWindow.endsAt,
  };
  const services = await catalog.listRoadServices();
  const unitTotals = cargoUnitTotalsV2(request.cargoSpecification.units);
  const result = evaluateRoad({
    origin: { countryCode: request.origin.countryCode, regionCode: request.origin.region,
      city: request.origin.city },
    destination: { countryCode: request.destination.countryCode, regionCode: request.destination.region,
      city: request.destination.city },
    operationWindow: window,
    pickupWindow: request.pickupWindow,
    deliveryWindow: request.deliveryWindow,
    cargoCategoryCode: request.cargoSpecification.categoryCode,
    // The tolerance handles rounding; never discount actual units at a capacity limit.
    totalWeightKg: Math.max(request.cargoSpecification.totalWeightKg, unitTotals.weightKg),
    totalVolumeM3: Math.max(request.cargoSpecification.totalVolumeM3, unitTotals.volumeM3),
    indivisibleUnits: request.cargoSpecification.units.filter((unit) => unit.indivisible)
      .map((unit) => ({ weightKg: unit.weightPerUnitKg, volumeM3: unit.volumePerUnitM3 })),
    requiredEquipmentCode: request.requiredEquipment,
    requiredCertifications: request.cargoSpecification.requirements.filter((code) =>
      canCheckResourceRequirement(code, request.cargoSpecification.temperatureRange != null)),
    temperatureRange: request.cargoSpecification.temperatureRange ?? null,
    // The domain checks each carrying resource's persisted capability evidence;
    // a pool without such evidence remains UNKNOWN.
    unverifiedRequirements: request.cargoSpecification.requirements.filter((code) =>
      !canCheckResourceRequirement(code, request.cargoSpecification.temperatureRange != null)),
  }, services);
  const serviceById = new Map(services.map((service) => [service.id, service]));
  const evaluatedAt = new Date().toISOString();
  const candidates: RoadCandidateV2[] = result.candidates.map((candidate) => {
    const service = serviceById.get(candidate.serviceId);
    if (!service) throw new Error("V2_ROAD_SERVICE_MISSING");
    if (!service.serviceClass) throw new Error("V2_ROAD_SERVICE_CLASS_MISSING");
    const { pickup, delivery, lane, cargo, capacity, requirements } = candidate.evidence;
    const source = service.capacities.find((item) => item.id === capacity.sourceId);
    const matchedLane = service.lanes.find((item) => item.id === lane.laneId);
    const pickupArea = service.areas.find((item) => item.id === pickup.includedIds[0]);
    const deliveryArea = service.areas.find((item) => item.id === delivery.includedIds[0]);
    const capacityReason = capacity.reason ?? "CAPACITY_WINDOW_VERIFIED";
    const hardCapacityFailure = ["EQUIPMENT_MISMATCH", "CARGO_CATEGORY_UNSUPPORTED",
      "OVER_CAPACITY", "INDIVISIBLE_UNIT_OVER_CAPACITY"].includes(capacityReason);
    const cargoStatus: Status = cargo.status === "ineligible" || requirements.status === "ineligible"
      || hardCapacityFailure
      ? "ineligible" : cargo.status === "unknown" || requirements.status === "unknown"
        || !source || source.cargoCategoryCodes === null
        || source.maxWeightKg === null || source.maxVolumeM3 === null
        || (request.requiredEquipment && !source.equipmentCode)
          ? "unknown" : "eligible";
    const indivisibleFit = !source || source.maxWeightKg === null || source.maxVolumeM3 === null
      ? null : request.cargoSpecification.units.filter((unit) => unit.indivisible)
        .every((unit) => unit.weightPerUnitKg <= source.maxWeightKg!
          && unit.volumePerUnitM3 <= source.maxVolumeM3!);
    return {
      candidateId: `road:${service.id}`,
      status: candidate.status,
      carrier: { id: service.carrierId, code: service.carrierCode ?? service.carrierId,
        commercialName: service.carrierName ?? service.carrierId },
      service: { id: service.id, code: service.serviceCode ?? service.id, mode: "ROAD",
        serviceClass: service.serviceClass, responseChannels: service.responseChannels ?? [] },
      checks: {
        coverage: {
          status: combine(pickup.status, delivery.status),
          pickupAreaCode: pickupArea?.code ?? null,
          deliveryAreaCode: deliveryArea?.code ?? null,
          exclusionTriggered: pickup.reason === "PICKUP_EXCLUDED" || delivery.reason === "DELIVERY_EXCLUDED",
          reasonCode: pickup.reason ?? delivery.reason ?? "PICKUP_AND_DELIVERY_INCLUDED",
        },
        lane: {
          status: combine(lane.status, candidate.evidence.border.status), laneId: matchedLane?.id ?? null,
          kind: matchedLane?.kind ?? null,
          borderReviewRequired: request.origin.countryCode !== request.destination.countryCode
            || (matchedLane?.borderReviewRequired ?? false),
          reasonCode: lane.reason ?? candidate.evidence.border.reason ?? "DIRECTED_LANE_ACTIVE",
        },
        cargoAndEquipment: {
          status: cargoStatus,
          matchedCategory: cargo.status === "eligible" ? request.cargoSpecification.categoryCode : null,
          requiredEquipment: request.requiredEquipment,
          indivisibleUnitsFit: indivisibleFit,
          reasonCode: cargo.reason ?? requirements.reason
            ?? (hardCapacityFailure ? capacityReason : "CARGO_AND_EQUIPMENT_CHECKED"),
        },
        capacityWindow: {
          status: capacity.status,
          sourceType: source?.sourceType ?? null, sourceId: source?.id ?? null,
          calendarId: source?.calendarId ?? null,
          availableWeightKg: capacity.status === "eligible" ? source?.maxWeightKg ?? null : null,
          availableVolumeM3: capacity.status === "eligible" ? source?.maxVolumeM3 ?? null : null,
          windowChecked: window,
          provenance: {
            dataSource: source?.dataSource ?? "MISSING_CAPACITY_SOURCE",
            provenanceStatus: source?.calendar?.provenanceStatus ?? "UNKNOWN",
            observedAt: source?.observedAt ?? null,
            validUntil: source?.calendar?.validUntil ?? null,
          },
          reasonCode: capacityReason,
        },
      },
      reasons: candidate.reasons,
      // No routing provider or approved synthetic geometry has supplied a line.
      routePreview: null,
    };
  });
  return RoadServiceabilityEvaluationV2ResponseSchema.parse({
    schemaVersion: "2.0",
    data: {
      freightRequestId: request.id, evaluatedDraftVersion: request.draftVersion,
      evaluatedAt, overallStatus: result.overallStatus,
      summaryCounts: {
        totalEvaluated: candidates.length,
        eligibleCount: candidates.filter((item) => item.status === "eligible").length,
        unknownCount: candidates.filter((item) => item.status === "unknown").length,
        ineligibleCount: candidates.filter((item) => item.status === "ineligible").length,
      },
      commercialNotice: "EVALUATION_ONLY_NO_OFFER_OR_BOOKING",
      candidates,
    },
  });
}

export const ExpectedDraftVersionSchema = z.coerce.number().int().positive().optional();

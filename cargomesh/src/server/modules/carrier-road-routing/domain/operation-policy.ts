import type { z } from 'zod';
import { CatalogInputsV2 } from '@/shared/schemas/v2/catalog';
import { FleetOutputsV2 } from '@/shared/schemas/v2/fleet';
import type { RoadOperationInputV2, OperationDecisionV2, OperationTimelineV2 } from '@/shared/schemas/v2/road-operation';

export function combineOperationDecisions(checks: OperationDecisionV2[]): OperationDecisionV2 {
  return { status: checks.some(c => c.status === 'ineligible') ? 'ineligible'
    : checks.some(c => c.status === 'unknown') ? 'unknown' : 'eligible',
  reasons: [...new Set(checks.flatMap(c => c.reasons))] };
}

/** All durations occupy both resources, including waits/rest. This is not a legal break scheduler. */
export function buildOperationTimeline(input: RoadOperationInputV2, drivingSeconds: number): OperationTimelineV2 {
  const p = input.planning, unknown: string[] = [], blocked: string[] = [];
  for (const key of ['loadingSeconds', 'unloadingSeconds', 'restSeconds', 'borderSeconds',
    'repositionBeforeSeconds', 'repositionAfterSeconds'] as const) {
    if (p[key] === null) unknown.push('DURATION_UNKNOWN_' + key.replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase());
  }
  const loadingStart = Date.parse(input.road.pickupWindow.startsAt);
  const departure = loadingStart + (p.loadingSeconds ?? 0) * 1000;
  const arrival = departure + (drivingSeconds + (p.restSeconds ?? 0) + (p.borderSeconds ?? 0)) * 1000;
  const unloadingStart = Math.max(arrival, Date.parse(input.road.deliveryWindow.startsAt));
  const unloadingEnd = unloadingStart + (p.unloadingSeconds ?? 0) * 1000;
  const start = loadingStart - (p.repositionBeforeSeconds ?? 0) * 1000;
  const end = unloadingEnd + (p.repositionAfterSeconds ?? 0) * 1000;
  if (departure > Date.parse(input.road.pickupWindow.endsAt)) blocked.push('LOADING_EXCEEDS_PICKUP_WINDOW');
  if (unloadingEnd > Date.parse(input.road.deliveryWindow.endsAt)) blocked.push('DELIVERY_WINDOW_MISSED');
  if (end - start > 14 * 86400000) unknown.push('OPERATION_EXCEEDS_SUPPORTED_HORIZON');
  const iso = (ms: number) => new Date(ms).toISOString();
  return { basis: unknown.some(r => r.startsWith('DURATION_UNKNOWN_')) ? 'LOWER_BOUND_WITH_MISSING_DURATIONS' : 'OPERATOR_ESTIMATE',
    workWindow: { startsAt: iso(start), endsAt: iso(end) },
    loadingWindow: departure > loadingStart ? { startsAt: iso(loadingStart), endsAt: iso(departure) } : null,
    departureAt: iso(departure), arrivalAt: iso(arrival), unloadingStartsAt: iso(unloadingStart), unloadingEndsAt: iso(unloadingEnd),
    drivingSeconds, waitingSeconds: (unloadingStart - arrival) / 1000, totalOccupiedSeconds: (end - start) / 1000,
    decision: { status: blocked.length ? 'ineligible' : unknown.length ? 'unknown' : 'eligible', reasons: [...blocked, ...unknown] } };
}

type Service = z.infer<typeof CatalogInputsV2.services>;
type Asset = z.infer<typeof FleetOutputsV2.assets>;
type Capability = z.infer<typeof FleetOutputsV2['asset-capabilities']>;
type Definition = z.infer<typeof FleetOutputsV2['capability-definitions']>;
export function evaluateOperationCargo(input: RoadOperationInputV2, service: Service, asset: Asset,
  capabilities: Capability[], definitions: { id: string; value: Definition }[], complete: boolean, now: string): OperationDecisionV2 {
  const cargo = input.cargo, blocked: string[] = [], unknown: string[] = [];
  if (service.mode !== 'ROAD' || asset.mode !== 'ROAD') blocked.push('ROAD_MODE_REQUIRED');
  if (service.status !== 'ACTIVE') blocked.push('SERVICE_INACTIVE');
  if (asset.role !== 'LOAD_BEARING') blocked.push('LOAD_BEARING_ASSET_REQUIRED');
  if (asset.operatingStatus !== 'AVAILABLE') blocked.push('ASSET_UNAVAILABLE');
  if (cargo.requiredEquipment !== null && cargo.requiredEquipment !== asset.equipmentType) blocked.push('EQUIPMENT_MISMATCH');
  if (cargo.weightKg > asset.usefulCapacityKg) blocked.push('ASSET_WEIGHT_EXCEEDED');
  if (asset.usableVolumeM3 === null) unknown.push('ASSET_VOLUME_UNKNOWN');
  else if (cargo.volumeM3 > asset.usableVolumeM3) blocked.push('ASSET_VOLUME_EXCEEDED');
  if (service.maxWeightKg === null || service.maxVolumeM3 === null) unknown.push('SERVICE_LIMITS_UNKNOWN');
  if (service.maxWeightKg !== null && cargo.weightKg > service.maxWeightKg) blocked.push('SERVICE_WEIGHT_EXCEEDED');
  if (service.maxVolumeM3 !== null && cargo.volumeM3 > service.maxVolumeM3) blocked.push('SERVICE_VOLUME_EXCEEDED');
  if (!service.admittedCargoTypes.includes(cargo.categoryId)) unknown.push('SERVICE_CARGO_ADMISSION_UNKNOWN');
  if (cargo.hazardous && !service.supportsHazardous) blocked.push('HAZARDOUS_NOT_SUPPORTED');
  if (cargo.fragile && !service.supportsFragile) blocked.push('FRAGILE_NOT_SUPPORTED');
  if (cargo.oversized && !service.supportsOversized) blocked.push('OVERSIZED_NOT_SUPPORTED');
  if (cargo.largestPieceCm === null) unknown.push('PIECE_DIMENSIONS_UNKNOWN');
  else if (!asset.roadVehicle?.usableDimensions) unknown.push('ASSET_DIMENSIONS_UNKNOWN');
  else {
    const piece = cargo.largestPieceCm, box = asset.roadVehicle.usableDimensions;
    if (piece.length > box.length || piece.width > box.width || piece.height > box.height) {
      const orientations = [[piece.length, piece.width, piece.height], [piece.length, piece.height, piece.width],
        [piece.width, piece.length, piece.height], [piece.width, piece.height, piece.length],
        [piece.height, piece.length, piece.width], [piece.height, piece.width, piece.length]];
      if (orientations.some(([l, w, h]) => l <= box.length && w <= box.width && h <= box.height))
        unknown.push('PIECE_ROTATION_PERMISSION_UNKNOWN');
      else blocked.push('PIECE_DOES_NOT_FIT');
    }
  }
  if (!asset.evidence) unknown.push('ASSET_CAPACITY_EVIDENCE_UNKNOWN');
  const current = (v: { evidence: string | null; verifiedAt: string | null; validUntil: string | null }) =>
    !!v.evidence && !!v.verifiedAt && !!v.validUntil && Date.parse(v.verifiedAt) <= Date.parse(now)
    && Date.parse(v.verifiedAt) <= Date.parse(input.road.pickupWindow.startsAt)
    && Date.parse(v.validUntil) >= Date.parse(input.road.deliveryWindow.endsAt) && Date.parse(v.validUntil) > Date.parse(now);
  const encloses = (range: { minCelsius: number; maxCelsius: number } | null) => !!range
    && range.minCelsius <= cargo.temperatureRange!.minCelsius && range.maxCelsius >= cargo.temperatureRange!.maxCelsius;
  if (cargo.temperatureRange && !service.temperatureRange) unknown.push('SERVICE_TEMPERATURE_UNKNOWN');
  else if (cargo.temperatureRange && !encloses(service.temperatureRange)) blocked.push('SERVICE_TEMPERATURE_NOT_SUPPORTED');
  const requiredCertifications = [...new Set([...cargo.certifications, ...service.requiredCertifications])];
  const compatible = capabilities.some(c => {
    const definition = definitions.find(d => d.id === c.definitionId)?.value;
    return c.assetId === input.assetId && c.categoryId === cargo.categoryId && c.active && current(c)
      && definition?.active && definition.categoryId === cargo.categoryId && current(definition)
      && (definition.maxWeightKg === null || definition.maxWeightKg >= cargo.weightKg)
      && (!cargo.temperatureRange || encloses(c.temperatureRange) && encloses(definition.temperatureRange))
      && requiredCertifications.every(cert => c.certifications.includes(cert) && definition.certifications.includes(cert));
  });
  if (!compatible) unknown.push('CARGO_CAPABILITY_EVIDENCE_UNKNOWN');
  if (definitions.some(d => d.value.categoryId === cargo.categoryId && d.value.active && d.value.requirements.length))
    unknown.push('ADDITIONAL_CAPABILITY_REQUIREMENTS_NOT_EVALUATED');
  if (cargo.hazardous || cargo.oversized) unknown.push('SPECIAL_CARGO_PERMITS_NOT_EVALUATED');
  if (!complete) unknown.push('PARTIAL_CAPABILITY_READ');
  return { status: blocked.length ? 'ineligible' : unknown.length ? 'unknown' : 'eligible', reasons: [...new Set([...blocked, ...unknown])] };
}

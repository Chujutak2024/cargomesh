/** Shared fleet rules. Database commands must enforce the same checks atomically. */
export type FleetWindow = { startsAt: string; endsAt: string };
export type FleetDecision = { status: "eligible" | "ineligible" | "unknown"; reasons: string[] };
export type FleetEvidence = { reference: string; verifiedAt: string; validUntil: string };
export class FleetPolicyError extends Error {
  constructor(public readonly code: string) { super(code); }
}
function instant(value: string): number {
  const result = Date.parse(value);
  if (!Number.isFinite(result)) throw new FleetPolicyError("INVALID_WINDOW");
  return result;
}
function bounds(window: FleetWindow): [number, number] {
  const start = instant(window.startsAt), end = instant(window.endsAt);
  if (end <= start) throw new FleetPolicyError("INVALID_WINDOW");
  return [start, end];
}
export function fleetWindowsOverlap(a: FleetWindow, b: FleetWindow): boolean {
  const [as, ae] = bounds(a), [bs, be] = bounds(b);
  return as < be && bs < ae;
}
function contains(outer: FleetWindow, inner: FleetWindow): boolean {
  const [os, oe] = bounds(outer), [is, ie] = bounds(inner);
  return os <= is && ie <= oe;
}
function currentEvidence(evidence: FleetEvidence | null, window: FleetWindow, at: string): boolean {
  if (!evidence || !evidence.reference.trim()) return false;
  const verified = instant(evidence.verifiedAt), until = instant(evidence.validUntil);
  const clock = instant(at), [start, end] = bounds(window);
  return verified <= clock && verified <= start && until > clock && until >= end;
}
function decide(blocked: string[], unknown: string[]): FleetDecision {
  return { status: blocked.length ? "ineligible" : unknown.length ? "unknown" : "eligible",
    reasons: [...new Set([...blocked, ...unknown])] };
}
export type FleetAgenda = {
  complete: boolean; evidence: FleetEvidence | null; availableWindows: FleetWindow[];
  /** Only active holds, confirmed reservations and nonterminal blocks are projected here. */
  occupiedWindows: FleetWindow[];
};
export function evaluateFleetAvailability(agenda: FleetAgenda | null, window: FleetWindow, at: string): FleetDecision {
  bounds(window); instant(at);
  if (!agenda) return decide([], ["AGENDA_UNKNOWN"]);
  const blocked: string[] = [], unknown: string[] = [];
  if (agenda.occupiedWindows.some(w => fleetWindowsOverlap(w, window))) blocked.push("RESOURCE_OCCUPIED");
  if (!currentEvidence(agenda.evidence, window, at)) unknown.push("AGENDA_EVIDENCE_UNKNOWN");
  // Adjacent published slots together may cover a continuous operating period.
  const slots = agenda.availableWindows.map(bounds).sort((a, b) => a[0] - b[0]);
  const [start, end] = bounds(window); let through = start;
  for (const [slotStart, slotEnd] of slots) {
    if (slotStart > through) break;
    if (slotEnd > through) through = slotEnd;
  }
  if (through < end) {
    if (agenda.complete && currentEvidence(agenda.evidence, window, at)) blocked.push("NO_RESOURCE_WINDOW");
    else unknown.push("RESOURCE_WINDOW_UNKNOWN");
  }
  return decide(blocked, unknown);
}
export type DriverSnapshot = {
  id: string; carrierId: string; fullName: string; portalAccountId: string | null;
  licenseClass: string; licenseValidUntil: string; qualifications: string[];
  experienceYears: number | null; dutyStatus: string; agenda: FleetAgenda | null;
};
export type DriverRequirements = {
  carrierId: string; acceptedLicenseClasses: string[]; requiredQualifications: string[];
  /** Supplied by the applicable jurisdiction policy, never inferred from a country code. */
  licenseExpiry: { localDate: string; exclusiveInstant: string; evidence: FleetEvidence | null } | null;
  duty: { allowedStatuses: string[]; maximumDutySeconds: number; previousDutySeconds: number;
    evidence: FleetEvidence | null } | null;
};
export function evaluateDriverAssignment(driver: DriverSnapshot, requirement: DriverRequirements,
  window: FleetWindow, at: string): FleetDecision {
  const [start, end] = bounds(window); instant(at);
  const blocked: string[] = [], unknown: string[] = [];
  if (driver.carrierId !== requirement.carrierId) blocked.push("DRIVER_CARRIER_MISMATCH");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(driver.licenseValidUntil)
    || new Date(instant(driver.licenseValidUntil + "T00:00:00Z")).toISOString().slice(0, 10) !== driver.licenseValidUntil) {
    throw new FleetPolicyError("INVALID_LICENSE_DATE");
  }
  if (!requirement.acceptedLicenseClasses.length) unknown.push("LICENSE_POLICY_UNKNOWN");
  else if (!requirement.acceptedLicenseClasses.includes(driver.licenseClass)) blocked.push("LICENSE_CLASS_MISMATCH");
  if (requirement.requiredQualifications.some(q => !driver.qualifications.includes(q))) blocked.push("DRIVER_QUALIFICATION_MISSING");
  if (!requirement.licenseExpiry || requirement.licenseExpiry.localDate !== driver.licenseValidUntil
    || !currentEvidence(requirement.licenseExpiry.evidence, window, at)) unknown.push("LICENSE_EXPIRY_POLICY_UNKNOWN");
  else {
    const expiry = instant(requirement.licenseExpiry.exclusiveInstant);
    // An adapter resolves LocalDate according to the licensing jurisdiction.
    if (expiry <= start || expiry < end) blocked.push("LICENSE_EXPIRED_FOR_WINDOW");
  }
  const duty = requirement.duty;
  if (!duty || !duty.allowedStatuses.length || !currentEvidence(duty.evidence, window, at)) unknown.push("DRIVER_DUTY_UNKNOWN");
  else {
    if (!Number.isFinite(duty.maximumDutySeconds) || duty.maximumDutySeconds <= 0
      || !Number.isFinite(duty.previousDutySeconds) || duty.previousDutySeconds < 0) throw new FleetPolicyError("INVALID_DUTY_POLICY");
    if (!duty.allowedStatuses.includes(driver.dutyStatus)) blocked.push("DRIVER_DUTY_STATUS_BLOCKED");
    if (duty.previousDutySeconds + (end - start) / 1000 > duty.maximumDutySeconds) blocked.push("DRIVER_DUTY_LIMIT_EXCEEDED");
  }
  const agenda = evaluateFleetAvailability(driver.agenda, window, at);
  (agenda.status === "ineligible" ? blocked : unknown).push(...agenda.reasons);
  return decide(blocked, unknown);
}
export type CombinationAsset = {
  id: string; carrierId: string; mode: string; operatingStatus: string; agenda: FleetAgenda | null;
};
export type CombinationSnapshot = {
  id: string; carrierId: string; kind: string; configuration: string;
  coupledWindow: FleetWindow | null; evidence: FleetEvidence | null;
  combinedTareKg: number | null; grossWeightLimitKg: number | null; status: string;
  assets: CombinationAsset[];
};
export type CombinationRequirements = {
  carrierId: string; allowedStatuses: string[];
  compatibility: { compatible: boolean; evidence: FleetEvidence | null } | null;
  /** Limits apply to the complete combination; do not sum member capacities. */
  manufacturerPayloadLimitKg: number | null; routeGrossLimitKg: number | null;
  servicePayloadLimitKg: number | null;
  limitsEvidence: FleetEvidence | null;
};
export function evaluateVehicleCombination(combination: CombinationSnapshot, requirement: CombinationRequirements,
  window: FleetWindow, at: string): FleetDecision & { effectivePayloadKg: number | null } {
  bounds(window); instant(at);
  const blocked: string[] = [], unknown: string[] = [];
  if (!combination.assets.length || new Set(combination.assets.map(a => a.id)).size !== combination.assets.length) {
    throw new FleetPolicyError("INVALID_COMBINATION_MEMBERS");
  }
  if (combination.carrierId !== requirement.carrierId
    || combination.assets.some(a => a.carrierId !== combination.carrierId)) blocked.push("COMBINATION_CARRIER_MISMATCH");
  if (combination.assets.some(a => a.mode !== "ROAD")) blocked.push("COMBINATION_MODE_MISMATCH");
  if (combination.assets.some(a => a.operatingStatus !== "AVAILABLE")) blocked.push("COMBINATION_ASSET_UNAVAILABLE");
  if (!requirement.allowedStatuses.length) unknown.push("COMBINATION_STATUS_POLICY_UNKNOWN");
  else if (!requirement.allowedStatuses.includes(combination.status)) blocked.push("COMBINATION_STATUS_BLOCKED");
  if (!combination.coupledWindow || !currentEvidence(combination.evidence, window, at)) unknown.push("COUPLING_UNKNOWN");
  else if (!contains(combination.coupledWindow, window)) blocked.push("OUTSIDE_COUPLED_WINDOW");
  if (!requirement.compatibility || !currentEvidence(requirement.compatibility.evidence, window, at)) unknown.push("COMBINATION_COMPATIBILITY_UNKNOWN");
  else if (!requirement.compatibility.compatible) blocked.push("COMBINATION_INCOMPATIBLE");
  for (const asset of combination.assets) {
    const availability = evaluateFleetAvailability(asset.agenda, window, at);
    (availability.status === "ineligible" ? blocked : unknown).push(...availability.reasons);
  }
  const values = [combination.combinedTareKg, combination.grossWeightLimitKg,
    requirement.manufacturerPayloadLimitKg, requirement.routeGrossLimitKg, requirement.servicePayloadLimitKg];
  if (values.some(n => n !== null && (!Number.isFinite(n) || n < 0))) throw new FleetPolicyError("INVALID_CAPACITY_LIMIT");
  let effectivePayloadKg: number | null = null;
  if (values.some(n => n === null) || !currentEvidence(requirement.limitsEvidence, window, at)) unknown.push("COMBINATION_LIMITS_UNKNOWN");
  else {
    effectivePayloadKg = Math.max(0, Math.min(requirement.manufacturerPayloadLimitKg!, requirement.servicePayloadLimitKg!,
      combination.grossWeightLimitKg! - combination.combinedTareKg!, requirement.routeGrossLimitKg! - combination.combinedTareKg!));
    if (effectivePayloadKg === 0) blocked.push("NO_COMBINATION_PAYLOAD");
  }
  return { ...decide(blocked, unknown), effectivePayloadKg };
}

export type CapacityAmount = { weightKg: number; volumeM3: number };
export type VehicleAssignmentSnapshot = {
  carrierId: string; serviceId: string; executionId: string; assetId: string;
  window: FleetWindow; status: "PROPOSED" | "CONFIRMED" | "RELEASED" | "CANCELLED";
  capacityCommitted: CapacityAmount; evidence: FleetEvidence | null;
  reservationId: string | null;
};
export type VehicleAssignmentContext = {
  carrierId: string; serviceId: string; executionId: string; serviceClass: "FTL" | "LTL";
  asset: { id: string; carrierId: string; serviceId: string; mode: string;
    role: "LOAD_BEARING" | "AUXILIARY"; operatingStatus: string; agenda: FleetAgenda | null;
    weightLimitKg: number | null; volumeLimitM3: number | null; limitsEvidence: FleetEvidence | null };
  /** Existing active allocations projected from the same trip, excluding the current assignment. */
  allocations: { executionId: string; window: FleetWindow; capacity: CapacityAmount }[];
  consolidationEvidence: FleetEvidence | null;
  reservation: { id: string; carrierId: string; serviceId: string; executionId: string; assetId: string;
    window: FleetWindow; status: "HELD" | "CONFIRMED" | "RELEASED" | "CANCELLED";
    capacity: CapacityAmount; evidence: FleetEvidence | null } | null;
};
function validateAmount(amount: CapacityAmount): void {
  if (![amount.weightKg, amount.volumeM3].every(n => Number.isFinite(n) && n >= 0)) {
    throw new FleetPolicyError("INVALID_COMMITTED_CAPACITY");
  }
}
export function evaluateVehicleAssignment(assignment: VehicleAssignmentSnapshot, context: VehicleAssignmentContext,
  at: string): FleetDecision {
  bounds(assignment.window); instant(at); validateAmount(assignment.capacityCommitted);
  const blocked: string[] = [], unknown: string[] = [], asset = context.asset;
  if (assignment.carrierId !== context.carrierId || assignment.serviceId !== context.serviceId
    || assignment.executionId !== context.executionId || assignment.assetId !== asset.id
    || asset.carrierId !== context.carrierId || asset.serviceId !== context.serviceId) blocked.push("ASSIGNMENT_CONTEXT_MISMATCH");
  if (assignment.status === "RELEASED" || assignment.status === "CANCELLED") blocked.push("ASSIGNMENT_NOT_ACTIVE");
  if (asset.mode !== "ROAD") blocked.push("ASSIGNMENT_MODE_UNSUPPORTED");
  if (asset.operatingStatus !== "AVAILABLE") blocked.push("ASSET_UNAVAILABLE");
  if (asset.role === "AUXILIARY" && (assignment.capacityCommitted.weightKg > 0 || assignment.capacityCommitted.volumeM3 > 0)) {
    blocked.push("AUXILIARY_CANNOT_CARRY");
  }
  const availability = evaluateFleetAvailability(asset.agenda, assignment.window, at);
  (availability.status === "ineligible" ? blocked : unknown).push(...availability.reasons);
  // Compute peak simultaneous use; sequential allocations must not be added together.
  const [assignmentStart, assignmentEnd] = bounds(assignment.window);
  const changes: { at: number; weight: number; volume: number }[] = [];
  for (const allocation of context.allocations) {
    validateAmount(allocation.capacity);
    if (!fleetWindowsOverlap(allocation.window, assignment.window)) continue;
    if (context.serviceClass === "FTL" || allocation.executionId !== assignment.executionId) {
      blocked.push("ASSIGNMENT_CONFLICT"); continue;
    }
    if (!currentEvidence(context.consolidationEvidence, assignment.window, at)) unknown.push("LTL_CONSOLIDATION_UNKNOWN");
    const [start, end] = bounds(allocation.window);
    changes.push({ at: Math.max(start, assignmentStart), weight: allocation.capacity.weightKg, volume: allocation.capacity.volumeM3 },
      { at: Math.min(end, assignmentEnd), weight: -allocation.capacity.weightKg, volume: -allocation.capacity.volumeM3 });
  }
  let usedWeight = 0, usedVolume = 0, weight = 0, volume = 0;
  const times = [...new Set(changes.map(change => change.at))].sort((a, b) => a - b);
  for (const time of times) {
    for (const change of changes.filter(change => change.at === time)) { weight += change.weight; volume += change.volume; }
    usedWeight = Math.max(usedWeight, weight); usedVolume = Math.max(usedVolume, volume);
  }
  if (asset.role === "LOAD_BEARING") {
    if ([asset.weightLimitKg, asset.volumeLimitM3].some(n => n !== null && (!Number.isFinite(n) || n < 0))) {
      throw new FleetPolicyError("INVALID_CAPACITY_LIMIT");
    }
    if (asset.weightLimitKg === null || asset.volumeLimitM3 === null
      || !currentEvidence(asset.limitsEvidence, assignment.window, at)) unknown.push("ASSET_LIMITS_UNKNOWN");
    else if (usedWeight + assignment.capacityCommitted.weightKg > asset.weightLimitKg
      || usedVolume + assignment.capacityCommitted.volumeM3 > asset.volumeLimitM3) blocked.push("ASSIGNMENT_OVER_CAPACITY");
  }
  if (assignment.status === "CONFIRMED") {
    const reservation = context.reservation;
    if (!assignment.reservationId || !reservation || reservation.id !== assignment.reservationId) {
      blocked.push("CONFIRMED_ASSIGNMENT_REQUIRES_RESERVATION");
    } else {
      validateAmount(reservation.capacity);
      if (reservation.status !== "CONFIRMED" || reservation.carrierId !== assignment.carrierId
        || reservation.serviceId !== assignment.serviceId || reservation.executionId !== assignment.executionId
        || reservation.assetId !== assignment.assetId || !contains(reservation.window, assignment.window)
        || reservation.capacity.weightKg < assignment.capacityCommitted.weightKg
        || reservation.capacity.volumeM3 < assignment.capacityCommitted.volumeM3) blocked.push("ASSIGNMENT_RESERVATION_MISMATCH");
      if (!currentEvidence(reservation.evidence, assignment.window, at)) unknown.push("RESERVATION_EVIDENCE_UNKNOWN");
    }
    if (!currentEvidence(assignment.evidence, assignment.window, at)) unknown.push("ASSIGNMENT_EVIDENCE_UNKNOWN");
  }
  return decide(blocked, unknown);
}

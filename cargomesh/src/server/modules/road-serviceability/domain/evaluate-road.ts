/** Pure ROAD eligibility policy; no database, HTTP, or MCP dependencies. */

export type Status = "eligible" | "ineligible" | "unknown";
export type Location = { countryCode: string; regionCode?: string | null; city?: string | null; postalCode?: string | null };
export type Window = { startsAt: string; endsAt: string };

export type RoadRequest = {
  serviceClass?: "FTL" | "LTL";
  origin: Location;
  destination: Location;
  /** Full period for which a carrying resource must be available. */
  operationWindow: Window;
  pickupWindow: Window;
  deliveryWindow: Window;
  cargoCategoryCode: string;
  totalWeightKg: number;
  totalVolumeM3: number;
  indivisibleUnits?: Array<{ weightKg: number; volumeM3: number }>;
  requiredEquipmentCode?: string | null;
  requiredCertifications?: string[];
  temperatureRange?: { minCelsius: number; maxCelsius: number } | null;
  /** Missing verification for a hard requirement prevents an eligible result. */
  unverifiedRequirements: string[];
};

export type Area = {
  id: string;
  code?: string;
  role: "PICKUP" | "DELIVERY";
  coverage: "INCLUDE" | "EXCLUDE";
  granularity: "COUNTRY" | "REGION" | "CITY" | "POSTAL_CODE" | "POLYGON" | "POINTS";
  location: Location;
  active: boolean;
  validFrom: string | null;
  validUntil: string | null;
  evidenceAvailable?: boolean;
  partnerAgreement?: { status: string; startsAt: string; endsAt: string } | null;
};

export type Lane = {
  id: string;
  kind?: "DIRECT" | "WITHIN_AREA";
  borderReviewRequired?: boolean;
  crossBorderProhibited?: boolean;
  plannedTransitMinutes?: number | null;
  transitProvenanceStatus?: "VERIFIED" | "ESTIMATED" | "SIMULATED" | "UNKNOWN";
  pickupAreaId: string;
  deliveryAreaId: string;
  active: boolean;
  validFrom: string | null;
  validUntil: string | null;
  evidenceAvailable?: boolean;
};

export type Capacity = {
  id: string;
  sourceType?: "TRANSPORT_ASSET" | "CAPACITY_POOL";
  calendarId?: string | null;
  dataSource?: string;
  observedAt?: string | null;
  role: "CARRIER" | "ESCORT";
  equipmentCode: string | null;
  cargoCategoryCodes: string[] | null;
  cargoCapabilities?: Array<{
    categoryCode: string;
    certifications: string[] | null;
    temperatureMinC: number | null;
    temperatureMaxC: number | null;
    maxWeightKg?: number | null;
    evidenceAvailable?: boolean;
    validUntil?: string | null;
    requirements?: string[];
  }> | null;
  maxWeightKg: number | null;
  maxVolumeM3: number | null;
  /** Published fleet evidence is checked independently from a calendar slot. */
  sourceWindow?: Window | null;
  sourceEvidenceAvailable?: boolean;
  calendar: {
    validUntil: string | null;
    readyPickupAreaId?: string | null;
    provenanceStatus?: "VERIFIED" | "ESTIMATED" | "SIMULATED" | "UNKNOWN";
    /** A missing slot proves no availability only when the calendar is complete. */
    complete: boolean;
    availableWindows: Window[];
    reservations: Window[];
    maintenance: Window[];
    repositioning: Window[];
  } | null;
};

export type RoadService = {
  id: string;
  carrierId: string;
  carrierCode?: string;
  carrierName?: string;
  serviceCode?: string;
  serviceClass?: string;
  responseChannels?: Array<"MANUAL" | "API" | "MCP">;
  mode: "ROAD" | "RAIL" | "SEA" | "AIR";
  active: boolean;
  supportedCargoCategoryCodes: string[] | null;
  maxWeightKg?: number | null;
  maxVolumeM3?: number | null;
  areas: Area[];
  lanes: Lane[];
  capacities: Capacity[];
};

export type Candidate = {
  serviceId: string;
  carrierId: string;
  status: Status;
  reasons: string[];
  evidence: {
    pickup: ReturnType<typeof areaCheck>;
    delivery: ReturnType<typeof areaCheck>;
    lane: Check & { laneId?: string };
    cargo: Check;
    capacity: Check & { sourceId?: string };
    requirements: Check;
    temporal: Check;
    border: Check;
  };
  /** Never infer a road line from origin/destination coordinates. */
  routePreview: null;
};

type Check = { status: Status; reason?: string };

function instant(value: string): number {
  const result = Date.parse(value);
  if (!Number.isFinite(result)) throw new Error("INVALID_TIME_WINDOW");
  return result;
}

function validateWindow(window: Window): void {
  if (instant(window.startsAt) >= instant(window.endsAt)) throw new Error("INVALID_TIME_WINDOW");
}

function current(from: string | null, until: string | null, at: string): boolean {
  return from !== null && instant(from) <= instant(at) && (until === null || instant(until) > instant(at));
}

function validThrough(from: string | null, until: string | null, window: Window): boolean {
  return from !== null && instant(from) <= instant(window.startsAt)
    && (until === null || instant(until) >= instant(window.endsAt));
}

function overlaps(a: Window, b: Window): boolean {
  return instant(a.startsAt) < instant(b.endsAt) && instant(b.startsAt) < instant(a.endsAt);
}

function overlapsValidity(from: string | null, until: string | null, window: Window): boolean {
  return from !== null && instant(from) < instant(window.endsAt)
    && (until === null || instant(until) > instant(window.startsAt));
}

function contains(a: Window, b: Window): boolean {
  return instant(a.startsAt) <= instant(b.startsAt) && instant(a.endsAt) >= instant(b.endsAt);
}

function matches(area: Area, location: Location): boolean {
  if (area.location.countryCode !== location.countryCode) return false;
  if (area.granularity === "POLYGON" || area.granularity === "POINTS") return false;
  if (area.granularity === "COUNTRY") return true;
  if (area.location.regionCode && area.location.regionCode !== location.regionCode) return false;
  if (area.granularity === "REGION") return true;
  if (area.location.city !== location.city) return false;
  if (area.granularity === "CITY") return true;
  return Boolean(area.location.postalCode) && area.location.postalCode === location.postalCode;
}

function areaCheck(areas: Area[], role: Area["role"], location: Location, window: Window) {
  const evidenced = (area: Area) => area.evidenceAvailable !== false
    && (area.partnerAgreement === undefined || (area.partnerAgreement !== null
      && area.partnerAgreement.status === "ACTIVE"
      && contains({ startsAt: area.partnerAgreement.startsAt, endsAt: area.partnerAgreement.endsAt }, window)));
  const activeAtStart = areas.filter((area) => area.active && area.role === role
    && current(area.validFrom, area.validUntil, window.startsAt));
  // A published exclusion can begin after this pickup/delivery window starts.
  // Any overlap prevents confirmed coverage for the whole relevant window.
  if (areas.some((area) => area.active && area.role === role && area.coverage === "EXCLUDE"
    && evidenced(area) && matches(area, location) && overlapsValidity(area.validFrom, area.validUntil, window))) {
    return { status: "ineligible" as const, reason: `${role}_EXCLUDED`, includedIds: [] as string[] };
  }
  if (areas.some(area => area.active && area.role === role && area.location.countryCode === location.countryCode
    && (area.granularity === "POLYGON" || area.granularity === "POINTS"))) {
    return { status: "unknown" as const, reason: "GEOGRAPHY_EVALUATION_NOT_IMPLEMENTED", includedIds: [] as string[] };
  }
  // A matching unevidenced inclusion/exclusion or expired partner cannot become confirmed coverage.
  if (areas.some(area => area.active && area.role === role && matches(area, location) && !evidenced(area))) {
    return { status: "unknown" as const, reason: `${role}_COVERAGE_EVIDENCE_UNKNOWN`, includedIds: [] as string[] };
  }
  const valid = activeAtStart.filter((area) => validThrough(area.validFrom, area.validUntil, window));
  const includedIds = valid.filter((area) => area.coverage === "INCLUDE" && matches(area, location))
    .map((area) => area.id);
  if (includedIds.length > 0) return { status: "eligible" as const, includedIds };
  if (activeAtStart.some((area) => area.coverage === "INCLUDE" && matches(area, location))) {
    return { status: "unknown" as const, reason: `${role}_COVERAGE_EXPIRES`, includedIds };
  }
  if (valid.length === 0) return { status: "unknown" as const, reason: `${role}_COVERAGE_UNKNOWN`, includedIds };
  return { status: "ineligible" as const, reason: `NO_${role}_COVERAGE`, includedIds };
}

function laneCheck(lanes: Lane[], pickupIds: string[], deliveryIds: string[], window: Window): Check & { laneId?: string } {
  if (pickupIds.length === 0 || deliveryIds.length === 0) return { status: "unknown", reason: "LANE_NOT_EVALUABLE" };
  const activeAtStart = lanes.filter((lane) => lane.active && lane.evidenceAvailable !== false
    && current(lane.validFrom, lane.validUntil, window.startsAt));
  const valid = activeAtStart.filter((lane) => validThrough(lane.validFrom, lane.validUntil, window));
  const matched = valid.find((lane) => pickupIds.includes(lane.pickupAreaId)
    && deliveryIds.includes(lane.deliveryAreaId));
  if (matched) return { status: "eligible", laneId: matched.id };
  if (lanes.some(lane => lane.active && lane.evidenceAvailable === false
    && pickupIds.includes(lane.pickupAreaId) && deliveryIds.includes(lane.deliveryAreaId))) {
    return { status: "unknown", reason: "LANE_EVIDENCE_UNKNOWN" };
  }
  if (activeAtStart.some((lane) => pickupIds.includes(lane.pickupAreaId)
    && deliveryIds.includes(lane.deliveryAreaId))) {
    return { status: "unknown", reason: "LANE_EXPIRES" };
  }
  return valid.length === 0
    ? { status: "unknown", reason: "LANE_UNKNOWN" }
    : { status: "ineligible", reason: "NO_DIRECTED_LANE" };
}

function capacityCheck(capacity: Capacity, request: RoadRequest): Check {
  if (capacity.role !== "CARRIER") return { status: "ineligible", reason: "NOT_CARRYING_CAPACITY" };
  const cargoCapability = capacity.cargoCapabilities?.find(item => item.categoryCode === request.cargoCategoryCode);
  if (cargoCapability?.evidenceAvailable === false || (cargoCapability?.validUntil !== undefined
    && (cargoCapability.validUntil === null || instant(cargoCapability.validUntil) < instant(request.operationWindow.endsAt)))) {
    return { status: "unknown", reason: "CARGO_CAPABILITY_UNVERIFIED" };
  }
  if (cargoCapability?.requirements?.length) return { status: "unknown", reason: "CARGO_CAPABILITY_REQUIREMENTS_UNVERIFIED" };
  if (cargoCapability?.maxWeightKg != null && request.totalWeightKg > cargoCapability.maxWeightKg) {
    return { status: "ineligible", reason: "CARGO_CAPABILITY_OVER_CAPACITY" };
  }
  if (capacity.sourceEvidenceAvailable === false) return { status: "unknown", reason: "CAPACITY_SOURCE_UNVERIFIED" };
  if (capacity.sourceWindow === null) return { status: "unknown", reason: "CAPACITY_SOURCE_WINDOW_UNKNOWN" };
  if (capacity.sourceWindow && !contains(capacity.sourceWindow, request.operationWindow)) {
    return { status: "ineligible", reason: "OUTSIDE_CAPACITY_SOURCE_WINDOW" };
  }
  if (request.requiredEquipmentCode && capacity.equipmentCode === null) {
    return { status: "unknown", reason: "EQUIPMENT_UNKNOWN" };
  }
  if (request.requiredEquipmentCode && capacity.equipmentCode !== request.requiredEquipmentCode) {
    return { status: "ineligible", reason: "EQUIPMENT_MISMATCH" };
  }
  if (capacity.cargoCategoryCodes !== null && !capacity.cargoCategoryCodes.includes(request.cargoCategoryCode)) {
    return { status: "ineligible", reason: "CARGO_CATEGORY_UNSUPPORTED" };
  }
  if ((capacity.maxWeightKg !== null && capacity.maxWeightKg < request.totalWeightKg)
    || (capacity.maxVolumeM3 !== null && capacity.maxVolumeM3 < request.totalVolumeM3)) {
    return { status: "ineligible", reason: "OVER_CAPACITY" };
  }
  if (request.indivisibleUnits?.some((unit) =>
    (capacity.maxWeightKg !== null && capacity.maxWeightKg < unit.weightKg)
    || (capacity.maxVolumeM3 !== null && capacity.maxVolumeM3 < unit.volumeM3))) {
    return { status: "ineligible", reason: "INDIVISIBLE_UNIT_OVER_CAPACITY" };
  }
  if (capacity.cargoCategoryCodes === null) return { status: "unknown", reason: "CARGO_COMPATIBILITY_UNKNOWN" };
  if (capacity.maxWeightKg === null || capacity.maxVolumeM3 === null) {
    return { status: "unknown", reason: "CAPACITY_LIMIT_UNKNOWN" };
  }
  const calendar = capacity.calendar;
  if (calendar === null) return { status: "unknown", reason: "AVAILABILITY_UNKNOWN" };
  if (calendar.validUntil === null || instant(calendar.validUntil) < instant(request.operationWindow.endsAt)) {
    return { status: "unknown", reason: "CALENDAR_STALE" };
  }
  if ([...calendar.reservations, ...calendar.maintenance, ...calendar.repositioning]
    .some((block) => overlaps(block, request.operationWindow))) {
    return { status: "ineligible", reason: "CAPACITY_WINDOW_BLOCKED" };
  }
  if (calendar.provenanceStatus === "UNKNOWN" || calendar.provenanceStatus === "ESTIMATED") {
    return { status: "unknown", reason: "AVAILABILITY_NOT_VERIFIED" };
  }
  if (calendar.complete && calendar.availableWindows.some((window) => contains(window, request.operationWindow))) {
    return { status: "eligible" };
  }
  return calendar.complete
    ? { status: "ineligible", reason: "NO_CAPACITY_WINDOW" }
    : { status: "unknown", reason: "AVAILABILITY_UNKNOWN" };
}

function requirementsCheck(capacity: Capacity, request: RoadRequest): Check {
  if (request.unverifiedRequirements.length > 0) {
    return { status: "unknown", reason: "REQUIREMENTS_UNVERIFIED" };
  }
  if (!request.requiredCertifications?.length && !request.temperatureRange) return { status: "eligible" };
  const capability = capacity.cargoCapabilities?.find(
    (item) => item.categoryCode === request.cargoCategoryCode,
  );
  if (!capability) return { status: "unknown", reason: "REQUIREMENTS_UNVERIFIED" };
  if (request.requiredCertifications?.some(
    (required) => !capability.certifications?.includes(required),
  )) return { status: "unknown", reason: "CERTIFICATION_UNVERIFIED" };
  if (request.temperatureRange) {
    if (capability.temperatureMinC === null || capability.temperatureMaxC === null) {
      return { status: "unknown", reason: "TEMPERATURE_RANGE_UNVERIFIED" };
    }
    if (request.temperatureRange.minCelsius < capability.temperatureMinC
      || request.temperatureRange.maxCelsius > capability.temperatureMaxC) {
      return { status: "ineligible", reason: "TEMPERATURE_RANGE_UNSUPPORTED" };
    }
  }
  return { status: "eligible" };
}

function capacitiesCheck(capacities: Capacity[], request: RoadRequest,
  lane: Check & { laneId?: string }, service: RoadService): {
  capacity: Check & { sourceId?: string }; requirements: Check; temporal: Check;
} {
  const carrying = capacities.filter((capacity) => capacity.role === "CARRIER");
  if (carrying.length === 0) return {
    capacity: { status: "unknown", reason: "CARRYING_CAPACITY_UNKNOWN" },
    requirements: { status: "unknown", reason: "REQUIREMENTS_UNVERIFIED" },
    temporal: { status: "unknown", reason: "TEMPORAL_FEASIBILITY_UNKNOWN" },
  };
  const matchedLane = service.lanes.find((item) => item.id === lane.laneId);
  const checks = carrying.map((source) => {
    const physicalCapacity = capacityCheck(source, request);
    // Sprint 2 has no persisted LTL residual allocation/consolidation schedule.
    // Neither a free truck nor a generic pool proves those commercial constraints.
    const capacity = { ...(service.serviceClass === "LTL" && physicalCapacity.status === "eligible"
      ? { status: "unknown" as const, reason: "LTL_CAPACITY_AND_CONSOLIDATION_UNVERIFIED" }
      : physicalCapacity), sourceId: source.id };
    const requirements = requirementsCheck(source, request);
    const temporal = temporalCheck(request, matchedLane, source);
    return { capacity, requirements, temporal, status: combine([capacity, requirements, temporal]).status };
  });
  const selected = checks.find((check) => check.status === "eligible")
    ?? checks.find((check) => check.status === "unknown") ?? checks[0]!;
  return { capacity: selected.capacity, requirements: selected.requirements, temporal: selected.temporal };
}

function combine(checks: Check[]): Pick<Candidate, "status" | "reasons"> {
  const reasons = [...new Set(checks.map((check) => check.reason)
    .filter((reason): reason is string => Boolean(reason)))];
  if (checks.some((check) => check.status === "ineligible")) return { status: "ineligible", reasons };
  if (checks.some((check) => check.status === "unknown")) return { status: "unknown", reasons };
  return { status: "eligible", reasons };
}

function temporalCheck(request: RoadRequest, lane: Lane | undefined, source: Capacity): Check {
  if (!lane || !Number.isFinite(lane.plannedTransitMinutes)
    || lane.plannedTransitMinutes == null || lane.plannedTransitMinutes <= 0
    || !["VERIFIED", "SIMULATED"].includes(lane.transitProvenanceStatus ?? "UNKNOWN")
    || source.calendar?.readyPickupAreaId !== lane.pickupAreaId
    || !["VERIFIED", "SIMULATED"].includes(source.calendar.provenanceStatus ?? "UNKNOWN")) {
    return { status: "unknown", reason: "TEMPORAL_FEASIBILITY_UNKNOWN" };
  }
  const latestArrival = instant(request.pickupWindow.endsAt) + lane.plannedTransitMinutes * 60_000;
  return latestArrival <= instant(request.deliveryWindow.endsAt)
    ? { status: "eligible" }
    : { status: "ineligible", reason: "DELIVERY_WINDOW_UNREACHABLE" };
}

function borderCheck(request: RoadRequest, lane: Lane | undefined): Check {
  if (lane?.crossBorderProhibited) {
    return { status: "ineligible", reason: "BORDER_CROSSING_PROHIBITED" };
  }
  return request.origin.countryCode === request.destination.countryCode && !lane?.borderReviewRequired
    ? { status: "eligible" }
    : { status: "unknown", reason: "BORDER_DOCS_UNKNOWN" };
}

export function evaluateRoad(request: RoadRequest, services: RoadService[]) {
  validateWindow(request.operationWindow);
  validateWindow(request.pickupWindow);
  validateWindow(request.deliveryWindow);
  if (instant(request.operationWindow.startsAt) !== instant(request.pickupWindow.startsAt)
    || instant(request.operationWindow.endsAt) !== instant(request.deliveryWindow.endsAt)) {
    throw new Error("INCONSISTENT_OPERATION_WINDOW");
  }
  if (!Number.isFinite(request.totalWeightKg) || request.totalWeightKg <= 0
    || !Number.isFinite(request.totalVolumeM3) || request.totalVolumeM3 <= 0) {
    throw new Error("INVALID_CARGO_DIMENSIONS");
  }
  const candidates: Candidate[] = services.filter((service) => service.active && service.mode === "ROAD"
    && (!request.serviceClass || !service.serviceClass || service.serviceClass === request.serviceClass))
    .flatMap((service): Candidate[] => {
      const pickup = areaCheck(service.areas, "PICKUP", request.origin, request.pickupWindow);
      const delivery = areaCheck(service.areas, "DELIVERY", request.destination, request.deliveryWindow);
      // A known absence of declared coverage is not a route candidate. Missing
      // coverage evidence remains UNKNOWN and explicit exclusions stay visible.
      if (pickup.reason === "NO_PICKUP_COVERAGE" || delivery.reason === "NO_DELIVERY_COVERAGE") return [];
      let cargo: Check = service.supportedCargoCategoryCodes === null
        ? { status: "unknown", reason: "SERVICE_CARGO_UNKNOWN" }
        : service.supportedCargoCategoryCodes.includes(request.cargoCategoryCode)
          ? { status: "eligible" }
          : { status: "ineligible", reason: "SERVICE_CARGO_UNSUPPORTED" };
      if ((service.maxWeightKg != null && request.totalWeightKg > service.maxWeightKg)
        || (service.maxVolumeM3 != null && request.totalVolumeM3 > service.maxVolumeM3)) {
        cargo = { status: "ineligible", reason: "SERVICE_CAPACITY_LIMIT_EXCEEDED" };
      } else if (cargo.status === "eligible" && (service.maxWeightKg === null || service.maxVolumeM3 === null)) {
        cargo = { status: "unknown", reason: "SERVICE_CAPACITY_LIMIT_UNKNOWN" };
      }
      const lane = laneCheck(service.lanes, pickup.includedIds, delivery.includedIds, request.operationWindow);
      const { capacity, requirements, temporal } = capacitiesCheck(service.capacities, request, lane, service);
      const border = borderCheck(request, service.lanes.find((item) => item.id === lane.laneId));
      return [{
        serviceId: service.id,
        carrierId: service.carrierId,
        ...combine([
          pickup, delivery,
          lane, cargo, capacity, requirements, temporal, border,
        ]),
        evidence: { pickup, delivery, lane, cargo, capacity, requirements, temporal, border },
        routePreview: null,
      }];
    });
  const overallStatus: Status = candidates.some((candidate) => candidate.status === "eligible")
    ? "eligible"
    : candidates.some((candidate) => candidate.status === "unknown") ? "unknown" : "ineligible";
  return { overallStatus, totalEvaluated: candidates.length, candidates };
}

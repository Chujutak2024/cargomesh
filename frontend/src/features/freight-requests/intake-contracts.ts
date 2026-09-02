export const FREIGHT_REQUEST_INTAKE_SCHEMA_VERSION = "1.0" as const;

export type FreightRequestIntakeStatus =
  | "DRAFT"
  | "PENDING"
  | "ORCHESTRATING"
  | "AWAITING_SELECTION"
  | "BOOKING"
  | "BOOKED"
  | "FAILED"
  | "CANCELLED";

export type FreightRequestIntakeViewModel = {
  schemaVersion: typeof FREIGHT_REQUEST_INTAKE_SCHEMA_VERSION;
  freightRequestId: string;
  requestCode: string;
  organization: { id: string; name: string; defaultCurrency: string };
  currentOperator: { memberId: string; displayName: string };
  status: FreightRequestIntakeStatus;
  cargo: {
    profileName: string | null;
    categoryName: string;
    categoryCode: string;
    entryMethod: string;
    quantity: number | null;
    unitsPerEntry: number | null;
    unitWeightKg: number | null;
    lengthCm: number | null;
    widthCm: number | null;
    heightCm: number | null;
    totalWeightKg: number;
    totalVolumeM3: number | null;
  };
  route: {
    origin: string;
    destination: string;
    pickupContact: { name: string | null; phone: string | null };
    deliveryContact: {
      name: string | null;
      company: string | null;
      phone: string | null;
    };
    operationalNotes: string | null;
  };
  execution: {
    transportMode: string;
    serviceType: string;
    pickupMode: "ASAP" | "SCHEDULED";
    requiredPickup: string;
    pickupWindowStart: string | null;
    pickupWindowEnd: string | null;
    deliveryDeadline: string | null;
    budgetMax: number | null;
    strategy: "BALANCED";
    availableDocuments: string[];
  };
  updatedAt: string;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUSES = new Set<FreightRequestIntakeStatus>([
  "DRAFT",
  "PENDING",
  "ORCHESTRATING",
  "AWAITING_SELECTION",
  "BOOKING",
  "BOOKED",
  "FAILED",
  "CANCELLED",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`INVALID_FREIGHT_REQUEST_INTAKE: ${field} is required.`);
  }
  return value.trim();
}

function optionalString(value: unknown, field: string): string | null {
  if (value === null) return null;
  return requiredString(value, field);
}

function requiredNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new Error(`INVALID_FREIGHT_REQUEST_INTAKE: ${field} must be positive.`);
  }
  return value;
}

function optionalNumber(value: unknown, field: string): number | null {
  return value === null ? null : requiredNumber(value, field);
}

function uuid(value: unknown, field: string): string {
  const result = requiredString(value, field);
  if (!UUID_PATTERN.test(result)) {
    throw new Error(`INVALID_FREIGHT_REQUEST_INTAKE: ${field} must be a UUID.`);
  }
  return result;
}

function isoDateTime(value: unknown, field: string): string {
  const raw = requiredString(value, field);
  const timestamp = Date.parse(raw);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(raw) || !Number.isFinite(timestamp)) {
    throw new Error(`INVALID_FREIGHT_REQUEST_INTAKE: ${field} must be an ISO date-time.`);
  }
  return new Date(timestamp).toISOString();
}

function optionalIsoDateTime(value: unknown, field: string): string | null {
  if (value === null) return null;
  return isoDateTime(value, field);
}

function parseContact(value: unknown, field: string) {
  if (!isRecord(value)) {
    throw new Error(`INVALID_FREIGHT_REQUEST_INTAKE: ${field} must be an object.`);
  }
  return value;
}

function parseDocuments(value: unknown): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || item.trim().length === 0)) {
    throw new Error("INVALID_FREIGHT_REQUEST_INTAKE: availableDocuments must be a string array.");
  }
  return [...value];
}

export function parseFreightRequestIntakeViewModel(
  raw: unknown,
): FreightRequestIntakeViewModel {
  if (!isRecord(raw)) {
    throw new Error("INVALID_FREIGHT_REQUEST_INTAKE: payload must be an object.");
  }

  const schemaVersion = requiredString(raw.schemaVersion, "schemaVersion");
  if (schemaVersion !== FREIGHT_REQUEST_INTAKE_SCHEMA_VERSION) {
    throw new Error("INVALID_FREIGHT_REQUEST_INTAKE: unsupported schemaVersion.");
  }

  const freightRequestId = requiredString(raw.freightRequestId, "freightRequestId");
  if (!UUID_PATTERN.test(freightRequestId)) {
    throw new Error("INVALID_FREIGHT_REQUEST_INTAKE: freightRequestId must be a UUID.");
  }

  if (!isRecord(raw.organization) || !isRecord(raw.currentOperator) || !isRecord(raw.cargo) || !isRecord(raw.route) || !isRecord(raw.execution)) {
    throw new Error("INVALID_FREIGHT_REQUEST_INTAKE: nested fields must be objects.");
  }

  const status = requiredString(raw.status, "status");
  if (!STATUSES.has(status as FreightRequestIntakeStatus)) {
    throw new Error("INVALID_FREIGHT_REQUEST_INTAKE: status is unsupported.");
  }
  const pickupMode = requiredString(raw.execution.pickupMode, "execution.pickupMode");
  if (pickupMode !== "ASAP" && pickupMode !== "SCHEDULED") {
    throw new Error("INVALID_FREIGHT_REQUEST_INTAKE: execution.pickupMode is unsupported.");
  }
  const strategy = requiredString(raw.execution.strategy, "execution.strategy");
  if (strategy !== "BALANCED") {
    throw new Error("INVALID_FREIGHT_REQUEST_INTAKE: execution.strategy is unsupported.");
  }

  const pickupWindowStart = optionalIsoDateTime(raw.execution.pickupWindowStart, "execution.pickupWindowStart");
  const pickupWindowEnd = optionalIsoDateTime(raw.execution.pickupWindowEnd, "execution.pickupWindowEnd");
  const deliveryDeadline = optionalIsoDateTime(raw.execution.deliveryDeadline, "execution.deliveryDeadline");
  if (pickupMode === "SCHEDULED" && (!pickupWindowStart || !pickupWindowEnd)) {
    throw new Error("INVALID_FREIGHT_REQUEST_INTAKE: SCHEDULED requires a complete pickup window.");
  }
  if (pickupWindowStart && pickupWindowEnd && Date.parse(pickupWindowEnd) <= Date.parse(pickupWindowStart)) {
    throw new Error("INVALID_FREIGHT_REQUEST_INTAKE: pickupWindowEnd must be after pickupWindowStart.");
  }
  if (pickupWindowStart && deliveryDeadline && Date.parse(deliveryDeadline) <= Date.parse(pickupWindowStart)) {
    throw new Error("INVALID_FREIGHT_REQUEST_INTAKE: deliveryDeadline must be after pickupWindowStart.");
  }

  const pickupContact = parseContact(raw.route.pickupContact, "route.pickupContact");
  const deliveryContact = parseContact(raw.route.deliveryContact, "route.deliveryContact");

  return {
    schemaVersion: FREIGHT_REQUEST_INTAKE_SCHEMA_VERSION,
    freightRequestId,
    requestCode: requiredString(raw.requestCode, "requestCode"),
    organization: {
      id: uuid(raw.organization.id, "organization.id"),
      name: requiredString(raw.organization.name, "organization.name"),
      defaultCurrency: requiredString(raw.organization.defaultCurrency, "organization.defaultCurrency"),
    },
    currentOperator: {
      memberId: uuid(raw.currentOperator.memberId, "currentOperator.memberId"),
      displayName: requiredString(raw.currentOperator.displayName, "currentOperator.displayName"),
    },
    status: status as FreightRequestIntakeStatus,
    cargo: {
      profileName: optionalString(raw.cargo.profileName, "cargo.profileName"),
      categoryName: requiredString(raw.cargo.categoryName, "cargo.categoryName"),
      categoryCode: requiredString(raw.cargo.categoryCode, "cargo.categoryCode"),
      entryMethod: requiredString(raw.cargo.entryMethod, "cargo.entryMethod"),
      quantity: optionalNumber(raw.cargo.quantity, "cargo.quantity"),
      unitsPerEntry: optionalNumber(raw.cargo.unitsPerEntry, "cargo.unitsPerEntry"),
      unitWeightKg: optionalNumber(raw.cargo.unitWeightKg, "cargo.unitWeightKg"),
      lengthCm: optionalNumber(raw.cargo.lengthCm, "cargo.lengthCm"),
      widthCm: optionalNumber(raw.cargo.widthCm, "cargo.widthCm"),
      heightCm: optionalNumber(raw.cargo.heightCm, "cargo.heightCm"),
      totalWeightKg: requiredNumber(raw.cargo.totalWeightKg, "cargo.totalWeightKg"),
      totalVolumeM3: optionalNumber(raw.cargo.totalVolumeM3, "cargo.totalVolumeM3"),
    },
    route: {
      origin: requiredString(raw.route.origin, "route.origin"),
      destination: requiredString(raw.route.destination, "route.destination"),
      pickupContact: {
        name: optionalString(pickupContact.name, "route.pickupContact.name"),
        phone: optionalString(pickupContact.phone, "route.pickupContact.phone"),
      },
      deliveryContact: {
        name: optionalString(deliveryContact.name, "route.deliveryContact.name"),
        company: optionalString(deliveryContact.company, "route.deliveryContact.company"),
        phone: optionalString(deliveryContact.phone, "route.deliveryContact.phone"),
      },
      operationalNotes: optionalString(raw.route.operationalNotes, "route.operationalNotes"),
    },
    execution: {
      transportMode: requiredString(raw.execution.transportMode, "execution.transportMode"),
      serviceType: requiredString(raw.execution.serviceType, "execution.serviceType"),
      pickupMode,
      requiredPickup: isoDateTime(raw.execution.requiredPickup, "execution.requiredPickup"),
      pickupWindowStart,
      pickupWindowEnd,
      deliveryDeadline,
      budgetMax: optionalNumber(raw.execution.budgetMax, "execution.budgetMax"),
      strategy: "BALANCED",
      availableDocuments: parseDocuments(raw.execution.availableDocuments),
    },
    updatedAt: isoDateTime(raw.updatedAt, "updatedAt"),
  };
}

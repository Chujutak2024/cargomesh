export const FREIGHT_REQUEST_EXECUTION_INTENT_SCHEMA_VERSION = "1.0" as const;

export type FreightRequestExecutionIntentStatus =
  | "DRAFT"
  | "PENDING"
  | "ORCHESTRATING"
  | "AWAITING_SELECTION"
  | "BOOKING"
  | "BOOKED"
  | "FAILED"
  | "CANCELLED";

export type FreightRequestExecutionIntent = {
  schemaVersion: typeof FREIGHT_REQUEST_EXECUTION_INTENT_SCHEMA_VERSION;
  freightRequestId: string;
  requestCode: string;
  status: FreightRequestExecutionIntentStatus;
  pickupMode: "ASAP" | "SCHEDULED";
  requiredPickup: string;
  pickupWindowStart: string | null;
  pickupWindowEnd: string | null;
  deliveryDeadline: string | null;
  updatedAt: string;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const STATUSES = new Set<FreightRequestExecutionIntentStatus>([
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
    throw new Error(`INVALID_EXECUTION_INTENT: ${field} is required.`);
  }
  return value.trim();
}

function isoDateTime(value: unknown, field: string): string {
  const raw = requiredString(value, field);
  const timestamp = Date.parse(raw);
  if (!Number.isFinite(timestamp)) {
    throw new Error(`INVALID_EXECUTION_INTENT: ${field} must be an ISO date-time.`);
  }
  return new Date(timestamp).toISOString();
}

function optionalIsoDateTime(value: unknown, field: string): string | null {
  if (value === null) return null;
  return isoDateTime(value, field);
}

export function parseFreightRequestExecutionIntent(
  raw: unknown,
): FreightRequestExecutionIntent {
  if (!isRecord(raw)) {
    throw new Error("INVALID_EXECUTION_INTENT: payload must be an object.");
  }

  const freightRequestId = requiredString(raw.freightRequestId, "freightRequestId");
  if (!UUID_PATTERN.test(freightRequestId)) {
    throw new Error("INVALID_EXECUTION_INTENT: freightRequestId must be a UUID.");
  }

  const schemaVersion = requiredString(raw.schemaVersion, "schemaVersion");
  if (schemaVersion !== FREIGHT_REQUEST_EXECUTION_INTENT_SCHEMA_VERSION) {
    throw new Error("INVALID_EXECUTION_INTENT: unsupported schemaVersion.");
  }

  const status = requiredString(raw.status, "status");
  if (!STATUSES.has(status as FreightRequestExecutionIntentStatus)) {
    throw new Error("INVALID_EXECUTION_INTENT: status is unsupported.");
  }

  const pickupMode = requiredString(raw.pickupMode, "pickupMode");
  if (pickupMode !== "ASAP" && pickupMode !== "SCHEDULED") {
    throw new Error("INVALID_EXECUTION_INTENT: pickupMode must be ASAP or SCHEDULED.");
  }

  const requiredPickup = isoDateTime(raw.requiredPickup, "requiredPickup");
  const pickupWindowStart = optionalIsoDateTime(
    raw.pickupWindowStart,
    "pickupWindowStart",
  );
  const pickupWindowEnd = optionalIsoDateTime(raw.pickupWindowEnd, "pickupWindowEnd");
  const deliveryDeadline = optionalIsoDateTime(
    raw.deliveryDeadline,
    "deliveryDeadline",
  );

  if (pickupMode === "SCHEDULED" && (!pickupWindowStart || !pickupWindowEnd)) {
    throw new Error(
      "INVALID_EXECUTION_INTENT: SCHEDULED requires pickupWindowStart and pickupWindowEnd.",
    );
  }
  if (
    pickupWindowStart &&
    pickupWindowEnd &&
    Date.parse(pickupWindowEnd) <= Date.parse(pickupWindowStart)
  ) {
    throw new Error(
      "INVALID_EXECUTION_INTENT: pickupWindowEnd must be after pickupWindowStart.",
    );
  }
  if (
    pickupWindowStart &&
    deliveryDeadline &&
    Date.parse(deliveryDeadline) <= Date.parse(pickupWindowStart)
  ) {
    throw new Error(
      "INVALID_EXECUTION_INTENT: deliveryDeadline must be after pickupWindowStart.",
    );
  }

  return {
    schemaVersion: FREIGHT_REQUEST_EXECUTION_INTENT_SCHEMA_VERSION,
    freightRequestId,
    requestCode: requiredString(raw.requestCode, "requestCode"),
    status: status as FreightRequestExecutionIntentStatus,
    pickupMode,
    requiredPickup,
    pickupWindowStart,
    pickupWindowEnd,
    deliveryDeadline,
    updatedAt: isoDateTime(raw.updatedAt, "updatedAt"),
  };
}

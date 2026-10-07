export type EvidencePresentationState =
  | "pending"
  | "commercial-success"
  | "commercial-rejection"
  | "technical-error"
  | "recorded";

export type ProviderOriginKind = "cargomesh-origin" | "registered-external" | "unknown";
export type CleanupPresentationState = "verified" | "remaining-tools" | "not-reported";

type EvidenceLike = {
  eventType?: string;
  toolName?: string;
  status?: string;
  executionStatus?: string;
  outputPayload?: unknown;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function readNestedRecords(value: unknown): Record<string, unknown>[] {
  const root = asRecord(value);
  if (!root) return [];
  const data = asRecord(root.data);
  const result = asRecord(root.result);
  return [root, data, result].filter((entry): entry is Record<string, unknown> => entry !== null);
}

export function classifyEvidenceState(evidence: EvidenceLike): EvidencePresentationState {
  const statuses = [evidence.status, evidence.executionStatus, evidence.eventType]
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.toUpperCase());
  const records = readNestedRecords(evidence.outputPayload);

  if (
    statuses.some((value) => ["FAILED", "ERROR", "TECHNICAL_ERROR"].some((token) => value.includes(token)))
    || records.some((record) => record.ok === false)
  ) return "technical-error";

  if (
    statuses.some((value) => ["REJECTED", "NO_MATCH", "UNAVAILABLE"].some((token) => value.includes(token)))
    || records.some((record) => record.supported === false || record.available === false || record.providerBookingStatus === "REJECTED")
  ) return "commercial-rejection";

  if (
    statuses.some((value) => ["PENDING", "RUNNING", "STARTED"].some((token) => value.includes(token)))
  ) return "pending";

  return evidence.toolName || statuses.some((value) => value.includes("TOOL"))
    ? "commercial-success"
    : "recorded";
}

export function classifyProviderOrigin(
  providerUrl: string | null | undefined,
  cargoMeshOrigin: string | null | undefined,
): ProviderOriginKind {
  if (!providerUrl) return "unknown";
  try {
    const base = cargoMeshOrigin ? new URL(cargoMeshOrigin) : null;
    const target = base ? new URL(providerUrl, base) : new URL(providerUrl);
    if (!['http:', 'https:'].includes(target.protocol) || target.username || target.password) return "unknown";
    if (!base) return providerUrl.startsWith("/") ? "cargomesh-origin" : "unknown";
    return target.origin === base.origin ? "cargomesh-origin" : "registered-external";
  } catch {
    return providerUrl.startsWith("/") ? "cargomesh-origin" : "unknown";
  }
}

export function readCleanupState(evidence: EvidenceLike): CleanupPresentationState {
  const records = readNestedRecords(evidence.outputPayload);
  for (const record of records) {
    for (const key of ["cleanupToolNames", "activeToolNames", "remainingToolNames"]) {
      const value = record[key];
      if (Array.isArray(value)) return value.length === 0 ? "verified" : "remaining-tools";
    }
  }
  return "not-reported";
}

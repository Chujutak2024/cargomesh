import {
  RECOMMENDATION_PROPOSED_FIELD_NAMES,
  type RecommendationJsonValue,
  type RecommendationProposedFields,
} from "./contracts";
import type {
  ApplyRecommendationDraftInput,
  ApplyRecommendationDraftResult,
  FreightRequestDraft,
} from "./recommendation-draft-contracts";
import {
  RecommendationAcceptanceError,
  type PersistRecommendationAcceptance,
  type PersistRecommendationAcceptanceInput,
} from "./recommendation-acceptance";

type Request = typeof fetch;

const proposedFieldNames = new Set<string>(RECOMMENDATION_PROPOSED_FIELD_NAMES);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]) {
  return Object.keys(value).every((key) => keys.includes(key));
}

function isJsonValue(value: unknown): value is RecommendationJsonValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJsonValue);
  return isRecord(value) && Object.values(value).every(isJsonValue);
}

function parseDraft(value: unknown, freightRequestId: string): FreightRequestDraft {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      "schemaVersion",
      "freightRequestId",
      "requestCode",
      "draftVersion",
      "fields",
      "normalized",
    ]) ||
    value.schemaVersion !== "1.0" ||
    value.freightRequestId !== freightRequestId ||
    typeof value.requestCode !== "string" ||
    value.requestCode.length === 0 ||
    !Number.isInteger(value.draftVersion) ||
    (value.draftVersion as number) < 1 ||
    !isRecord(value.fields) ||
    !isRecord(value.normalized)
  ) {
    throw invalidDraftResponse();
  }

  if (
    !Object.keys(value.fields).every((field) => proposedFieldNames.has(field)) ||
    !Object.values(value.fields).every(isJsonValue) ||
    !hasOnlyKeys(value.normalized, ["cargoWeightKg", "cargoVolumeM3"]) ||
    typeof value.normalized.cargoWeightKg !== "number" ||
    !Number.isFinite(value.normalized.cargoWeightKg) ||
    (
      value.normalized.cargoVolumeM3 !== null &&
      (
        typeof value.normalized.cargoVolumeM3 !== "number" ||
        !Number.isFinite(value.normalized.cargoVolumeM3)
      )
    )
  ) {
    throw invalidDraftResponse();
  }

  return value as unknown as FreightRequestDraft;
}

function invalidDraftResponse() {
  return new RecommendationAcceptanceError(
    "INVALID_CANONICAL_DRAFT",
    "D1-01 devolvió una respuesta de borrador inválida.",
  );
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new RecommendationAcceptanceError(
      "D1_01_UNAVAILABLE",
      "D1-01 devolvió una respuesta que no es JSON.",
    );
  }
}

function throwDraftRequestError(response: Response, payload: unknown): never {
  const error = isRecord(payload) && isRecord(payload.error) ? payload.error : null;
  const code = error && typeof error.code === "string" ? error.code : "D1_01_UNAVAILABLE";
  const message = error && typeof error.message === "string"
    ? error.message
    : "No fue posible guardar el borrador mediante D1-01.";
  throw new RecommendationAcceptanceError(
    response.status === 409 && code === "STALE_DRAFT"
      ? "STALE_DRAFT"
      : "D1_01_UNAVAILABLE",
    message,
  );
}

export async function fetchFreightRequestDraft(
  freightRequestId: string,
  signal: AbortSignal,
  request: Request = fetch,
): Promise<FreightRequestDraft> {
  const response = await request(
    `/api/freight-requests/${encodeURIComponent(freightRequestId)}/draft`,
    {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
      signal,
    },
  );
  const payload = await readJson(response);
  if (!response.ok) throwDraftRequestError(response, payload);
  if (!isRecord(payload) || !hasOnlyKeys(payload, ["ok", "data"]) || payload.ok !== true) {
    throw invalidDraftResponse();
  }
  return parseDraft(payload.data, freightRequestId);
}

export async function persistFreightRecommendationDraft(
  input: PersistRecommendationAcceptanceInput,
  signal: AbortSignal,
  request: Request = fetch,
): ReturnType<PersistRecommendationAcceptance> {
  const body: ApplyRecommendationDraftInput = {
    draftVersion: input.draftVersion,
    proposedFields: input.acceptedFields,
  };
  const response = await request(
    `/api/freight-requests/${encodeURIComponent(input.freightRequestId)}/draft`,
    {
      method: "PATCH",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      credentials: "same-origin",
      cache: "no-store",
      body: JSON.stringify(body),
      signal,
    },
  );
  const payload = await readJson(response);
  if (!response.ok) throwDraftRequestError(response, payload);
  if (
    !isRecord(payload) ||
    !hasOnlyKeys(payload, ["ok", "data"]) ||
    payload.ok !== true ||
    !isRecord(payload.data) ||
    !hasOnlyKeys(payload.data, ["draft"])
  ) {
    throw invalidDraftResponse();
  }
  const data = payload.data as unknown as ApplyRecommendationDraftResult;
  return parseDraft(data.draft, input.freightRequestId);
}

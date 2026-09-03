import {
  parseFreightRequestIntakeViewModel,
  type FreightRequestIntakeViewModel,
} from "./intake-contracts";
import type { ManualFreightRequestIntakeFields } from "./manual-intake-contracts";

export class DraftCreationClientError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "DraftCreationClientError";
  }
}

export type CreateFreightRequestDraftFields = ManualFreightRequestIntakeFields & {
  requiresRefrigeration?: boolean;
  temperatureMinC?: number | null;
  temperatureMaxC?: number | null;
  isHazardous?: boolean;
  isOversized?: boolean;
  isFragile?: boolean;
};

export type CreateFreightRequestDraftInput = {
  fields: CreateFreightRequestDraftFields;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readJson(response: Response) {
  try {
    return await response.json();
  } catch {
    throw new DraftCreationClientError(
      "DRAFT_CREATION_UNAVAILABLE",
      "El servicio de creación de borradores devolvió una respuesta no válida.",
    );
  }
}

export async function createFreightRequestDraft(
  input: CreateFreightRequestDraftInput,
  signal?: AbortSignal,
  request: typeof fetch = fetch,
): Promise<FreightRequestIntakeViewModel> {
  const response = await request("/api/freight-requests/drafts", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    credentials: "same-origin",
    cache: "no-store",
    body: JSON.stringify(input),
    signal,
  });

  const payload = await readJson(response);

  if (!response.ok) {
    const error = isRecord(payload) && isRecord(payload.error) ? payload.error : {};
    const code = typeof error.code === "string" ? error.code : "DRAFT_CREATION_FAILED";
    const message = typeof error.message === "string"
      ? error.message
      : "No fue posible crear el borrador en el servidor.";
    throw new DraftCreationClientError(code, message);
  }

  if (!isRecord(payload) || payload.ok !== true || !Object.hasOwn(payload, "data")) {
    throw new DraftCreationClientError(
      "INVALID_CANONICAL_INTAKE",
      "El servidor no devolvió el intake canónico del nuevo borrador.",
    );
  }

  return parseFreightRequestIntakeViewModel(payload.data);
}

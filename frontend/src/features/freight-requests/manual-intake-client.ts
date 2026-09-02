import {
  parseFreightRequestIntakeViewModel,
  type FreightRequestIntakeViewModel,
} from "./intake-contracts";
import type { ManualFreightRequestIntakeInput } from "./manual-intake-contracts";

export class ManualFreightRequestIntakeClientError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "ManualFreightRequestIntakeClientError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readJson(response: Response) {
  try {
    return await response.json();
  } catch {
    throw new ManualFreightRequestIntakeClientError(
      "MANUAL_INTAKE_UNAVAILABLE",
      "El guardado manual devolvió una respuesta no válida.",
    );
  }
}

export async function persistManualFreightRequestIntake(
  freightRequestId: string,
  input: ManualFreightRequestIntakeInput,
  signal: AbortSignal,
  request: typeof fetch = fetch,
): Promise<FreightRequestIntakeViewModel> {
  const response = await request(
    `/api/freight-requests/${encodeURIComponent(freightRequestId)}/manual-intake`,
    {
      method: "PATCH",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      credentials: "same-origin",
      cache: "no-store",
      body: JSON.stringify(input),
      signal,
    },
  );
  const payload = await readJson(response);
  if (!response.ok) {
    const error = isRecord(payload) && isRecord(payload.error) ? payload.error : {};
    const code = typeof error.code === "string"
      ? error.code
      : "MANUAL_INTAKE_UNAVAILABLE";
    const message = typeof error.message === "string"
      ? error.message
      : "No fue posible guardar el borrador manual.";
    throw new ManualFreightRequestIntakeClientError(code, message);
  }
  if (!isRecord(payload) || payload.ok !== true || !Object.hasOwn(payload, "data")) {
    throw new ManualFreightRequestIntakeClientError(
      "INVALID_CANONICAL_INTAKE",
      "El servidor no devolvió el intake canónico.",
    );
  }
  return parseFreightRequestIntakeViewModel(payload.data);
}

import {
  CreateFreightRequestSchema,
  SubmitFreightRequestSchema,
  type CreateFreightRequestInput,
} from "@/shared/schemas/freight-request";
import {
  parseFreightRequestIntakeViewModel,
  type FreightRequestIntakeViewModel,
} from "@/features/freight-requests/intake-contracts";

export class FreightRequestHonoClientError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number | null = null,
  ) {
    super(message);
    this.name = "FreightRequestHonoClientError";
  }
}

type Requester = typeof fetch;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function issueMessage(error: { issues: Array<{ path: PropertyKey[]; message: string }> }) {
  return error.issues
    .map((issue) => `${issue.path.join(".") || "payload"}: ${issue.message}`)
    .join("; ");
}

async function readCanonicalIntake(response: Response): Promise<FreightRequestIntakeViewModel> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new FreightRequestHonoClientError(
      "HONO_V2_UNAVAILABLE",
      "La API Hono V2 devolvió una respuesta no válida.",
      response.status || null,
    );
  }

  if (!response.ok) {
    const error = isRecord(payload) && isRecord(payload.error) ? payload.error : {};
    const code = typeof error.code === "string" ? error.code : "HONO_V2_REQUEST_FAILED";
    const message = typeof error.message === "string"
      ? error.message
      : "La API Hono V2 no pudo procesar la solicitud.";
    throw new FreightRequestHonoClientError(code, message, response.status);
  }

  if (!isRecord(payload) || payload.ok !== true || !Object.hasOwn(payload, "data")) {
    throw new FreightRequestHonoClientError(
      "INVALID_CANONICAL_INTAKE",
      "La API Hono V2 no devolvió el intake canónico esperado.",
      response.status,
    );
  }

  try {
    return parseFreightRequestIntakeViewModel(payload.data);
  } catch (error) {
    throw new FreightRequestHonoClientError(
      "INVALID_CANONICAL_INTAKE",
      error instanceof Error ? error.message : "El intake canónico no es válido.",
      response.status,
    );
  }
}

export async function createFreightRequest(
  rawInput: CreateFreightRequestInput,
  signal?: AbortSignal,
  request: Requester = fetch,
): Promise<FreightRequestIntakeViewModel> {
  const parsed = CreateFreightRequestSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new FreightRequestHonoClientError(
      "INVALID_ARGUMENT",
      issueMessage(parsed.error),
      400,
    );
  }

  const response = await request("/api/v2/freight/requests", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    credentials: "same-origin",
    cache: "no-store",
    body: JSON.stringify(parsed.data),
    signal,
  });

  return readCanonicalIntake(response);
}

export async function submitFreightRequest(
  freightRequestId: string,
  expectedDraftVersion: number,
  signal?: AbortSignal,
  request: Requester = fetch,
): Promise<FreightRequestIntakeViewModel> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(freightRequestId)) {
    throw new FreightRequestHonoClientError(
      "INVALID_ARGUMENT",
      "freightRequestId debe ser un UUID válido.",
      400,
    );
  }

  const parsed = SubmitFreightRequestSchema.safeParse({
    expected_draft_version: expectedDraftVersion,
  });
  if (!parsed.success) {
    throw new FreightRequestHonoClientError(
      "INVALID_ARGUMENT",
      issueMessage(parsed.error),
      400,
    );
  }

  const response = await request(
    `/api/v2/freight/requests/${encodeURIComponent(freightRequestId)}/submit`,
    {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      credentials: "same-origin",
      cache: "no-store",
      body: JSON.stringify(parsed.data),
      signal,
    },
  );

  return readCanonicalIntake(response);
}

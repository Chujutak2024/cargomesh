import type {
  CreateFreightRequestV2Input,
  ErrorEnvelopeV2,
  FreightRequestV2Response,
  IntakeOptionsResponse,
  RoadServiceabilityEvaluationV2Response,
} from "./contracts";
import { getIntakeOptionsFixture, parseIntakeOptionsResponse } from "./intake-options";

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export class V2IntakeApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly retryable: boolean;
  readonly details: unknown;

  constructor(options: { code: string; message: string; status: number; retryable?: boolean; details?: unknown }) {
    super(options.message);
    this.name = "V2IntakeApiError";
    this.code = options.code;
    this.status = options.status;
    this.retryable = options.retryable ?? options.status >= 500;
    this.details = options.details;
  }
}

export type IntakeOptionsLoadResult = {
  options: IntakeOptionsResponse;
  source: "api" | "fixture";
  fallbackReason: string | null;
};

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new V2IntakeApiError({
      code: "INVALID_JSON_RESPONSE",
      message: "The V2 API returned a non-JSON response.",
      status: response.status,
      retryable: response.status >= 500,
    });
  }
}

function isErrorEnvelope(value: unknown): value is ErrorEnvelopeV2 {
  if (typeof value !== "object" || value === null || !("error" in value)) return false;
  const error = (value as { error?: unknown }).error;
  return typeof error === "object"
    && error !== null
    && typeof (error as { code?: unknown }).code === "string"
    && typeof (error as { message?: unknown }).message === "string";
}

async function requireOk(response: Response) {
  let body: unknown;
  try {
    body = await readJson(response);
  } catch (error) {
    if (!response.ok) {
      throw new V2IntakeApiError({
        code: `HTTP_${response.status}`,
        message: `The V2 API request failed with HTTP ${response.status}.`,
        status: response.status,
      });
    }
    throw error;
  }
  if (response.ok) return body;
  if (isErrorEnvelope(body)) {
    throw new V2IntakeApiError({
      code: body.error.code,
      message: body.error.message,
      details: body.error.details,
      retryable: body.error.retryable,
      status: response.status,
    });
  }
  throw new V2IntakeApiError({
    code: `HTTP_${response.status}`,
    message: `The V2 API request failed with HTTP ${response.status}.`,
    status: response.status,
  });
}

function assertEnvelope<T extends { schemaVersion: "2.0"; data: unknown }>(
  value: unknown,
  endpoint: string,
): T {
  if (
    typeof value !== "object"
    || value === null
    || (value as { schemaVersion?: unknown }).schemaVersion !== "2.0"
    || typeof (value as { data?: unknown }).data !== "object"
    || (value as { data?: unknown }).data === null
  ) {
    throw new V2IntakeApiError({
      code: "CONTRACT_MISMATCH",
      message: `${endpoint} did not return the HAC-27 v2.0 envelope.`,
      status: 502,
      retryable: false,
    });
  }
  return value as T;
}

export async function loadIntakeOptions(fetcher: FetchLike = fetch): Promise<IntakeOptionsLoadResult> {
  try {
    const response = await fetcher("/api/v2/intake/options", {
      method: "GET",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    const body = await requireOk(response);
    const parsed = parseIntakeOptionsResponse(body);
    if (!parsed) {
      throw new V2IntakeApiError({
        code: "OPTIONS_CONTRACT_MISMATCH",
        message: "GET /api/v2/intake/options does not cover every HAC-14 selector.",
        status: 502,
        retryable: false,
      });
    }
    return { options: parsed, source: "api", fallbackReason: null };
  } catch (error) {
    const fallbackReason = error instanceof V2IntakeApiError
      ? error.code
      : "INTAKE_OPTIONS_UNAVAILABLE";
    return { options: getIntakeOptionsFixture(), source: "fixture", fallbackReason };
  }
}

export async function createFreightRequestV2(
  input: CreateFreightRequestV2Input,
  idempotencyKey: string,
  fetcher: FetchLike = fetch,
) {
  const response = await fetcher("/api/v2/freight/requests", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify(input),
  });
  return assertEnvelope<FreightRequestV2Response>(
    await requireOk(response),
    "POST /api/v2/freight/requests",
  );
}

export async function getFreightRequestV2(id: string, fetcher: FetchLike = fetch) {
  const response = await fetcher(`/api/v2/freight/requests/${encodeURIComponent(id)}`, {
    method: "GET",
    credentials: "same-origin",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  return assertEnvelope<FreightRequestV2Response>(
    await requireOk(response),
    "GET /api/v2/freight/requests/:id",
  );
}

export async function getRoadServiceabilityV2(
  id: string,
  expectedDraftVersion: number,
  fetcher: FetchLike = fetch,
) {
  const query = new URLSearchParams({ expectedDraftVersion: String(expectedDraftVersion) });
  const response = await fetcher(
    `/api/v2/freight/requests/${encodeURIComponent(id)}/serviceability?${query}`,
    {
      method: "GET",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
      cache: "no-store",
    },
  );
  return assertEnvelope<RoadServiceabilityEvaluationV2Response>(
    await requireOk(response),
    "GET /api/v2/freight/requests/:id/serviceability",
  );
}

import type {
  CreateFreightRequestV2Input,
  ErrorEnvelopeV2,
  FreightRequestV2Data,
  FreightRequestV2Response,
  RoadServiceabilityEvaluationV2Data,
  RoadServiceabilityEvaluationV2Response,
} from "./contracts";
import { getIntakeOptionsFixture, parseIntakeOptionsResponse } from "./intake-options";
import { FreightRequestV2ResponseSchema } from "@/shared/schemas/v2/freight-request";
import { RoadServiceabilityEvaluationV2ResponseSchema } from "@/shared/schemas/v2/serviceability";
import type { ZodType } from "zod";

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
  options: ReturnType<typeof getIntakeOptionsFixture>;
  source: "api" | "fixture";
  fixtureReason: "EXPLICIT_DEVELOPMENT_FIXTURE" | null;
};

export type IntakeOptionsSourceMode = "api" | "development-fixture";

export function assertFreightRequestRoundTrip(
  created: FreightRequestV2Data,
  loaded: FreightRequestV2Data,
) {
  if (
    loaded.id !== created.id
    || loaded.organizationId !== created.organizationId
    || loaded.draftVersion !== created.draftVersion
  ) {
    throw new V2IntakeApiError({
      code: "REQUEST_CORRELATION_MISMATCH",
      message: "GET returned a different request, organization, or draft version than POST.",
      status: 502,
      retryable: false,
    });
  }
}

export function assertServiceabilityCorrelation(
  request: FreightRequestV2Data,
  evaluation: RoadServiceabilityEvaluationV2Data,
) {
  if (
    evaluation.freightRequestId !== request.id
    || evaluation.evaluatedDraftVersion !== request.draftVersion
  ) {
    throw new V2IntakeApiError({
      code: "SERVICEABILITY_CORRELATION_MISMATCH",
      message: "Serviceability does not belong to the current request and draft version.",
      status: 502,
      retryable: false,
    });
  }
}

export function reconcileCandidateSelection(
  currentCandidateId: string | null,
  evaluation: RoadServiceabilityEvaluationV2Data,
) {
  if (currentCandidateId && evaluation.candidates.some((candidate) => candidate.candidateId === currentCandidateId)) {
    return currentCandidateId;
  }
  return evaluation.candidates.find((candidate) => candidate.status === "eligible")?.candidateId
    ?? evaluation.candidates[0]?.candidateId
    ?? null;
}

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

function parseContract<T extends { schemaVersion: "2.0"; data: unknown }>(
  value: unknown,
  endpoint: string,
  schema: ZodType<T>,
): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new V2IntakeApiError({
      code: "CONTRACT_MISMATCH",
      message: `${endpoint} did not return the published HAC-12 v2.0 contract.`,
      status: 502,
      retryable: false,
      details: parsed.error.flatten(),
    });
  }
  return parsed.data;
}

export function resolveIntakeOptionsSourceMode(): IntakeOptionsSourceMode {
  return process.env.NODE_ENV !== "production"
    && process.env.NEXT_PUBLIC_V2_INTAKE_OPTIONS_SOURCE === "fixture"
    ? "development-fixture"
    : "api";
}

export async function loadIntakeOptions(
  fetcher: FetchLike = fetch,
  sourceMode: IntakeOptionsSourceMode = resolveIntakeOptionsSourceMode(),
): Promise<IntakeOptionsLoadResult> {
  if (sourceMode === "development-fixture") {
    return {
      options: getIntakeOptionsFixture(),
      source: "fixture",
      fixtureReason: "EXPLICIT_DEVELOPMENT_FIXTURE",
    };
  }

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
    return { options: parsed, source: "api", fixtureReason: null };
  } catch (error) {
    if (error instanceof V2IntakeApiError) throw error;
    throw new V2IntakeApiError({
      code: "NETWORK_ERROR",
      message: error instanceof Error ? error.message : "GET /api/v2/intake/options could not be reached.",
      status: 0,
      retryable: true,
    });
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
  return parseContract<FreightRequestV2Response>(
    await requireOk(response),
    "POST /api/v2/freight/requests",
    FreightRequestV2ResponseSchema,
  );
}

export async function getFreightRequestV2(id: string, fetcher: FetchLike = fetch) {
  const response = await fetcher(`/api/v2/freight/requests/${encodeURIComponent(id)}`, {
    method: "GET",
    credentials: "same-origin",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  return parseContract<FreightRequestV2Response>(
    await requireOk(response),
    "GET /api/v2/freight/requests/:id",
    FreightRequestV2ResponseSchema,
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
  return parseContract<RoadServiceabilityEvaluationV2Response>(
    await requireOk(response),
    "GET /api/v2/freight/requests/:id/serviceability",
    RoadServiceabilityEvaluationV2ResponseSchema,
  );
}

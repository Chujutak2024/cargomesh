import {workspaceFetch} from "@/features/workspace-mode/workspace-fetch";
import { z } from "zod";
import { FreightRequestV2ResponseSchema, type CreateFreightRequestV2Input } from "@/shared/schemas/v2/freight-request";
import { WorkflowRecordV2Schema, WorkflowInputsV2 } from "@/shared/schemas/v2/workflow";
import { LocationCandidateV2Schema, LocationConfirmationInputV2Schema, LocationResolutionInputV2Schema,
  LocationResolutionV2Schema } from "@/shared/schemas/v2/location-resolution";

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

const WorkflowResponseSchema = z.object({
  schemaVersion: z.literal("2.0"),
  data: WorkflowRecordV2Schema,
  meta: z.object({ idempotentReplay: z.boolean(), environmentProfile: z.literal("v2-clean") }).strict(),
}).strict();

export class ShipperApiError extends Error {
  constructor(readonly code: string, message: string, readonly status: number, readonly retryable: boolean) {
    super(message);
    this.name = "ShipperApiError";
  }
}

async function requestJson(path: string, init: RequestInit, fetcher: FetchLike) {
  let response: Response;
  try {
    response = await fetcher(path, { ...init, credentials: "same-origin", headers: {
      Accept: "application/json", ...(init.body ? { "Content-Type": "application/json" } : {}), ...init.headers,
    } });
  } catch (error) {
    throw new ShipperApiError("NETWORK_ERROR", error instanceof Error ? error.message : "Network error.", 0, true);
  }
  const body = await response.json().catch(() => null) as { error?: { code?: string; message?: string; retryable?: boolean } } | null;
  if (!response.ok) throw new ShipperApiError(
    body?.error?.code ?? `HTTP_${response.status}`,
    body?.error?.message ?? `Request failed with HTTP ${response.status}.`,
    response.status,
    body?.error?.retryable ?? response.status >= 500,
  );
  return body;
}

function idempotencyHeaders() {
  return { "Idempotency-Key": crypto.randomUUID() };
}

export async function reviseFreightRequest(id: string, expectedDraftVersion: number, value: CreateFreightRequestV2Input,
  fetcher: FetchLike = workspaceFetch) {
  const body = await requestJson(`/api/v2/freight/requests/${encodeURIComponent(id)}/revisions`, {
    method: "POST", headers: idempotencyHeaders(), body: JSON.stringify({ expectedDraftVersion, value }),
  }, fetcher);
  return FreightRequestV2ResponseSchema.parse(body).data;
}

export async function submitFreightRequest(id: string, expectedDraftVersion: number, fetcher: FetchLike = workspaceFetch) {
  const body = await requestJson(`/api/v2/freight/requests/${encodeURIComponent(id)}/submissions`, {
    method: "POST", headers: idempotencyHeaders(), body: JSON.stringify({ expectedDraftVersion }),
  }, fetcher);
  return FreightRequestV2ResponseSchema.parse(body).data;
}

export async function selectCommercialOption(input: {
  requestId: string;
  planId: string;
  offerIds: string[];
  consideredOfferIds: string[];
  policyId: string | null;
  rationale: string;
}, fetcher: FetchLike = workspaceFetch) {
  const now = new Date().toISOString();
  const body = await requestJson(`/api/v2/freight/requests/${encodeURIComponent(input.requestId)}/decisions`, {
    method: "POST", headers: idempotencyHeaders(), body: JSON.stringify({
      schemaVersion: "2.0", planId: input.planId, selectedOfferIds: input.offerIds,
      consideredOfferIds: input.consideredOfferIds, policyId: input.policyId, rationale: input.rationale,
      evidence: [{ reference: "SHIPPER_WEB_EXPLICIT_SELECTION", provider: "CargoMesh Web", observedAt: now,
        validUntil: null, provenanceStatus: "VERIFIED" }],
    }),
  }, fetcher);
  return WorkflowResponseSchema.parse(body).data;
}

export async function authorizeBooking(input: { decisionId: string; offerId: string; idempotencyKey?: string }, fetcher: FetchLike = workspaceFetch) {
  const now = new Date().toISOString();
  const body = await requestJson("/api/v2/bookings", {
    method: "POST", headers: { "Idempotency-Key": input.idempotencyKey ?? crypto.randomUUID() }, body: JSON.stringify({
      schemaVersion: "2.0", decisionId: input.decisionId, offerId: input.offerId, authorization: "AUTHORIZE",
      evidence: { reference: "SHIPPER_WEB_EXPLICIT_BOOKING_CONSENT", provider: "CargoMesh Web", observedAt: now,
        validUntil: null, provenanceStatus: "VERIFIED" },
    }),
  }, fetcher);
  return WorkflowResponseSchema.parse(body).data;
}

export async function requestCarrierOffer(requestId: string, value: z.infer<(typeof WorkflowInputsV2)["opportunities.create"]>,
  idempotencyKey: string, fetcher: FetchLike = workspaceFetch) {
  const input = WorkflowInputsV2["opportunities.create"].parse(value);
  const body = await requestJson(`/api/v2/freight/requests/${encodeURIComponent(z.string().uuid().parse(requestId))}/opportunities`, {
    method: "POST", headers: { "Idempotency-Key": z.string().uuid().parse(idempotencyKey) }, body: JSON.stringify(input),
  }, fetcher);
  const record = WorkflowResponseSchema.parse(body).data;
  if (record.kind !== "opportunities" || record.requestId !== requestId || record.carrierId !== input.carrierId
    || record.data.carrierId !== input.carrierId || record.data.responseChannel !== input.responseChannel
    || Date.parse(record.data.responseDeadline) !== Date.parse(input.responseDeadline)
    || record.data.planId !== input.planId || record.data.assignmentIds.length !== input.assignmentIds.length
    || record.data.assignmentIds.some(id => !input.assignmentIds.includes(id))) {
    throw new ShipperApiError("INVALID_SCOPE", "Opportunity response does not match the requested context.", 502, false);
  }
  return record;
}

export async function resolveLocation(query: z.infer<typeof LocationResolutionInputV2Schema>["query"], fetcher: FetchLike = workspaceFetch) {
  const body = await requestJson("/api/v2/locations/resolutions", {
    method: "POST", body: JSON.stringify(LocationResolutionInputV2Schema.parse({ query })),
  }, fetcher);
  return z.object({ schemaVersion: z.literal("2.0"), data: LocationResolutionV2Schema }).strict().parse(body).data;
}

export async function confirmLocation(input: z.infer<typeof LocationConfirmationInputV2Schema>, fetcher: FetchLike = workspaceFetch) {
  const body = await requestJson("/api/v2/locations/confirmations", {
    method: "POST", body: JSON.stringify(LocationConfirmationInputV2Schema.parse(input)),
  }, fetcher);
  return z.object({ schemaVersion: z.literal("2.0"), data: LocationCandidateV2Schema.extend({
    confirmed: z.literal(true), confirmedByMemberId: z.string().uuid(), organizationId: z.string().uuid(),
  }).strict() }).strict().parse(body).data;
}

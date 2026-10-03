import { createHash } from "node:crypto";
import { z } from "zod";
import {
  CreateFreightRequestV2InputSchema,
  FreightRequestV2ResponseSchema,
  type CreateFreightRequestV2Input,
  type FreightRequestV2Response,
} from "@/shared/schemas/v2/freight-request";

export type V2Actor = { memberId: string; organizationId: string };
export type PersistedV2Draft = { data: FreightRequestV2Response["data"]; payloadHash: string };
export type DraftInsert = {
  actor: V2Actor; idempotencyKey: string; payloadHash: string;
  input: CreateFreightRequestV2Input;
};

/** The adapter must revalidate tenant/facility/category within one SQL mutation boundary. */
export interface V2DraftRepository {
  findCreation(actor: V2Actor, key: string): Promise<PersistedV2Draft | null>;
  insertAtomically(request: DraftInsert): Promise<{ record: PersistedV2Draft; replay: boolean }>;
  findById(actor: V2Actor, id: string): Promise<PersistedV2Draft | null>;
}

export class V2DraftError extends Error {
  constructor(public readonly code: string, message: string, public readonly httpStatus: number) {
    super(message);
  }
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value).filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function hashV2Draft(input: CreateFreightRequestV2Input): string {
  return createHash("sha256").update(canonicalJson(input)).digest("hex");
}

function response(record: PersistedV2Draft, replay: boolean): FreightRequestV2Response {
  return FreightRequestV2ResponseSchema.parse({
    schemaVersion: "2.0", data: record.data,
    meta: { idempotentReplay: replay, environmentProfile: "v2-clean" },
  });
}

export async function createV2Draft(
  rawInput: unknown, rawKey: string | null, actor: V2Actor, repository: V2DraftRepository,
): Promise<FreightRequestV2Response> {
  const input = CreateFreightRequestV2InputSchema.parse(rawInput);
  const key = z.string().uuid().safeParse(rawKey);
  if (!key.success) throw new V2DraftError("VALIDATION_ERROR", "Idempotency-Key must be a UUID.", 400);
  if (!actor.memberId || !actor.organizationId) {
    throw new V2DraftError("UNAUTHORIZED", "An active member is required.", 401);
  }
  if (input.organizationId && input.organizationId !== actor.organizationId) {
    throw new V2DraftError("FORBIDDEN_TENANT", "Organization assertion does not match the session.", 403);
  }
  const payloadHash = hashV2Draft(input);
  const existing = await repository.findCreation(actor, key.data);
  if (existing) {
    if (existing.payloadHash !== payloadHash) {
      throw new V2DraftError("IDEMPOTENCY_CONFLICT", "Idempotency-Key was used with a different payload.", 409);
    }
    return response(existing, true);
  }
  // The SQL RPC resolves tenant-owned facilities and categories in the same
  // transaction as the write. An RLS-filtered preflight cannot distinguish a
  // foreign facility from a missing one and would mask the contractual 403.
  const saved = await repository.insertAtomically({
    actor, idempotencyKey: key.data, payloadHash, input,
  });
  if (saved.record.payloadHash !== payloadHash) {
    throw new V2DraftError("IDEMPOTENCY_CONFLICT", "Idempotency-Key was used with a different payload.", 409);
  }
  return response(saved.record, saved.replay);
}

export async function getV2Draft(
  id: string, actor: V2Actor, repository: V2DraftRepository,
): Promise<FreightRequestV2Response> {
  if (!z.string().uuid().safeParse(id).success) {
    throw new V2DraftError("VALIDATION_ERROR", "Request id must be a UUID.", 400);
  }
  const record = await repository.findById(actor, id);
  if (!record || record.data.organizationId !== actor.organizationId) {
    throw new V2DraftError("REQUEST_NOT_FOUND", "Request not found.", 404);
  }
  return response(record, false);
}

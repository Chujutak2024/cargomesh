import { z } from "zod";
import type { Database, Json } from "@/types/database-v2.types";
import { createV2ServerSupabaseClient } from "@/server/db/supabase/v2";
import { FreightRequestV2ResponseSchema } from "@/shared/schemas/v2/freight-request";
import {
  V2DraftError, type DraftInsert, type PersistedV2Draft,
  type V2Actor, type V2DraftRepository,
} from "../application/draft-service";

type Client = Awaited<ReturnType<typeof createV2ServerSupabaseClient>>;
type RequestRow = Database["public"]["Tables"]["freight_requests"]["Row"];
type DraftRow = Pick<RequestRow,
  "id" | "code" | "organization_id" | "status" | "draft_version" |
  "v2_snapshot" | "creation_payload_hash" | "created_at" | "updated_at">;

const SELECT_DRAFT = "id,code,organization_id,status,draft_version,v2_snapshot,creation_payload_hash,created_at,updated_at";

const RpcResultSchema = z.object({
  id: z.string().uuid(),
  referenceCode: z.string().min(1),
  organizationId: z.string().uuid(),
  status: z.literal("DRAFT"),
  draftVersion: z.number().int().positive(),
  snapshot: z.custom<Json>((value) => z.record(z.unknown()).safeParse(value).success),
  createdAt: z.string(),
  updatedAt: z.string(),
  payloadHash: z.string().regex(/^[0-9a-f]{64}$/),
  idempotentReplay: z.boolean(),
});

function asRecord(row: DraftRow): PersistedV2Draft {
  if (row.status !== "DRAFT" || !row.v2_snapshot || !row.creation_payload_hash) {
    throw new Error("V2_DRAFT_CORRUPT");
  }
  const snapshot = z.record(z.unknown()).parse(row.v2_snapshot);
  const parsed = FreightRequestV2ResponseSchema.parse({
    schemaVersion: "2.0",
    data: {
      id: row.id, referenceCode: row.code,
      organizationId: row.organization_id,
      status: row.status, draftVersion: row.draft_version,
      origin: snapshot.origin, destination: snapshot.destination,
      pickupWindow: snapshot.pickupWindow, deliveryWindow: snapshot.deliveryWindow,
      acceptedModes: snapshot.acceptedModes,
      requiredEquipment: snapshot.requiredEquipment ?? null,
      cargoSpecification: snapshot.cargoSpecification,
      contacts: snapshot.contacts, budget: snapshot.budget ?? null,
      createdAt: row.created_at, updatedAt: row.updated_at,
    },
    meta: { idempotentReplay: false, environmentProfile: "v2-clean" },
  });
  return { data: parsed.data, payloadHash: row.creation_payload_hash };
}

function throwDbError(error: { code?: string; message: string }): never {
  if (error.code === "PT403") throw new V2DraftError("FORBIDDEN_TENANT", error.message, 403);
  if (error.code === "PT409") throw new V2DraftError("IDEMPOTENCY_CONFLICT", error.message, 409);
  if (error.code === "PT400" || error.code === "22P02" || error.code === "23514") {
    throw new V2DraftError("VALIDATION_ERROR", error.message, 400);
  }
  throw new Error(`V2_DATABASE_ERROR: ${error.code ?? "unknown"}: ${error.message}`);
}

/** The RPC is the final authorization and atomicity boundary, not these preflight reads. */
export class SupabaseV2DraftRepository implements V2DraftRepository {
  constructor(private readonly db: Client) {}

  async findCreation(actor: V2Actor, key: string): Promise<PersistedV2Draft | null> {
    const { data, error } = await this.db.from("freight_requests")
      .select(SELECT_DRAFT)
      .eq("organization_id", actor.organizationId)
      .eq("requested_by_member_id", actor.memberId)
      .eq("creation_idempotency_key", key)
      .eq("v2_contract_version", "2.0")
      .maybeSingle();
    if (error) throwDbError(error);
    return data ? asRecord(data) : null;
  }

  async insertAtomically(request: DraftInsert) {
    const { data, error } = await this.db.rpc("create_v2_freight_request", {
      p_organization_id: request.actor.organizationId,
      p_member_id: request.actor.memberId,
      p_idempotency_key: request.idempotencyKey,
      p_payload_hash: request.payloadHash,
      p_payload: request.input,
    });
    if (error) throwDbError(error);
    const result = RpcResultSchema.parse(data);
    const record = asRecord({
      id: result.id, code: result.referenceCode,
      organization_id: result.organizationId, status: result.status,
      draft_version: result.draftVersion, v2_snapshot: result.snapshot,
      creation_payload_hash: result.payloadHash,
      created_at: result.createdAt, updated_at: result.updatedAt,
    });
    return { record, replay: result.idempotentReplay };
  }

  async findById(actor: V2Actor, id: string): Promise<PersistedV2Draft | null> {
    const { data, error } = await this.db.from("freight_requests")
      .select(SELECT_DRAFT)
      .eq("organization_id", actor.organizationId)
      .eq("id", id)
      .eq("v2_contract_version", "2.0")
      .maybeSingle();
    if (error) throwDbError(error);
    return data ? asRecord(data) : null;
  }
}

export async function v2DraftRepository() {
  return new SupabaseV2DraftRepository(await createV2ServerSupabaseClient());
}

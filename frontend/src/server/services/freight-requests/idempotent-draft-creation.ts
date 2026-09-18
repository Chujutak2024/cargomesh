import { createHash } from "node:crypto";
import { CreateFreightRequestInputSchema, type CreatedFreightRequest } from "@/shared/schemas/freight-creation";
import { createFreightRequestDraftWithDependencies, type DraftCreationDependencies } from "./draft-creation-policy";
import { RecommendationDraftError } from "@/features/recommendations/recommendation-draft-contracts";

export type CreationRecord = { id: string; code: string; creation_payload_hash: string };
export type IdempotentDraftDependencies = DraftCreationDependencies & {
  findCreation: (organizationId: string, memberId: string, key: string) => Promise<CreationRecord | null>;
};

/** The database unique index arbitrates races; there is no process-local lock. */
export async function createIdempotentFreightRequestDraft(
  raw: unknown, deps: IdempotentDraftDependencies, now = new Date(),
): Promise<CreatedFreightRequest> {
  const parsed = CreateFreightRequestInputSchema.safeParse(raw);
  if (!parsed.success) throw new RecommendationDraftError("INVALID_INPUT", "Invalid creation input.", 422);
  const { fields, idempotencyKey } = parsed.data;
  const member = await deps.resolveMember({ requiredRole: "SUPERVISOR" });
  if (member.status !== "ACTIVE" || !["OWNER", "SUPERVISOR"].includes(member.role)) {
    throw new RecommendationDraftError("FORBIDDEN", "An active manager is required.", 403);
  }
  // Zod returns fields in schema order. Hash the accepted input, independent
  // of JSON key order and of changing template timestamps/category IDs.
  const hash = createHash("sha256").update(JSON.stringify(fields)).digest("hex");
  const find = () => deps.findCreation(member.organizationId, member.memberId, idempotencyKey);
  const check = (record: CreationRecord) => {
    if (record.creation_payload_hash !== hash) {
      throw new RecommendationDraftError("IDEMPOTENCY_CONFLICT", "Key already used with different input.", 409);
    }
    return record;
  };
  let replayed = false;
  const existing = await find();
  let intake;
  if (existing) {
    replayed = true;
    intake = await deps.loadIntake(check(existing).code);
  } else {
    intake = await createFreightRequestDraftWithDependencies({ fields }, {
      ...deps,
      resolveMember: async () => member,
      insertFreightRequest: async (row) => {
        try {
          return await deps.insertFreightRequest({ ...row, creation_idempotency_key: idempotencyKey, creation_payload_hash: hash });
        } catch (error) {
          // Also recovers an INSERT committed before a lost network response.
          // Never mistake a code collision or another database failure for success.
          const winner = await find();
          if (!winner) throw error;
          check(winner);
          replayed = true;
          return { id: winner.id, code: winner.code };
        }
      },
    }, now);
  }
  return {
    freightRequestId: intake.freightRequestId, requestCode: intake.requestCode,
    status: intake.status, draftVersion: intake.draftVersion, replayed,
  };
}

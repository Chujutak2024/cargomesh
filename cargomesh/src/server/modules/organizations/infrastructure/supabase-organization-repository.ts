import { z } from "zod";
import { createV2ServerSupabaseClient } from "@/server/db/supabase/v2";
import { OrganizationRecordV2Schema } from "@/shared/schemas/v2/organization";
import type { OrganizationRepositoryV2 } from "../application/organization-service";
import { V2DraftError } from "../../freight-requests/application/draft-service";

const Row = z.object({ id: z.string(), code: z.string(), name: z.string(), legal_name: z.string().nullable(),
  business_identifier_type: z.string().nullable(), business_identifier_value: z.string().nullable(),
  country_code: z.string().nullable(), corporate_email: z.string().nullable(), corporate_phone: z.string().nullable(),
  default_currency: z.string(), status: z.string(), version: z.number(), created_at: z.string(), updated_at: z.string() });
function record(raw: unknown) {
  const row = Row.parse(raw);
  return OrganizationRecordV2Schema.parse({ id: row.id, version: row.version,
    createdAt: row.created_at, updatedAt: row.updated_at,
    value: { schemaVersion: "2.0", code: row.code, commercialName: row.name, legalName: row.legal_name,
      taxIdType: row.business_identifier_type, taxIdValue: row.business_identifier_value,
      countryCode: row.country_code, corporateEmail: row.corporate_email, corporatePhone: row.corporate_phone,
      defaultCurrency: row.default_currency, status: row.status } });
}
function dbError(error: { code?: string; message: string }): never {
  const codes: Record<string, [number, string]> = {
    PT400: [400, "VALIDATION_ERROR"], PT403: [403, "FORBIDDEN_TENANT"],
    PT404: [404, "ORGANIZATION_NOT_FOUND"], PT409: [409, "STALE_DRAFT"],
    "23505": [409, "ORGANIZATION_IDENTIFIER_CONFLICT"], "23514": [400, "VALIDATION_ERROR"],
  };
  if (error.code === "PT409" && error.message === "IDEMPOTENCY_CONFLICT") {
    throw new V2DraftError("IDEMPOTENCY_CONFLICT", "Key already used for another command.", 409);
  }
  const mapped = codes[error.code ?? ""];
  if (mapped) throw new V2DraftError(mapped[1], mapped[1], mapped[0]);
  throw new Error("V2_ORGANIZATION_DATABASE_ERROR");
}
export async function organizationRepositoryV2(): Promise<OrganizationRepositoryV2> {
  const db = await createV2ServerSupabaseClient();
  return {
    async get(actor) {
      const { data, error } = await db.from("organizations").select("*").eq("id", actor.organizationId).maybeSingle();
      if (error) dbError(error);
      return data ? record(data) : null;
    },
    async revise(actor, input) {
      const { data, error } = await db.rpc("command_v2_organization", {
        p_organization_id: actor.organizationId, p_member_id: actor.memberId,
        p_idempotency_key: input.key, p_expected_version: input.expectedVersion, p_value: input.value,
      });
      if (error) dbError(error);
      const result = z.object({ row: Row, replay: z.boolean() }).parse(data);
      return { record: record(result.row), replay: result.replay };
    },
  };
}

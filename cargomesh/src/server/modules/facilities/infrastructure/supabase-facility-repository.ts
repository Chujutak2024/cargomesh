import { z } from "zod";
import { createV2ServerSupabaseClient } from "@/server/db/supabase/v2";
import { FacilityV2Schema, type FacilityV2 } from "@/shared/schemas/v2/facilities";
import type { FacilityRepositoryV2 } from "../application/facility-service";
import { V2DraftError, type V2Actor } from "../../freight-requests/application/draft-service";

const Row = z.object({
  id: z.string(), organization_id: z.string(), code: z.string(), name: z.string(),
  facility_type: z.string(), country_code: z.string(), region_code: z.string().nullable(),
  city: z.string(), address_line: z.string(), latitude: z.number().nullable(), longitude: z.number().nullable(),
  active: z.boolean(), access_restrictions: z.unknown(), operating_hours: z.unknown(),
  version: z.number(), created_at: z.string(), updated_at: z.string(),
});
function record(raw: unknown): FacilityV2 {
  const row = Row.parse(raw);
  return FacilityV2Schema.parse({
    id: row.id, organizationId: row.organization_id, version: row.version,
    createdAt: row.created_at, updatedAt: row.updated_at,
    value: { schemaVersion: "2.0", code: row.code, name: row.name,
      facilityType: row.facility_type, active: row.active,
      location: { label: row.address_line, countryCode: row.country_code,
        region: row.region_code, city: row.city, lat: row.latitude, lng: row.longitude },
      accessRestrictions: row.access_restrictions, operatingHours: row.operating_hours },
  });
}
function dbError(error: { code?: string; message: string }): never {
  const mappings: Record<string, [number, string]> = {
    PT400: [400, "VALIDATION_ERROR"], PT403: [403, "FORBIDDEN_TENANT"],
    PT404: [404, "FACILITY_NOT_FOUND"], PT409: [409, "STALE_DRAFT"],
    "23505": [409, "FACILITY_CODE_CONFLICT"], "23514": [400, "VALIDATION_ERROR"],
    "22P02": [400, "VALIDATION_ERROR"],
  };
  if (error.code === "PT409" && error.message === "IDEMPOTENCY_CONFLICT") {
    throw new V2DraftError("IDEMPOTENCY_CONFLICT", "Key already used for a different command.", 409);
  }
  const mapped = mappings[error.code ?? ""];
  if (mapped) throw new V2DraftError(mapped[1], mapped[1], mapped[0]);
  throw new Error("V2_FACILITY_DATABASE_ERROR");
}
export async function facilityRepositoryV2(): Promise<FacilityRepositoryV2> {
  const db = await createV2ServerSupabaseClient();
  return {
    async list(actor, page) {
      const { data, error } = await db.from("facilities").select("*")
        .eq("organization_id", actor.organizationId).order("created_at").order("id")
        .range(page.offset, page.offset + page.limit - 1);
      if (error) dbError(error);
      return (data ?? []).map(record);
    },
    async get(actor, id) {
      const { data, error } = await db.from("facilities").select("*")
        .eq("organization_id", actor.organizationId).eq("id", id).maybeSingle();
      if (error) dbError(error);
      return data ? record(data) : null;
    },
    async command(actor: V2Actor, input) {
      const { data, error } = await db.rpc("command_v2_facility", {
        p_organization_id: actor.organizationId, p_member_id: actor.memberId,
        p_idempotency_key: input.key, p_facility_id: input.id,
        p_expected_version: input.expectedVersion, p_value: input.value,
      });
      if (error) dbError(error);
      const result = z.object({ row: Row, replay: z.boolean() }).parse(data);
      return { record: record(result.row), replay: result.replay };
    },
  };
}

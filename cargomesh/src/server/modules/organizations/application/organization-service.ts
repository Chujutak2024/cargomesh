import { z } from "zod";
import { OrganizationRecordV2Schema, OrganizationRevisionV2Schema,
  type OrganizationV2, type OrganizationValueV2 } from "@/shared/schemas/v2/organization";
import { V2DraftError, type V2Actor } from "../../freight-requests/application/draft-service";

export interface OrganizationRepositoryV2 {
  get(actor: V2Actor): Promise<OrganizationV2 | null>;
  revise(actor: V2Actor, input: { key: string; expectedVersion: number; value: OrganizationValueV2 }):
    Promise<{ record: OrganizationV2; replay: boolean }>;
}
export class OrganizationServiceV2 {
  constructor(private readonly repository: OrganizationRepositoryV2) {}
  async get(actor: V2Actor) {
    const record = await this.repository.get(actor);
    if (!record) throw new V2DraftError("ORGANIZATION_NOT_FOUND", "Organization not found.", 404);
    return this.response(actor, record, false);
  }
  async revise(actor: V2Actor, raw: unknown, key: string | undefined) {
    const input = OrganizationRevisionV2Schema.parse(raw);
    const result = await this.repository.revise(actor, { ...input, key: z.string().uuid().parse(key) });
    return this.response(actor, result.record, result.replay);
  }
  private response(actor: V2Actor, record: OrganizationV2, replay: boolean) {
    const parsed = OrganizationRecordV2Schema.parse(record);
    if (parsed.id !== actor.organizationId) throw new Error("V2_ORGANIZATION_TENANT_MISMATCH");
    return { schemaVersion: "2.0" as const, data: parsed,
      meta: { idempotentReplay: replay, environmentProfile: "v2-clean" as const } };
  }
}

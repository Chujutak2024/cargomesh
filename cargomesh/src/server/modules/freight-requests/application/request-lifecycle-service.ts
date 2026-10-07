import { z } from "zod";
import { CreateFreightRequestV2InputSchema, FreightRequestV2ResponseSchema,
  type CreateFreightRequestV2Input } from "@/shared/schemas/v2/freight-request";
import { PageV2Schema } from "@/shared/schemas/v2/facilities";
import { V2DraftError, type V2Actor, type PersistedV2Draft } from "./draft-service";

export const ReviseRequestV2Schema = z.object({
  expectedDraftVersion: z.number().int().positive(), value: CreateFreightRequestV2InputSchema,
}).strict();
export const SubmitRequestV2Schema = z.object({ expectedDraftVersion: z.number().int().positive() }).strict();
export interface RequestLifecycleRepositoryV2 {
  list(actor: V2Actor, page: { limit: number; offset: number }): Promise<PersistedV2Draft[]>;
  command(actor: V2Actor, request: { id: string; key: string; expectedVersion: number;
    action: "REVISE" | "SUBMIT"; value: CreateFreightRequestV2Input | null }):
    Promise<{ record: PersistedV2Draft; replay: boolean }>;
}
export class RequestLifecycleServiceV2 {
  constructor(private readonly repository: RequestLifecycleRepositoryV2) {}
  async list(actor: V2Actor, page: unknown) {
    const parsed = PageV2Schema.parse(page);
    const records = await this.repository.list(actor, parsed);
    const data = records.map((record) => {
      if (record.data.organizationId !== actor.organizationId) {
        throw new V2DraftError("FORBIDDEN_TENANT", "Unexpected tenant in repository result.", 403);
      }
      return FreightRequestV2ResponseSchema.shape.data.parse(record.data);
    });
    return { schemaVersion: "2.0" as const, data,
      meta: { ...parsed, nextOffset: data.length === parsed.limit ? parsed.offset + parsed.limit : null } };
  }
  async revise(actor: V2Actor, id: string, raw: unknown, key: string | undefined) {
    const input = ReviseRequestV2Schema.parse(raw);
    if (input.value.organizationId && input.value.organizationId !== actor.organizationId) {
      throw new V2DraftError("FORBIDDEN_TENANT", "Organization assertion does not match the session.", 403);
    }
    return this.command(actor, id, key, input.expectedDraftVersion, "REVISE", input.value);
  }
  async submit(actor: V2Actor, id: string, raw: unknown, key: string | undefined) {
    const input = SubmitRequestV2Schema.parse(raw);
    return this.command(actor, id, key, input.expectedDraftVersion, "SUBMIT", null);
  }
  private async command(actor: V2Actor, id: string, key: string | undefined, expectedVersion: number,
    action: "REVISE" | "SUBMIT", value: CreateFreightRequestV2Input | null) {
    const result = await this.repository.command(actor, { id: z.string().uuid().parse(id),
      key: z.string().uuid().parse(key), expectedVersion, action, value });
    if (result.record.data.organizationId !== actor.organizationId) {
      throw new V2DraftError("FORBIDDEN_TENANT", "Unexpected tenant in repository result.", 403);
    }
    return FreightRequestV2ResponseSchema.parse({ schemaVersion: "2.0", data: result.record.data,
      meta: { idempotentReplay: result.replay, environmentProfile: "v2-clean" } });
  }
}

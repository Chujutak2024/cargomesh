import { z } from "zod";
import { FacilityInputV2Schema, FacilityRevisionV2Schema, FacilityResponseV2Schema,
  PageV2Schema, type FacilityInputV2, type FacilityV2 } from "@/shared/schemas/v2/facilities";
import { V2DraftError, type V2Actor } from "../../freight-requests/application/draft-service";

export interface FacilityRepositoryV2 {
  list(actor: V2Actor, page: { limit: number; offset: number }): Promise<FacilityV2[]>;
  get(actor: V2Actor, id: string): Promise<FacilityV2 | null>;
  command(actor: V2Actor, input: { id: string | null; key: string;
    expectedVersion: number | null; value: FacilityInputV2 }): Promise<{ record: FacilityV2; replay: boolean }>;
}
const Uuid = z.string().uuid();
export class FacilityServiceV2 {
  constructor(private readonly repository: FacilityRepositoryV2) {}
  async list(actor: V2Actor, page: unknown) {
    const parsed = PageV2Schema.parse(page);
    const items = await this.repository.list(actor, parsed);
    return { schemaVersion: "2.0" as const, data: items,
      meta: { ...parsed, nextOffset: items.length === parsed.limit ? parsed.offset + parsed.limit : null } };
  }
  async get(actor: V2Actor, id: string) {
    const record = await this.repository.get(actor, Uuid.parse(id));
    if (!record) throw new V2DraftError("FACILITY_NOT_FOUND", "Facility not found.", 404);
    return this.response(record, false);
  }
  async create(actor: V2Actor, body: unknown, key: string | undefined) {
    const value = FacilityInputV2Schema.parse(body);
    const saved = await this.repository.command(actor, {
      id: null, key: Uuid.parse(key), expectedVersion: null, value,
    });
    return this.response(saved.record, saved.replay);
  }
  async revise(actor: V2Actor, id: string, body: unknown, key: string | undefined) {
    const input = FacilityRevisionV2Schema.parse(body);
    const saved = await this.repository.command(actor, {
      id: Uuid.parse(id), key: Uuid.parse(key), expectedVersion: input.expectedVersion, value: input.value,
    });
    return this.response(saved.record, saved.replay);
  }
  private response(record: FacilityV2, replay: boolean) {
    return FacilityResponseV2Schema.parse({ schemaVersion: "2.0", data: record,
      meta: { idempotentReplay: replay, environmentProfile: "v2-clean" } });
  }
}

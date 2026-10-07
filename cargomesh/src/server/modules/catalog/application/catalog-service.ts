import { z } from "zod";
import { CatalogInputsV2, CatalogScopeV2Schema, parseCatalogRecordV2,
  type CatalogKindV2, type CatalogRecordV2, type CatalogScopeV2, type CatalogValueV2 } from "@/shared/schemas/v2/catalog";
import { PageV2Schema } from "@/shared/schemas/v2/facilities";
import { V2DraftError, type V2Actor } from "../../freight-requests/application/draft-service";

export interface CatalogRepositoryV2 {
  read(actor: V2Actor, kind: CatalogKindV2, scope: CatalogScopeV2,
    page: { limit: number; offset: number }, id: string | null): Promise<unknown[]>;
  command(actor: V2Actor, kind: CatalogKindV2, scope: CatalogScopeV2,
    input: { id: string | null; key: string; expectedVersion: number | null; value: CatalogValueV2 }):
    Promise<{ record: unknown; replay: boolean }>;
}
export class CatalogServiceV2 {
  constructor(private readonly repository: CatalogRepositoryV2) {}
  private record(actor: V2Actor, kind: CatalogKindV2, scope: CatalogScopeV2, raw: unknown) {
    let record: CatalogRecordV2;
    try {
      record = parseCatalogRecordV2(kind, raw);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new V2DraftError("CATALOG_DATA_INCOMPLETE", "Persisted catalog data does not satisfy the current contract. Revise the entry before using it.", 409);
      }
      throw error;
    }
    if (((kind === "preferences" || kind === "cargo-profiles") && record.organizationId !== actor.organizationId)
      || (scope.carrierId !== null && record.carrierId !== scope.carrierId)
      || (scope.serviceId !== null && record.serviceId !== scope.serviceId)) {
      throw new V2DraftError("FORBIDDEN_CATALOG", "Catalog scope mismatch.", 403);
    }
    return record;
  }
  async list(actor: V2Actor, kind: CatalogKindV2, scope: CatalogScopeV2, page: unknown) {
    const parsed = PageV2Schema.parse(page);
    const rows = await this.repository.read(actor, kind, CatalogScopeV2Schema.parse(scope), parsed, null);
    const data = rows.map(row => this.record(actor, kind, scope, row));
    return { schemaVersion: "2.0" as const, data,
      meta: { ...parsed, nextOffset: data.length === parsed.limit ? parsed.offset + parsed.limit : null } };
  }
  async get(actor: V2Actor, kind: CatalogKindV2, scope: CatalogScopeV2, id: string) {
    const rows = await this.repository.read(actor, kind, CatalogScopeV2Schema.parse(scope),
      { limit: 1, offset: 0 }, z.string().uuid().parse(id));
    if (!rows.length) throw new V2DraftError("CATALOG_NOT_FOUND", "Catalog entry not found.", 404);
    return this.response(this.record(actor, kind, scope, rows[0]), false);
  }
  async command(actor: V2Actor, kind: CatalogKindV2, scope: CatalogScopeV2,
    id: string | null, body: unknown, key: string | undefined) {
    let version: number | null = null;
    let raw = body;
    if (id !== null) {
      const revision = z.object({ expectedVersion: z.number().int().positive(), value: z.unknown() }).strict().parse(body);
      version = revision.expectedVersion;
      raw = revision.value;
    }
    const saved = await this.repository.command(actor, kind, CatalogScopeV2Schema.parse(scope), {
      id: id === null ? null : z.string().uuid().parse(id),
      key: z.string().uuid().parse(key), expectedVersion: version,
      value: CatalogInputsV2[kind].parse(raw),
    });
    return this.response(this.record(actor, kind, scope, saved.record), saved.replay);
  }
  private response(data: CatalogRecordV2, replay: boolean) {
    return { schemaVersion: "2.0" as const, data,
      meta: { idempotentReplay: replay, environmentProfile: "v2-clean" as const } };
  }
}

import { z } from "zod";
import { PageV2Schema } from "@/shared/schemas/v2/facilities";
import { IdentityRecordV2Schema, McpConsentV2Schema, IdentityRevokeV2Schema,
  IntegrationConfigurationV2Schema, IntegrationDiagnosticV2Schema, MemberInvitationV2Schema, OperatorInvitationV2Schema,
  MemberRevisionV2Schema, OperatorRevisionV2Schema, IdentityAcceptanceV2Schema, type IdentityKindV2 } from "@/shared/schemas/v2/identity";
import type { Json } from "@/types/database-v2.types";
import { V2DraftError } from "../../freight-requests/application/draft-service";

export type IdentityScopeV2 = { organizationId: string | null; carrierId: string | null };
export interface IdentityRepositoryV2 {
  read(kind: IdentityKindV2, scope: IdentityScopeV2, page: { limit: number; offset: number }): Promise<unknown[]>;
  link(action: "consent" | "revoke", organizationId: string | null, id: string | null,
    key: string, value: z.infer<typeof McpConsentV2Schema> | z.infer<typeof IdentityRevokeV2Schema>): Promise<{ record: unknown; replay: boolean }>;
  configure(carrierId: string, key: string, value: z.infer<typeof IntegrationConfigurationV2Schema>): Promise<{ record: unknown; replay: boolean }>;
  diagnose(carrierId: string, id: string): Promise<unknown>;
  directory(kind: "members" | "operators", action: "invite" | "revise" | "accept", scope: IdentityScopeV2,
    id: string | null, key: string, value: Json): Promise<{ record: unknown; replay: boolean }>;
}
export class IdentityServiceV2 {
  constructor(private readonly repository: IdentityRepositoryV2) {}
  async read(kind: IdentityKindV2, scope: IdentityScopeV2, query: unknown) {
    const page = PageV2Schema.parse(query);
    const rows = await this.repository.read(kind, scope, page);
    const data = rows.map(row => {
      const record = IdentityRecordV2Schema.parse(row);
      if (record.kind !== kind || record.kind === "members" && record.value.organizationId !== scope.organizationId
        || (record.kind === "operators" || record.kind === "integrations") && record.value.carrierId !== scope.carrierId) {
        throw new V2DraftError("FORBIDDEN_IDENTITY", "Identity scope mismatch.", 403);
      }
      return record.value;
    });
    return { schemaVersion: "2.0" as const, data,
      meta: { ...page, nextOffset: data.length === page.limit ? page.offset + page.limit : null } };
  }
  async link(action: "consent" | "revoke", organizationId: string | null, id: string | null, raw: unknown, key?: string) {
    const value = (action === "consent" ? McpConsentV2Schema : IdentityRevokeV2Schema).parse(raw);
    const result = await this.repository.link(action, organizationId, id === null ? null : z.string().uuid().parse(id),
      z.string().uuid().parse(key), value);
    const record = IdentityRecordV2Schema.parse(result.record);
    if (record.kind !== "links" || action === "consent" && record.value.organizationId !== organizationId
      || action === "revoke" && (record.value.id !== id || record.value.status !== "REVOKED")) {
      throw new V2DraftError("FORBIDDEN_IDENTITY", "Account link scope mismatch.", 403);
    }
    return { schemaVersion: "2.0" as const, data: record.value, meta: { idempotentReplay: result.replay } };
  }
  async configure(carrierId: string, raw: unknown, key?: string) {
    const result = await this.repository.configure(z.string().uuid().parse(carrierId), z.string().uuid().parse(key),
      IntegrationConfigurationV2Schema.parse(raw));
    const record = IdentityRecordV2Schema.parse(result.record);
    if (record.kind !== "integrations" || record.value.carrierId !== carrierId) throw new V2DraftError("FORBIDDEN_IDENTITY", "Integration scope mismatch.", 403);
    return { schemaVersion: "2.0" as const, data: record.value, meta: { idempotentReplay: result.replay } };
  }
  async diagnose(carrierId: string, id: string) {
    const data = IntegrationDiagnosticV2Schema.parse(await this.repository.diagnose(
      z.string().uuid().parse(carrierId), z.string().uuid().parse(id)));
    if (data.id !== id || data.carrierId !== carrierId) throw new V2DraftError("FORBIDDEN_IDENTITY", "Integration scope mismatch.", 403);
    return { schemaVersion: "2.0" as const, data };
  }
  async directory(kind: "members" | "operators", action: "invite" | "revise" | "accept", scope: IdentityScopeV2,
    id: string | null, raw: unknown, key?: string) {
    const schema = action === "accept" ? IdentityAcceptanceV2Schema : action === "invite"
      ? kind === "members" ? MemberInvitationV2Schema : OperatorInvitationV2Schema
      : kind === "members" ? MemberRevisionV2Schema : OperatorRevisionV2Schema;
    const result = await this.repository.directory(kind, action, scope, id === null ? null : z.string().uuid().parse(id),
      z.string().uuid().parse(key), schema.parse(raw));
    const record = IdentityRecordV2Schema.parse(result.record);
    if (record.kind !== kind || record.kind === "members" && record.value.organizationId !== scope.organizationId
      || record.kind === "operators" && record.value.carrierId !== scope.carrierId
      || id !== null && record.value.id !== id) throw new V2DraftError("FORBIDDEN_IDENTITY", "Directory scope mismatch.", 403);
    return { schemaVersion: "2.0" as const, data: record.value, meta: { idempotentReplay: result.replay } };
  }
}

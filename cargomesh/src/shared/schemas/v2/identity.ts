import { z } from "zod";

const Id = z.string().uuid();
const Instant = z.string().datetime({ offset: true });
const Name = z.string().trim().min(1).max(200);
export const CarrierRoleV2Schema = z.enum(["ADMIN", "OPERATOR", "DISPATCHER"]);
export const OrganizationMemberV2Schema = z.object({
  id: Id, organizationId: Id, role: z.enum(["OWNER", "SUPERVISOR", "REQUESTER"]),
  status: z.enum(["ACTIVE", "INVITED", "INACTIVE"]), contactRef: z.string().email().nullable(),
  verifiedAt: Instant.nullable(), version: z.number().int().positive(),
}).strict();
export const CarrierOperatorV2Schema = z.object({
  id: Id, carrierId: Id, displayName: Name, role: CarrierRoleV2Schema,
  email: z.string().email().nullable(), phone: z.string().nullable(),
  status: z.enum(["ACTIVE", "INVITED", "INACTIVE"]), verifiedAt: Instant.nullable(),
  version: z.number().int().positive(),
}).strict();
export const ResponseIntegrationV2Schema = z.object({
  id: Id, carrierId: Id, serviceId: Id, channel: z.enum(["MANUAL", "API", "MCP"]),
  endpointRef: z.string().regex(/^(vault:\/\/[0-9a-f-]{36}|env:\/\/[A-Z][A-Z0-9_]{0,100})$/).nullable(),
  verifiedAt: Instant.nullable(), status: z.enum(["PENDING", "ACTIVE", "DISABLED", "ERROR"]),
  evidence: z.string().max(500).nullable(), version: z.number().int().positive(),
}).strict();
export const McpAccountLinkV2Schema = z.object({
  id: Id, authUserId: Id, organizationId: Id, organizationMemberId: Id,
  oauthClientId: z.string().min(1).max(256), scopes: z.tuple([z.literal("mcp:tools")]),
  provider: z.enum(["ALEXA_PLUS", "OTHER"]).nullable(), externalSubjectRef: z.string().nullable(),
  status: z.enum(["ACTIVE", "REVOKED"]), verifiedAt: Instant.nullable(),
  expiresAt: Instant.nullable(), revokedAt: Instant.nullable(), version: z.number().int().positive(),
}).strict();
export const McpConsentV2Schema = z.object({
  oauthClientId: z.string().min(1).max(256).regex(/^\S+$/),
  expectedVersion: z.number().int().nonnegative(), consent: z.literal(true),
}).strict();
export const IdentityRevokeV2Schema = z.object({
  expectedVersion: z.number().int().positive(), reason: z.string().trim().min(1).max(500),
}).strict();
export const IntegrationConfigurationV2Schema = ResponseIntegrationV2Schema.pick({
  serviceId: true, channel: true, endpointRef: true,
}).extend({ enabled: z.boolean(), expectedVersion: z.number().int().nonnegative() }).strict()
  .refine(v => v.channel === "MANUAL" ? v.endpointRef === null : v.endpointRef !== null,
    "API/MCP require a secret reference; MANUAL has no endpoint.");
export const IntegrationDiagnosticV2Schema = z.object({ id: Id, carrierId: Id, serviceId: Id,
  channel: z.enum(["MANUAL", "API", "MCP"]), status: ResponseIntegrationV2Schema.shape.status,
  referenceConfigured: z.boolean(), verifiedAt: Instant.nullable(), diagnosticScope: z.literal("PERSISTED_CONFIGURATION"),
  liveIntegrationConfirmed: z.literal(false), blockedBy: z.enum(["NONE", "DISABLED", "EXTERNAL_ADAPTER_VERIFICATION_REQUIRED"]),
}).strict();
export const MemberInvitationV2Schema = z.object({ email: z.string().email(), role: z.enum(["REQUESTER", "SUPERVISOR"]) }).strict();
export const OperatorInvitationV2Schema = z.object({ email: z.string().email(), displayName: Name,
  role: CarrierRoleV2Schema }).strict();
export const MemberRevisionV2Schema = z.object({ expectedVersion: z.number().int().positive(),
  role: z.enum(["REQUESTER", "SUPERVISOR"]), status: z.enum(["ACTIVE", "INACTIVE"]) }).strict();
export const OperatorRevisionV2Schema = z.object({ expectedVersion: z.number().int().positive(),
  role: CarrierRoleV2Schema, status: z.enum(["ACTIVE", "INACTIVE"]) }).strict();
export const IdentityAcceptanceV2Schema = z.object({ expectedVersion: z.number().int().positive(), consent: z.literal(true) }).strict();
export const IdentityRecordV2Schema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("members"), value: OrganizationMemberV2Schema }).strict(),
  z.object({ kind: z.literal("operators"), value: CarrierOperatorV2Schema }).strict(),
  z.object({ kind: z.literal("integrations"), value: ResponseIntegrationV2Schema }).strict(),
  z.object({ kind: z.literal("links"), value: McpAccountLinkV2Schema }).strict(),
]);
export type IdentityKindV2 = z.infer<typeof IdentityRecordV2Schema>["kind"];

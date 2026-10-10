import { z } from "zod";
import { WorkflowContextV2Schema, WorkflowRecordV2Schema } from "./workflow";
import type { Json } from "@/types/database-v2.types";
export const JsonV2Schema: z.ZodType<Json> = z.lazy(() => z.union([
  z.string(), z.number().finite(), z.boolean(), z.null(), z.array(JsonV2Schema), z.record(JsonV2Schema),
]));
export const ConfirmableWorkflowActionsV2 = [
  "opportunities.create", "opportunities.respond", "offers.create", "offers.withdraw",
  "decisions.create", "decisions.revoke", "bookings.create", "bookings.confirm", "bookings.cancel",
  "holds.create", "holds.confirm", "holds.release", "executions.create", "executions.start", "executions.complete",
  "executions.cancel", "executions.position", "incidents.create", "incidents.update", "incidents.conditions",
  "consolidations.create", "consolidations.close", "consolidations.start", "consolidations.complete",
  "consolidations.cancel", "consolidations.position",
] as const;
export const PrepareWorkflowActionV2Schema = z.object({
  action: z.enum(ConfirmableWorkflowActionsV2), context: WorkflowContextV2Schema,
  value: JsonV2Schema, idempotencyKey: z.string().uuid(),
}).strict();
export const WorkflowConfirmationV2Schema = z.object({
  id: z.string().uuid(), action: z.enum(ConfirmableWorkflowActionsV2), context: WorkflowContextV2Schema,
  proposedValue: JsonV2Schema, payloadHash: z.string().regex(/^[0-9a-f]{64}$/),
  expiresAt: z.string().datetime({ offset: true }), confirmationRequired: z.literal(true),
}).strict();
export const ConfirmWorkflowActionV2Schema = z.object({
  confirmationId: z.string().uuid(), confirmed: z.literal(true),
}).strict();
export const WorkflowCommandResponseV2Schema = z.object({ schemaVersion: z.literal("2.0"),
  data: WorkflowRecordV2Schema, meta: z.object({ idempotentReplay: z.boolean(),
    environmentProfile: z.literal("v2-clean") }).strict() }).strict();
export const WorkflowReadResponseV2Schema = z.object({ schemaVersion: z.literal("2.0"),
  data: z.union([WorkflowRecordV2Schema, z.array(WorkflowRecordV2Schema)]),
  meta: z.object({ limit: z.number().int(), offset: z.number().int(), nextOffset: z.number().int().nullable() }).strict().optional(),
}).strict();

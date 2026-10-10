import { z } from "zod";
import { WorkflowRecordV2Schema } from "./workflow";

const Id = z.string().uuid();
const Bounds = { maxLegs: z.number().int().min(1).max(8), maxAlternatives: z.number().int().min(1).max(20) };
export const RoutePlannerSearchV2Schema = z.object({ schemaVersion: z.literal("2.0"), policyId: Id, expectedDraftVersion: z.number().int().positive(), ...Bounds }).strict();
export const RoutePlannerReplanV2Schema = z.object({ schemaVersion: z.literal("2.0"), expectedVersion: z.number().int().positive(),
  conditionId: Id, ...Bounds }).strict();
export const RoutePlannerResultV2Schema = z.object({ alternatives: z.array(WorkflowRecordV2Schema).max(20),
  search: z.object({ algorithmVersion: z.literal("BOUNDED_SIMPLE_PATHS_V1"), requestId: Id, policyId: Id,
    graphVersion: z.string().regex(/^[0-9a-f]{64}$/), maxLegs: z.number().int().positive(),
    evaluatedPaths: z.number().int().nonnegative(), returnedPaths: z.number().int().nonnegative(),
    completeWithinBounds: z.literal(true), presentationTruncated: z.boolean(),
    universe: z.literal("ACTIVE_PUBLISHED_DIRECTED_NETWORK"), evaluatedAt: z.string().datetime({ offset: true }) }).strict(),
  decision: z.object({ originalRouteId: Id, conditionId: Id, recommendedRouteId: Id.nullable(),
    action: z.enum(["PROPOSE_ALTERNATIVE", "REQUIRES_REVIEW", "NO_ALTERNATIVE"]),
    requiresSelection: z.literal(true) }).strict().nullable(),
}).strict();

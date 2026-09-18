import { z } from "zod";
import type { OrchestrationViewModel } from "@/features/orchestration/contracts";

const uuid = z.string().uuid();
const finite = z.number().finite();
const dateTime = z.string().datetime({ offset: true });
const toolName = z.enum(["check_service_coverage", "check_capacity", "quote_freight"]);

export const GetFreightOptionsInputSchema = z.object({ runId: uuid }).strict();

const ranking = z.object({
  orchestrationRunId: uuid,
  strategy: z.literal("BALANCED"),
  recommendedOfferId: uuid.nullable(),
  decisionConfidence: finite,
  options: z.array(z.object({
    offerId: uuid, rank: finite, rawScore: finite, roundedScore: finite,
    eligible: z.boolean(), reasons: z.array(z.string()),
  })),
});

const offer = z.object({
  offerId: uuid, carrierId: uuid, carrierCode: z.string(), displayName: z.string(),
  matchingServiceId: uuid, providerOfferReference: z.string(),
  totalPrice: finite, currency: z.literal("USD"), transitHours: finite,
  rank: finite, score: finite, eligible: z.boolean(), reasons: z.array(z.string()),
  recommended: z.boolean(), availableCapacityKg: finite.optional(),
  availableVolumeM3: finite.nullable().optional(),
  estimatedPickup: dateTime.optional(), estimatedDelivery: dateTime.optional(),
  reliabilityScore: finite.optional(), availabilityClass: z.string().optional(),
  vehicleId: uuid.nullable().optional(),
  subscores: z.object({
    cost: finite, reliability: finite, eta: finite, availability: finite,
    routeExperience: finite, organizationHistory: finite,
  }).nullable().optional(),
});

const base = z.object({
  schemaVersion: z.literal("1.0"), runId: uuid, freightRequestId: uuid,
  requestCode: z.string(), startedAt: dateTime, completedAt: dateTime.nullable(),
  candidateCount: z.number().int().nonnegative(),
  completedCandidateCount: z.number().int().nonnegative(),
  attempts: z.array(z.object({
    carrierId: uuid, carrierCode: z.string(), displayName: z.string(),
    providerUrl: z.string(), matchingServiceId: uuid,
    status: z.enum(["PENDING", "RUNNING", "REJECTED", "QUOTED", "FAILED"]),
    completedTools: z.array(toolName), stopReason: z.string().nullable(),
  })),
  warnings: z.array(z.object({
    code: z.string(), message: z.string(), retryable: z.boolean(),
    carrierId: uuid.nullable(), matchingServiceId: uuid.nullable(),
    toolName: toolName.nullable(),
  })),
});

// Project known fields; unknown database/runtime fields must not leak to MCP.
export const OrchestrationViewModelSchema = z.discriminatedUnion("status", [
  base.extend({ status: z.literal("loading"), ranking: z.null(), offers: z.tuple([]) }),
  base.extend({
    status: z.literal("error"), ranking: z.null(), offers: z.tuple([]),
    error: z.object({ code: z.string(), message: z.string(), retryable: z.boolean() }),
  }),
  base.extend({
    status: z.literal("NO_MATCH"), reason: z.string(), ranking, offers: z.tuple([]),
  }),
  base.extend({ status: z.literal("success"), ranking, offers: z.array(offer) }),
]) satisfies z.ZodType<OrchestrationViewModel>;

export const GetFreightOptionsOutputSchema = z.object({
  ok: z.literal(true), data: OrchestrationViewModelSchema,
});

import { z } from "zod";

export const CargoReadinessV2ResponseSchema = z.object({
  schemaVersion: z.literal("2.0"),
  data: z.object({
    freightRequestId: z.string().uuid(),
    evaluatedDraftVersion: z.number().int().positive(),
    captureStatus: z.enum(["COMPLETE", "INCOMPLETE"]),
    missingFields: z.array(z.string()),
    requirements: z.array(z.object({
      code: z.string(),
      verification: z.enum(["RESOURCE_EVIDENCE", "REQUIRES_REVIEW"]),
    })),
    totals: z.object({ weightKg: z.number().positive(), volumeM3: z.number().positive() }),
    operationalStatus: z.literal("NOT_EVALUATED"),
  }),
});

export type CargoReadinessV2Response = z.infer<typeof CargoReadinessV2ResponseSchema>;

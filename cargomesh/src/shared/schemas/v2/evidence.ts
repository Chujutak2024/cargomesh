import {z} from "zod";
const Instant=z.string().datetime({offset:true});
export const CommercialEvidenceV2Schema = z.object({
  reference: z.string().trim().min(1).max(500), provider: z.string().trim().min(1).max(150),
  observedAt: Instant, validUntil: Instant.nullable(),
  provenanceStatus: z.enum(["VERIFIED", "ESTIMATED", "SIMULATED", "UNKNOWN"]),
}).strict().refine((item) => item.validUntil === null || Date.parse(item.validUntil) > Date.parse(item.observedAt));

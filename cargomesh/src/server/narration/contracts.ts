import { z } from "zod";

export const NarrationInputSchema = z.object({
  locale: z.enum(["es-PE", "en-US"]),
  result: z.string().trim().min(1).max(2_000),
  explanation: z.string().trim().min(1).max(2_000),
  source: z.object({
    kind: z.enum(["CARRIER_OFFER", "TRANSPORT_PLAN", "FREIGHT_REQUEST", "SYSTEM_STATUS"]),
    status: z.enum(["CONFIRMED", "PRELIMINARY", "UNKNOWN", "BLOCKED"]),
    reference: z.string().trim().min(1).max(500),
  }).strict(),
  constraints: z.array(z.string().trim().min(1).max(500)).max(20),
  pendingFields: z.array(z.string().trim().min(1).max(200)).max(20),
}).strict();

export type NarrationInput = z.infer<typeof NarrationInputSchema>;

export type NarrationResult = {
  text: string;
  ssml: string;
  provider: "DETERMINISTIC" | "BEDROCK";
  evidenceStatus: "LOCAL" | "LIVE" | "BLOCKED";
  telemetry: {
    modelId: string | null;
    region: string | null;
    latencyMs: number | null;
    inputTokens: number | null;
    outputTokens: number | null;
    estimatedCostUsd: number | null;
    requestId: string | null;
  };
  fallbackReason?: string;
};

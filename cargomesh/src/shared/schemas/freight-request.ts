/**
 * V2 public schema for creating a freight request.
 *
 * VERIFIED CAPABILITIES ONLY
 * ---------------------------
 * The Golden Flow end-to-end supports exclusively:
 *   transportMode: ROAD   (hardcoded in draft-creation-policy.ts)
 *   serviceType:   FTL    (hardcoded in draft-creation-policy.ts)
 *   strategy:      BALANCED (hardcoded as optimization_strategy)
 *
 * AIR / SEA / RAIL / LTL / CHEAPEST / FASTEST are NOT supported end-to-end.
 * They are excluded from this schema to prevent silent acceptance of
 * unimplemented capabilities.
 *
 * FUTURE: When the service supports multiple transport modes / strategies,
 * extend the enums here AND update adaptV2ToLegacyService accordingly.
 *
 * This schema is reused by the MCP create_freight_request tool (when implemented).
 * It lives in src/shared/ so both Hono and MCP can import it without coupling.
 */

import { z } from "zod";

export const CreateFreightRequestSchema = z.object({
  // ── Route ─────────────────────────────────────────────────────────────────
  originCity: z.string().min(1).max(100),
  originCountry: z.string().length(2).toUpperCase(),
  destinationCity: z.string().min(1).max(100),
  destinationCountry: z.string().length(2).toUpperCase(),

  // ── Cargo ─────────────────────────────────────────────────────────────────
  cargoWeightKg: z.number().positive(),
  cargoVolumeM3: z.number().positive().nullable().optional(),
  packageCount: z.number().int().positive(),
  isCrossBorder: z.boolean(),

  // ── Transport — VERIFIED SUPPORTED VALUES ONLY ────────────────────────────
  // transportMode and serviceType are hardcoded by the service and not
  // passed through the fields adapter. They are accepted here for forward-
  // compatibility but must equal the only currently working values.
  transportMode: z
    .literal("ROAD")
    .optional()
    .default("ROAD")
    .describe("Currently only ROAD is supported end-to-end."),

  serviceType: z
    .literal("FTL")
    .optional()
    .default("FTL")
    .describe("Currently only FTL is supported end-to-end."),

  // ── Optimization — VERIFIED SUPPORTED VALUES ONLY ────────────────────────
  strategy: z
    .literal("BALANCED")
    .optional()
    .default("BALANCED")
    .describe("Currently only BALANCED is supported end-to-end."),

  // ── Optional fields ───────────────────────────────────────────────────────
  budgetUsd: z.number().positive().nullable().optional(),
  cargoDescription: z.string().max(500).nullable().optional(),

  // ── Special handling ──────────────────────────────────────────────────────
  requiresRefrigeration: z.boolean().optional().default(false),
  isHazardous: z.boolean().optional().default(false),
  isFragile: z.boolean().optional().default(false),
  isOversized: z.boolean().optional().default(false),
});

export type CreateFreightRequestInput = z.infer<typeof CreateFreightRequestSchema>;

export const SubmitFreightRequestSchema = z.object({
  draftVersion: z
    .number()
    .int()
    .positive()
    .describe("Current draft version for optimistic concurrency"),
});

export type SubmitFreightRequestInput = z.infer<typeof SubmitFreightRequestSchema>;

export const SubmitFreightRequestParamsSchema = z.object({
  freightRequestId: z.string().uuid().describe("Target freight request UUID"),
  draftVersion: z
    .number()
    .int()
    .positive()
    .describe("Current draft version for optimistic concurrency"),
});

export type SubmitFreightRequestParams = z.infer<typeof SubmitFreightRequestParamsSchema>;


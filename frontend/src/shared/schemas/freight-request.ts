import { z } from "zod";

// ---------------------------------------------------------------------------
// Zod schema for creating a new freight request draft.
// This is used by both the Hono route and the MCP tool (when implemented).
// ---------------------------------------------------------------------------

export const CreateFreightRequestSchema = z.object({
  // Route
  originCity: z.string().min(1).max(100),
  originCountry: z.string().length(2).toUpperCase(),
  destinationCity: z.string().min(1).max(100),
  destinationCountry: z.string().length(2).toUpperCase(),

  // Cargo
  cargoWeightKg: z.number().positive(),
  cargoVolumeM3: z.number().positive().nullable().optional(),
  packageCount: z.number().int().positive(),
  isCrossBorder: z.boolean(),

  // Mode
  transportMode: z.enum(["ROAD", "AIR", "SEA", "RAIL"]).optional().default("ROAD"),
  serviceType: z.enum(["FTL", "LTL"]).optional().default("FTL"),

  // Optional constraints
  budgetUsd: z.number().positive().nullable().optional(),
  strategy: z.enum(["BALANCED", "CHEAPEST", "FASTEST"]).optional().default("BALANCED"),
  cargoDescription: z.string().max(500).nullable().optional(),

  // Special handling flags
  requiresRefrigeration: z.boolean().optional().default(false),
  isHazardous: z.boolean().optional().default(false),
  isFragile: z.boolean().optional().default(false),
  isOversized: z.boolean().optional().default(false),
});

export type CreateFreightRequestInput = z.infer<typeof CreateFreightRequestSchema>;

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
  originRegion: z.string().min(1).max(100).nullable().optional(),
  originAddress: z.string().min(1).max(250).nullable().optional(),
  destinationRegion: z.string().min(1).max(100).nullable().optional(),
  destinationAddress: z.string().min(1).max(250).nullable().optional(),
  pickupContactName: z.string().min(1).max(120).nullable().optional(),
  pickupContactPhone: z.string().min(1).max(40).nullable().optional(),
  receiverName: z.string().min(1).max(120).nullable().optional(),
  receiverCompany: z.string().min(1).max(160).nullable().optional(),
  receiverPhone: z.string().min(1).max(40).nullable().optional(),

  // ── Cargo ─────────────────────────────────────────────────────────────────
  cargoWeightKg: z.number().positive(),
  cargoVolumeM3: z.number().positive().nullable().optional(),
  packageCount: z.number().int().positive(),
  cargoCategoryCode: z
    .enum(["MACHINERY", "GENERAL", "AGRICULTURAL", "CONSTRUCTION"])
    .optional()
    .default("MACHINERY"),
  cargoEntryMethod: z
    .enum(["TOTAL_WEIGHT", "UNITS", "PACKAGES", "PALLETS", "LOTS", "SACKS"])
    .optional()
    .default("PALLETS"),
  unitsPerEntry: z.number().int().positive().nullable().optional(),
  entryUnitWeightKg: z.number().positive().nullable().optional(),
  entryLengthCm: z.number().positive().nullable().optional(),
  entryWidthCm: z.number().positive().nullable().optional(),
  entryHeightCm: z.number().positive().nullable().optional(),
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
  specialInstructions: z.string().max(1000).nullable().optional(),
  availableDocuments: z.array(z.string().min(1).max(100)).max(20).optional().default([]),

  // ── Schedule ──────────────────────────────────────────────────────────────
  pickupMode: z.enum(["ASAP", "SCHEDULED"]).optional().default("ASAP"),
  pickupWindowStart: z.string().datetime({ offset: true }).nullable().optional(),
  pickupWindowEnd: z.string().datetime({ offset: true }).nullable().optional(),
  deliveryDeadline: z.string().datetime({ offset: true }).nullable().optional(),

  // ── Special handling ──────────────────────────────────────────────────────
  requiresRefrigeration: z.boolean().optional().default(false),
  temperatureMinC: z.number().finite().nullable().optional(),
  temperatureMaxC: z.number().finite().nullable().optional(),
  isHazardous: z.boolean().optional().default(false),
  isFragile: z.boolean().optional().default(false),
  isOversized: z.boolean().optional().default(false),
}).superRefine((input, context) => {
  if (input.pickupMode === "SCHEDULED") {
    if (!input.pickupWindowStart) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["pickupWindowStart"], message: "Required for SCHEDULED pickup" });
    }
    if (!input.pickupWindowEnd) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["pickupWindowEnd"], message: "Required for SCHEDULED pickup" });
    }
  }
  if (
    input.pickupWindowStart &&
    input.pickupWindowEnd &&
    Date.parse(input.pickupWindowEnd) <= Date.parse(input.pickupWindowStart)
  ) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["pickupWindowEnd"], message: "Must be after pickupWindowStart" });
  }
  if (
    input.pickupWindowStart &&
    input.deliveryDeadline &&
    Date.parse(input.deliveryDeadline) <= Date.parse(input.pickupWindowStart)
  ) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["deliveryDeadline"], message: "Must be after pickupWindowStart" });
  }
  if (input.requiresRefrigeration) {
    if (input.temperatureMinC === null || input.temperatureMinC === undefined) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["temperatureMinC"], message: "Required for refrigerated cargo" });
    }
    if (input.temperatureMaxC === null || input.temperatureMaxC === undefined) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["temperatureMaxC"], message: "Required for refrigerated cargo" });
    }
  }
  if (
    input.temperatureMinC !== null && input.temperatureMinC !== undefined &&
    input.temperatureMaxC !== null && input.temperatureMaxC !== undefined &&
    input.temperatureMinC > input.temperatureMaxC
  ) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["temperatureMaxC"], message: "Must be greater than or equal to temperatureMinC" });
  }
});

export type CreateFreightRequestInput = z.input<typeof CreateFreightRequestSchema>;
export type NormalizedCreateFreightRequestInput = z.output<typeof CreateFreightRequestSchema>;

const DraftVersionSchema = z
  .number()
  .int()
  .positive()
  .describe("Expected draft version for optimistic concurrency");

/**
 * Public V2 submit contract.
 *
 * HAC-8 standardizes the wire key as `expected_draft_version`. During Sprint 1,
 * HAC-6 introduced `draftVersion` in its server branch. Accepting both at the
 * schema boundary and normalizing to both names keeps the independently
 * developed branches compatible without weakening optimistic concurrency.
 */
export const SubmitFreightRequestSchema = z
  .union([
    z.object({ expected_draft_version: DraftVersionSchema }),
    z.object({ draftVersion: DraftVersionSchema }),
  ])
  .transform((input) => {
    const draftVersion = "expected_draft_version" in input
      ? input.expected_draft_version
      : input.draftVersion;

    return {
      expected_draft_version: draftVersion,
      draftVersion,
    };
  });

export type SubmitFreightRequestInput = z.input<typeof SubmitFreightRequestSchema>;
export type NormalizedSubmitFreightRequestInput = z.output<typeof SubmitFreightRequestSchema>;

import { z } from "zod";
import { OFFICIAL_CARGO_CATEGORY_CODES, SUPPORTED_COUNTRY_CODES } from "@/features/freight-requests/manual-intake-contracts";

const text = z.string().trim().min(1).max(500);
const positive = z.number().finite().positive();
const date = z.string().datetime({ offset: true });

// Explicit fields prevent the interactive form's template from silently
// inventing route, quantities, dates or budget for an agent caller.
export const CreateFreightRequestInputSchema = z.object({
  idempotencyKey: z.string().uuid().transform((value) => value.toLowerCase()),
  fields: z.object({
    cargoCategoryCode: z.enum(OFFICIAL_CARGO_CATEGORY_CODES),
    originCountry: z.enum(SUPPORTED_COUNTRY_CODES),
    originRegion: text.nullable(), originCity: text,
    destinationCountry: z.enum(SUPPORTED_COUNTRY_CODES),
    destinationRegion: text.nullable(), destinationCity: text,
    cargoEntryMethod: z.literal("PALLETS"),
    entryQuantity: positive.int(), entryUnitWeightKg: positive,
    unitsPerEntry: z.literal(1),
    entryLengthCm: positive, entryWidthCm: positive, entryHeightCm: positive,
    pickupMode: z.literal("SCHEDULED"),
    pickupWindowStart: date, pickupWindowEnd: date,
    deliveryDeadline: date.nullable(), budgetMax: positive.nullable(),
    availableDocuments: z.array(text).max(50),
    cargoDescription: text.nullable().optional(),
    requiresRefrigeration: z.boolean().optional(),
    temperatureMinC: z.number().finite().nullable().optional(),
    temperatureMaxC: z.number().finite().nullable().optional(),
    isHazardous: z.boolean().optional(), isFragile: z.boolean().optional(),
    isOversized: z.boolean().optional(),
  }).strict(),
}).strict();

export const CreatedFreightRequestSchema = z.object({
  freightRequestId: z.string().uuid(), requestCode: z.string().min(1),
  status: z.enum(["DRAFT", "PENDING", "ORCHESTRATING", "AWAITING_SELECTION", "BOOKING", "BOOKED", "FAILED", "CANCELLED"]),
  draftVersion: z.number().int().positive(),
  replayed: z.boolean(),
});
export const CreateFreightRequestOutputSchema = z.object({ ok: z.literal(true), data: CreatedFreightRequestSchema });
export type CreateFreightRequestInput = z.infer<typeof CreateFreightRequestInputSchema>;
export type CreatedFreightRequest = z.infer<typeof CreatedFreightRequestSchema>;

export const SubmitFreightRequestInputSchema = z.object({
  freightRequestId: z.string().uuid(), draftVersion: z.number().int().positive(),
}).strict();
export const SubmittedFreightRequestSchema = z.object({
  freightRequestId: z.string().uuid(), requestCode: z.string().min(1),
  status: z.literal("PENDING"), draftVersion: z.number().int().positive(), replayed: z.boolean(),
});
export const SubmitFreightRequestOutputSchema = z.object({ ok: z.literal(true), data: SubmittedFreightRequestSchema });

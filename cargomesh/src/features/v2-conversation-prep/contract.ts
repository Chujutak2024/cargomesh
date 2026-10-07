/** Transport-independent conversation DTOs. Identity and tenant stay server-side. */
import { z } from "zod";

export const GuidedMessageV2Schema = z.object({
  schemaVersion: z.literal("2.0"),
  text: z.string().trim().min(1).max(2000),
  inputMode: z.enum(["TEXT", "EDITED_VOICE_TRANSCRIPT"]),
}).strict();

const Uuid = z.string().uuid();
const Instant = z.string().datetime({ offset: true });

export const ConversationSlotV2Schema = z.enum([
  "origin", "destination", "cargoCategory", "cargoQuantity", "weightKg",
  "dimensionsCm", "pickupWindow",
]);

export const ConversationIntentV2Schema = z.enum([
  "PROVIDE_SLOT", "CORRECT_SLOT", "SELECT_PLACE", "CONFIRM_PLACE",
  "CREATE_DRAFT", "READ_DRAFT", "EVALUATE_ROAD", "ASK_PRICE", "ASK_BOOKING", "HELP",
]);

export const ConversationPlaceChoiceV2Schema = z.object({
  kind: z.enum(["FACILITY", "EXTERNAL_PLACE", "COORDINATE"]),
  reference: z.string().min(1),
  label: z.string().min(1),
  source: z.string().min(1),
  precision: z.enum(["EXACT", "AREA", "UNKNOWN"]),
  observedAt: Instant,
}).strict();

export const ConversationSlotValueV2Schema = z.discriminatedUnion("slot", [
  z.object({ slot: z.literal("origin"), value: z.string().trim().min(1).max(200) }).strict(),
  z.object({ slot: z.literal("destination"), value: z.string().trim().min(1).max(200) }).strict(),
  z.object({ slot: z.literal("cargoCategory"), value: z.string().trim().min(1).max(100) }).strict(),
  z.object({ slot: z.literal("cargoQuantity"), value: z.number().int().positive() }).strict(),
  z.object({ slot: z.literal("weightKg"), value: z.number().positive() }).strict(),
  z.object({ slot: z.literal("dimensionsCm"), value: z.object({
    length: z.number().positive(), width: z.number().positive(), height: z.number().positive(),
  }).strict() }).strict(),
  z.object({ slot: z.literal("pickupWindow"), value: z.object({
    startsAt: Instant, endsAt: Instant,
  }).strict().refine((window) => Date.parse(window.endsAt) > Date.parse(window.startsAt)) }).strict(),
]);

/** The browser can submit a proposed turn, never identity or authorization. */
export const ConversationTurnInputV2Schema = z.object({
  schemaVersion: z.literal("2.0-draft"),
  locale: z.enum(["en", "es"]).default("en"),
  intent: ConversationIntentV2Schema,
  requestId: Uuid.optional(),
  expectedDraftVersion: z.number().int().positive().optional(),
  idempotencyKey: z.string().uuid().optional(),
  slotValue: ConversationSlotValueV2Schema.optional(),
  placeChoice: ConversationPlaceChoiceV2Schema.optional(),
  text: z.string().trim().min(1).max(2000).optional(),
  inputMode: z.enum(["TEXT", "EDITED_VOICE_TRANSCRIPT"]),
}).strict().superRefine((turn, context) => {
  if (["PROVIDE_SLOT", "CORRECT_SLOT"].includes(turn.intent) && !turn.slotValue) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["slotValue"], message: "SLOT_REQUIRED" });
  }
  if (["SELECT_PLACE", "CONFIRM_PLACE"].includes(turn.intent) && !turn.placeChoice) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["placeChoice"], message: "PLACE_CHOICE_REQUIRED" });
  }
  if (turn.intent === "CONFIRM_PLACE" && (!turn.requestId || !turn.expectedDraftVersion)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["expectedDraftVersion"], message: "VERSIONED_DRAFT_REQUIRED" });
  }
  if (turn.intent === "CREATE_DRAFT" && !turn.idempotencyKey) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["idempotencyKey"], message: "IDEMPOTENCY_KEY_REQUIRED" });
  }
  if (["READ_DRAFT", "EVALUATE_ROAD"].includes(turn.intent) && !turn.requestId) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["requestId"], message: "REQUEST_ID_REQUIRED" });
  }
});

export const ConversationStateV2Schema = z.object({
  schemaVersion: z.literal("2.0-draft"),
  conversationId: Uuid,
  /** Resolved on the server. Never trusted from a browser turn. */
  organizationId: Uuid,
  authUserId: Uuid,
  requestId: Uuid.nullable(),
  draftVersion: z.number().int().positive().nullable(),
  phase: z.enum(["COLLECTING", "PLACE_CHOICE", "READY_TO_CREATE", "DRAFT", "EVALUATING", "RESULT", "ERROR"]),
  slots: z.array(z.object({
    value: ConversationSlotValueV2Schema,
    status: z.enum(["PROVISIONAL", "CONFIRMED"]),
    source: z.enum(["USER_TEXT", "EDITED_VOICE_TRANSCRIPT", "CANONICAL_DRAFT", "HAC33_PLACE"]),
  }).strict()),
  pendingSlot: ConversationSlotV2Schema.nullable(),
  eligibility: z.object({
    status: z.enum(["eligible", "ineligible", "unknown"]),
    reasonCodes: z.array(z.string().min(1)),
    source: z.string().min(1),
    evaluatedAt: Instant,
    evaluatedDraftVersion: z.number().int().positive(),
  }).strict().nullable(),
  commercial: z.object({
    price: z.literal("DISABLED_NO_V2_OFFER_SERVICE"),
    booking: z.literal("DISABLED_NO_V2_BOOKING_SERVICE"),
  }).strict(),
}).strict();

export const ConversationErrorV2Schema = z.object({
  schemaVersion: z.literal("2.0-draft"),
  code: z.enum(["VALIDATION_ERROR", "AUTH_REQUIRED", "SCOPE_DENIED", "LINK_REVOKED", "TENANT_DENIED",
    "STALE_DRAFT", "IDEMPOTENCY_CONFLICT", "PLACE_AMBIGUOUS", "PLACE_NOT_FOUND", "PLACE_IMPRECISE",
    "PROVIDER_UNAVAILABLE", "ROAD_EVALUATION_UNAVAILABLE", "PRICE_UNAVAILABLE", "BOOKING_UNAVAILABLE"]),
  retryable: z.boolean(),
  message: z.string().min(1),
}).strict();

export type ConversationTurnInputV2 = z.infer<typeof ConversationTurnInputV2Schema>;
export type ConversationStateV2 = z.infer<typeof ConversationStateV2Schema>;

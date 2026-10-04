import { z } from "zod";
import { CanonicalLocationV2Schema, EquipmentCodeV2Schema, TimeWindowV2Schema, TransportModeV2Schema } from "./freight-request";

const Id = z.string().uuid();
const Text = z.string().trim().min(1).max(500);
const Instant = z.string().datetime({ offset: true });
const Code = z.string().regex(/^[A-Z][A-Z0-9_]{0,99}$/);
const Strings = z.array(Text).max(100).refine(x => new Set(x).size === x.length, "Duplicate values.");
const Evidence = z.enum(["VERIFIED", "ESTIMATED", "SIMULATED", "UNKNOWN"]);
const Base = { schemaVersion: z.literal("2.0"), serviceId: Id };
const Location = CanonicalLocationV2Schema.omit({ facilityId: true }).refine(x =>
  (x.lat === null) === (x.lng === null), "Coordinates required together.");
const Dimensions = z.object({ length: z.number().positive(), width: z.number().positive(), height: z.number().positive() }).strict();
const Temperature = z.object({ minCelsius: z.number().finite(), maxCelsius: z.number().finite() }).strict()
  .refine(x => x.maxCelsius >= x.minCelsius, "Invalid temperature range.");
const AssetStatus = z.enum(["AVAILABLE", "IN_SERVICE", "MAINTENANCE", "OUT_OF_SERVICE"]);
const LocalDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(x => {
  const date = new Date(x + "T00:00:00Z");
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === x;
}, "Invalid calendar date.");
const roadVehicle = z.object({ plate: Text.nullable(), registrationCode: Text.nullable(), registeredAt: LocalDate.nullable(),
  brand: Text.nullable(), model: Text.nullable(), variant: Text.nullable(), bodyType: Text.nullable(),
  usableDimensions: Dimensions.nullable(), grossWeightLimitKg: z.number().positive().nullable(),
  odometerKm: z.number().nonnegative().nullable(), conditionReason: Text.nullable(), axleConfig: Text.nullable() }).strict();

export const FleetInputsV2 = {
  "capability-definitions": z.object({ ...Base, categoryId: Id, requirements: Strings,
    maxWeightKg: z.number().positive().nullable(), temperatureRange: Temperature.nullable(),
    certifications: Strings, evidence: Text.nullable(), verifiedAt: Instant.nullable(), validUntil: Instant.nullable(), active: z.boolean() }).strict()
    .refine(x => !x.verifiedAt || !x.validUntil || Date.parse(x.validUntil) > Date.parse(x.verifiedAt), "Invalid evidence window."),
  assets: z.object({ ...Base, code: Code, mode: TransportModeV2Schema, equipmentType: EquipmentCodeV2Schema,
    role: z.enum(["LOAD_BEARING", "AUXILIARY"]), usefulCapacityKg: z.number().positive().nullable(),
    usableVolumeM3: z.number().positive().nullable(), operatingStatus: AssetStatus,
    homeDepotId: Id.nullable(), provenance: z.enum(["OWN", "CONTRACTED", "PARTNER"]),
    partnerId: Id.nullable(), evidence: Text.nullable(), roadVehicle: roadVehicle.nullable() }).strict()
    .refine(x => (x.mode === "ROAD") === (x.roadVehicle !== null), "ROAD requires vehicle attributes.")
    .refine(x => (x.provenance === "PARTNER") === (x.partnerId !== null), "Partner provenance requires partner.")
    .refine(x => x.role !== "AUXILIARY" || (x.usefulCapacityKg === null && x.usableVolumeM3 === null), "Auxiliary capacity must be null.")
    .refine(x => !x.roadVehicle?.grossWeightLimitKg || !x.usefulCapacityKg || x.usefulCapacityKg <= x.roadVehicle.grossWeightLimitKg,
      "Useful capacity exceeds gross weight limit."),
  "capacity-pools": z.object({ ...Base, code: Code, mode: TransportModeV2Schema,
    equipmentType: EquipmentCodeV2Schema.nullable(), serviceWindow: TimeWindowV2Schema,
    declaredCapacity: z.object({ weightKg: z.number().positive().nullable(), volumeM3: z.number().positive().nullable() }).strict(),
    provenance: z.enum(["OWN", "CONTRACTED", "PARTNER"]), partnerId: Id.nullable(), evidence: Text,
    supportedCargoCategoryIds: z.array(Id).max(100).refine(x => new Set(x).size === x.length), active: z.boolean() }).strict()
    .refine(x => (x.provenance === "PARTNER") === (x.partnerId !== null), "Partner provenance requires partner."),
  calendars: z.object({ ...Base, assetId: Id.nullable(), capacityPoolId: Id.nullable(),
    timezone: Text.refine(x => { try { new Intl.DateTimeFormat("en", { timeZone: x }); return true; } catch { return false; } }, "Invalid timezone."),
    horizon: TimeWindowV2Schema, source: Text, lastVerifiedAt: Instant.nullable(), freshness: Evidence,
    validUntil: Instant.nullable(), complete: z.boolean(), availableWindows: z.array(TimeWindowV2Schema).max(100),
    readyPickupAreaId: Id.nullable() }).strict()
    .refine(x => (x.assetId === null) !== (x.capacityPoolId === null), "Exactly one capacity source required.")
    .refine(x => x.availableWindows.every(w => Date.parse(w.startsAt) >= Date.parse(x.horizon.startsAt)
      && Date.parse(w.endsAt) <= Date.parse(x.horizon.endsAt)), "Window outside horizon.")
    .refine(x => x.availableWindows.every((w, i) => x.availableWindows.every((v, j) => i === j
      || Date.parse(w.endsAt) <= Date.parse(v.startsAt) || Date.parse(v.endsAt) <= Date.parse(w.startsAt))), "Overlapping availability windows.")
    .refine(x => !x.lastVerifiedAt || !x.validUntil || Date.parse(x.validUntil) > Date.parse(x.lastVerifiedAt), "Invalid freshness window.")
    .refine(x => x.freshness === "UNKNOWN" || (x.lastVerifiedAt !== null && x.validUntil !== null), "Evidence dates required."),
  maintenances: z.object({ ...Base, assetId: Id, blockedWindow: TimeWindowV2Schema,
    kind: Text, status: z.enum(["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]), source: Text, reason: Text }).strict(),
  "repositioning-blocks": z.object({ ...Base, calendarId: Id, occupiedWindow: TimeWindowV2Schema,
    origin: Location, nextPickup: Location, estimatedTravelSeconds: z.number().int().positive(),
    status: z.enum(["PLANNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]), source: Text, reason: Text }).strict()
    .refine(x => x.estimatedTravelSeconds * 1000 <= Date.parse(x.occupiedWindow.endsAt) - Date.parse(x.occupiedWindow.startsAt),
      "Travel exceeds blocked window."),
  "asset-capabilities": z.object({ ...Base, assetId: Id, definitionId: Id, categoryId: Id,
    temperatureRange: Temperature.nullable(), certifications: Strings, evidence: Text.nullable(),
    verifiedAt: Instant.nullable(), validUntil: Instant.nullable(), active: z.boolean() }).strict()
    .refine(x => !x.verifiedAt || !x.validUntil || Date.parse(x.validUntil) > Date.parse(x.verifiedAt), "Invalid evidence window."),
} as const;

// Imported rows may lack the new UML fields. Reads preserve those unknowns;
// a new publication/revision must still satisfy the full input contract above.
type UnwrapEffects<T extends z.ZodTypeAny> = T extends z.ZodEffects<infer Inner> ? UnwrapEffects<Inner> : T;
function objectOf<T extends z.ZodTypeAny>(schema: T): UnwrapEffects<T> {
  return (schema instanceof z.ZodEffects ? objectOf(schema.innerType()) : schema) as UnwrapEffects<T>;
}
export const FleetOutputsV2 = {
  "capability-definitions": FleetInputsV2["capability-definitions"],
  assets: FleetInputsV2.assets,
  "capacity-pools": objectOf(FleetInputsV2["capacity-pools"]).extend({
    mode: TransportModeV2Schema.nullable(), serviceWindow: TimeWindowV2Schema.nullable(),
    provenance: z.enum(["OWN", "CONTRACTED", "PARTNER"]).nullable(), evidence: Text.nullable(),
  }),
  calendars: objectOf(FleetInputsV2.calendars).extend({ timezone: Text.nullable(), horizon: TimeWindowV2Schema.nullable(),
    source: Text.nullable(), freshness: Evidence.nullable() }),
  maintenances: objectOf(FleetInputsV2.maintenances).extend({ kind: Text.nullable(), source: Text.nullable() }),
  "repositioning-blocks": objectOf(FleetInputsV2["repositioning-blocks"]).extend({
    origin: Location.nullable(), nextPickup: Location.nullable(), estimatedTravelSeconds: z.number().int().positive().nullable(),
    source: Text.nullable(),
  }),
  "asset-capabilities": objectOf(FleetInputsV2["asset-capabilities"]).extend({ definitionId: Id.nullable() }),
} as const;

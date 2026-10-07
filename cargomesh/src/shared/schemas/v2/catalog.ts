import { z } from "zod";
import { CrewInputsV2 } from "./crew";
import { FleetInputsV2, FleetOutputsV2 } from "./fleet";
import { CanonicalLocationV2Schema, EquipmentCodeV2Schema, TransportModeV2Schema,
  RankingObjectiveV2Schema } from "./freight-request";

const Text = z.string().trim().min(1).max(500);
const Name = z.string().trim().min(1).max(200);
const Code = z.string().regex(/^[A-Z][A-Z0-9_]{0,99}$/);
const Id = z.string().uuid();
const Instant = z.string().datetime({ offset: true });
const Status = z.enum(["ACTIVE", "INACTIVE"]);
const Base = { schemaVersion: z.literal("2.0") };
type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
const JsonValueSchema: z.ZodType<JsonValue> = z.lazy(() => z.union([
  z.string(), z.number().finite(), z.boolean(), z.null(), z.array(JsonValueSchema), z.record(JsonValueSchema),
]));
const Strings = z.array(Text).max(100).refine(x => new Set(x).size === x.length, "Duplicate values.");
const Money = z.object({ amount: z.number().positive(), currency: z.literal("USD") }).strict();
const Temperature = z.object({ minCelsius: z.number(), maxCelsius: z.number() }).strict()
  .refine(x => x.maxCelsius >= x.minCelsius, "Invalid temperature range.");
export const CargoUnitTemplateV2Schema = z.object({
  packageType: Text, quantity: z.number().int().positive(), weightPerUnitKg: z.number().positive(),
  volumePerUnitM3: z.number().positive(), dimensionsCm: z.object({ length: z.number().positive(),
    width: z.number().positive(), height: z.number().positive() }).strict(),
  indivisible: z.boolean(), stackable: z.boolean(), unitsPerPackage: z.number().int().positive().max(1000000),
}).strict();
const Guidance = z.object({ recommendedEntryMethods: Strings.refine(x => x.length > 0),
  intakeSpecificationSchema: z.record(JsonValueSchema), suggestedRequirements: z.record(JsonValueSchema),
  recommendedVehicleClasses: Strings }).strict();
const Window = { evidence: Text.nullable(), verifiedAt: Instant.nullable(),
  validFrom: Instant.nullable(), validUntil: Instant.nullable() };
const validWindow = (x: { validFrom: string | null; validUntil: string | null }) =>
  !x.validFrom || !x.validUntil || Date.parse(x.validUntil) > Date.parse(x.validFrom);
const Coordinate = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]);
export const CoverageGeometryV2Schema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("MultiPoint"), coordinates: z.array(Coordinate).min(1).max(1000) }).strict(),
  z.object({ type: z.literal("Polygon"), coordinates: z.array(z.array(Coordinate).min(4).max(1000)).min(1).max(20) }).strict(),
]).refine(x => x.type !== "Polygon" || x.coordinates.every(ring =>
  ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]), "Polygon rings must be closed.");
export const CatalogInputsV2 = {
  ...CrewInputsV2,
  ...FleetInputsV2,
  preferences: z.object({ ...Base, objective: RankingObjectiveV2Schema.nullable(),
    maximumWaitMinutes: z.number().int().nonnegative().max(525600).nullable(),
    preferredMode: TransportModeV2Schema.nullable(), preferredEquipment: EquipmentCodeV2Schema.nullable(),
    usualBudget: Money.nullable(), validUntil: Instant.nullable() }).strict(),
  "cargo-profiles": z.object({ ...Base, name: Name, categoryId: Id,
    typicalUnits: z.array(CargoUnitTemplateV2Schema).max(100), requirements: Strings,
    preferredEquipment: EquipmentCodeV2Schema.nullable(), active: z.boolean() }).strict(),
  "cargo-categories": z.object({ ...Base, code: Code, name: Name, guidance: Guidance,
    suggestedEquipment: EquipmentCodeV2Schema.nullable(), active: z.boolean() }).strict(),
  carriers: z.object({ ...Base, code: Code, commercialName: Name, legalName: Name.nullable(),
    businessIdType: Text.nullable(), businessIdValue: Text.nullable(),
    registeredCountry: z.string().regex(/^[A-Z]{2}$/).nullable(),
    providerType: z.enum(["OWNER_OPERATOR", "SMALL_FLEET", "CARRIER", "ENTERPRISE_CARRIER"]),
    status: Status, operationalPhone: z.string().regex(/^\+[1-9]\d{6,14}$/).nullable(),
  }).strict().refine(x => (x.businessIdType === null) === (x.businessIdValue === null), "Paired business identifiers required."),
  depots: z.object({ ...Base, code: Code, name: Name,
    location: CanonicalLocationV2Schema.omit({ facilityId: true }),
    active: z.boolean(), handling: Strings }).strict()
    .refine(x => (x.location.lat === null) === (x.location.lng === null), "Coordinates required together."),
  services: z.object({ ...Base, mode: TransportModeV2Schema, serviceClass: z.enum(["FTL", "LTL"]),
    maxWeightKg: z.number().positive().nullable(), maxVolumeM3: z.number().positive().nullable(),
    responseChannels: z.array(z.enum(["MANUAL", "API", "MCP"])).min(1).max(3)
      .refine(x => new Set(x).size === x.length), status: Status,
    admittedCargoTypes: z.array(Id).max(100).refine(x => new Set(x).size === x.length),
    temperatureRange: Temperature.nullable(), requiredCertifications: Strings,
    supportsHazardous: z.boolean(), supportsFragile: z.boolean(), supportsOversized: z.boolean(),
  }).strict(),
  areas: z.object({ ...Base, role: z.enum(["PICKUP", "DELIVERY"]), inclusion: z.enum(["INCLUDE", "EXCLUDE"]),
    geography: z.object({ granularity: z.enum(["COUNTRY", "REGION", "CITY", "POSTAL_CODE", "POLYGON", "POINTS"]),
      countryCode: z.string().regex(/^[A-Z]{2}$/), region: Text.nullable(), city: Text.nullable(),
      postalCode: Text.nullable(), geometry: CoverageGeometryV2Schema.nullable().optional() }).strict().refine(x =>
        x.granularity === "POLYGON" || x.granularity === "POINTS"
          ? x.geometry?.type === (x.granularity === "POLYGON" ? "Polygon" : "MultiPoint")
            && !x.region && !x.city && !x.postalCode : !x.geometry && (
        x.granularity === "COUNTRY" ? !x.region && !x.city && !x.postalCode :
        x.granularity === "REGION" ? !!x.region && !x.city && !x.postalCode :
        x.granularity === "CITY" ? !!x.city && !x.postalCode : !!x.postalCode), "Invalid geography shape."),
    source: z.enum(["OWN", "PARTNER"]), partnerId: Id.nullable(), ...Window, active: z.boolean(),
  }).strict().refine(x => (x.source === "OWN") === (x.partnerId === null), "Partner source requires partner.")
    .refine(validWindow, "Invalid validity window."),
  lanes: z.object({ ...Base, pickupAreaId: Id, deliveryAreaId: Id, kind: z.enum(["DIRECT", "WITHIN_AREA"]),
    mode: TransportModeV2Schema, borderReviewRequired: z.boolean(), ...Window, active: z.boolean(),
    plannedTransitMinutes: z.number().int().positive().nullable(),
    transitProvenanceStatus: z.enum(["VERIFIED", "ESTIMATED", "SIMULATED", "UNKNOWN"]),
    crossBorderProhibited: z.boolean(), crossBorderProhibitionReference: Text.nullable(),
  }).strict().refine(validWindow, "Invalid validity window.")
    .refine(x => x.pickupAreaId !== x.deliveryAreaId, "Directed endpoints must differ.")
    .refine(x => !x.crossBorderProhibited || !!x.crossBorderProhibitionReference, "Prohibition requires evidence.")
    .refine(x => (x.plannedTransitMinutes === null) === (x.transitProvenanceStatus === "UNKNOWN"), "Transit requires provenance."),
  partners: z.object({ ...Base, registeredName: Name, partnerCarrierRef: Id.nullable(),
    agreementValidFrom: Instant, agreementValidUntil: Instant, status: Status, coverageEvidence: Text,
  }).strict().refine(x => Date.parse(x.agreementValidUntil) > Date.parse(x.agreementValidFrom), "Invalid agreement window."),
} as const;
export type CatalogKindV2 = keyof typeof CatalogInputsV2;
export const CargoCategoryValueV2Schema = CatalogInputsV2["cargo-categories"].extend({
  version: z.string().regex(/^[1-9]\d*$/),
});
export type CatalogValueV2 = z.infer<(typeof CatalogInputsV2)[CatalogKindV2]>;
export const CatalogScopeV2Schema = z.object({ carrierId: Id.nullable(), serviceId: Id.nullable() }).strict();
export type CatalogScopeV2 = z.infer<typeof CatalogScopeV2Schema>;
export const CatalogRecordV2Schema = z.object({ id: Id, organizationId: Id.nullable(),
  carrierId: Id.nullable(), serviceId: Id.nullable(), version: z.number().int().positive(),
  verifiedContact: z.object({ name: Name, email: z.string().email().nullable(),
    phoneE164: z.string().regex(/^\+[1-9]\d{6,14}$/).nullable() }).strict().nullable().optional(),
  createdAt: Instant, updatedAt: Instant, value: z.unknown() }).strict();
export type CatalogRecordV2 = Omit<z.infer<typeof CatalogRecordV2Schema>, "value"> & {
  value: CatalogValueV2 | z.infer<typeof CargoCategoryValueV2Schema>
    | z.infer<(typeof FleetOutputsV2)[keyof typeof FleetOutputsV2]> };
export function parseCatalogRecordV2(kind: CatalogKindV2, raw: unknown): CatalogRecordV2 {
  const record = CatalogRecordV2Schema.parse(raw);
  const output = kind === "cargo-categories" ? CargoCategoryValueV2Schema
    : kind in FleetOutputsV2 ? FleetOutputsV2[kind as keyof typeof FleetOutputsV2] : CatalogInputsV2[kind];
  // Old idempotency receipts preserve their original result. Project the
  // domain revision from their authoritative technical revision when absent.
  const value = kind === "cargo-categories" && record.value !== null
    && typeof record.value === "object" && !("version" in record.value)
    ? { ...record.value, version: String(record.version) } : record.value;
  return { ...record, value: output.parse(value) };
}

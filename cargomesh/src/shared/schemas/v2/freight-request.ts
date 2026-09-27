import { z } from "zod";
import { CargoCategoryCodeV2Schema, RoadEquipmentCodeV2Schema } from "./intake-options";

const UtcInstant = z.string().datetime({ offset: true });
const Uuid = z.string().uuid();

export const TimeWindowV2Schema = z.object({
  startsAt: UtcInstant,
  endsAt: UtcInstant,
}).strict().refine((window) => Date.parse(window.startsAt) < Date.parse(window.endsAt), {
  message: "endsAt must be after startsAt",
  path: ["endsAt"],
});

/** A facility id is an assertion; the server resolves the canonical location. */
export const LocationInputV2Schema = z.object({
  facilityId: Uuid.optional(),
  label: z.string().trim().min(1).max(200).optional(),
  countryCode: z.string().regex(/^[A-Z]{2}$/).optional(),
  region: z.string().trim().max(120).nullable().optional(),
  city: z.string().trim().min(1).max(120).optional(),
  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),
}).strict().superRefine((location, context) => {
  if (!location.facilityId && (!location.label || !location.countryCode || !location.city)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "facilityId or a complete manual location is required" });
  }
  if ((location.lat == null) !== (location.lng == null)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "lat and lng must be supplied together" });
  }
});

export const CanonicalLocationV2Schema = z.object({
  facilityId: Uuid.nullable(),
  label: z.string().min(1),
  countryCode: z.string().regex(/^[A-Z]{2}$/),
  region: z.string().nullable(),
  city: z.string().min(1),
  lat: z.number().min(-90).max(90).nullable(),
  lng: z.number().min(-180).max(180).nullable(),
}).strict();

const CargoUnitV2Schema = z.object({
  packageType: z.string().trim().min(1),
  quantity: z.number().int().positive(),
  weightPerUnitKg: z.number().positive(),
  volumePerUnitM3: z.number().positive(),
  dimensionsCm: z.object({
    length: z.number().positive(),
    width: z.number().positive(),
    height: z.number().positive(),
  }).strict(),
  indivisible: z.boolean(),
  stackable: z.boolean(),
}).strict();

export const CargoSpecificationV2Schema = z.object({
  categoryCode: CargoCategoryCodeV2Schema,
  description: z.string().trim().min(1).max(1000),
  packaging: z.string().trim().min(1),
  totalWeightKg: z.number().positive(),
  totalVolumeM3: z.number().positive(),
  divisible: z.boolean(),
  requirements: z.array(z.string().trim().min(1)),
  temperatureRange: z.object({
    minCelsius: z.number(),
    maxCelsius: z.number(),
  }).strict().refine((range) => range.maxCelsius >= range.minCelsius).nullable().optional(),
  units: z.array(CargoUnitV2Schema).min(1),
}).strict();

const ShipmentContactV2Schema = z.object({
  name: z.string().trim().min(1).max(150),
  phoneE164: z.string().regex(/^\+[1-9]\d{6,14}$/),
  email: z.string().email().nullable().optional(),
}).strict();

const ShipmentContactsV2Schema = z.object({
  pickup: ShipmentContactV2Schema,
  recipient: ShipmentContactV2Schema,
}).strict();

const UsdBudgetV2Schema = z.object({
  amount: z.number().positive(),
  currency: z.literal("USD"),
}).strict();

export const CreateFreightRequestV2InputSchema = z.object({
  schemaVersion: z.literal("2.0"),
  /** Optional guard only; the effective tenant always comes from the actor. */
  organizationId: Uuid.optional(),
  origin: LocationInputV2Schema,
  destination: LocationInputV2Schema,
  pickupWindow: TimeWindowV2Schema,
  deliveryWindow: TimeWindowV2Schema,
  acceptedModes: z.tuple([z.literal("ROAD")]),
  requiredEquipment: RoadEquipmentCodeV2Schema.nullable().optional(),
  cargoSpecification: CargoSpecificationV2Schema,
  contacts: ShipmentContactsV2Schema,
  budget: UsdBudgetV2Schema.nullable().optional(),
}).strict().refine((request) =>
  Date.parse(request.deliveryWindow.endsAt) > Date.parse(request.pickupWindow.startsAt), {
  message: "delivery window must end after pickup starts",
  path: ["deliveryWindow"],
});

export const FreightRequestV2ResponseSchema = z.object({
  schemaVersion: z.literal("2.0"),
  data: z.object({
    id: Uuid,
    referenceCode: z.string().min(1),
    organizationId: Uuid,
    status: z.literal("DRAFT"),
    draftVersion: z.number().int().positive(),
    origin: CanonicalLocationV2Schema,
    destination: CanonicalLocationV2Schema,
    pickupWindow: TimeWindowV2Schema,
    deliveryWindow: TimeWindowV2Schema,
    acceptedModes: z.tuple([z.literal("ROAD")]),
    requiredEquipment: z.string().nullable(),
    cargoSpecification: CargoSpecificationV2Schema,
    contacts: ShipmentContactsV2Schema,
    budget: UsdBudgetV2Schema.nullable(),
    createdAt: UtcInstant,
    updatedAt: UtcInstant,
  }).strict(),
  meta: z.object({
    idempotentReplay: z.boolean(),
    environmentProfile: z.literal("v2-clean"),
  }).strict(),
}).strict();

export const ErrorEnvelopeV2Schema = z.object({
  schemaVersion: z.literal("2.0"),
  error: z.object({
    code: z.string().min(1),
    message: z.string().min(1),
    details: z.record(z.unknown()).optional(),
    retryable: z.boolean(),
  }).strict(),
}).strict();

export type CreateFreightRequestV2Input = z.infer<typeof CreateFreightRequestV2InputSchema>;
export type FreightRequestV2Response = z.infer<typeof FreightRequestV2ResponseSchema>;
export type CanonicalLocationV2 = z.infer<typeof CanonicalLocationV2Schema>;

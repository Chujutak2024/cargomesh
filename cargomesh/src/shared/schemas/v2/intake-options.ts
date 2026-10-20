import { z } from "zod";

export const StandardCargoCategoryCodesV2 = [
  "GENERAL", "FOOD", "PHARMA", "CHEMICAL", "MACHINERY",
  "CONSTRUCTION", "AGRICULTURAL", "LIQUID",
] as const;
/** The database is the category catalog; the initial eight are not an allowlist. */
export const CargoCategoryCodeV2Schema = z.string().regex(/^[A-Z][A-Z0-9_]{0,99}$/);

/** ROAD request vocabulary; these are selectable types, not available assets. */
export const RoadEquipmentCodeV2Schema = z.enum([
  "BOX_TRUCK", "REEFER_TRUCK", "FLATBED", "TANKER_TRUCK", "TRACTOR_TRAILER",
]);

/** Capture vocabularies; listing a code does not verify a carrier capability. */
export const PackagingCodeV2Schema = z.enum(["PALLET", "BOX", "CRATE", "DRUM", "BULK"]);
export const RequirementCodeV2Schema = z.enum([
  "TEMP_CONTROLLED", "SECURITY_SEAL", "FRAGILE", "HAZARDOUS",
  "KEEP_DRY", "FOOD_GRADE", "HIGH_VALUE", "OVERSIZED", "TANK_COMPATIBILITY",
]);
/** These codes have a resource-level evidence check in the Sprint 2 ROAD evaluator. */
export const ResourceEvidenceRequirementCodesV2 = ["TEMP_CONTROLLED", "SECURITY_SEAL"] as const;

/** Shared capture catalog. An option never asserts operational verification. */
export const RoadEquipmentOptionsV2 = [
  { code: "BOX_TRUCK", label: "Camión furgón", mode: "ROAD" },
  { code: "REEFER_TRUCK", label: "Camión refrigerado", mode: "ROAD" },
  { code: "FLATBED", label: "Plataforma", mode: "ROAD" },
  { code: "TANKER_TRUCK", label: "Camión cisterna", mode: "ROAD" },
  { code: "TRACTOR_TRAILER", label: "Tracto y semirremolque", mode: "ROAD" },
] as const;

export const PackagingOptionsV2 = [
  { code: "PALLET", labelEs: "Pallet", labelEn: "Pallet" },
  { code: "BOX", labelEs: "Caja", labelEn: "Box" },
  { code: "CRATE", labelEs: "Cajón", labelEn: "Crate" },
  { code: "DRUM", labelEs: "Tambor", labelEn: "Drum" },
  { code: "BULK", labelEs: "Granel", labelEn: "Bulk" },
] as const;

export const RequirementOptionsV2 = [
  { code: "TEMP_CONTROLLED", labelEs: "Temperatura controlada", labelEn: "Temperature controlled" },
  { code: "SECURITY_SEAL", labelEs: "Sello de seguridad", labelEn: "Security seal" },
  { code: "FRAGILE", labelEs: "Carga frágil", labelEn: "Fragile cargo" },
  { code: "HAZARDOUS", labelEs: "Material peligroso", labelEn: "Hazardous material" },
  { code: "KEEP_DRY", labelEs: "Mantener seco", labelEn: "Keep dry" },
  { code: "FOOD_GRADE", labelEs: "Apto para alimentos", labelEn: "Food grade" },
  { code: "HIGH_VALUE", labelEs: "Alto valor", labelEn: "High value" },
  { code: "OVERSIZED", labelEs: "Sobredimensionado", labelEn: "Oversized" },
  { code: "TANK_COMPATIBILITY", labelEs: "Compatibilidad de cisterna", labelEn: "Tank compatibility" },
] as const;

/** Normalize only equivalent names. Specialized equipment is never downgraded. */
export function canonicalRoadRecommendationsV2(value: unknown): unknown {
  if (!Array.isArray(value) || !value.every((code) => typeof code === "string" && code.length > 0)) {
    return value; // Preserve invalid guidance so response validation fails closed.
  }
  return [...new Set(value.map((code) => code === "REFRIGERATED_TRUCK" ? "REEFER_TRUCK" : code)
    .filter((code) => RoadEquipmentCodeV2Schema.safeParse(code).success))];
}

const CaptureOptionV2Schema = z.object({
  code: z.string().min(1),
  labelEs: z.string().min(1),
  labelEn: z.string().min(1),
});

export const IntakeOptionsV2ResponseSchema = z.object({
  schemaVersion: z.literal("2.0"),
  data: z.object({
    facilities: z.array(z.object({
      id: z.string().uuid(),
      code: z.string().min(1),
      label: z.string().min(1),
      countryCode: z.string().length(2),
      region: z.string().nullable(),
      city: z.string().min(1),
      lat: z.number().min(-90).max(90).nullable(),
      lng: z.number().min(-180).max(180).nullable(),
    })),
    cargoCategories: z.array(z.object({
      id: z.string().uuid(),
      code: CargoCategoryCodeV2Schema,
      name: z.string().min(1),
      guidance: z.object({
        recommendedEntryMethods: z.array(z.string().min(1)).min(1),
        intakeSpecificationSchema: z.record(z.unknown()),
        suggestedRequirements: z.record(z.unknown()),
        recommendedVehicleClasses: z.array(z.string().min(1)),
      }),
    })),
    equipmentOptions: z.array(z.object({
      code: RoadEquipmentCodeV2Schema,
      label: z.string().min(1),
      mode: z.literal("ROAD"),
    })),
    packagingOptions: z.array(CaptureOptionV2Schema.extend({
      code: PackagingCodeV2Schema,
      verification: z.literal("CAPTURE_ONLY"),
    })),
    requirementOptions: z.array(CaptureOptionV2Schema.extend({
      code: RequirementCodeV2Schema,
      verification: z.enum(["RESOURCE_EVIDENCE", "REQUIRES_REVIEW"]),
    })),
  }),
});

export type IntakeOptionsV2Response = z.infer<typeof IntakeOptionsV2ResponseSchema>;

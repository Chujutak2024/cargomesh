import { z } from "zod";

export const CargoCategoryCodeV2Schema = z.enum([
  "GENERAL", "FOOD", "PHARMA", "CHEMICAL", "MACHINERY",
  "CONSTRUCTION", "AGRICULTURAL", "LIQUID",
]);

/** ROAD request vocabulary; these are selectable types, not available assets. */
export const RoadEquipmentCodeV2Schema = z.enum([
  "BOX_TRUCK", "REEFER_TRUCK", "FLATBED", "TANKER_TRUCK", "TRACTOR_TRAILER",
]);

/** Capture vocabularies; listing a code does not verify a carrier capability. */
export const PackagingCodeV2Schema = z.enum(["PALLET", "BOX", "CRATE", "DRUM", "BULK"]);
export const RequirementCodeV2Schema = z.enum([
  "TEMP_CONTROLLED", "SECURITY_SEAL", "FRAGILE", "HAZARDOUS",
]);
/** These codes have a resource-level evidence check in the Sprint 2 ROAD evaluator. */
export const ResourceEvidenceRequirementCodesV2 = ["TEMP_CONTROLLED", "SECURITY_SEAL"] as const;

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

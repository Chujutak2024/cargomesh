import { z } from "zod";

export const CargoCategoryCodeV2Schema = z.enum([
  "GENERAL", "FOOD", "PHARMA", "CHEMICAL", "MACHINERY",
  "CONSTRUCTION", "AGRICULTURAL", "LIQUID",
]);

/** ROAD request vocabulary; these are selectable types, not available assets. */
export const RoadEquipmentCodeV2Schema = z.enum([
  "BOX_TRUCK", "REEFER_TRUCK", "FLATBED", "TANKER_TRUCK", "TRACTOR_TRAILER",
]);

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
  }),
});

export type IntakeOptionsV2Response = z.infer<typeof IntakeOptionsV2ResponseSchema>;

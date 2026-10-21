import { ServiceClassV2Schema } from "@/shared/schemas/v2/freight-request";

type GuidanceCatalog = {
  cargoCategories: ReadonlyArray<{code:string;name:string;guidance:{recommendedVehicleClasses:string[]}}>;
  equipmentOptions: ReadonlyArray<{code:string;label:string}>;
  packagingOptions: ReadonlyArray<{code:string;labelEs:string;labelEn:string}>;
  requirementOptions: ReadonlyArray<{code:string;labelEs:string;labelEn:string;verification:string}>;
};

/** Native intake vocabulary and category guidance; never a list of available assets or offers. */
export function buildVoiceIntakeCatalog(catalog: GuidanceCatalog) {
  const equipment = catalog.equipmentOptions.slice(0, 30);
  const knownEquipment = new Set(equipment.map(item => String(item.code)));
  return {
    complete: catalog.cargoCategories.length <= 16 && catalog.equipmentOptions.length <= 30,
    scope: "ROAD_INTAKE_VOCABULARY" as const,
    availabilityConfirmed: false,
    categories: catalog.cargoCategories.slice(0, 16).map(item => ({
      code: item.code, label: item.name.slice(0, 100),
      recommendedEquipment: item.guidance.recommendedVehicleClasses.filter(code => knownEquipment.has(code)).slice(0, 8),
    })),
    equipment: equipment.map(item => ({code: item.code, label: item.label.slice(0, 100)})),
    serviceTypes: ServiceClassV2Schema.options.map(code => ({
      code, meaning: code === "FTL" ? "Exclusive truck capacity for this shipment" : "Shared truck capacity with other shipments",
      automaticQuotationImplemented: code === "FTL",
    })),
    packaging: catalog.packagingOptions.map(item => ({code:item.code, labelEs:item.labelEs, labelEn:item.labelEn})),
    requirements: catalog.requirementOptions.map(item => ({code:item.code, labelEs:item.labelEs, labelEn:item.labelEn, verification:item.verification})),
  };
}

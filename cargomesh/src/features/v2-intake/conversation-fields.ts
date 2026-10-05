import type { IntakeOptionsData } from "./contracts";
import type { V2IntakePrototypeDraft } from "./prototype-model";

export type ConversationField = keyof V2IntakePrototypeDraft;
const ENGLISH_EQUIPMENT_LABELS: Record<string, string> = {
  BOX_TRUCK: "Box truck", REFRIGERATED_TRUCK: "Refrigerated truck", SECURE_BOX_TRUCK: "Secure box truck",
  HAZMAT_TRUCK: "Hazmat truck", FLATBED: "Flatbed truck", DUMP_TRUCK: "Dump truck",
  TANKER_TRUCK: "Tanker truck", TRACTOR_TRAILER: "Tractor trailer",
};
const ENGLISH_CATEGORY_LABELS: Record<string, string> = {
  GENERAL: "General cargo", FOOD: "Food", PHARMA: "Pharmaceuticals", CHEMICAL: "Chemicals",
  MACHINERY: "Machinery", CONSTRUCTION: "Construction materials", AGRICULTURAL: "Agricultural goods", LIQUID: "Liquids",
};
export const CONVERSATION_FIELDS = [
  "originFacilityId", "destinationFacilityId", "categoryCode", "packaging", "cargoDescription",
  "unitQuantity", "unitWeightPerUnitKg", "unitVolumePerUnitM3", "unitLengthCm", "unitWidthCm",
  "unitHeightCm", "pickupWindowStartsAt", "pickupWindowEndsAt", "deliveryWindowStartsAt",
  "deliveryWindowEndsAt", "requiredEquipment", "pickupContactName", "pickupContactPhoneE164",
  "pickupContactEmail", "recipientContactName", "recipientContactPhoneE164", "recipientContactEmail",
] as const satisfies readonly ConversationField[];
export type GuidedConversationField = (typeof CONVERSATION_FIELDS)[number];

export const FIELD_QUESTION: Record<ConversationField, string> = {
  originFacilityId: "¿Dónde se recogerá la carga?",
  destinationFacilityId: "¿Dónde se entregará la carga?",
  categoryCode: "¿Qué tipo de carga transportarás?",
  packaging: "¿Cómo está embalada la carga?",
  cargoDescription: "Describe la carga.", totalWeightKg: "¿Peso total en kg?",
  totalVolumeM3: "¿Volumen total en m³?", divisible: "¿La carga es divisible? sí/no",
  requirements: "¿Algún requisito especial?", temperatureMinCelsius: "¿Temperatura mínima en °C?",
  temperatureMaxCelsius: "¿Temperatura máxima en °C?", unitPackageType: "¿Tipo de empaque por unidad?",
  unitQuantity: "¿Cuántas unidades son?", unitWeightPerUnitKg: "¿Peso por unidad en kg?",
  unitVolumePerUnitM3: "¿Volumen por unidad en m³?", unitLengthCm: "¿Largo por unidad en cm?",
  unitWidthCm: "¿Ancho por unidad en cm?", unitHeightCm: "¿Alto por unidad en cm?",
  unitIndivisible: "¿Cada unidad es indivisible? sí/no", unitStackable: "¿Se pueden apilar las unidades? sí/no",
  pickupWindowStartsAt: "¿Cuándo inicia la ventana de recojo? Usa AAAA-MM-DDTHH:mm.",
  pickupWindowEndsAt: "¿Cuándo termina la ventana de recojo? Usa AAAA-MM-DDTHH:mm.",
  deliveryWindowStartsAt: "¿Cuándo inicia la ventana de entrega? Usa AAAA-MM-DDTHH:mm.",
  deliveryWindowEndsAt: "¿Cuándo termina la ventana de entrega? Usa AAAA-MM-DDTHH:mm.",
  requiredEquipment: "¿Qué camión o equipo necesitas?",
  pickupContactName: "¿Nombre del contacto de recojo?", pickupContactPhoneE164: "¿Teléfono de recojo en formato E.164?",
  pickupContactEmail: "¿Correo del contacto de recojo?", recipientContactName: "¿Nombre de quien recibe?",
  recipientContactPhoneE164: "¿Teléfono de quien recibe en formato E.164?", recipientContactEmail: "¿Correo de quien recibe?",
};

export function choicesForField(field: ConversationField, options: IntakeOptionsData): Array<{ value: string; label: string }> {
  if (field === "originFacilityId" || field === "destinationFacilityId") {
    return options.facilities.map((facility) => ({ value: facility.facilityId, label: facility.label }));
  }
  const list = field === "categoryCode" ? options.cargoCategories
    : field === "packaging" ? options.packagingOptions
    : field === "requiredEquipment" ? options.equipmentOptions : [];
  return list.map((item) => ({ value: item.code, label: field === "requiredEquipment" ? ENGLISH_EQUIPMENT_LABELS[item.code] ?? item.labelEn
    : field === "categoryCode" ? ENGLISH_CATEGORY_LABELS[item.code] ?? item.labelEn : item.labelEn }));
}

export function matchingConversationChoices(field: ConversationField, input: string, options: IntakeOptionsData): Array<{ value: string; label: string }> {
  const search = input.trim().toLowerCase();
  if (!search) return [];
  if (field === "originFacilityId" || field === "destinationFacilityId") {
    return options.facilities.filter((facility) => [facility.facilityId, facility.code, facility.label, facility.city]
      .some((value) => value?.toLowerCase() === search || value?.toLowerCase().includes(search)))
      .map((facility) => ({ value: facility.facilityId, label: facility.label.includes("[SYNTHETIC]")
        ? `${facility.city} · synthetic test facility (${facility.code})` : `${facility.label} · ${facility.city}` }));
  }
  const singular = search.endsWith("s") ? search.slice(0, -1) : search;
  const spanishAliases: Record<string, string[]> = {
    GENERAL: ["carga general"], FOOD: ["alimentos", "comida"], PHARMA: ["farmacéutica", "farmaceutica", "medicinas"],
    CHEMICAL: ["químicos", "quimicos"], MACHINERY: ["maquinaria"], CONSTRUCTION: ["materiales de construcción", "construcción"],
    AGRICULTURAL: ["agrícola", "agricola", "productos agrícolas", "productos agricolas"], LIQUID: ["líquidos", "liquidos"],
    BOX: ["caja", "cajas"], PALLET: ["pallet", "pallets", "palet", "palets"], CRATE: ["cajón", "cajon", "cajones"],
  };
  return choicesForField(field, options).filter((choice) => choice.value.toLowerCase() === search || choice.label.toLowerCase() === search || choice.label.toLowerCase() === singular || choice.label.toLowerCase().includes(search) || (spanishAliases[choice.value] ?? []).includes(search));
}

export function parseConversationField(field: ConversationField, input: string, options: IntakeOptionsData): string | null {
  const value = input.trim();
  if (!value) return null;
  const choices = choicesForField(field, options);
  if (choices.length) {
    const byNumber = choices[Number(value) - 1];
    const matches = matchingConversationChoices(field, value, options);
    return byNumber?.value ?? (matches.length === 1 ? matches[0].value : null);
  }
  if (["unitQuantity"].includes(field) && (!Number.isInteger(Number(value)) || Number(value) <= 0)) return null;
  if (["unitWeightPerUnitKg", "unitVolumePerUnitM3", "unitLengthCm", "unitWidthCm", "unitHeightCm"].includes(field)
    && (!Number.isFinite(Number(value)) || Number(value) <= 0)) return null;
  if (field.endsWith("At") && Number.isNaN(Date.parse(value))) return null;
  return value;
}

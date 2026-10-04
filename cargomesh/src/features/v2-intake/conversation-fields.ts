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
  originFacilityId: "Where should the freight be picked up?",
  destinationFacilityId: "Where should it be delivered?",
  categoryCode: "What kind of cargo are you shipping?",
  packaging: "How is the cargo packaged?",
  cargoDescription: "Describe the cargo.", totalWeightKg: "Total weight in kg?",
  totalVolumeM3: "Total volume in m³?", divisible: "Is the cargo divisible? yes/no",
  requirements: "Any special requirements?", temperatureMinCelsius: "Minimum temperature in °C?",
  temperatureMaxCelsius: "Maximum temperature in °C?", unitPackageType: "Unit package type?",
  unitQuantity: "How many units?", unitWeightPerUnitKg: "Weight per unit in kg?",
  unitVolumePerUnitM3: "Volume per unit in m³?", unitLengthCm: "Unit length in cm?",
  unitWidthCm: "Unit width in cm?", unitHeightCm: "Unit height in cm?",
  unitIndivisible: "Is each unit indivisible? yes/no", unitStackable: "Are units stackable? yes/no",
  pickupWindowStartsAt: "Pickup window start? Use YYYY-MM-DDTHH:mm.",
  pickupWindowEndsAt: "Pickup window end? Use YYYY-MM-DDTHH:mm.",
  deliveryWindowStartsAt: "Delivery window start? Use YYYY-MM-DDTHH:mm.",
  deliveryWindowEndsAt: "Delivery window end? Use YYYY-MM-DDTHH:mm.",
  requiredEquipment: "What truck or equipment do you need?",
  pickupContactName: "Pickup contact name?", pickupContactPhoneE164: "Pickup phone in E.164 format?",
  pickupContactEmail: "Pickup contact email?", recipientContactName: "Recipient name?",
  recipientContactPhoneE164: "Recipient phone in E.164 format?", recipientContactEmail: "Recipient email?",
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
  return choicesForField(field, options).filter((choice) => choice.value.toLowerCase() === search || choice.label.toLowerCase() === search || choice.label.toLowerCase() === singular || choice.label.toLowerCase().includes(search));
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

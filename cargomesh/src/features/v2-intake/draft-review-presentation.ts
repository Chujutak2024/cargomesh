import type { IntakeOptionsData } from "./contracts";
import type { V2IntakePrototypeDraft } from "./prototype-model";

const labels: Partial<Record<keyof V2IntakePrototypeDraft, [string, string]>> = {
  originFacilityId: ["Origen", "Pickup facility"], destinationFacilityId: ["Destino", "Delivery facility"],
  urgency: ["Prioridad", "Priority"], loadSize: ["Tamaño de carga", "Load size"], planningTimeZone: ["Zona horaria", "Time zone"],
  categoryCode: ["Categoría", "Cargo category"], packaging: ["Embalaje", "Packaging"], cargoDescription: ["Mercancía", "Cargo description"],
  unitPackageType: ["Embalaje del grupo 1", "Group 1 packaging"],
  unitQuantity: ["Unidades", "Quantity"], unitWeightPerUnitKg: ["Peso por unidad (kg)", "Weight per unit (kg)"],
  unitVolumePerUnitM3: ["Volumen por unidad (m³)", "Volume per unit (m³)"],
  totalWeightKg: ["Peso total (kg)", "Total weight (kg)"], totalVolumeM3: ["Volumen total (m³)", "Total volume (m³)"],
  unitLengthCm: ["Largo por unidad (cm)", "Unit length (cm)"], unitWidthCm: ["Ancho por unidad (cm)", "Unit width (cm)"], unitHeightCm: ["Alto por unidad (cm)", "Unit height (cm)"],
  pickupWindowStartsAt: ["Recojo desde", "Pickup from"], pickupWindowEndsAt: ["Recojo hasta", "Pickup until"],
  deliveryWindowStartsAt: ["Entrega desde", "Delivery from"], deliveryWindowEndsAt: ["Entrega hasta", "Delivery until"],
  requiredEquipment: ["Equipo", "Required equipment"], requirements: ["Requisitos", "Requirements"],
  pickupContactName: ["Contacto de recojo", "Pickup contact"], pickupContactPhoneE164: ["Teléfono de recojo", "Pickup phone"], pickupContactEmail: ["Correo de recojo", "Pickup email"],
  recipientContactName: ["Persona que recibe", "Recipient contact"], recipientContactPhoneE164: ["Teléfono de entrega", "Recipient phone"], recipientContactEmail: ["Correo de entrega", "Recipient email"],
  temperatureMinCelsius: ["Temperatura mínima (°C)", "Minimum temperature (°C)"], temperatureMaxCelsius: ["Temperatura máxima (°C)", "Maximum temperature (°C)"],
  divisible: ["Carga divisible", "Cargo divisible"], unitIndivisible: ["Unidad indivisible", "Unit indivisible"], unitStackable: ["Apilable", "Unit stackable"],
};

/** Only reviewable business fields, never UI IDs, object coercions or hidden group indices. */
export function draftReviewRows(draft: V2IntakePrototypeDraft, options: IntakeOptionsData, language: "es" | "en" = "en") {
  const es = language === "es", yesNo = (value: boolean) => value ? es ? "Sí" : "Yes" : "No";
  const optionLabel = (code: string, choices: IntakeOptionsData["packagingOptions"]) => {
    const option = choices.find(item => item.code === code);
    return option ? es ? option.labelEs : option.labelEn : code;
  };
  const rows: Array<{ label: string; value: string }> = [];
  for (const field of Object.keys(labels) as Array<keyof V2IntakePrototypeDraft>) {
    const value = draft[field];
    if (value === undefined || value === "" || (Array.isArray(value) && value.length === 0)) continue;
    if (field === "unitPackageType" && value === draft.packaging) continue;
    let text: string;
    if (field === "originFacilityId" || field === "destinationFacilityId") {
      const facility = options.facilities.find(item => item.facilityId === value);
      text = facility ? `${facility.label}, ${facility.city}` : es ? "Sede por validar" : "Facility needs validation";
    } else if (field === "requirements") text = draft.requirements.map(code => optionLabel(code, options.requirementOptions)).join(", ");
    else if (field === "categoryCode") text = optionLabel(String(value), options.cargoCategories);
    else if (field === "packaging" || field === "unitPackageType") text = optionLabel(String(value), options.packagingOptions);
    else if (field === "requiredEquipment") text = optionLabel(String(value), options.equipmentOptions);
    else if (field === "urgency") text = value === "URGENT" ? es ? "Urgente" : "Urgent" : value === "SCHEDULED" ? es ? "Programada" : "Scheduled" : String(value);
    else if (field === "loadSize") text = ({ LIGHT: es ? "Liviana" : "Light", MEDIUM: es ? "Mediana" : "Medium", HEAVY: es ? "Pesada" : "Heavy" } as Record<string, string>)[String(value)] ?? String(value);
    else text = typeof value === "boolean" ? yesNo(value) : String(value).replace("T", field.endsWith("At") ? " " : "T");
    rows.push({ label: labels[field]![es ? 0 : 1], value: text });
  }
  for (const [index, group] of (draft.additionalUnits ?? []).entries()) {
    rows.push({ label: `${es ? "Grupo de carga" : "Cargo group"} ${index + 2}`, value:
      `${group.unitQuantity} × ${optionLabel(group.unitPackageType, options.packagingOptions)} · ${group.unitWeightPerUnitKg} kg/${es ? "unidad" : "unit"} · ${group.unitVolumePerUnitM3} m³/${es ? "unidad" : "unit"} · ${group.unitLengthCm} × ${group.unitWidthCm} × ${group.unitHeightCm} cm · ${es ? "Indivisible" : "Indivisible"}: ${yesNo(group.unitIndivisible)} · ${es ? "Apilable" : "Stackable"}: ${yesNo(group.unitStackable)}` });
  }
  for (const [kind, windows] of [["pickup", draft.pickupAlternatives], ["delivery", draft.deliveryAlternatives]] as const) {
    for (const [index, window] of (windows ?? []).entries()) rows.push({
      label: `${kind === "pickup" ? es ? "Recojo alternativo" : "Alternative pickup" : es ? "Entrega alternativa" : "Alternative delivery"} ${index + 1}`,
      value: `${window.startsAt.replace("T", " ")} → ${window.endsAt.replace("T", " ")}`,
    });
  }
  return rows;
}

import type { IntakeOptionsData } from "./contracts";
import type { V2IntakePrototypeDraft } from "./prototype-model";
import type { GuidedConversationField } from "./conversation-fields";
import { questionForField } from "./conversation-fields";

/** Ground fallback guidance in the current tenant's selector options, not model guesses. */
export function contextualHelpReply(
  draft: V2IntakePrototypeDraft,
  options: IntakeOptionsData,
  nextField: GuidedConversationField | null,
  question = "",
  language: "es" | "en" = "en",
): string | null {
  if (language === "es") {
    const categoryQuestion = /categor[ií]a|tipo de carga|peligros|mercanc[ií]a|qu[eé] contiene/i.test(question);
    if (categoryQuestion) return `Cuéntame qué producto transportas y si necesita cuidados especiales. Un pallet es el soporte, no el tipo de mercancía. Las categorías disponibles son: ${options.cargoCategories.map(item => item.labelEs).join(", ")}. No confirmaré material peligroso sin aclarar el producto.`;
    if (/equipo|cami[oó]n/i.test(question)) return `Podemos revisar estos equipos del catálogo: ${options.equipmentOptions.map(item => item.labelEs).join(", ")}. Son tipos admitidos, no camiones con capacidad confirmada. ¿Qué producto y tamaño tiene tu carga?`;
    const count = Number(draft.unitQuantity), weight = Number(draft.unitWeightPerUnitKg);
    const summary = count > 0 ? `${count} unidades${weight > 0 ? `, ${Number((count * weight).toFixed(6))} kg en total` : ""}. ` : "";
    if (draft.packaging === "PALLET" && !draft.cargoDescription) return `${summary}¿Los pallets van vacíos o llevan mercancía? Si llevan mercancía, ¿qué contienen?`;
    const next = nextField ? questionForField(nextField, "es-PE") : "¿Revisamos el resumen antes de guardar?";
    return `${summary}Te ayudaré paso a paso y revisaremos los datos antes de guardar. ${next}`;
  }
  const labels = [
    ["pickup", draft.originFacilityId],
    ["delivery", draft.destinationFacilityId],
  ].flatMap(([kind, id]) => {
    if (!id) return [];
    const facility = options.facilities.find((item) => item.facilityId === id);
    return facility ? [`${kind} at ${facility.city}`] : [];
  });
  const empty = !labels.length && !draft.categoryCode && !draft.unitQuantity;
  if (draft.categoryCode) labels.push(`cargo category ${draft.categoryCode.toLowerCase()}`);
  if (draft.unitQuantity) labels.push(`${draft.unitQuantity} unit(s)`);
  const next = nextField
    ? questionForField(nextField, "en-US")
    : "Would you like to review every detail before saving the draft?";
  const asksHowTo = /\b(?:make|create|start|prepare|submit|hacer|crear|empezar|preparar)\b.*\b(?:request|draft|solicitud|borrador)\b/i.test(question);
  return empty
    ? asksHowTo
      ? "Absolutely. Tell me what you need to ship and where it needs to go. I’ll help fill in the missing details, show you the complete request for approval, and only save it when you confirm. What are you shipping?"
      : "I can help you put together a ROAD freight request, one step at a time. We’ll review the details before saving anything, then I can check preliminary ROAD options. What are you planning to ship?"
    : `So far I have ${labels.join(", ")}. We can keep building the request, and you’ll review it before anything is saved. ${next}`;
}

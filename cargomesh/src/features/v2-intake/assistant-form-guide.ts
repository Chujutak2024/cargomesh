import { displayDemoText } from "@/shared/lib/demo-presentation";
import type { IntakeOptionsData } from "./contracts";
import { questionForField, CONVERSATION_FIELDS, type GuidedConversationField } from "./conversation-fields";
import { validatePrototypeStep, type PrototypeStep, type V2IntakePrototypeDraft } from "./prototype-model";
import type { DraftField } from "./use-assistant-change-feedback";

type Translate = (es: string, en: string) => string;
export const ASSISTANT_ADVANCE_MS = 1400;
export function intakeStepLabels(t: Translate) {
  return [t("Sedes", "Facilities"), t("Carga y unidades", "Cargo & units"), t("Ventanas y contactos", "Windows & contacts"), t("Crear y evaluar", "Create & evaluate")];
}

/** Use the form's real validators, including quantities, contacts and chronological windows. */
export function assistantFormProgress(draft: V2IntakePrototypeDraft, options?: IntakeOptionsData) {
  const sections = ([1, 2, 3] as const).map(step => ({ step, issues: validatePrototypeStep(step, draft) }));
  if (options) for (const field of ["originFacilityId", "destinationFacilityId"] as const) {
    if (draft[field] && !options.facilities.some(f => f.facilityId === draft[field])) sections[0].issues.push({field,code:"required"});
  }
  return { sections, nextStep: (sections.find(section => section.issues.length)?.step ?? 4) as PrototypeStep };
}
export function assistantNextField(draft: V2IntakePrototypeDraft): GuidedConversationField | null {
  const progress = assistantFormProgress(draft);
  if (progress.nextStep >= 3) {
    const unanswered = (["divisible","unitIndivisible","unitStackable","requirements"] as const).find(field => !draft.reviewedConversationFields?.includes(field));
    if (unanswered) return unanswered;
  }
  const issues = progress.sections.find(section => section.step === progress.nextStep)?.issues ?? [];
  return issues.map(issue => issue.field).find(field => (CONVERSATION_FIELDS as readonly string[]).includes(field)||field==='pickupContactEmail'||field==='recipientContactEmail') as GuidedConversationField | undefined ?? null;
}
export function assistantNextStep(step: PrototypeStep, draft: V2IntakePrototypeDraft, options: IntakeOptionsData | null): PrototypeStep {
  if (!options || step === 4 || !options.facilities.some(f => f.facilityId === draft.originFacilityId)
    || !options.facilities.some(f => f.facilityId === draft.destinationFacilityId)) return step;
  const next = assistantFormProgress(draft).nextStep;
  return next > step ? next : step;
}
export function assistantNextQuestion(draft: V2IntakePrototypeDraft, t: Translate, options?: IntakeOptionsData) {
  const { sections, nextStep } = assistantFormProgress(draft, options);
  const next=assistantNextField(draft);
  if(next&&["divisible","unitIndivisible","unitStackable","requirements"].includes(next))return questionForField(next,t("es","en")==="es"?"es-PE":"en-US");
  if (nextStep === 4) return t("Revisa el resumen y confirma cuando estés listo para guardar.", "Review the summary and confirm when you are ready to save.");
  const field = sections.find(section => section.step === nextStep)!.issues[0].field;
  if ((CONVERSATION_FIELDS as readonly string[]).includes(field)||field==='pickupContactEmail'||field==='recipientContactEmail') return questionForField(field as GuidedConversationField, t("es", "en") === "es" ? "es-PE" : "en-US");
  if (field === "additionalUnits") return t("Revisa las cantidades y medidas de todos los grupos de carga.", "Review quantities and measurements for every cargo group.");
  if (field === "pickupAlternatives" || field === "deliveryAlternatives") return t("Aclaremos las fechas y las ventanas de recojo y entrega.", "Let's clarify pickup and delivery dates and time windows.");
  if (field === "temperatureMinCelsius" || field === "temperatureMaxCelsius") return t("¿Qué rango de temperatura necesita la carga?", "What temperature range does the cargo need?");
  return t("Revisa los datos pendientes de este apartado.", "Review the remaining details in this section.");
}

/** Only committed changes become receipts; no model proposals or business-success claims. */
export function assistantAppliedDetails(draft: V2IntakePrototypeDraft, fields: readonly DraftField[], options: IntakeOptionsData, t: Translate) {
  const changed = new Set(fields), rows: Array<{ label: string; value: string }> = [];
  const add = (label: string, value: string) => { if (value) rows.push({ label, value }); };
  if (changed.has("originFacilityId") || changed.has("destinationFacilityId")) {
    const place = (id: string) => { const f = options.facilities.find(f => f.facilityId === id); return f ? `${f.city} · ${f.code}` : t("Por elegir", "Not selected"); };
    add(t("Ruta anotada", "Route noted"), `${place(draft.originFacilityId)} → ${place(draft.destinationFacilityId)}`);
  }
  if (changed.has("cargoDescription")) add(t("Producto", "Product"), displayDemoText(draft.cargoDescription));
  if (changed.has("categoryCode")) add(t("Categoría", "Category"), options.cargoCategories.find(c => c.code === draft.categoryCode)?.[t("es", "en") === "es" ? "labelEs" : "labelEn"] ?? draft.categoryCode);
  if (fields.some(f => /unit|total|packaging/i.test(f))) add(t("Carga anotada", "Cargo noted"), [draft.unitQuantity && `${draft.unitQuantity} × ${options.packagingOptions.find(p=>p.code===draft.packaging)?.[t("es", "en") === "es" ? "labelEs" : "labelEn"] ?? draft.packaging ?? t("unidades", "units")}`, draft.unitWeightPerUnitKg && `${draft.unitWeightPerUnitKg} kg/${t("unidad", "unit")}`, [draft.unitLengthCm,draft.unitWidthCm,draft.unitHeightCm].every(Boolean) && `${draft.unitLengthCm} × ${draft.unitWidthCm} × ${draft.unitHeightCm} cm/${t("unidad", "unit")}`, draft.totalVolumeM3 && `${draft.totalVolumeM3} m³ ${t("total", "total")}`].filter(Boolean).join(" · "));
  for (const [role, label] of [["pickup", t("Recojo", "Pickup")], ["delivery", t("Entrega", "Delivery")]] as const) {
    if (fields.some(f => f.startsWith(`${role}Window`))) add(label, [draft[`${role}WindowStartsAt`], draft[`${role}WindowEndsAt`]].filter(Boolean).join(" → "));
  }
  if (changed.has("requiredEquipment")) add(t("Equipo", "Equipment"), options.equipmentOptions.find(e => e.code === draft.requiredEquipment)?.[t("es", "en") === "es" ? "labelEs" : "labelEn"] ?? draft.requiredEquipment);
  if (fields.some(f => /Contact/.test(f))) add(t("Contactos", "Contacts"), t("Datos de contacto actualizados", "Contact details updated"));
  return rows;
}

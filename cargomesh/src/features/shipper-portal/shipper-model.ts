import type { FreightRequestV2Data } from "@/features/v2-intake/contracts";
import type { CreateFreightRequestV2Input } from "@/shared/schemas/v2/freight-request";
import { EquipmentCodeV2Schema } from "@/shared/schemas/v2/freight-request";
import { WorkflowRecordV2Schema } from "@/shared/schemas/v2/workflow";
import type { z } from "zod";

export type WorkflowRecordV2 = z.infer<typeof WorkflowRecordV2Schema>;

export function bookingStatusPresentation(status: Extract<WorkflowRecordV2, { kind: "bookings" }>["data"]["carrierConfirmationStatus"], locale: "es" | "en") {
  const index = locale === "es" ? 0 : 1;
  const content = {
    PENDING: { label: ["Pendiente del carrier", "Awaiting carrier"], tone: "pending", consequence: ["Autorización registrada; aún no es transporte confirmado.", "Authorization recorded; not yet confirmed transport."] },
    CONFIRMED: { label: ["Confirmada por carrier", "Carrier confirmed"], tone: "positive", consequence: ["Confirmación del carrier registrada.", "Carrier confirmation recorded."] },
    REJECTED: { label: ["Rechazada por carrier", "Carrier rejected"], tone: "danger", consequence: ["Esta reserva no se ejecutará. Otra alternativa requiere una decisión y autorización nuevas.", "This booking will not proceed. Another option requires a new decision and authorization."] },
    CANCELLED: { label: ["Cancelada", "Cancelled"], tone: "danger", consequence: ["No se crea otra reserva automáticamente.", "No replacement booking is created automatically."] },
  } as const;
  const item = content[status];
  return { label: item.label[index], tone: item.tone, consequence: item.consequence[index] };
}

export function executionActionLabel(action: Extract<WorkflowRecordV2, { kind: "execution-events" }>["data"]["action"], locale: "es" | "en") {
  const labels = {
    "executions.start": ["Transporte iniciado", "Transport started"],
    "executions.position": ["Posición reportada", "Position reported"],
    "executions.complete": ["Entrega completada", "Delivery completed"],
    "executions.cancel": ["Ejecución cancelada", "Execution cancelled"],
  } as const;
  return labels[action][locale === "es" ? 0 : 1];
}

export const REQUEST_STATUS_ORDER: FreightRequestV2Data["status"][] = [
  "DRAFT", "PENDING", "ORCHESTRATING", "AWAITING_SELECTION", "BOOKING", "BOOKED", "FAILED", "CANCELLED",
];

export function requestStatusLabel(status: FreightRequestV2Data["status"], locale: "es" | "en" = "es") {
  const labels: Record<FreightRequestV2Data["status"], [string, string]> = {
    DRAFT: ["Borrador", "Draft"], PENDING: ["Pendiente", "Pending"],
    ORCHESTRATING: ["Buscando alternativas", "Finding alternatives"],
    AWAITING_SELECTION: ["Esperando selección", "Awaiting selection"],
    BOOKING: ["Confirmando reserva", "Confirming booking"], BOOKED: ["Reservada", "Booked"],
    FAILED: ["Fallida", "Failed"], CANCELLED: ["Cancelada", "Cancelled"],
  };
  return labels[status][locale === "es" ? 0 : 1];
}

export function requestStatusTone(status: FreightRequestV2Data["status"]) {
  if (status === "BOOKED") return "positive";
  if (status === "FAILED" || status === "CANCELLED") return "danger";
  if (status === "DRAFT") return "neutral";
  return "pending";
}

export function requestToRevisionInput(request: FreightRequestV2Data): CreateFreightRequestV2Input {
  const preferredEquipment = request.preferredEquipment ? EquipmentCodeV2Schema.safeParse(request.preferredEquipment) : null;
  const requiredEquipment = request.requiredEquipment ? EquipmentCodeV2Schema.safeParse(request.requiredEquipment) : null;
  return {
    schemaVersion: "2.0",
    origin: request.origin,
    destination: request.destination,
    pickupWindow: request.pickupWindow,
    deliveryWindow: request.deliveryWindow,
    acceptedModes: request.acceptedModes,
    serviceType: request.serviceType,
    selectionObjective: request.selectionObjective ?? undefined,
    preferredEquipment: preferredEquipment?.success ? preferredEquipment.data : null,
    requiredEquipment: requiredEquipment?.success ? requiredEquipment.data : null,
    cargoSpecification: request.cargoSpecification,
    contacts: request.contacts,
    budget: request.budget,
  };
}

export function latestRecord<T extends WorkflowRecordV2>(records: T[]) {
  return [...records].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))[0] ?? null;
}

export function formatMass(weightKg: number, locale = "es-PE") {
  return weightKg >= 1000
    ? `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(weightKg / 1000)} t`
    : `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(weightKg)} kg`;
}

export function formatDateTime(value: string | null | undefined, locale = "es-PE") {
  if (!value) return locale.startsWith("es") ? "Desconocido" : "Unknown";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return locale.startsWith("es") ? "Desconocido" : "Unknown";
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(parsed);
}


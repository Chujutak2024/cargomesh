import type { FreightRequestV2Data } from "@/features/v2-intake/contracts";
import type { CreateFreightRequestV2Input } from "@/shared/schemas/v2/freight-request";
import { EquipmentCodeV2Schema } from "@/shared/schemas/v2/freight-request";
import { WorkflowRecordV2Schema } from "@/shared/schemas/v2/workflow";
import type { z } from "zod";

export type WorkflowRecordV2 = z.infer<typeof WorkflowRecordV2Schema>;

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

export function executionProgress(status: string, events: WorkflowRecordV2[]) {
  if (status === "COMPLETED") return 100;
  if (status === "CANCELLED") return 0;
  const eventActions = events.flatMap((event) => event.kind === "execution-events" ? [event.data.action] : []);
  if (eventActions.includes("executions.complete")) return 100;
  if (eventActions.includes("executions.position")) return 58;
  if (eventActions.includes("executions.start")) return 22;
  return 0;
}


import {workspaceFetch} from "@/features/workspace-mode/workspace-fetch";
import { z } from "zod";
import { WorkflowRecordV2Schema } from "@/shared/schemas/v2/workflow";

const List = z.object({ schemaVersion: z.literal("2.0"), data: z.array(WorkflowRecordV2Schema),
  meta: z.object({ nextOffset: z.number().int().nonnegative().nullable() }).passthrough() });
export type WorkflowChatRecord = z.infer<typeof WorkflowRecordV2Schema>;

export async function readRequestWorkflow(requestId: string, kind: "offers" | "bookings" | "executions", fetcher: typeof fetch = workspaceFetch): Promise<WorkflowChatRecord[]> {
  const path = kind === "offers" ? `/api/v2/freight/requests/${encodeURIComponent(requestId)}/offers` : `/api/v2/${kind}`;
  const records: WorkflowChatRecord[] = [];
  let offset: number | null = 0;
  for (let page = 0; offset !== null && page < 20; page++) {
    const response = await fetcher(`${path}?limit=100&offset=${offset}`, { credentials: "same-origin", cache: "no-store" });
    if (!response.ok) throw new Error(response.status === 401 ? "Please sign in again to continue." : response.status === 403 ? "Your organization is not authorized to view this workflow." : "I could not load the current workflow. Please retry.");
    const result = List.parse(await response.json());
    records.push(...result.data.filter((record) => record.kind === kind && record.requestId === requestId));
    if (result.meta.nextOffset === offset) throw new Error("The workflow pagination did not advance. Please retry.");
    offset = result.meta.nextOffset;
  }
  if (offset !== null) throw new Error("There are more workflow records than this view can verify. Open the full workflow to review them.");
  return records;
}

export async function readCargoReadiness(requestId: string, version: number, fetcher: typeof fetch = workspaceFetch) {
  const { CargoReadinessV2ResponseSchema } = await import("@/shared/schemas/v2/cargo-readiness");
  z.string().uuid().parse(requestId); z.number().int().positive().parse(version);
  const response = await fetcher(`/api/v2/freight/requests/${requestId}/cargo-readiness?expectedDraftVersion=${version}`, { credentials: "same-origin", cache: "no-store" });
  if (!response.ok) throw new Error(response.status === 409 ? "La versión cambió. Recarga la solicitud antes de revisarla." : "No se pudo comprobar la solicitud. Reintenta con tu sesión activa.");
  const result = CargoReadinessV2ResponseSchema.parse(await response.json()).data;
  if (result.freightRequestId !== requestId || result.evaluatedDraftVersion !== version) throw new Error("INVALID_READINESS_SCOPE");
  return result;
}

export function summarizeCargoReadiness(result: Awaited<ReturnType<typeof readCargoReadiness>>, language: "es" | "en") {
  const fields = result.missingFields.map(field => field === "cargoSpecification.temperatureRange" ? (language === "es" ? "rango de temperatura" : "temperature range") : field).join(", ");
  return language === "es"
    ? `${result.captureStatus === "COMPLETE" ? "La captura de carga está completa." : `Falta completar: ${fields}.`} Peso total: ${result.totals.weightKg} kg; volumen: ${result.totals.volumeM3} m³. Esto no confirma disponibilidad, precio ni reserva.`
    : `${result.captureStatus === "COMPLETE" ? "Cargo capture is complete." : `Please complete: ${fields}.`} Total weight: ${result.totals.weightKg} kg; volume: ${result.totals.volumeM3} m³. This does not confirm availability, price or booking.`;
}

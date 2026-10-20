import type { FreightRequestV2Data } from "@/features/v2-intake/contracts";
import type { WorkflowRecordV2 } from "./shipper-model";
type CommercialEvent = { row: Extract<WorkflowRecordV2,{kind:"decisions"|"bookings"}>; request: FreightRequestV2Data;
  at: string; type: "selection" | "authorization" | "response" };
export function commercialHistory(requests: FreightRequestV2Data[], rows: WorkflowRecordV2[]): CommercialEvent[] {
  const byId = new Map(requests.map(request => [request.id,request]));
  return rows.flatMap<CommercialEvent>(row => {
    const request = row.requestId ? byId.get(row.requestId) : null;
    if (!request || row.organizationId !== request.organizationId) return [];
    if (row.kind === "decisions") return [{ row, request, at: row.data.selectedAt, type: "selection" }];
    if (row.kind === "bookings") return [{ row, request, at: row.data.authorizedAt, type: "authorization" },
      ...(row.status !== "AUTHORIZED" ? [{ row, request, at: row.updatedAt, type: "response" as const }] : [])];
    return [];
  }).sort((a,b) => Date.parse(b.at)-Date.parse(a.at) || a.row.id.localeCompare(b.row.id));
}

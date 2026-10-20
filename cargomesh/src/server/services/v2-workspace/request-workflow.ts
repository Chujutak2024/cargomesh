import type { WorkflowRecordV2 } from "@/features/shipper-portal/shipper-model";
import { OperationsReadContractError, type OperationsCollection } from "./operations-collection";

type Kind = "executions" | "incidents" | "holds";
type Record = WorkflowRecordV2;
/** Native executions ignores requestId: always traverse an authorized parent, never weaken scope checks. */
export async function readRequestChildren(kind: Kind, parents: Record[], organizationId: string, requestId: string,
  read: (kind: Kind, parentId: string) => Promise<OperationsCollection<Record>>): Promise<OperationsCollection<Record>> {
  const data: Record[] = [], seen = new Set<string>();
  let complete = parents.length <= 25, error: OperationsCollection<Record>["error"] = null;
  // Bound fan-out; a larger request is explicitly partial, not silently empty/complete.
  for (const parent of parents.slice(0, 25)) {
    if (parent.organizationId !== organizationId || parent.requestId !== requestId
      || parent.kind !== (kind === "incidents" ? "executions" : "bookings")) {
      throw new OperationsReadContractError("Invalid request parent.");
    }
    const result = await read(kind, parent.id);
    complete &&= result.complete; error ??= result.error;
    for (const row of result.data) {
      // Incident DTO omits parentId; its native parent-scoped query supplies that authority.
      const parentId = row.kind === "incidents" ? parent.id
        : row.kind === "executions" || row.kind === "holds" ? row.data.bookingId : null;
      if (row.kind !== kind || row.organizationId !== organizationId || row.requestId !== requestId
        || row.carrierId !== parent.carrierId || parentId !== parent.id || seen.has(row.id)) {
        throw new OperationsReadContractError("Invalid request child correlation.");
      }
      seen.add(row.id); data.push(row);
    }
  }
  return { data, complete, error, offset: 0, batchSize: 500, nextOffset: null };
}

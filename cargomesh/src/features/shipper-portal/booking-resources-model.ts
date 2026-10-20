import type { WorkflowRecordV2 } from "./shipper-model";
type Booking = Extract<WorkflowRecordV2,{kind:"bookings"}>;
export function bookingResources(booking: Booking, rows: WorkflowRecordV2[], complete: boolean) {
  const related = rows.filter(row => (row.kind === "holds" || row.kind === "executions") && row.data.bookingId === booking.id);
  const scoped = related.filter(row => row.organizationId === booking.organizationId && row.requestId === booking.requestId && row.carrierId === booking.carrierId);
  return { complete: complete && related.length === scoped.length,
    holds: scoped.filter(row => row.kind === "holds"), executions: scoped.filter(row => row.kind === "executions") };
}

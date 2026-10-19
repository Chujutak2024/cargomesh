import { listWorkspaceRequests, listWorkspaceWorkflow } from "@/server/demo/workspace-demo-server";
import { TrackingList } from "@/features/shipper-portal/tracking-list";
import { loadTrackingItems } from "@/features/shipper-portal/tracking-read-model";
import type { Booking, Execution } from "@/features/shipper-portal/tracking-journey";

export const dynamic = "force-dynamic";
export default async function TrackingPage() {
  const [records, bookingRecords, requests] = await Promise.all([
    listWorkspaceWorkflow("executions"), listWorkspaceWorkflow("bookings"), listWorkspaceRequests(),
  ]);
  const executions = records.filter((item): item is Execution => item.kind === "executions");
  const bookings = bookingRecords.filter((item): item is Booking => item.kind === "bookings");
  const items = await loadTrackingItems(executions, bookings, requests, listWorkspaceWorkflow);
  return <TrackingList items={items}/>;
}

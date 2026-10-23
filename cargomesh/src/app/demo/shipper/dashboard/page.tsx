import { listWorkspaceFacilities, listWorkspaceRequests, listWorkspaceWorkflow } from "@/server/demo/workspace-demo-server";
import { ClientDashboard } from "@/features/shipper-portal/client-dashboard";
import { getRequestLocale } from "@/server/i18n/server";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [requests, bookings, executions, facilities, locale] = await Promise.all([
    listWorkspaceRequests(), listWorkspaceWorkflow("bookings"), listWorkspaceWorkflow("executions"), listWorkspaceFacilities(), getRequestLocale(),
  ]);
  const active = requests.filter(request => !["BOOKED", "FAILED", "CANCELLED"].includes(request.status)).length;
  return <ClientDashboard requests={requests} complete unavailable={false} locale={locale}
    counts={{ requests: String(requests.length), active: String(active), bookings: String(bookings.length), executions: String(executions.length), facilities: String(facilities.length) }}/>;
}

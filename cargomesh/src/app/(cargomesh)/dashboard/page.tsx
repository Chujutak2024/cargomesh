import { operationsReader } from "@/server/services/v2-workspace/operations-server";
import { operationsCount, operationsReadIssues } from "@/server/services/v2-workspace/operations-collection";
import { OperationsReadNotice } from "@/features/shipper-portal/operations-navigation";
import { ClientDashboard } from "@/features/shipper-portal/client-dashboard";
import { getRequestLocale } from "@/server/i18n/server";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const reader = await operationsReader();
  const [requests, bookings, executions, facilities, locale] = await Promise.all([
    reader.requests(), reader.workflow("bookings"), reader.workflow("executions"), reader.facilities(), getRequestLocale(),
  ]);
  const active = { ...requests, data: requests.data.filter(request => !["BOOKED", "FAILED", "CANCELLED"].includes(request.status)) };
  return <ClientDashboard requests={requests.data} complete={requests.complete} unavailable={!!requests.error} locale={locale}
    counts={{ requests: operationsCount(requests), active: operationsCount(active), bookings: operationsCount(bookings), executions: operationsCount(executions), facilities: operationsCount(facilities) }}
    readNotice={<OperationsReadNotice issues={operationsReadIssues({ requests, bookings, executions, facilities })}/>}/>;
}

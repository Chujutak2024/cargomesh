import type { DashboardActivityItem } from "./client-dashboard-model";

export type DashboardActivityFilter = "ALL" | "DRAFT" | "PENDING";

/** Browser filtering needs no domain schemas, formatters or server read dependencies. */
export function filterDashboardActivity(items: DashboardActivityItem[], filter: DashboardActivityFilter) {
  return items.filter(item => filter === "ALL" || (filter === "DRAFT" ? item.status === "DRAFT"
    : ["PENDING", "ORCHESTRATING", "AWAITING_SELECTION", "BOOKING"].includes(item.status)));
}

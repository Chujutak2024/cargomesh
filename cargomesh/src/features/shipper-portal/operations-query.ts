import {displayReference} from '@/shared/lib/display-identity';
import type { FreightRequestV2Data } from "@/features/v2-intake/contracts";

export const operationStatuses = ["ALL", "DRAFT", "PENDING", "ORCHESTRATING", "AWAITING_SELECTION", "BOOKING", "BOOKED", "FAILED", "CANCELLED"] as const;
export const operationSorts = ["UPDATED_DESC", "UPDATED_ASC", "PICKUP_ASC"] as const;
export type OperationsView = "requests" | "bookings" | "history";
export type OperationsQuery = {
  q: string; status: typeof operationStatuses[number]; sort: typeof operationSorts[number];
  from: string; to: string; selected: string; offset: number; view: OperationsView;
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function date(value: string | null) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value))
    && new Date(value).toISOString().slice(0, 10) === value ? value : "";
}
export function parseOperationsQuery(params: Pick<URLSearchParams, "get">): OperationsQuery {
  const status = params.get("status"), sort = params.get("sort"), view = params.get("view"), selected = params.get("selected") ?? "";
  const offset = Number(params.get("offset") ?? 0), from = date(params.get("from")), to = date(params.get("to"));
  return { q: (params.get("q") ?? "").slice(0, 200),
    status: operationStatuses.find(value => value === status) ?? "ALL",
    sort: operationSorts.find(value => value === sort) ?? "UPDATED_DESC",
    from, to: to && (!from || to >= from) ? to : "", selected: uuid.test(selected) ? selected : "",
    offset: Number.isInteger(offset) && offset >= 0 && offset <= 100000 ? offset : 0,
    view: view === "bookings" || view === "history" ? view : "requests" };
}
export function operationsSearch(query: OperationsQuery) {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.status !== "ALL") params.set("status", query.status);
  if (query.sort !== "UPDATED_DESC") params.set("sort", query.sort);
  if (query.from) params.set("from", query.from);
  if (query.to) params.set("to", query.to);
  if (query.selected) params.set("selected", query.selected);
  if (query.offset) params.set("offset", String(query.offset));
  if (query.view !== "requests") params.set("view", query.view);
  const value = params.toString();
  return value ? `?${value}` : "";
}
export function operationView(path: string): OperationsView {
  return path.includes("/history") ? "history" : path.includes("/bookings") ? "bookings" : "requests";
}
export function operationDetailHref(id: string, query: OperationsQuery, view: OperationsView) {
  return `/requests/${encodeURIComponent(id)}${operationsSearch({ ...query, view, selected: id })}`;
}

/** Next 15 copies its own router markers. Passing __NA/_N back skips its URL notification. */
export function operationsHistoryState(state: unknown): Record<string, unknown> {
  if (!state || typeof state !== "object") return {};
  return Object.fromEntries(Object.entries(state).filter(([key]) => !["__NA", "_N", "__PRIVATE_NEXTJS_INTERNALS_TREE"].includes(key)));
}

export function filterOperationRequests(requests: FreightRequestV2Data[], query: OperationsQuery, localeTag: string,
  formattedDate: (value: string) => string) {
  const needle = query.q.trim().toLocaleLowerCase(localeTag);
  return requests.filter(request => (query.status === "ALL" || request.status === query.status)
    && (!query.from || new Date(request.updatedAt).toISOString().slice(0, 10) >= query.from)
    && (!query.to || new Date(request.updatedAt).toISOString().slice(0, 10) <= query.to)
    && (!needle || [request.referenceCode, displayReference(request.referenceCode,'PED',request.id), request.origin.label, request.destination.label, request.origin.city,
      request.destination.city, request.cargoSpecification.description, request.status, request.updatedAt,
      formattedDate(request.updatedAt)].some(value => value.toLocaleLowerCase(localeTag).includes(needle))))
    .sort((left, right) => (query.sort === "PICKUP_ASC" ? Date.parse(left.pickupWindow.startsAt) - Date.parse(right.pickupWindow.startsAt)
      : query.sort === "UPDATED_ASC" ? Date.parse(left.updatedAt) - Date.parse(right.updatedAt)
      : Date.parse(right.updatedAt) - Date.parse(left.updatedAt)) || left.id.localeCompare(right.id));
}

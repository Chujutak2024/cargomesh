import { buildTrackingJourney, type Booking, type Execution, type ExecutionEvent, type Incident, type JourneyStageKey, type JourneyStageState } from "./tracking-journey";

export type TrackingTranslate = (es: string, en: string) => string;
export type TrackingListItem = { execution: Execution; booking: Booking | null; events: ExecutionEvent[]; incidents: Incident[]; reference: string; corridor: string };
export type TrackingFilter = "all" | "active" | "attention" | "completed";

export function stageName(key: JourneyStageKey, t: TrackingTranslate) {
  const labels: Record<JourneyStageKey, [string, string]> = {
    booking: ["Reserva", "Booking"], preparation: ["Preparación", "Preparation"], pickup: ["Recojo", "Pickup"],
    departure: ["Salida", "Departure"], transit: ["En tránsito", "In transit"], checkpoint: ["Control", "Checkpoint"],
    arrival: ["Llegada", "Arrival"], reception: ["Recepción", "Reception"], delivery: ["Entrega", "Delivery"],
  };
  return t(...labels[key]);
}
export function stageStateName(state: JourneyStageState, t: TrackingTranslate) {
  const labels = { completed: ["Reportado", "Reported"], current: ["Actual", "Current"], future: ["Sin reporte", "Awaiting report"], unknown: ["No verificable", "Unverified"], blocked: ["Revisar", "Needs review"] } as const;
  return t(labels[state][0], labels[state][1]);
}
export function provenanceName(value: string, t: TrackingTranslate) {
  const labels: Record<string, [string, string]> = { VERIFIED: ["Verificado", "Verified"], ESTIMATED: ["Estimado", "Estimated"], SIMULATED: ["Simulado", "Simulated"], UNKNOWN: ["Sin verificar", "Unverified"] };
  return labels[value] ? t(...labels[value]) : value;
}
export function trackingStatus(execution: Execution, booking: Booking | null, events: ExecutionEvent[], incidents: Incident[], t: TrackingTranslate) {
  const journey = buildTrackingJourney(execution, booking, events, incidents);
  if (journey.cancelled) return { label: t("Cancelado", "Cancelled"), tone: "blocked" };
  if (journey.bookingBlocked) return { label: t("Reserva no vigente", "Booking not active"), tone: "blocked" };
  if (journey.completed) return { label: t("Entrega reportada", "Delivery reported"), tone: "completed" };
  if (journey.criticalOpen) return { label: t("Requiere atención", "Needs attention"), tone: "blocked" };
  if (journey.lastReportedStage === "transit") return { label: t("En tránsito", "In transit"), tone: "current" };
  if (journey.lastReportedStage === "departure" || execution.status === "IN_PROGRESS") return { label: t("Transporte iniciado", "Transport started"), tone: "current" };
  if (execution.status === "CREATED") return { label: t("Por iniciar", "Awaiting departure"), tone: "future" };
  return { label: t("Estado por verificar", "Status unverified"), tone: "unknown" };
}
export function matchesTrackingFilter(item: TrackingListItem, filter: TrackingFilter) {
  const journey = buildTrackingJourney(item.execution, item.booking, item.events, item.incidents);
  if (filter === "attention") return journey.openIncidents > 0 || journey.cancelled || journey.bookingBlocked;
  if (filter === "completed") return journey.completed && !journey.cancelled;
  if (filter === "active") return !journey.completed && !journey.cancelled && !journey.bookingBlocked
    && (item.execution.status === "CREATED" || item.execution.status === "IN_PROGRESS"
      || journey.lastReportedStage === "departure" || journey.lastReportedStage === "transit");
  return true;
}
export function filterTrackingItems(items: TrackingListItem[], query: string, filter: TrackingFilter, sort: "recent" | "oldest") {
  const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const search = normalize(query.trim());
  return items.filter((item) => matchesTrackingFilter(item, filter) && normalize(`${item.reference} ${item.corridor} ${item.execution.id} ${item.execution.data.lastKnownPosition?.label ?? ""}`).includes(search))
    .sort((a, b) => {
      const at = buildTrackingJourney(a.execution, a.booking, a.events, a.incidents).lastUpdatedAt;
      const bt = buildTrackingJourney(b.execution, b.booking, b.events, b.incidents).lastUpdatedAt;
      // Unknown timestamps sort last in either direction.
      if (!at || !bt) return at ? -1 : bt ? 1 : a.execution.id.localeCompare(b.execution.id);
      return (Date.parse(bt) - Date.parse(at)) * (sort === "recent" ? 1 : -1);
    });
}

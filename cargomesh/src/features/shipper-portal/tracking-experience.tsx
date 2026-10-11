import { AlertTriangle, ArrowRight, CalendarClock, Check, CircleHelp, MapPin, Navigation2, ShieldCheck, Truck } from "lucide-react";
import Link from "next/link";
import { executionActionLabel, formatDateTime } from "./shipper-model";
import { buildTrackingJourney, type Booking, type Execution, type ExecutionEvent, type Incident, type JourneyStageKey, type JourneyStageState } from "./tracking-journey";
import s from "./tracking-experience.module.css";

type T = (es: string, en: string) => string;

function stageName(key: JourneyStageKey, t: T) {
  const labels: Record<JourneyStageKey, [string, string]> = {
    booking: ["Reserva", "Booking"], preparation: ["Preparación", "Preparation"], pickup: ["Recojo", "Pickup"],
    departure: ["Salida", "Departure"], transit: ["En tránsito", "In transit"], checkpoint: ["Puntos de control", "Checkpoints"],
    arrival: ["Llegada", "Arrival"], reception: ["Recepción", "Reception"], delivery: ["Entrega", "Delivery"],
  };
  return t(...labels[key]);
}

function stateName(state: JourneyStageState, t: T) {
  const labels: Record<JourneyStageState, [string, string]> = {
    completed: ["Reportado", "Reported"], current: ["Actual / pendiente", "Current / pending"], future: ["Por reportar", "Awaiting report"],
    unknown: ["Sin hito verificable", "No verifiable milestone"], blocked: ["Requiere revisión", "Needs review"],
  };
  return t(...labels[state]);
}

export function TrackingOverviewCard({ execution, booking, events, incidents, reference, corridor, t, tag }: {
  execution: Execution; booking: Booking | null; events: ExecutionEvent[]; incidents: Incident[];
  reference: string; corridor: string; t: T; tag: string;
}) {
  const journey = buildTrackingJourney(execution, booking, events, incidents);
  const reported = journey.lastReportedStage;
  return <article className={s.overviewCard}>
    <div className={s.overviewTop}><span className={s.overviewIcon}><Truck size={20} aria-hidden="true"/></span><div><small>{t("Transporte", "Transport")}</small><h3>{reference}</h3></div><span className={s.statePill} data-state={journey.cancelled || journey.bookingBlocked ? "blocked" : journey.completed ? "completed" : journey.criticalOpen ? "blocked" : "current"}>{journey.cancelled ? t("Cancelado", "Cancelled") : journey.bookingBlocked ? t("Reserva no vigente", "Booking not active") : journey.completed ? t("Entregado", "Delivered") : journey.criticalOpen ? t("Revisar incidencia", "Review incident") : reported ? stageName(reported, t) : t("Sin reporte", "No report")}</span></div>
    <p className={s.corridor}>{corridor}</p>
    <div className={s.miniJourney} aria-label={t("Hitos reportados; no posición GPS", "Reported milestones; not GPS position")}>
      {(["booking", "departure", "transit", "delivery"] as JourneyStageKey[]).map((key) => { const stage = journey.stages.find((item) => item.key === key)!; return <div className={s.miniStep} data-state={stage.state} key={key}><span>{key === reported ? <Truck size={13} aria-hidden="true"/> : stage.state === "completed" ? <Check size={13} aria-hidden="true"/> : null}</span><small>{stageName(key, t)}</small></div>; })}
    </div>
    <div className={s.overviewFoot}><span><MapPin size={14} aria-hidden="true"/> {execution.data.lastKnownPosition?.label ?? t("Ubicación no reportada", "Location not reported")}</span><span>{formatDateTime(execution.updatedAt, tag)}</span></div>
    <Link className={s.actionLink} href={`/tracking/${execution.id}`}>{t("Abrir seguimiento", "Open tracking")}<ArrowRight size={16} aria-hidden="true"/></Link>
  </article>;
}

export function TrackingJourneyPanel({ execution, booking, events, incidents, t, tag }: {
  execution: Execution; booking: Booking | null; events: ExecutionEvent[]; incidents: Incident[]; t: T; tag: string;
}) {
  const journey = buildTrackingJourney(execution, booking, events, incidents);
  return <section className={s.panel} aria-labelledby="tracking-journey-title">
    <div className={s.panelHeading}><div><span className={s.eyebrow}>{t("Secuencia del transporte", "Transport sequence")}</span><h2 id="tracking-journey-title">{t("Así avanza tu carga", "Your shipment journey")}</h2><p>{t("Los hitos marcados provienen del servicio V2. Los pasos sin evento propio permanecen sin verificar.", "Marked milestones come from the V2 service. Steps without their own event remain unverified.")}</p></div><Navigation2 size={21} aria-hidden="true"/></div>
    <div className={s.signalBar}><span className={s.signalIcon}><Truck size={20} aria-hidden="true"/></span><div><strong>{journey.cancelled ? t("Ejecución cancelada", "Execution cancelled") : journey.completed ? t("Entrega reportada", "Delivery reported") : journey.criticalOpen ? t("Incidencia crítica abierta", "Open critical incident") : journey.lastReportedStage ? `${t("Último hito", "Last milestone")}: ${stageName(journey.lastReportedStage, t)}` : t("Esperando el primer reporte", "Waiting for the first report")}</strong><small>{t("El camión marca un hito discreto, no se mueve como GPS en tiempo real.", "The truck marks a discrete milestone; it is not live GPS movement.")}</small></div></div>
    <ol className={s.journeyList}>{journey.stages.map((stage) => <li className={s.journeyStage} data-state={stage.state} key={stage.key}><span className={s.stageSymbol}>{journey.lastReportedStage === stage.key ? <Truck size={16} aria-hidden="true"/> : stage.state === "completed" ? <Check size={16} aria-hidden="true"/> : stage.state === "blocked" ? <AlertTriangle size={15} aria-hidden="true"/> : stage.state === "unknown" ? <CircleHelp size={14} aria-hidden="true"/> : <span className={s.innerDot}/>}</span><div className={s.stageCopy}><div><strong>{stageName(stage.key, t)}</strong><span className={s.stageState}>{stateName(stage.state, t)}</span></div><p>{stage.state === "unknown" ? t("El contrato actual no registra este hito por separado.", "The current contract does not record this milestone separately.") : stage.state === "blocked" ? t("Revisa la incidencia o cancelación antes de asumir continuidad.", "Review the incident or cancellation before assuming progress.") : stage.at ? formatDateTime(stage.at, tag) : t("Aún no hay hora confirmada.", "No confirmed time yet.")}</p></div></li>)}</ol>
    <div className={s.observation}><div><MapPin size={17} aria-hidden="true"/><span><strong>{t("Última ubicación reportada", "Last reported location")}</strong><small>{journey.lastKnownPosition?.label ?? t("Desconocida", "Unknown")}</small></span></div><div><CalendarClock size={17} aria-hidden="true"/><span><strong>{t("Último reporte de posición", "Last position report")}</strong><small>{formatDateTime(journey.latestPositionAt, tag)} · {journey.positionReports} {t("registro(s)", "record(s)")}</small></span></div></div>
  </section>;
}

export function TrackingEventsPanel({ events, t, tag, locale }: { events: ExecutionEvent[]; t: T; tag: string; locale: "es" | "en" }) {
  const ordered = [...events].sort((a, b) => Date.parse(b.data.at) - Date.parse(a.data.at));
  return <section className={s.panel} aria-labelledby="tracking-events-title"><div className={s.panelHeading}><div><span className={s.eyebrow}>{t("Evidencia operativa", "Operational evidence")}</span><h2 id="tracking-events-title">{t("Actividad reportada", "Reported activity")}</h2><p>{t("Eventos físicos auditados, separados del historial de la solicitud.", "Audited physical events, separate from request history.")}</p></div><ShieldCheck size={21} aria-hidden="true"/></div>
    {ordered.length ? <ol className={s.eventList}>{ordered.map((event) => <li key={event.id}><span className={s.eventDot}/><div><strong>{executionActionLabel(event.data.action, locale)}</strong><small>{formatDateTime(event.data.at, tag)}</small><p>{event.data.note}</p></div></li>)}</ol> : <div className={s.empty}><CircleHelp size={22}/><strong>{t("Aún no hay reportes físicos", "No physical reports yet")}</strong><p>{t("La reserva o una ruta planificada no prueban que el transporte haya empezado.", "A booking or planned route does not prove that transport has started.")}</p></div>}
  </section>;
}

export function TrackingIncidentsPanel({ incidents, t, tag }: { incidents: Incident[]; t: T; tag: string }) {
  const ordered = [...incidents].sort((a, b) => Date.parse(b.data.occurredAt) - Date.parse(a.data.occurredAt));
  return <section className={s.panel} aria-labelledby="tracking-incidents-title"><div className={s.panelHeading}><div><span className={s.eyebrow}>{t("Atención y recuperación", "Attention and recovery")}</span><h2 id="tracking-incidents-title">{t("Incidencias", "Incidents")}</h2><p>{t("Se muestran sin convertir una alerta en una demora confirmada.", "Alerts are shown without turning them into a confirmed delay.")}</p></div><AlertTriangle size={21} aria-hidden="true"/></div>
    {ordered.length ? <div className={s.incidentList}>{ordered.map((incident) => <article className={s.incident} data-tone={incident.data.severity === "CRITICAL" ? "danger" : "warning"} key={incident.id}><div className={s.incidentTop}><strong>{incident.data.kind}</strong><span className={s.statePill} data-state={incident.data.status === "RESOLVED" ? "completed" : "blocked"}>{incident.data.status === "RESOLVED" ? t("Resuelta", "Resolved") : t("Abierta", "Open")} · {incident.data.severity}</span></div><p>{incident.data.description}</p><dl><div><dt>{t("Reportada", "Reported")}</dt><dd>{formatDateTime(incident.data.occurredAt, tag)}</dd></div><div><dt>{t("Lugar", "Location")}</dt><dd>{incident.data.location?.label ?? t("No reportado", "Not reported")}</dd></div><div><dt>{t("Impacto", "Impact")}</dt><dd>{incident.data.status === "RESOLVED" ? t("Cerrada; revisa los eventos posteriores para conocer el avance.", "Closed; review later events for progress.") : t("Requiere revisión operativa; el retraso o desvío no se presume.", "Needs operational review; delay or diversion is not assumed.")}</dd></div></dl><Link href="/support">{t("Contactar soporte", "Contact support")}<ArrowRight size={14} aria-hidden="true"/></Link></article>)}</div> : <div className={s.empty}><ShieldCheck size={22}/><strong>{t("Sin incidencias registradas", "No recorded incidents")}</strong><p>{t("No reportado no equivale a ausencia garantizada de problemas.", "Not reported does not guarantee the absence of issues.")}</p></div>}
  </section>;
}

import { AlertTriangle, ArrowRight, Check, CircleHelp, MapPin, ShieldCheck, Truck } from "lucide-react";
import Link from "next/link";
import { executionActionLabel, formatDateTime } from "./shipper-model";
import { buildTrackingJourney, type ExecutionEvent, type Incident, type JourneyStageKey } from "./tracking-journey";
import { provenanceName, stageName, trackingStatus, type TrackingListItem, type TrackingTranslate } from "./tracking-presentation";
import s from "./tracking-experience.module.css";

export function TrackingOverviewCard({ execution, booking, events, incidents, reference, corridor, t, tag }: TrackingListItem & { t: TrackingTranslate; tag: string }) {
  const journey = buildTrackingJourney(execution, booking, events, incidents);
  const status = trackingStatus(execution, booking, events, incidents, t);
  return <article className={s.overviewCard}>
    <div className={s.overviewTop}><span className={s.overviewIcon}><Truck size={20} aria-hidden="true"/></span><div className={s.reference}><small>{t("Transporte", "Transport")}</small><h2 title={reference}>{reference}</h2></div></div>
    <p className={s.corridor}>{corridor}</p>
    <div className={s.badgeRow}><span className={s.statePill} data-state={status.tone}>{status.label}</span>{journey.openIncidents > 0 && <span className={s.statePill} data-state="blocked"><AlertTriangle size={13} aria-hidden="true"/>{journey.openIncidents} {t("activa(s)", "active")}</span>}</div>
    <div className={s.miniJourney} aria-label={t("Hitos reportados", "Reported milestones")}>
      {(["booking", "departure", "transit", "delivery"] as JourneyStageKey[]).map((key) => { const stage = journey.stages.find((item) => item.key === key)!; return <div className={s.miniStep} data-state={stage.state} key={key}><span>{key === journey.lastReportedStage ? <Truck size={13} aria-hidden="true"/> : stage.state === "completed" ? <Check size={13} aria-hidden="true"/> : null}</span><small>{stageName(key, t)}</small></div>; })}
    </div>
    <div className={s.overviewFoot}><span><MapPin size={14} aria-hidden="true"/>{journey.lastKnownPosition?.label ?? t("Ubicación no reportada", "Location not reported")}</span><time dateTime={journey.lastUpdatedAt ?? undefined}>{formatDateTime(journey.lastUpdatedAt, tag)}</time></div>
    <Link className={s.actionLink} href={`/tracking/${execution.id}`}>{t("Abrir seguimiento", "Open tracking")}<ArrowRight size={16} aria-hidden="true"/></Link>
  </article>;
}

export function TrackingEventsPanel({ events, t, tag, locale }: { events: ExecutionEvent[]; t: TrackingTranslate; tag: string; locale: "es" | "en" }) {
  const ordered = [...events].sort((a, b) => Date.parse(b.data.at) - Date.parse(a.data.at));
  const renderEvent = (event: ExecutionEvent) => <li key={event.id}><span className={s.eventDot}/><div className={s.eventContent}>
    <div className={s.eventTop}><strong>{executionActionLabel(event.data.action, locale)}</strong><time dateTime={event.data.at}>{formatDateTime(event.data.at, tag)}</time></div>
    {event.data.note && <p>{event.data.note}</p>}
    <div className={s.badgeRow}><span className={s.statePill} data-state="completed">{t("Reportado", "Reported")}</span><span className={s.metaBadge}>{provenanceName(event.data.evidence.provenanceStatus, t)} · {event.data.evidence.provider}</span></div>
    <details className={s.evidence}><summary>{t("Ver evidencia", "View evidence")}</summary><dl><div><dt>{t("Referencia", "Reference")}</dt><dd>{event.data.evidence.reference}</dd></div><div><dt>{t("Observada", "Observed")}</dt><dd>{formatDateTime(event.data.evidence.observedAt, tag)}</dd></div><div><dt>{t("Estado del registro", "Record state")}</dt><dd>{event.status}</dd></div></dl></details>
  </div></li>;
  return <section className={s.panel} aria-labelledby="tracking-events-title"><div className={s.panelHeading}><h2 id="tracking-events-title">{t("Actividad del transporte", "Transport activity")}</h2><span className={s.metaBadge}>{events.length}</span></div>
    {ordered.length ? <><ol className={s.eventList}>{ordered.slice(0, 6).map(renderEvent)}</ol>{ordered.length > 6 && <details className={s.olderEvents}><summary>{t("Ver eventos anteriores", "View earlier events")} ({ordered.length - 6})</summary><ol className={s.eventList}>{ordered.slice(6).map(renderEvent)}</ol></details>}</> : <div className={s.empty}><CircleHelp size={24} aria-hidden="true"/><strong>{t("Esperando el primer evento", "Waiting for the first event")}</strong><p>{t("Aquí aparecerán los reportes de salida, posición y entrega del transportista.", "Carrier departure, position and delivery reports will appear here.")}</p></div>}
  </section>;
}

export function TrackingIncidentsPanel({ incidents, t, tag }: { incidents: Incident[]; t: TrackingTranslate; tag: string }) {
  const active = incidents.filter((item) => item.data.status === "OPEN").length;
  const ordered = [...incidents].sort((a, b) => Number(b.data.status === "OPEN") - Number(a.data.status === "OPEN") || Date.parse(b.data.occurredAt) - Date.parse(a.data.occurredAt));
  return <section className={s.panel} aria-labelledby="tracking-incidents-title"><div className={s.panelHeading}><h2 id="tracking-incidents-title">{t("Incidencias", "Incidents")}</h2><span className={s.statePill} data-state={active ? "blocked" : "completed"}>{active} {active === 1 ? t("activa", "active") : t("activas", "active")}</span></div>
    {ordered.length ? <div className={s.incidentList}>{ordered.map((incident) => {
      const resolved = incident.data.status === "RESOLVED";
      return <article className={s.incident} data-tone={resolved ? "resolved" : incident.data.severity === "CRITICAL" ? "danger" : "warning"} key={incident.id}>
        <div className={s.incidentTop}>{resolved ? <ShieldCheck size={18} aria-hidden="true"/> : <AlertTriangle size={18} aria-hidden="true"/>}<strong>{resolved ? t("Resuelta", "Resolved") : t("Incidencia activa", "Active incident")}</strong><span>{incident.data.severity === "CRITICAL" ? t("Crítica", "Critical") : incident.data.severity === "WARNING" ? t("Alerta", "Warning") : t("Informativa", "Information")}</span></div>
        <p>{incident.data.description}</p><time dateTime={incident.data.occurredAt}>{formatDateTime(incident.data.occurredAt, tag)}</time>
        <dl><div><dt>{t("Lugar", "Location")}</dt><dd>{incident.data.location?.label ?? t("No reportado", "Not reported")}</dd></div><div><dt>{t("Impacto en horario", "Schedule impact")}</dt><dd>{t("No reportado", "Not reported")}</dd></div></dl>
        <details className={s.evidence}><summary>{t("Origen del reporte", "Report source")}</summary><p>{incident.data.kind}</p>{incident.data.evidence.map((evidence, index) => <p key={index}>{provenanceName(evidence.provenanceStatus, t)} · {evidence.provider}<br/>{evidence.reference}<br/>{formatDateTime(evidence.observedAt, tag)}</p>)}</details>
        {!resolved && <Link href="/support">{t("Consultar con soporte", "Contact support")}<ArrowRight size={14} aria-hidden="true"/></Link>}
      </article>;
    })}</div> : <div className={s.quietState}><ShieldCheck size={27} aria-hidden="true"/><strong>{t("Sin incidencias reportadas", "No incidents reported")}</strong><p>{t("Las alertas del transportista aparecerán aquí.", "Carrier alerts will appear here.")}</p></div>}
  </section>;
}

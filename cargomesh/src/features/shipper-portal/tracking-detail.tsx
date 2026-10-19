import { ArrowLeft, ArrowRight, CalendarClock, MapPin, Radio, ShieldCheck } from "lucide-react";
import {WorkspaceLink as Link} from "@/features/workspace-mode/workspace-link";
import { localeTag, translate, type Locale } from "@/features/i18n/config";
import type { MapPresentation } from "@/features/v2-road-map/road-map-model";
import { formatDateTime, executionActionLabel } from "./shipper-model";
import { buildTrackingJourney, type Booking, type Execution, type ExecutionEvent, type Incident } from "./tracking-journey";
import { stageName } from "./tracking-presentation";
import { TrackingProgress } from "./tracking-progress";
import { TrackingVisual } from "./tracking-visual";
import { TrackingEventsPanel, TrackingIncidentsPanel } from "./tracking-experience";
import s from "./tracking-experience.module.css";

export type TrackingDetailProps = {
  execution: Execution; booking: Booking | null; events: ExecutionEvent[]; incidents: Incident[];
  reference: string; origin: string; destination: string; originLabel: string; destinationLabel: string;
  requestId: string | null; presentation: MapPresentation; canView3D: boolean; locale: Locale;
};
export function TrackingDetail({ execution, booking, events, incidents, reference, origin, destination, originLabel, destinationLabel, requestId, presentation, canView3D, locale }: TrackingDetailProps) {
  const t = (es: string, en: string) => translate(locale, es, en), tag = localeTag(locale);
  const journey = buildTrackingJourney(execution, booking, events, incidents);
  const milestone = journey.lastReportedStage ? stageName(journey.lastReportedStage, t) : t("Sin reporte", "No report");
  return <div className={s.page}>
    <div className={s.breadcrumb}><Link href="/tracking"><ArrowLeft size={15} aria-hidden="true"/>{t("Transportes", "Transports")}</Link><span title={reference}>{reference}</span></div>
    <header className={s.detailHeader}><div><h1><span>{origin}</span><ArrowRight size={24} aria-hidden="true"/><span>{destination}</span></h1><p>{t("Último hito", "Last milestone")}: <strong>{milestone}</strong></p></div>{requestId && <Link href={`/requests/${requestId}`} className={s.actionLink}>{t("Ver solicitud", "View request")}<ArrowRight size={14} aria-hidden="true"/></Link>}</header>
    <section className={s.executiveGrid} aria-label={t("Resumen del transporte", "Transport summary")}>
      <div className={s.metric}><Radio size={19} aria-hidden="true"/><div><small>{t("Último evento", "Latest event")}</small><strong>{journey.latestEvent ? executionActionLabel(journey.latestEvent.data.action, locale) : t("Esperando reporte", "Awaiting report")}</strong><span>{formatDateTime(journey.latestEvent?.data.at, tag)}</span></div></div>
      <div className={s.metric}><CalendarClock size={19} aria-hidden="true"/><div><small>{t("Actualizado", "Updated")}</small><strong>{formatDateTime(journey.lastUpdatedAt, tag)}</strong><span>{t("Registro del transporte", "Transport record")}</span></div></div>
      <div className={s.metric} data-attention={journey.openIncidents > 0}><ShieldCheck size={19} aria-hidden="true"/><div><small>{t("Incidencias activas", "Active incidents")}</small><strong>{journey.openIncidents}</strong><a href="#tracking-incidents-title">{journey.openIncidents ? t("Revisar alertas", "Review alerts") : t("Sin reportes abiertos", "No open reports")}</a></div></div>
    </section>
    <TrackingProgress journey={journey}/>
    <div className={s.detailGrid}><div className={s.mainColumn}>
      <TrackingVisual presentation={presentation} origin={originLabel} destination={destinationLabel} canView3D={canView3D} milestone={milestone} lastReportedAt={journey.latestEvent?.data.at ?? null}/>
      <TrackingEventsPanel events={events} t={t} tag={tag} locale={locale}/>
    </div><aside className={s.sideColumn}>
      <TrackingIncidentsPanel incidents={incidents} t={t} tag={tag}/>
      <section className={s.panel} aria-labelledby="tracking-location-title"><div className={s.panelHeading}><h2 id="tracking-location-title">{t("Última ubicación", "Last location")}</h2></div><div className={s.locationBlock}><MapPin size={21} aria-hidden="true"/><div><strong>{journey.lastKnownPosition?.label ?? t("Sin posición reportada", "No reported position")}</strong><p>{journey.latestPositionAt ? formatDateTime(journey.latestPositionAt, tag) : t("Fecha de posición desconocida", "Position date unknown")}</p></div></div></section>
    </aside></div>
  </div>;
}

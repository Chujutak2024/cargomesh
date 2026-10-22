import {displayReference} from '@/shared/lib/display-identity';
import { ArrowRight, CircleHelp } from "lucide-react";
import {WorkspaceLink as Link} from "@/features/workspace-mode/workspace-link";
import type { FreightRequestV2Data } from "@/features/v2-intake/contracts";
import type { WorkflowRecordV2 } from "./shipper-model";
import { formatDateTime } from "./shipper-model";
import styles from "./shipper-portal.module.css";

type Offer = Extract<WorkflowRecordV2, { kind: "offers" }>;
type Booking = Extract<WorkflowRecordV2, { kind: "bookings" }>;
type Incident = Extract<WorkflowRecordV2, { kind: "incidents" }>;

function auditNote(value: unknown) {
  return value && typeof value === "object" && "note" in value && typeof value.note === "string" ? value.note : null;
}

export function OutcomePanel({ requests, offers, bookings, incidents, t, localeTag }: {
  requests: FreightRequestV2Data[]; offers: Offer[]; bookings: Booking[]; incidents: Incident[];
  t: (es: string, en: string) => string; localeTag: string;
}) {
  const requestById = new Map(requests.map((request) => [request.id, request]));
  const items = [
    ...offers.filter((offer) => offer.status === "WITHDRAWN").map((offer) => ({ key: `offer-${offer.id}`, at: offer.updatedAt, requestId: offer.requestId,
      title: t("Oferta retirada", "Offer withdrawn"), detail: `${displayReference(offer.data.carrierReference,'OFE',offer.id)} · ${t("Ya no puede seleccionarse ni reservarse.", "It can no longer be selected or booked.")}`,
      reason: auditNote(offer.data.withdrawal) ?? t("Motivo no proporcionado en este registro.", "Reason not provided in this record."), tone: "warning",
      recoveryHref: "/support", recoveryLabel: t("Consultar alternativas", "Ask about alternatives") })),
    ...bookings.filter((booking) => ["REJECTED", "CANCELLED"].includes(booking.data.carrierConfirmationStatus)).map((booking) => ({ key: `booking-${booking.id}`, at: booking.data.confirmedAt ?? booking.updatedAt, requestId: booking.requestId,
      title: booking.data.carrierConfirmationStatus === "REJECTED" ? t("Booking rechazado por el carrier", "Booking rejected by carrier") : t("Booking cancelado", "Booking cancelled"),
      detail: t("La autorización del shipper no equivale a una reserva confirmada.", "Shipper authorization does not equal a confirmed booking."),
      reason: auditNote(booking.data.cancellation) ?? t("El motivo específico no está disponible en este registro. Consulta al equipo operativo.", "The specific reason is unavailable in this record. Contact operations."), tone: "danger",
      recoveryHref: "/support", recoveryLabel: t("Contactar operaciones", "Contact operations") })),
    ...requests.filter((request) => ["FAILED", "CANCELLED"].includes(request.status)).map((request) => ({ key: `request-${request.id}`, at: request.updatedAt, requestId: request.id,
      title: request.status === "FAILED" ? t("Solicitud fallida", "Request failed") : t("Solicitud cancelada", "Request cancelled"),
      detail: t("Esta solicitud no continúa automáticamente a una nueva oferta o reserva.", "This request does not automatically continue to a new offer or booking."),
      reason: t("El contrato actual no distingue rechazo de solicitud de fallo o cancelación; no se atribuye un motivo inexistente.", "The current contract does not distinguish request rejection from failure or cancellation; no missing reason is invented."), tone: "danger",
      recoveryHref: "/freight-request/new", recoveryLabel: t("Iniciar otra solicitud", "Start another request") })),
    ...incidents.map((incident) => ({ key: `incident-${incident.id}`, at: incident.data.occurredAt, requestId: incident.requestId,
      title: `${t("Incidencia operativa", "Operational incident")}: ${incident.data.kind}`,
      detail: incident.data.description, reason: `${t("Severidad", "Severity")}: ${incident.data.severity} · ${t("Estado", "Status")}: ${incident.data.status}`,
      tone: incident.data.severity === "CRITICAL" ? "danger" : "warning",
      recoveryHref: `/requests/${incident.requestId}`, recoveryLabel: t("Revisar recuperación", "Review recovery") })),
  ].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  return <section className={styles.panel} aria-labelledby="outcome-title"><header className={styles.panelHeader}><div><h2 id="outcome-title">{t("Rechazos, cancelaciones e incidencias", "Rejections, cancellations and incidents")}</h2></div></header>
    {items.length ? <div className={`${styles.section} ${styles.outcomeGrid}`}>{items.map((item) => <article className={styles.outcomeCard} data-tone={item.tone} key={item.key}>
      <div className={styles.offerHead}><h3>{item.title}</h3><small>{formatDateTime(item.at, localeTag)}</small></div><p>{item.detail}</p><p><CircleHelp size={14} aria-hidden="true"/> {item.reason}</p>
      <div className={styles.outcomeActions}>{item.requestId && requestById.has(item.requestId) ? <Link className={styles.secondary} href={`/requests/${item.requestId}`}>{t("Revisar solicitud", "Review request")}<ArrowRight size={14}/></Link> : null}<Link className={styles.secondary} href={item.recoveryHref}>{item.recoveryLabel}</Link></div>
    </article>)}</div> : <div className={styles.empty}><strong>{t("Sin incidencias o rechazos registrados", "No recorded incidents or rejections")}</strong></div>}
  </section>;
}

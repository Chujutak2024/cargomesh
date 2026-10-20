import { Box, Route, Truck } from "lucide-react";
import type { WorkflowRecordV2 } from "./shipper-model";
import { formatDateTime } from "./shipper-model";
import { resolveBookingOffer } from "./commercial-view";
import styles from "./shipper-portal.module.css";
import { bookingResources } from "./booking-resources-model";
type Booking = Extract<WorkflowRecordV2, {kind:"bookings"}>;

/** A planned execution is not started transport; a proposed asset is not confirmed capacity or crew. */
export function BookingResources({ booking, rows, offers, decisions, complete, t, localeTag }: {
  booking: Booking; rows: WorkflowRecordV2[]; offers: Extract<WorkflowRecordV2,{kind:"offers"}>[];
  decisions: Extract<WorkflowRecordV2,{kind:"decisions"}>[]; complete: boolean; t: (es:string,en:string)=>string; localeTag: string;
}) {
  const state = bookingResources(booking,rows,complete), offer = resolveBookingOffer(booking,decisions,offers);
  const holdLabel = (status:string) => ({ HELD:t("Retención temporal","Temporary hold"), CONFIRMED:t("Capacidad comprometida","Committed capacity"),
    RELEASED:t("Capacidad liberada","Released capacity"), EXPIRED:t("Retención vencida","Expired hold") })[status] ?? t("Estado no reconocido","Unrecognized state");
  const executionLabel = (status:string) => ({PLANNED:t("Operación planificada","Planned operation"), IN_PROGRESS:t("En curso","In progress"),
    COMPLETED:t("Finalizada","Completed"), CANCELLED:t("Cancelada","Cancelled")})[status] ?? t("Estado desconocido","Unknown state");
  return <details className={styles.offerArchive}><summary><Box size={15}/>{t("Recursos y operación vinculados","Linked resources and operation")}</summary>
    <div className={styles.bookingFacts}>
      {!state.complete ? <p role="status">{t("Lectura incompleta: los recursos no cargados no se consideran disponibles.","Incomplete read: unloaded resources are not considered available.")}</p> : null}
      {state.holds.map(hold => <div key={hold.id}><strong><Box size={14}/> {holdLabel(hold.status)}</strong>
        <p>{hold.data.capacityCommitted.weightKg.toLocaleString(localeTag)} kg · {hold.data.capacityCommitted.volumeM3.toLocaleString(localeTag)} m³</p>
        <p>{formatDateTime(hold.data.window.startsAt,localeTag)} – {formatDateTime(hold.data.window.endsAt,localeTag)}</p>
        {hold.status === "HELD" ? <p>{t("Vence","Expires")}: {formatDateTime(hold.data.expiresAt,localeTag)} · {hold.data.active ? t("Activa","Active") : t("No activa","Inactive")}</p> : null}
        <small>{t("Recurso","Resource")}: {hold.data.planResourceId} · {t("Reserva de capacidad","Capacity reservation")}: {hold.id} · v{hold.version}</small>
        <p>{t("Procedencia","Source")}: {hold.data.evidence.provenanceStatus}</p></div>)}
      {state.complete && !state.holds.length ? <p>{t("Aún no hay capacidad retenida o confirmada para esta reserva.","No held or confirmed capacity is recorded for this booking yet.")}</p> : null}
      {state.executions.map(execution => <div key={execution.id}><strong><Truck size={14}/> {executionLabel(execution.status)}</strong>
        <p>{formatDateTime(execution.data.plannedWindow.startsAt,localeTag)} – {formatDateTime(execution.data.plannedWindow.endsAt,localeTag)}</p>
        <small>{t("Ejecución","Execution")}: {execution.id} · v{execution.version}</small>
        <p>{t("Inicio reportado","Reported start")}: {formatDateTime(execution.data.actualStartedAt,localeTag)}</p>
        <p>{t("Entrega reportada","Reported delivery")}: {formatDateTime(execution.data.actualCompletedAt,localeTag)}</p></div>)}
      {state.complete && !state.executions.length ? <p>{t("El transportista todavía no tiene una ejecución vinculada. Autorizar no inicia el transporte.","No linked execution has been recorded yet. Authorization does not start transport.")}</p> : null}
      <details><summary><Route size={14}/>{t("Referencias de contratación","Commercial references")}</summary><dl>
        <div><dt>{t("Solicitud","Request")}</dt><dd>{booking.requestId}</dd></div>
        <div><dt>{t("Decisión","Decision")}</dt><dd>{booking.data.decisionId}</dd></div>
        <div><dt>{t("Oferta","Offer")}</dt><dd>{offer ? `${offer.id} · v${offer.data.offerVersion}` : t("Vínculo sin verificar","Unverified link")}</dd></div>
        <div><dt>{t("Transportista","Carrier")}</dt><dd>{booking.carrierId}</dd></div>
        <div><dt>Booking</dt><dd>{booking.id} · v{booking.version}</dd></div>
      </dl></details>
    </div></details>;
}

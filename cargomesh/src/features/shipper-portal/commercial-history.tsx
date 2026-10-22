"use client";
import {displayReference} from '@/shared/lib/display-identity';
import { Clock3, FileCheck2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useLocale } from "@/features/i18n/locale-provider";
import type { FreightRequestV2Data } from "@/features/v2-intake/contracts";
import type { WorkflowRecordV2 } from "./shipper-model";
import { bookingStatusPresentation, formatDateTime } from "./shipper-model";
import { parseOperationsQuery, filterOperationRequests } from "./operations-query";
import { OperationRequestLink } from "./operations-navigation";
import styles from "./shipper-portal.module.css";
import { commercialHistory } from "./commercial-history-model";
export function CommercialHistory({ requests, rows }: { requests: FreightRequestV2Data[]; rows: WorkflowRecordV2[] }) {
  const {t,locale,localeTag} = useLocale(), params = useSearchParams();
  const visible = filterOperationRequests(requests,parseOperationsQuery(params),localeTag, value=>formatDateTime(value,localeTag));
  const events = commercialHistory(visible,rows);
  return <section className={styles.panel} aria-labelledby="commercial-history-title"><header className={styles.panelHeader}><h2 id="commercial-history-title">{t("Decisiones y reservas","Decisions and bookings")}</h2><FileCheck2 size={18}/></header>
    {events.length ? <div className={styles.timeline}>{events.map(event => <article className={styles.timelineItem} key={`${event.type}-${displayReference(event.row.id,event.row.kind==='decisions'?'DEC':'BKG')}`}>
      <span className={styles.timelineDot}><Clock3 size={13}/></span><div>
        <strong>{event.type === "selection" ? t("Alternativa seleccionada","Alternative selected") : event.type === "authorization" ? t("Reserva autorizada por el cliente","Client authorized booking")
          : event.row.kind === "bookings" ? bookingStatusPresentation(event.row.data.carrierConfirmationStatus,locale).label : event.row.status}</strong>
        <span>{formatDateTime(event.at,localeTag)}</span><OperationRequestLink requestId={event.request.id}>{displayReference(event.request.referenceCode,'PED',event.request.id)}</OperationRequestLink>
        <small>{event.row.kind === "decisions" ? t("Decisión","Decision") : "Booking"}: {displayReference(event.row.id,event.row.kind==='decisions'?'DEC':'BKG')} · v{event.row.version}</small>
        {event.row.kind === "bookings" ? <small>{t("Decisión vinculada","Linked decision")}: {displayReference(event.row.data.decisionId,'DEC')}</small> : null}
        {event.type === "response" ? <small>{t("Último estado persistido; no es un registro completo de cada transición.","Latest persisted state, not a complete log of every transition.")}</small> : null}
      </div></article>)}</div> : <div className={styles.empty}>{t("Sin decisiones o reservas en las solicitudes filtradas.","No decisions or bookings in the filtered requests.")}</div>}
  </section>;
}

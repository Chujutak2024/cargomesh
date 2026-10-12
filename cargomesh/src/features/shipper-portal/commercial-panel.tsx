"use client";

import { AlertTriangle, ArrowRight, CalendarClock, FileCheck2, ShieldCheck, Truck } from "lucide-react";
import { Button } from "@/components/ui";
import type { WorkflowRecordV2 } from "./shipper-model";
import { formatDateTime } from "./shipper-model";
import { bookingsStillNeeded, money, offerAvailability, optionAvailability } from "./commercial-view";
import styles from "./shipper-portal.module.css";

type Offer = Extract<WorkflowRecordV2, { kind: "offers" }>;
type Ranking = Extract<WorkflowRecordV2, { kind: "ranking" }>;
type Decision = Extract<WorkflowRecordV2, { kind: "decisions" }>;
type Booking = Extract<WorkflowRecordV2, { kind: "bookings" }>;

export function CommercialPanel({ offers, ranking, selectedOptionIndex, setSelectedOptionIndex, decision, bookings, onDecide, onBook, t, localeTag }: {
  offers: Offer[]; ranking: Ranking | null; selectedOptionIndex: number; setSelectedOptionIndex: (index: number) => void;
  decision: Decision | null; bookings: Booking[]; onDecide: () => void; onBook: () => void;
  t: (es: string, en: string) => string; localeTag: string;
}) {
  const option = ranking?.data.options[selectedOptionIndex] ?? null;
  const selectedOffers = option?.offerIds.map((id) => offers.find((offer) => offer.id === id) ?? null) ?? [];
  const available = optionAvailability(option, offers).available;
  const decisionBookings = bookings.filter((booking) => booking.data.decisionId === decision?.id);
  const rejectedDecision = decisionBookings.length > 0 && decisionBookings.every((booking) => ["REJECTED", "CANCELLED"].includes(booking.data.carrierConfirmationStatus));
  const differentOption = option && decision && (option.offerIds.length !== decision.data.selectedOfferIds.length || option.offerIds.some((id) => !decision.data.selectedOfferIds.includes(id)));
  return <section className={styles.panel} aria-labelledby="commercial-title">
    <header className={styles.panelHeader}><div><h2 id="commercial-title">{t("Compara y decide", "Compare and decide")}</h2></div><FileCheck2 size={18}/></header>
    {!offers.length ? <div className={styles.empty}><span className={styles.emptyIcon}><FileCheck2 size={22}/></span><strong>{t("Todavía no hay ofertas", "No offers yet")}</strong><p>{t("Cuando los carriers respondan aparecerán aquí sus precios y condiciones reales. No hay datos simulados.", "When carriers respond, their real prices and terms will appear here. There is no simulated data.")}</p></div> : <div className={styles.section}>
      {ranking?.data.options.length ? <>
        <div className={styles.comparisonIntro}><div><span className={styles.eyebrow}>{t("Alternativas comparables", "Comparable options")}</span><h3>{t("Elige un plan, revisa sus ofertas", "Choose a plan, review its offers")}</h3></div><span>{ranking.data.options.length} {t("opciones", "options")}</span></div>
        <div className={styles.optionStrip} role="group" aria-label={t("Opciones ordenadas por el backend", "Options ordered by the backend")}>
          {ranking.data.options.map((item, index) => { const state = optionAvailability(item, offers); const itemOffers = item.offerIds.map((id) => offers.find((offer) => offer.id === id)).filter((record): record is Offer => Boolean(record));
            const currencies = new Set(itemOffers.map((record) => record.data.price.currency));
            return <button type="button" key={`${item.planId}-${index}`} className={styles.optionTile} aria-pressed={index === selectedOptionIndex} onClick={() => setSelectedOptionIndex(index)}>
              <span className={styles.optionRank}>#{item.position} · {index === selectedOptionIndex ? t("Seleccionada", "Selected") : t("Comparar", "Compare")}</span>
              <strong>{currencies.size === 1 && itemOffers.length === item.offerIds.length ? money(item.costCents / 100, itemOffers[0].data.price.currency, localeTag) : t("Precio incompleto", "Incomplete price")}</strong>
              <span>{itemOffers.map((record) => record.data.carrierReference).join(" + ") || t("Oferta no disponible", "Offer unavailable")}</span>
              <small>{state.available ? t("Vigente para revisión", "Current for review") : t("No disponible para elegir", "Unavailable for selection")}</small>
            </button>;
          })}
        </div>
        {option ? <div className={styles.comparisonDetail}>
          <div className={styles.comparisonHeader}><div><span className={styles.eyebrow}>{t("Detalle de la alternativa", "Option details")}</span><h3>#{option.position} · {t("Plan", "Plan")} {option.planId.slice(0, 8)}</h3></div><span className={styles.status} data-tone={available ? "positive" : "danger"}>{available ? t("Disponible", "Available") : t("No seleccionable", "Not selectable")}</span></div>
          <div className={styles.comparisonFacts}><div><small>{t("Score del servidor", "Server score")}</small><strong>{option.score.toFixed(3)}</strong></div><div><small>{t("Tránsito", "Transit")}</small><strong>{option.transit === null ? t("Desconocido", "Unknown") : `${Math.round(option.transit / 3600)} h`}</strong></div><div><small>{t("Confiabilidad", "Reliability")}</small><strong>{option.reliability === null ? t("Desconocida", "Unknown") : `${Math.round(option.reliability * 100)} %`}</strong></div></div>
          {selectedOffers.map((record, index) => record ? <OfferDetails key={record.id} offer={record} t={t} localeTag={localeTag}/> : <p className={styles.notice} data-tone="danger" key={option.offerIds[index]}><AlertTriangle size={16}/>{t("Falta una oferta referenciada por este plan. Recarga antes de decidir.", "An offer referenced by this plan is missing. Reload before deciding.")}</p>)}
          {!available ? <p className={styles.notice} data-tone="warning"><AlertTriangle size={17}/>{t("Esta alternativa no tiene ofertas válidas y vigentes. Revisa otra o recarga; no se sustituirá automáticamente.", "This option has no valid, current offers. Review another or reload; it will not be replaced automatically.")}</p> : null}
          {!decision ? <Button disabled={!available} onClick={onDecide}>{t("Revisar selección", "Review selection")}<ArrowRight size={16}/></Button> : rejectedDecision ? <div className={styles.outcomeGrid}><p className={styles.notice} data-tone="danger"><AlertTriangle size={16}/>{t("El carrier rechazó o canceló la reserva. Elegir otra alternativa requiere una decisión nueva y tu autorización explícita.", "The carrier rejected or cancelled the booking. Choosing another option requires a new decision and your explicit authorization.")}</p><Button disabled={!available || !differentOption} onClick={onDecide}>{t("Confirmar otra alternativa", "Confirm another option")}<ArrowRight size={16}/></Button></div> : differentOption ? <p className={styles.notice} data-tone="warning"><AlertTriangle size={16}/>{t("Estás comparando un plan distinto al de la decisión vigente. Para autorizar un booking, vuelve al plan elegido o consulta la decisión en el resumen lateral.", "You are comparing a different plan from the active decision. To authorize booking, return to the chosen plan or review the decision in the side summary.")}</p> : bookingsStillNeeded(decision.data.selectedOfferIds, bookings, decision.id).length ? <Button onClick={onBook}><ShieldCheck size={16}/>{t("Revisar consentimiento de booking", "Review booking consent")}</Button> : <p className={styles.notice}><Truck size={16}/>{t("Ya existe una autorización para esta decisión. Consulta su estado en Reservas; no se volverá a enviar otra automáticamente.", "An authorization already exists for this decision. Check its status in Bookings; another will not be sent automatically.")}</p>}
        </div> : null}
      </> : <p className={styles.notice} data-tone="warning"><AlertTriangle size={17}/>{t("Hay ofertas, pero el backend aún no publicó un ranking explicable. Puedes revisar los términos, no elegir un plan todavía.", "Offers exist, but the backend has not published an explainable ranking. You can review terms, but cannot choose a plan yet.")}</p>}
      <details className={styles.offerArchive}><summary>{t("Ver todas las ofertas y su estado", "View all offers and their status")} ({offers.length})</summary><div className={styles.offerArchiveGrid}>{offers.map((record) => <OfferDetails key={record.id} offer={record} t={t} localeTag={localeTag}/>)}</div></details>
    </div>}
  </section>;
}

function OfferDetails({ offer, t, localeTag }: { offer: Offer; t: (es: string, en: string) => string; localeTag: string }) {
  const state = offerAvailability(offer);
  const label = state === "WITHDRAWN" ? t("Retirada por carrier", "Withdrawn by carrier") : state === "SUPERSEDED" ? t("Reemplazada", "Superseded") : state === "EXPIRED" ? t("Vencida", "Expired") : state === "NOT_STARTED" ? t("Aún no vigente", "Not yet valid") : state === "INVALID" ? t("Vigencia inválida", "Invalid validity") : t("Vigente", "Current");
  return <article className={styles.offerDetail}><div className={styles.offerHead}><div><span className={styles.eyebrow}>{t("Transportista", "Carrier")} · {offer.data.source.channel}</span><h3>{offer.data.carrierReference}</h3></div><strong className={styles.price}>{money(offer.data.price.amount, offer.data.price.currency, localeTag)}</strong></div>
    <span className={styles.status} data-tone={state === "AVAILABLE" ? "positive" : "danger"}>{label}</span>
    <div className={styles.offerFacts}><div><CalendarClock size={15}/><span>{t("Hasta", "Until")} {formatDateTime(offer.data.validity.endsAt, localeTag)}</span></div><div><Truck size={15}/><span>{offer.data.coveredServiceIds.length} {t("servicio(s)", "service(s)")} · {offer.data.coveredAssignmentIds.length} {t("tramo(s) asignado(s)", "assigned leg(s)")}</span></div><div><span>{t("Recojo estimado", "Estimated pickup")}: {formatDateTime(offer.data.estimatedPickupAt, localeTag)}</span></div><div><span>{t("Entrega estimada", "Estimated delivery")}: {formatDateTime(offer.data.estimatedDeliveryAt, localeTag)}</span></div><div><span>{t("Tránsito declarado", "Declared transit")}: {offer.data.transitDurationSeconds === null ? t("Desconocido", "Unknown") : `${Math.round(offer.data.transitDurationSeconds / 3600)} h`}</span></div><div><span>{t("Capacidad reservable", "Reservable capacity")}: {offer.data.reservableCapacity ? `${offer.data.reservableCapacity.weightKg.toLocaleString(localeTag)} kg${offer.data.reservableCapacity.volumeM3 === null ? "" : ` · ${offer.data.reservableCapacity.volumeM3.toLocaleString(localeTag)} m³`}` : t("Desconocida", "Unknown")}</span></div></div>
    {offer.data.commercialTerms.length ? <details><summary>{t("Condiciones comerciales", "Commercial terms")} ({offer.data.commercialTerms.length})</summary><ul>{offer.data.commercialTerms.map((term, index) => <li key={`${term.code}-${index}`}><strong>{term.code}</strong>: {term.description}</li>)}</ul></details> : <p>{t("No se declararon condiciones adicionales.", "No additional terms were declared.")}</p>}
    <details><summary>{t("Desglose del precio", "Price breakdown")}</summary><dl className={styles.breakdown}>{offer.data.breakdown.map((item, index) => <div key={`${item.kind}-${index}`}><dt>{item.kind} · {item.treatment}</dt><dd>{item.amount ? money(item.amount.amount, item.amount.currency, localeTag) : t("Desconocido", "Unknown")}</dd></div>)}</dl></details>
    {state !== "AVAILABLE" ? <p className={styles.offerRecovery}>{t("No se puede contratar esta oferta. Revisa alternativas vigentes; cualquier nueva selección requiere tu confirmación.", "This offer cannot be booked. Review current alternatives; any new selection requires your confirmation.")}</p> : null}
  </article>;
}

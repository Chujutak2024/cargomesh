"use client";
import { AlertTriangle, ArrowRight, FileCheck2, ShieldCheck, Truck } from "lucide-react";
import { Button } from "@/components/ui";
import type { WorkflowRecordV2 } from "./shipper-model";
import { formatDateTime } from "./shipper-model";
import { bookingsStillNeeded, money } from "./commercial-view";
import { inspectOffer, inspectRankedOption, type CommercialContext, type Offer } from "./commercial-context";
import type { CommercialCatalog } from "./commercial-catalog";
import { carrierLabel } from "./opportunity-panel";
import styles from "./shipper-portal.module.css";
import comparison from "./commercial-comparison.module.css";

type Decision = Extract<WorkflowRecordV2, { kind: "decisions" }>;
type Booking = Extract<WorkflowRecordV2, { kind: "bookings" }>;
type Translate = (es: string, en: string) => string;
export function commercialReason(reason: string, t: Translate) {
  const labels: Record<string, [string, string]> = {
    EXPIRED: ["Oferta vencida", "Expired offer"], WITHDRAWN: ["Oferta retirada por el transportista", "Carrier withdrew the offer"],
    SUPERSEDED: ["Oferta reemplazada por otra versión", "Offer superseded by another version"], NOT_STARTED: ["Oferta todavía no vigente", "Offer not current yet"],
    INVALID: ["Vigencia inválida", "Invalid validity"], OFFER_CONTRACT_INVALID: ["Datos de oferta fuera de contrato", "Offer data outside the contract"],
    STALE_REQUEST_VERSION: ["Plan de una versión anterior de la solicitud", "Plan belongs to an older request version"],
    PLAN_ELIGIBILITY_UNKNOWN: ["Elegibilidad del plan desconocida", "Plan eligibility unknown"], PLAN_INELIGIBLE: ["Plan no elegible según el backend", "Backend marked the plan ineligible"],
    PLAN_NOT_LOADED: ["Plan sin verificar", "Plan unverified"], OPPORTUNITY_NOT_LOADED: ["Oportunidad sin verificar", "Opportunity unverified"],
    OFFER_NOT_LOADED: ["Falta una oferta del ranking", "A ranked offer is missing"],
    RANKING_PRICE_MISMATCH: ["El total del ranking no coincide con las ofertas", "Ranked total differs from the referenced offers"],
    RANKING_COVERAGE_MISMATCH: ["Las ofertas no corresponden a los tramos del ranking sin duplicados", "Offer references do not cover ranked assignments without duplicates"],
    RANKING_POLICY_MISMATCH: ["La versión de política no coincide", "Policy versions do not match"],
  };
  return labels[reason] ? t(...labels[reason]) : t(`Referencia sin verificar (${reason})`, `Unverified reference (${reason})`);
}

export function CommercialPanel({ context, catalog, selectedOptionIndex, setSelectedOptionIndex, decision, bookings, onDecide, onBook, t, localeTag, busy = false }: {
  context: CommercialContext; catalog: CommercialCatalog; selectedOptionIndex: number; setSelectedOptionIndex: (index: number) => void;
  decision: Decision | null; bookings: Booking[]; onDecide: () => void; onBook: () => void; t: Translate; localeTag: string; busy?: boolean;
}) {
  const { offers, ranking } = context, option = ranking?.data.options[selectedOptionIndex] ?? null;
  const state = inspectRankedOption(option, context);
  const decisionBookings = bookings.filter(row => row.data.decisionId === decision?.id);
  const rejected = decisionBookings.length > 0 && decisionBookings.every(row => ["REJECTED", "CANCELLED"].includes(row.data.carrierConfirmationStatus));
  const different = option && decision && (option.planId !== decision.data.planId || option.offerIds.length !== decision.data.selectedOfferIds.length || option.offerIds.some(id => !decision.data.selectedOfferIds.includes(id)));
  return <section className={styles.panel} aria-labelledby="commercial-title">
    <header className={styles.panelHeader}><h2 id="commercial-title">{t("Compara y decide", "Compare and decide")}</h2><FileCheck2 size={18}/></header>
    {!offers.length ? <div className={styles.empty}><FileCheck2 size={24}/><strong>{t("Todavía no hay ofertas", "No offers yet")}</strong><p>{t("Una oportunidad o evaluación no es una cotización. Las ofertas emitidas por el transportista aparecerán aquí.", "An opportunity or evaluation is not a quote. Carrier-issued offers appear here when recorded.")}</p></div> : <div className={styles.section}>
      {ranking?.data.options.length ? <>
        <div className={styles.comparisonIntro}><h3>{t("Alternativas del servidor", "Server-ranked options")}</h3><span>{ranking.data.options.length} {t("alternativas", "options")}</span></div>
        <div className={comparison.tableRegion} role="region" tabIndex={0} aria-label={t("Comparación desplazable de ofertas", "Scrollable offer comparison")}><table className={comparison.table}>
          <thead><tr>{[t("Alternativa", "Option"), t("Transportista / versión", "Carrier / version"), t("Total cotizado", "Quoted total"), t("Llegada / tránsito", "Arrival / transit"), t("Primera oferta que vence", "Earliest quote expiry"), t("Revisión", "Review")].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead>
          <tbody>{ranking.data.options.slice(0,3).map((item, index) => {
            const checked = inspectRankedOption(item, context), rows = item.offerIds.flatMap(id => offers.find(row => row.id === id) ?? []);
            const end = rows.length && rows.length === item.offerIds.length ? rows.reduce((min, row) => Date.parse(row.data.validity.endsAt) < Date.parse(min) ? row.data.validity.endsAt : min, rows[0].data.validity.endsAt) : null;
            const priceKnown = rows.length === item.offerIds.length && rows.every(row => inspectOffer(row, context).linked) && !checked.reasons.includes("RANKING_PRICE_MISMATCH");
            return <tr key={`${item.planId}-${index}`} data-selected={index === selectedOptionIndex}>
              <th scope="row"><button type="button" disabled={busy} aria-pressed={index === selectedOptionIndex} onClick={() => setSelectedOptionIndex(index)}>#{item.position} · {index === selectedOptionIndex ? t("Comparando", "Comparing") : t("Comparar", "Compare")}</button><small>{t("Score", "Score")} {item.score.toFixed(3)}</small></th>
              <td>{rows.map(row => <div key={row.id}><strong>{carrierLabel(row.carrierId, catalog, t)}</strong><small>{t("Oferta", "Offer")} v{row.data.offerVersion} · {row.data.carrierReference}</small></div>)}</td>
              <td><strong>{priceKnown ? money(item.costCents / 100, "USD", localeTag) : t("Total sin verificar", "Unverified total")}</strong><small>{rows.reduce((sum, row) => sum + row.data.commercialTerms.length, 0)} {t("condiciones declaradas", "declared terms")}</small></td>
              <td>{item.transit === null ? t("Desconocido", "Unknown") : item.transitAggregation==="LATEST_OFFER_ARRIVAL"?formatDateTime(new Date(item.transit*1000).toISOString(),localeTag): `${(item.transit / 3600).toLocaleString(localeTag, { maximumFractionDigits: 1 })} h`}</td>
              <td>{formatDateTime(end, localeTag)}</td><td><span className={styles.status} data-tone={checked.available ? "positive" : "pending"}>{checked.available ? t("Vigente para revisar", "Current for review") : t("Necesita revisión", "Needs review")}</span>{!checked.available ? <small>{commercialReason(checked.reasons[0], t)}</small> : null}</td>
            </tr>;
          })}</tbody></table></div>
        <details className={comparison.policy}><summary>{t("Cómo se produjo este ranking", "How this ranking was produced")}</summary>
          <p>{t("Política", "Policy")} {ranking.data.policyVersion} · v{ranking.version} · {formatDateTime(ranking.data.evaluatedAt, localeTag)}</p>
          <p>{t("El orden y las puntuaciones vienen del servidor y comparan ofertas persistidas; no confirman disponibilidad ni una reserva.", "The server orders and scores persisted offers; this does not confirm availability or a booking.")}</p>
          {option ? <><dl>{Object.entries(option.explanation.weights).map(([name, weight]) => <div key={name}><dt>{name === "cost" ? t("Costo", "Cost") : name === "transit" ? t("Llegada / tránsito", "Arrival / transit") : t("Confiabilidad", "Reliability")}</dt><dd>{(weight * 100).toLocaleString(localeTag)} %</dd></div>)}</dl>
            <p>{t("Confiabilidad", "Reliability")}: {option.reliability === null ? t("Desconocida", "Unknown") : `${(option.reliability * 100).toLocaleString(localeTag)} %`}</p>
            <p>{t("Datos faltantes declarados", "Declared missing data")}: {option.missingData.join(" · ") || t("Ninguno en este resultado", "None in this result")}</p></> : null}
          {ranking.data.excluded.length ? <details><summary>{t("Exclusiones del servidor", "Server exclusions")} ({ranking.data.excluded.length})</summary><ul>{ranking.data.excluded.map((row, index) => <li key={index}>{row.offerId?.slice(0, 8) ?? row.planId?.slice(0, 8)} · {row.reason}</li>)}</ul></details> : null}
        </details>
        {option ? <div className={styles.comparisonDetail}><h3>{t("Alternativa", "Option")} #{option.position} · {t("Plan", "Plan")} {option.planId.slice(0, 8)}</h3>
          {!state.available ? <ul className={comparison.issues}>{state.reasons.map(reason => <li key={reason}>{commercialReason(reason, t)}</li>)}</ul> : null}
          {option.offerIds.map(id => { const row = offers.find(offer => offer.id === id); return row ? <OfferDetails key={id} offer={row} context={context} catalog={catalog} t={t} localeTag={localeTag}/>
            : <p className={styles.notice} key={id}><AlertTriangle size={16}/>{t("Falta una oferta referenciada. Actualiza antes de decidir.", "A referenced offer is missing. Refresh before deciding.")}</p>; })}
          {!decision ? <Button disabled={busy || !state.available} onClick={onDecide}>{t("Revisar selección", "Review selection")}<ArrowRight size={16}/></Button>
            : rejected ? <><p className={styles.notice}>{t("La reserva anterior fue rechazada o cancelada. Otra alternativa necesita una nueva decisión y autorización.", "The previous booking was rejected or cancelled. Another option requires a new decision and authorization.")}</p><Button disabled={busy || !state.available || !different} onClick={onDecide}>{t("Revisar otra alternativa", "Review another option")}</Button></>
            : different ? <p className={styles.notice}>{t("Comparar otra alternativa no modifica tu decisión vigente ni autoriza reservas.", "Comparing another option does not change your active decision or authorize bookings.")}</p>
            : bookingsStillNeeded(decision.data.selectedOfferIds, bookings, decision.id).length ? <Button disabled={busy || !state.available} onClick={onBook}><ShieldCheck size={16}/>{t("Revisar consentimiento", "Review booking consent")}</Button>
            : <p className={styles.notice}><Truck size={16}/>{t("Consulta la autorización existente en Reservas. No se envía otra automáticamente.", "Review the existing authorization in Bookings. Another is not sent automatically.")}</p>}
        </div> : null}
      </> : <p className={styles.notice}><AlertTriangle size={17}/>{t("Puedes revisar las ofertas, pero todavía no hay un ranking persistido con alternativas. No se elegirá una oferta automáticamente.", "You can review offers, but there is no persisted ranking with options yet. No offer is chosen automatically.")}</p>}
      <details className={styles.offerArchive} open={!ranking?.data.options.length}><summary>{t("Ofertas y revisiones registradas", "Recorded offers and revisions")} ({offers.length})</summary><div className={styles.offerArchiveGrid}>
        {offers.map(row => <OfferDetails key={row.id} offer={row} context={context} catalog={catalog} t={t} localeTag={localeTag}/>)}</div></details>
    </div>}
  </section>;
}

function OfferDetails({ offer, context, catalog, t, localeTag }: { offer: Offer; context: CommercialContext; catalog: CommercialCatalog; t: Translate; localeTag: string }) {
  const state = inspectOffer(offer, context), identity = offer.carrierId ? catalog.carriers[offer.carrierId] : null;
  const status = state.availability === "AVAILABLE" ? t("Vigente", "Current") : commercialReason(state.availability, t);
  return <article className={styles.offerDetail}><header className={styles.offerHead}><div className={comparison.identity}>
    <span className={styles.eyebrow}>{t("Oferta", "Offer")} v{offer.data.offerVersion}</span><h3>{carrierLabel(offer.carrierId, catalog, t)}</h3>
    <small>{t("Referencia de cotización", "Quote reference")}: {offer.data.carrierReference}</small>{identity?.state !== "AVAILABLE" ? <small>{t("Nombre comercial no disponible", "Commercial name unavailable")} · {identity?.state ?? "NOT_LOADED"}</small> : null}
    </div><strong className={styles.price}>{money(offer.data.price.amount, offer.data.price.currency, localeTag)}</strong></header>
    <span className={styles.status} data-tone={state.current ? "positive" : "pending"}>{status}{!state.linked ? ` · ${t("atribución sin verificar", "unverified attribution")}` : ""}</span>
    {!state.current ? <ul className={comparison.issues}>{state.reasons.map(reason => <li key={reason}>{commercialReason(reason, t)}</li>)}</ul> : null}
    <dl className={comparison.metadata}>
      <Fact label={t("Vigencia", "Validity")} value={`${formatDateTime(offer.data.validity.startsAt, localeTag)} → ${formatDateTime(offer.data.validity.endsAt, localeTag)}`}/>
      <Fact label={t("Recojo estimado", "Estimated pickup")} value={formatDateTime(offer.data.estimatedPickupAt, localeTag)}/><Fact label={t("Entrega estimada", "Estimated delivery")} value={formatDateTime(offer.data.estimatedDeliveryAt, localeTag)}/>
      <Fact label={t("Servicios", "Services")} value={offer.data.coveredServiceIds.map(id => { const row = catalog.services[id]; return row?.state === "AVAILABLE" ? `${row.mode} · ${row.serviceClass}` : `${t("Servicio", "Service")} ${id.slice(0, 8)}`; }).join(" / ")}/>
      <Fact label={t("Tránsito declarado", "Declared transit")} value={offer.data.transitDurationSeconds === null ? t("Desconocido", "Unknown") : `${(offer.data.transitDurationSeconds / 3600).toLocaleString(localeTag, { maximumFractionDigits: 1 })} h`}/>
      <Fact label={t("Capacidad reservable declarada", "Declared reservable capacity")} value={offer.data.reservableCapacity ? `${offer.data.reservableCapacity.weightKg.toLocaleString(localeTag)} kg · ${offer.data.reservableCapacity.volumeM3?.toLocaleString(localeTag) ?? "?"} m³` : t("Desconocida", "Unknown")}/>
    </dl>
    {state.plan ? <details><summary>{t("Reparto de la carga", "Cargo allocation")}</summary>
      {state.plan.data.legAssignments.filter(leg => offer.data.coveredAssignmentIds.includes(leg.id)).map(leg => <section key={leg.id}>
        <h4>{t("Tramo", "Leg")} {leg.sequence} · {leg.resources.filter(row => row.resource.role === "LOAD_BEARING").length} {t("vehículos de carga", "carrying vehicles")}</h4>
        <p>{formatDateTime(leg.window.startsAt, localeTag)} → {formatDateTime(leg.window.endsAt, localeTag)}</p>
        {leg.resources.map((row, index) => <div key={row.resourceId}>
          <strong>{row.resource.role === "AUXILIARY" ? t("Apoyo", "Support") : t("Vehículo", "Vehicle")} {index + 1} · {row.resource.equipment}</strong>
          <ul>{row.allocations.map(allocation => <li key={allocation.unitIndex}>{t("Grupo", "Group")} {allocation.unitIndex + 1}: {allocation.quantity} {t("unidades", "units")} · {allocation.assignedWeightKg.toLocaleString(localeTag)} kg · {allocation.assignedVolumeM3.toLocaleString(localeTag)} m³</li>)}</ul>
        </div>)}
      </section>)}
    </details> : null}
    <details><summary>{t("Desglose del precio", "Price breakdown")}</summary><dl className={styles.breakdown}>{offer.data.breakdown.map((item, index) => <div key={index}><dt>{item.kind} · {item.treatment}{item.details ? ` · ${item.details}` : ""}</dt><dd>{item.amount ? money(item.amount.amount, item.amount.currency, localeTag) : t("Desconocido", "Unknown")}</dd></div>)}</dl></details>
    <details><summary>{t("Condiciones comerciales", "Commercial terms")} ({offer.data.commercialTerms.length})</summary>{offer.data.commercialTerms.length ? <ul>{offer.data.commercialTerms.map((term, index) => <li key={index}>{term.code}: {term.description}</li>)}</ul> : <p>{t("Sin condiciones adicionales registradas", "No additional terms recorded")}</p>}</details>
    <details><summary>{t("Autoría y trazabilidad", "Authorship and traceability")}</summary><dl className={comparison.metadata}>
      <Fact label="Carrier ID" value={offer.data.carrierId}/><Fact label="Offer ID" value={offer.id}/><Fact label={t("Oportunidad / plan", "Opportunity / plan")} value={`${offer.data.opportunityId} / ${offer.data.planCandidateId}`}/>
      <Fact label={t("Canal / emisor", "Channel / issuer")} value={`${offer.data.source.channel} · ${offer.data.source.issuerId}`}/><Fact label={t("Evidencia de origen", "Source evidence")} value={`${offer.data.source.evidence.provider} · ${offer.data.source.evidence.reference} · ${offer.data.source.evidence.provenanceStatus}`}/>
      <Fact label={t("Emisión / revisión del registro", "Issued / record revision")} value={`${formatDateTime(offer.data.issuedAt, localeTag)} · v${offer.version}`}/>
      {offer.data.supersedesOfferId ? <Fact label={t("Reemplaza oferta", "Supersedes offer")} value={offer.data.supersedesOfferId}/> : null}
      <Fact label={t("Estado publicado del plan", "Published plan state")} value={state.plan ? `${state.plan.data.eligibility} · ${state.plan.data.provenance} · ${formatDateTime(state.plan.data.evaluatedAt, localeTag)}` : t("Sin verificar", "Unverified")}/>
    </dl></details>
  </article>;
}
function Fact({ label, value }: { label: string; value: string }) { return <div><dt>{label}</dt><dd>{value}</dd></div>; }

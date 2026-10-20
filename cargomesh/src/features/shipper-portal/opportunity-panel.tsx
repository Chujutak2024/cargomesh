"use client";
import { ArrowRight, Building2, MessageSquareText, Send } from "lucide-react";
import { Button } from "@/components/ui";
import { formatDateTime } from "./shipper-model";
import { opportunityTargets, type CommercialContext } from "./commercial-context";
import { commonResponseChannels, type CommercialCatalog } from "./commercial-catalog";
import styles from "./shipper-portal.module.css";
import comparison from "./commercial-comparison.module.css";

export function carrierLabel(id: string | null, catalog: CommercialCatalog, t: (es: string, en: string) => string) {
  return id && catalog.carriers[id]?.state === "AVAILABLE" ? catalog.carriers[id].name!
    : id ? `${t("Transportista", "Carrier")} ${id.slice(0, 8)}` : t("Transportista sin identificar", "Unidentified carrier");
}
export function opportunityLabel(status: string, t: (es: string, en: string) => string) {
  const labels: Record<string, [string, string]> = { SENT: ["Esperando respuesta", "Awaiting response"], ACCEPTED: ["Preparando oferta", "Preparing an offer"],
    OFFERED: ["Oferta emitida", "Offer issued"], DECLINED: ["Oportunidad declinada", "Opportunity declined"],
    CANCELLED: ["Oportunidad cancelada", "Opportunity cancelled"], EXPIRED: ["Plazo de respuesta vencido", "Response window expired"] };
  return labels[status] ? t(...labels[status]) : t("Estado no reconocido", "Unrecognized status");
}
export function OpportunityPanel({ context, catalog, busy, onRequest, t, localeTag }: {
  context: CommercialContext; catalog: CommercialCatalog; busy: boolean;
  onRequest: (key: string) => void; t: (es: string, en: string) => string; localeTag: string;
}) {
  const targets = opportunityTargets(context);
  return <section className={styles.panel} aria-labelledby="opportunities-title">
    <header className={styles.panelHeader}><h2 id="opportunities-title">{t("Conversaciones con transportistas", "Carrier conversations")}</h2><MessageSquareText size={18}/></header>
    <div className={styles.section}>
      {!targets.length ? <div className={styles.empty}><Building2 size={24}/><strong>{t("No hay un plan comercial publicado", "No published commercial plan")}</strong>
        <p>{t("La evaluación de cobertura no crea una oportunidad ni una cotización. Los planes persistidos aparecerán aquí para solicitar una oferta.", "A coverage check does not create an opportunity or a quote. Persisted plans appear here so you can request an offer.")}</p></div> : null}
      {targets.map(target => { const channels = commonResponseChannels(target.serviceIds, target.carrierId, catalog);
        return <article className={comparison.opportunity} key={target.key}>
          <header><div><strong>{carrierLabel(target.carrierId, catalog, t)}</strong><small>{t("Plan", "Plan")} {target.plan.id.slice(0, 8)} · v{target.plan.version} · {t("Solicitud", "Request")} v{target.plan.data.requestVersion}</small></div>
            <span className={styles.status} data-tone={target.current ? "positive" : "pending"}>{target.plan.data.requestVersion !== context.request.draftVersion ? t("Versión anterior", "Previous request version") : target.plan.data.eligibility === "eligible" ? t("Plan elegible", "Eligible plan") : target.plan.data.eligibility === "unknown" ? t("Elegibilidad desconocida", "Eligibility unknown") : t("Plan no elegible", "Ineligible plan")}</span></header>
          <p>{target.serviceIds.map(id => { const service = catalog.services[id]; return service?.state === "AVAILABLE" ? `${service.mode} · ${service.serviceClass}` : t("Servicio sin datos actuales", "Current service data unavailable"); }).join(" / ")}</p>
          {target.existing.map(row => <div className={comparison.opportunityState} key={row.id}>
            <strong>{opportunityLabel(row.status, t)}</strong><span>{t("Oportunidad", "Opportunity")} {row.id.slice(0, 8)} · v{row.version}</span>
            <span>{t("Responder antes de", "Respond by")}: {formatDateTime(row.data.responseDeadline, localeTag)}</span>
            <span>{context.offers.filter(offer => offer.data.opportunityId === row.id && offer.carrierId === row.carrierId && offer.requestId === row.requestId && offer.organizationId === row.organizationId).length} {t("ofertas registradas", "recorded offers")}</span>
          </div>)}
          {!target.existing.length ? <><p>{!target.current ? t("El plan no es elegible para la versión actual. No se enviará una invitación desde esta vista.", "This plan is not eligible for the current request version. No invitation will be sent from this view.")
            : !channels.length ? t("No se pudo verificar un canal de respuesta común en los servicios. Actualiza los datos antes de invitar.", "A common response channel could not be verified from the services. Refresh before inviting.")
            : t("Solicita una cotización al transportista. Esta acción no crea un precio ni reserva capacidad.", "Request a quote from the Carrier. This action neither creates a price nor reserves capacity.")}</p>
            <Button variant="secondary" disabled={busy || !target.current || !channels.length} onClick={() => onRequest(target.key)}><Send size={15}/>{t("Solicitar oferta", "Request offer")}<ArrowRight size={15}/></Button></> : null}
          {(target.plan.data.exclusionReasons.length > 0 || target.plan.data.pendingRequirements.length > 0) ? <details><summary>{t("Razones y requisitos del plan", "Plan reasons and requirements")}</summary><ul>{[...target.plan.data.exclusionReasons, ...target.plan.data.pendingRequirements].map((reason, index) => <li key={`${reason}-${index}`}>{reason}</li>)}</ul></details> : null}
        </article>;
      })}
    </div>
  </section>;
}

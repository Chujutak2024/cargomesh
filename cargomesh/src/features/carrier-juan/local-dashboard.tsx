"use client";
import { type ReactNode } from "react";
import { ArrowRight, Building2, CalendarDays, Check, ClipboardCheck, Package, Truck } from "lucide-react";
import { useLocale } from "@/features/i18n/locale-provider";
import { LocalRequestJourney } from "./local-request-journey";
import { LocalCargoCharts } from "./local-cargo-charts";
import { localRequestReference, localRequestStateLabel } from "./local-request-presentation";
import type { LocalDraftEnvelope } from "./local-draft-model";
import type { LocalRequestEntry } from "./local-request-demo";
import { dateLabel, locationLabel } from "./local-draft-controls";
import { localDraftStepHref, localDraftSteps } from "./local-draft-flow";
import { truckLabel } from "./local-truck-preference";
import portal from "./portal.module.css";
import s from "./local-dashboard.module.css";
import {RequestOperationNotice} from "./request-incidents";
import {useOperations} from "./use-operations";
import {requestOperation} from "./operations-model";

type Props = { record: LocalDraftEnvelope; entries: LocalRequestEntry[]; activeId: string;
  select: (id: string) => boolean; truckVisual: ReactNode };

export function LocalDashboard({ record, entries, activeId, select, truckVisual }: Props) {
  const { locale, t } = useLocale(), draft = record.draft;
  const operations=useOperations(),cancelled=requestOperation(operations.state,activeId).status==="CANCELLED";
  const total = draft.quantity * draft.unitWeightKg;
  const origin = locationLabel(draft.originId, locale), destination = locationLabel(draft.destinationId, locale);
  const next = Math.min(draft.completedStep, 4);
  return <div className={s.dashboard}>
    <div className={s.panelToolbar}><div className={s.panelProvenance}><a href="#/shipments">{t("Ver las solicitudes", "View requests")} →</a></div>
      <div className={s.requestPicker}><label htmlFor="dashboard-local-request">{t("Solicitud seleccionada", "Selected request")}</label>
        <select id="dashboard-local-request" value={activeId} onChange={event => select(event.target.value)}>{entries.map(entry => <option key={entry.id} value={entry.id}>{localRequestReference(entry.id)} · {locationLabel(entry.record.draft.originId, locale)} → {locationLabel(entry.record.draft.destinationId, locale)}</option>)}</select></div></div>
    <div className={`${portal.metrics} ${s.metrics}`}>{[
      [t("Solicitudes", "Requests"), String(entries.length), t("Disponibles para consultar", "Available to inspect")],
      [t("Carga seleccionada", "Selected cargo"), `${total.toLocaleString(locale === "es" ? "es-PE" : "en-US")} kg`, `${draft.quantity.toLocaleString(locale === "es" ? "es-PE" : "en-US")} ${t("unidades", "units")} × ${draft.unitWeightKg.toLocaleString(locale === "es" ? "es-PE" : "en-US")} kg`],
      [t("Avance de revisión", "Review progress"), `${draft.completedStep} / 5`, t("Pasos comprobados de esta solicitud", "Checked steps for this request")],
    ].map(([label, value, detail]) => <div className={portal.metric} key={label}><small>{label}</small><strong>{value}</strong><small>{detail}</small></div>)}</div>
    <RequestOperationNotice requestId={activeId}/>
    <LocalRequestJourney key={activeId} draft={draft} requestId={activeId} inactive={cancelled}/>
    <section className={`${portal.card} ${s.requestSummary}`} aria-label={t("Resumen de la solicitud seleccionada", "Selected request summary")}>
      <div className={s.summaryMain}>
        <div className={s.summaryOverview}><div className={s.summaryText}>
          <span className={portal.status}>{cancelled?t("Cancelada","Cancelled"):localRequestStateLabel(draft, locale)}</span>
          <h2><Truck size={21} aria-hidden="true"/>{origin}<ArrowRight size={18} aria-hidden="true"/>{destination}</h2>
          <p>{draft.cargoDescription.trim() || t("Descripción de carga por completar", "Cargo description to complete")}</p>
          <div className={s.summaryFacts}><span><Package size={15} aria-hidden="true"/>{draft.quantity.toLocaleString(locale === "es" ? "es-PE" : "en-US")} × {draft.unitWeightKg.toLocaleString(locale === "es" ? "es-PE" : "en-US")} kg</span><span><Building2 size={15} aria-hidden="true"/>{t("Transporte por carretera", "Road transport")}</span></div>
          <LocalCargoCharts draft={draft} entries={entries}/>
          <dl className={s.schedule}>
          <div><dt><CalendarDays size={15} aria-hidden="true"/>{t("Recogida", "Pickup")}</dt><dd>{draft.pickupDate ? dateLabel(draft.pickupDate, locale, t) : t("Fecha por definir", "Date to set")}</dd><a href={localDraftStepHref(3)}>{t("Editar fechas", "Edit dates")} →</a></div>
          <div><dt><CalendarDays size={15} aria-hidden="true"/>{t("Entrega", "Delivery")}</dt><dd>{draft.deliveryDate ? dateLabel(draft.deliveryDate, locale, t) : t("Fecha por definir", "Date to set")}</dd></div>
          <div><dt><Truck size={15} aria-hidden="true"/>{t("Camión preferido", "Preferred truck")}</dt><dd>{draft.truckPreference ? truckLabel(draft.truckPreference, locale) : t("Sin elegir", "Not chosen")}</dd><a href={localDraftStepHref(1)}>{t("Cambiar camión", "Change truck")} →</a></div>
          </dl>
        </div><div className={s.truckVisual}>{truckVisual}</div></div>
      </div>
      <aside className={s.nextAction}><span className={s.nextIcon}><ClipboardCheck size={22} aria-hidden="true"/></span><span className={portal.eyebrow}>{t("Siguiente acción", "Next action")}</span>
        <h3>{draft.completedStep === 5 ? t("Revisión completada", "Review completed") : localDraftSteps[next][locale]}</h3>
        <ol className={s.reviewProgress} aria-label={t("Progreso de revisión local", "Local review progress")}>{localDraftSteps.map((step, index) => <li key={step.id} data-complete={index < draft.completedStep} data-current={index === next && draft.completedStep < 5}><span aria-hidden="true">{index < draft.completedStep ? <Check size={12}/> : index + 1}</span><span className={s.srOnly}>{step[locale]}: {index < draft.completedStep ? t("comprobado", "checked") : t("pendiente", "pending")}</span></li>)}</ol>
        <p>{draft.completedStep} {t("de 5 pasos comprobados", "of 5 steps checked")}</p>
        <a className={`${portal.localButton} ${portal.primary}`} href={cancelled?"#/tracking":localDraftStepHref(next)}>{cancelled?t("Ver cancelación","View cancellation"):draft.completedStep === 5 ? t("Ver revisión", "View review") : t("Continuar revisión", "Continue review")}<ArrowRight size={16} aria-hidden="true"/></a>
        <a className={portal.localButton} href="#/tracking">{t("Ver ruta en el mapa", "View route on map")}<ArrowRight size={16} aria-hidden="true"/></a>
      </aside>
    </section>
  </div>;
}

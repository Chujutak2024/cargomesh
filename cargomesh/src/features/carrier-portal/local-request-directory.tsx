"use client";
import { useState, useSyncExternalStore, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, CalendarDays, Check, CheckCircle2, ClipboardList, Clock3, Package, Search, Truck } from "lucide-react";
import { useLocale } from "@/features/i18n/locale-provider";
import type { LocalDraftEnvelope } from "./local-draft-model";
import { localDraftStepHref, localDraftSteps } from "./local-draft-flow";
import { dateLabel, locationLabel } from "./local-draft-controls";
import type { LocalRequestEntry } from "./local-request-demo";
import { truckLabel } from "./local-truck-preference";
import { LocalRequestJourney } from "./local-request-journey";
import { localRequestReference, localRequestState, localRequestStateLabel } from "./local-request-presentation";
import portal from "./portal.module.css";
import s from "./local-request-directory.module.css";
import {useOperations} from "./use-operations";
import {requestOperation} from "./operations-model";
import {RequestOperationNotice} from "./request-incidents";

function subscribeHash(notify: () => void) { window.addEventListener("hashchange", notify); return () => window.removeEventListener("hashchange", notify); }
const readHash = () => window.location.hash, serverHash = () => "";
function requestState(record: LocalDraftEnvelope) { return localRequestState(record.draft); }
type Props = { record: LocalDraftEnvelope; truckVisual: ReactNode; entries: LocalRequestEntry[]; activeId: string;
  onOpen: (id: string) => void; onRoute: (id: string) => void };
export function LocalRequestDirectory({ record, truckVisual, entries, activeId, onOpen, onRoute }: Props) {
  const { locale, t } = useLocale(), draft = record.draft;
  const ops=useOperations();
  const statusFor=(entry:LocalRequestEntry)=>requestOperation(ops.state,entry.id).status==="CANCELLED"?"cancelled":requestState(entry.record);
  const cancelled=requestOperation(ops.state,activeId).status==="CANCELLED";
  const hash = useSyncExternalStore(subscribeHash, readHash, serverHash);
  const [search, setSearch] = useState(""), [state, setState] = useState("all");
  const stateLabel = (value: string) => value==="cancelled"?t("Cancelada","Cancelled"):value === "ready" ? t("Revisada", "Reviewed") : value === "review" ? t("En revisión", "In review") : t("Pendiente de revisión", "Awaiting review");
  const focusedId = hash.match(/^#\/shipments\/details\/([^/?#]+)/)?.[1];
  const detailed = entries.some(entry => entry.id === focusedId);
  const filtered = entries.filter(entry => (state === "all" || statusFor(entry) === state)
    && [entry.id, localRequestReference(entry.id), locationLabel(entry.record.draft.originId, locale), locationLabel(entry.record.draft.destinationId, locale), entry.record.draft.cargoDescription]
      .join(" ").toLocaleLowerCase(locale).includes(search.trim().toLocaleLowerCase(locale)));
  if (!detailed) return <div className={s.directory}>
    <dl className={s.summary} aria-label={t("Resumen de solicitudes locales", "Local request summary")}>
      <div><dt><ClipboardList size={18} aria-hidden="true"/>{t("Solicitudes", "Requests")}</dt><dd>{entries.length}</dd><small>{t("Guardadas en este dispositivo", "Saved on this device")}</small></div>
      <div><dt><Package size={18} aria-hidden="true"/>{t("Peso total de las solicitudes", "Total request weight")}</dt><dd>{entries.reduce((sum, entry) => sum + entry.record.draft.quantity * entry.record.draft.unitWeightKg, 0).toLocaleString(locale === "es" ? "es-PE" : "en-US")} <span>kg</span></dd><small>{t("Suma de las solicitudes de esta vista", "Total across requests in this view")}</small></div>
      <div><dt><CheckCircle2 size={18} aria-hidden="true"/>{t("Revisadas", "Reviewed")}</dt><dd>{entries.filter(entry => entry.record.draft.savedForReview).length}</dd><small>{t("Revisión completada", "Review completed")}</small></div>
    </dl>
    <div className={s.directoryHeading}><div><h2>{t("Directorio de solicitudes", "Request directory")}</h2><p>{t("Abre una solicitud para ver su ficha y continuar la revisión.", "Open a request to inspect its details and continue the review.")}</p></div></div>
    <div className={s.filters}><label><span>{t("Buscar solicitud, ciudad o carga", "Search request, city or cargo")}</span><span className={s.searchInput}><Search size={17} aria-hidden="true"/><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder={t("Ej. Lima o alimentos", "E.g. Lima or food")}/></span></label>
      <label><span>{t("Estado de revisión", "Review state")}</span><select value={state} onChange={event => setState(event.target.value)}><option value="all">{t("Todos", "All")}</option>{["draft", "review", "ready","cancelled"].map(value => <option key={value} value={value}>{stateLabel(value)}</option>)}</select></label>
      <span className={s.resultCount} role="status">{filtered.length} {t("de", "of")} {entries.length} {t("solicitudes", "requests")}</span>
    </div>
    <div className={s.requestGrid}>{filtered.map(entry => {
      const value = entry.record.draft, status = statusFor(entry), truck = value.truckPreference;
      const poster = truck?.type === "custom" && truck.photoDataUrl ? truck.photoDataUrl : truck && truck.type !== "custom" && truck.type !== "articulated" ? `/v2-workspace/trucks/${truck.type}-3d.png` : "/v2-workspace/cargomesh-truck-poster.webp";
      return <article key={entry.id} className={s.directoryCard} data-current={entry.id === activeId} data-state={status} aria-label={localRequestReference(entry.id)}>
        <header><strong>{localRequestReference(entry.id)}</strong><span className={s.originBadge}>{t("Por carretera", "By road")}</span></header>
        <div className={s.cardRoute}><div><small>{t("Origen", "Origin")}</small><h3>{locationLabel(value.originId, locale)}</h3></div><ArrowRight size={16} aria-hidden="true"/><div><small>{t("Destino", "Destination")}</small><h3>{locationLabel(value.destinationId, locale)}</h3></div></div>
        <div className={s.cargoPreview}><div><Package size={15} aria-hidden="true"/><p>{value.cargoDescription || t("Carga pendiente", "Cargo pending")}</p><small>{truckLabel(truck, locale)}</small></div>{/* Original illustrative visual, not an assigned truck. */}<img src={poster} width={120} height={78} alt="" loading="lazy"/></div>
        <dl className={s.cardFacts}><div><dt>{t("Peso total", "Total weight")}</dt><dd>{(value.quantity * value.unitWeightKg).toLocaleString(locale === "es" ? "es-PE" : "en-US")} kg</dd></div><div><dt>{t("Recogida", "Pickup")}</dt><dd>{dateLabel(value.pickupDate, locale, t)}</dd></div></dl>
        <div className={s.cardProgress}><span className={s.reviewState}>{stateLabel(status)}</span><span>{value.completedStep}/5</span><progress max={5} value={value.completedStep} aria-label={`${t("Pasos de", "Steps for")} ${localRequestReference(entry.id)}`}/></div>
        <footer><button type="button" onClick={() => onOpen(entry.id)} aria-label={`${t("Abrir solicitud", "Open request")} ${localRequestReference(entry.id)}`}>{t("Abrir solicitud", "Open request")}<ArrowRight size={15} aria-hidden="true"/></button><button type="button" onClick={() => onRoute(entry.id)} aria-label={`${t("Ver ruta de", "View route for")} ${localRequestReference(entry.id)}`}>{t("Ver ruta", "View route")}<Truck size={15} aria-hidden="true"/></button></footer>
      </article>;
    })}</div>
    {!filtered.length ? <div className={`${portal.card} ${s.noResults}`}><Search size={24} aria-hidden="true"/><h2>{t("Sin coincidencias", "No matches")}</h2><p>{t("Prueba con otra ciudad, carga o estado de revisión.", "Try another city, cargo or review state.")}</p><button onClick={() => { setSearch(""); setState("all"); }}>{t("Limpiar filtros", "Clear filters")}</button></div> : null}
  </div>;
  const checked = draft.completedStep, next = Math.min(checked, 4);
  const total = draft.quantity * draft.unitWeightKg;
  return <div className={s.directory}>
    <div className={s.detailHeading}><a className={portal.localButton} href="#/shipments"><ArrowLeft size={16} aria-hidden="true"/>{t("Todas las solicitudes", "All requests")}</a><strong>{localRequestReference(activeId)}</strong></div>
    <dl className={s.summary} aria-label={t("Resumen de solicitudes locales", "Local request summary")}>
      <div><dt><ClipboardList size={18} aria-hidden="true"/>{t("Solicitudes", "Requests")}</dt><dd>{entries.length}</dd><small>{t("En este dispositivo", "On this device")}</small></div>
      <div><dt><Package size={18} aria-hidden="true"/>{t("Peso de la carga", "Cargo weight")}</dt><dd>{total.toLocaleString(locale === "es" ? "es-PE" : "en-US")} <span>kg</span></dd><small>{draft.quantity.toLocaleString(locale === "es" ? "es-PE" : "en-US")} {t("unidades", "units")}</small></div>
      <div><dt><CalendarDays size={18} aria-hidden="true"/>{t("Recogida prevista", "Planned pickup")}</dt><dd className={s.date}>{dateLabel(draft.pickupDate, locale, t)}</dd><small>{t("Fecha solicitada", "Requested date")}</small></div>
    </dl>
    <div className={s.layout}>
      <section className={`${portal.card} ${s.requestCard}`} aria-label={t("Solicitud guardada en este dispositivo", "Request saved on this device")}>
        <div className={s.cardHeading}><div><span className={`${portal.eyebrow} ${s.typeLabel}`}>{t("Por carretera", "By road")}</span><h2>{t("Detalle de la solicitud", "Request details")}</h2></div>
          <span className={`${portal.status} ${s.stateBadge}`}>{cancelled?t("Cancelada","Cancelled"):localRequestStateLabel(draft, locale)}</span>
        </div>
        <div className={s.requestBody}>
          <RequestOperationNotice requestId={activeId}/>
          <LocalRequestJourney draft={draft} embedded inactive={cancelled}/>
          <div className={s.detailContext}><div className={s.detailCargo}><h3>{t("Carga solicitada", "Requested cargo")}</h3><p>{draft.cargoDescription || t("Descripción por completar", "Description to complete")}</p><span><Package size={16} aria-hidden="true"/>{draft.quantity.toLocaleString(locale === "es" ? "es-PE" : "en-US")} {t("unidades", "units")} × {draft.unitWeightKg.toLocaleString(locale === "es" ? "es-PE" : "en-US")} kg</span><a href={localDraftStepHref(2)}>{t("Editar carga", "Edit cargo")} →</a></div><div className={s.truckVisual}>{truckVisual}</div></div>
        </div>
        <footer className={s.cardFooter}><span><Clock3 size={14} aria-hidden="true"/>{t("Guardado", "Saved")} {new Date(record.updatedAt).toLocaleDateString(locale === "es" ? "es-PE" : "en-US")}</span>
          <div><a className={portal.localButton} href="#/tracking">{t("Ver ruta", "View route")}<ArrowRight size={15} aria-hidden="true"/></a><a className={`${portal.localButton} ${portal.primary}`} href={localDraftStepHref(4)}>{t("Revisar solicitud", "Review request")}<ArrowRight size={15} aria-hidden="true"/></a></div>
        </footer>
      </section>
      <aside className={`${portal.card} ${s.reviewCard}`} aria-label={t("Avance de la solicitud", "Request progress")}>
        <span className={portal.eyebrow}>{t("Avance de revisión", "Review progress")}</span>
        <h2>{checked === 5 ? t("Revisión completada", "Review completed") : t("Continúa con el siguiente paso", "Continue with the next step")}</h2>
        <div className={s.progressHeading}><span>{t("Pasos comprobados", "Checked steps")}</span><strong>{checked} / 5</strong></div>
        <progress className={s.progress} max={5} value={checked} aria-label={t("Pasos comprobados de la solicitud", "Checked request steps")}/>
        <ol className={s.reviewSteps}>{localDraftSteps.map((step, index) => <li key={step.id} data-checked={index < checked} data-next={index === next && checked < 5}>
          <a href={localDraftStepHref(index)}><span className={s.stepMark}>{index < checked ? <Check size={15} aria-hidden="true"/> : index + 1}</span><span>{step[locale]}<small>{index < checked ? t("Comprobado", "Checked") : index === next ? t("Siguiente", "Next") : t("Pendiente", "Pending")}</small></span><ArrowRight size={14} aria-hidden="true"/></a>
        </li>)}</ol>
        <a className={`${portal.localButton} ${portal.primary} ${s.continue}`} href={localDraftStepHref(next)}>{checked === 5 ? t("Ver revisión", "View review") : t("Continuar revisión", "Continue review")}<ArrowRight size={16} aria-hidden="true"/></a>
      </aside>
    </div>
  </div>;
}

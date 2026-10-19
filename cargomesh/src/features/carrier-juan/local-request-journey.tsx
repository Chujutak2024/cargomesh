"use client";
import { useId, useState, type CSSProperties } from "react";
import { ArrowRight, Building2, Check, Clock3, GitBranch, MapPin, Navigation, Route, Truck } from "lucide-react";
import { useLocale } from "@/features/i18n/locale-provider";
import { landRoutePolicy } from "@/features/v2-workspace/road-locations";
import type { LocalDraft } from "./local-draft-model";
import { locationLabel } from "./local-draft-controls";
import { localDraftStepHref } from "./local-draft-flow";
import { durationLabel, journeyTime } from "./journey-model";
import { useJourney } from "./use-journey";
import portal from "./portal.module.css";
import s from "./journey.module.css";

export function LocalRequestJourney({ draft, requestId = "CM-LOCAL-01", embedded = false, inactive = false, onOpenMap }: { draft: LocalDraft; requestId?: string; embedded?: boolean; inactive?: boolean; onOpenMap?: () => void }) {
  const { t, locale } = useLocale(), heading = useId(), details = useId();
  const journey = useJourney(requestId, inactive), [selected, setSelected] = useState<number | null>(null), [compare, setCompare] = useState(false);
  const origin = locationLabel(draft.originId, locale), destination = locationLabel(draft.destinationId, locale);
  const available = landRoutePolicy(draft.originId, draft.destinationId) === "previewable";
  const stops = [
    { name: origin, title: t("Salida de origen", "Departure"), description: t("Carga preparada y salida del punto de recogida.", "Cargo prepared for departure from the pickup point."), fraction: 0 },
    { name: t("Control de salida", "Departure checkpoint"), title: t("Control de salida", "Departure checkpoint"), description: t("Comprobación de documentación y carga antes del tramo principal.", "Document and cargo check before the main journey."), fraction: .22 },
    { name: t("Tramo en carretera", "Road segment"), title: t("Tramo en carretera", "Road segment"), description: t("Traslado hacia el destino. Consulta el mapa para explorar el trayecto.", "Travel towards the destination. Open the map to explore the route."), fraction: .5 },
    { name: t("Control de paso", "Transit checkpoint"), title: t("Último control de paso", "Last transit checkpoint"), description: t("Acceso al tramo final y coordinación de la recepción en destino.", "Final approach and destination reception coordination."), fraction: .8 },
    { name: destination, title: t("Recepción en destino", "Destination reception"), description: t("Llegada prevista, ingreso a la sede y recepción de la carga.", "Planned arrival, depot entry and cargo reception."), fraction: 1 },
  ];
  const current = selected ?? journey.stage, stop = stops[current], eta = journey.departure + journey.minutes + journey.delay;
  const phase = inactive ? "stopped" : journey.progress >= .8 ? "arrival" : journey.progress >= .4 ? "road" : "departure";
  return <section className={`${portal.card} ${s.root} ${embedded ? s.embedded : ""}`} aria-labelledby={heading} data-inactive={inactive}>
    <header className={s.header}><div className={s.heading}><span className={s.headingIcon}><Route size={21} aria-hidden="true"/></span><div><h2 id={heading}>{t("Recorrido de la solicitud", "Request journey")}</h2><p>{t("Consulta cada etapa del traslado", "Explore each journey stage")}</p></div></div><span className={s.status} data-phase={phase}><i aria-hidden="true"/>{journey.status}</span></header>
    {available ? <>
      <div className={s.overview}>
        <div className={s.progressMetric}><div className={s.gauge} role="progressbar" aria-label={t("Avance del trayecto", "Journey progress")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(journey.progress * 100)}>
          <svg viewBox="0 0 100 100" aria-hidden="true"><circle className={s.gaugeTrack} cx="50" cy="50" r="42"/><circle className={s.gaugeFill} cx="50" cy="50" r="42" pathLength="100" strokeDasharray="100" strokeDashoffset={100 - journey.progress * 100}/></svg><strong>{Math.round(journey.progress * 100)}<small>%</small></strong></div>
          <div><span>{t("Avance del trayecto", "Journey progress")}</span><p>{stops[journey.stage].title}</p></div>
        </div>
        <div className={s.timeMetric}><span className={s.metricIcon}><Clock3 size={21} aria-hidden="true"/></span><div><span>{t("Tiempo restante", "Time remaining")}</span><strong>{durationLabel(journey.remaining)}</strong><small>{t("Hasta el destino", "To destination")}</small></div></div>
        <div className={s.arrivalMetric}><span className={s.metricIcon}><MapPin size={21} aria-hidden="true"/></span><div><span>{t("Llegada prevista", "Planned arrival")}</span><strong>{journeyTime(eta)}</strong><small>{destination}</small></div></div>
      </div>
      <div className={s.track} style={{ "--progress": `${journey.progress * 100}%` } as CSSProperties}>
        <div className={s.line} aria-hidden="true"><span/><i className={s.truck}><Truck size={21}/></i></div>
        <ol className={s.stops} aria-label={t("Etapas del recorrido", "Journey stages")}>{stops.map((item, index) => <li key={index} data-complete={journey.progress >= item.fraction} style={{ "--stop-position": `${item.fraction * 100}%` } as CSSProperties}>
          <button type="button" aria-pressed={current === index} aria-controls={details} onClick={() => setSelected(index)}><span className={s.dot}>{index === 4 ? <Building2 size={17} aria-hidden="true"/> : journey.progress >= item.fraction ? <Check size={14} aria-hidden="true"/> : index + 1}</span><span className={s.stopLabel}><strong>{item.name}</strong><small>{journeyTime(journey.departure + journey.minutes * item.fraction + (index === 4 ? journey.delay : 0))}{index === 4 ? ` · ${t("Llegada", "Arrival")}` : ""}</small></span></button>
        </li>)}</ol>
      </div>
      <div className={s.detail} id={details}><span className={s.detailIcon}><Navigation size={21} aria-hidden="true"/></span><div key={current} className={s.detailCopy}><strong>{stop.title}</strong><p>{stop.description}</p></div><span className={s.stageTag}>{current === journey.stage ? t("Etapa actual", "Current stage") : journey.progress >= stop.fraction ? t("Tramo recorrido", "Passed segment") : t("Por delante", "Ahead")}</span></div>
      {compare ? <div className={s.comparison} role="region" aria-label={t("Comparación de tiempos", "Time comparison")}><div><span>{t("Llegada prevista", "Planned arrival")}</span><strong>{journeyTime(eta)}</strong><small>{journey.delay ? `${journey.delay} min · ${t("margen de tránsito", "transit allowance")}` : t("Sin margen adicional", "No additional allowance")}</small></div><div><span><GitBranch size={14}/>{t("Alternativa de planificación", "Planning alternative")}</span><strong>{journeyTime(eta - journey.alternative)}</strong><small>−{journey.alternative} min</small></div><p>{t("Compara los horarios antes de decidir un cambio de recorrido.", "Compare schedules before deciding a route change.")}</p></div> : null}
      <footer className={s.footer}><button type="button" aria-pressed={compare} onClick={() => setCompare(value => !value)}><GitBranch size={16}/>{compare ? t("Cerrar comparación", "Close comparison") : t("Comparar tiempos", "Compare times")}</button>{onOpenMap ? <button type="button" onClick={onOpenMap}><MapPin size={16}/>{t("Abrir mapa", "Open map")}<ArrowRight size={15}/></button> : <a href="#/tracking"><MapPin size={16}/>{t("Abrir mapa", "Open map")}<ArrowRight size={15}/></a>}</footer>
    </> : <p>{t("Selecciona dos ciudades conectadas por carretera.", "Choose two cities connected by road.")} <a href={localDraftStepHref(0)}>{t("Revisar ciudades", "Review cities")} →</a></p>}
  </section>;
}

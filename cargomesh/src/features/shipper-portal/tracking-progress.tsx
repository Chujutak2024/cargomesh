"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { AlertTriangle, Check, CircleHelp, Truck } from "lucide-react";
import { useLocale } from "@/features/i18n/locale-provider";
import { localeTag } from "@/features/i18n/config";
import { formatDateTime } from "./shipper-model";
import { buildTrackingJourney, type JourneyStageKey } from "./tracking-journey";
import { stageName, stageStateName } from "./tracking-presentation";
import s from "./tracking-experience.module.css";

export function TrackingProgress({ journey }: { journey: ReturnType<typeof buildTrackingJourney> }) {
  const { locale, t } = useLocale();
  const [selected, setSelected] = useState<JourneyStageKey>(journey.lastReportedStage ?? "booking");
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const scroll = useRef<HTMLDivElement>(null);
  const stage = journey.stages.find((item) => item.key === selected)!;
  useEffect(() => {
    const viewport = scroll.current;
    const button = buttons.current[journey.stages.findIndex((item) => item.key === selected)];
    if (!viewport || !button) return;
    // Scroll only the milestone strip; never pull the page down on mobile.
    const centerSelected = () => {
      viewport.scrollLeft += button.getBoundingClientRect().left - viewport.getBoundingClientRect().left
        - (viewport.clientWidth - button.clientWidth) / 2;
    };
    centerSelected();
    const observer = new ResizeObserver(centerSelected);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [selected, journey.stages]);
  function navigate(event: KeyboardEvent, index: number) {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % journey.stages.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + journey.stages.length) % journey.stages.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = journey.stages.length - 1;
    else return;
    event.preventDefault();
    setSelected(journey.stages[next].key);
    buttons.current[next]?.focus();
  }
  return <section className={s.panel} aria-labelledby="journey-title">
    <div className={s.panelHeading}><h2 id="journey-title">{t("Etapas del viaje", "Journey milestones")}</h2><span className={s.metaBadge}>{t("Selecciona un hito", "Select a milestone")}</span></div>
    <div className={s.journeyScroll} ref={scroll}><div className={s.journeyRail} role="tablist" aria-label={t("Hitos del transporte", "Transport milestones")}>
      {journey.stages.map((item, index) => <button type="button" role="tab" id={`milestone-${item.key}`} aria-controls="milestone-detail" aria-selected={selected === item.key} tabIndex={selected === item.key ? 0 : -1} ref={(element) => { buttons.current[index] = element; }} key={item.key} className={s.journeyStep} data-state={item.state} onClick={() => setSelected(item.key)} onKeyDown={(event) => navigate(event, index)}>
        <span className={s.stageSymbol} aria-hidden="true">{item.state === "blocked" ? <AlertTriangle size={17}/> : journey.lastReportedStage === item.key ? <Truck size={18}/> : item.state === "completed" ? <Check size={18}/> : item.state === "unknown" ? <CircleHelp size={16}/> : <span className={s.innerDot}/>}</span>
        <strong>{stageName(item.key, t)}</strong><small>{stageStateName(item.state, t)}</small>
      </button>)}
    </div></div>
    <div className={s.stageDetail} role="tabpanel" id="milestone-detail" aria-labelledby={`milestone-${selected}`} tabIndex={0}>
      <div><strong>{stageName(selected, t)}</strong><span className={s.statePill} data-state={stage.state}>{stageStateName(stage.state, t)}</span>{stage.at && <time dateTime={stage.at}>{formatDateTime(stage.at, localeTag(locale))}</time>}</div>
      <p>{stage.state === "unknown" ? t("No hay un reporte independiente que permita verificar esta etapa.", "There is no independent report to verify this milestone.") : stage.state === "blocked" ? t("Revisa las incidencias y el estado de la reserva antes de continuar.", "Review incidents and booking status before continuing.") : stage.state === "future" ? t("Aún no se ha recibido un reporte de esta etapa.", "No report has been received for this milestone yet.") : stage.key === "booking" && stage.state === "current" ? t("La reserva espera confirmación del transportista.", "The booking is awaiting carrier confirmation.") : stage.evidence === "event" ? t("Hito respaldado por un evento del transportista.", "Milestone backed by a carrier event.") : t("Estado registrado en el transporte o su reserva.", "State recorded in the transport or its booking.")}</p>
    </div>
  </section>;
}

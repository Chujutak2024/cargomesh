"use client";

import dynamic from "next/dynamic";
import { Info, Map, Route, Truck } from "lucide-react";
import { useRef, useState, type KeyboardEvent } from "react";
import { RoadMapCanvas } from "@/features/v2-road-map/road-map-canvas";
import { providerNote, type MapPresentation, type MapProvider } from "@/features/v2-road-map/road-map-model";
import { useLocale } from "@/features/i18n/locale-provider";
import { localeTag } from "@/features/i18n/config";
import { formatDateTime } from "./shipper-model";
import s from "./tracking-experience.module.css";

function Loading3D() {
  const { t } = useLocale();
  return <div className={s.empty} role="status"><Truck size={24} aria-hidden="true"/><strong>{t("Preparando vista conceptual…", "Preparing conceptual view…")}</strong></div>;
}
const RouteNavigation3D = dynamic(() => import("@/features/shipper-route-3d/route-navigation-3d"), { ssr: false, loading: Loading3D });

export function TrackingVisual({ presentation, origin, destination, canView3D, milestone, lastReportedAt }: {
  presentation: MapPresentation; origin: string; destination: string; canView3D: boolean; milestone?: string; lastReportedAt?: string | null;
}) {
  const { locale, t } = useLocale();
  const [provider, setProvider] = useState<MapProvider>("loading");
  const [view, setView] = useState<"map" | "3d">("map");
  const [threeFailed, setThreeFailed] = useState(false);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const hasGeometry = presentation.paths.length > 0 && presentation.provenanceStatus !== "UNKNOWN";
  const threeAvailable = canView3D && !threeFailed;
  function navigate(event: KeyboardEvent, index: number) {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next = !threeAvailable || event.key === "Home" ? 0 : event.key === "End" ? 1 : 1 - index;
    setView(next ? "3d" : "map");
    tabs.current[next]?.focus();
  }
  return <section className={s.panel} aria-labelledby="tracking-visual-title">
    <div className={s.panelHeading}><h2 id="tracking-visual-title">{t("Ruta del transporte", "Transport route")}</h2>
      <div className={s.visualTabs} role="tablist" aria-label={t("Vista de ruta", "Route view")}>
        <button type="button" role="tab" id="route-map-tab" aria-controls="route-visual-panel" aria-selected={view === "map"} tabIndex={view === "map" ? 0 : -1} ref={(element) => { tabs.current[0] = element; }} onKeyDown={(event) => navigate(event, 0)} onClick={() => setView("map")}><Map size={16} aria-hidden="true"/>{t("Mapa", "Map")}</button>
        <button type="button" role="tab" id="route-3d-tab" aria-controls="route-visual-panel" aria-selected={view === "3d"} tabIndex={view === "3d" ? 0 : -1} disabled={!threeAvailable} ref={(element) => { tabs.current[1] = element; }} onKeyDown={(event) => navigate(event, 1)} onClick={() => setView("3d")}><Truck size={16} aria-hidden="true"/>{t("Recorrido 3D", "3D journey")}</button>
      </div>
    </div>
    <div className={s.visualBody}>
      <div className={s.visualContext}><span>{t("Último hito", "Last milestone")}: <strong>{milestone ?? t("Sin reporte", "No report")}</strong></span><span>{lastReportedAt ? formatDateTime(lastReportedAt, localeTag(locale)) : t("Sin fecha de reporte", "No report time")}</span></div>
      <div className={s.visualFrame} role="tabpanel" id="route-visual-panel" aria-labelledby={view === "map" ? "route-map-tab" : "route-3d-tab"} tabIndex={0}>
        {view === "3d" && threeAvailable ? <RouteNavigation3D presentation={presentation} origin={origin} destination={destination} embedded locale={locale}
          showProgress={false} cameraControls title={t("Vista conceptual · No GPS", "Conceptual view · Not GPS")}
          onUnavailable={() => { setThreeFailed(true); setView("map"); }}/>
        : hasGeometry ? <div className={s.mapFallback}><RoadMapCanvas presentation={presentation} onProviderChange={setProvider}/><p className={s.visualNote}><Info size={15} aria-hidden="true"/>{providerNote(provider, presentation, locale)}</p></div>
        : <div className={s.empty}><Route size={28} aria-hidden="true"/><strong>{t("Ruta todavía no disponible", "Route not available yet")}</strong><p>{t("No hay geometría verificable enlazada a esta reserva. Puedes consultar los hitos y eventos del transporte.", "No verifiable geometry is linked to this booking. You can still review transport milestones and events.")}</p></div>}
      </div>
      {view === "3d" ? <p className={s.visualNote}><Info size={15} aria-hidden="true"/>{t("Escena ilustrativa; el movimiento no representa la posición ni el avance real de tu carga.", "Illustrative scene; movement does not represent your cargo's actual location or progress.")}</p> : hasGeometry && <p className={s.visualNote}>{t("Ruta planificada, no posición en vivo.", "Planned route, not a live position.")}</p>}
      {threeFailed && <div className={s.visualNote} role="status"><span>{t("3D no disponible. El mapa y los eventos siguen accesibles.", "3D unavailable. Map and events remain accessible.")}</span><button type="button" className={s.heroAction} onClick={() => { setThreeFailed(false); setView("3d"); }}>{t("Reintentar", "Retry")}</button></div>}
      {!canView3D && hasGeometry && <p className={s.visualNote}>{t("3D requiere geometría completa por carretera.", "3D requires complete road geometry.")}</p>}
    </div>
  </section>;
}

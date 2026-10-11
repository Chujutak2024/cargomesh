"use client";

import dynamic from "next/dynamic";
import { Info, Map, Navigation2, Route, Truck } from "lucide-react";
import { useState } from "react";
import { RoadMapCanvas } from "@/features/v2-road-map/road-map-canvas";
import { providerNote, type MapPresentation, type MapProvider } from "@/features/v2-road-map/road-map-model";
import { useLocale } from "@/features/i18n/locale-provider";
import s from "./tracking-experience.module.css";

const RouteNavigation3D = dynamic(() => import("@/features/logistics-3d/route-navigation-3d"), {
  ssr: false, loading: () => <div className={s.empty} role="status"><Truck size={24} aria-hidden="true"/><strong>Loading conceptual 3D view…</strong></div>,
});

export function TrackingVisual({ presentation, origin, destination, canView3D }: {
  presentation: MapPresentation; origin: string; destination: string; canView3D: boolean;
}) {
  const { locale, t } = useLocale();
  const [provider, setProvider] = useState<MapProvider>("loading");
  const [view, setView] = useState<"map" | "3d">("map");
  const [threeFailed, setThreeFailed] = useState(false);
  const hasGeometry = presentation.paths.length > 0 && presentation.provenanceStatus !== "UNKNOWN";
  return <section className={s.panel} aria-labelledby="tracking-visual-title">
    <div className={s.panelHeading}><div><span className={s.eyebrow}>{t("Territorio y contexto", "Territory and context")}</span><h2 id="tracking-visual-title">{t("Ruta y vista conceptual", "Route and conceptual view")}</h2><p>{t("Mapa y 3D usan la misma ruta enlazada al booking; ninguno infiere la posición actual del camión.", "Map and 3D use the same route linked to the booking; neither infers the truck's current position.")}</p></div><Navigation2 size={21} aria-hidden="true"/></div>
    <div className={s.visualBody}>
      <div className={s.visualTabs} role="group" aria-label={t("Tipo de visualización", "Visualization type")}><button type="button" aria-pressed={view === "map"} onClick={() => setView("map")}><Map size={15} aria-hidden="true"/> {t("Mapa", "Map")}</button><button type="button" aria-pressed={view === "3d"} disabled={!canView3D || threeFailed} onClick={() => setView("3d")}><Truck size={15} aria-hidden="true"/> {t("Recorrido 3D", "3D journey")}</button></div>
      {view === "3d" && canView3D && !threeFailed ? <>
        <p className={s.visualNote}><Info size={15} aria-hidden="true"/>{t(
          "Animación conceptual: el camión avanza por un escenario ilustrativo de la ruta y continúa visualmente después; no indica ubicación, progreso ni tiempo real de esta carga. Se pausa si tu sistema solicita reducir movimiento. Cambia la cámara con los controles del visor.",
          "Conceptual animation: the truck moves through an illustrated route scene and continues visually beyond it; this is not the shipment's live location, progress, or timing. Motion pauses when your system requests reduced motion. Change the camera with the viewer controls.",
        )}</p>
        <RouteNavigation3D presentation={presentation} origin={origin} destination={destination}
          showProgress={false} cameraControls title={t("Camión ilustrativo", "Illustrative truck")}
          onUnavailable={() => { setThreeFailed(true); setView("map"); }}/>
      </> : hasGeometry ? <div className={s.mapFallback}><RoadMapCanvas presentation={presentation} onProviderChange={setProvider}/><p className={s.visualNote}><Info size={15} aria-hidden="true"/>{providerNote(provider, presentation, locale)} · {t("La línea es geometría de ruta, no la posición del vehículo.", "The line is route geometry, not vehicle position.")}</p>{threeFailed ? <p className={s.visualNote} role="status">{t("El visor 3D no pudo iniciarse; mapa y cronología permanecen disponibles.", "The 3D viewer could not start; map and timeline remain available.")}</p> : null}</div> : <div className={s.empty}><Route size={24} aria-hidden="true"/><strong>{t("Ruta no verificable para este transporte", "No verifiable route for this transport")}</strong><p>{t("Falta una cadena booking→decisión→plan→ruta, coordenadas completas o procedencia. No dibujamos una ruta aproximada.", "The booking→decision→plan→route link, complete coordinates or provenance is missing. We do not draw an approximate route.")}</p></div>}
      {!canView3D && hasGeometry ? <p className={s.visualNote}><Info size={15} aria-hidden="true"/>{t("La vista 3D sólo admite itinerarios ROAD completos. El mapa y los eventos siguen disponibles.", "3D is available only for complete ROAD itineraries. The map and events remain available.")}</p> : null}
    </div>
  </section>;
}

"use client";

import dynamic from "next/dynamic";
import { Info } from "lucide-react";
import { RoadMapCanvas } from "@/features/v2-road-map/road-map-canvas";
import { providerNote, type MapPresentation } from "@/features/v2-road-map/road-map-model";
import { useLocale } from "@/features/i18n/locale-provider";
import { useState } from "react";
import type { MapProvider } from "@/features/v2-road-map/road-map-model";
import styles from "./shipper-portal.module.css";

const RouteNavigation3D = dynamic(() => import("@/features/logistics-3d/route-navigation-3d"), { ssr: false });

export function TrackingVisual({ presentation, origin, destination, progress, inactive }: {
  presentation: MapPresentation; origin: string; destination: string; progress: number; inactive: boolean;
}) {
  const { locale, t } = useLocale();
  const [provider, setProvider] = useState<MapProvider>("loading");
  const hasGeometry = presentation.paths.length > 0 && presentation.provenanceStatus !== "UNKNOWN";
  return <div className={styles.page}><section className={styles.panel}><header className={styles.panelHeader}><div><h2>{t("Mapa operativo", "Operational map")}</h2><p>{t("Geometría persistida; no GPS simulado", "Persisted geometry; no simulated GPS")}</p></div></header>
    {hasGeometry ? <><RoadMapCanvas presentation={presentation} onProviderChange={setProvider}/><p className={styles.notice}><Info size={15}/>{providerNote(provider, presentation, locale)}</p></>
      : <div className={styles.empty}><strong>{t("Geometría desconocida", "Unknown geometry")}</strong><p>{t("No se dibuja una ruta hasta que el backend entregue coordenadas y procedencia utilizables.", "No route is drawn until the backend provides usable coordinates and provenance.")}</p></div>}</section>
    <section className={styles.panel}><header className={styles.panelHeader}><div><h2>{t("Recorrido 3D", "3D journey")}</h2><p>{t("Visualización derivada de la misma geometría", "Visualization derived from the same geometry")}</p></div></header>
      {hasGeometry ? <RouteNavigation3D presentation={presentation} origin={origin} destination={destination} initialProgress={progress / 100} inactive={inactive}/>
        : <div className={styles.empty}><strong>{t("Vista 3D no disponible", "3D view unavailable")}</strong><p>{t("Se evita inventar un recorrido cuando la geometría es desconocida.", "An invented route is avoided when geometry is unknown.")}</p></div>}</section></div>;
}

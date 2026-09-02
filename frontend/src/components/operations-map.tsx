"use client";

import { MapPin } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { useLocale } from "@/features/i18n/locale-provider";
import styles from "./operations-map.module.css";

export type OperationsMapModel = { bookingId: string; requestCode: string; origin: { city: string; countryCode: string }; destination: { city: string; countryCode: string }; checkpoints: Array<{ id: string; city: string; countryCode: string; label: string; occurredAt: string }> };
const COORDINATES: Record<string, [number, number]> = {
  "PE:Lima": [-12.0464,-77.0428], "PE:Callao": [-12.0566,-77.1181], "PE:Arequipa": [-16.409,-71.5375], "PE:Tacna": [-18.0066,-70.2463], "PE:Matarani": [-17.0054,-72.1011], "PE:Ilo": [-17.6394,-71.3375], "PE:Paita": [-5.0892,-81.1144], "PE:Trujillo": [-8.1116,-79.0287],
  "CL:Arica": [-18.4783,-70.3126], "CL:Antofagasta": [-23.6509,-70.3975], "CL:Santiago": [-33.4489,-70.6693], "CL:Iquique": [-20.2307,-70.1357], "CL:Valparaíso": [-33.0472,-71.6127],
  "CO:Bogotá": [4.711,-74.0721], "CO:Cali": [3.4516,-76.532], "CO:Medellín": [6.2442,-75.5812], "EC:Quito": [-0.1807,-78.4678], "EC:Guayaquil": [-2.1709,-79.9224], "BO:La Paz": [-16.4897,-68.1193], "BO:Santa Cruz de la Sierra": [-17.7833,-63.1821], "AR:Buenos Aires": [-34.6037,-58.3816], "AR:Mendoza": [-32.8895,-68.8458],
};
const point = (place: { city: string; countryCode: string }) => COORDINATES[`${place.countryCode.toUpperCase()}:${place.city}`];

export function OperationsMap({ model }: { model: OperationsMapModel | null }) {
  const element = useRef<HTMLDivElement>(null); const { t } = useLocale();
  const route = useMemo(() => model ? [model.origin, ...model.checkpoints, model.destination].map((place) => ({ ...place, coordinates: point(place) })).filter((place): place is typeof place & { coordinates: [number,number] } => Boolean(place.coordinates)) : [], [model]);
  useEffect(() => {
    if (!element.current || route.length < 2) return;
    let disposed = false; let cleanup = () => {};
    void import("leaflet").then((L) => { if (disposed || !element.current) return; const map = L.map(element.current, { zoomControl: true, attributionControl: true }); L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap contributors", maxZoom: 18 }).addTo(map); const latlngs = route.map((item) => item.coordinates); L.polyline(latlngs, { color: "#185c55", weight: 4, opacity: 0.85, dashArray: "8 7" }).addTo(map); route.forEach((item, index) => L.circleMarker(item.coordinates, { radius: index === 0 || index === route.length-1 ? 7 : 5, color: "#fff", weight: 2, fillColor: "#2bae9a", fillOpacity: 1 }).bindTooltip(`${item.city}, ${item.countryCode}`).addTo(map)); map.fitBounds(L.latLngBounds(latlngs), { padding: [34,34] }); cleanup = () => map.remove(); });
    return () => { disposed = true; cleanup(); };
  }, [route]);
  if (!model || route.length < 2) return <div className={styles.empty}><MapPin size={27}/><strong>{t("Sin ruta autorizada para mostrar", "No authorized route to display")}</strong><p>{t("Se necesita un booking confirmado o en tránsito y ubicaciones reconocibles en la solicitud o sus eventos.", "A confirmed or in-transit booking and recognizable locations in the request or its events are required.")}</p></div>;
  return <div className={styles.wrapper}><div className={styles.notice}><strong>{model.requestCode}</strong><span>{t("Referencia cartográfica basada en solicitud y eventos del carrier. No es GPS en vivo.", "Map reference based on request and carrier events. This is not live GPS.")}</span></div><div ref={element} className={styles.map} aria-label={t("Mapa de ruta persistida", "Persisted route map")}/></div>;
}

"use client";
import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { Info, Navigation, Upload } from "lucide-react";
import { useLocale } from "@/features/i18n/locale-provider";
import { RoadMapCanvas } from "@/features/v2-road-map/road-map-canvas";
import { providerNote, type MapProvider } from "@/features/v2-road-map/road-map-model";
import { cityLabel, countryLabel, findRoadLocation } from "@/features/v2-workspace/road-locations";
import { useLocalRoadPreview } from "@/features/v2-workspace/use-local-road-preview";
import { localMapPresentation,
  type LocalDraft } from "./local-draft-model";
import { truckLabel, truckPhotoIssue, maxStoredTruckPhotoLength } from "./local-truck-preference";
import { RouteNavigationDialog } from "./route-navigation-dialog";
import { journeySnapshot } from "./journey-model";
import { buildRouteTrack, routePose } from "@/features/logistics-3d/route-track";
import s from "./portal.module.css";
import layout from "./route-map-layout.module.css";

type Translate = (es: string, en: string) => string;
export function locationLabel(id: string, locale: "es" | "en") {
  const location = findRoadLocation(id);
  return location ? `${cityLabel(location, locale)}, ${countryLabel(location.countryCode, locale)}` : id;
}
export function dateLabel(value: string, locale: "es" | "en", t: Translate) {
  return value ? new Date(`${value}T12:00:00Z`).toLocaleDateString(locale === "es" ? "es-PE" : "en-US", { timeZone: "UTC" })
    : t("Sin registrar", "Not recorded");
}
export function LocalRoute({ draft, embedded = false, requestId, inactive = false, preference, sidebar }: { draft: LocalDraft; embedded?: boolean; requestId?: string; inactive?: boolean; preference?: LocalDraft["truckPreference"]; sidebar?: ReactNode }) {
  const { t, locale } = useLocale();
  const result = useLocalRoadPreview(draft.originId, draft.destinationId, true);
  const presentation = useMemo(() => localMapPresentation(draft, result?.preview ?? null), [draft, result?.preview]);
  const journey = useMemo(() => journeySnapshot(requestId ?? "CM-LOCAL-01", 0, inactive), [requestId, inactive]);
  const mapped = useMemo(() => {
    const track = requestId ? buildRouteTrack(presentation.paths) : null;
    return track ? { ...presentation, markers: presentation.markers.map(marker => marker.kind === "origin" ? { ...marker, point: routePose(track, track.total * journey.progress).point, label: "Camión en recorrido" } : marker) } : presentation;
  }, [presentation, requestId, journey.progress]);
  const truck = preference ?? draft.truckPreference;
  const [provider, setProvider] = useState<MapProvider>("loading");
  const [view3d,setView3d]=useState(false);
  const report = useCallback((value: MapProvider) => setProvider(value), []);
  const facts = <div className={sidebar ? layout.facts : undefined}><h3>{t("Datos de ruta", "Route data")}</h3><dl className={s.details}>
    <div><dt>{t("Distancia", "Distance")}</dt><dd>{presentation.distanceKm === null ? t("No disponible", "Unavailable") : `${presentation.distanceKm.toLocaleString(locale === "es" ? "es-PE" : "en-US")} km`}</dd></div>
    <div><dt>{t("Tiempo estimado", "Estimated time")}</dt><dd>{presentation.estimatedTransitHours === null ? t("No disponible", "Unavailable") : `${presentation.estimatedTransitHours.toLocaleString(locale === "es" ? "es-PE" : "en-US")} h`}</dd></div>
    <div><dt>{t("Camión preferido", "Preferred truck")}</dt><dd>{truckLabel(truck, locale)}</dd></div>
  </dl><p>{t("Ruta estimada entre ciudades. Revisa las restricciones del vehículo antes de planificar el transporte.", "Estimated route between cities. Review vehicle restrictions before planning transport.")}</p>
    {result?.status === "loading" ? <p role="status">{t("Consultando ruta…", "Loading route…")}</p> : null}
    {result?.status === "blocked" ? <p role="status">{t("Estas ciudades no pertenecen a una red terrestre conectada.", "These cities are not on a connected land network.")}</p> : null}
  </div>;
  return <section id={requestId ? "active-request-map" : undefined} tabIndex={requestId ? -1 : undefined} className={`${s.card} ${s.localMap} ${embedded ? s.wizardMap : ""}`} aria-label={t("Ruta de la solicitud", "Request route")}>
    <div className={s.heading}><div><h2>{t("Mapa de la ruta", "Route map")}</h2><p>{locationLabel(draft.originId, locale)} → {locationLabel(draft.destinationId, locale)}</p></div><div className={s.routeHeadingActions}><span className={s.status}>{t("Transporte por carretera", "Road transport")}</span><button className={s.route3dButton} onClick={()=>setView3d(true)}><Navigation size={16}/>{t("Vista 3D","3D view")}</button></div></div>
    <div className={`${s.localMapLayout} ${sidebar ? layout.withTracking : ""}`}><div className={sidebar ? layout.mapColumn : undefined}><RoadMapCanvas presentation={mapped} onProviderChange={report}/>
      <p className={s.mapNote} aria-live="polite"><Info size={14} aria-hidden="true"/>{providerNote(provider, presentation, locale)}</p>{sidebar ? facts : null}</div>
      <aside className={sidebar ? layout.trackingRail : undefined}>{sidebar ?? facts}</aside></div>
    {view3d?<RouteNavigationDialog onClose={()=>setView3d(false)} presentation={presentation} origin={findRoadLocation(draft.originId)?.city??draft.originId} destination={findRoadLocation(draft.destinationId)?.city??draft.destinationId} variant={truck?.type==="custom"?undefined:truck?.type} custom={truck?.type==="custom"} modelAssetId={truck?.modelAssetId} title={truckLabel(truck,locale)} initialProgress={requestId?journey.progress:0} inactive={inactive} loading={result?.status==="loading"}/>:null}
  </section>;
}
export function TruckPhoto({ onChange, photo, t }: { onChange: (url: string) => void; photo: string | null; t: Translate }) {
  const [issue, setIssue] = useState(""), [uploading, setUploading] = useState(false);
  const id = useId(), generation = useRef(0);
  useEffect(() => () => { generation.current++; }, []);
  return <div className={s.truckUpload}><label className={s.truckUploadZone}>
    <input className={s.truckFileInput} aria-label={t("Foto de tu camión (opcional)", "Truck photo (optional)")} type="file" disabled={uploading} accept="image/jpeg,image/png,image/webp" aria-describedby={id} onChange={async e => {
    const file = e.target.files?.[0]; if (!file) return;
    const attempt = ++generation.current;
    const invalid = truckPhotoIssue(file); setIssue("");
    if (invalid) { setIssue(t("Usa una foto JPG, PNG o WebP de hasta 8 MB.", "Use a JPG, PNG or WebP photo up to 8 MB.")); return; }
    setUploading(true);
    try {
      const image = await createImageBitmap(file);
      try {
        const scale = Math.min(1, 800 / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas"); canvas.width = Math.max(1, Math.round(image.width * scale)); canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext("2d"); if (!context) throw new Error("PHOTO_UNAVAILABLE");
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const url = canvas.toDataURL("image/jpeg", .78); if (url.length > maxStoredTruckPhotoLength) throw new Error("PHOTO_TOO_LARGE"); if (generation.current === attempt) onChange(url);
      } finally { image.close(); }
    } catch { if (generation.current === attempt) setIssue(t("No se pudo guardar esta foto. Prueba con una imagen más pequeña.", "This photo could not be saved. Try a smaller image.")); }
    finally { if (generation.current === attempt) setUploading(false); }
  }}/>{photo ? <img src={photo} alt={t("Foto de tu camión preferido", "Preferred truck photo")}/> : <Upload size={28} aria-hidden="true"/>}
    <strong>{uploading ? t("Preparando foto…", "Preparing photo…") : photo ? t("Cambiar foto", "Change photo") : t("Subir foto del camión", "Upload truck photo")}</strong>
    <small>{t("JPG, PNG o WebP · hasta 8 MB", "JPG, PNG or WebP · up to 8 MB")}</small>
  </label><small id={id} role={issue ? "alert" : "status"}>{issue || t("La foto se guarda solo en este navegador.", "The photo is saved only in this browser.")}</small></div>;
}

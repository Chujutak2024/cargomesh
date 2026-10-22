"use client";

import { MapPin } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocale } from "@/features/i18n/locale-provider";
import { googleMapsAuthFailed, loadGoogleMaps, onGoogleMapsAuthFailure, retryGoogleMaps } from "./google-maps-loader";
import { mapMarkerSvg } from "./map-marker-icon";
import { type MapPresentation, type MapProvider } from "./road-map-model";
import styles from "./road-candidate-map-view.module.css";
import { SchematicMapView } from "./schematic-map-view";
import { mapFailureCategory, operationMapPoints, type MapFailure } from "./schematic-map-model";

const browserKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_JS_API_KEY?.trim() ?? "";

type Adapter = { provider: "google"; update: (data: MapPresentation) => void; dispose: () => void };

function mountGoogle(host: HTMLDivElement, center: { lat: number; lng: number }): { adapter: Adapter; map: google.maps.Map } {
  const map = new google.maps.Map(host, {
    center, zoom: 6,
    gestureHandling: "cooperative", fullscreenControl: false,
    mapTypeControl: false, streetViewControl: false,
  });
  let markers: google.maps.Marker[] = [];
  let lines: google.maps.Polyline[] = [];
  const clear = () => {
    markers.forEach((marker) => marker.setMap(null));
    lines.forEach((line) => line.setMap(null));
    markers = [];
    lines = [];
  };
  return {
    map,
    adapter: {
      provider: "google",
      update(data) {
        clear();
        const bounds = new google.maps.LatLngBounds();
        data.markers.forEach(({ point, label, kind }) => {
          markers.push(new google.maps.Marker({ map, position: point, title: label, clickable: false,
            icon: { url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(mapMarkerSvg(kind))}`,
              scaledSize: new google.maps.Size(44, 53), anchor: new google.maps.Point(22, 51) },
            zIndex: kind === "origin" ? 3 : 2,
          }));
        });
        const connectionOnly = data.paths.length === 0 && data.markers.length === 2;
        const paths = connectionOnly ? [data.markers.map(marker => marker.point)] : data.paths;
        paths.forEach((path, index) => {
          const provenance = data.pathProvenance?.[index] ?? data.provenanceStatus;
          if (!connectionOnly && provenance === "VERIFIED") lines.push(new google.maps.Polyline({
            map, path, clickable: false, strokeColor: "#ffffff", strokeWeight: 8, strokeOpacity: 0.9, zIndex: 1,
          }));
          lines.push(new google.maps.Polyline({
            map, path, clickable: false, strokeColor: provenance === "SIMULATED" ? "#a86412" : "#007d87",
            strokeWeight: 5, strokeOpacity: !connectionOnly && provenance === "VERIFIED" ? 0.95 : 0,
            icons: !connectionOnly && provenance === "VERIFIED" ? [] : [{
              icon: { path: "M 0,-1 0,1", strokeColor: connectionOnly ? "#64748b" : provenance === "SIMULATED" ? "#a86412" : "#3067af", strokeOpacity: 1, scale: 3 }, offset: "0", repeat: "14px",
            }], zIndex: 2,
          }));
        });
        operationMapPoints(data).forEach(point => bounds.extend(point));
        if (data.markers.length > 1 || data.paths.length) map.fitBounds(bounds, 42);
        else if (data.markers.length) map.setCenter(data.markers[0].point);
      },
      dispose: clear,
    },
  };
}

export function RoadMapCanvas({ presentation, onProviderChange }: {
  presentation: MapPresentation;
  onProviderChange: (provider: MapProvider) => void;
}) {
  const googleHost = useRef<HTMLDivElement>(null);
  const adapter = useRef<Adapter | null>(null);
  const current = useRef(presentation);
  const [renderer, setRenderer] = useState<"google" | "none">("none");
  const [failed, setFailed] = useState(false);
  const [failure, setFailure] = useState<MapFailure>("unavailable");
  const [attempt, setAttempt] = useState(0);
  const { t, locale } = useLocale();
  current.current = presentation;
  const hasMarkers = presentation.markers.length > 0;

  useEffect(() => { adapter.current?.update(presentation); }, [presentation]);

  useEffect(() => {
    setRenderer("none");
    setFailed(false);
    if (!hasMarkers) { onProviderChange("none"); return; }
    let disposed = false;
    let failedAttempt = false;
    let timeout = 0;
    let googleListener: google.maps.MapsEventListener | null = null;
    onProviderChange("loading");

    // Google is the configured renderer. Provider failures never silently
    // substitute another basemap or turn absent geometry into a route.
    const fail = (error: unknown = "MAP_PROVIDER_UNAVAILABLE") => {
      if (disposed || failedAttempt) return;
      failedAttempt = true;
      window.clearTimeout(timeout);
      if (googleListener) google.maps.event.removeListener(googleListener);
      adapter.current?.dispose();
      adapter.current = null;
      setRenderer("none");
      setFailed(true);
      setFailure(mapFailureCategory(error));
      onProviderChange("none");
    };
    const unsubscribe = onGoogleMapsAuthFailure(() => fail("MAP_PROVIDER_AUTH_FAILED"));
    if (!browserKey) {
      fail("MAP_PROVIDER_NOT_CONFIGURED");
    } else if (googleMapsAuthFailed()) {
      fail("MAP_PROVIDER_AUTH_FAILED");
    } else {
      void loadGoogleMaps(browserKey).then(() => {
        if (disposed || failedAttempt || googleMapsAuthFailed() || !googleHost.current) return;
        const { adapter: googleAdapter, map } = mountGoogle(googleHost.current, current.current.markers[0].point);
        adapter.current = googleAdapter;
        googleAdapter.update(current.current);
        setRenderer("google");
        googleListener = google.maps.event.addListenerOnce(map, "tilesloaded", () => {
          if (!disposed && !failedAttempt) { window.clearTimeout(timeout); onProviderChange("google"); }
        });
        timeout = window.setTimeout(() => fail("MAP_PROVIDER_TIMEOUT"), 12000);
      }).catch(fail);
    }
    return () => {
      disposed = true;
      unsubscribe();
      window.clearTimeout(timeout);
      if (googleListener) google.maps.event.removeListener(googleListener);
      adapter.current?.dispose();
      adapter.current = null;
    };
  }, [hasMarkers, onProviderChange, attempt]);

  if (!hasMarkers) return <div className={styles.mapEmpty}><MapPin size={21} aria-hidden="true" /><span>{t("No hay coordenadas confirmadas para mostrar en el mapa.", "No confirmed coordinates are available for the map.")}</span></div>;

  return <div className={styles.canvasWrap} data-renderer={failed ? "schematic" : "google"}>
    <div ref={googleHost} className={styles.mapCanvas} style={{ display: renderer === "google" && !failed ? "block" : "none" }} role="region" aria-label={t("Mapa de origen, destino y geometría declarada de la ruta", "Map of origin, destination, and declared route geometry")} />
    {failed ? <SchematicMapView presentation={presentation} failure={failure} locale={locale} onRetry={() => { retryGoogleMaps(); setAttempt(value => value + 1); }}/>
      : renderer === "none" ? <p className={styles.mapFailure} role="status">{t("Cargando proveedor cartográfico…", "Loading map provider…")}</p> : null}
    {!failed && presentation.paths.length === 0 && presentation.markers.length === 2 ? <p className={styles.connectionNote}>{t("Conexión esquemática — no es una ruta vial verificada", "Schematic connection — not a verified road route")}</p> : null}
  </div>;
}

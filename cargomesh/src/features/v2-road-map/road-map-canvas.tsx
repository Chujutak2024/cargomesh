"use client";

import { MapPin } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocale } from "@/features/i18n/locale-provider";
import { googleMapsAuthFailed, loadGoogleMaps, onGoogleMapsAuthFailure } from "./google-maps-loader";
import { isGoogleRoutesSource, type MapPresentation, type MapProvider } from "./road-map-model";
import styles from "./road-candidate-map-view.module.css";

const browserKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_JS_API_KEY?.trim() ?? "";

type Adapter = { update: (data: MapPresentation) => void; dispose: () => void };

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
      update(data) {
        clear();
        const bounds = new google.maps.LatLngBounds();
        data.markers.forEach(({ point, label }) => {
          markers.push(new google.maps.Marker({ map, position: point, title: label }));
          bounds.extend(point);
        });
        data.paths.forEach((path) => {
          lines.push(new google.maps.Polyline({
            map, path, strokeColor: data.provenanceStatus === "SIMULATED" ? "#b57425" : "#007d87",
            strokeWeight: 5, strokeOpacity: data.provenanceStatus === "SIMULATED" ? 0.7 : 0.95,
          }));
          path.forEach((point) => bounds.extend(point));
        });
        if (data.markers.length > 1 || data.paths.length) map.fitBounds(bounds, 42);
        else if (data.markers.length) map.setCenter(data.markers[0].point);
      },
      dispose: clear,
    },
  };
}

async function mountOpenStreetMap(host: HTMLDivElement): Promise<{ adapter: Adapter; tiles: import("leaflet").TileLayer }> {
  const L = await import("leaflet");
  const map = L.map(host, { attributionControl: true, scrollWheelZoom: false, zoomControl: true });
  const tiles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 18,
  }).addTo(map);
  const overlays = L.layerGroup().addTo(map);
  return {
    tiles,
    adapter: {
      update(data) {
        overlays.clearLayers();
        const bounds = data.markers.map(({ point }) => L.latLng(point.lat, point.lng));
        data.markers.forEach(({ point, label }) => {
          L.circleMarker([point.lat, point.lng], {
            radius: 8, weight: 3, color: "#ffffff", fillColor: "#087f8a", fillOpacity: 1,
          }).bindTooltip(label).addTo(overlays);
        });
        data.paths.forEach((path) => {
          const points = path.map(({ lat, lng }) => L.latLng(lat, lng));
          L.polyline(points, {
            color: data.provenanceStatus === "SIMULATED" ? "#b57425" : "#007d87",
            dashArray: data.provenanceStatus === "SIMULATED" ? "9 8" : undefined,
            weight: 4, opacity: 0.92,
          }).addTo(overlays);
          bounds.push(...points);
        });
        if (bounds.length > 1) map.fitBounds(L.latLngBounds(bounds), { padding: [40, 40], maxZoom: 10 });
        else if (bounds.length) map.setView(bounds[0], 10);
      },
      dispose: () => map.remove(),
    },
  };
}

export function RoadMapCanvas({ presentation, onProviderChange }: {
  presentation: MapPresentation;
  onProviderChange: (provider: MapProvider) => void;
}) {
  const googleHost = useRef<HTMLDivElement>(null);
  const osmHost = useRef<HTMLDivElement>(null);
  const adapter = useRef<Adapter | null>(null);
  const current = useRef(presentation);
  const [renderer, setRenderer] = useState<"google" | "openstreetmap" | "none">("none");
  const [failed, setFailed] = useState(false);
  const { t } = useLocale();
  current.current = presentation;
  const hasMarkers = presentation.markers.length > 0;

  // Overlay changes never recreate the basemap. This avoids extra map loads
  // (and potential Dynamic Maps charges) while the parent changes selection.
  useEffect(() => { adapter.current?.update(presentation); }, [presentation]);

  useEffect(() => {
    if (!hasMarkers) {
      onProviderChange("none");
      return;
    }
    let disposed = false;
    let fallbackStarted = false;
    let timeout = 0;
    let googleListener: google.maps.MapsEventListener | null = null;
    let unsubscribe = () => {};
    setFailed(false);
    onProviderChange("loading");

    const fallback = async () => {
      if (disposed || fallbackStarted) return;
      fallbackStarted = true;
      window.clearTimeout(timeout);
      if (googleListener) google.maps.event.removeListener(googleListener);
      adapter.current?.dispose();
      adapter.current = null;
      // Routes API content may not be combined with a non-Google basemap.
      const source = current.current.geometrySource;
      if (isGoogleRoutesSource(source)) {
        setRenderer("none"); setFailed(true); onProviderChange("none");
        return;
      }
      try {
        const host = osmHost.current;
        if (!host) throw new Error("MAP_HOST_MISSING");
        setRenderer("openstreetmap");
        const { adapter: osmAdapter, tiles } = await mountOpenStreetMap(host);
        if (disposed) { osmAdapter.dispose(); return; }
        adapter.current = osmAdapter;
        osmAdapter.update(current.current);
        let settled = false;
        timeout = window.setTimeout(() => {
          if (!settled && !disposed) { settled = true; setFailed(true); onProviderChange("none"); }
        }, 12000);
        tiles.once("tileload", () => {
          if (!settled && !disposed) { settled = true; window.clearTimeout(timeout); onProviderChange("openstreetmap"); }
        });
      } catch {
        if (!disposed) { setRenderer("none"); setFailed(true); onProviderChange("none"); }
      }
    };

    unsubscribe = onGoogleMapsAuthFailure(() => { void fallback(); });
    if (!browserKey || googleMapsAuthFailed()) {
      void fallback();
    } else {
      void loadGoogleMaps(browserKey).then(() => {
        if (disposed || fallbackStarted || googleMapsAuthFailed() || !googleHost.current) return;
        const { adapter: googleAdapter, map } = mountGoogle(googleHost.current, current.current.markers[0].point);
        adapter.current = googleAdapter;
        googleAdapter.update(current.current);
        setRenderer("google");
        googleListener = google.maps.event.addListenerOnce(map, "tilesloaded", () => {
          if (!disposed && !fallbackStarted) { window.clearTimeout(timeout); onProviderChange("google"); }
        });
        timeout = window.setTimeout(() => { void fallback(); }, 12000);
      }).catch(() => { void fallback(); });
    }
    return () => {
      disposed = true;
      unsubscribe();
      window.clearTimeout(timeout);
      if (googleListener) google.maps.event.removeListener(googleListener);
      adapter.current?.dispose();
      adapter.current = null;
    };
  }, [hasMarkers, onProviderChange]);

  if (!hasMarkers) return <div className={styles.mapEmpty}><MapPin size={21} aria-hidden="true" /><span>{t("No hay coordenadas confirmadas para mostrar en el mapa.", "No confirmed coordinates are available for the map.")}</span></div>;

  return <div className={styles.canvasWrap}>
    <div ref={googleHost} className={styles.mapCanvas} style={{ display: renderer === "openstreetmap" ? "none" : "block" }} role="img" aria-label={t("Mapa de origen, destino y geometría declarada de la ruta", "Map of origin, destination, and declared route geometry")} />
    <div ref={osmHost} className={styles.mapCanvas} style={{ display: renderer === "openstreetmap" ? "block" : "none" }} role="img" aria-label={t("Mapa de origen, destino y geometría declarada de la ruta", "Map of origin, destination, and declared route geometry")} />
    {failed ? <div className={styles.mapFailure} role="status">{t("Mapa no disponible. Los datos de la ruta siguen visibles debajo.", "Map unavailable. Route details remain visible below.")}</div> : null}
  </div>;
}

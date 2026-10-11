"use client";
import { useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import type { CarrierMapPoint } from "./carrier-map";
import type { coverageGeometry } from "./map-model";

type Area = { id: string; label: string; geometry: ReturnType<typeof coverageGeometry>; excluded: boolean };
type Props = {
  points: CarrierMapPoint[]; areas: Area[]; selected: string | null;
  onSelect: (id: string) => void; onStatus: (status: "osm" | "unavailable") => void;
  label: string;
};

/** Base tiles contain no operational records; overlays use only the authorized API response. */
export function OpenStreetMap({ points, areas, selected, onSelect, onStatus, label }: Props) {
  const host = useRef<HTMLDivElement>(null), map = useRef<Leaflet.Map | null>(null);
  const library = useRef<typeof Leaflet | null>(null), viewport = useRef("");
  const callbacks = useRef({ onSelect, onStatus });
  const [ready, setReady] = useState(false);
  useEffect(() => { callbacks.current = { onSelect, onStatus }; }, [onSelect, onStatus]);
  useEffect(() => {
    let cancelled = false, instance: Leaflet.Map | undefined, observer: ResizeObserver | undefined;
    void import("leaflet").then(L => {
      if (cancelled || !host.current) return;
      library.current = L;
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      instance = L.map(host.current, { scrollWheelZoom: false, zoomAnimation: !reducedMotion, fadeAnimation: !reducedMotion, markerZoomAnimation: !reducedMotion }).setView([0, 0], 2);
      map.current = instance;
      const tiles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(instance);
      tiles.on("tileerror", () => { if (!cancelled) callbacks.current.onStatus("unavailable"); });
      tiles.on("tileload", () => { if (!cancelled) callbacks.current.onStatus("osm"); });
      observer = new ResizeObserver(() => instance?.invalidateSize());
      observer.observe(host.current);
      setReady(true); callbacks.current.onStatus("osm");
    }).catch(() => { if (!cancelled) callbacks.current.onStatus("unavailable"); });
    return () => { cancelled = true; observer?.disconnect(); instance?.remove(); map.current = null; viewport.current = ""; };
  }, []);
  useEffect(() => {
    const L = library.current, current = map.current;
    if (!ready || !L || !current) return;
    const group = L.featureGroup().addTo(current), bounds = L.latLngBounds([]);
    const tooltip = (text: string) => { const element = document.createElement("span"); element.textContent = text; return element; };
    for (const point of points) {
      if (point.lat === null || point.lng === null) continue;
      const position: Leaflet.LatLngTuple = [point.lat, point.lng];
      L.circleMarker(position, { radius: point.id === selected ? 12 : 9, color: "#fff", weight: 3,
        fillColor: point.id === selected ? "#185be7" : point.layer === "positions" ? "#008b91" : "#153e55", fillOpacity: 1,
      }).bindTooltip(tooltip(point.label)).on("click", () => callbacks.current.onSelect(point.id)).addTo(group);
      bounds.extend(position);
    }
    for (const area of areas) {
      if (!area.geometry) continue;
      const style = { color: area.excluded ? "#b33c48" : "#00747c", weight: 2, fillOpacity: .12 };
      if (area.geometry.type === "Polygon") {
        const rings = area.geometry.coordinates.map(ring => ring.map(([lng, lat]): Leaflet.LatLngTuple => [lat, lng]));
        L.polygon(rings, style).bindTooltip(tooltip(area.label)).addTo(group);
        rings.flat().forEach(position => bounds.extend(position));
      } else for (const [lng, lat] of area.geometry.coordinates) {
        L.circleMarker([lat, lng], { ...style, radius: 7 }).bindTooltip(tooltip(area.label)).addTo(group);
        bounds.extend([lat, lng]);
      }
    }
    const nextViewport = bounds.isValid() ? bounds.toBBoxString() : "empty";
    if (bounds.isValid() && viewport.current !== nextViewport) current.fitBounds(bounds, { padding: [35, 35], maxZoom: 14, animate: false });
    viewport.current = nextViewport;
    return () => { group.remove(); };
  }, [points, areas, selected, ready]);
  return <div ref={host} role="region" aria-label={label} style={{ height: "100%", width: "100%", zIndex: 0 }} />;
}

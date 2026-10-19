"use client";
import { useEffect, useRef, useState } from "react";
import { loadGoogleMaps, onGoogleMapsAuthFailure } from "@/features/v2-road-map/google-maps-loader";
import type { RoadAlternative } from "./contract";
import s from "./route-lab.module.css";

export function RouteMap({ alternatives, selectedId }: { alternatives: RoadAlternative[]; selectedId: string | null }) {
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let disposed = false;
    const off = onGoogleMapsAuthFailure(() => { setReady(false); setError("Google Maps authorization failed. Route results remain available below."); });
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_JS_API_KEY?.trim();
    if (!key) { setError("The browser Google Maps key is not configured."); return off; }
    void loadGoogleMaps(key).then(() => {
      if (disposed || !host.current) return;
      map.current = new google.maps.Map(host.current, { center: { lat: -12, lng: -76 }, zoom: 5,
        mapTypeId: "roadmap", gestureHandling: "cooperative", streetViewControl: false, mapTypeControl: false });
      setReady(true);
    }).catch(() => { if (!disposed) setError("Google Maps could not load. Route results remain available below."); });
    const observer = new ResizeObserver(() => { if (map.current) google.maps.event.trigger(map.current, "resize"); });
    if (host.current) observer.observe(host.current);
    return () => { disposed = true; off(); observer.disconnect(); map.current = null; };
  }, []);
  useEffect(() => {
    if (!ready || !map.current) return;
    const paths = alternatives.map(route => new google.maps.Polyline({ map: map.current,
      // Provider geometry only: no endpoints appended, smoothing or guessed intermediate roads.
      path: route.points, geodesic: false, strokeColor: route.id === selectedId ? "#375ee8" : "#8b9cad",
      strokeOpacity: route.id === selectedId ? 1 : 0.55, strokeWeight: route.id === selectedId ? 5 : 3,
      zIndex: route.id === selectedId ? 2 : 1 }));
    const selected = alternatives.find(route => route.id === selectedId);
    if (selected) { const bounds = new google.maps.LatLngBounds(); selected.points.forEach(point => bounds.extend(point)); map.current.fitBounds(bounds, 50); }
    return () => paths.forEach(path => path.setMap(null));
  }, [ready, alternatives, selectedId]);
  return <div className={s.mapFrame}><div ref={host} className={s.map} role="region" aria-label="Computed road routes on Google Maps" />
    {!ready && <div className={s.mapMessage} role={error ? "alert" : "status"}>{error || "Loading Google Maps…"}</div>}
    {ready && !alternatives.length && <div className={s.mapMessage}>Calculate a route to display provider geometry.</div>}</div>;
}

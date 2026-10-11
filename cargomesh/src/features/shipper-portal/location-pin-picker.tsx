"use client";

import { useEffect, useRef, useState } from "react";
import { loadGoogleMaps } from "@/features/v2-road-map/google-maps-loader";
import styles from "./shipper-portal.module.css";

const browserKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_JS_API_KEY?.trim() ?? "";

/** Selection-only map; a clicked point is NOT a verified address or persisted location. */
export function LocationPinPicker({ onPick, lat, lng }: {
  onPick: (lat: number, lng: number) => void;
  lat: number | null;
  lng: number | null;
}) {
  const host = useRef<HTMLDivElement>(null);
  const callback = useRef(onPick);
  callback.current = onPick;
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!browserKey) return;
    let disposed = false;
    let listener: google.maps.MapsEventListener | null = null;
    let marker: google.maps.Marker | null = null;
    void loadGoogleMaps(browserKey).then(() => {
      if (disposed || !host.current) return;
      const center = lat != null && lng != null ? { lat, lng } : { lat: -12.0464, lng: -77.0428 };
      const map = new google.maps.Map(host.current, {
        center, zoom: lat != null && lng != null ? 12 : 5,
        gestureHandling: "cooperative", streetViewControl: false, mapTypeControl: false,
      });
      if (lat != null && lng != null) marker = new google.maps.Marker({ map, position: center });
      listener = map.addListener("click", (event: google.maps.MapMouseEvent) => {
        const point = event.latLng;
        if (!point) return;
        const position = { lat: point.lat(), lng: point.lng() };
        if (marker) marker.setPosition(position);
        else marker = new google.maps.Marker({ map, position });
        callback.current(position.lat, position.lng);
      });
    }).catch(() => { if (!disposed) setError("No se pudo cargar Google Maps. Ingresa las coordenadas manualmente."); });
    return () => {
      disposed = true;
      listener?.remove();
      marker?.setMap(null);
    };
    // A map is mounted once. Coordinates may subsequently change through the form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!browserKey) return <p className={styles.locationNote}>Mapa interactivo no configurado: puedes escribir las coordenadas manualmente.</p>;
  return <div className={styles.locationMapSection}>
    <p className={styles.locationNote}>Haz clic en el mapa para proponer un punto. No es geocodificación ni confirma dirección, cobertura o sede. También puedes introducir coordenadas con el teclado.</p>
    <div ref={host} className={styles.locationMap} role="region" aria-label="Mapa para proponer coordenadas. Alternativa accesible: campos de latitud y longitud." />
    {error ? <p className={styles.locationError} role="alert">{error}</p> : null}
  </div>;
}

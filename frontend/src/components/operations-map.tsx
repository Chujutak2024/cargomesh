"use client";

import { MapPin } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { useLocale } from "@/features/i18n/locale-provider";
import styles from "./operations-map.module.css";

type MapPlace = { city: string; countryCode: string };
type MapCheckpoint = MapPlace & { id: string; label: string; occurredAt: string };
type RoutePoint = MapPlace & {
  coordinates: [number, number];
  id: string;
  kind: "origin" | "checkpoint" | "nominal" | "destination";
  label?: string;
  occurredAt?: string;
};

export type OperationsMapModel = {
  bookingId: string;
  requestCode: string;
  origin: MapPlace;
  destination: MapPlace;
  checkpoints: MapCheckpoint[];
};

const COORDINATES: Record<string, [number, number]> = {
  "PE:lima": [-12.0464, -77.0428],
  "PE:callao": [-12.0566, -77.1181],
  "PE:arequipa": [-16.409, -71.5375],
  "PE:tacna": [-18.0066, -70.2463],
  "PE:matarani": [-17.0054, -72.1011],
  "PE:ilo": [-17.6394, -71.3375],
  "PE:paita": [-5.0892, -81.1144],
  "PE:trujillo": [-8.1116, -79.0287],
  "CL:arica": [-18.4783, -70.3126],
  "CL:antofagasta": [-23.6509, -70.3975],
  "CL:santiago": [-33.4489, -70.6693],
  "CL:iquique": [-20.2307, -70.1357],
  "CL:valparaiso": [-33.0472, -71.6127],
  "CO:bogota": [4.711, -74.0721],
  "CO:cali": [3.4516, -76.532],
  "CO:medellin": [6.2442, -75.5812],
  "EC:quito": [-0.1807, -78.4678],
  "EC:guayaquil": [-2.1709, -79.9224],
  "BO:la paz": [-16.4897, -68.1193],
  "BO:santa cruz de la sierra": [-17.7833, -63.1821],
  "AR:buenos aires": [-34.6037, -58.3816],
  "AR:mendoza": [-32.8895, -68.8458],
};

const PERU_CHILE_CORRIDOR: MapPlace[] = [
  { city: "Callao", countryCode: "PE" },
  { city: "Lima", countryCode: "PE" },
  { city: "Arequipa", countryCode: "PE" },
  { city: "Tacna", countryCode: "PE" },
  { city: "Arica", countryCode: "CL" },
  { city: "Antofagasta", countryCode: "CL" },
  { city: "Santiago", countryCode: "CL" },
  { city: "Valparaíso", countryCode: "CL" },
];

function normalizedCity(city: string) {
  return city.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}

function normalizedCountry(countryCode: string) {
  const value = countryCode.trim().toUpperCase();
  if (value === "PERU" || value === "PERÚ") return "PE";
  if (value === "CHILE") return "CL";
  return value;
}

function placeKey(place: MapPlace) {
  return `${normalizedCountry(place.countryCode)}:${normalizedCity(place.city)}`;
}

function coordinatesFor(place: MapPlace) {
  return COORDINATES[placeKey(place)];
}

function nominalCorridor(origin: MapPlace, destination: MapPlace): MapPlace[] {
  const originIndex = PERU_CHILE_CORRIDOR.findIndex((place) => placeKey(place) === placeKey(origin));
  const destinationIndex = PERU_CHILE_CORRIDOR.findIndex((place) => placeKey(place) === placeKey(destination));
  if (originIndex < 0 || destinationIndex < 0 || originIndex === destinationIndex) return [];
  const from = Math.min(originIndex, destinationIndex);
  const to = Math.max(originIndex, destinationIndex);
  const segment = PERU_CHILE_CORRIDOR.slice(from + 1, to);
  return originIndex < destinationIndex ? segment : segment.reverse();
}

function createRoute(model: OperationsMapModel): { points: RoutePoint[]; isNominal: boolean } {
  const mappedCheckpoints = model.checkpoints.flatMap<RoutePoint>((checkpoint) => {
    const coordinates = coordinatesFor(checkpoint);
    return coordinates ? [{ ...checkpoint, coordinates, kind: "checkpoint" }] : [];
  });
  const nominal = mappedCheckpoints.length === 0 ? nominalCorridor(model.origin, model.destination) : [];
  const candidates: Array<Omit<RoutePoint, "coordinates"> | RoutePoint> = [
    { ...model.origin, id: "origin", kind: "origin" },
    ...mappedCheckpoints,
    ...nominal.map((place, index) => ({ ...place, id: `nominal-${index}`, kind: "nominal" as const })),
    { ...model.destination, id: "destination", kind: "destination" },
  ];
  const points = candidates.flatMap<RoutePoint>((item) => {
    const coordinates = "coordinates" in item ? item.coordinates : coordinatesFor(item);
    return coordinates ? [{ ...item, coordinates }] : [];
  });
  return { points, isNominal: mappedCheckpoints.length === 0 };
}

export function OperationsMap({ model }: { model: OperationsMapModel | null }) {
  const element = useRef<HTMLDivElement>(null);
  const wrapper = useRef<HTMLDivElement>(null);
  const { locale, t } = useLocale();
  const route = useMemo(() => model ? createRoute(model) : { points: [], isNominal: false }, [model]);

  useEffect(() => {
    if (!element.current || route.points.length < 2) return;
    let disposed = false;
    let cleanup = () => {};
    void import("leaflet").then((L) => {
      if (disposed || !element.current) return;
      const map = L.map(element.current, {
        attributionControl: true,
        scrollWheelZoom: false,
        zoomControl: true,
      });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
        maxZoom: 18,
      }).addTo(map);

      const computed = wrapper.current ? getComputedStyle(wrapper.current) : null;
      const brass = computed?.getPropertyValue("--map-brass").trim() || "#a9791f";
      const line = computed?.getPropertyValue("--map-line").trim() || "#dde3e0";
      const latlngs = route.points.map((item) => item.coordinates);
      L.polyline(latlngs, {
        color: route.isNominal ? line : brass,
        dashArray: route.isNominal ? "9 7" : undefined,
        opacity: 0.95,
        weight: 4,
      }).addTo(map);

      const markerOrder = [...route.points].sort((left, right) => {
        const layer = { nominal: 0, origin: 1, destination: 1, checkpoint: 2 } as const;
        return layer[left.kind] - layer[right.kind];
      });
      markerOrder.forEach((item) => {
        const endpoint = item.kind === "origin" || item.kind === "destination";
        const marker = L.circleMarker(item.coordinates, {
          color: endpoint ? "#ffffff" : line,
          fillColor: item.kind === "checkpoint" ? brass : endpoint ? "#185c55" : "#ffffff",
          fillOpacity: 1,
          radius: endpoint ? 8 : item.kind === "checkpoint" ? 6 : 4,
          weight: endpoint ? 3 : 2,
        });
        const kindLabel = item.kind === "origin"
          ? t("Origen", "Origin")
          : item.kind === "destination"
            ? t("Destino", "Destination")
            : item.kind === "checkpoint"
              ? item.label || t("Checkpoint reportado", "Reported checkpoint")
              : t("Ruta programada", "Scheduled route");
        const tooltip = document.createElement("div");
        const heading = document.createElement("strong");
        const location = document.createElement("span");
        heading.textContent = kindLabel;
        location.textContent = `${item.city}, ${normalizedCountry(item.countryCode)}`;
        tooltip.append(heading, document.createElement("br"), location);
        if (item.occurredAt) {
          const eventTime = document.createElement("small");
          eventTime.textContent = new Intl.DateTimeFormat(locale === "es" ? "es-PE" : "en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.occurredAt));
          tooltip.append(document.createElement("br"), eventTime);
        }
        marker.bindTooltip(tooltip).addTo(map);
      });
      map.fitBounds(L.latLngBounds(latlngs), { padding: [38, 38] });
      cleanup = () => map.remove();
    });
    return () => { disposed = true; cleanup(); };
  }, [locale, route, t]);

  if (!model || route.points.length < 2) {
    return <div className={styles.empty}><MapPin size={27}/><strong>{t("Sin ruta autorizada para mostrar", "No authorized route to display")}</strong><p>{t("Se necesitan ubicaciones reconocibles en la solicitud o en los eventos del carrier.", "Recognizable locations are required in the request or carrier events.")}</p></div>;
  }

  return <div ref={wrapper} className={styles.wrapper}>
    <div className={styles.notice}>
      <strong>{model.requestCode}</strong>
      <span>{route.isNominal
        ? t("Ruta nominal programada; aún no hay checkpoints de ubicación.", "Scheduled nominal route; no location checkpoints have been reported yet.")
        : t("Ruta basada en checkpoints reportados por el carrier. No es GPS en vivo.", "Route based on carrier-reported checkpoints. This is not live GPS.")}</span>
    </div>
    <div ref={element} className={styles.map} aria-label={t("Mapa del corredor del despacho", "Shipment corridor map")}/>
    <div className={styles.legend} aria-label={t("Leyenda del mapa", "Map legend")}>
      <span><i className={styles.endpoint}/>{t("Origen / destino", "Origin / destination")}</span>
      <span><i className={route.isNominal ? styles.nominal : styles.checkpoint}/>{route.isNominal ? t("Ruta programada", "Scheduled route") : t("Checkpoint", "Checkpoint")}</span>
    </div>
  </div>;
}

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

// Geometría real de la Carretera Panamericana Sur (Ruta PE-1S en Perú y Ruta 5 en Chile)
// Sigue la costa del Pacífico y los pasos viales oficiales (incluyendo el complejo fronterizo Santa Rosa / Chacalluta)
const PANAMERICANA_SUR_WAYPOINTS: [number, number][] = [
  [-12.0566, -77.1181], // Callao
  [-12.0464, -77.0428], // Lima
  [-12.2800, -76.8700], // Lurín
  [-12.6500, -76.6300], // Mala
  [-13.0766, -76.3865], // Cañete
  [-13.4172, -76.1322], // Chincha
  [-13.7103, -76.2053], // Pisco
  [-14.0678, -75.7286], // Ica
  [-14.5333, -75.1833], // Palpa
  [-14.8290, -74.9386], // Nazca
  [-15.8672, -74.2464], // Chala (costa Arequipa)
  [-16.1800, -73.6100], // Ático
  [-16.4200, -73.1000], // Ocoña
  [-16.6236, -72.7111], // Camaná
  [-16.4090, -71.5375], // Arequipa (Hub logístico Sur)
  [-17.1936, -70.9344], // Moquegua
  [-18.0066, -70.2463], // Tacna
  [-18.3183, -70.3275], // Paso Fronterizo Binacional Santa Rosa / Chacalluta
  [-18.4783, -70.3126], // Arica
  [-19.1600, -70.1800], // Quebrada de Camarones
  [-20.2594, -69.7850], // Pozo Almonte / Iquique
  [-21.6500, -69.5300], // Control Aduanero Quillagua
  [-22.3486, -69.6644], // Cruce María Elena / Tocopilla
  [-23.6509, -70.3975], // Antofagasta
  [-25.4000, -70.4800], // Cruce Taltal
  [-26.3478, -70.6219], // Chañaral
  [-27.3668, -70.3323], // Copiapó
  [-28.5750, -70.7581], // Vallenar
  [-29.9533, -71.3436], // La Serena / Coquimbo
  [-31.9125, -71.5122], // Los Vilos
  [-32.4500, -71.2300], // La Ligua
  [-33.4489, -70.6693], // Santiago
];

const PERU_CHILE_CORRIDOR_HUBS: MapPlace[] = [
  { city: "Arequipa", countryCode: "PE" },
  { city: "Tacna", countryCode: "PE" },
  { city: "Arica", countryCode: "CL" },
  { city: "Antofagasta", countryCode: "CL" },
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

function isPeruChileCorridor(origin: MapPlace, destination: MapPlace): boolean {
  const o = placeKey(origin);
  const d = placeKey(destination);
  return (
    (o.startsWith("PE:") && d.startsWith("CL:")) ||
    (o.startsWith("CL:") && d.startsWith("PE:"))
  );
}

function createRoute(model: OperationsMapModel): {
  points: RoutePoint[];
  polylineCoordinates: [number, number][];
  isNominal: boolean;
} {
  const originCoord = coordinatesFor(model.origin);
  const destCoord = coordinatesFor(model.destination);
  if (!originCoord || !destCoord) {
    return { points: [], polylineCoordinates: [], isNominal: false };
  }

  const mappedCheckpoints = model.checkpoints.flatMap<RoutePoint>((checkpoint) => {
    const coordinates = coordinatesFor(checkpoint);
    return coordinates ? [{ ...checkpoint, coordinates, kind: "checkpoint" }] : [];
  });

  const isNominal = mappedCheckpoints.length === 0;

  if (!isNominal) {
    const points: RoutePoint[] = [
      { ...model.origin, id: "origin", kind: "origin", coordinates: originCoord },
      ...mappedCheckpoints,
      { ...model.destination, id: "destination", kind: "destination", coordinates: destCoord },
    ];
    return {
      points,
      polylineCoordinates: points.map((p) => p.coordinates),
      isNominal: false,
    };
  }

  // Ruta nominal: traza la curvatura real del Corredor Panamericano Sur
  if (isPeruChileCorridor(model.origin, model.destination)) {
    const isSouthbound = originCoord[0] > destCoord[0];
    const waypoints: [number, number][] = isSouthbound
      ? [originCoord, ...PANAMERICANA_SUR_WAYPOINTS, destCoord]
      : [originCoord, ...[...PANAMERICANA_SUR_WAYPOINTS].reverse(), destCoord];

    const nominalHubs = PERU_CHILE_CORRIDOR_HUBS.flatMap<RoutePoint>((hub, i) => {
      const coordinates = coordinatesFor(hub);
      if (!coordinates) return [];
      if (placeKey(hub) === placeKey(model.origin) || placeKey(hub) === placeKey(model.destination)) {
        return [];
      }
      return [{ ...hub, id: `hub-${i}`, kind: "nominal", coordinates }];
    });

    const points: RoutePoint[] = [
      { ...model.origin, id: "origin", kind: "origin", coordinates: originCoord },
      ...nominalHubs,
      { ...model.destination, id: "destination", kind: "destination", coordinates: destCoord },
    ];

    return {
      points,
      polylineCoordinates: waypoints,
      isNominal: true,
    };
  }

  // Corredor genérico de dos puntos
  const points: RoutePoint[] = [
    { ...model.origin, id: "origin", kind: "origin", coordinates: originCoord },
    { ...model.destination, id: "destination", kind: "destination", coordinates: destCoord },
  ];
  return {
    points,
    polylineCoordinates: [originCoord, destCoord],
    isNominal: true,
  };
}

export function OperationsMap({ model }: { model: OperationsMapModel | null }) {
  const element = useRef<HTMLDivElement>(null);
  const wrapper = useRef<HTMLDivElement>(null);
  const { locale, t } = useLocale();
  const route = useMemo(() => model ? createRoute(model) : { points: [], polylineCoordinates: [], isNominal: false }, [model]);

  useEffect(() => {
    if (!element.current || route.polylineCoordinates.length < 2) return;
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
      const line = computed?.getPropertyValue("--map-line").trim() || "#185c55";
      const latlngs = route.polylineCoordinates;

      // Trazo de la ruta (Auténtica Panamericana Sur costera para ruta nominal o directo a través de checkpoints)
      L.polyline(latlngs, {
        color: route.isNominal ? "#185c55" : brass,
        dashArray: route.isNominal ? "8 6" : undefined,
        opacity: route.isNominal ? 0.85 : 0.95,
        weight: 4,
      }).addTo(map);

      const markerOrder = [...route.points].sort((left, right) => {
        const layer = { nominal: 0, origin: 1, destination: 1, checkpoint: 2 } as const;
        return layer[left.kind] - layer[right.kind];
      });

      markerOrder.forEach((item) => {
        const endpoint = item.kind === "origin" || item.kind === "destination";
        const marker = L.circleMarker(item.coordinates, {
          color: endpoint ? "#ffffff" : "#185c55",
          fillColor: item.kind === "checkpoint" ? brass : endpoint ? "#185c55" : "#ffffff",
          fillOpacity: 1,
          radius: endpoint ? 8 : item.kind === "checkpoint" ? 6 : 4.5,
          weight: endpoint ? 3 : 2,
        });
        const kindLabel = item.kind === "origin"
          ? t("Origen", "Origin")
          : item.kind === "destination"
            ? t("Destino", "Destination")
            : item.kind === "checkpoint"
              ? item.label || t("Checkpoint reportado", "Reported checkpoint")
              : t("Hito del corredor", "Corridor waypoint");
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
        ? t("Corredor vial programado (Panamericana Sur PE-1S / Ruta 5); aún no hay checkpoints de ubicación en vivo.", "Scheduled highway corridor (Pan-American PE-1S / Route 5); no live location checkpoints reported yet.")
        : t("Ruta basada en checkpoints reportados por el carrier. No es GPS en vivo.", "Route based on carrier-reported checkpoints. This is not live GPS.")}</span>
    </div>
    <div ref={element} className={styles.map} aria-label={t("Mapa del corredor del despacho", "Shipment corridor map")}/>
    <div className={styles.legend} aria-label={t("Leyenda del mapa", "Map legend")}>
      <span><i className={styles.endpoint}/>{t("Origen / destino", "Origin / destination")}</span>
      <span><i className={route.isNominal ? styles.nominal : styles.checkpoint}/>{route.isNominal ? t("Corredor programado", "Scheduled corridor") : t("Checkpoint", "Checkpoint")}</span>
    </div>
  </div>;
}

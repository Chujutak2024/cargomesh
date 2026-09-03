"use client";

import { MapPin } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import type {
  OperationsMapCheckpoint,
  OperationsMapModel,
  OperationsMapPlace,
} from "@/features/dashboard/operations-map-contract";
import { useLocale } from "@/features/i18n/locale-provider";
import styles from "./operations-map.module.css";

export type { OperationsMapModel } from "@/features/dashboard/operations-map-contract";

type RoutePoint = OperationsMapPlace & {
  coordinates: [number, number];
  id: string;
  kind: "origin" | "checkpoint" | "nominal" | "destination";
  label?: string;
  occurredAt?: string;
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

// Geometría vial estática y simplificada del corredor Callao–Santiago.
// Se derivó de un snapshot de ruteo OpenStreetMap/OSRM; no se consulta ningún
// servicio externo en tiempo de ejecución ni se representa como telemetría.
const PANAMERICANA_SUR_WAYPOINTS: [number, number][] = [
  [-12.056579, -77.117758], [-12.046405, -77.042873],
  [-13.076500, -76.386514], [-13.710380, -76.205304],
  [-14.067775, -75.728608], [-14.384796, -75.613702],
  [-14.520560, -75.202056], [-14.828908, -74.938619],
  [-15.512576, -74.839070], [-16.623699, -72.711143],
  [-16.342510, -72.131198], [-16.529010, -71.779466],
  [-16.408959, -71.537461], [-16.994511, -72.086477],
  [-17.277859, -71.457008], [-17.675905, -71.361793],
  [-18.155506, -70.676823], [-18.006721, -70.246501],
  [-18.309870, -70.331299], [-18.478107, -70.312408],
  [-18.763554, -70.257979], [-18.905926, -70.019131],
  [-19.155819, -70.188826], [-19.289414, -69.892811],
  [-19.640724, -69.942657], [-20.076051, -69.735846],
  [-20.371575, -70.170591], [-21.443179, -70.052466],
  [-23.650921, -70.397478], [-24.047583, -70.265146],
  [-25.093920, -70.497576], [-25.560376, -70.354452],
  [-26.325450, -70.431683], [-26.393149, -70.691062],
  [-27.063885, -70.808134], [-27.327979, -70.729072],
  [-27.319222, -70.444862], [-27.553104, -70.440365],
  [-28.789891, -70.784202], [-29.953348, -71.343617],
  [-30.968239, -71.643162], [-32.195398, -71.521015],
  [-32.768362, -71.192447], [-32.894597, -70.818954],
  [-33.448887, -70.669243],
];

const PERU_CHILE_CORRIDOR_HUBS: OperationsMapPlace[] = [
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

function placeKey(place: OperationsMapPlace) {
  return `${normalizedCountry(place.countryCode)}:${normalizedCity(place.city)}`;
}

function coordinatesFor(place: OperationsMapPlace) {
  return COORDINATES[placeKey(place)];
}

function isPeruChileCorridor(origin: OperationsMapPlace, destination: OperationsMapPlace): boolean {
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

  const mappedCheckpoints = model.checkpoints.flatMap<RoutePoint>((checkpoint: OperationsMapCheckpoint) => {
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
        // El corredor planificado es una guía vial, no telemetría. Conservamos los
        // waypoints declarados (sin simplificación Leaflet) para que no aparezca
        // como una diagonal que atraviesa el territorio.
        dashArray: route.isNominal ? "5 7" : undefined,
        lineCap: "round",
        lineJoin: "round",
        opacity: route.isNominal ? 0.72 : 0.95,
        smoothFactor: 0,
        weight: route.isNominal ? 2 : 3,
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

  if (!model) {
    return <div className={styles.empty}><MapPin size={27}/><strong>{t("Aún no hay una ruta persistida para mostrar", "No persisted route to display yet")}</strong><p>{t("Cuando la solicitud tenga origen y destino operativos, mostraremos su corredor programado.", "When the request has operational origin and destination, its planned corridor will appear here.")}</p></div>;
  }

  if (route.points.length < 2) {
    return <div className={styles.empty}><MapPin size={27}/><strong>{t("No reconocemos las ubicaciones de esta ruta", "Route locations are not recognized")}</strong><p>{t("La solicitud existe, pero sus ciudades no están disponibles en el catálogo de coordenadas del mapa.", "The request exists, but its cities are not available in the map coordinate catalog.")}</p></div>;
  }

  const mapNotice = model.mode === "planned"
    ? t("Corredor vial programado (Panamericana Sur PE-1S / Ruta 5); aún no hay carrier confirmado ni ubicación en vivo.", "Scheduled highway corridor (Pan-American PE-1S / Route 5); no carrier is confirmed and no live location is available yet.")
    : route.isNominal
      ? t("Booking confirmado; aún no hay checkpoints de ubicación reportados por el carrier. Se muestra el corredor programado.", "Booking confirmed; the carrier has not reported location checkpoints yet. The planned corridor is shown.")
      : t("Ruta basada en checkpoints reportados por el carrier. No es GPS en vivo.", "Route based on carrier-reported checkpoints. This is not live GPS.");

  return <div ref={wrapper} className={styles.wrapper}>
    <div className={styles.notice}>
      <strong>{model.requestCode}</strong>
      <span>{mapNotice}</span>
    </div>
    <div ref={element} className={styles.map} aria-label={t("Mapa del corredor del despacho", "Shipment corridor map")}/>
    <div className={styles.legend} aria-label={t("Leyenda del mapa", "Map legend")}>
      <span><i className={styles.endpoint}/>{t("Origen / destino", "Origin / destination")}</span>
      <span><i className={route.isNominal ? styles.nominal : styles.checkpoint}/>{route.isNominal ? t("Corredor programado", "Scheduled corridor") : t("Checkpoint", "Checkpoint")}</span>
    </div>
  </div>;
}

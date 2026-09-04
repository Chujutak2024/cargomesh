"use client";

import { MapPin } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import type { OperationsMapModel } from "@/features/dashboard/operations-map-contract";
import {
  createOperationsMapRoute,
  normalizedMapCountry,
} from "@/features/dashboard/operations-map-geometry";
import { useLocale } from "@/features/i18n/locale-provider";
import styles from "./operations-map.module.css";

export type { OperationsMapModel } from "@/features/dashboard/operations-map-contract";

export function OperationsMap({ model }: { model: OperationsMapModel | null }) {
  const element = useRef<HTMLDivElement>(null);
  const wrapper = useRef<HTMLDivElement>(null);
  const { locale, t } = useLocale();
  const route = useMemo(
    () => model
      ? createOperationsMapRoute(model)
      : { points: [], polylineCoordinates: [], isNominal: false, followsRoadCorridor: false },
    [model],
  );

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
      const line = computed?.getPropertyValue("--map-line").trim() || "#16766d";
      const latlngs = route.polylineCoordinates;

      const renderer = L.svg({ padding: 0.5 });
      // A subtle casing separates the vector from labels and administrative
      // borders without making the planned route look like live telemetry.
      L.polyline(latlngs, {
        renderer,
        color: "#ffffff",
        interactive: false,
        lineCap: "round",
        lineJoin: "round",
        opacity: 0.82,
        smoothFactor: 0.45,
        weight: route.isNominal ? 5 : 6,
      }).addTo(map);

      L.polyline(latlngs, {
        renderer,
        color: route.isNominal ? line : brass,
        dashArray: route.isNominal ? "10 8" : undefined,
        lineCap: "round",
        lineJoin: "round",
        opacity: route.isNominal ? 0.94 : 0.98,
        smoothFactor: 0.45,
        weight: route.isNominal ? 2.25 : 3,
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
        location.textContent = `${item.city}, ${normalizedMapCountry(item.countryCode)}`;
        tooltip.append(heading, document.createElement("br"), location);
        if (item.occurredAt) {
          const eventTime = document.createElement("small");
          eventTime.textContent = new Intl.DateTimeFormat(locale === "es" ? "es-PE" : "en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.occurredAt));
          tooltip.append(document.createElement("br"), eventTime);
        }
        marker.bindTooltip(tooltip).addTo(map);
      });

      map.fitBounds(L.latLngBounds(latlngs), { padding: [38, 38], maxZoom: 8 });
      cleanup = () => map.remove();
    });
    return () => { disposed = true; cleanup(); };
  }, [locale, route, t]);

  if (!model) {
    return (
      <div className={styles.empty}>
        <MapPin size={27} />
        <strong>{t("Aún no hay una ruta persistida para mostrar", "No persisted route to display yet")}</strong>
        <p>
          {t(
            "Cuando la solicitud exista y tenga origen y destino operativos, mostraremos su corredor programado. No se muestra ninguna ruta de reemplazo ante códigos no encontrados.",
            "When the request exists and has operational origin and destination, its planned corridor will appear here. No fallback route is displayed for missing codes."
          )}
        </p>
      </div>
    );
  }

  if (route.points.length < 2) {
    return (
      <div className={styles.empty}>
        <MapPin size={27} />
        <strong>{t("No reconocemos las ubicaciones de esta ruta", "Route locations are not recognized")}</strong>
        <p>
          {t(
            "La solicitud existe, pero sus ciudades no están disponibles en el catálogo de coordenadas del mapa.",
            "The request exists, but its cities are not available in the map coordinate catalog."
          )}
        </p>
      </div>
    );
  }

  const isPlanned = model.mode === "planned";
  const hasCheckpoints = model.checkpoints.length > 0;

  const modeBadge = isPlanned
    ? t("Ruta planificada", "Planned route")
    : hasCheckpoints
      ? t("Eventos confirmados", "Confirmed events")
      : t("Booking confirmado · Esperando reporte", "Booking confirmed · Awaiting report");

  const mapNotice = isPlanned && route.followsRoadCorridor
    ? t(
        "Corredor vial de referencia (Panamericana Sur PE-1S / Ruta 5); no hay carrier asignado ni telemetría en vivo.",
        "Reference highway corridor (Pan-American PE-1S / Route 5); no carrier is assigned and no live telemetry is available.",
      )
    : isPlanned
      ? t(
          "Referencia geográfica basada en el origen y destino persistidos; el detalle vial de este corredor aún no está disponible y no se representa telemetría en vivo.",
          "Geographic reference based on the persisted origin and destination; detailed road geometry is not yet available for this corridor and no live telemetry is shown.",
        )
    : hasCheckpoints
      ? t(
          "Checkpoints reportados por el carrier según contratos de booking. No representa GPS en vivo.",
          "Checkpoints reported by the carrier according to booking contracts. Does not represent live GPS.",
        )
      : t(
          "Booking confirmado; el carrier aún no ha emitido checkpoints de ubicación. Se muestra el corredor programado.",
          "Booking confirmed; the carrier has not reported location checkpoints yet. The planned corridor is shown.",
        );

  return (
    <div ref={wrapper} className={styles.wrapper}>
      <div className={styles.notice} role="status" aria-label={t("Estado de seguimiento", "Tracking status")}>
        <div className={styles.noticeHeader}>
          <span className={isPlanned ? styles.badgePlanned : hasCheckpoints ? styles.badgeConfirmed : styles.badgeAwaiting}>
            {modeBadge}
          </span>
          <strong>{model.requestCode}</strong>
        </div>
        <span className={styles.noticeText}>{mapNotice}</span>
      </div>
      <div ref={element} className={styles.map} aria-label={t("Mapa del corredor del despacho", "Shipment corridor map")} />
      <div className={styles.legend} aria-label={t("Leyenda del mapa", "Map legend")}>
        <span><i className={styles.endpoint} />{t("Origen / destino", "Origin / destination")}</span>
        <span><i className={styles.nominalLine} />{t("Ruta planificada", "Planned route")}</span>
        {hasCheckpoints ? (
          <span><i className={styles.checkpoint} />{t("Evento confirmado", "Confirmed event")}</span>
        ) : null}
      </div>
    </div>
  );
}

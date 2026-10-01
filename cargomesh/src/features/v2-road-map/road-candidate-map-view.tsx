"use client";

import { Info, Route } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useLocale } from "@/features/i18n/locale-provider";
import { getMapPresentation, providerNote, routeSourceLabel, type MapPresentation, type MapProvider } from "./road-map-model";
import { RoadMapCanvas } from "./road-map-canvas";
import type { RoadCandidateMapViewProps } from "./road-map-contract";
import styles from "./road-candidate-map-view.module.css";

export type { RoadCandidateMapViewProps } from "./road-map-contract";

function mapStatusLabel(status: MapPresentation["provenanceStatus"], locale: "es" | "en") {
  const labels = {
    VERIFIED: locale === "es" ? "Verificada" : "Verified",
    ESTIMATED: locale === "es" ? "Estimada" : "Estimated",
    SIMULATED: locale === "es" ? "Simulada" : "Simulated",
    UNKNOWN: "UNKNOWN",
  };
  return labels[status];
}

/** Presentational V2 ROAD map. HAC-14 owns the parent state and mapper. */
export function RoadCandidateMapView(props: RoadCandidateMapViewProps) {
  const { locale, t } = useLocale();
  const presentation = useMemo(() => getMapPresentation(props), [props.origin, props.destination, props.candidates, props.selectedCandidateId]);
  const [provider, setProvider] = useState<MapProvider>("loading");
  const handleProviderChange = useCallback((next: MapProvider) => setProvider(next), []);
  const selected = presentation.selectedCandidate;
  const preview = selected?.routePreview;
  const source = routeSourceLabel(presentation.geometrySource, locale);
  const note = provider === "loading"
    ? t("Cargando proveedor cartográfico…", "Loading map provider…")
    : providerNote(provider, presentation, locale);

  return <section className={styles.root} aria-label={t("Candidatos y mapa de ruta ROAD", "ROAD candidates and route map")}>
    <header className={styles.header}>
      <div className={styles.headerCopy}>
        <span className={styles.kicker}><Route size={15} aria-hidden="true" /> ROAD</span>
        <h2>{t("Rutas candidatas", "Candidate routes")}</h2>
        <p>{props.origin.label} <span aria-hidden="true">→</span> {props.destination.label}</p>
      </div>
      <span className={`${styles.overall} ${styles[props.overallStatus]}`}>
        {props.overallStatus === "eligible" ? t("Hay opciones elegibles", "Eligible options available")
          : props.overallStatus === "ineligible" ? t("Sin opción elegible", "No eligible option")
            : t("Evaluación no concluyente", "Evaluation inconclusive")}
      </span>
    </header>

    <div className={styles.body}>
      <div className={styles.candidates} aria-label={t("Lista de candidatos", "Candidate list")}>
        {props.candidates.length === 0
          ? <div className={styles.emptyCandidates}><strong>{t("No se devolvieron candidatos ROAD para esta solicitud.", "No ROAD candidates were returned for this request.")}</strong><span>{t("Puedes revisar los datos de origen, destino y carga.", "Review the origin, destination, and cargo details.")}</span></div>
          : props.candidates.map((candidate) => {
            const active = candidate.candidateId === props.selectedCandidateId;
            return <button
              className={`${styles.candidate} ${active ? styles.candidateActive : ""}`}
              type="button"
              key={candidate.candidateId}
              aria-pressed={active}
              onClick={() => props.onSelectCandidate(candidate.candidateId)}
            >
              <span className={styles.candidateTop}><strong>{candidate.carrierName}</strong><span className={styles.candidateStatus}>{candidate.status === "eligible" ? t("Elegible", "Eligible") : candidate.status === "ineligible" ? t("No elegible", "Ineligible") : t("Por verificar", "Unverified")}</span></span>
              <span className={styles.candidateMeta}>{candidate.serviceCode} · ROAD</span>
              <span className={styles.candidateBottom}>{candidate.routePreview
                ? `${mapStatusLabel(candidate.routePreview.provenanceStatus, locale)} · ${routeSourceLabel(candidate.routePreview.geometrySource, locale) ?? t("Sin fuente de geometría", "No geometry source")}`
                : t("Sin vista previa de ruta", "No route preview")}</span>
            </button>;
          })}
      </div>

      <div className={styles.mapColumn}>
        <div className={styles.mapHead}><div><strong>{t("Vista de ruta", "Route view")}</strong><span>{selected ? selected.carrierName : t("Selecciona un candidato para ver su ruta", "Select a candidate to view its route")}</span></div><span className={styles.provenance}>{mapStatusLabel(presentation.provenanceStatus, locale)}</span></div>
        <RoadMapCanvas presentation={presentation} onProviderChange={handleProviderChange} />
        <p className={styles.providerNote} aria-live="polite"><Info size={14} aria-hidden="true" /><span>{note}</span></p>
        <div className={styles.routeFacts} aria-live="polite">
          <div><small>{t("Estado de geometría", "Geometry status")}</small><strong>{presentation.paths.length ? mapStatusLabel(presentation.provenanceStatus, locale) : t("Sin geometría verificable", "No verifiable geometry")}</strong></div>
          <div><small>{t("Fuente declarada", "Declared source")}</small><strong>{source ?? t("No disponible", "Unavailable")}</strong></div>
          <div><small>{t("Distancia", "Distance")}</small><strong>{presentation.distanceKm === null ? t("No disponible", "Unavailable") : `${presentation.distanceKm.toLocaleString(locale === "es" ? "es-PE" : "en-US")} km`}</strong></div>
          <div><small>{t("Tiempo estimado", "Estimated time")}</small><strong>{presentation.estimatedTransitHours === null ? t("No disponible", "Unavailable") : `${presentation.estimatedTransitHours.toLocaleString(locale === "es" ? "es-PE" : "en-US")} h`}</strong></div>
        </div>
        {!preview || presentation.paths.length === 0 ? <p className={styles.noGeometry}>{t("La solicitud no incluye una geometría de ruta utilizable. No se dibuja ninguna línea.", "This request has no usable route geometry. No line is drawn.")}</p> : null}
      </div>
    </div>
  </section>;
}

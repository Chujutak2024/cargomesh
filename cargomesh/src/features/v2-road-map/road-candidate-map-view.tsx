"use client";

import { Building2, Info, Route, Truck } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useLocale } from "@/features/i18n/locale-provider";
import { getMapPresentation, providerNote, type MapProvider } from "./road-map-model";
import { RoadMapCanvas } from "./road-map-canvas";
import type { RoadCandidateMapViewProps } from "./road-map-contract";
import styles from "./road-candidate-map-view.module.css";

export type { RoadCandidateMapViewProps } from "./road-map-contract";

/** Presentational V2 ROAD map. HAC-14 owns the parent state and mapper. */
export function RoadCandidateMapView(props: RoadCandidateMapViewProps & { hideEmptyGuidance?: boolean }) {
  const { locale, t } = useLocale();
  const presentation = useMemo(() => getMapPresentation(props), [props.origin, props.destination, props.candidates, props.selectedCandidateId]);
  const [provider, setProvider] = useState<MapProvider>("loading");
  const handleProviderChange = useCallback((next: MapProvider) => setProvider(next), []);
  const selected = presentation.selectedCandidate;
  const note = provider === "loading"
    ? t("Cargando proveedor cartográfico…", "Loading map provider…")
    : providerNote(provider, presentation, locale);

  return <section className={styles.root} aria-label={t("Candidatos y mapa de ruta ROAD", "ROAD candidates and route map")}>
    <header className={styles.header}>
      <div className={styles.headerCopy}>
        <h2>{t("Rutas candidatas", "Candidate routes")}</h2>
      </div>
      <span className={`${styles.overall} ${styles[props.overallStatus]}`}>
        {props.overallStatus === "eligible" ? t("Hay opciones elegibles", "Eligible options available")
          : props.overallStatus === "ineligible" ? t("Sin opción elegible", "No eligible option")
            : t("Evaluación no concluyente", "Evaluation inconclusive")}
      </span>
    </header>

    <div className={styles.body}>
      <div className={styles.candidates} role="group" aria-label={t("Lista de candidatos", "Candidate list")}>
        <div className={styles.listHeading}><strong>{t("Opciones ROAD", "ROAD options")}</strong><span>{props.candidates.length}</span></div>
        {props.candidates.length === 0
          ? <div className={styles.emptyCandidates}><strong>{t("No se devolvieron candidatos ROAD para esta solicitud.", "No ROAD candidates were returned for this request.")}</strong>{!props.hideEmptyGuidance ? <span>{t("Puedes revisar los datos de origen, destino y carga.", "Review the origin, destination, and cargo details.")}</span> : null}</div>
          : props.candidates.map((candidate) => {
            const active = candidate.candidateId === props.selectedCandidateId;
            const candidatePresentation = getMapPresentation({ ...props, selectedCandidateId: candidate.candidateId });
            return <button
              className={`${styles.candidate} ${active ? styles.candidateActive : ""}`}
              type="button"
              key={candidate.candidateId}
              aria-pressed={active}
              onClick={() => props.onSelectCandidate(candidate.candidateId)}
            >
              <span className={styles.candidateTop}><strong>{candidate.carrierName}</strong><span className={styles.candidateStatus}>{candidate.status === "eligible" ? t("Elegible", "Eligible") : candidate.status === "ineligible" ? t("No elegible", "Ineligible") : t("Por verificar", "Unverified")}</span></span>
              <span className={styles.candidateMeta}>{candidate.serviceCode}</span>
              <span className={styles.candidateBottom}>{candidatePresentation.paths.length
                ? t("Geometría disponible", "Geometry available")
                : t("Sin geometría utilizable", "No usable geometry")}</span>
            </button>;
          })}
      </div>

      <div className={styles.mapColumn}>
        <div className={styles.mapHead}><div><strong>{t("Vista de ruta", "Route view")}</strong>{!selected && (props.candidates.length > 0 || !props.hideEmptyGuidance) ? <span>{props.candidates.length ? t("Selecciona un candidato para ver su ruta", "Select a candidate to view its route") : t("Origen y destino · sin opciones disponibles", "Origin and destination · no options available")}</span> : null}</div></div>
        <RoadMapCanvas presentation={presentation} onProviderChange={handleProviderChange} />
        <p className={styles.providerNote} aria-live="polite"><Info size={14} aria-hidden="true" /><span>{note}</span></p>
      </div>
      <aside className={styles.detailsColumn} aria-label={t("Detalle de la ruta seleccionada", "Selected route details")}>
        <div className={styles.detailsHeading}><Route size={18} aria-hidden="true" /><strong>{t("Detalle de ruta", "Route details")}</strong></div>
        <div className={styles.detailsEndpoints}><div><Truck size={16} aria-hidden="true" /><span><small>{t("Origen", "Origin")}</small><strong>{props.origin.city}</strong></span></div><div><Building2 size={16} aria-hidden="true" /><span><small>{t("Destino", "Destination")}</small><strong>{props.destination.city}</strong></span></div></div>
        <div className={styles.routeFacts} aria-live="polite">
          <div><small>{t("Distancia", "Distance")}</small><strong>{presentation.distanceKm === null ? t("No disponible", "Unavailable") : `${presentation.distanceKm.toLocaleString(locale === "es" ? "es-PE" : "en-US")} km`}</strong></div>
          <div><small>{t("Tiempo estimado", "Estimated time")}</small><strong>{presentation.estimatedTransitHours === null ? t("No disponible", "Unavailable") : `${presentation.estimatedTransitHours.toLocaleString(locale === "es" ? "es-PE" : "en-US")} h`}</strong></div>
        </div>
      </aside>
    </div>
  </section>;
}

import { MapPin, Route } from "lucide-react";

import { Badge } from "@/components/ui";
import type { RoadCandidateMapViewProps } from "../contracts";
import styles from "./v2-intake-components.module.css";

type Translate = (spanish: string, english: string) => string;

/**
 * Typed mount boundary for HAC-15.
 *
 * The actual provider-backed <RoadCandidateMapView /> belongs to FE-2. Until it
 * lands, this component renders only facts present in the HAC-27 props and never
 * fabricates a polyline from endpoints.
 */
export function RoadCandidateMapBoundary({ props, t }: { props: RoadCandidateMapViewProps; t: Translate }) {
  const selected = props.candidates.find((candidate) => candidate.candidateId === props.selectedCandidateId)
    ?? props.candidates[0]
    ?? null;
  const preview = selected?.routePreview ?? null;
  const hasVerifiedGeometry = Boolean(
    preview
    && preview.provenanceStatus !== "UNKNOWN"
    && preview.legs.some((leg) => leg.waypoints.length > 1),
  );

  return (
    <section className={styles.mapBoundary} aria-label={t("Vista de ruta ROAD", "ROAD route view")}>
      <header className={styles.mapHeader}>
        <div>
          <span className={styles.eyebrow}>RoadCandidateMapViewProps</span>
          <h3>{t("Mapa de candidatos ROAD", "ROAD candidate map")}</h3>
          <p>{t(
            "Punto de montaje tipado para el mapa de HAC-15. Esta vista no interpola trazas.",
            "Typed mount point for the HAC-15 map. This view never interpolates routes.",
          )}</p>
        </div>
        <Badge tone={hasVerifiedGeometry ? "preliminary" : "unknown"}>
          {hasVerifiedGeometry ? preview?.provenanceStatus : "UNKNOWN"}
        </Badge>
      </header>

      <div className={styles.mapLocations}>
        <Location label={t("Origen", "Origin")} value={`${props.origin.label} · ${props.origin.city}`} />
        <span className={styles.mapConnector} aria-hidden="true"><Route size={18} /></span>
        <Location label={t("Destino", "Destination")} value={`${props.destination.label} · ${props.destination.city}`} />
      </div>

      {hasVerifiedGeometry ? (
        <div className={styles.mapFacts}>
          <Fact label={t("Corredor", "Corridor")} value={preview?.corridorCode ?? t("Sin código", "No code")} />
          <Fact label={t("Distancia", "Distance")} value={preview?.distanceKm == null ? "UNKNOWN" : `${preview.distanceKm} km`} />
          <Fact label="ETA" value={preview?.estimatedTransitHours == null ? "UNKNOWN" : `${preview.estimatedTransitHours} h`} />
          <Fact label={t("Fuente", "Source")} value={preview?.geometrySource ?? "UNKNOWN"} />
        </div>
      ) : (
        <div className={styles.mapUnknown} role="status">
          <MapPin size={18} aria-hidden="true" />
          <div>
            <strong>{t("Sin geometría de ruta verificable", "No verifiable route geometry")}</strong>
            <span>{t(
              "Se muestran únicamente las ubicaciones canónicas disponibles; no se dibuja una línea ni se afirma cobertura.",
              "Only available canonical locations are shown; no line is drawn and coverage is not asserted.",
            )}</span>
          </div>
        </div>
      )}
    </section>
  );
}

function Location({ label, value }: { label: string; value: string }) {
  return <div className={styles.location}><MapPin size={16} aria-hidden="true" /><span><small>{label}</small><strong>{value}</strong></span></div>;
}

function Fact({ label, value }: { label: string; value: string }) {
  return <div className={styles.fact}><small>{label}</small><strong>{value}</strong></div>;
}

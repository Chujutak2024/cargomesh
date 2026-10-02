import { CalendarClock, CheckCircle2, CircleHelp, ShieldAlert, Truck } from "lucide-react";

import { Badge, Button } from "@/components/ui";
import type {
  EligibilityStatusV2,
  RoadServiceabilityEvaluationV2Data,
} from "../contracts";
import { formatProvenanceTimestamp } from "../provenance";
import styles from "./v2-intake-components.module.css";

type Translate = (spanish: string, english: string) => string;

export function CandidateResults({
  evaluation,
  selectedCandidateId,
  onSelectCandidate,
  t,
}: {
  evaluation: RoadServiceabilityEvaluationV2Data;
  selectedCandidateId: string | null;
  onSelectCandidate: (candidateId: string) => void;
  t: Translate;
}) {
  if (evaluation.candidates.length === 0) {
    return (
      <section className={styles.emptyState} role="status">
        <ShieldAlert size={22} aria-hidden="true" />
        <div>
          <h3>{t("Cero candidatos para esta ruta y ventana", "Zero candidates for this route and window")}</h3>
          <p>{t(
            "La evaluación respondió sin servicios candidatos. Esto no autoriza inventar una ruta, precio u oferta.",
            "The evaluation returned no candidate services. This does not authorize inventing a route, price, or offer.",
          )}</p>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.resultsSection} aria-labelledby="candidate-results-title">
      <header className={styles.resultsHeader}>
        <div>
          <span className={styles.eyebrow}>{t("Evaluación de servicio", "Serviceability evaluation")}</span>
          <h3 id="candidate-results-title">{t("Candidatos ROAD preliminares", "Preliminary ROAD candidates")}</h3>
          <small>{t("Versión evaluada", "Evaluated version")} {evaluation.evaluatedDraftVersion} · {formatProvenanceTimestamp(evaluation.evaluatedAt)}</small>
        </div>
        <StatusBadge status={evaluation.overallStatus} t={t} />
      </header>
      <div className={styles.candidateGrid}>
        {evaluation.candidates.map((candidate) => {
          const selected = candidate.candidateId === selectedCandidateId;
          const provenance = candidate.checks.capacityWindow.provenance;
          return (
            <article className={`${styles.candidateCard} ${selected ? styles.candidateSelected : ""}`} key={candidate.candidateId}>
              <header>
                <div className={styles.carrierIdentity}>
                  <span className={styles.carrierIcon}><Truck size={17} aria-hidden="true" /></span>
                  <span><strong>{candidate.carrier.commercialName}</strong><small>{candidate.service.code} · {candidate.service.serviceClass}</small></span>
                </div>
                <StatusBadge status={candidate.status} t={t} />
              </header>
              <div className={styles.checkGrid}>
                <Check label={t("Cobertura", "Coverage")} status={candidate.checks.coverage.status} />
                <Check label="Lane" status={candidate.checks.lane.status} />
                <Check label={t("Carga y equipo", "Cargo & equipment")} status={candidate.checks.cargoAndEquipment.status} />
                <Check label={t("Capacidad", "Capacity")} status={candidate.checks.capacityWindow.status} />
              </div>
              <div className={styles.provenance}>
                <CalendarClock size={15} aria-hidden="true" />
                <span>
                  <strong>{provenance.provenanceStatus} · {provenance.dataSource}</strong>
                  <small>{t("Observado", "Observed")}: {formatProvenanceTimestamp(provenance.observedAt)} · {t("Vigente hasta", "Valid until")}: {formatProvenanceTimestamp(provenance.validUntil)}</small>
                </span>
              </div>
              <ul className={styles.reasons}>{candidate.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
              <Button
                variant={selected ? "primary" : "secondary"}
                type="button"
                aria-pressed={selected}
                onClick={() => onSelectCandidate(candidate.candidateId)}
              >
                {selected ? t("Seleccionado en el mapa", "Selected on map") : t("Ver en el mapa", "View on map")}
              </Button>
            </article>
          );
        })}
      </div>
      <p className={styles.commercialBoundary}>{evaluation.commercialNotice} · {t(
        "La evaluación no es una cotización, ranking, reserva ni disponibilidad comercial confirmada.",
        "The evaluation is not a quote, ranking, booking, or confirmed commercial availability.",
      )}</p>
    </section>
  );
}

function Check({ label, status }: { label: string; status: EligibilityStatusV2 }) {
  const Icon = status === "eligible" ? CheckCircle2 : status === "ineligible" ? ShieldAlert : CircleHelp;
  return <div className={styles.check}><Icon size={15} aria-hidden="true" /><span><small>{label}</small><strong>{status.toUpperCase()}</strong></span></div>;
}

function StatusBadge({ status, t }: { status: EligibilityStatusV2; t: Translate }) {
  const tone = status === "eligible" ? "confirmed" : status === "unknown" ? "unknown" : "neutral";
  const label = status === "eligible" ? t("Elegible", "Eligible") : status === "unknown" ? t("Desconocido", "Unknown") : t("No elegible", "Ineligible");
  return <Badge tone={tone}>{label}</Badge>;
}

"use client";

import { useState } from "react";
import { LanguageSwitcher } from "@/components/language-switcher";
import { RoadCandidateMapView } from "@/features/v2-road-map/road-candidate-map-view";
import { scenarioData, scenarios, type Scenario } from "@/features/v2-road-map/road-map-qa-fixtures";
import { useLocale } from "@/features/i18n/locale-provider";
import styles from "./road-map-preview.module.css";

export function RoadMapPreviewClient() {
  const [scenario, setScenario] = useState<Scenario>("eligible");
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>("road-a");
  const { t } = useLocale();
  const scenarioProps = scenarioData(scenario);
  const labels: Record<Scenario, string> = {
    eligible: t("Elegible", "Eligible"), unknown: "routePreview: null", "empty-legs": "legs: []",
    "unknown-points": t("UNKNOWN con puntos", "UNKNOWN with points"), zero: t("Sin candidatos", "No candidates"),
    missing: t("Sin coordenada", "Missing coordinate"), "missing-both": t("Sin coordenadas", "No coordinates"),
    "google-source": t("Fuente Google / sin traza", "Google source / no trace"),
  };

  return <main className={styles.page}>
    <header className={styles.header}>
      <div><span>HAC-15 · Contract QA</span><h1>{t("Mapa ROAD V2", "V2 ROAD map")}</h1><p>{t("Superficie de prueba con datos sintéticos del contrato HAC-27. No representa una solicitud persistida.", "Test surface with synthetic HAC-27 contract data. It is not a persisted request.")}</p></div>
      <div className={styles.switcher} aria-label={t("Escenario de prueba", "Test scenario")}>
        <LanguageSwitcher compact />
        {scenarios.map((item) => <button key={item} type="button" aria-pressed={scenario === item} onClick={() => { setScenario(item); setSelectedCandidateId(item === "unknown" ? "road-b" : item === "zero" ? null : "road-a"); }}>
          {labels[item]}
        </button>)}
      </div>
    </header>
    <div className={styles.sharedSelection} aria-label={t("Selección compartida de prueba", "Shared test selection")}>
      <p>{t("Control padre de prueba; no usa la API ni las tarjetas de Luis. Todas las fuentes y medidas de esta página son fixtures locales.", "Test parent control; it does not use the API or Luis's cards. All sources and measurements on this page are local fixtures.")}</p>
      <div className={styles.switcher}>{scenarioProps.candidates.map((candidate) => <button key={candidate.candidateId} type="button" aria-pressed={selectedCandidateId === candidate.candidateId} onClick={() => setSelectedCandidateId(candidate.candidateId)}>{t("Tarjeta", "Card")} {candidate.candidateId === "road-a" ? "A" : "B"}</button>)}<button type="button" onClick={() => setSelectedCandidateId(null)}>{t("Quitar selección", "Clear selection")}</button></div>
      <output aria-live="polite">selectedCandidateId: {selectedCandidateId ?? "null"}</output>
    </div>
    <RoadCandidateMapView {...scenarioProps} selectedCandidateId={selectedCandidateId} onSelectCandidate={setSelectedCandidateId} />
  </main>;
}

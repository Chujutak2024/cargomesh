"use client";

import { useState } from "react";
import { LanguageSwitcher } from "@/components/language-switcher";
import { RoadCandidateMapView } from "@/features/v2-road-map/road-candidate-map-view";
import type { RoadCandidateMapViewProps } from "@/features/v2-road-map/road-map-contract";
import { useLocale } from "@/features/i18n/locale-provider";
import styles from "./road-map-preview.module.css";

const base: Omit<RoadCandidateMapViewProps, "selectedCandidateId" | "onSelectCandidate"> = {
  origin: { label: "Planta Callao Norte", city: "Callao", countryCode: "PE", lat: -12.0464, lng: -77.1181 },
  destination: { label: "Centro de distribución Arequipa", city: "Arequipa", countryCode: "PE", lat: -16.409, lng: -71.5375 },
  overallStatus: "eligible",
  candidates: [{
    candidateId: "road-a", status: "eligible",
    carrier: { id: "carrier-a", code: "TEST-A", commercialName: "Transportista de escenario A" },
    service: { id: "service-a", code: "ROAD-SUR", mode: "ROAD" },
    carrierName: "Transportista de escenario A", serviceCode: "ROAD-SUR",
    routePreview: {
      corridorCode: "PE-PANAM-SUR-1S", distanceKm: 1015, estimatedTransitHours: 18.5,
      geometrySource: "SCENARIO_SYNTHETIC_GEOMETRY", provenanceStatus: "SIMULATED",
      legs: [{ sequence: 1, mode: "ROAD", originLabel: "Callao", destinationLabel: "Arequipa",
        waypoints: [{ lat: -12.0464, lng: -77.1181 }, { lat: -14.0678, lng: -75.7286 }, { lat: -16.409, lng: -71.5375 }], conditions: [] }],
    },
  }, {
    candidateId: "road-b", status: "unknown",
    carrier: { id: "carrier-b", code: "TEST-B", commercialName: "Transportista de escenario B" },
    service: { id: "service-b", code: "ROAD-SUR-B", mode: "ROAD" },
    carrierName: "Transportista de escenario B", serviceCode: "ROAD-SUR-B", routePreview: null,
  }],
};

type Scenario = "eligible" | "unknown" | "zero" | "missing";

export function RoadMapPreviewClient() {
  const [scenario, setScenario] = useState<Scenario>("eligible");
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>("road-a");
  const { t } = useLocale();
  const scenarioProps: Omit<RoadCandidateMapViewProps, "selectedCandidateId" | "onSelectCandidate"> = scenario === "zero"
    ? { ...base, candidates: [], overallStatus: "unknown" }
    : scenario === "missing"
      ? { ...base, origin: { ...base.origin, lat: null }, candidates: base.candidates.slice(0, 1) }
      : scenario === "unknown"
        ? { ...base, candidates: base.candidates.slice(1), overallStatus: "unknown" }
        : base;
  const selected = scenario === "zero" ? null : scenario === "unknown" ? "road-b" : selectedCandidateId;

  return <main className={styles.page}>
    <header className={styles.header}>
      <div><span>HAC-15 · Contract QA</span><h1>{t("Mapa ROAD V2", "V2 ROAD map")}</h1><p>{t("Superficie de prueba con datos sintéticos del contrato HAC-27. No representa una solicitud persistida.", "Test surface with synthetic HAC-27 contract data. It is not a persisted request.")}</p></div>
      <div className={styles.switcher} aria-label={t("Escenario de prueba", "Test scenario")}>
        <LanguageSwitcher compact />
        {(["eligible", "unknown", "zero", "missing"] as Scenario[]).map((item) => <button key={item} type="button" aria-pressed={scenario === item} onClick={() => { setScenario(item); setSelectedCandidateId(item === "unknown" ? "road-b" : item === "zero" ? null : "road-a"); }}>
          {item === "eligible" ? t("Elegible", "Eligible") : item === "unknown" ? "UNKNOWN" : item === "zero" ? t("Sin candidatos", "No candidates") : t("Sin coordenada", "Missing coordinate")}
        </button>)}
      </div>
    </header>
    <RoadCandidateMapView {...scenarioProps} selectedCandidateId={selected} onSelectCandidate={setSelectedCandidateId} />
  </main>;
}

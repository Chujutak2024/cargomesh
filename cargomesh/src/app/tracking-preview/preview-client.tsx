"use client";
import { useState } from "react";
import { useLocale } from "@/features/i18n/locale-provider";
import { TrackingDetail } from "@/features/shipper-portal/tracking-detail";
import { TrackingList } from "@/features/shipper-portal/tracking-list";
import { routeRecordToPresentation } from "@/features/shipper-portal/tracking-model";
import { trackingQaItem, trackingQaScenarios, type TrackingQaScenario } from "@/features/shipper-portal/tracking-qa-fixtures";
import TrackingLoading from "../(cargomesh)/tracking/loading";
import TrackingError from "../(cargomesh)/tracking/error";
import s from "@/features/shipper-portal/tracking-experience.module.css";

type Scenario = TrackingQaScenario | "list" | "empty" | "loading" | "error";
export function TrackingPreview() {
  const [scenario, setScenario] = useState<Scenario>("initial");
  const { locale } = useLocale();
  const item = trackingQaItem(trackingQaScenarios.includes(scenario as TrackingQaScenario) ? scenario as TrackingQaScenario : "initial");
  return <main style={{ padding: "clamp(12px, 3vw, 40px)", background: "var(--cm-color-surface-subtle)" }}>
    <div className={s.page}>
      <section className={s.panel} style={{ padding: "1rem", marginBottom: "1rem" }}>
        <strong>UI QA · Synthetic scenarios · No API calls</strong>
        <p>Development-only component preview. Not persisted transport data or live integration evidence.</p>
        <label>Scenario <select value={scenario} onChange={(event) => setScenario(event.target.value as Scenario)}>
          {[...trackingQaScenarios, "list", "empty", "loading", "error"].map((value) => <option key={value} value={value}>{value}</option>)}
        </select></label>
      </section>
      {scenario === "list" || scenario === "empty" ? <TrackingList items={scenario === "empty" ? [] : trackingQaScenarios.map(trackingQaItem)}/>
        : scenario === "loading" ? <TrackingLoading/>
        : scenario === "error" ? <TrackingError error={new Error("Explicit QA service failure")} reset={() => setScenario("initial")}/>
        : <TrackingDetail key={scenario} {...item} locale={locale} requestId={null} origin="Lima" destination="Arequipa" originLabel="UI QA origin" destinationLabel="UI QA destination" presentation={routeRecordToPresentation(null)} canView3D={false}/>}
    </div>
  </main>;
}

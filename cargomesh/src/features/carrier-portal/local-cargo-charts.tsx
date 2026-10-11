"use client";
import {useId,useState} from "react";
import { useLocale } from "@/features/i18n/locale-provider";
import {localRequestReference} from "./local-request-presentation";
import type { LocalDraft } from "./local-draft-model";
import type { LocalRequestEntry } from "./local-request-demo";
import { cargoChartModel } from "./cargo-chart-model";
import s from "./local-cargo-charts.module.css";

export function LocalCargoCharts({ draft, entries }: { draft: LocalDraft; entries: LocalRequestEntry[] }) {
  const { locale, t } = useLocale();
  const gradient=useId(),[hovered,setHovered]=useState<string|null>(null);
  const model = cargoChartModel(draft, entries.map(entry => entry.record.draft));
  const number = (value: number) => value.toLocaleString(locale === "es" ? "es-PE" : "en-US", { maximumFractionDigits: 1 });
  const share = Math.round(model.share * 100);
  return <div className={s.charts}>
    <section className={s.chartCard} aria-label={t("Participación de esta solicitud en el peso total", "This request's share of total cargo weight")}>
      <h3>{t("Carga de esta solicitud", "This request's cargo")}</h3>
      <div className={s.distribution}><div className={s.donut} aria-hidden="true"><svg viewBox="0 0 100 100"><defs><linearGradient id={gradient} x1="0" y1="1" x2="1" y2="0"><stop stopColor="#087788"/><stop offset="1" stopColor="#33d0bd"/></linearGradient></defs><circle cx={50} cy={50} r={40} fill="none" stroke="#e2ebf3" strokeWidth={9}/><circle className={s.donutArc} cx={50} cy={50} r={40} fill="none" stroke={`url(#${gradient})`} strokeWidth={9} strokeLinecap="round" strokeDasharray={`${model.share * 251.33} 251.33`} transform="rotate(-90 50 50)"/></svg><strong>{share}%</strong></div>
        <dl><div><dt>{t("Esta solicitud", "This request")}</dt><dd>{number(model.selectedWeightKg)} kg</dd></div><div><dt>{t("Total de solicitudes", "All requests")}</dt><dd>{number(model.totalWeightKg)} kg</dd></div></dl></div>
      <div className={s.miniBars} role="group" aria-label={t("Peso por solicitud","Cargo weight per request")}>{entries.map(entry=>{const weight=entry.record.draft.quantity*entry.record.draft.unitWeightKg,max=Math.max(...entries.map(e=>e.record.draft.quantity*e.record.draft.unitWeightKg),1);return <button key={entry.id} type="button" aria-label={`${localRequestReference(entry.id)}: ${number(weight)} kg`} aria-pressed={hovered===entry.id} onMouseEnter={()=>setHovered(entry.id)} onFocus={()=>setHovered(entry.id)} onClick={()=>setHovered(entry.id)}><span style={{height:`${Math.max(4,weight/max*100)}%`}}/><small>{localRequestReference(entry.id).slice(-2)}</small></button>;})}</div>
      <p aria-live="polite">{hovered?`${localRequestReference(hovered)} · ${number((entries.find(e=>e.id===hovered)?.record.draft.quantity??0)*(entries.find(e=>e.id===hovered)?.record.draft.unitWeightKg??0))} kg`:`${share}% ${t("del peso de las","of cargo weight across")} ${entries.length} ${t("solicitudes","requests")}`}</p>
    </section>
    <section className={s.chartCard} aria-label={t("Comparación del peso por unidad", "Unit weight comparison")}>
      <h3>{t("Peso por unidad", "Weight per unit")}</h3>
      <div className={s.comparison}><div><span>{t("Esta solicitud", "This request")}<strong>{number(draft.unitWeightKg)} kg</strong></span><meter className={s.currentBar} min={0} max={model.comparisonMaxKg} value={draft.unitWeightKg} aria-label={t("Peso unitario de esta solicitud", "Unit weight for this request")}/></div>
        <div><span>{t("Promedio general", "Overall average")}<strong>{number(model.averageUnitWeightKg)} kg</strong></span><meter className={s.averageBar} min={0} max={model.comparisonMaxKg} value={model.averageUnitWeightKg} aria-label={t("Peso unitario medio de las solicitudes", "Average unit weight across requests")}/></div></div>
      <p>{t("Promedio calculado con todas las unidades", "Average calculated across all units")}</p>
    </section>
  </div>;
}

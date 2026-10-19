"use client";
import { ArrowRight, Truck } from "lucide-react";
import type { FreightRequestV2Response } from "@/shared/schemas/v2/freight-request";
import { useLocale } from "@/features/i18n/locale-provider";
import { LogisticsTruck } from "@/features/logistics-3d/logistics-truck";
import { DataValue } from "./contract-form";
import s from "./portal.module.css";
type Request=FreightRequestV2Response["data"];
/** Presentation of the fetched page, never a second draft or an operational KPI. */
export function RequestSummary({requests,onReview,onRoute}:{requests:Request[];onReview:(id:string)=>void;onRoute:(id:string)=>void}){
 const {locale,t}=useLocale(),es=locale==="es";const first=requests.find(row=>row.status==="DRAFT")??requests[0];
 if(!first)return null;
 const counts=Array.from(new Set(requests.map(row=>row.status))).map(status=>({status,count:requests.filter(row=>row.status===status).length}));
 const colors=["#00747c","#185be7","#7854b5","#a56716","#587485"];
 let offset=0;
 return <><section className={`${s.card} ${s.requestHero}`}><div className={s.heroContext}><span className={s.eyebrow}>{first.referenceCode}</span><span className={s.status}><DataValue value={first.status} es={es}/></span>
  <h2>{first.origin.city} <ArrowRight size={18} aria-hidden="true"/> {first.destination.city}</h2><p>{first.cargoSpecification.description}</p>
  <div className={s.heroFacts}><span><Truck size={16} aria-hidden="true"/>{first.acceptedModes.join(" · ")}</span><strong>{first.cargoSpecification.totalWeightKg.toLocaleString(locale)} kg</strong><span>{t("Versión","Version")} {first.draftVersion}</span></div>
 </div><LogisticsTruck compact/><div className={s.heroAction}><h3>{t("Tu siguiente paso","Your next step")}</h3><p>{t("Revisa la solicitud y consulta la evaluación antes de tomar una decisión.","Review the request and its evaluation before making a decision.")}</p>
  <button className={s.primary} onClick={()=>onReview(first.id)}>{t("Revisar solicitud","Review request")}<ArrowRight size={16} aria-hidden="true"/></button><button onClick={()=>onRoute(first.id)}>{t("Consultar ruta","Inspect route")}</button></div></section>
 <div className={s.dashboardGrid}><section className={s.card}><h2>{t("Solicitudes por estado","Requests by state")}</h2><p>{t("Distribución de la página consultada","Distribution of the fetched page")}</p><div className={s.distribution}>
  <div className={s.donut}><svg viewBox="0 0 120 120" role="img" aria-label={counts.map(item=>item.status+": "+item.count).join(", ")}><circle cx="60" cy="60" r="45" fill="none" stroke="#e8eef5" strokeWidth="12"/>{counts.map((item,index)=>{const portion=item.count/requests.length*100,start=offset;offset+=portion;return <circle key={item.status} cx="60" cy="60" r="45" fill="none" stroke={colors[index%colors.length]} strokeWidth="12" pathLength="100" strokeDasharray={`${portion} ${100-portion}`} strokeDashoffset={-start} transform="rotate(-90 60 60)"/>;})}</svg><strong>{requests.length}<small>{t("consultadas","fetched")}</small></strong></div>
  <ul className={s.legend}>{counts.map((item,index)=><li key={item.status}><span style={{color:colors[index%colors.length]}} aria-hidden="true">●</span><DataValue value={item.status} es={es}/><strong>{item.count}</strong></li>)}</ul></div><small>{t("No representa el total histórico ni confirma despacho.","Not a historical total or dispatch confirmation.")}</small></section>
 <section className={s.card}><h2>{t("Ventanas y contexto","Windows and context")}</h2><dl className={s.details}><div><dt>{t("Recogida de la solicitud destacada","Featured request pickup")}</dt><dd>{new Date(first.pickupWindow.startsAt).toLocaleString(locale)}</dd></div><div><dt>{t("Entrega solicitada","Requested delivery")}</dt><dd>{new Date(first.deliveryWindow.startsAt).toLocaleString(locale)}</dd></div><div><dt>{t("Última revisión del registro","Last record revision")}</dt><dd>{new Date(first.updatedAt).toLocaleString(locale)}</dd></div></dl><p style={{marginTop:16}}>{t("Son ventanas solicitadas. No equivalen a una ETA ni a un vehículo asignado.","These are requested windows, not an ETA or an assigned vehicle.")}</p><a href="#/shipments">{t("Ver todas las solicitudes consultadas","View all fetched requests")} →</a></section></div></>;
}

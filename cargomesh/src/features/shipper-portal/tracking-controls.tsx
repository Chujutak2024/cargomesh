"use client";
import {useRouter,useSearchParams} from "next/navigation";
import {useTransition} from "react";
import {RefreshCw,ArrowLeft} from "lucide-react";
import {WorkspaceLink as Link} from "@/features/workspace-mode/workspace-link";
import {useLocale} from "@/features/i18n/locale-provider";
import {parseTrackingQuery,trackingSearch} from "./tracking-query";
import s from "./tracking-experience.module.css";
export function TrackingRefresh() {
  const router=useRouter(),[pending,start]=useTransition(),{t}=useLocale();
  return <button type="button" className={s.heroAction} disabled={pending} onClick={()=>start(()=>router.refresh())} aria-busy={pending}>
    <RefreshCw size={16}/>{pending?t("Consultando…","Refreshing…"):t("Actualizar seguimiento","Refresh tracking")}</button>;
}
export function TrackingBackLink() {
  const params=useSearchParams(),{t}=useLocale();
  return <Link href={`/tracking${trackingSearch(parseTrackingQuery(params))}`}><ArrowLeft size={15}/>{t("Transportes","Transports")}</Link>;
}

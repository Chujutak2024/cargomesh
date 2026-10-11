"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useLocale } from "@/features/i18n/locale-provider";
import s from "@/features/shipper-portal/tracking-experience.module.css";

export default function TrackingError({ reset }: { error: Error; reset: () => void }) {
  const { t } = useLocale();
  return <section className={s.errorPanel} role="alert"><AlertTriangle size={27} aria-hidden="true"/><span className={s.eyebrow}>{t("Consulta fallida", "Query failed")}</span><h1>{t("No pudimos cargar el seguimiento", "Tracking could not be loaded")}</h1><p>{t("La consulta autenticada al servicio V2 falló. No mostramos etapas ni ubicaciones de una lectura anterior.", "The authenticated V2 query failed. We do not display stages or locations from an earlier read.")}</p><div><button type="button" onClick={reset}><RefreshCw size={16} aria-hidden="true"/>{t("Reintentar", "Retry")}</button><Link href="/tracking">{t("Volver a transportes", "Back to transports")}</Link></div></section>;
}

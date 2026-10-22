"use client";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { useLocale } from "@/features/i18n/locale-provider";
import { Button } from "./ui";
import styles from "./operational-state.module.css";
export function OperationalError({ reset }: { error: Error; reset: () => void }) { const {t}=useLocale(); return <section role="alert" className={styles.error}><AlertTriangle size={24} aria-hidden="true"/><strong>{t("No pudimos cargar esta vista","We could not load this view")}</strong><span>{t("La consulta autenticada falló. Puedes volver a intentarlo.","The authenticated query failed. You can try again.")}</span><Button type="button" onClick={reset}><RefreshCw size={16} aria-hidden="true"/>{t("Reintentar","Retry")}</Button></section>; }

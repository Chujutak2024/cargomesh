"use client";
import { Save } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/features/i18n/locale-provider";
import styles from "./organization-policies.module.css";

type Policies = { confidence_threshold: number; anomaly_threshold_pct: number; max_pickup_wait_hours: number; allow_auto_booking: boolean; allow_auto_recovery: boolean; default_strategy: string; selection_mode: string; billing_mode: string };
export function OrganizationPolicies({ policies, canEdit }: { policies: Policies; canEdit: boolean }) {
  const { t } = useLocale(); const router = useRouter(); const [state, setState] = useState(policies); const [message, setMessage] = useState(""); const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent) { event.preventDefault(); setSaving(true); setMessage(""); const response = await fetch("/api/organization/preferences", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ confidenceThreshold: state.confidence_threshold, anomalyThresholdPct: state.anomaly_threshold_pct, maxPickupWaitHours: state.max_pickup_wait_hours, allowAutoBooking: state.allow_auto_booking, allowAutoRecovery: state.allow_auto_recovery }) }); setSaving(false); setMessage(response.ok ? t("Políticas guardadas", "Policies saved") : t("No fue posible guardar. Revisa tus permisos y valores.", "Could not save. Check your permissions and values.")); if (response.ok) router.refresh(); }
  return <form className={styles.form} onSubmit={submit}>
    <div className={styles.readonly}><span>BALANCED</span><span>{state.selection_mode}</span><span>{state.billing_mode}</span></div>
    <div className={styles.fields}>
      <label>{t("Confianza mínima", "Minimum confidence")}<input type="number" min="0" max="100" value={state.confidence_threshold} disabled={!canEdit} onChange={(e)=>setState({...state,confidence_threshold:Number(e.target.value)})}/><small>%</small></label>
      <label>{t("Umbral de anomalía", "Anomaly threshold")}<input type="number" min="0" max="100" value={state.anomaly_threshold_pct} disabled={!canEdit} onChange={(e)=>setState({...state,anomaly_threshold_pct:Number(e.target.value)})}/><small>%</small></label>
      <label>{t("Espera máxima de recojo", "Maximum pickup wait")}<input type="number" min="0" value={state.max_pickup_wait_hours} disabled={!canEdit} onChange={(e)=>setState({...state,max_pickup_wait_hours:Number(e.target.value)})}/><small>h</small></label>
    </div>
    <label className={styles.check}><input type="checkbox" checked={state.allow_auto_booking} disabled={!canEdit} onChange={(e)=>setState({...state,allow_auto_booking:e.target.checked})}/>{t("Permitir auto-booking cuando la política lo autoriza", "Allow auto-booking when policy authorizes it")}</label>
    <label className={styles.check}><input type="checkbox" checked={state.allow_auto_recovery} disabled={!canEdit} onChange={(e)=>setState({...state,allow_auto_recovery:e.target.checked})}/>{t("Permitir recovery automático autorizado", "Allow authorized automatic recovery")}</label>
    {canEdit ? <button type="submit" disabled={saving}><Save size={16}/>{saving ? t("Guardando…", "Saving…") : t("Guardar políticas", "Save policies")}</button> : <p className={styles.hint}>{t("Tu rol puede consultar estas políticas, pero no modificarlas.", "Your role may view these policies but cannot modify them.")}</p>}
    {message ? <p className={styles.message} role="status">{message}</p> : null}
  </form>;
}

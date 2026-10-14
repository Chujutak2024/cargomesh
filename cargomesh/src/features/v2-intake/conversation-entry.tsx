"use client";

import { FormEvent, useState } from "react";
import {workspaceHref} from "@/features/workspace-mode/paths";
import { useRouter } from "next/navigation";
import { ArrowUpRight, MessageSquareText } from "lucide-react";
import { useLocale } from "@/features/i18n/locale-provider";
import styles from "./conversation-entry.module.css";

/** A handoff of unsent text only. The intake owns the sole editable draft. */
export function ConversationEntry() {
  const router = useRouter();
  const { t } = useLocale();
  const [message, setMessage] = useState("");
  function continueToIntake(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = message.trim();
    if (!value) return;
    window.sessionStorage.setItem("cargomesh-v2-chat-seed-v1", value.slice(0, 1000));
    router.push(workspaceHref("/freight-request/new?assistant=open",window.location.pathname));
  }
  return <section className={styles.entry} aria-label={t("Asistente de solicitudes", "Request copilot")}>
    <div className={styles.copy}><span className={styles.eyebrow}>{t("ASISTENTE DE SOLICITUDES", "REQUEST COPILOT")}</span>
      <p>{t("Describe la carga y la ruta. El asistente te pedirá los datos que falten y compartirás el mismo borrador con el formulario.", "Describe the cargo and route. The assistant will ask for missing details and share one draft with the form.")}</p>
      <form onSubmit={continueToIntake} className={styles.form}>
        <label className={styles.srOnly} htmlFor="dashboard-chat-prompt">{t("Describe tu envío", "Describe your shipment")}</label>
        <MessageSquareText size={19} aria-hidden="true" />
        <input id="dashboard-chat-prompt" value={message} onChange={(event) => setMessage(event.target.value)} maxLength={1000} placeholder={t("Necesito enviar 10 pallets desde…", "I need to ship 10 pallets from…")} />
        <button type="submit" disabled={!message.trim()}>{t("Continuar", "Continue")}<ArrowUpRight size={16} aria-hidden="true" /></button>
      </form>
    </div>
  </section>;
}

"use client";

import { FormEvent, useState } from "react";
import { ArrowUpRight, MessageSquareText } from "lucide-react";
import { useLocale } from "@/features/i18n/locale-provider";
import styles from "./conversation-entry.module.css";

/** Opens the workspace copilot; the form and chat share the same session. */
export function ConversationEntry() {
  const { t } = useLocale();
  const [message, setMessage] = useState("");
  function continueToIntake(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = message.trim();
    if (!value) return;
    window.dispatchEvent(new CustomEvent("cargomesh:assistant-message", { detail: { text: value.slice(0, 1000) } }));
    setMessage("");
  }
  return <section className={styles.entry} aria-label={t("Asistente de solicitudes", "Request copilot")}>
    <div className={styles.copy}><h2><MessageSquareText size={18} aria-hidden="true"/>{t("Prepara tu envío con Nova", "Prepare your shipment with Nova")}</h2>
      <p>{t("Describe la carga y la ruta. El asistente te pedirá los datos que falten y compartirás el mismo borrador con el formulario.", "Describe the cargo and route. The assistant will ask for missing details and share one draft with the form.")}</p>
      <form onSubmit={continueToIntake} className={styles.form}>
        <label className={styles.srOnly} htmlFor="dashboard-chat-prompt">{t("Describe tu envío", "Describe your shipment")}</label>
        <input id="dashboard-chat-prompt" value={message} onChange={(event) => setMessage(event.target.value)} maxLength={1000} placeholder={t("Necesito enviar 10 pallets desde…", "I need to ship 10 pallets from…")} />
        <button type="submit" disabled={!message.trim()}>{t("Continuar", "Continue")}<ArrowUpRight size={16} aria-hidden="true" /></button>
      </form>
    </div>
  </section>;
}

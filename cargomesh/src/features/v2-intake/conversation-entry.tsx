"use client";

import { FormEvent, useState } from "react";
import { ArrowRight, ClipboardList, FilePenLine, MessageSquareText, Sparkles } from "lucide-react";
import { WorkspaceLink as Link } from "@/features/workspace-mode/workspace-link";
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
    <div className={styles.copy}><span className={styles.eyebrow}><Sparkles size={14} aria-hidden="true"/>CargoMesh AI</span>
      <h1>{t("¿Qué necesitas enviar hoy?", "What do you need to ship today?")}</h1>
      <p>{t("Describe la carga y la ruta. CargoMesh te pedirá lo que falte y preparará un borrador para que lo revises.", "Describe the cargo and route. CargoMesh asks for anything missing and prepares a draft for you to review.")}</p>
      <form onSubmit={continueToIntake} className={styles.form}>
        <label className={styles.srOnly} htmlFor="dashboard-chat-prompt">{t("Describe tu envío", "Describe your shipment")}</label>
        <MessageSquareText size={19} aria-hidden="true" />
        <input id="dashboard-chat-prompt" value={message} onChange={(event) => setMessage(event.target.value)} maxLength={1000} placeholder={t("Necesito enviar 10 pallets desde…", "I need to ship 10 pallets from…")} />
        <button type="submit" disabled={!message.trim()}>{t("Continuar", "Continue")}<ArrowRight size={16} aria-hidden="true" /></button>
      </form>
      <nav className={styles.shortcuts} aria-label={t("Otras formas de empezar", "Other ways to start")}>
        <Link href="/requests?status=DRAFT"><FilePenLine size={13} aria-hidden="true"/>{t("Retomar un borrador", "Resume a draft")}</Link>
        <Link href="/freight-request/new"><ClipboardList size={13} aria-hidden="true"/>{t("Usar el formulario", "Use the form instead")}</Link>
      </nav>
    </div>
  </section>;
}

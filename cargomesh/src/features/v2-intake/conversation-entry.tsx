"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Bot, MessageSquareText } from "lucide-react";
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
    router.push("/freight-request/new?assistant=open");
  }
  return <section className={styles.entry} aria-labelledby="conversation-entry-title">
    <div className={styles.icon}><Bot size={24} aria-hidden="true" /></div>
    <div className={styles.copy}><span className={styles.eyebrow}>{t("ASISTENTE DE SOLICITUDES", "REQUEST COPILOT")}</span>
      <h2 id="conversation-entry-title">{t("Empieza con tus propias palabras", "Start in your own words")}</h2>
      <p>{t("Describe la carga y la ruta. El asistente te pedirá los datos que falten y compartirás el mismo borrador con el formulario.", "Describe the cargo and route. The assistant will ask for missing details and share one draft with the form.")}</p>
      <form onSubmit={continueToIntake} className={styles.form}>
        <label className={styles.srOnly} htmlFor="dashboard-chat-prompt">{t("Describe tu envío", "Describe your shipment")}</label>
        <MessageSquareText size={19} aria-hidden="true" />
        <input id="dashboard-chat-prompt" value={message} onChange={(event) => setMessage(event.target.value)} maxLength={1000} placeholder={t("Necesito enviar 10 pallets desde…", "I need to ship 10 pallets from…")} />
        <button type="submit" disabled={!message.trim()}>{t("Continuar", "Continue")}<ArrowUpRight size={16} aria-hidden="true" /></button>
      </form>
      <small>{t("El mensaje no se envía ni crea una solicitud hasta que lo confirmes en el intake.", "This message is not sent and no request is created until you confirm in the intake.")}</small>
    </div>
  </section>;
}

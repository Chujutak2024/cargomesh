"use client";

import {
  CheckCircle2,
  CircleDashed,
  Database,
  FileJson2,
  LoaderCircle,
  PanelRightOpen,
  ShieldAlert,
  X,
  XCircle,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  classifyEvidenceState,
  classifyProviderOrigin,
  readCleanupState,
  type CleanupPresentationState,
  type EvidencePresentationState,
  type ProviderOriginKind,
} from "@/features/i18n/judge-evidence-presentation";
import { useLocale } from "@/features/i18n/locale-provider";
import styles from "./judge-drawer.module.css";

type Evidence = {
  id: string;
  requestCode?: string;
  event_type: string;
  provider_url?: string;
  navigation_url?: string;
  tool_name?: string;
  input_payload?: unknown;
  output_payload?: unknown;
  duration_ms?: number;
  status: string;
  execution_status?: string;
  persisted_entity_type?: string;
  persisted_entity_id?: string;
  created_at: string;
};

const statusClass: Record<EvidencePresentationState, string> = {
  pending: styles.statusPending,
  "commercial-success": styles.statusSuccess,
  "commercial-rejection": styles.statusRejected,
  "technical-error": styles.statusError,
  recorded: styles.statusRecorded,
};

const statusIcon: Record<EvidencePresentationState, typeof CheckCircle2> = {
  pending: CircleDashed,
  "commercial-success": CheckCircle2,
  "commercial-rejection": XCircle,
  "technical-error": ShieldAlert,
  recorded: Database,
};

export function JudgeDrawer() {
  const { locale, t } = useLocale();
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState<Evidence[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [cargoMeshOrigin, setCargoMeshOrigin] = useState<string | null>(null);
  const drawer = useRef<HTMLElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const close = useRef<HTMLButtonElement>(null);

  useEffect(() => setCargoMeshOrigin(window.location.origin), []);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError("");
    void fetch("/api/judge/evidence", { cache: "no-store", credentials: "same-origin" })
      .then(async (response) => {
        if (response.status === 401) {
          throw new Error(t(
            "Inicia sesión para visualizar la trazabilidad en vivo de la orquestación.",
            "Sign in to view the live orchestration trace.",
          ));
        }
        if (!response.ok) throw new Error(t("No fue posible cargar la evidencia.", "Could not load evidence."));
        const data = await response.json() as { events: Evidence[] };
        setEvents(data.events);
      })
      .catch((reason: unknown) => setError(
        reason instanceof Error ? reason.message : t("No fue posible cargar la evidencia.", "Could not load evidence."),
      ))
      .finally(() => setLoading(false));
  }, [open, t]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    close.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
      if (event.key !== "Tab") return;
      const items = drawer.current?.querySelectorAll<HTMLElement>(
        'button,a[href],summary,[tabindex]:not([tabindex="-1"])',
      );
      if (!items?.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", handleKey);
      trigger.current?.focus();
    };
  }, [open]);

  return (
    <>
      <button
        ref={trigger}
        className={styles.trigger}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Judge Drawer"
        onClick={() => setOpen(true)}
      >
        <PanelRightOpen size={18} aria-hidden="true" />
        <span>Judge</span>
      </button>
      {open && typeof document !== "undefined" ? (
        createPortal(
          <>
            <button
              className={styles.backdrop}
              type="button"
              aria-label={t("Cerrar evidencia", "Close evidence")}
              onClick={() => setOpen(false)}
            />
            <aside
              ref={drawer}
              className={styles.drawer}
              role="dialog"
              aria-modal="true"
              aria-labelledby="judge-title"
            >
              <header>
                <div><span>Golden Flow</span><h2 id="judge-title">Judge Drawer</h2></div>
                <button ref={close} type="button" aria-label={t("Cerrar", "Close")} onClick={() => setOpen(false)}>
                  <X size={19} aria-hidden="true" />
                </button>
              </header>

              <section className={styles.note} aria-label={t("Acerca de esta evidencia", "About this evidence")}>
                <Database size={18} aria-hidden="true" />
                <div>
                  <strong>{t("Evidencia persistida, no fabricada", "Persisted evidence, not fabricated")}</strong>
                  <p>{t(
                    "Cada entrada proviene de la organización activa. Los fixtures y el reset de demo permanecen separados de esta vista.",
                    "Every entry comes from the active organization. Demo fixtures and reset controls remain separate from this view.",
                  )}</p>
                </div>
              </section>

              <details className={styles.guide} open>
                <summary>{t("Cómo verificar esta demo", "How to verify this demo")}</summary>
                <ol>
                  <li>{t("Discovery devuelve una colección dinámica de 0..N providers.", "Discovery returns a dynamic collection of 0..N providers.")}</li>
                  <li>{t("WebMCP ejecuta coverage → capacity → quote en cada portal.", "WebMCP runs coverage → capacity → quote in each portal.")}</li>
                  <li>{t("Result Bridge persiste resultados y BALANCED ordena las ofertas.", "Result Bridge persists results and BALANCED ranks the offers.")}</li>
                  <li>{t("Booking y recovery requieren una selección y autorización explícitas.", "Booking and recovery require explicit selection and authorization.")}</li>
                </ol>
              </details>

              {loading ? (
                <div className={styles.empty}><LoaderCircle className={styles.spin} />{t("Cargando evidencia", "Loading evidence")}</div>
              ) : error ? (
                <div className={styles.empty} role="alert">{error}</div>
              ) : events.length ? (
                <div className={styles.events}>
                  {events.map((event) => (
                    <EvidenceCard
                      key={event.id}
                      event={event}
                      cargoMeshOrigin={cargoMeshOrigin}
                      locale={locale}
                    />
                  ))}
                </div>
              ) : (
                <div className={styles.empty}>{t("No hay eventos de orquestación persistidos.", "No persisted orchestration events.")}</div>
              )}
            </aside>
          </>,
          document.body
        )
      ) : null}
    </>
  );
}

function EvidenceCard({ event, cargoMeshOrigin, locale }: {
  event: Evidence;
  cargoMeshOrigin: string | null;
  locale: "es" | "en";
}) {
  const { t } = useLocale();
  const presentationState = classifyEvidenceState({
    eventType: event.event_type,
    toolName: event.tool_name,
    status: event.status,
    executionStatus: event.execution_status,
    outputPayload: event.output_payload,
  });
  const originKind = classifyProviderOrigin(event.provider_url ?? event.navigation_url, cargoMeshOrigin);
  const cleanup = readCleanupState({ outputPayload: event.output_payload });
  const StatusIcon = statusIcon[presentationState];

  return (
    <details className={styles.eventCard}>
      <summary>
        <FileJson2 size={16} aria-hidden="true" />
        <span className={styles.eventTitle}>
          <strong>{event.tool_name ?? event.event_type}</strong>
          <small>{event.requestCode ?? "—"} · {formatTimestamp(event.created_at, locale)}</small>
        </span>
        <span className={`${styles.statusBadge} ${statusClass[presentationState]}`}>
          <StatusIcon size={13} aria-hidden="true" /> {statusLabel(presentationState, t)}
        </span>
      </summary>
      <div className={styles.eventBody}>
        <dl>
          <dt>{t("Provider", "Provider")}</dt><dd>{event.provider_url ?? "—"}</dd>
          <dt>{t("Tipo de ruta", "Route type")}</dt><dd><OriginBadge kind={originKind} /></dd>
          <dt>navigation URL</dt><dd>{event.navigation_url ?? "—"}</dd>
          <dt>{t("Resultado", "Result")}</dt><dd>{event.execution_status ?? event.status}</dd>
          <dt>{t("Fecha y hora", "Timestamp")}</dt><dd>{formatTimestamp(event.created_at, locale)}</dd>
          <dt>{t("Duración", "Duration")}</dt><dd>{event.duration_ms == null ? "—" : `${event.duration_ms} ms`}</dd>
          <dt>cleanup</dt><dd>{cleanupLabel(cleanup, t)}</dd>
          <dt>{t("Entidad persistida", "Persisted entity")}</dt>
          <dd>{event.persisted_entity_type && event.persisted_entity_id ? `${event.persisted_entity_type}: ${event.persisted_entity_id}` : "—"}</dd>
        </dl>
        <h3>input</h3>
        <pre>{JSON.stringify(event.input_payload, null, 2) ?? "null"}</pre>
        <h3>output</h3>
        <pre>{JSON.stringify(event.output_payload, null, 2) ?? "null"}</pre>
      </div>
    </details>
  );
}

function OriginBadge({ kind }: { kind: ProviderOriginKind }) {
  const { t } = useLocale();
  const label = kind === "cargomesh-origin"
    ? t("Demo CargoMesh / mismo origin", "CargoMesh demo / same origin")
    : kind === "registered-external"
      ? t("Provider externo registrado", "Registered external provider")
      : t("Origen no reportado", "Origin not reported");
  return <span className={`${styles.originBadge} ${styles[`origin-${kind}`]}`}>{label}</span>;
}

function statusLabel(state: EvidencePresentationState, t: (spanish: string, english: string) => string) {
  if (state === "pending") return t("Pendiente", "Pending");
  if (state === "commercial-rejection") return t("Rechazo comercial", "Commercial rejection");
  if (state === "technical-error") return t("Error técnico", "Technical error");
  if (state === "recorded") return t("Evento registrado", "Recorded event");
  return t("Éxito comercial", "Commercial success");
}

function cleanupLabel(state: CleanupPresentationState, t: (spanish: string, english: string) => string) {
  if (state === "verified") return t("Verificado: 0 tools activas", "Verified: 0 active tools");
  if (state === "remaining-tools") return t("Atención: quedan tools activas", "Attention: active tools remain");
  return t("No reportado en este evento", "Not reported by this event");
}

function formatTimestamp(value: string, locale: "es" | "en") {
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? value
    : new Intl.DateTimeFormat(locale === "en" ? "en-US" : "es-PE", {
      dateStyle: "medium",
      timeStyle: "medium",
    }).format(date);
}

"use client";

import {
  BookOpenCheck,
  CheckCircle2,
  ChevronDown,
  CircleDashed,
  Database,
  ExternalLink,
  FileJson2,
  ListChecks,
  LoaderCircle,
  PanelRightOpen,
  ShieldAlert,
  SquareTerminal,
  Wrench,
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
import {
  JUDGE_FLOW_STEPS,
  JUDGE_TOOL_GUIDE,
  WEBMCP_CLEANUP_SNIPPET,
  WEBMCP_CONSOLE_RUNBOOK_URL,
  WEBMCP_COVERAGE_SNIPPET,
  WEBMCP_DISCOVERY_SNIPPET,
  WEBMCP_PUBLIC_UAT_EVIDENCE_URL,
} from "@/features/i18n/judge-guide-content";
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
              tabIndex={-1}
              aria-label={t("Cerrar evidencia", "Close evidence")}
              onClick={() => setOpen(false)}
            />
            <aside
              ref={drawer}
              className={styles.drawer}
              role="dialog"
              aria-modal="true"
              aria-labelledby="judge-title"
              aria-describedby="judge-summary-description"
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

              <section className={styles.webMcpSummary} aria-labelledby="webmcp-summary-title">
                <div className={styles.sectionHeading}>
                  <BookOpenCheck size={19} aria-hidden="true" />
                  <div>
                    <span>{t("Ruta de evaluación", "Evaluator path")}</span>
                    <h3 id="webmcp-summary-title">{t("Prueba CargoMesh sin ver el video", "Test CargoMesh without the video")}</h3>
                  </div>
                </div>
                <p id="judge-summary-description">{t(
                  "Sigue el flujo inferior para descubrir y ejecutar WebMCP, generar evidencia persistida mediante la orquestación y comprobar el cleanup. La demo contiene una tool de intake separada y exactamente cinco tools provider.",
                  "Follow the flow below to discover and execute WebMCP, generate persisted evidence through orchestration, and verify cleanup. The demo contains one separate intake tool and exactly five provider tools.",
                )}</p>
                <dl className={styles.surfaceStats} aria-label={t("Resumen de superficies WebMCP", "WebMCP surface summary")}>
                  <div><dt>{t("tool de intake", "intake tool")}</dt><dd>1</dd></div>
                  <div><dt>{t("tools provider", "provider tools")}</dt><dd>5</dd></div>
                  <div><dt>{t("providers descubiertos", "discovered providers")}</dt><dd>0..N</dd></div>
                </dl>
                <p className={styles.honestyNote}>{t(
                  "Andes, Inca y Pacific son fixtures reproducibles del demo y hoy usan rutas del mismo origin de CargoMesh; no representan partners alojados independientemente.",
                  "Andes, Inca, and Pacific are reproducible demo fixtures and currently use same-origin CargoMesh routes; they are not independently hosted partners.",
                )}</p>
                <a className={styles.runbookLink} href={WEBMCP_CONSOLE_RUNBOOK_URL} target="_blank" rel="noreferrer">
                  {t("Abrir runbook técnico completo", "Open the complete technical runbook")}
                  <ExternalLink size={14} aria-hidden="true" />
                </a>
                <a className={styles.runbookLink} href={WEBMCP_PUBLIC_UAT_EVIDENCE_URL} target="_blank" rel="noreferrer">
                  {t("Abrir evidencia pública sanitizada", "Open sanitized public evidence")}
                  <ExternalLink size={14} aria-hidden="true" />
                </a>
              </section>

              <details className={styles.guide} open>
                <summary><ListChecks size={16} aria-hidden="true" /> {t("Paso a paso para el jurado", "Step-by-step judge walkthrough")}<ChevronDown className={styles.disclosureIcon} size={16} aria-hidden="true" /></summary>
                <ol className={styles.guideSteps}>
                  {JUDGE_FLOW_STEPS.map((step, index) => (
                    <li key={step.id}>
                      <span className={styles.stepNumber} aria-hidden="true">{index + 1}</span>
                      <div>
                        <strong>{t(step.title.es, step.title.en)}</strong>
                        <p>{t(step.description.es, step.description.en)}</p>
                        <small><b>{t("Debes ver:", "Expected:")}</b> {t(step.expected.es, step.expected.en)}</small>
                        {step.href && step.linkLabel ? (
                          <a href={step.href} target="_blank" rel="noreferrer">
                            {t(step.linkLabel.es, step.linkLabel.en)}
                            <ExternalLink size={13} aria-hidden="true" />
                          </a>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ol>
              </details>

              <details className={styles.toolCatalog}>
                <summary><Wrench size={16} aria-hidden="true" /> {t("Catálogo WebMCP: 1 intake + 5 provider", "WebMCP catalog: 1 intake + 5 provider")}<ChevronDown className={styles.disclosureIcon} size={16} aria-hidden="true" /></summary>
                <div className={styles.toolList} role="list">
                  {JUDGE_TOOL_GUIDE.map((tool) => (
                    <article key={tool.name} className={styles.toolItem} role="listitem">
                      <header>
                        <h4><code>{tool.name}</code></h4>
                        <span className={tool.scope === "intake" ? styles.scopeIntake : styles.scopeProvider}>
                          {tool.scope === "intake" ? "INTAKE" : "PROVIDER"}
                        </span>
                        <span className={tool.effect === "read-only" ? styles.effectReadOnly : styles.effectStateChanging}>
                          {tool.effect === "read-only" ? "READ-ONLY" : t("CAMBIA ESTADO", "STATE-CHANGING")}
                        </span>
                      </header>
                      <p>{t(tool.description.es, tool.description.en)}</p>
                      <small><strong>{t("Resultado:", "Expected result:")}</strong> {t(tool.expected.es, tool.expected.en)}</small>
                      <small><strong>{t("Host WebMCP:", "WebMCP host:")}</strong> <code>{tool.host}</code></small>
                      {tool.uiEntry ? (
                        <small><strong>{t("Acción en UI:", "UI entry:")}</strong> <code>{tool.uiEntry}</code></small>
                      ) : null}
                      <div className={styles.annotations} aria-label={t("Anotaciones WebMCP", "WebMCP annotations")}>
                        <code>readOnlyHint: {String(tool.readOnlyHint)}</code>
                        {tool.destructiveHint ? <code>destructiveHint: true</code> : null}
                        <code>untrustedContentHint: {String(tool.untrustedContentHint)}</code>
                      </div>
                    </article>
                  ))}
                </div>
              </details>

              <details className={styles.consoleGuide}>
                <summary><SquareTerminal size={16} aria-hidden="true" /> {t("Prueba segura en DevTools", "Safe DevTools test")}<ChevronDown className={styles.disclosureIcon} size={16} aria-hidden="true" /></summary>
                <div className={styles.consoleBody}>
                  <p>{t(
                    "Abre primero Andes desde “Inspecciona WebMCP nativo”. Copia cada bloque completo en Console; no escribas tokens, cookies ni credenciales. Estas llamadas manuales prueban el contrato read-only, pero no atraviesan Result Bridge ni persisten eventos u ofertas.",
                    "First open Andes from “Inspect native WebMCP”. Paste each complete block into Console; never enter tokens, cookies, or credentials. These manual calls prove the read-only contract, but do not cross Result Bridge or persist events or offers.",
                  )}</p>
                  <section>
                    <h4>{t("1. Descubre las cinco tools", "1. Discover the five tools")}</h4>
                    <pre><code>{WEBMCP_DISCOVERY_SNIPPET}</code></pre>
                    <small>{t("Debe imprimir cinco filas.", "It must print five rows.")}</small>
                  </section>
                  <section>
                    <h4>{t("2. Ejecuta coverage read-only", "2. Execute read-only coverage")}</h4>
                    <pre><code>{WEBMCP_COVERAGE_SNIPPET}</code></pre>
                    <small>{t("Debe devolver ok: true y supported: true para el caso canónico.", "It must return ok: true and supported: true for the canonical case.")}</small>
                  </section>
                  <section>
                    <h4>{t("3. Comprueba cleanup desde la raíz", "3. Verify cleanup from the root")}</h4>
                    <pre><code>{WEBMCP_CLEANUP_SNIPPET}</code></pre>
                    <small>{t("Resultado esperado: remainingProviderTools: [].", "Expected result: remainingProviderTools: [].")}</small>
                  </section>
                  <p className={styles.consoleWarning}>{t(
                    "No ejecutes book_freight manualmente. Usa Select en el dispatch para que CargoMesh genere y valide la autorización server-side.",
                    "Do not run book_freight manually. Use Select in dispatch so CargoMesh can issue and validate server-side authorization.",
                  )}</p>
                </div>
              </details>

              <div className={styles.evidenceHeading}>
                <span>{t("Evidencia de la organización activa", "Active organization evidence")}</span>
                <h3>{t("Eventos persistidos", "Persisted events")}</h3>
              </div>

              {loading ? (
                <div className={styles.empty} role="status" aria-live="polite"><LoaderCircle className={styles.spin} />{t("Cargando evidencia", "Loading evidence")}</div>
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

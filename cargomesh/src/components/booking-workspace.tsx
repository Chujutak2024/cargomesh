"use client";

import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDashed,
  Clock3,
  Database,
  FileJson2,
  LoaderCircle,
  PanelRightOpen,
  RefreshCw,
  Route,
  ShieldCheck,
  Truck,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useLocale } from "@/features/i18n/locale-provider";
import styles from "./booking-workspace.module.css";

export type BookingWorkspaceModel = {
  requestCode: string;
  fixtureLabel: string;
  isFixture: boolean;
  status: {
    code: string;
    tone: "progress" | "waiting" | "success" | "danger" | "warning";
    eyebrow: string;
    title: string;
    message: string;
    nextAction: string;
  };
  selectedOffer: {
    offerId: string;
    carrierCode: string;
    displayName: string;
    providerOfferReference: string;
    totalPrice: number;
    currency: string;
    transitHours: number;
    rank: number;
    score: number;
    recommended: boolean;
  } | null;
  availableOfferCount: number;
  returnHref: string;
  trackingHref?: string;
  providerResponseDeadline?: string;
  timeline: ReadonlyArray<{
    label: string;
    state: "complete" | "blocked" | "current" | "future";
  }>;
  evidence: ReadonlyArray<{
    key: string;
    label: string;
    summary: string;
    payload: unknown;
  }>;
};

export type BookingRecoveryOption = {
  offerId: string;
  displayName: string;
  totalPrice: number;
  currency: string;
  transitHours: number;
  score: number;
};

type BookingWorkspaceProps = {
  model: BookingWorkspaceModel;
  busy?: boolean;
  actionError?: string | null;
  onRefresh?: () => void;
  showRecovery?: boolean;
  recoveryOptions?: BookingRecoveryOption[];
  onRecover?: (offerId: string) => void;
  scenario?: string | null;
  offerSet?: string | null;
  offerId?: string | null;
};

export function BookingWorkspace({
  model,
  busy = false,
  actionError,
  onRefresh,
  showRecovery = false,
  recoveryOptions = [],
  onRecover,
  scenario,
  offerSet,
  offerId,
}: BookingWorkspaceProps) {
  const router = useRouter();
  const { t } = useLocale();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeEvidence, setActiveEvidence] = useState(model.evidence[0]?.key ?? "events");
  const [fixtureRecoveryOfferId, setFixtureRecoveryOfferId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);

  const currentScenario = scenario ?? (model.isFixture ? model.status.code.toLowerCase().replace(/_/g, "-") : null);
  const activeOfferId = offerId ?? model.selectedOffer?.offerId ?? "offer-demo-1";
  const activeOfferSet = offerSet ?? "three";
  const isRecoveredInca = model.selectedOffer?.carrierCode === "INCA_DEMO" || model.selectedOffer?.offerId === "offer-demo-2";

  const handleAdvanceTo = (targetScenario: string, targetOfferId?: string) => {
    const finalOffer = targetOfferId ?? activeOfferId;
    const params = new URLSearchParams({
      scenario: targetScenario,
      offers: activeOfferSet,
      offer: finalOffer,
    });
    router.push(`/booking/${encodeURIComponent(model.requestCode)}/status?${params.toString()}`);
  };

  const advanceVisualBookingRequest = () => {
    handleAdvanceTo("pending-provider-confirmation", activeOfferId);
  };

  const advanceVisualProviderStatus = (control: "ACCEPT" | "REJECT") => {
    handleAdvanceTo(control === "ACCEPT" ? "confirmed" : "rejected", activeOfferId);
  };

  const advanceVisualRecovery = (targetOfferId: string) => {
    handleAdvanceTo("confirmed", targetOfferId);
  };

  const advanceVisualQuickConfirm = () => {
    handleAdvanceTo("confirmed", activeOfferId);
  };

  useEffect(() => {
    if (!drawerOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setDrawerOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = drawerRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      openButtonRef.current?.focus();
    };
  }, [drawerOpen]);

  useEffect(() => {
    if (!model.providerResponseDeadline) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [model.providerResponseDeadline]);

  const remainingMs = model.providerResponseDeadline ? Math.max(0, Date.parse(model.providerResponseDeadline) - now) : null;
  const countdown = remainingMs === null ? null : `${String(Math.floor(remainingMs / 3_600_000)).padStart(2, "0")}:${String(Math.floor((remainingMs % 3_600_000) / 60_000)).padStart(2, "0")}:${String(Math.floor((remainingMs % 60_000) / 1_000)).padStart(2, "0")}`;

  const evidence = model.evidence.find((item) => item.key === activeEvidence) ?? model.evidence[0];
  const StatusIcon = model.status.tone === "success"
    ? CheckCircle2
    : model.status.tone === "danger"
      ? AlertTriangle
      : model.status.tone === "waiting"
        ? Clock3
        : LoaderCircle;

  return (
    <div className={styles.page} aria-busy={busy}>
      <header className={styles.hero}>
        <div>
          <Link className={styles.backLink} href={model.returnHref}>
            <ArrowLeft size={16} aria-hidden="true" /> {t("Volver a opciones", "Back to options")}
          </Link>
          <span className={styles.eyebrow}>{t("B-03 · Reserva visual", "B-03 · Visual booking")}</span>
          <h1>{model.isFixture ? t("Vista de reserva para", "Booking preview for") : t("Reserva para", "Booking for")} {model.requestCode}</h1>
          <p>{t("La recomendación y la selección humana permanecen separadas durante todo el flujo.", "The recommendation and human selection remain separate throughout the workflow.")}</p>
        </div>
        <button
          ref={openButtonRef}
          className={styles.evidenceButton}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={drawerOpen}
          onClick={() => setDrawerOpen(true)}
        >
          <PanelRightOpen size={18} aria-hidden="true" /> {t("Abrir evidencia", "Open evidence")}
        </button>
      </header>

      <div className={styles.fixtureNotice} role="note">
        <ShieldCheck size={18} aria-hidden="true" />
        <div>
          <strong>{model.fixtureLabel}</strong>
          <span>{model.isFixture
            ? t("Simulador visual B-03: no ejecuta WebMCP, APIs, handlers ni escrituras. El flujo real usa iframe y Booking Bridge.", "B-03 visual simulator: it executes no WebMCP, APIs, handlers, or writes. The real flow uses an iframe and Booking Bridge.")
            : t("El estado comercial y la evidencia proceden de BookingViewModel v1.", "Commercial status and evidence come from BookingViewModel v1.")}</span>
        </div>
      </div>

      {model.isFixture ? (
        <section className={styles.simulationBar} aria-label={t("Simulador visual de estados B-03", "B-03 visual state simulator")}>
          <div className={styles.simulationBarHeader}>
            <span className={styles.simulationBadge}>DEMO UAT</span>
            <strong className={styles.simulationBarTitle}>
              {t("Simulador visual de estados B-03 · no ejecuta WebMCP, APIs ni escrituras", "B-03 visual state simulator · no WebMCP, API, or write execution")}:
            </strong>
          </div>
          <div className={styles.simulationSteps}>
            <button
              type="button"
              disabled={busy}
              className={`${styles.simStep} ${currentScenario === "booking-pending" ? styles.simStepActive : ""}`}
              onClick={() => handleAdvanceTo("booking-pending", "offer-demo-1")}
            >
              <span className={styles.stepNum}>1</span>
              <span>{t("Solicitud preparada", "Prepared request")}</span>
            </button>
            <span className={styles.simArrow} aria-hidden="true">→</span>
            <button
              type="button"
              disabled={busy}
              className={`${styles.simStep} ${currentScenario === "pending-provider-confirmation" ? styles.simStepActive : ""}`}
              onClick={advanceVisualBookingRequest}
            >
              <span className={styles.stepNum}>2</span>
              <span>{t("Esperando confirmación", "Waiting confirmation")}</span>
            </button>
            <span className={styles.simArrow} aria-hidden="true">→</span>
            <button
              type="button"
              disabled={busy}
              className={`${styles.simStep} ${currentScenario === "confirmed" && !isRecoveredInca ? styles.simStepActive : ""}`}
              onClick={advanceVisualQuickConfirm}
            >
              <span className={styles.stepNum}>3a</span>
              <span>{t("Confirmada (Andes 89)", "Confirmed (Andes 89)")}</span>
            </button>
            <span className={styles.simDivider} aria-hidden="true">|</span>
            <button
              type="button"
              disabled={busy}
              className={`${styles.simStep} ${currentScenario === "rejected" ? styles.simStepActive : ""}`}
              onClick={() => advanceVisualProviderStatus("REJECT")}
            >
              <span className={styles.stepNum}>3b</span>
              <span>{t("Rechazo (Andes)", "Rejected (Andes)")}</span>
            </button>
            <span className={styles.simArrow} aria-hidden="true">→</span>
            <button
              type="button"
              disabled={busy}
              className={`${styles.simStep} ${currentScenario === "confirmed" && isRecoveredInca ? styles.simStepActive : ""}`}
              onClick={() => advanceVisualRecovery("offer-demo-2")}
            >
              <span className={styles.stepNum}>4</span>
              <span>{t("Recovery (Inca 84)", "Recovery (Inca 84)")}</span>
            </button>
          </div>
        </section>
      ) : null}

      {model.isFixture && isRecoveredInca && model.status.code === "CONFIRMED" ? (
        <div className={styles.recoverySuccessNotice} role="status">
          <CheckCircle2 size={18} aria-hidden="true" />
          <div>
            <strong>{t("Vista de recuperación confirmada", "Confirmed recovery preview")}</strong>
            <span>{t("El simulador muestra el estado esperado con Transportes Inca (84 pts). No reasignó la carga ni creó una reserva.", "The simulator shows the expected state with Transportes Inca (84 pts). It did not reassign freight or create a booking.")}</span>
          </div>
        </div>
      ) : null}

      <section className={`${styles.statusPanel} ${styles[model.status.tone]}`} aria-live="polite">
        <div className={styles.statusIcon}>
          <StatusIcon className={model.status.tone === "progress" ? styles.spinner : undefined} size={28} aria-hidden="true" />
        </div>
        <div className={styles.statusCopy}>
          <span className={styles.eyebrow}>{model.status.eyebrow}</span>
          <h2>{model.status.title}</h2>
          <p>{model.status.message}</p>
          <span className={styles.statusCode}>{model.status.code}</span>
        </div>
        <div className={styles.statusAside}>
          <small>{t("Siguiente paso", "Next step")}</small>
          <p>{model.status.nextAction}</p>

          {model.isFixture && currentScenario === "booking-pending" ? (
            <div className={styles.simulationActionGroup}>
              <button
                type="button"
                disabled={busy}
                className={styles.btnSimPrimary}
                onClick={advanceVisualBookingRequest}
              >
                <Truck size={15} aria-hidden="true" />
                {t("Representar solicitud book_freight", "Preview the book_freight request state")}
              </button>
              <button
                type="button"
                disabled={busy}
                className={styles.btnSimSuccess}
                onClick={advanceVisualQuickConfirm}
              >
                <CheckCircle2 size={15} aria-hidden="true" />
                {t("Confirmación rápida (ACCEPT)", "Quick confirm (ACCEPT)")}
              </button>
            </div>
          ) : null}

          {model.isFixture && currentScenario === "pending-provider-confirmation" ? (
            <div className={styles.simulationActionGroup}>
              <button
                type="button"
                disabled={busy}
                className={styles.btnSimSuccess}
                onClick={() => advanceVisualProviderStatus("ACCEPT")}
              >
                <CheckCircle2 size={15} aria-hidden="true" />
                {t("Mostrar estado ACCEPT", "Show ACCEPT state")}
              </button>
              <button
                type="button"
                disabled={busy}
                className={styles.btnSimDanger}
                onClick={() => advanceVisualProviderStatus("REJECT")}
              >
                <AlertTriangle size={15} aria-hidden="true" />
                {t("Simular REJECT (Rechazo → Recovery)", "Simulate REJECT (Reject → Recovery)")}
              </button>
            </div>
          ) : null}

          {model.isFixture && currentScenario === "confirmed" ? (
            <div className={styles.simulationActionGroup}>
              {!isRecoveredInca ? (
                <button
                  type="button"
                  disabled={busy}
                  className={styles.btnSimNeutral}
                  onClick={() => advanceVisualProviderStatus("REJECT")}
                >
                  <RefreshCw size={14} aria-hidden="true" />
                  {t("Simular Rechazo & Recovery a Inca", "Simulate Reject & Recovery to Inca")}
                </button>
              ) : null}
              <button
                type="button"
                disabled={busy}
                className={styles.btnSimNeutral}
                onClick={() => handleAdvanceTo("booking-pending", "offer-demo-1")}
              >
                {t("Reiniciar simulación", "Reset simulation")}
              </button>
              <span>{t("Vista fixture: no se creó tracking.", "Fixture preview: no tracking was created.")}</span>
            </div>
          ) : null}

          {model.isFixture && currentScenario === "rejected" ? (
            <div className={styles.simulationActionGroup}>
              <a href="#recovery-title" className={styles.btnSimPrimary}>
                {t("Ver ofertas de Recovery abajo", "View Recovery offers below")} ↓
              </a>
            </div>
          ) : null}

          {!model.isFixture && (model.status.tone === "danger" || model.status.tone === "warning") ? (
            <Link href={model.returnHref}>{t("Revisar opciones", "Review options")} <ChevronRight size={16} aria-hidden="true" /></Link>
          ) : null}
          {onRefresh && model.status.tone === "waiting" ? (
            <button type="button" disabled={busy} onClick={onRefresh}>{busy ? t("Consultando provider", "Checking provider") : t("Actualizar estado", "Refresh status")}</button>
          ) : null}
          {countdown && model.status.tone === "waiting" ? <span className={styles.deadline} aria-label={t("Tiempo restante para respuesta", "Time remaining for response")}>{countdown}</span> : null}
          {!model.isFixture && model.status.tone === "success" && model.trackingHref ? <Link href={model.trackingHref}>{t("Ir a seguimiento", "Open tracking")} <ChevronRight size={16} aria-hidden="true" /></Link> : null}
        </div>
      </section>

      {actionError ? <div className={styles.actionError} role="alert"><AlertTriangle size={18} aria-hidden="true" /> {actionError}</div> : null}

      <div className={styles.contentGrid}>
        <section className={styles.offerPanel} aria-labelledby="selected-offer-title">
          <header>
            <div><span className={styles.eyebrow}>{t("Selección humana", "Human selection")}</span><h2 id="selected-offer-title">{t("Oferta seleccionada", "Selected offer")}</h2></div>
            <span>{model.availableOfferCount} {model.availableOfferCount === 1 ? t("oferta", "offer") : t("ofertas", "offers")}</span>
          </header>
          {model.selectedOffer ? (
            <article className={styles.selectedOffer}>
              <div className={styles.carrierIcon}><Truck size={22} aria-hidden="true" /></div>
              <div className={styles.carrierCopy}>
                <span>{model.selectedOffer.recommended ? t("Recomendada y elegida por el usuario", "Recommended and selected by the user") : t("Elegida por el usuario", "Selected by the user")}</span>
                <h3>{model.selectedOffer.displayName}</h3>
                <p>{model.selectedOffer.carrierCode} · {model.selectedOffer.providerOfferReference}</p>
              </div>
              <div className={styles.price}><strong>${model.selectedOffer.totalPrice.toLocaleString("en-US")}</strong><span>{model.selectedOffer.currency} total</span></div>
              <dl>
                <div><dt>{t("Tránsito", "Transit")}</dt><dd>{model.selectedOffer.transitHours} h</dd></div>
                <div><dt>{t("Puntaje", "Score")}</dt><dd>{model.selectedOffer.score}/100</dd></div>
                <div><dt>Ranking</dt><dd>#{model.selectedOffer.rank}</dd></div>
              </dl>
            </article>
          ) : (
            <div className={styles.emptyOffer}>
              <CircleDashed size={28} aria-hidden="true" />
              <h3>{t("No hay una oferta seleccionada", "No offer selected")}</h3>
              <p>{t("La recomendación del sistema no se convierte automáticamente en selección.", "The system recommendation never becomes a selection automatically.")}</p>
              <Link href={model.returnHref}>{t("Volver a OPTIONS_READY", "Back to OPTIONS_READY")}</Link>
            </div>
          )}
        </section>

        <section className={styles.timelinePanel} aria-labelledby="booking-timeline-title">
          <header><span className={styles.eyebrow}>{t("Progreso comercial", "Commercial progress")}</span><h2 id="booking-timeline-title">{t("Estado de la reserva", "Booking status")}</h2></header>
          <ol>
            {model.timeline.map((item, index) => (
              <li key={item.label} className={styles[item.state]}>
                <span>{item.state === "complete" ? <Check size={15} aria-hidden="true" /> : index + 1}</span>
                <div><strong>{item.label}</strong><small>{timelineLabel(item.state, t)}</small></div>
              </li>
            ))}
          </ol>
        </section>
      </div>

      {showRecovery ? (
        <section className={styles.recoveryPanel} aria-labelledby="recovery-title">
          <header>
            <span className={styles.eyebrow}>{model.isFixture ? "Recovery fixture-only" : t("Recovery disponible", "Recovery available")}</span>
            <h2 id="recovery-title">{model.isFixture ? t("Valida las alternativas sin ejecutar el flujo real", "Review alternatives without executing the real workflow") : t("Elige una oferta persistida para continuar", "Choose a persisted offer to continue")}</h2>
            <p>{model.isFixture ? t("La selección permanece solo en memoria visual: no llama APIs, handlers ni WebMCP.", "The selection remains in visual memory only: it calls no APIs, handlers, or WebMCP tools.") : <>{t("Solo se muestran las alternativas indicadas por", "Only alternatives listed by")} <code>recoveryOfferIds</code>.</>}</p>
          </header>
          {recoveryOptions.length ? (
            <div>
              {recoveryOptions.map((offer) => {
                const fixtureSelected = model.isFixture && fixtureRecoveryOfferId === offer.offerId;
                return (
                  <article key={offer.offerId} data-selected={fixtureSelected || undefined}>
                    <div><strong>{offer.displayName}</strong><span>{offer.transitHours} h · {offer.score}/100</span></div>
                    <p>${offer.totalPrice.toLocaleString("en-US")} {offer.currency}</p>
                    <button
                      type="button"
                      disabled={busy || (!model.isFixture && !onRecover)}
                      aria-pressed={model.isFixture ? fixtureSelected : undefined}
                      onClick={() => {
                        if (model.isFixture) {
                          setFixtureRecoveryOfferId(offer.offerId);
                          advanceVisualRecovery(offer.offerId);
                        } else {
                          onRecover?.(offer.offerId);
                        }
                      }}
                    >
                      {busy ? (
                        t("Preparando recuperación", "Preparing recovery")
                      ) : model.isFixture ? (
                        `${t("Mostrar estado con", "Preview state with")} ${offer.displayName} (${offer.score} pts)`
                      ) : (
                        `${t("Continuar con", "Continue with")} ${offer.displayName}`
                      )}
                    </button>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className={styles.recoveryEmpty} role="status">
              <CircleDashed size={26} aria-hidden="true" />
              <strong>{t("No hay alternativas de recovery", "No recovery alternatives")}</strong>
              <span>{model.isFixture ? t("Estado fixture 0: no se ejecutó ninguna operación.", "Fixture state 0: no operation was executed.") : t("BookingViewModel v1 no autorizó ofertas alternativas.", "BookingViewModel v1 authorized no alternative offers.")}</span>
            </div>
          )}
          {model.isFixture && fixtureRecoveryOfferId ? <p className={styles.fixtureRecoveryStatus} role="status">{t("Selección local registrada para validar la interfaz. No se creó una reserva.", "Local selection recorded for UI validation. No booking was created.")}</p> : null}
        </section>
      ) : null}

      {drawerOpen ? (
        <div className={styles.drawerLayer}>
          <button className={styles.backdrop} type="button" aria-label={t("Cerrar evidencia", "Close evidence")} onClick={() => setDrawerOpen(false)} />
          <aside ref={drawerRef} className={styles.drawer} role="dialog" aria-modal="true" aria-labelledby="judge-drawer-title">
            <header>
              <div><span className={styles.eyebrow}>Judge Drawer</span><h2 id="judge-drawer-title">{t("Evidencia causal", "Causal evidence")}</h2><p>{model.isFixture ? t("Fixture local para regresión visual.", "Local fixture for visual regression.") : t("Eventos persistidos entregados por BookingViewModel v1.", "Persisted events delivered by BookingViewModel v1.")}</p></div>
              <button ref={closeButtonRef} type="button" aria-label={t("Cerrar panel de evidencia", "Close evidence panel")} onClick={() => setDrawerOpen(false)}><X size={20} /></button>
            </header>

            <div className={styles.evidenceSummary}>
              <div><Route size={17} aria-hidden="true" /><span><small>{t("Solicitud", "Request")}</small><strong>{model.requestCode}</strong></span></div>
              <div><Database size={17} aria-hidden="true" /><span><small>{t("Persistencia", "Persistence")}</small><strong>{model.isFixture ? t("Desactivada", "Disabled") : "BookingViewModel v1"}</strong></span></div>
            </div>

            <div className={styles.tabs} role="tablist" aria-label={t("Categorías de evidencia", "Evidence categories")}>
              {model.evidence.map((item) => (
                <button
                  key={item.key}
                  id={`tab-${item.key}`}
                  type="button"
                  role="tab"
                  aria-selected={activeEvidence === item.key}
                  aria-controls="evidence-panel"
                  tabIndex={activeEvidence === item.key ? 0 : -1}
                  onClick={() => setActiveEvidence(item.key)}
                  onKeyDown={(event) => {
                    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
                    const currentIndex = model.evidence.findIndex((candidate) => candidate.key === item.key);
                    const direction = event.key === "ArrowRight" ? 1 : -1;
                    const nextIndex = (currentIndex + direction + model.evidence.length) % model.evidence.length;
                    setActiveEvidence(model.evidence[nextIndex].key);
                    requestAnimationFrame(() => document.getElementById(`tab-${model.evidence[nextIndex].key}`)?.focus());
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {evidence ? (
              <section id="evidence-panel" className={styles.evidencePanel} role="tabpanel" aria-labelledby={`tab-${evidence.key}`} tabIndex={0}>
                <div className={styles.evidenceHeading}><FileJson2 size={19} aria-hidden="true" /><div><span>{evidence.label}</span><strong>{evidence.summary}</strong></div></div>
                <pre><code>{JSON.stringify(evidence.payload, null, 2)}</code></pre>
              </section>
            ) : null}

            <footer><Clock3 size={16} aria-hidden="true" /> {model.isFixture ? t("Datos fixture; no representan una ejecución WebMCP real.", "Fixture data; it does not represent a real WebMCP execution.") : t("Evidencia renderizada desde events[] persistidos.", "Evidence rendered from persisted events[].")}</footer>
          </aside>
        </div>
      ) : null}
    </div>
  );
}

function timelineLabel(
  state: "complete" | "blocked" | "current" | "future",
  t: (spanish: string, english: string) => string,
) {
  if (state === "complete") return t("Completado", "Completed");
  if (state === "current") return t("Estado actual", "Current status");
  if (state === "blocked") return t("Requiere selección", "Selection required");
  return t("Pendiente", "Pending");
}

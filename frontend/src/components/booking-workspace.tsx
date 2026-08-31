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
  Route,
  ShieldCheck,
  Truck,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
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
  recoveryOptions?: BookingRecoveryOption[];
  onRecover?: (offerId: string) => void;
};

export function BookingWorkspace({
  model,
  busy = false,
  actionError,
  onRefresh,
  recoveryOptions = [],
  onRecover,
}: BookingWorkspaceProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeEvidence, setActiveEvidence] = useState(model.evidence[0]?.key ?? "events");
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);

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
            <ArrowLeft size={16} aria-hidden="true" /> Volver a opciones
          </Link>
          <span className={styles.eyebrow}>B-03 · Booking visual</span>
          <h1>Reserva para {model.requestCode}</h1>
          <p>La recomendación y la selección humana permanecen separadas durante todo el flujo.</p>
        </div>
        <button
          ref={openButtonRef}
          className={styles.evidenceButton}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={drawerOpen}
          onClick={() => setDrawerOpen(true)}
        >
          <PanelRightOpen size={18} aria-hidden="true" /> Abrir evidencia
        </button>
      </header>

      <div className={styles.fixtureNotice} role="note">
        <ShieldCheck size={18} aria-hidden="true" />
        <div>
          <strong>{model.fixtureLabel}</strong>
          <span>{model.isFixture
            ? "Este corte no ejecuta tools, handlers ni escrituras comerciales."
            : "El estado comercial y la evidencia proceden de BookingViewModel v1."}</span>
        </div>
      </div>

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
          <small>Siguiente paso</small>
          <p>{model.status.nextAction}</p>
          {(model.status.tone === "danger" || model.status.tone === "warning") ? (
            <Link href={model.returnHref}>Revisar opciones <ChevronRight size={16} aria-hidden="true" /></Link>
          ) : null}
          {onRefresh && model.status.tone === "waiting" ? (
            <button type="button" disabled={busy} onClick={onRefresh}>{busy ? "Consultando provider" : "Actualizar estado"}</button>
          ) : null}
          {model.status.tone === "success" ? <button type="button" disabled title="Disponible en una tarea posterior">Ir a seguimiento</button> : null}
        </div>
      </section>

      {actionError ? <div className={styles.actionError} role="alert"><AlertTriangle size={18} aria-hidden="true" /> {actionError}</div> : null}

      <div className={styles.contentGrid}>
        <section className={styles.offerPanel} aria-labelledby="selected-offer-title">
          <header>
            <div><span className={styles.eyebrow}>Selección humana</span><h2 id="selected-offer-title">Oferta seleccionada</h2></div>
            <span>{model.availableOfferCount} {model.availableOfferCount === 1 ? "oferta" : "ofertas"}</span>
          </header>
          {model.selectedOffer ? (
            <article className={styles.selectedOffer}>
              <div className={styles.carrierIcon}><Truck size={22} aria-hidden="true" /></div>
              <div className={styles.carrierCopy}>
                <span>{model.selectedOffer.recommended ? "Recomendada y elegida por el usuario" : "Elegida por el usuario"}</span>
                <h3>{model.selectedOffer.displayName}</h3>
                <p>{model.selectedOffer.carrierCode} · {model.selectedOffer.providerOfferReference}</p>
              </div>
              <div className={styles.price}><strong>${model.selectedOffer.totalPrice.toLocaleString("en-US")}</strong><span>{model.selectedOffer.currency} total</span></div>
              <dl>
                <div><dt>Tránsito</dt><dd>{model.selectedOffer.transitHours} h</dd></div>
                <div><dt>Puntaje</dt><dd>{model.selectedOffer.score}/100</dd></div>
                <div><dt>Ranking</dt><dd>#{model.selectedOffer.rank}</dd></div>
              </dl>
            </article>
          ) : (
            <div className={styles.emptyOffer}>
              <CircleDashed size={28} aria-hidden="true" />
              <h3>No hay una oferta seleccionada</h3>
              <p>La recomendación del sistema no se convierte automáticamente en selección.</p>
              <Link href={model.returnHref}>Volver a OPTIONS_READY</Link>
            </div>
          )}
        </section>

        <section className={styles.timelinePanel} aria-labelledby="booking-timeline-title">
          <header><span className={styles.eyebrow}>Progreso comercial</span><h2 id="booking-timeline-title">Estado de la reserva</h2></header>
          <ol>
            {model.timeline.map((item, index) => (
              <li key={item.label} className={styles[item.state]}>
                <span>{item.state === "complete" ? <Check size={15} aria-hidden="true" /> : index + 1}</span>
                <div><strong>{item.label}</strong><small>{timelineLabel(item.state)}</small></div>
              </li>
            ))}
          </ol>
        </section>
      </div>

      {recoveryOptions.length ? (
        <section className={styles.recoveryPanel} aria-labelledby="recovery-title">
          <header><span className={styles.eyebrow}>Recovery disponible</span><h2 id="recovery-title">Elige una oferta persistida para continuar</h2><p>Solo se muestran las alternativas indicadas por <code>recoveryOfferIds</code>.</p></header>
          <div>
            {recoveryOptions.map((offer) => (
              <article key={offer.offerId}>
                <div><strong>{offer.displayName}</strong><span>{offer.transitHours} h · {offer.score}/100</span></div>
                <p>${offer.totalPrice.toLocaleString("en-US")} {offer.currency}</p>
                <button type="button" disabled={busy} onClick={() => onRecover?.(offer.offerId)}>
                  {busy ? "Preparando recuperación" : `Continuar con ${offer.displayName}`}
                </button>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {drawerOpen ? (
        <div className={styles.drawerLayer}>
          <button className={styles.backdrop} type="button" aria-label="Cerrar evidencia" onClick={() => setDrawerOpen(false)} />
          <aside ref={drawerRef} className={styles.drawer} role="dialog" aria-modal="true" aria-labelledby="judge-drawer-title">
            <header>
              <div><span className={styles.eyebrow}>Judge Drawer</span><h2 id="judge-drawer-title">Evidencia causal</h2><p>{model.isFixture ? "Fixture local para regresión visual." : "Eventos persistidos entregados por BookingViewModel v1."}</p></div>
              <button ref={closeButtonRef} type="button" aria-label="Cerrar panel de evidencia" onClick={() => setDrawerOpen(false)}><X size={20} /></button>
            </header>

            <div className={styles.evidenceSummary}>
              <div><Route size={17} aria-hidden="true" /><span><small>Solicitud</small><strong>{model.requestCode}</strong></span></div>
              <div><Database size={17} aria-hidden="true" /><span><small>Persistencia</small><strong>{model.isFixture ? "Desactivada" : "BookingViewModel v1"}</strong></span></div>
            </div>

            <div className={styles.tabs} role="tablist" aria-label="Categorías de evidencia">
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

            <footer><Clock3 size={16} aria-hidden="true" /> {model.isFixture ? "Datos fixture; no representan una ejecución WebMCP real." : "Evidencia renderizada desde events[] persistidos."}</footer>
          </aside>
        </div>
      ) : null}
    </div>
  );
}

function timelineLabel(state: "complete" | "blocked" | "current" | "future") {
  if (state === "complete") return "Completado";
  if (state === "current") return "Estado actual";
  if (state === "blocked") return "Requiere selección";
  return "Pendiente";
}

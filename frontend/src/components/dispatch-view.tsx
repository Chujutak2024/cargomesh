"use client";

import {
  AlertTriangle, ArrowLeft, Boxes, Check, CheckCircle2, CircleDashed,
  Clock3, Gauge, LoaderCircle, RefreshCw, Route, Sparkles, Truck,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type {
  OrchestrationViewModel, ProviderAttemptView, RankedOfferView,
} from "@/features/orchestration/contracts";
import {
  B02_OFFER_SELECTION_ENABLED,
  isRetryableOrchestrationError,
  shouldPollOrchestration,
} from "@/features/freight-ui/dispatch-policies";
import { createBookingPreviewHref } from "@/features/freight-ui/booking-ui-fixtures";
import type { DispatchFixtureScenario } from "@/features/freight-ui/view-models";
import { takeCachedInt02aViewModel } from "@/features/freight-ui/int02a-client";
import styles from "./dispatch-view.module.css";

const progressCopy: Record<ProviderAttemptView["status"], string> = {
  PENDING: "Pendiente",
  RUNNING: "Consulta en curso",
  REJECTED: "Sin cobertura elegible",
  QUOTED: "Cotización recibida",
  FAILED: "Consulta fallida",
};

type DispatchViewProps = {
  model: OrchestrationViewModel;
  onRetry?: () => void;
  fixtureScenario?: string;
};

export function OrchestrationDispatch({ runId }: { runId: string }) {
  const [model, setModel] = useState<OrchestrationViewModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const retry = useCallback(() => setRefreshKey((current) => current + 1), []);

  useEffect(() => {
    let active = true;
    let pollTimer: number | undefined;
    const cached = takeCachedInt02aViewModel(runId);
    const cachedModel = isOrchestrationViewModel(cached) ? cached : null;
    let hasModel = cachedModel !== null;

    if (cachedModel) {
      setModel(cachedModel);
      setLoading(false);
    } else {
      setLoading(true);
    }
    setError(null);

    async function poll() {
      try {
        const response = await fetch(`/api/orchestration/runs/${encodeURIComponent(runId)}`, {
          cache: "no-store",
          credentials: "same-origin",
        });
        const payload: unknown = await response.json();
        if (!response.ok || !isSuccessfulEnvelope(payload)) {
          throw new Error(readEnvelopeError(payload) ?? "No fue posible consultar la evaluación.");
        }
        if (!active) return;
        hasModel = true;
        setModel(payload.data);
        setError(null);
        setLoading(false);
        if (shouldPollOrchestration(payload.data)) {
          pollTimer = window.setTimeout(() => { void poll(); }, 1_500);
        }
      } catch (reason) {
        if (!active || hasModel) return;
        setModel(null);
        setError(reason instanceof Error ? reason.message : "No fue posible consultar la evaluación.");
        setLoading(false);
      }
    }

    void poll();
    return () => {
      active = false;
      if (pollTimer !== undefined) window.clearTimeout(pollTimer);
    };
  }, [refreshKey, runId]);

  if (loading) return <TransportState title="Cargando evaluación" message="Consultando la evidencia persistida del proceso." busy />;
  if (error || !model) return <TransportState title="No pudimos abrir la evaluación" message={error ?? "La respuesta no contiene una evaluación válida."} onRetry={retry} />;
  return <DispatchView model={model} onRetry={retry} />;
}

export function DispatchView({ model, onRetry, fixtureScenario }: DispatchViewProps) {
  const evaluating = model.status === "loading";
  const stateClass = model.status === "loading" ? styles.stateLoading
    : model.status === "error" ? styles.stateError
      : model.status === "NO_MATCH" ? styles.stateNO_MATCH : styles.stateSuccess;

  return (
    <div className={styles.page} aria-busy={evaluating}>
      <header className={styles.hero}>
        <div>
          <Link className={styles.backLink} href="/freight-request/new"><ArrowLeft size={15} aria-hidden="true" /> Editar solicitud</Link>
          <span className={styles.eyebrow}>B-02 · Smart Dispatch</span>
          <h1>Evaluación de {model.requestCode}</h1>
          <p>Providers consultados y ofertas persistidas, sin asumir una cantidad fija de carriers.</p>
        </div>
        <span className={`${styles.stateBadge} ${stateClass}`}>{stateLabel(model.status)}</span>
      </header>

      <RequestSummary model={model} />
      {model.warnings.length ? <Warnings warnings={model.warnings.map((warning) => warning.message)} /> : null}
      {model.status === "loading" ? <EvaluatingState model={model} /> : null}
      {model.status === "error" ? <ErrorState model={model} onRetry={onRetry} fixtureScenario={fixtureScenario} /> : null}
      {model.status === "NO_MATCH" ? <NoMatchState model={model} /> : null}
      {model.status === "success" ? <SuccessState model={model} fixtureScenario={fixtureScenario} /> : null}
    </div>
  );
}

function RequestSummary({ model }: { model: OrchestrationViewModel }) {
  const items = [
    { label: "Solicitud", value: model.requestCode, icon: Boxes },
    { label: "Progreso", value: `${model.completedCandidateCount} de ${model.candidateCount} providers`, icon: Truck },
    { label: "Inicio", value: formatDateTime(model.startedAt), icon: Clock3 },
    { label: "Cierre", value: model.completedAt ? formatDateTime(model.completedAt) : "En proceso", icon: CheckCircle2 },
  ];
  return (
    <section className={styles.requestSummary} aria-label="Resumen de la evaluación">
      {items.map(({ label, value, icon: Icon }) => (
        <div key={label}><span><Icon size={16} aria-hidden="true" /></span><small>{label}</small><strong>{value}</strong></div>
      ))}
    </section>
  );
}

function EvaluatingState({ model }: { model: Extract<OrchestrationViewModel, { status: "loading" }> }) {
  const progress = model.candidateCount ? (model.completedCandidateCount / model.candidateCount) * 100 : 0;
  return (
    <div className={styles.evaluatingGrid}>
      <section className={styles.statePanel} aria-live="polite">
        <span className={styles.largeIcon}><LoaderCircle className={styles.spinner} size={27} aria-hidden="true" /></span>
        <span className={styles.eyebrow}>Evaluación en curso</span>
        <h2>Consultando providers compatibles</h2>
        <p>Las ofertas se mostrarán únicamente cuando hayan sido persistidas y evaluadas.</p>
        <div className={styles.progressTrack} aria-hidden="true"><span style={{ width: `${progress}%` }} /></div>
        <small>{model.completedCandidateCount} de {model.candidateCount} candidatos completados</small>
      </section>
      <CandidateProgress attempts={model.attempts} />
    </div>
  );
}

function CandidateProgress({ attempts }: { attempts: ProviderAttemptView[] }) {
  return (
    <section className={styles.candidatePanel} aria-labelledby="candidate-progress-title">
      <header><div><span className={styles.eyebrow}>Providers descubiertos</span><h2 id="candidate-progress-title">Progreso de consulta</h2></div><span>{attempts.length}</span></header>
      {attempts.length ? (
        <div className={styles.candidateList}>
          {attempts.map((attempt) => {
            const complete = attempt.status === "QUOTED";
            const detail = attempt.stopReason ?? (attempt.completedTools.length
              ? `${progressCopy[attempt.status]} · ${attempt.completedTools.length} herramientas completadas`
              : progressCopy[attempt.status]);
            return (
              <article key={`${attempt.carrierId}-${attempt.matchingServiceId}`}>
                <span className={complete ? styles.progressComplete : styles.progressPending}>{complete ? <Check size={15} aria-hidden="true" /> : <CircleDashed size={15} aria-hidden="true" />}</span>
                <div><strong>{attempt.displayName}</strong><small>{detail}</small></div>
              </article>
            );
          })}
        </div>
      ) : <p className={styles.candidateEmpty}>Aún no hay providers registrados para esta evaluación.</p>}
    </section>
  );
}

function ErrorState({ model, onRetry, fixtureScenario }: {
  model: Extract<OrchestrationViewModel, { status: "error" }>;
  onRetry?: () => void;
  fixtureScenario?: string;
}) {
  return (
    <section className={`${styles.statePanel} ${styles.errorPanel}`} role="alert">
      <span className={styles.largeIcon}><AlertTriangle size={27} aria-hidden="true" /></span>
      <span className={styles.eyebrow}>Evaluación interrumpida</span>
      <h2>No se pudo completar la evaluación</h2>
      <p>{model.error.message}</p>
      <div className={styles.stateActions}>
        {isRetryableOrchestrationError(model) && onRetry ? <button className={styles.primaryLink} type="button" onClick={onRetry}><RefreshCw size={16} aria-hidden="true" /> Reintentar evaluación</button> : null}
        {isRetryableOrchestrationError(model) && !onRetry && fixtureScenario ? <Link className={styles.primaryLink} href={`/dispatch/${encodeURIComponent(model.requestCode)}?scenario=evaluating`}><RefreshCw size={16} aria-hidden="true" /> Reintentar evaluación</Link> : null}
        <Link className={styles.secondaryLink} href="/freight-request/new">Revisar solicitud</Link>
      </div>
      <CandidateProgress attempts={model.attempts} />
    </section>
  );
}

function NoMatchState({ model }: { model: Extract<OrchestrationViewModel, { status: "NO_MATCH" }> }) {
  return (
    <div className={styles.noMatchGrid}>
      <section className={styles.statePanel}>
        <span className={styles.largeIcon}><Route size={27} aria-hidden="true" /></span>
        <span className={styles.eyebrow}>Búsqueda completada</span>
        <h2>No encontramos ofertas elegibles</h2>
        <p>{model.reason}</p>
        <p>Se completaron {model.completedCandidateCount} de {model.candidateCount} candidatos. No se muestran ofertas sintéticas.</p>
        <div className={styles.stateActions}><Link className={styles.primaryLink} href="/freight-request/new">Ajustar solicitud</Link></div>
      </section>
      <CandidateProgress attempts={model.attempts} />
    </div>
  );
}

function SuccessState({ model, fixtureScenario }: {
  model: Extract<OrchestrationViewModel, { status: "success" }>;
  fixtureScenario?: string;
}) {
  const recommended = model.offers.find((offer) => offer.recommended);
  return (
    <>
      <section className={styles.readyHeader}>
        <div><span className={styles.eyebrow}>Ofertas persistidas</span><h2>{model.offers.length} {model.offers.length === 1 ? "opción disponible" : "opciones disponibles"}</h2><p>{model.candidateCount} providers consultados · Estrategia {model.ranking.strategy}</p></div>
        <div className={styles.confidence}><Gauge size={18} aria-hidden="true" /><span><small>Confianza de decisión</small><strong>{model.ranking.decisionConfidence}/100</strong></span></div>
      </section>
      {model.offers.length ? (
        <section className={styles.offerGrid} aria-label="Ofertas de transporte ordenadas">
          {model.offers.map((offer) => <OfferCard key={offer.offerId} offer={offer} requestCode={model.requestCode} fixtureScenario={fixtureScenario} />)}
        </section>
      ) : (
        <section className={styles.statePanel}><span className={styles.largeIcon}><Boxes size={27} aria-hidden="true" /></span><h2>No hay ofertas para mostrar</h2><p>La evaluación terminó correctamente, pero su colección de ofertas está vacía.</p></section>
      )}
      {recommended ? (
        <section className={styles.explanation}>
          <div className={styles.explanationIcon}><Sparkles size={20} aria-hidden="true" /></div>
          <div><span className={styles.eyebrow}>Recomendación explicable</span><h2>¿Por qué CargoMesh recomienda {recommended.displayName}?</h2><p>{recommended.reasons.join(". ")}.</p></div>
          <details><summary>Ver análisis técnico</summary><dl><div><dt>Puntaje BALANCED</dt><dd>{recommended.score}/100</dd></div><div><dt>Confianza</dt><dd>{model.ranking.decisionConfidence}/100</dd></div><div><dt>Estado</dt><dd>Opciones listas</dd></div></dl></details>
        </section>
      ) : null}
      <CandidateProgress attempts={model.attempts} />
    </>
  );
}

function OfferCard({ offer, requestCode, fixtureScenario }: {
  offer: RankedOfferView;
  requestCode: string;
  fixtureScenario?: string;
}) {
  const offerSet = toBookingOfferSet(fixtureScenario);
  return (
    <article className={`${styles.offerCard} ${offer.recommended ? styles.offerRecommended : ""}`}>
      <header><span className={styles.rank}>#{offer.rank}</span>{offer.recommended ? <span className={styles.recommended}><Sparkles size={13} aria-hidden="true" /> Recomendado</span> : null}</header>
      <div className={styles.carrier}><span><Truck size={19} aria-hidden="true" /></span><div><h3>{offer.displayName}</h3><small>{offer.carrierCode} · {offer.providerOfferReference}</small></div><strong>{offer.score}<small> pts</small></strong></div>
      <div className={styles.price}><strong>${offer.totalPrice.toLocaleString("en-US")}</strong><span>{offer.currency} · total</span></div>
      <dl><div><dt><Clock3 size={14} aria-hidden="true" /> Tránsito</dt><dd>{offer.transitHours} h</dd></div><div><dt><CheckCircle2 size={14} aria-hidden="true" /> Elegibilidad</dt><dd>{offer.eligible ? "Elegible" : "No elegible"}</dd></div></dl>
      <ul>{offer.reasons.map((reason) => <li key={reason}><CheckCircle2 size={13} aria-hidden="true" /> {reason}</li>)}</ul>
      {offerSet ? (
        <Link className={styles.offerSelect} href={createBookingPreviewHref(requestCode, offer.offerId, offerSet)}>
          Seleccionar {offer.displayName}
        </Link>
      ) : (
        <button type="button" disabled={!B02_OFFER_SELECTION_ENABLED} title="Pendiente de BookingViewModel v1">
          Seleccionar esta opción <small>Pendiente de integración real</small>
        </button>
      )}
    </article>
  );
}

function toBookingOfferSet(scenario?: string): "one" | "three" | "four" | null {
  return (["one", "three", "four"] as DispatchFixtureScenario[]).includes(scenario as DispatchFixtureScenario)
    ? scenario as "one" | "three" | "four"
    : null;
}

function Warnings({ warnings }: { warnings: string[] }) {
  return <section className={styles.warnings} role="status" aria-label="Advertencias de la evaluación"><AlertTriangle size={18} aria-hidden="true" /><div><strong>La evaluación terminó con advertencias</strong>{warnings.map((warning) => <p key={warning}>{warning}</p>)}</div></section>;
}

function TransportState({ title, message, busy = false, onRetry }: { title: string; message: string; busy?: boolean; onRetry?: () => void }) {
  return (
    <div className={styles.page} aria-busy={busy}>
      <header className={styles.hero}><div><Link className={styles.backLink} href="/freight-request/new"><ArrowLeft size={15} aria-hidden="true" /> Editar solicitud</Link><span className={styles.eyebrow}>B-02 · Smart Dispatch</span><h1>{title}</h1><p>{message}</p></div></header>
      <section className={`${styles.statePanel} ${!busy ? styles.errorPanel : ""}`} role={!busy ? "alert" : undefined} aria-live="polite">
        <span className={styles.largeIcon}>{busy ? <LoaderCircle className={styles.spinner} size={27} aria-hidden="true" /> : <AlertTriangle size={27} aria-hidden="true" />}</span>
        <h2>{title}</h2><p>{message}</p>
        {onRetry ? <button className={styles.primaryLink} type="button" onClick={onRetry}><RefreshCw size={16} aria-hidden="true" /> Volver a consultar</button> : null}
      </section>
    </div>
  );
}

function isOrchestrationViewModel(value: unknown): value is OrchestrationViewModel {
  if (!value || typeof value !== "object") return false;
  const data = value as { schemaVersion?: unknown; status?: unknown };
  return data.schemaVersion === "1.0" && ["loading", "error", "NO_MATCH", "success"].includes(String(data.status));
}

function isSuccessfulEnvelope(value: unknown): value is { ok: true; data: OrchestrationViewModel } {
  if (!value || typeof value !== "object") return false;
  const envelope = value as { ok?: unknown; data?: unknown };
  return envelope.ok === true && isOrchestrationViewModel(envelope.data);
}

function readEnvelopeError(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const error = (value as { error?: unknown }).error;
  if (!error || typeof error !== "object") return null;
  const message = (error as { message?: unknown }).message;
  return typeof message === "string" ? message : null;
}

function formatDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : new Intl.DateTimeFormat("es-PE", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function stateLabel(status: OrchestrationViewModel["status"]) {
  if (status === "loading") return "Evaluando";
  if (status === "error") return "Error controlado";
  if (status === "NO_MATCH") return "Sin coincidencias";
  return "Opciones listas";
}

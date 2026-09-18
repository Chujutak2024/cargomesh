"use client";

import {
  AlertTriangle, ArrowLeft, Boxes, Check, CheckCircle2, CircleDashed,
  Clock3, Gauge, LoaderCircle, RefreshCw, Route, Sparkles, Truck,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  OrchestrationViewModel, ProviderAttemptView, RankedOfferView,
} from "@/features/orchestration/contracts";
import {
  isRetryableOrchestrationError,
  shouldPollOrchestration,
} from "@/features/freight-ui/dispatch-policies";
import { createBookingPreviewHref } from "@/features/freight-ui/booking-ui-fixtures";
import { startAssistedBooking } from "@/features/freight-ui/booking-client";
import type { DispatchFixtureScenario } from "@/features/freight-ui/view-models";
import { takeCachedInt02aViewModel } from "@/features/freight-ui/int02a-client";
import { localeTag } from "@/features/i18n/config";
import { classifyProviderOrigin, type ProviderOriginKind } from "@/features/i18n/judge-evidence-presentation";
import { useLocale } from "@/features/i18n/locale-provider";
import styles from "./dispatch-view.module.css";

type DispatchViewProps = {
  model: OrchestrationViewModel;
  onRetry?: () => void;
  fixtureScenario?: string;
};

export function OrchestrationDispatch({ runId }: { runId: string }) {
  const { t } = useLocale();
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
          throw new Error(readEnvelopeError(payload) ?? t("No fue posible consultar la evaluación.", "Could not load the evaluation."));
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
        setError(reason instanceof Error ? reason.message : t("No fue posible consultar la evaluación.", "Could not load the evaluation."));
        setLoading(false);
      }
    }

    void poll();
    return () => {
      active = false;
      if (pollTimer !== undefined) window.clearTimeout(pollTimer);
    };
  }, [refreshKey, runId, t]);

  if (loading) return <TransportState title={t("Cargando evaluación", "Loading evaluation")} message={t("Consultando la evidencia persistida del proceso.", "Reading the persisted process evidence.")} busy />;
  if (error || !model) return <TransportState title={t("No pudimos abrir la evaluación", "We could not open the evaluation")} message={error ?? t("La respuesta no contiene una evaluación válida.", "The response does not contain a valid evaluation.")} onRetry={retry} />;
  return <DispatchView model={model} onRetry={retry} />;
}

export function DispatchView({ model, onRetry, fixtureScenario }: DispatchViewProps) {
  const { t } = useLocale();
  const evaluating = model.status === "loading";
  const stateClass = model.status === "loading" ? styles.stateLoading
    : model.status === "error" ? styles.stateError
      : model.status === "NO_MATCH" ? styles.stateNO_MATCH : styles.stateSuccess;

  return (
    <div className={styles.page} aria-busy={evaluating}>
      <header className={styles.hero}>
        <div>
          <Link className={styles.backLink} href="/freight-request/new"><ArrowLeft size={15} aria-hidden="true" /> {t("Editar solicitud", "Edit request")}</Link>
          <span className={styles.eyebrow}>B-02 · Smart Dispatch</span>
          <h1>{t("Evaluación de", "Evaluation for")} {model.requestCode}</h1>
          <p>{t("Providers consultados y ofertas persistidas, sin asumir una cantidad fija de carriers.", "Queried providers and persisted offers, without assuming a fixed number of carriers.")}</p>
        </div>
        <span className={`${styles.stateBadge} ${stateClass}`}>{stateLabel(model.status, t)}</span>
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
  const { locale, t } = useLocale();
  const items = [
    { label: t("Solicitud", "Request"), value: model.requestCode, icon: Boxes },
    { label: t("Progreso", "Progress"), value: t(`${model.completedCandidateCount} de ${model.candidateCount} providers`, `${model.completedCandidateCount} of ${model.candidateCount} providers`), icon: Truck },
    { label: t("Inicio", "Started"), value: formatDateTime(model.startedAt, locale), icon: Clock3 },
    { label: t("Cierre", "Completed"), value: model.completedAt ? formatDateTime(model.completedAt, locale) : t("En proceso", "In progress"), icon: CheckCircle2 },
  ];
  return (
    <section className={styles.requestSummary} aria-label={t("Resumen de la evaluación", "Evaluation summary")}>
      {items.map(({ label, value, icon: Icon }) => (
        <div key={label}><span><Icon size={16} aria-hidden="true" /></span><small>{label}</small><strong>{value}</strong></div>
      ))}
    </section>
  );
}

function EvaluatingState({ model }: { model: Extract<OrchestrationViewModel, { status: "loading" }> }) {
  const { t } = useLocale();
  const progress = model.candidateCount ? (model.completedCandidateCount / model.candidateCount) * 100 : 0;
  return (
    <div className={styles.evaluatingGrid}>
      <section className={styles.statePanel} aria-live="polite">
        <span className={styles.largeIcon}><LoaderCircle className={styles.spinner} size={27} aria-hidden="true" /></span>
        <span className={styles.eyebrow}>{t("Evaluación en curso", "Evaluation in progress")}</span>
        <h2>{t("Consultando providers compatibles", "Querying compatible providers")}</h2>
        <p>{t("Las ofertas se mostrarán únicamente cuando hayan sido persistidas y evaluadas.", "Offers appear only after they have been persisted and evaluated.")}</p>
        <div className={styles.progressTrack} aria-hidden="true"><span style={{ width: `${progress}%` }} /></div>
        <small>{t(`${model.completedCandidateCount} de ${model.candidateCount} candidatos completados`, `${model.completedCandidateCount} of ${model.candidateCount} candidates completed`)}</small>
      </section>
      <CandidateProgress attempts={model.attempts} />
    </div>
  );
}

function CandidateProgress({ attempts }: { attempts: ProviderAttemptView[] }) {
  const { t } = useLocale();
  const [cargoMeshOrigin, setCargoMeshOrigin] = useState<string | null>(null);
  useEffect(() => setCargoMeshOrigin(window.location.origin), []);
  return (
    <section className={styles.candidatePanel} aria-labelledby="candidate-progress-title">
      <header><div><span className={styles.eyebrow}>{t("Providers descubiertos", "Discovered providers")}</span><h2 id="candidate-progress-title">{t("Progreso de consulta", "Query progress")}</h2></div><span>{attempts.length}</span></header>
      {attempts.length ? (
        <div className={styles.candidateList}>
          {attempts.map((attempt) => {
            const complete = attempt.status === "QUOTED";
            const detail = attempt.stopReason ?? (attempt.completedTools.length
              ? t(`${progressLabel(attempt.status, t)} · ${attempt.completedTools.length} tools completadas`, `${progressLabel(attempt.status, t)} · ${attempt.completedTools.length} tools completed`)
              : progressLabel(attempt.status, t));
            const originKind = classifyProviderOrigin(attempt.providerUrl, cargoMeshOrigin);
            return (
              <article key={`${attempt.carrierId}-${attempt.matchingServiceId}`}>
                <span className={complete ? styles.progressComplete : styles.progressPending}>{complete ? <Check size={15} aria-hidden="true" /> : <CircleDashed size={15} aria-hidden="true" />}</span>
                <div><strong>{attempt.displayName}</strong><small>{detail}</small><ProviderOriginLabel kind={originKind} /></div>
              </article>
            );
          })}
        </div>
      ) : <p className={styles.candidateEmpty}>{t("Aún no hay providers registrados para esta evaluación.", "No providers are registered for this evaluation yet.")}</p>}
    </section>
  );
}

function ErrorState({ model, onRetry, fixtureScenario }: {
  model: Extract<OrchestrationViewModel, { status: "error" }>;
  onRetry?: () => void;
  fixtureScenario?: string;
}) {
  const { t } = useLocale();
  return (
    <section className={`${styles.statePanel} ${styles.errorPanel}`} role="alert">
      <span className={styles.largeIcon}><AlertTriangle size={27} aria-hidden="true" /></span>
      <span className={styles.eyebrow}>{t("Evaluación interrumpida", "Evaluation interrupted")}</span>
      <h2>{t("No se pudo completar la evaluación", "The evaluation could not be completed")}</h2>
      <p>{model.error.message}</p>
      <div className={styles.stateActions}>
        {isRetryableOrchestrationError(model) && onRetry ? <button className={styles.primaryLink} type="button" onClick={onRetry}><RefreshCw size={16} aria-hidden="true" /> {t("Reintentar evaluación", "Retry evaluation")}</button> : null}
        {isRetryableOrchestrationError(model) && !onRetry && fixtureScenario ? <Link className={styles.primaryLink} href={`/dispatch/${encodeURIComponent(model.requestCode)}?scenario=evaluating`}><RefreshCw size={16} aria-hidden="true" /> {t("Reintentar evaluación", "Retry evaluation")}</Link> : null}
        <Link className={styles.secondaryLink} href="/freight-request/new">{t("Revisar solicitud", "Review request")}</Link>
      </div>
      <CandidateProgress attempts={model.attempts} />
    </section>
  );
}

function NoMatchState({ model }: { model: Extract<OrchestrationViewModel, { status: "NO_MATCH" }> }) {
  const { t } = useLocale();
  return (
    <div className={styles.noMatchGrid}>
      <section className={styles.statePanel}>
        <span className={styles.largeIcon}><Route size={27} aria-hidden="true" /></span>
        <span className={styles.eyebrow}>{t("Búsqueda completada", "Search completed")}</span>
        <h2>{t("No encontramos ofertas elegibles", "No eligible offers found")}</h2>
        <p>{model.reason}</p>
        <p>{t(`Se completaron ${model.completedCandidateCount} de ${model.candidateCount} candidatos. No se muestran ofertas sintéticas.`, `${model.completedCandidateCount} of ${model.candidateCount} candidates completed. No synthetic offers are shown.`)}</p>
        <div className={styles.stateActions}><Link className={styles.primaryLink} href="/freight-request/new">{t("Ajustar solicitud", "Adjust request")}</Link></div>
      </section>
      <CandidateProgress attempts={model.attempts} />
    </div>
  );
}

function SuccessState({ model, fixtureScenario }: {
  model: Extract<OrchestrationViewModel, { status: "success" }>;
  fixtureScenario?: string;
}) {
  const { t } = useLocale();
  const router = useRouter();
  const bookingFrameRef = useRef<HTMLIFrameElement>(null);
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(null);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const recommended = model.offers.find((offer) => offer.recommended);

  async function selectRealOffer(offer: RankedOfferView) {
    const frame = bookingFrameRef.current;
    if (!frame) {
      setSelectionError(t("No fue posible preparar el navegador para solicitar la reserva.", "The browser could not be prepared to request the booking."));
      return;
    }
    setSelectedOfferId(offer.offerId);
    setSelectionError(null);
    try {
      const context = await startAssistedBooking({
        model,
        offer,
        frame,
        baseUrl: window.location.origin,
      });
      router.push(`/booking/${encodeURIComponent(context.bookingId)}/status`);
    } catch (error) {
      setSelectionError(error instanceof Error ? error.message : t("No fue posible solicitar la reserva.", "The booking could not be requested."));
      setSelectedOfferId(null);
    }
  }

  return (
    <>
      <section className={styles.readyHeader}>
        <div><span className={styles.eyebrow}>{t("Ofertas persistidas", "Persisted offers")}</span><h2>{model.offers.length} {model.offers.length === 1 ? t("opción disponible", "available option") : t("opciones disponibles", "available options")}</h2><p>{model.candidateCount} {t("providers consultados", "providers queried")} · {t("Estrategia", "Strategy")} {model.ranking.strategy}</p></div>
        <div className={styles.confidence}><Gauge size={18} aria-hidden="true" /><span><small>{t("Confianza de decisión", "Decision confidence")}</small><strong>{model.ranking.decisionConfidence}/100</strong></span></div>
      </section>
      {model.offers.length ? (
        <section className={styles.offerGrid} aria-label={t("Ofertas de transporte ordenadas", "Ranked freight offers")}>
          {model.offers.map((offer) => (
            <OfferCard
              key={offer.offerId}
              offer={offer}
              requestCode={model.requestCode}
              fixtureScenario={fixtureScenario}
              selecting={selectedOfferId === offer.offerId}
              selectionLocked={selectedOfferId !== null}
              onSelect={fixtureScenario ? undefined : selectRealOffer}
            />
          ))}
        </section>
      ) : (
        <section className={styles.statePanel}><span className={styles.largeIcon}><Boxes size={27} aria-hidden="true" /></span><h2>{t("No hay ofertas para mostrar", "No offers to display")}</h2><p>{t("La evaluación terminó correctamente, pero su colección de ofertas está vacía.", "The evaluation completed successfully, but its offer collection is empty.")}</p></section>
      )}
      {recommended ? (
        <section className={styles.explanation}>
          <div className={styles.explanationIcon}><Sparkles size={20} aria-hidden="true" /></div>
          <div><span className={styles.eyebrow}>{t("Recomendación explicable", "Explainable recommendation")}</span><h2>{t("¿Por qué CargoMesh recomienda", "Why does CargoMesh recommend")} {recommended.displayName}?</h2><p>{recommended.reasons.join(". ")}.</p></div>
          <details><summary>{t("Ver análisis técnico", "View technical analysis")}</summary><dl><div><dt>{t("Puntaje BALANCED", "BALANCED score")}</dt><dd>{recommended.score}/100</dd></div><div><dt>{t("Confianza", "Confidence")}</dt><dd>{model.ranking.decisionConfidence}/100</dd></div><div><dt>{t("Estado", "Status")}</dt><dd>{t("Opciones listas", "Options ready")}</dd></div></dl></details>
        </section>
      ) : null}
      {selectionError ? <div className={styles.selectionError} role="alert"><AlertTriangle size={17} aria-hidden="true" /> {selectionError}</div> : null}
      <CandidateProgress attempts={model.attempts} />
      {!fixtureScenario ? (
        <iframe
          ref={bookingFrameRef}
          className={styles.bookingRunnerFrame}
          src="/"
          title={t("Ejecución WebMCP de booking", "WebMCP booking execution")}
          aria-hidden="true"
          tabIndex={-1}
        />
      ) : null}
    </>
  );
}

function OfferCard({ offer, requestCode, fixtureScenario, selecting, selectionLocked, onSelect }: {
  offer: RankedOfferView;
  requestCode: string;
  fixtureScenario?: string;
  selecting: boolean;
  selectionLocked: boolean;
  onSelect?: (offer: RankedOfferView) => void;
}) {
  const { locale, t } = useLocale();
  const offerSet = toBookingOfferSet(fixtureScenario);
  return (
    <article className={`${styles.offerCard} ${offer.recommended ? styles.offerRecommended : ""}`}>
      <header><span className={styles.rank}>#{offer.rank}</span>{offer.recommended ? <span className={styles.recommended}><Sparkles size={13} aria-hidden="true" /> {t("Recomendado", "Recommended")}</span> : null}</header>
      <div className={styles.carrier}><span><Truck size={19} aria-hidden="true" /></span><div><h3>{offer.displayName}</h3><small>{offer.carrierCode} · {offer.providerOfferReference}</small></div><strong>{offer.score}<small> pts</small></strong></div>
      <div className={styles.price}><strong>${offer.totalPrice.toLocaleString("en-US")}</strong><span>{offer.currency} · total</span></div>
      <dl><div><dt><Clock3 size={14} aria-hidden="true" /> {t("Tránsito", "Transit")}</dt><dd>{offer.transitHours} h</dd></div><div><dt><CheckCircle2 size={14} aria-hidden="true" /> {t("Elegibilidad", "Eligibility")}</dt><dd>{offer.eligible ? t("Elegible", "Eligible") : t("No elegible", "Ineligible")}</dd></div></dl>
      <dl><div><dt>{t("Capacidad reportada", "Reported capacity")}</dt><dd>{offer.availableCapacityKg == null ? t("No reportada", "Not reported") : `${offer.availableCapacityKg.toLocaleString(localeTag(locale))} kg`}</dd></div><div><dt>{t("Confiabilidad", "Reliability")}</dt><dd>{offer.reliabilityScore == null ? t("No reportada", "Not reported") : `${offer.reliabilityScore}/100`}</dd></div></dl>
      {offer.subscores ? <div className={styles.subscores} aria-label="BALANCED subscores">{Object.entries({ [t("Costo", "Cost")]: offer.subscores.cost, [t("Confiabilidad", "Reliability")]: offer.subscores.reliability, ETA: offer.subscores.eta, [t("Disponibilidad", "Availability")]: offer.subscores.availability, [t("Experiencia de ruta", "Route experience")]: offer.subscores.routeExperience, [t("Historial organización", "Organization history")]: offer.subscores.organizationHistory }).map(([label,value]) => <span key={label}><small>{label}</small><strong>{value.toFixed(1)}</strong></span>)}</div> : null}
      <ul>{offer.reasons.map((reason) => <li key={reason}><CheckCircle2 size={13} aria-hidden="true" /> {reason}</li>)}</ul>
      {offerSet ? (
        <Link className={styles.offerSelect} href={createBookingPreviewHref(requestCode, offer.offerId, offerSet)}>
          {t("Seleccionar", "Select")} {offer.displayName}
        </Link>
      ) : (
        <button
          type="button"
          disabled={selectionLocked}
          aria-busy={selecting}
          onClick={() => onSelect?.(offer)}
        >
          {selecting ? <><LoaderCircle className={styles.spinner} size={16} aria-hidden="true" /> {t("Preparando reserva", "Preparing booking")}</> : <>{t("Seleccionar", "Select")} {offer.displayName}<small>{t("Selección asistida", "Assisted selection")}</small></>}
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
  const { t } = useLocale();
  return <section className={styles.warnings} role="status" aria-label={t("Advertencias de la evaluación", "Evaluation warnings")}><AlertTriangle size={18} aria-hidden="true" /><div><strong>{t("La evaluación terminó con advertencias", "The evaluation completed with warnings")}</strong>{warnings.map((warning) => <p key={warning}>{warning}</p>)}</div></section>;
}

function TransportState({ title, message, busy = false, onRetry }: { title: string; message: string; busy?: boolean; onRetry?: () => void }) {
  const { t } = useLocale();
  return (
    <div className={styles.page} aria-busy={busy}>
      <header className={styles.hero}><div><Link className={styles.backLink} href="/freight-request/new"><ArrowLeft size={15} aria-hidden="true" /> {t("Editar solicitud", "Edit request")}</Link><span className={styles.eyebrow}>B-02 · Smart Dispatch</span><h1>{title}</h1><p>{message}</p></div></header>
      <section className={`${styles.statePanel} ${!busy ? styles.errorPanel : ""}`} role={!busy ? "alert" : undefined} aria-live="polite">
        <span className={styles.largeIcon}>{busy ? <LoaderCircle className={styles.spinner} size={27} aria-hidden="true" /> : <AlertTriangle size={27} aria-hidden="true" />}</span>
        <h2>{title}</h2><p>{message}</p>
        {onRetry ? <button className={styles.primaryLink} type="button" onClick={onRetry}><RefreshCw size={16} aria-hidden="true" /> {t("Volver a consultar", "Try again")}</button> : null}
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

function formatDateTime(value: string, locale: "es" | "en") {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : new Intl.DateTimeFormat(localeTag(locale), { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function stateLabel(status: OrchestrationViewModel["status"], t: (spanish: string, english: string) => string) {
  if (status === "loading") return t("Evaluando", "Evaluating");
  if (status === "error") return t("Error controlado", "Handled error");
  if (status === "NO_MATCH") return t("Sin coincidencias", "No matches");
  return t("Opciones listas", "Options ready");
}

function progressLabel(status: ProviderAttemptView["status"], t: (spanish: string, english: string) => string) {
  if (status === "PENDING") return t("Pendiente", "Pending");
  if (status === "RUNNING") return t("Consulta en curso", "Query in progress");
  if (status === "REJECTED") return t("Sin cobertura elegible", "No eligible coverage");
  if (status === "QUOTED") return t("Cotización recibida", "Quote received");
  return t("Consulta fallida", "Query failed");
}

function ProviderOriginLabel({ kind }: { kind: ProviderOriginKind }) {
  const { t } = useLocale();
  const label = kind === "cargomesh-origin"
    ? t("Demo CargoMesh / mismo origin", "CargoMesh demo / same origin")
    : kind === "registered-external"
      ? t("Provider externo registrado", "Registered external provider")
      : t("Origen pendiente de verificación", "Origin pending verification");
  return <small className={`${styles.providerOrigin} ${styles[`providerOrigin-${kind}`]}`}>{label}</small>;
}

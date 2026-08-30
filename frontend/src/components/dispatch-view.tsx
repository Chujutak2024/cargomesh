import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Boxes,
  Check,
  CheckCircle2,
  CircleDashed,
  Clock3,
  DollarSign,
  Gauge,
  LoaderCircle,
  MapPin,
  RefreshCw,
  Route,
  ShieldCheck,
  Sparkles,
  Truck,
} from "lucide-react";
import Link from "next/link";
import type {
  CandidateProgressStatus,
  DispatchCandidate,
  DispatchOffer,
  DispatchViewModel,
} from "@/features/freight-ui/view-models";
import styles from "./dispatch-view.module.css";

const progressCopy: Record<CandidateProgressStatus, string> = {
  PENDING: "Pendiente",
  NAVIGATING: "Navegando",
  COVERAGE_CHECKED: "Cobertura validada",
  CAPACITY_CHECKED: "Capacidad validada",
  QUOTED: "Cotización recibida",
  RECORDED: "Oferta persistida",
};

export function DispatchView({ model }: { model: DispatchViewModel }) {
  const evaluating = model.state === "LOADING" || model.state === "EVALUATING";

  return (
    <div className={styles.page} aria-busy={evaluating}>
      <header className={styles.hero}>
        <div>
          <Link className={styles.backLink} href="/freight-request/new"><ArrowLeft size={15} aria-hidden="true" /> Editar solicitud</Link>
          <span className={styles.eyebrow}>B-02 · Smart Dispatch</span>
          <h1>{model.request.origin} <ArrowRight size={22} aria-hidden="true" /> {model.request.destination}</h1>
          <p>La vista separa providers consultados de ofertas persistidas y admite colecciones variables.</p>
        </div>
        <span className={`${styles.stateBadge} ${styles[`state${model.state}`]}`}>{stateLabel(model.state)}</span>
      </header>

      <RequestSummary model={model} />

      {model.state === "LOADING" ? <LoadingState /> : null}
      {model.state === "EVALUATING" ? <EvaluatingState candidates={model.candidates} /> : null}
      {model.state === "ERROR" ? <ErrorState model={model} /> : null}
      {model.state === "NO_MATCH" ? <NoMatchState model={model} /> : null}
      {model.state === "OPTIONS_READY" ? <OptionsReadyState model={model} /> : null}
    </div>
  );
}

function RequestSummary({ model }: { model: DispatchViewModel }) {
  const items = [
    { label: "Solicitud", value: model.request.requestId, icon: Boxes },
    { label: "Carga", value: model.request.cargo, icon: Truck },
    { label: "Recojo", value: model.request.pickupDate, icon: Clock3 },
    { label: "Presupuesto", value: model.request.budget, icon: DollarSign },
  ];
  return (
    <section className={styles.requestSummary} aria-label="Resumen de la solicitud">
      {items.map(({ label, value, icon: Icon }) => (
        <div key={label}><span><Icon size={16} aria-hidden="true" /></span><small>{label}</small><strong>{value}</strong></div>
      ))}
    </section>
  );
}

function LoadingState() {
  return (
    <section className={styles.statePanel} aria-live="polite">
      <span className={styles.largeIcon}><LoaderCircle className={styles.spinner} size={27} aria-hidden="true" /></span>
      <h2>Preparando evaluación</h2>
      <p>Estamos cargando el contexto de la solicitud y el registro compatible.</p>
      <div className={styles.skeletonGrid} aria-hidden="true"><span /><span /><span /></div>
    </section>
  );
}

function EvaluatingState({ candidates }: { candidates: DispatchCandidate[] }) {
  const completed = candidates.filter((candidate) => candidate.status === "RECORDED").length;
  return (
    <div className={styles.evaluatingGrid}>
      <section className={styles.statePanel} aria-live="polite">
        <span className={styles.largeIcon}><LoaderCircle className={styles.spinner} size={27} aria-hidden="true" /></span>
        <span className={styles.eyebrow}>Evaluación en curso</span>
        <h2>Buscando opciones en tiempo real</h2>
        <p>Las ofertas finales aparecerán únicamente después de su persistencia y evaluación.</p>
        <div className={styles.progressTrack}><span style={{ width: `${candidates.length ? (completed / candidates.length) * 100 : 0}%` }} /></div>
        <small>{completed} de {candidates.length} candidatos con oferta persistida</small>
      </section>
      <CandidateProgress candidates={candidates} />
    </div>
  );
}

function CandidateProgress({ candidates }: { candidates: DispatchCandidate[] }) {
  return (
    <section className={styles.candidatePanel} aria-labelledby="candidate-progress-title">
      <header><div><span className={styles.eyebrow}>Providers descubiertos</span><h2 id="candidate-progress-title">Progreso de consulta</h2></div><span>{candidates.length}</span></header>
      <div className={styles.candidateList}>
        {candidates.map((candidate) => {
          const complete = candidate.status === "RECORDED";
          return <article key={candidate.candidateId}><span className={complete ? styles.progressComplete : styles.progressPending}>{complete ? <Check size={15} aria-hidden="true" /> : <CircleDashed size={15} aria-hidden="true" />}</span><div><strong>{candidate.displayName}</strong><small>{progressCopy[candidate.status]}</small></div></article>;
        })}
      </div>
    </section>
  );
}

function ErrorState({ model }: { model: Extract<DispatchViewModel, { state: "ERROR" }> }) {
  return (
    <section className={`${styles.statePanel} ${styles.errorPanel}`} role="alert">
      <span className={styles.largeIcon}><AlertTriangle size={27} aria-hidden="true" /></span>
      <span className={styles.eyebrow}>Evaluación interrumpida</span>
      <h2>{model.error.title}</h2>
      <p>{model.error.message}</p>
      <div className={styles.stateActions}>
        <Link className={styles.primaryLink} href={`/dispatch/${encodeURIComponent(model.request.requestId)}?fixture=evaluating`}><RefreshCw size={16} aria-hidden="true" /> Reintentar evaluación</Link>
        <Link className={styles.secondaryLink} href="/freight-request/new">Revisar solicitud</Link>
      </div>
    </section>
  );
}

function NoMatchState({ model }: { model: Extract<DispatchViewModel, { state: "NO_MATCH" }> }) {
  return (
    <div className={styles.noMatchGrid}>
      <section className={styles.statePanel}>
        <span className={styles.largeIcon}><Route size={27} aria-hidden="true" /></span>
        <span className={styles.eyebrow}>Búsqueda completada</span>
        <h2>No encontramos ofertas elegibles</h2>
        <p>Se consultaron {model.candidates.length} candidatos, pero no se persistieron ofertas compatibles. No mostramos cards ficticias.</p>
        <div className={styles.stateActions}>
          <Link className={styles.primaryLink} href="/freight-request/new">Ajustar solicitud</Link>
          <Link className={styles.secondaryLink} href={`/dispatch/${encodeURIComponent(model.request.requestId)}?fixture=evaluating`}>Reintentar</Link>
        </div>
      </section>
      <CandidateProgress candidates={model.candidates} />
    </div>
  );
}

function OptionsReadyState({ model }: { model: Extract<DispatchViewModel, { state: "OPTIONS_READY" }> }) {
  const recommended = model.offers.find((offer) => offer.recommended) ?? model.offers[0];
  return (
    <>
      <section className={styles.readyHeader}>
        <div><span className={styles.eyebrow}>Ofertas persistidas</span><h2>{model.offers.length} {model.offers.length === 1 ? "opción disponible" : "opciones disponibles"}</h2><p>{model.candidates.length} providers consultados · Estrategia {model.strategy}</p></div>
        <div className={styles.confidence}><Gauge size={18} aria-hidden="true" /><span><small>Confianza de decisión</small><strong>{model.decisionConfidence}/100</strong></span></div>
      </section>
      <section className={styles.offerGrid} aria-label="Ofertas de transporte ordenadas">
        {model.offers.map((offer, index) => <OfferCard key={offer.offerId} offer={offer} rank={index + 1} />)}
      </section>
      {recommended ? (
        <section className={styles.explanation}>
          <div className={styles.explanationIcon}><Sparkles size={20} aria-hidden="true" /></div>
          <div><span className={styles.eyebrow}>Recomendación explicable</span><h2>¿Por qué CargoMesh recomienda {recommended.displayName}?</h2><p>{recommended.reasons.join(". ")}.</p></div>
          <details><summary>Ver análisis técnico</summary><dl><div><dt>Puntaje BALANCED</dt><dd>{recommended.roundedScore}/100</dd></div><div><dt>Confianza</dt><dd>{model.decisionConfidence}/100</dd></div><div><dt>Estado</dt><dd>OPTIONS_READY</dd></div></dl></details>
        </section>
      ) : null}
    </>
  );
}

function OfferCard({ offer, rank }: { offer: DispatchOffer; rank: number }) {
  return (
    <article className={`${styles.offerCard} ${offer.recommended ? styles.offerRecommended : ""}`}>
      <header>
        <span className={styles.rank}>#{rank}</span>
        {offer.recommended ? <span className={styles.recommended}><Sparkles size={13} aria-hidden="true" /> Recomendado</span> : null}
      </header>
      <div className={styles.carrier}><span><Truck size={19} aria-hidden="true" /></span><div><h3>{offer.displayName}</h3><small>{offer.reportedVehicle} · {(offer.capacityKg / 1000).toLocaleString("es-PE")} t</small></div><strong>{offer.roundedScore}<small> pts</small></strong></div>
      <div className={styles.price}><strong>${offer.totalPrice.toLocaleString("en-US")}</strong><span>{offer.currency} · total</span></div>
      <dl>
        <div><dt><Clock3 size={14} aria-hidden="true" /> Tránsito</dt><dd>{offer.transitHours} h</dd></div>
        <div><dt><BadgeCheck size={14} aria-hidden="true" /> Confiabilidad</dt><dd>{offer.reliabilityPercent}%</dd></div>
        <div><dt><MapPin size={14} aria-hidden="true" /> Recojo</dt><dd>{offer.pickupWindow}</dd></div>
        <div><dt><ShieldCheck size={14} aria-hidden="true" /> Cross-border</dt><dd>{offer.crossBorderSupported ? "Confirmado" : "No disponible"}</dd></div>
      </dl>
      <ul>{offer.reasons.map((reason) => <li key={reason}><CheckCircle2 size={13} aria-hidden="true" /> {reason}</li>)}</ul>
      <button type="button" disabled title="Disponible en B-03">Seleccionar esta opción <small>Disponible en B-03</small></button>
    </article>
  );
}

function stateLabel(state: DispatchViewModel["state"]) {
  if (state === "LOADING") return "Cargando";
  if (state === "EVALUATING") return "Evaluando";
  if (state === "ERROR") return "Error controlado";
  if (state === "NO_MATCH") return "Sin coincidencias";
  return "Opciones listas";
}

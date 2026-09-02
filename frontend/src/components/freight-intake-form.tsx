"use client";

import {
  ArrowLeft, ArrowRight, Boxes, Building2, CalendarClock, Check,
  FileCheck2, MapPin, PackageCheck, ShieldCheck,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";

import {
  applyExecutionIntentToIntake, buildProviderRunnerInputs, buildRealDispatchPath,
  cacheInt02aViewModel, createInt02aIdempotencyKey,
} from "@/features/freight-ui/int02a-client";
import type { FreightIntakeModel } from "@/features/freight-ui/view-models";
import { fetchFreightRequestExecutionIntent } from "@/features/freight-requests/execution-intent-client";
import {
  assertExecutionIntentCorrelation, assertFreshIntakeCorrelation,
  getFreightIntakeDispatchBlockReason, loadPersistedFreightIntake,
} from "@/features/freight-requests/intake-ui-adapter";
import type { RecommendationProposedFields } from "@/features/recommendations/contracts";
import { FreightRecommendationPanel } from "@/features/recommendations/freight-recommendation-panel";
import { FreightRecommendationWebMcpHost } from "@/features/recommendations/freight-recommendation-webmcp-host";
import {
  applyFreightRequestDraftToIntake,
  persistAndRevalidateRecommendation,
  type PersistRecommendationAcceptance,
} from "@/features/recommendations/recommendation-acceptance";
import {
  fetchFreightRequestDraft,
  persistFreightRecommendationDraft,
} from "@/features/recommendations/recommendation-draft-client";
import { createExternalProviderNavigationAdapter } from "@/features/webmcp-runner";
import { runInt02aOrchestration } from "@/features/webmcp-runner/orchestration-runner";
import styles from "./freight-intake-form.module.css";

const steps = [
  { label: "Organización", icon: Building2 }, { label: "Ruta", icon: MapPin },
  { label: "Carga", icon: Boxes }, { label: "Programación", icon: CalendarClock },
  { label: "Revisión", icon: PackageCheck },
];
const documentOptions = ["Factura comercial", "Packing list", "Ficha técnica"];

function nullableNumber(value: number | null) { return value ?? ""; }
function displayNumber(value: number | null, suffix = "") {
  return value === null ? "No registrado" : `${value.toLocaleString("es-PE")}${suffix}`;
}
function displayDate(value: string) {
  return value ? value.replace("T", " ").replace(".000Z", " UTC") : "No aplica";
}
function getDisplayedTotals(form: FreightIntakeModel) {
  if (form.source === "persisted") return { weightKg: form.totalWeightKg, volumeM3: form.totalVolumeM3 };
  const quantity = form.quantity ?? 0;
  const units = form.unitsPerEntry ?? 1;
  const weightKg = form.unitWeightKg === null ? null : quantity * units * form.unitWeightKg;
  const volumeM3 = [form.lengthCm, form.widthCm, form.heightCm].some((value) => value === null)
    ? null
    : quantity * units * (form.lengthCm ?? 0) * (form.widthCm ?? 0) * (form.heightCm ?? 0) / 1_000_000;
  return { weightKg, volumeM3 };
}

export function FreightIntakeForm({
  initialValue,
  persistRecommendation = persistFreightRecommendationDraft,
}: {
  initialValue: FreightIntakeModel;
  persistRecommendation?: PersistRecommendationAcceptance;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(initialValue);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [webMcpReady, setWebMcpReady] = useState(false);
  const [recommendationRegistrationError, setRecommendationRegistrationError] = useState<string | null>(null);
  const [draftReady, setDraftReady] = useState(initialValue.source !== "persisted");
  const [draftLoadError, setDraftLoadError] = useState<string | null>(null);
  const runnerFrameRef = useRef<HTMLIFrameElement>(null);
  const readOnly = form.source === "persisted";
  const totals = useMemo(() => getDisplayedTotals(form), [form]);
  const dispatchBlockReason = getFreightIntakeDispatchBlockReason(form);

  const loadCanonicalDraft = useCallback(async (signal: AbortSignal) => {
    const draft = await fetchFreightRequestDraft(initialValue.freightRequestId, signal);
    setForm((current) => applyFreightRequestDraftToIntake(current, draft));
    setDraftLoadError(null);
    setDraftReady(true);
  }, [initialValue.freightRequestId]);

  useEffect(() => {
    if (initialValue.source !== "persisted") return;
    const controller = new AbortController();
    void loadCanonicalDraft(controller.signal).catch((error) => {
      if (controller.signal.aborted) return;
      setDraftReady(false);
      setDraftLoadError(error instanceof Error ? error.message : "No fue posible cargar el borrador vigente desde D1-01.");
    });
    return () => controller.abort();
  }, [initialValue.source, loadCanonicalDraft]);

  const handleRegistrationChange = useCallback((registered: boolean) => {
    setWebMcpReady(registered);
    if (registered) setRecommendationRegistrationError(null);
  }, []);

  const handleRegistrationError = useCallback((error: Error) => {
    setRecommendationRegistrationError(error.message);
  }, []);

  const applyRecommendation = useCallback(async (
    fields: RecommendationProposedFields,
    signal: AbortSignal,
  ) => {
    const persisted = await persistAndRevalidateRecommendation(form, fields, persistRecommendation, signal);
    setForm(persisted);
  }, [form, persistRecommendation]);

  const reloadStaleDraft = useCallback(async (signal: AbortSignal) => {
    setDraftReady(false);
    await loadCanonicalDraft(signal);
  }, [loadCanonicalDraft]);

  function update<K extends keyof FreightIntakeModel>(key: K, value: FreightIntakeModel[K]) {
    if (!readOnly) setForm((current) => ({ ...current, [key]: value }));
  }
  function toggleDocument(document: string) {
    if (readOnly) return;
    setForm((current) => ({
      ...current,
      documents: current.documents.includes(document)
        ? current.documents.filter((item) => item !== document)
        : [...current.documents, document],
    }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step < steps.length - 1) { setStep((current) => current + 1); return; }
    if (dispatchBlockReason) { setSubmitError(dispatchBlockReason); return; }
    const runnerFrame = runnerFrameRef.current;
    if (!runnerFrame) { setSubmitError("No fue posible preparar el navegador para evaluar los providers."); return; }

    setSubmitting(true);
    setSubmitError(null);
    try {
      const freshIntake = await loadPersistedFreightIntake(form.requestId);
      assertFreshIntakeCorrelation(form, freshIntake);
      const freshBlockReason = getFreightIntakeDispatchBlockReason(freshIntake);
      if (freshBlockReason) throw new Error(freshBlockReason);

      const executionIntent = await fetchFreightRequestExecutionIntent(freshIntake.freightRequestId);
      assertExecutionIntentCorrelation(freshIntake, executionIntent);
      const executionModel = applyExecutionIntentToIntake(freshIntake, executionIntent);
      setForm(executionModel);

      const evidence = await runInt02aOrchestration({
        freightRequestId: executionModel.freightRequestId,
        idempotencyKey: createInt02aIdempotencyKey(executionModel.freightRequestId),
        baseUrl: window.location.origin,
        navigation: createExternalProviderNavigationAdapter({ frame: runnerFrame, baseUrl: window.location.origin }),
        createInputs: () => buildProviderRunnerInputs(executionModel, executionIntent),
      });
      cacheInt02aViewModel(evidence.start.runId, evidence.viewModel);
      router.push(buildRealDispatchPath(evidence.start.runId));
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "No fue posible completar la evaluación.");
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div><span className={styles.eyebrow}>B-02 · Intake de carga</span><h1>Nueva solicitud de transporte</h1>
          <p>{readOnly ? "Revisa la solicitud persistida antes de iniciar la evaluación de providers." : "Escenario fixture declarado para regresión visual; no inicia operaciones reales."}</p></div>
        <div className={styles.draftBadge}><ShieldCheck size={16} aria-hidden="true" /> {readOnly ? "Datos persistidos" : "Fixture visual"}</div>
      </header>

      <FreightRecommendationWebMcpHost
        onRegistrationChange={handleRegistrationChange}
        onRegistrationError={handleRegistrationError}
      />
      {form.source === "persisted" ? <FreightRecommendationPanel
        form={form}
        draftVersion={form.draftVersion}
        webMcpReady={webMcpReady && draftReady}
        registrationError={draftLoadError ?? recommendationRegistrationError}
        onApply={applyRecommendation}
        onStaleDraft={reloadStaleDraft}
      /> : null}

      <ol className={styles.stepper} aria-label="Progreso del formulario">
        {steps.map(({ label, icon: Icon }, index) => <li key={label}><button type="button" className={`${styles.step} ${index === step ? styles.stepActive : ""} ${index < step ? styles.stepDone : ""}`} aria-current={index === step ? "step" : undefined} onClick={() => setStep(index)} disabled={submitting}><span>{index < step ? <Check size={16} aria-hidden="true" /> : <Icon size={16} aria-hidden="true" />}</span><small>Paso {index + 1}</small><strong>{label}</strong></button></li>)}
      </ol>

      <form className={styles.formLayout} onSubmit={submit} aria-busy={submitting}>
        <section className={styles.formCard} aria-labelledby={`step-title-${step}`}>
          {step === 0 ? <><FormHeading id="step-title-0" title="Organización y solicitante" description="La organización, el operador y el perfil proceden del ViewModel autorizado." /><div className={styles.fieldGrid}>
            <Field label="Organización activa"><input value={form.organization} readOnly /></Field><Field label="Solicitante"><input value={form.requester} readOnly /></Field>
            <Field label="Perfil de carga" wide>{readOnly ? <input value={form.cargoProfile || "Sin perfil asociado"} readOnly /> : <select value={form.cargoProfile} onChange={(event) => update("cargoProfile", event.target.value)}><option>Repuestos y maquinaria minera</option><option>Carga general paletizada</option><option>Equipos industriales</option></select>}</Field>
          </div><InfoBox>{readOnly ? "La identidad y la membresía se validaron server-side; esta vista no las sustituye." : "Los valores de este escenario sirven únicamente para regresión visual."}</InfoBox></> : null}

          {step === 1 ? <><FormHeading id="step-title-1" title="Origen y destino" description="Corredor y contactos operativos persistidos para esta solicitud." /><div className={styles.fieldGrid}>
            <Field label="Origen"><input required={!readOnly} readOnly={readOnly} value={form.origin} onChange={(event) => update("origin", event.target.value)} /></Field>
            <Field label="Destino"><input required={!readOnly} readOnly={readOnly} value={form.destination} onChange={(event) => update("destination", event.target.value)} /></Field>
            <Field label="Contacto de recojo"><input required={!readOnly} readOnly={readOnly} value={form.pickupContact} onChange={(event) => update("pickupContact", event.target.value)} /></Field>
            <Field label="Contacto de entrega"><input required={!readOnly} readOnly={readOnly} value={form.deliveryContact} onChange={(event) => update("deliveryContact", event.target.value)} /></Field>
            <Field label={readOnly ? "Notas operativas" : "Paso fronterizo"} wide><input readOnly={readOnly} value={readOnly ? form.operationalNotes || "Sin notas" : form.borderCrossing} onChange={(event) => update("borderCrossing", event.target.value)} /></Field>
          </div></> : null}

          {step === 2 ? <><FormHeading id="step-title-2" title="Características de la carga" description="Los totales canónicos provienen del servidor y no se reconstruyen desde campos opcionales." /><div className={styles.fieldGrid}>
            <Field label="Categoría"><input required={!readOnly} readOnly={readOnly} value={form.cargoCategory} onChange={(event) => update("cargoCategory", event.target.value)} /></Field>
            <Field label="Método de ingreso">{readOnly ? <input value={form.entryMethod} readOnly /> : <select value={form.entryMethod} onChange={(event) => update("entryMethod", event.target.value)}><option>Pallets</option><option>Bultos</option><option>Maquinaria</option><option>Sacos</option></select>}</Field>
            <NumberField label="Cantidad" value={form.quantity} readOnly={readOnly} onChange={(value) => update("quantity", value)} /><NumberField label="Unidades por entrada" value={form.unitsPerEntry} readOnly={readOnly} onChange={(value) => update("unitsPerEntry", value)} />
            <NumberField label="Peso unitario (kg)" value={form.unitWeightKg} readOnly={readOnly} onChange={(value) => update("unitWeightKg", value)} /><NumberField label="Largo (cm)" value={form.lengthCm} readOnly={readOnly} onChange={(value) => update("lengthCm", value)} />
            <NumberField label="Ancho (cm)" value={form.widthCm} readOnly={readOnly} onChange={(value) => update("widthCm", value)} /><NumberField label="Alto (cm)" value={form.heightCm} readOnly={readOnly} onChange={(value) => update("heightCm", value)} />
          </div><div className={styles.totals} aria-live="polite"><div><small>Peso canónico</small><strong>{displayNumber(totals.weightKg, " kg")}</strong></div><div><small>Volumen canónico</small><strong>{totals.volumeM3 === null ? "No registrado" : `${totals.volumeM3.toLocaleString("es-PE", { maximumFractionDigits: 2 })} m³`}</strong></div></div></> : null}

          {step === 3 ? <><FormHeading id="step-title-3" title="Programación y políticas" description="La programación persistida se vuelve a validar justo antes de la orquestación." /><div className={styles.fieldGrid}>
            <Field label="Modo de recojo"><input readOnly value={form.pickupMode} /></Field><Field label="Recojo requerido"><input readOnly value={form.requiredPickup} /></Field>
            <Field label="Inicio de ventana"><input readOnly value={form.pickupWindowStart || "No aplica"} /></Field><Field label="Fin de ventana"><input readOnly value={form.pickupWindowEnd || "No aplica"} /></Field>
            <Field label="Deadline de entrega"><input readOnly value={form.deliveryDeadline || "No definido"} /></Field><Field label={`Presupuesto máximo (${form.currency})`}><input min="1" required={!readOnly} readOnly={readOnly} type="number" value={nullableNumber(form.budgetMaxUsd)} onChange={(event) => update("budgetMaxUsd", event.target.value ? Number(event.target.value) : null)} /></Field>
            <Field label="Estrategia"><input value={form.strategy} readOnly /></Field>
          </div><InfoBox>Execution-intent se consulta inmediatamente antes de crear el run y debe corresponder al mismo UUID y código.</InfoBox>
          <fieldset className={styles.documentFieldset}><legend>Documentos disponibles</legend>{(readOnly ? form.documents : documentOptions).length ? (readOnly ? form.documents : documentOptions).map((document) => <label key={document}><input type="checkbox" disabled={readOnly} checked={form.documents.includes(document)} onChange={() => toggleDocument(document)} /> <span>{document}</span></label>) : <span>Sin documentos registrados</span>}</fieldset></> : null}

          {step === 4 ? <><FormHeading id="step-title-4" title="Revisión y confirmación" description="Antes del dispatch se releen el intake y la intención persistida para evitar datos obsoletos." /><div className={styles.reviewGrid}>
            <ReviewItem label="Organización" value={`${form.organization} · ${form.requester}`} /><ReviewItem label="Ruta" value={`${form.origin} → ${form.destination}`} />
            <ReviewItem label="Carga" value={`${displayNumber(form.quantity)} ${form.entryMethod.toLowerCase()} · ${displayNumber(totals.weightKg, " kg")} · ${totals.volumeM3 === null ? "Volumen no registrado" : `${totals.volumeM3.toLocaleString("es-PE", { maximumFractionDigits: 2 })} m³`}`} />
            <ReviewItem label="Ventana de recojo" value={`${displayDate(form.pickupWindowStart)} → ${displayDate(form.pickupWindowEnd)}`} /><ReviewItem label="Deadline de entrega" value={displayDate(form.deliveryDeadline)} />
            <ReviewItem label="Política" value={`${form.strategy} · ${form.budgetMaxUsd === null ? "Sin presupuesto máximo" : `${form.currency} ${form.budgetMaxUsd.toLocaleString("en-US")}`}`} /><ReviewItem label="Documentos" value={form.documents.length ? form.documents.join(", ") : "Sin documentos registrados"} />
          </div><div className={styles.readyNotice}><FileCheck2 size={20} aria-hidden="true" /><span><strong>{dispatchBlockReason ? "Dispatch bloqueado" : "Solicitud lista para evaluación"}</strong><small>{dispatchBlockReason ?? "La capacidad real se validará mediante WebMCP durante el dispatch."}</small></span></div></> : null}

          <footer className={styles.actions}>{submitError ? <p className={styles.submitError} role="alert">{submitError}</p> : null}<button type="button" className={styles.secondaryButton} disabled={step === 0 || submitting} onClick={() => setStep((current) => current - 1)}><ArrowLeft size={17} aria-hidden="true" /> Anterior</button><button type="submit" className={styles.primaryButton} disabled={submitting || (step === steps.length - 1 && dispatchBlockReason !== null)}>{submitting ? "Evaluando providers…" : step === steps.length - 1 ? "Confirmar y buscar opciones" : "Continuar"}<ArrowRight size={17} aria-hidden="true" /></button></footer>
        </section>

        <aside className={styles.summaryCard} aria-label="Resumen de la solicitud"><span className={styles.eyebrow}>{readOnly ? "ViewModel persistido v1" : "Regresión visual"}</span><h2>{form.requestId}</h2><dl>
          <div><dt>Corredor</dt><dd>{form.origin}<br />{form.destination}</dd></div><div><dt>Carga</dt><dd>{displayNumber(totals.weightKg, " kg")} · {totals.volumeM3 === null ? "Volumen no registrado" : `${totals.volumeM3.toLocaleString("es-PE", { maximumFractionDigits: 2 })} m³`}</dd></div>
          <div><dt>Presupuesto</dt><dd>{form.budgetMaxUsd === null ? "Sin máximo" : `${form.currency} ${form.budgetMaxUsd.toLocaleString("en-US")}`}</dd></div><div><dt>Estado</dt><dd>{form.status}</dd></div><div><dt>Estrategia</dt><dd>{form.strategy}</dd></div>
        </dl><p><ShieldCheck size={16} aria-hidden="true" /> {readOnly ? "El servidor conserva la fuente de verdad; esta vista no inventa ni reemplaza valores ausentes." : "Fixture explícito: no genera runs, ofertas ni bookings."}</p></aside>
      </form>
      {readOnly ? <iframe ref={runnerFrameRef} className={styles.runnerFrame} src="/" title="Ejecución WebMCP de providers" aria-hidden="true" tabIndex={-1} /> : null}
    </div>
  );
}

function FormHeading({ id, title, description }: { id: string; title: string; description: string }) { return <header className={styles.formHeading}><span className={styles.eyebrow}>Configuración</span><h2 id={id}>{title}</h2><p>{description}</p></header>; }
function Field({ label, wide = false, children }: { label: string; wide?: boolean; children: React.ReactNode }) { return <label className={wide ? styles.fieldWide : undefined}><span>{label}</span>{children}</label>; }
function NumberField({ label, value, readOnly, onChange }: { label: string; value: number | null; readOnly: boolean; onChange: (value: number | null) => void }) { return <Field label={label}><input min="1" required={!readOnly} readOnly={readOnly} type="number" value={nullableNumber(value)} onChange={(event) => onChange(event.target.value ? Number(event.target.value) : null)} /></Field>; }
function InfoBox({ children }: { children: React.ReactNode }) { return <p className={styles.infoBox}><ShieldCheck size={17} aria-hidden="true" /> {children}</p>; }
function ReviewItem({ label, value }: { label: string; value: string }) { return <div><small>{label}</small><strong>{value}</strong></div>; }

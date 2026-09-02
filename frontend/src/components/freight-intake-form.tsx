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
  mapFreightRequestIntakeToForm,
} from "@/features/freight-requests/intake-ui-adapter";
import {
  buildManualIntakeFieldsFromForm,
  persistManualFreightRequestIntake,
  ManualFreightRequestIntakeClientError,
  mapDocumentToCanonicalCode,
} from "@/features/freight-requests/manual-intake-client";
import type { OfficialCargoCategoryCode } from "@/features/freight-requests/manual-intake-contracts";
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
const documentOptions = [
  { code: "commercial_invoice", label: "Factura comercial" },
  { code: "packing_list", label: "Lista de empaque (Packing list)" },
  { code: "certificate_of_origin", label: "Certificado de origen" },
  { code: "technical_datasheet", label: "Ficha técnica" },
];

function nullableNumber(value: number | null) { return value ?? ""; }
function displayNumber(value: number | null, suffix = "") {
  return value === null ? "No registrado" : `${value.toLocaleString("es-PE")}${suffix}`;
}
function displayDate(value: string) {
  return value ? value.replace("T", " ").replace(".000Z", " UTC") : "No aplica";
}
function toDatetimeLocalValue(isoString: string | null | undefined): string {
  if (!isoString) return "";
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
function fromDatetimeLocalValue(localValue: string): string {
  if (!localValue) return "";
  const date = new Date(localValue);
  if (isNaN(date.getTime())) return "";
  return date.toISOString();
}
function getDisplayedTotals(form: FreightIntakeModel) {
  if (form.entryMethod === "TOTAL_WEIGHT") {
    return { weightKg: form.totalWeightKg, volumeM3: form.totalVolumeM3 ?? null };
  }
  const quantity = form.quantity ?? 0;
  const units = form.unitsPerEntry ?? 1;
  const weightKg = form.unitWeightKg !== null && form.unitWeightKg !== undefined
    ? quantity * units * form.unitWeightKg
    : form.totalWeightKg;
  const volumeM3 = [form.lengthCm, form.widthCm, form.heightCm].some((value) => value === null || value === undefined)
    ? form.totalVolumeM3
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
  const [saving, setSaving] = useState(false);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [webMcpReady, setWebMcpReady] = useState(false);
  const [recommendationRegistrationError, setRecommendationRegistrationError] = useState<string | null>(null);
  const [draftReady, setDraftReady] = useState(initialValue.source !== "persisted");
  const [draftLoadError, setDraftLoadError] = useState<string | null>(null);
  const runnerFrameRef = useRef<HTMLIFrameElement>(null);
  const isEditable = form.status === "DRAFT" || form.status === "PENDING";
  const readOnly = !isEditable;
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
  function toggleDocument(code: string) {
    if (readOnly) return;
    const currentCodes = form.documents.map(mapDocumentToCanonicalCode);
    const hasCode = currentCodes.includes(code);
    const updated = hasCode
      ? currentCodes.filter((item) => item !== code)
      : [...currentCodes, code];
    setForm((current) => ({
      ...current,
      documents: updated,
    }));
  }

  const saveManualDraft = useCallback(async (signal?: AbortSignal) => {
    if (!isEditable || form.source !== "persisted") return form;
    setSaving(true);
    setSubmitError(null);
    setSaveNotice(null);
    try {
      const abortSignal = signal ?? new AbortController().signal;
      const fields = buildManualIntakeFieldsFromForm(form);
      const input = {
        draftVersion: form.draftVersion,
        fields,
      };
      const updated = await persistManualFreightRequestIntake(
        form.freightRequestId,
        input,
        abortSignal,
      );
      const updatedModel = mapFreightRequestIntakeToForm(updated);
      setForm(updatedModel);
      setSaveNotice(`Borrador guardado exitosamente (v${updatedModel.draftVersion}).`);
      return updatedModel;
    } catch (error) {
      if (error instanceof ManualFreightRequestIntakeClientError && error.code === "STALE_DRAFT") {
        setSubmitError("El borrador cambió concurrentemente en el servidor (409 STALE_DRAFT). Recargando versión canónica...");
        const ctrl = new AbortController();
        await loadCanonicalDraft(ctrl.signal);
      } else {
        setSubmitError(error instanceof Error ? error.message : "No fue posible guardar los cambios manuales.");
      }
      throw error;
    } finally {
      setSaving(false);
    }
  }, [form, isEditable, loadCanonicalDraft]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step < steps.length - 1) {
      if (isEditable && form.source === "persisted") {
        try {
          await saveManualDraft();
        } catch {
          return;
        }
      }
      setStep((current) => current + 1);
      return;
    }
    if (dispatchBlockReason) { setSubmitError(dispatchBlockReason); return; }
    const runnerFrame = runnerFrameRef.current;
    if (!runnerFrame) { setSubmitError("No fue posible preparar el navegador para evaluar los providers."); return; }

    setSubmitting(true);
    setSubmitError(null);
    try {
      if (isEditable && form.source === "persisted") {
        await saveManualDraft();
      }
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
        <div>
          <span className={styles.eyebrow}>B-02 · Intake de carga</span>
          <h1>Nueva solicitud de transporte</h1>
          <p>
            {form.source === "persisted"
              ? isEditable
                ? "Borrador editable activo. Captura tus datos operativos o aplica sugerencias WebMCP."
                : "Revisa la solicitud persistida antes de iniciar la evaluación de providers."
              : "Escenario fixture declarado para regresión visual; no inicia operaciones reales."}
          </p>
        </div>
        <div className={styles.draftBadge}>
          <ShieldCheck size={16} aria-hidden="true" />
          {form.source === "persisted" ? `Borrador v${form.draftVersion} (${form.status})` : "Fixture visual"}
        </div>
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
        {steps.map(({ label, icon: Icon }, index) => (
          <li key={label}>
            <button
              type="button"
              className={`${styles.step} ${index === step ? styles.stepActive : ""} ${index < step ? styles.stepDone : ""}`}
              aria-current={index === step ? "step" : undefined}
              onClick={() => setStep(index)}
              disabled={submitting || saving}
            >
              <span>{index < step ? <Check size={16} aria-hidden="true" /> : <Icon size={16} aria-hidden="true" />}</span>
              <small>Paso {index + 1}</small>
              <strong>{label}</strong>
            </button>
          </li>
        ))}
      </ol>

      <form className={styles.formLayout} onSubmit={submit} aria-busy={submitting || saving}>
        <section className={styles.formCard} aria-labelledby={`step-title-${step}`}>
          {step === 0 ? <>
            <FormHeading id="step-title-0" title="Organización y solicitante" description="La organización, el operador y el perfil proceden del ViewModel autorizado." />
            <div className={styles.fieldGrid}>
              <Field label="Organización activa"><input value={form.organization} readOnly /></Field>
              <Field label="Solicitante"><input value={form.requester} readOnly /></Field>
              <Field label="Perfil de carga" wide>
                <input value={form.cargoProfile || "Perfil operativo estándar"} readOnly />
              </Field>
            </div>
            <InfoBox>
              {readOnly
                ? "La identidad y la membresía se validaron server-side; esta vista no las sustituye."
                : "Formulario editable autenticado con recálculo server-side. La categoría de carga oficial y dimensiones se definen en el Paso 3."}
            </InfoBox>
          </> : null}

          {step === 1 ? <>
            <FormHeading id="step-title-1" title="Origen y destino" description="Corredor y contactos operativos estructurados para esta solicitud." />
            <div className={styles.fieldGrid}>
              <Field label="País de origen">
                {readOnly ? (
                  <input value={form.originCountry === "PE" ? "Perú (PE)" : "Chile (CL)"} readOnly />
                ) : (
                  <select
                    value={form.originCountry}
                    onChange={(event) => {
                      const country = event.target.value;
                      setForm((curr) => ({
                        ...curr,
                        originCountry: country,
                        origin: `${curr.originCity || ""}, ${country}`,
                      }));
                    }}
                  >
                    <option value="PE">Perú (PE)</option>
                    <option value="CL">Chile (CL)</option>
                  </select>
                )}
              </Field>
              <Field label="Región / Depto. (Origen)">
                <input
                  required={!readOnly}
                  readOnly={readOnly}
                  placeholder="ej. Callao, Lima"
                  value={form.originRegion}
                  onChange={(event) => update("originRegion", event.target.value)}
                />
              </Field>
              <Field label="Ciudad de origen">
                <input
                  required={!readOnly}
                  readOnly={readOnly}
                  placeholder="ej. Callao"
                  value={form.originCity}
                  onChange={(event) => {
                    const city = event.target.value;
                    setForm((curr) => ({
                      ...curr,
                      originCity: city,
                      origin: `${city}, ${curr.originCountry}`,
                    }));
                  }}
                />
              </Field>
              <Field label="Dirección de recojo" wide>
                <input
                  readOnly={readOnly}
                  placeholder="ej. Av. Néstor Gambetta 100"
                  value={form.originAddress}
                  onChange={(event) => update("originAddress", event.target.value)}
                />
              </Field>

              <Field label="País de destino">
                {readOnly ? (
                  <input value={form.destinationCountry === "PE" ? "Perú (PE)" : "Chile (CL)"} readOnly />
                ) : (
                  <select
                    value={form.destinationCountry}
                    onChange={(event) => {
                      const country = event.target.value;
                      setForm((curr) => ({
                        ...curr,
                        destinationCountry: country,
                        destination: `${curr.destinationCity || ""}, ${country}`,
                      }));
                    }}
                  >
                    <option value="CL">Chile (CL)</option>
                    <option value="PE">Perú (PE)</option>
                  </select>
                )}
              </Field>
              <Field label="Región (Destino)">
                <input
                  required={!readOnly}
                  readOnly={readOnly}
                  placeholder="ej. Región Metropolitana"
                  value={form.destinationRegion}
                  onChange={(event) => update("destinationRegion", event.target.value)}
                />
              </Field>
              <Field label="Ciudad de destino">
                <input
                  required={!readOnly}
                  readOnly={readOnly}
                  placeholder="ej. Santiago"
                  value={form.destinationCity}
                  onChange={(event) => {
                    const city = event.target.value;
                    setForm((curr) => ({
                      ...curr,
                      destinationCity: city,
                      destination: `${city}, ${curr.destinationCountry}`,
                    }));
                  }}
                />
              </Field>
              <Field label="Dirección de entrega" wide>
                <input
                  readOnly={readOnly}
                  placeholder="ej. Av. Logística 200"
                  value={form.destinationAddress}
                  onChange={(event) => update("destinationAddress", event.target.value)}
                />
              </Field>

              <Field label="Contacto de recojo (Nombre)">
                <input
                  readOnly={readOnly}
                  placeholder="ej. Ana Pérez"
                  value={form.pickupContactName}
                  onChange={(event) => {
                    const name = event.target.value;
                    setForm((curr) => ({
                      ...curr,
                      pickupContactName: name,
                      pickupContact: curr.pickupContactPhone ? `${name} (${curr.pickupContactPhone})` : name,
                    }));
                  }}
                />
              </Field>
              <Field label="Teléfono de recojo">
                <input
                  readOnly={readOnly}
                  placeholder="ej. +51 999 000 111"
                  value={form.pickupContactPhone}
                  onChange={(event) => {
                    const phone = event.target.value;
                    setForm((curr) => ({
                      ...curr,
                      pickupContactPhone: phone,
                      pickupContact: curr.pickupContactName ? `${curr.pickupContactName} (${phone})` : phone,
                    }));
                  }}
                />
              </Field>

              <Field label="Contacto receptor (Nombre)">
                <input
                  readOnly={readOnly}
                  placeholder="ej. Diego Ramos"
                  value={form.receiverName}
                  onChange={(event) => {
                    const name = event.target.value;
                    setForm((curr) => ({
                      ...curr,
                      receiverName: name,
                      deliveryContact: [name, curr.receiverCompany, curr.receiverPhone].filter(Boolean).join(" · "),
                    }));
                  }}
                />
              </Field>
              <Field label="Empresa receptora">
                <input
                  readOnly={readOnly}
                  placeholder="ej. Destino Minero S.A."
                  value={form.receiverCompany}
                  onChange={(event) => {
                    const comp = event.target.value;
                    setForm((curr) => ({
                      ...curr,
                      receiverCompany: comp,
                      deliveryContact: [curr.receiverName, comp, curr.receiverPhone].filter(Boolean).join(" · "),
                    }));
                  }}
                />
              </Field>
              <Field label="Teléfono receptor">
                <input
                  readOnly={readOnly}
                  placeholder="ej. +56 999 000 222"
                  value={form.receiverPhone}
                  onChange={(event) => {
                    const phone = event.target.value;
                    setForm((curr) => ({
                      ...curr,
                      receiverPhone: phone,
                      deliveryContact: [curr.receiverName, curr.receiverCompany, phone].filter(Boolean).join(" · "),
                    }));
                  }}
                />
              </Field>
              <Field label="Notas operativas" wide>
                <input
                  readOnly={readOnly}
                  placeholder="Instrucciones para paso fronterizo o almacén"
                  value={form.operationalNotes}
                  onChange={(event) => update("operationalNotes", event.target.value)}
                />
              </Field>
            </div>
          </> : null}

          {step === 2 ? <>
            <FormHeading id="step-title-2" title="Características de la carga" description="Los totales canónicos se calculan de forma determinística en el servidor." />
            <div className={styles.fieldGrid}>
              <Field label="Categoría de carga">
                {readOnly ? (
                  <input value={form.cargoCategory} readOnly />
                ) : (
                  <select
                    value={form.cargoCategoryCode}
                    onChange={(event) => {
                      const code = event.target.value as OfficialCargoCategoryCode;
                      const labelMap: Record<OfficialCargoCategoryCode, string> = {
                        MACHINERY: "Repuestos y maquinaria minera",
                        GENERAL: "Carga general paletizada",
                        AGRICULTURAL: "Agrícola y perecibles",
                        CONSTRUCTION: "Materiales de construcción",
                      };
                      setForm((curr) => ({
                        ...curr,
                        cargoCategoryCode: code,
                        cargoCategory: labelMap[code] ?? code,
                        cargoDescription: labelMap[code] ?? code,
                      }));
                    }}
                  >
                    <option value="MACHINERY">Repuestos y maquinaria minera</option>
                    <option value="GENERAL">Carga general paletizada</option>
                    <option value="AGRICULTURAL">Agrícola y perecibles</option>
                    <option value="CONSTRUCTION">Materiales de construcción</option>
                  </select>
                )}
              </Field>
              <Field label="Método de ingreso">
                {readOnly ? (
                  <input value={form.entryMethod} readOnly />
                ) : (
                  <select value={form.entryMethod} onChange={(event) => update("entryMethod", event.target.value)}>
                    <option value="PALLETS">Pallets</option>
                    <option value="UNITS">Bultos / Unidades</option>
                    <option value="SACKS">Sacos</option>
                    <option value="TOTAL_WEIGHT">Carga Suelta (Solo peso total)</option>
                  </select>
                )}
              </Field>
              {form.entryMethod === "TOTAL_WEIGHT" ? (
                <NumberField
                  label="Peso total de la carga (kg)"
                  value={form.totalWeightKg}
                  readOnly={readOnly}
                  onChange={(value) => update("totalWeightKg", value ?? 0)}
                />
              ) : (
                <>
                  <NumberField label="Cantidad" value={form.quantity} readOnly={readOnly} onChange={(value) => update("quantity", value)} />
                  <NumberField label="Unidades por entrada" value={form.unitsPerEntry} readOnly={readOnly} onChange={(value) => update("unitsPerEntry", value)} />
                  <NumberField label="Peso unitario (kg)" value={form.unitWeightKg} readOnly={readOnly} onChange={(value) => update("unitWeightKg", value)} />
                  <NumberField label="Largo (cm)" value={form.lengthCm} readOnly={readOnly} onChange={(value) => update("lengthCm", value)} />
                  <NumberField label="Ancho (cm)" value={form.widthCm} readOnly={readOnly} onChange={(value) => update("widthCm", value)} />
                  <NumberField label="Alto (cm)" value={form.heightCm} readOnly={readOnly} onChange={(value) => update("heightCm", value)} />
                </>
              )}
            </div>
            <div className={styles.totals} aria-live="polite">
              <div><small>Peso canónico</small><strong>{displayNumber(totals.weightKg, " kg")}</strong></div>
              <div><small>Volumen canónico</small><strong>{totals.volumeM3 === null ? "No registrado" : `${totals.volumeM3.toLocaleString("es-PE", { maximumFractionDigits: 2 })} m³`}</strong></div>
            </div>
          </> : null}

          {step === 3 ? <>
            <FormHeading id="step-title-3" title="Programación y políticas" description="Configura la ventana de recojo, deadline de entrega y presupuesto máximo." />
            <div className={styles.fieldGrid}>
              <Field label="Modo de recojo">
                {readOnly ? (
                  <input readOnly value={form.pickupMode} />
                ) : (
                  <select
                    value={form.pickupMode}
                    onChange={(event) => {
                      const mode = event.target.value as "ASAP" | "SCHEDULED";
                      setForm((curr) => ({ ...curr, pickupMode: mode }));
                    }}
                  >
                    <option value="SCHEDULED">Ventana programada (SCHEDULED)</option>
                    <option value="ASAP">Inmediato (ASAP)</option>
                  </select>
                )}
              </Field>
              {form.pickupMode === "SCHEDULED" ? (
                <>
                  <Field label="Inicio de ventana">
                    <input
                      type="datetime-local"
                      readOnly={readOnly}
                      value={toDatetimeLocalValue(form.pickupWindowStart)}
                      onChange={(event) => update("pickupWindowStart", fromDatetimeLocalValue(event.target.value))}
                    />
                  </Field>
                  <Field label="Fin de ventana">
                    <input
                      type="datetime-local"
                      readOnly={readOnly}
                      value={toDatetimeLocalValue(form.pickupWindowEnd)}
                      onChange={(event) => update("pickupWindowEnd", fromDatetimeLocalValue(event.target.value))}
                    />
                  </Field>
                  <Field label="Deadline de entrega">
                    <input
                      type="datetime-local"
                      readOnly={readOnly}
                      value={toDatetimeLocalValue(form.deliveryDeadline)}
                      onChange={(event) => update("deliveryDeadline", fromDatetimeLocalValue(event.target.value))}
                    />
                  </Field>
                </>
              ) : (
                <Field label="Recojo requerido" wide>
                  <input readOnly value="ASAP · Recolección prioritaria en el primer turno disponible" />
                </Field>
              )}
              <Field label={`Presupuesto máximo (${form.currency})`}>
                <input
                  min="1"
                  required={!readOnly}
                  readOnly={readOnly}
                  type="number"
                  value={nullableNumber(form.budgetMaxUsd)}
                  onChange={(event) => update("budgetMaxUsd", event.target.value ? Number(event.target.value) : null)}
                />
              </Field>
              <Field label="Estrategia">
                <input value={form.strategy} readOnly />
              </Field>
            </div>
            <fieldset className={styles.documentFieldset}>
              <legend>Documentos disponibles</legend>
              {documentOptions.map((doc) => (
                <label key={doc.code}>
                  <input
                    type="checkbox"
                    disabled={readOnly}
                    checked={form.documents.map(mapDocumentToCanonicalCode).includes(doc.code)}
                    onChange={() => toggleDocument(doc.code)}
                  />
                  <span>{doc.label}</span>
                </label>
              ))}
            </fieldset>
          </> : null}

          {step === 4 ? <>
            <FormHeading id="step-title-4" title="Revisión y confirmación" description="Revisa el borrador antes de iniciar la evaluación con providers WebMCP." />
            <div className={styles.reviewGrid}>
              <ReviewItem label="Organización" value={`${form.organization} · ${form.requester}`} />
              <ReviewItem label="Ruta" value={`${form.originCountry}: ${form.originCity} (${form.originRegion || "S/R"}) → ${form.destinationCountry}: ${form.destinationCity} (${form.destinationRegion || "S/R"})`} />
              <ReviewItem label="Contactos" value={`Recojo: ${form.pickupContact || "No registrado"} | Entrega: ${form.deliveryContact || "No registrado"}`} />
              <ReviewItem label="Carga" value={`${displayNumber(form.quantity)} ${form.entryMethod.toLowerCase()} · ${form.cargoCategory} · ${displayNumber(totals.weightKg, " kg")} · ${totals.volumeM3 === null ? "Volumen no registrado" : `${totals.volumeM3.toLocaleString("es-PE", { maximumFractionDigits: 2 })} m³`}`} />
              <ReviewItem label="Programación" value={form.pickupMode === "ASAP" ? "ASAP (Inmediato)" : `${displayDate(form.pickupWindowStart)} → ${displayDate(form.pickupWindowEnd)}`} />
              <ReviewItem label="Deadline de entrega" value={displayDate(form.deliveryDeadline)} />
              <ReviewItem label="Política" value={`${form.strategy} · ${form.budgetMaxUsd === null ? "Sin presupuesto máximo" : `${form.currency} ${form.budgetMaxUsd.toLocaleString("en-US")}`}`} />
              <ReviewItem label="Documentos" value={form.documents.length ? form.documents.join(", ") : "Sin documentos registrados"} />
            </div>
            <div className={styles.readyNotice}>
              <FileCheck2 size={20} aria-hidden="true" />
              <span>
                <strong>{dispatchBlockReason ? "Dispatch bloqueado" : "Solicitud lista para evaluación"}</strong>
                <small>{dispatchBlockReason ?? "La capacidad real se validará mediante WebMCP durante el dispatch."}</small>
              </span>
            </div>
          </> : null}

          <footer className={styles.actions}>
            {saveNotice ? <p className={styles.infoBox} role="status">{saveNotice}</p> : null}
            {submitError ? <p className={styles.submitError} role="alert">{submitError}</p> : null}
            <button
              type="button"
              className={styles.secondaryButton}
              disabled={step === 0 || submitting || saving}
              onClick={() => setStep((current) => current - 1)}
            >
              <ArrowLeft size={17} aria-hidden="true" /> Anterior
            </button>
            {isEditable && form.source === "persisted" ? (
              <button
                type="button"
                className={styles.secondaryButton}
                disabled={submitting || saving}
                onClick={() => void saveManualDraft()}
              >
                <FileCheck2 size={17} aria-hidden="true" />
                {saving ? "Guardando…" : "Guardar borrador"}
              </button>
            ) : null}
            <button
              type="submit"
              className={styles.primaryButton}
              disabled={submitting || saving || (step === steps.length - 1 && dispatchBlockReason !== null)}
            >
              {submitting
                ? "Evaluando providers…"
                : saving
                  ? "Guardando…"
                  : step === steps.length - 1
                    ? "Confirmar y buscar opciones"
                    : "Continuar"}
              <ArrowRight size={17} aria-hidden="true" />
            </button>
          </footer>
        </section>

        <aside className={styles.summaryCard} aria-label="Resumen de la solicitud">
          <span className={styles.eyebrow}>{readOnly ? "ViewModel persistido (Cerrado)" : `Borrador v${form.draftVersion}`}</span>
          <h2>{form.requestId}</h2>
          <dl>
            <div><dt>Corredor</dt><dd>{form.origin}<br />{form.destination}</dd></div>
            <div><dt>Carga</dt><dd>{displayNumber(totals.weightKg, " kg")} · {totals.volumeM3 === null ? "Volumen no registrado" : `${totals.volumeM3.toLocaleString("es-PE", { maximumFractionDigits: 2 })} m³`}</dd></div>
            <div><dt>Presupuesto</dt><dd>{form.budgetMaxUsd === null ? "Sin máximo" : `${form.currency} ${form.budgetMaxUsd.toLocaleString("en-US")}`}</dd></div>
            <div><dt>Estado</dt><dd>{form.status}</dd></div>
            <div><dt>Estrategia</dt><dd>{form.strategy}</dd></div>
          </dl>
          <p>
            <ShieldCheck size={16} aria-hidden="true" />
            {readOnly
              ? "El servidor conserva la fuente de verdad; esta vista no inventa ni reemplaza valores ausentes."
              : "Persistencia manual atómica con recálculo de peso/volumen en servidor y control STALE_DRAFT."}
          </p>
        </aside>
      </form>
      <iframe ref={runnerFrameRef} className={styles.runnerFrame} src="/" title="Ejecución WebMCP de providers" aria-hidden="true" tabIndex={-1} />
    </div>
  );
}

function FormHeading({ id, title, description }: { id: string; title: string; description: string }) { return <header className={styles.formHeading}><span className={styles.eyebrow}>Configuración</span><h2 id={id}>{title}</h2><p>{description}</p></header>; }
function Field({ label, wide = false, children }: { label: string; wide?: boolean; children: React.ReactNode }) { return <label className={wide ? styles.fieldWide : undefined}><span>{label}</span>{children}</label>; }
function NumberField({ label, value, readOnly, onChange }: { label: string; value: number | null; readOnly: boolean; onChange: (value: number | null) => void }) { return <Field label={label}><input min="1" required={!readOnly} readOnly={readOnly} type="number" value={nullableNumber(value)} onChange={(event) => onChange(event.target.value ? Number(event.target.value) : null)} /></Field>; }
function InfoBox({ children }: { children: React.ReactNode }) { return <p className={styles.infoBox}><ShieldCheck size={17} aria-hidden="true" /> {children}</p>; }
function ReviewItem({ label, value }: { label: string; value: string }) { return <div><small>{label}</small><strong>{value}</strong></div>; }

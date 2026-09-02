"use client";

import {
  ArrowLeft, ArrowRight, Box, Boxes, Building2, CalendarClock, Check,
  FileCheck2, Layers, LoaderCircle, MapPin, PackageCheck, ShieldAlert, ShieldCheck,
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
import {
  LATAM_LOGISTICS_DIRECTORY,
  getCountryByCode,
  getCountryDialCode,
  type CountryLogistics,
} from "@/features/freight-requests/geography-data";
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

export const DEMO_OPERATORS = [
  { id: "e0000000-0000-0000-0000-000000000001", name: "CargoMesh Demo Operator", role: "Supervisor de Operaciones" },
  { id: "e0000000-0000-0000-0000-000000000002", name: "Ing. Carlos Mendoza", role: "Jefe de Despacho & Logística" },
  { id: "e0000000-0000-0000-0000-000000000003", name: "Ana Lucía Torres", role: "Coordinadora de Comercio Exterior" },
  { id: "e0000000-0000-0000-0000-000000000004", name: "Ing. Roberto Huamán", role: "Supervisor de Faena & Carga" },
];

export const DEMO_CARGO_PROFILES = [
  {
    id: "custom",
    name: "✍️ Personalizado (Ingreso manual sin plantilla)",
    categoryCode: "GENERAL",
    categoryName: "Carga General",
    entryMethod: "TOTAL_WEIGHT",
    quantity: null,
    unitWeightKg: null,
    unitsPerEntry: null,
    lengthCm: null,
    widthCm: null,
    heightCm: null,
    totalWeightKg: 8000,
  },
  {
    id: "c7f04716-c200-481d-ab7d-9c10dbe6cb3a",
    name: "📦 Repuestos y maquinaria minera (PALLETS · 10 pallets de 800 kg c/u)",
    categoryCode: "MACHINERY",
    categoryName: "Maquinaria y Equipos Industriales",
    entryMethod: "PALLETS",
    quantity: 10,
    unitWeightKg: 800,
    unitsPerEntry: 1,
    lengthCm: 120,
    widthCm: 100,
    heightCm: 160,
    totalWeightKg: 8000,
  },
  {
    id: "c2dd33ae-6942-48f6-8693-f6c6c169af4c",
    name: "🍇 Arándanos y Fruta Fresca Reefer (PALLETS · 20 pallets de 800 kg c/u)",
    categoryCode: "AGRICULTURAL",
    categoryName: "Productos Agrícolas",
    entryMethod: "PALLETS",
    quantity: 20,
    unitWeightKg: 800,
    unitsPerEntry: 1,
    lengthCm: 120,
    widthCm: 100,
    heightCm: 160,
    totalWeightKg: 16000,
  },
  {
    id: "59f0adc8-7c07-4dcf-85d3-41257fc8fb32",
    name: "🏗️ Cemento en Bolsas y Clinker (PALLETS · 24 pallets de 1,000 kg c/u)",
    categoryCode: "CONSTRUCTION",
    categoryName: "Materiales de Construcción",
    entryMethod: "PALLETS",
    quantity: 24,
    unitWeightKg: 1000,
    unitsPerEntry: 1,
    lengthCm: 120,
    widthCm: 100,
    heightCm: 140,
    totalWeightKg: 24000,
  },
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
  defaultCleanMode = false,
  persistRecommendation = persistFreightRecommendationDraft,
}: {
  initialValue: FreightIntakeModel;
  defaultCleanMode?: boolean;
  persistRecommendation?: PersistRecommendationAcceptance;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [isCleanMode, setIsCleanMode] = useState(defaultCleanMode);
  const [form, setForm] = useState<FreightIntakeModel>(() => {
    if (defaultCleanMode) {
      return {
        ...initialValue,
        cargoProfile: "",
        originRegion: "",
        originCity: "",
        originAddress: "",
        origin: "",
        destinationRegion: "",
        destinationCity: "",
        destinationAddress: "",
        destination: "",
        pickupContactName: "",
        pickupContactPhone: "",
        pickupContact: "",
        receiverName: "",
        receiverCompany: "",
        receiverPhone: "",
        deliveryContact: "",
        quantity: null,
        unitWeightKg: null,
        unitsPerEntry: 1,
        lengthCm: null,
        widthCm: null,
        heightCm: null,
        totalWeightKg: 0,
        cargoWeightKg: 0,
        totalVolumeM3: null,
        cargoVolumeM3: null,
        budgetMaxUsd: null,
        documents: [],
        operationalNotes: "",
      };
    }
    return initialValue;
  });
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
  const [originCoords, setOriginCoords] = useState(defaultCleanMode ? "" : "-12.0464, -77.0428");
  const [destCoords, setDestCoords] = useState(defaultCleanMode ? "" : "-33.4489, -70.6693");
  const [requiresRefrigeration, setRequiresRefrigeration] = useState(false);
  const [tempMin, setTempMin] = useState("-5");
  const [tempMax, setTempMax] = useState("2");
  const [isHazardous, setIsHazardous] = useState(false);
  const [isFragile, setIsFragile] = useState(false);
  const [isOversized, setIsOversized] = useState(false);

  function handleToggleCleanMode() {
    if (!isCleanMode) {
      setIsCleanMode(true);
      setOriginCoords("");
      setDestCoords("");
      setRequiresRefrigeration(false);
      setIsHazardous(false);
      setIsFragile(false);
      setIsOversized(false);
      setForm((curr) => ({
        ...curr,
        draftVersion: curr.draftVersion,
        cargoProfile: "",
        originRegion: "",
        originCity: "",
        originAddress: "",
        origin: "",
        destinationRegion: "",
        destinationCity: "",
        destinationAddress: "",
        destination: "",
        pickupContactName: "",
        pickupContactPhone: "",
        pickupContact: "",
        receiverName: "",
        receiverCompany: "",
        receiverPhone: "",
        deliveryContact: "",
        quantity: null,
        unitWeightKg: null,
        unitsPerEntry: 1,
        lengthCm: null,
        widthCm: null,
        heightCm: null,
        totalWeightKg: 0,
        cargoWeightKg: 0,
        totalVolumeM3: null,
        cargoVolumeM3: null,
        budgetMaxUsd: null,
        documents: [],
        operationalNotes: "",
      }));
    } else {
      setIsCleanMode(false);
      setOriginCoords("-12.0464, -77.0428");
      setDestCoords("-33.4489, -70.6693");
      setForm(initialValue);
    }
  }

  const loadCanonicalDraft = useCallback(async (signal: AbortSignal) => {
    const draft = await fetchFreightRequestDraft(initialValue.freightRequestId, signal);
    setForm((current) => applyFreightRequestDraftToIntake(current, draft));
    setDraftLoadError(null);
    setDraftReady(true);
  }, [initialValue.freightRequestId]);

  useEffect(() => {
    if (initialValue.source !== "persisted" || defaultCleanMode) return;
    const controller = new AbortController();
    void loadCanonicalDraft(controller.signal).catch((error) => {
      if (controller.signal.aborted) return;
      setDraftReady(false);
      setDraftLoadError(error instanceof Error ? error.message : "No fue posible cargar el borrador vigente desde D1-01.");
    });
    return () => controller.abort();
  }, [initialValue.source, loadCanonicalDraft, defaultCleanMode]);

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
    try {
      const draft = await fetchFreightRequestDraft(initialValue.freightRequestId, signal);
      setForm((current) => ({
        ...current,
        draftVersion: draft.draftVersion,
      }));
      setDraftReady(true);
    } catch {
      // Background stale notification shouldn't erase user's active inputs
    }
  }, [initialValue.freightRequestId]);

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
        try {
          const ctrl = new AbortController();
          const draft = await fetchFreightRequestDraft(initialValue.freightRequestId, ctrl.signal);
          setForm((curr) => ({
            ...curr,
            draftVersion: draft.draftVersion,
          }));
          setSubmitError(`Versión sincronizada con el servidor (v${draft.draftVersion}). Presiona Continuar nuevamente.`);
        } catch {
          const ctrl = new AbortController();
          await loadCanonicalDraft(ctrl.signal);
        }
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
        if (form.originCity && form.destinationCity && (totals.weightKg ?? 0) > 0) {
          try {
            await saveManualDraft();
          } catch (err) {
            console.warn("Auto-save on step transition deferred:", err);
          }
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

  const originCountryData = getCountryByCode(form.originCountry) || LATAM_LOGISTICS_DIRECTORY[0];
  const destCountryData = getCountryByCode(form.destinationCountry) || LATAM_LOGISTICS_DIRECTORY[1];

  const originRegions = originCountryData.regions;
  const destRegions = destCountryData.regions;

  const originSelectedRegion =
    originRegions.find((r) => r.name.toLowerCase() === (form.originRegion || "").toLowerCase()) ||
    originRegions[0];
  const destSelectedRegion =
    destRegions.find((r) => r.name.toLowerCase() === (form.destinationRegion || "").toLowerCase()) ||
    destRegions[0];

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
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.45rem" }}>
          <div className={styles.draftBadge}>
            <ShieldCheck size={16} aria-hidden="true" />
            {isCleanMode ? "Borrador v1 (Nuevo)" : form.source === "persisted" ? `Borrador v${form.draftVersion} (${form.status})` : "Fixture visual"}
          </div>
          {isEditable && (
            <button
              type="button"
              className={styles.cleanDraftButton}
              onClick={handleToggleCleanMode}
            >
              {isCleanMode ? "⚡ Cargar caso canónico FR-1042" : "🧹 Iniciar borrador en blanco (v1)"}
            </button>
          )}
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
            <FormHeading id="step-title-0" title="Organización y solicitante" description="Selecciona el contexto operativo, solicitante y el perfil estándar de la empresa." />
            <div className={styles.fieldGrid}>
              <Field label="Organización activa">
                <input value={`${form.organization} · Empresa Verificada`} readOnly />
              </Field>
              <Field label="Solicitante">
                <input value="CargoMesh Operator (REQUESTER)" readOnly />
              </Field>
              <Field label="Supervisor responsable (opcional)" wide>
                {readOnly ? (
                  <input value={form.requester || "María Torres (Supervisor)"} readOnly />
                ) : (
                  <select
                    value={form.operatorMemberId || DEMO_OPERATORS[0].id}
                    onChange={(e) => {
                      const op = DEMO_OPERATORS.find((o) => o.id === e.target.value) || DEMO_OPERATORS[0];
                      setForm((curr) => ({
                        ...curr,
                        operatorMemberId: op.id,
                        requester: op.name,
                      }));
                    }}
                  >
                    {DEMO_OPERATORS.map((op) => (
                      <option key={op.id} value={op.id}>
                        {op.name} — {op.role}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
              <Field label="Perfil de carga estándar de la empresa" wide>
                {readOnly ? (
                  <input value={form.cargoProfile || "Perfil operativo estándar"} readOnly />
                ) : (
                  <select
                    value={
                      DEMO_CARGO_PROFILES.find((p) => form.cargoProfile && p.name.includes(form.cargoProfile))?.id ||
                      (form.cargoProfile ? DEMO_CARGO_PROFILES[1].id : "custom")
                    }
                    onChange={(e) => {
                      const profile = DEMO_CARGO_PROFILES.find((p) => p.id === e.target.value) || DEMO_CARGO_PROFILES[0];
                      setForm((curr) => ({
                        ...curr,
                        cargoProfile: profile.id === "custom" ? "" : profile.categoryName,
                        cargoCategoryCode: profile.categoryCode,
                        cargoCategory: profile.categoryName,
                        cargoDescription: profile.categoryName,
                        entryMethod: profile.entryMethod,
                        quantity: profile.quantity,
                        unitWeightKg: profile.unitWeightKg,
                        unitsPerEntry: profile.unitsPerEntry,
                        lengthCm: profile.lengthCm,
                        widthCm: profile.widthCm,
                        heightCm: profile.heightCm,
                        totalWeightKg: profile.totalWeightKg,
                        cargoWeightKg: profile.totalWeightKg,
                      }));
                    }}
                  >
                    {DEMO_CARGO_PROFILES.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
            </div>
            <InfoBox>
              {form.cargoProfile
                ? `✓ Perfil aplicado: "${form.cargoProfile}". Pre-configura automáticamente categoría, presentación y dimensiones en el Paso 3.`
                : "Al seleccionar un perfil de carga estándar, el sistema pre-configura automáticamente la categoría oficial, método de embalaje y cubicaje en el Paso 3."}
            </InfoBox>
          </> : null}

          {step === 1 ? <>
            <FormHeading
              id="step-title-1"
              title="Origen y destino"
              description="Define los puntos de recojo y entrega de la carga."
            />

            {/* SECCIÓN 1: DATOS DEL ORIGEN (RECOJO) */}
            <div className={styles.subSectionCard}>
              <div className={styles.subSectionHeader}>
                <span className={styles.subSectionBadge}>
                  <MapPin size={14} /> 1. Origen (Recojo)
                </span>
                <small>Punto de partida</small>
              </div>
              <div className={styles.fieldGrid}>
                <Field label="País de origen">
                  {readOnly ? (
                    <input value={`${originCountryData.flag} ${originCountryData.name} (${originCountryData.code})`} readOnly />
                  ) : (
                    <select
                      value={form.originCountry}
                      onChange={(event) => {
                        const countryCode = event.target.value as any;
                        const country = getCountryByCode(countryCode) || LATAM_LOGISTICS_DIRECTORY[0];
                        const defaultRegion = country.regions[0];
                        const defaultHub = defaultRegion.hubs[0];
                        setForm((curr) => ({
                          ...curr,
                          originCountry: countryCode,
                          originRegion: defaultRegion.name,
                          originCity: defaultHub.city,
                          origin: `${defaultHub.display}, ${countryCode}`,
                        }));
                      }}
                    >
                      {LATAM_LOGISTICS_DIRECTORY.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.flag} {c.name} ({c.code})
                        </option>
                      ))}
                    </select>
                  )}
                </Field>
                <Field label="Departamento / Región">
                  {readOnly ? (
                    <input value={form.originRegion || "No registrado"} readOnly />
                  ) : (
                    <select
                      value={originSelectedRegion.name}
                      onChange={(event) => {
                        const regionName = event.target.value;
                        const region = originRegions.find((r) => r.name === regionName) || originRegions[0];
                        const defaultHub = region.hubs[0];
                        setForm((curr) => ({
                          ...curr,
                          originRegion: region.name,
                          originCity: defaultHub.city,
                          origin: `${defaultHub.display}, ${curr.originCountry}`,
                        }));
                      }}
                    >
                      {originRegions.map((r) => (
                        <option key={r.name} value={r.name}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  )}
                </Field>
                <Field label="Ciudad">
                  {readOnly ? (
                    <input value={form.originCity} readOnly />
                  ) : (
                    <select
                      value={form.originCity}
                      onChange={(event) => {
                        const cityName = event.target.value;
                        const hub = originSelectedRegion.hubs.find((h) => h.city === cityName) || originSelectedRegion.hubs[0];
                        setForm((curr) => ({
                          ...curr,
                          originCity: cityName,
                          origin: `${hub?.display || cityName}, ${curr.originCountry}`,
                        }));
                      }}
                    >
                      {originSelectedRegion.hubs.map((h, index) => (
                        <option key={`${h.city}-${index}`} value={h.city}>
                          {h.city}
                        </option>
                      ))}
                    </select>
                  )}
                </Field>
                <Field label="Dirección de recojo">
                  <input
                    readOnly={readOnly}
                    placeholder="ej. Av. Néstor Gambetta 100, Almacén Central"
                    value={form.originAddress}
                    onChange={(event) => update("originAddress", event.target.value)}
                  />
                </Field>
              </div>

              <details className={styles.advancedRouteSection}>
                <summary><span>👤 Datos operativos de contacto y ubicación (opcional) ▾</span></summary>
                <div className={styles.fieldGrid}>
                  <Field label="Contacto de recojo">
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
                    <div className={styles.phoneInputGroup}>
                      <span className={styles.dialBadge}>{getCountryDialCode(form.originCountry)}</span>
                      <input
                        readOnly={readOnly}
                        placeholder="999 555 101"
                        type="tel"
                        value={form.pickupContactPhone ? form.pickupContactPhone.replace(/^\+\d+\s*/, "") : ""}
                        onChange={(event) => {
                          const dial = getCountryDialCode(form.originCountry);
                          const rawDigits = event.target.value.replace(/[^\d\s-]/g, "");
                          const fullPhone = rawDigits ? `${dial} ${rawDigits.trim()}` : "";
                          setForm((curr) => ({
                            ...curr,
                            pickupContactPhone: fullPhone,
                            pickupContact: curr.pickupContactName ? `${curr.pickupContactName} (${fullPhone})` : fullPhone,
                          }));
                        }}
                      />
                    </div>
                  </Field>
                  <Field label="Ubicación precisa (Lat, Lng) — opcional" wide>
                    <input
                      readOnly={readOnly}
                      placeholder="ej. -12.0464, -77.0428"
                      value={originCoords}
                      onChange={(event) => setOriginCoords(event.target.value)}
                    />
                  </Field>
                </div>
              </details>
            </div>

            {/* SECCIÓN 2: DATOS DEL DESTINO (ENTREGA) */}
            <div className={styles.subSectionCard} style={{ marginTop: "1rem" }}>
              <div className={styles.subSectionHeader}>
                <span className={styles.subSectionBadge} style={{ background: "#e8f4f8", color: "#165a72" }}>
                  <MapPin size={14} /> 2. Destino (Entrega)
                </span>
                <small>Punto de llegada</small>
              </div>
              <div className={styles.fieldGrid}>
                <Field label="País de destino">
                  {readOnly ? (
                    <input value={`${destCountryData.flag} ${destCountryData.name} (${destCountryData.code})`} readOnly />
                  ) : (
                    <select
                      value={form.destinationCountry}
                      onChange={(event) => {
                        const countryCode = event.target.value as any;
                        const country = getCountryByCode(countryCode) || LATAM_LOGISTICS_DIRECTORY[1];
                        const defaultRegion = country.regions[0];
                        const defaultHub = defaultRegion.hubs[0];
                        setForm((curr) => ({
                          ...curr,
                          destinationCountry: countryCode,
                          destinationRegion: defaultRegion.name,
                          destinationCity: defaultHub.city,
                          destination: `${defaultHub.display}, ${countryCode}`,
                        }));
                      }}
                    >
                      {LATAM_LOGISTICS_DIRECTORY.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.flag} {c.name} ({c.code})
                        </option>
                      ))}
                    </select>
                  )}
                </Field>
                <Field label="Departamento / Región">
                  {readOnly ? (
                    <input value={form.destinationRegion || "No registrado"} readOnly />
                  ) : (
                    <select
                      value={destSelectedRegion.name}
                      onChange={(event) => {
                        const regionName = event.target.value;
                        const region = destRegions.find((r) => r.name === regionName) || destRegions[0];
                        const defaultHub = region.hubs[0];
                        setForm((curr) => ({
                          ...curr,
                          destinationRegion: region.name,
                          destinationCity: defaultHub.city,
                          destination: `${defaultHub.display}, ${curr.destinationCountry}`,
                        }));
                      }}
                    >
                      {destRegions.map((r) => (
                        <option key={r.name} value={r.name}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  )}
                </Field>
                <Field label="Ciudad">
                  {readOnly ? (
                    <input value={form.destinationCity} readOnly />
                  ) : (
                    <select
                      value={form.destinationCity}
                      onChange={(event) => {
                        const cityName = event.target.value;
                        const hub = destSelectedRegion.hubs.find((h) => h.city === cityName) || destSelectedRegion.hubs[0];
                        setForm((curr) => ({
                          ...curr,
                          destinationCity: cityName,
                          destination: `${hub?.display || cityName}, ${curr.destinationCountry}`,
                        }));
                      }}
                    >
                      {destSelectedRegion.hubs.map((h, index) => (
                        <option key={`${h.city}-${index}`} value={h.city}>
                          {h.city}
                        </option>
                      ))}
                    </select>
                  )}
                </Field>
                <Field label="Dirección de entrega">
                  <input
                    readOnly={readOnly}
                    placeholder="ej. Av. Logística 200, Centro de Distribución"
                    value={form.destinationAddress}
                    onChange={(event) => update("destinationAddress", event.target.value)}
                  />
                </Field>
              </div>

              <details className={styles.advancedRouteSection}>
                <summary><span>👤 Datos operativos de contacto y ubicación (opcional) ▾</span></summary>
                <div className={styles.fieldGrid}>
                  <Field label="Empresa de entrega">
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
                  <Field label="Contacto de entrega">
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
                  <Field label="Teléfono de entrega">
                    <div className={styles.phoneInputGroup}>
                      <span className={styles.dialBadge}>{getCountryDialCode(form.destinationCountry)}</span>
                      <input
                        readOnly={readOnly}
                        placeholder="999 000 222"
                        type="tel"
                        value={form.receiverPhone ? form.receiverPhone.replace(/^\+\d+\s*/, "") : ""}
                        onChange={(event) => {
                          const dial = getCountryDialCode(form.destinationCountry);
                          const rawDigits = event.target.value.replace(/[^\d\s-]/g, "");
                          const fullPhone = rawDigits ? `${dial} ${rawDigits.trim()}` : "";
                          setForm((curr) => ({
                            ...curr,
                            receiverPhone: fullPhone,
                            deliveryContact: [curr.receiverName, curr.receiverCompany, fullPhone].filter(Boolean).join(" · "),
                          }));
                        }}
                      />
                    </div>
                  </Field>
                  <Field label="Ubicación precisa (Lat, Lng) — opcional">
                    <input
                      readOnly={readOnly}
                      placeholder="ej. -33.4489, -70.6693"
                      value={destCoords}
                      onChange={(event) => setDestCoords(event.target.value)}
                    />
                  </Field>
                </div>
              </details>
            </div>

            {/* SECCIÓN 3: INSTRUCCIONES DE RUTA */}
            <div className={styles.subSectionCard} style={{ marginTop: "1rem" }}>
              <Field label="Instrucciones de ruta (opcional)" wide>
                <input
                  readOnly={readOnly}
                  placeholder="ej. Indicaciones para aduana o almacén"
                  value={form.operationalNotes}
                  onChange={(event) => update("operationalNotes", event.target.value)}
                />
              </Field>
            </div>
          </> : null}

          {step === 2 ? <>
            <FormHeading
              id="step-title-2"
              title="Características de la carga"
              description="Define la composición y requisitos operativos del envío."
            />

            {/* BANNER DE PERFIL APLICADO */}
            {form.cargoProfile ? (
              <div className={styles.profileBanner}>
                <div className={styles.profileBannerContent}>
                  <span className={styles.profileBannerBadge}>
                    <Check size={13} aria-hidden="true" /> Perfil aplicado
                  </span>
                  <strong>{form.cargoProfile} · {form.organization}</strong>
                </div>
                <button
                  type="button"
                  className={styles.profileChangeBtn}
                  onClick={() => setStep(0)}
                >
                  Cambiar en Paso 1
                </button>
              </div>
            ) : null}

            {/* BLOQUE 1: CLASIFICACIÓN DE LA CARGA */}
            <div className={styles.subSectionCard} style={{ marginTop: "0.75rem" }}>
              <div className={styles.subSectionHeader}>
                <span className={styles.subSectionBadge}>
                  <Layers size={14} /> 1. Clasificación
                </span>
                <div className={styles.badgeGroup} style={{ margin: 0 }}>
                  <span className={styles.badgeItem}>🚛 ROAD</span>
                  <span className={styles.badgeItem}>📦 FTL · Carga dedicada</span>
                </div>
              </div>
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
                <Field label="Presentación / embalaje">
                  {readOnly ? (
                    <input value={form.entryMethod} readOnly />
                  ) : (
                    <select
                      value={form.entryMethod}
                      onChange={(event) => update("entryMethod", event.target.value)}
                    >
                      <option value="PALLETS">Pallets (Carga paletizada)</option>
                      <option value="UNITS">Bultos / Cajas</option>
                      <option value="SACKS">Sacos</option>
                      <option value="TOTAL_WEIGHT">Carga suelta (Solo peso total)</option>
                    </select>
                  )}
                </Field>
              </div>
            </div>

            {/* BLOQUE 2: COMPOSICIÓN FÍSICA */}
            <div className={styles.subSectionCard} style={{ marginTop: "1rem" }}>
              <div className={styles.subSectionHeader}>
                <span className={styles.subSectionBadge}>
                  <Box size={14} /> 2. Composición física
                </span>
                <small>El peso y volumen total se calculan automáticamente.</small>
              </div>
              {form.entryMethod === "TOTAL_WEIGHT" ? (
                <div className={styles.fieldGrid}>
                  <NumberField
                    label="Peso total de la carga (kg)"
                    value={form.totalWeightKg}
                    readOnly={readOnly}
                    onChange={(value) => update("totalWeightKg", value ?? 0)}
                  />
                </div>
              ) : (
                <>
                  <div className={styles.fieldGrid}>
                    <NumberField
                      label="Número de bultos"
                      value={form.quantity}
                      readOnly={readOnly}
                      onChange={(value) => update("quantity", value)}
                    />
                    <NumberField
                      label="Peso por bulto (kg)"
                      value={form.unitWeightKg}
                      readOnly={readOnly}
                      onChange={(value) => update("unitWeightKg", value)}
                    />
                    <div className={styles.fieldWide}>
                      <span style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, color: "#2e4340", marginBottom: "0.4rem" }}>
                        Dimensiones por bulto (opcional)
                      </span>
                      <div className={styles.dimensionRow}>
                        <div className={styles.dimensionInputGroup}>
                          <span>Largo (cm)</span>
                          <input
                            type="number"
                            readOnly={readOnly}
                            value={nullableNumber(form.lengthCm)}
                            onChange={(e) => update("lengthCm", e.target.value ? Number(e.target.value) : null)}
                            placeholder="120"
                          />
                        </div>
                        <div className={styles.dimensionInputGroup}>
                          <span>Ancho (cm)</span>
                          <input
                            type="number"
                            readOnly={readOnly}
                            value={nullableNumber(form.widthCm)}
                            onChange={(e) => update("widthCm", e.target.value ? Number(e.target.value) : null)}
                            placeholder="100"
                          />
                        </div>
                        <div className={styles.dimensionInputGroup}>
                          <span>Alto (cm)</span>
                          <input
                            type="number"
                            readOnly={readOnly}
                            value={nullableNumber(form.heightCm)}
                            onChange={(e) => update("heightCm", e.target.value ? Number(e.target.value) : null)}
                            placeholder="160"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className={styles.totalsCards} aria-live="polite">
                    <div className={styles.totalCard}>
                      <span className={styles.totalCardLabel}>Peso total</span>
                      <strong className={styles.totalCardValue}>
                        {form.quantity && form.unitWeightKg ? displayNumber(totals.weightKg, " kg") : "— kg"}
                      </strong>
                      <small className={styles.totalCardSub}>
                        {form.quantity && form.unitWeightKg
                          ? `${form.quantity} × ${form.unitWeightKg} kg`
                          : "Completa bultos y peso por bulto"}
                      </small>
                    </div>
                    <div className={styles.totalCard}>
                      <span className={styles.totalCardLabel}>Volumen total</span>
                      <strong className={styles.totalCardValue}>
                        {totals.volumeM3 === null || !form.quantity
                          ? "— m³"
                          : `${totals.volumeM3.toLocaleString("es-PE", { maximumFractionDigits: 2 })} m³`}
                      </strong>
                      <small className={styles.totalCardSub}>
                        {totals.volumeM3 === null || !form.quantity
                          ? "Completa bultos y dimensiones"
                          : "Calculado automáticamente"}
                      </small>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* BLOQUE 3: REQUISITOS DE MANEJO */}
            <div className={styles.subSectionCard} style={{ marginTop: "1rem" }}>
              <div className={styles.subSectionHeader}>
                <span className={styles.subSectionBadge}>
                  <ShieldAlert size={14} /> 3. Requisitos de manejo
                </span>
                <small>CargoMesh solo considerará transportistas compatibles con estos requisitos.</small>
              </div>

              <div className={styles.requirementPillGroup}>
                <button
                  type="button"
                  className={`${styles.requirementPill} ${requiresRefrigeration ? styles.requirementPillActive : ""}`}
                  onClick={() => setRequiresRefrigeration(!requiresRefrigeration)}
                >
                  ❄ Temperatura controlada
                </button>
                <button
                  type="button"
                  className={`${styles.requirementPill} ${isHazardous ? styles.requirementPillActive : ""}`}
                  onClick={() => setIsHazardous(!isHazardous)}
                >
                  ⚠ Mercancía peligrosa (Hazmat)
                </button>
                <button
                  type="button"
                  className={`${styles.requirementPill} ${isFragile ? styles.requirementPillActive : ""}`}
                  onClick={() => setIsFragile(!isFragile)}
                >
                  ◇ Carga frágil
                </button>
                <button
                  type="button"
                  className={`${styles.requirementPill} ${isOversized ? styles.requirementPillActive : ""}`}
                  onClick={() => setIsOversized(!isOversized)}
                >
                  ↔ Sobredimensionada
                </button>
              </div>

              {requiresRefrigeration && (
                <div className={styles.tempRangeRow}>
                  <span style={{ fontSize: "0.74rem", fontWeight: 700, color: "#0c6396" }}>
                    Rango de temperatura requerido:
                  </span>
                  <input
                    type="number"
                    className={styles.tempInput}
                    value={tempMin}
                    onChange={(e) => setTempMin(e.target.value)}
                  />
                  <span style={{ fontSize: "0.74rem", color: "#0c6396" }}>°C a</span>
                  <input
                    type="number"
                    className={styles.tempInput}
                    value={tempMax}
                    onChange={(e) => setTempMax(e.target.value)}
                  />
                  <span style={{ fontSize: "0.74rem", color: "#0c6396" }}>°C</span>
                </div>
              )}

              {isHazardous && (
                <div className={`${styles.requirementAlert} ${styles.hazardAlert}`}>
                  ⚠️ <strong>Aviso para matching:</strong> El agente WebMCP filtrará exclusivamente transportistas certificados para transporte de mercancías peligrosas (Hazmat).
                </div>
              )}

              <Field label="Instrucciones especiales de manipuleo (opcional)" wide>
                <textarea
                  rows={3}
                  readOnly={readOnly}
                  className={styles.notesTextarea}
                  placeholder="ej. No apilar. Manipular únicamente con montacargas y mantener protegido de humedad."
                  value={form.operationalNotes}
                  onChange={(event) => update("operationalNotes", event.target.value)}
                />
              </Field>
            </div>
          </> : null}

          {step === 3 ? <>
            <FormHeading id="step-title-3" title="Programación y preferencias" description="Configura la ventana de transporte, presupuesto y documentación para el despacho." />
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
            <FormHeading
              id="step-title-4"
              title="Revisión de solicitud"
              description="Verifica los parámetros operativos antes de transferir el control al agente WebMCP."
            />
            <div className={styles.checklistGrid}>
              <div className={styles.checklistItem}>
                <span className={styles.checklistIcon}><Check size={16} aria-hidden="true" /></span>
                <div>
                  <span className={styles.checklistLabel}>Organización y Solicitante</span>
                  <strong>{form.organization} · {form.requester}</strong>
                  <small>Empresa verificada · Modo ROAD FTL</small>
                </div>
              </div>
              <div className={styles.checklistItem}>
                <span className={styles.checklistIcon}><Check size={16} aria-hidden="true" /></span>
                <div>
                  <span className={styles.checklistLabel}>Ruta autorizada</span>
                  <strong>{originCountryData.flag} {form.originCity}, {form.originCountry} → {destCountryData.flag} {form.destinationCity}, {form.destinationCountry}</strong>
                  <small>{form.originCountry !== form.destinationCountry ? "Corredor Internacional" : "Ruta Nacional"}</small>
                </div>
              </div>
              <div className={styles.checklistItem}>
                <span className={styles.checklistIcon}><Check size={16} aria-hidden="true" /></span>
                <div>
                  <span className={styles.checklistLabel}>Carga y cubicaje</span>
                  <strong>{form.quantity ? `${form.quantity} bultos · ` : ""}{displayNumber(totals.weightKg, " kg")}{totals.volumeM3 !== null ? ` · ${totals.volumeM3.toLocaleString("es-PE", { maximumFractionDigits: 2 })} m³` : ""}</strong>
                  <small>{form.cargoCategory} · {form.entryMethod.toLowerCase()}</small>
                </div>
              </div>
              <div className={styles.checklistItem}>
                <span className={styles.checklistIcon}><Check size={16} aria-hidden="true" /></span>
                <div>
                  <span className={styles.checklistLabel}>Requisitos de manipuleo</span>
                  <strong>
                    {[
                      requiresRefrigeration ? `❄ Reefer (${tempMin}°C a ${tempMax}°C)` : null,
                      isHazardous ? "⚠ Hazmat" : null,
                      isFragile ? "◇ Carga frágil" : null,
                      isOversized ? "↔ Sobredimensionada" : null,
                    ].filter(Boolean).join(" · ") || "Estándar (Sin requisitos especiales)"}
                  </strong>
                  <small>Filtro de compatibilidad de carriers</small>
                </div>
              </div>
              <div className={styles.checklistItem}>
                <span className={styles.checklistIcon}><Check size={16} aria-hidden="true" /></span>
                <div>
                  <span className={styles.checklistLabel}>Ventana de transporte</span>
                  <strong>{form.pickupMode === "ASAP" ? "ASAP (Recolección inmediata)" : `${displayDate(form.pickupWindowStart)} → ${displayDate(form.pickupWindowEnd)}`}</strong>
                  <small>Deadline: {displayDate(form.deliveryDeadline)}</small>
                </div>
              </div>
              <div className={styles.checklistItem}>
                <span className={styles.checklistIcon}><Check size={16} aria-hidden="true" /></span>
                <div>
                  <span className={styles.checklistLabel}>Estrategia de Decisión</span>
                  <strong>{form.strategy} (Motor BALANCED)</strong>
                  <small>Presupuesto: {form.budgetMaxUsd === null ? "Sin límite" : `${form.currency} ${form.budgetMaxUsd.toLocaleString("en-US")}`}</small>
                </div>
              </div>
              <div className={styles.checklistItem}>
                <span className={styles.checklistIcon}><Check size={16} aria-hidden="true" /></span>
                <div>
                  <span className={styles.checklistLabel}>Documentos listos</span>
                  <strong>{form.documents.length ? form.documents.join(", ") : "Sin documentos adicionales"}</strong>
                  <small>Requeridos para cruce de frontera</small>
                </div>
              </div>
            </div>

            {submitting ? (
              <div className={styles.searchingState} role="status" aria-live="polite">
                <span className={styles.searchingIcon}><LoaderCircle className={styles.spinner} size={22} aria-hidden="true" /></span>
                <span>
                  <strong>Orquestando con WebMCP</strong>
                  <small>Estamos consultando los transportistas registrados en tiempo real. Serás dirigido al despacho cuando termine la evaluación.</small>
                </span>
              </div>
            ) : (
              <div className={styles.readyNotice}>
                <FileCheck2 size={20} aria-hidden="true" />
                <span>
                  <strong>{dispatchBlockReason ? "Dispatch bloqueado" : "CargoMesh está listo para buscar capacidad logística compatible."}</strong>
                  <small>{dispatchBlockReason ?? "Al iniciar orquestación, el agente WebMCP visitará cada carrier para validar cobertura, capacidad y cotización."}</small>
                </span>
              </div>
            )}
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
                ? <><LoaderCircle className={styles.spinner} size={17} aria-hidden="true" /> Orquestando con WebMCP…</>
                : saving
                  ? "Guardando…"
                  : step === steps.length - 1
                    ? "Iniciar orquestación"
                    : "Continuar"}
              {submitting ? null : <ArrowRight size={17} aria-hidden="true" />}
            </button>
          </footer>
        </section>

        <aside className={styles.summaryCard} aria-label="Resumen de la solicitud">
          <span className={styles.eyebrow}>{readOnly ? "ViewModel persistido (Cerrado)" : isCleanMode ? "Borrador v1 (Nuevo)" : `Borrador v${form.draftVersion}`}</span>
          <h2>{form.requestId}</h2>
          <dl>
            <div>
              <dt>Corredor en vivo</dt>
              <dd>
                <strong>{originCountryData.flag} {form.originCity || "Origen"}, {form.originCountry}</strong>
                <br />
                <small style={{ color: "#2b7d72", fontWeight: 750 }}>
                  {form.originCountry !== form.destinationCountry ? "↓ Internacional" : "↓ Nacional"}
                </small>
                <br />
                <strong>{destCountryData.flag} {form.destinationCity || "Destino"}, {form.destinationCountry}</strong>
              </dd>
            </div>
            <div>
              <dt>Carga en vivo</dt>
              <dd>
                <strong>{displayNumber(totals.weightKg, " kg")}</strong> · {totals.volumeM3 === null ? "Volumen n/d" : `${totals.volumeM3.toLocaleString("es-PE", { maximumFractionDigits: 2 })} m³`}
                <div style={{ color: "#687573", fontSize: "0.68rem", marginTop: "0.15rem" }}>
                  {form.quantity ? `${form.quantity} bultos · ` : ""}{form.cargoCategory}
                </div>
                <div style={{ marginTop: "0.3rem" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", background: "#edf8f4", color: "#185c55", padding: "0.2rem 0.5rem", border: "1px solid #c2e5d9", borderRadius: "0.4rem", fontSize: "0.68rem", fontWeight: 800 }}>
                    🚚 FTL · Carga dedicada (ROAD)
                  </span>
                </div>
              </dd>
            </div>
            {(requiresRefrigeration || isHazardous || isFragile || isOversized) ? (
              <div>
                <dt>Requisitos de manejo</dt>
                <dd style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem", marginTop: "0.25rem" }}>
                  {requiresRefrigeration && (
                    <span style={{ background: "#e1f3fd", color: "#0c6396", padding: "0.2rem 0.45rem", borderRadius: "0.35rem", fontSize: "0.65rem", fontWeight: 800 }}>
                      ❄ Reefer ({tempMin}°C a {tempMax}°C)
                    </span>
                  )}
                  {isHazardous && (
                    <span style={{ background: "#fef3d6", color: "#8a5700", padding: "0.2rem 0.45rem", borderRadius: "0.35rem", fontSize: "0.65rem", fontWeight: 800 }}>
                      ⚠ Hazmat
                    </span>
                  )}
                  {isFragile && (
                    <span style={{ background: "#f5eefe", color: "#5b21b6", padding: "0.2rem 0.45rem", borderRadius: "0.35rem", fontSize: "0.65rem", fontWeight: 800 }}>
                      ◇ Frágil
                    </span>
                  )}
                  {isOversized && (
                    <span style={{ background: "#fae8ff", color: "#86198f", padding: "0.2rem 0.45rem", borderRadius: "0.35rem", fontSize: "0.65rem", fontWeight: 800 }}>
                      ↔ Sobredimensionada
                    </span>
                  )}
                </dd>
              </div>
            ) : null}
            <div>
              <dt>Presupuesto en vivo</dt>
              <dd>
                <strong style={{ color: "#185c55", fontSize: "0.85rem" }}>
                  {form.budgetMaxUsd === null ? "Sin límite presupuestario" : `${form.currency} ${form.budgetMaxUsd.toLocaleString("en-US")}`}
                </strong>
              </dd>
            </div>
            <div>
              <dt>Programación</dt>
              <dd>{form.pickupMode === "ASAP" ? "⚡ Recolección inmediata (ASAP)" : "📅 Ventana programada"}</dd>
            </div>
            <div>
              <dt>Documentos listos</dt>
              <dd>{form.documents.length} documento(s) seleccionado(s)</dd>
            </div>
            <div>
              <dt>Estrategia de Decisión</dt>
              <dd>
                <strong>{form.strategy}</strong>
                <br />
                <small style={{ color: "#687573" }}>25% Costo · 25% SLA · 20% Tiempo · 30% Capacidad</small>
              </dd>
            </div>
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

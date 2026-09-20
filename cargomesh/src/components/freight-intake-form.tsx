"use client";

import {
  ArrowLeft, ArrowRight, Box, Boxes, Building2, CalendarClock, Check,
  FileCheck2, Layers, LoaderCircle, MapPin, PackageCheck, ShieldAlert, ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useLocale } from "@/features/i18n/locale-provider";

import type { FreightIntakeModel } from "@/features/freight-ui/view-models";
import {
  mapFreightRequestIntakeToForm,
} from "@/features/freight-requests/intake-ui-adapter";
import {
  buildHonoFreightRequestInputFromForm,
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
import { createCanonicalFreightRequestDraftModel } from "@/features/freight-ui/ui-fixtures";
import {
  createFreightRequest,
  FreightRequestHonoClientError,
  submitFreightRequest,
} from "@/server/hono/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import styles from "./freight-intake-form.module.css";

const steps = [
  { label: "Contexto y ruta", labelEn: "Context & route", icon: MapPin },
  { label: "Carga", labelEn: "Cargo", icon: Boxes }, { label: "Programación", labelEn: "Schedule", icon: CalendarClock },
  { label: "Revisión", labelEn: "Review", icon: PackageCheck },
];
const documentOptions = [
  { code: "commercial_invoice", label: "Factura comercial", labelEn: "Commercial invoice" },
  { code: "packing_list", label: "Lista de empaque (Packing list)", labelEn: "Packing list" },
  { code: "certificate_of_origin", label: "Certificado de origen", labelEn: "Certificate of origin" },
  { code: "technical_datasheet", label: "Ficha técnica", labelEn: "Technical datasheet" },
];

export const DEMO_OPERATORS = [
  { id: "e0000000-0000-0000-0000-000000000001", name: "CargoMesh Demo Operator", role: "Supervisor de Operaciones", roleEn: "Operations Supervisor" },
  { id: "e0000000-0000-0000-0000-000000000002", name: "Ing. Carlos Mendoza", role: "Jefe de Despacho & Logística", roleEn: "Dispatch & Logistics Lead" },
  { id: "e0000000-0000-0000-0000-000000000003", name: "Ana Lucía Torres", role: "Coordinadora de Comercio Exterior", roleEn: "Cross-border Trade Coordinator" },
  { id: "e0000000-0000-0000-0000-000000000004", name: "Ing. Roberto Huamán", role: "Supervisor de Faena & Carga", roleEn: "Cargo Operations Supervisor" },
];

export const DEMO_CARGO_PROFILES = [
  {
    id: "custom",
    name: "✍️ Personalizado (Ingreso manual sin plantilla)",
    nameEn: "✍️ Custom (manual entry without a template)",
    categoryCode: "GENERAL",
    categoryName: "Carga General",
    categoryNameEn: "General cargo",
    description: "Carga general paletizada",
    descriptionEn: "Palletized general cargo",
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
    nameEn: "📦 Mining parts and machinery (PALLETS · 10 pallets at 800 kg each)",
    categoryCode: "MACHINERY",
    categoryName: "Maquinaria",
    categoryNameEn: "Machinery",
    description: "Repuestos y maquinaria minera",
    descriptionEn: "Mining parts and machinery",
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
    nameEn: "🍇 Blueberries and fresh reefer fruit (PALLETS · 20 pallets at 800 kg each)",
    categoryCode: "AGRICULTURAL",
    categoryName: "Agrícola",
    categoryNameEn: "Agricultural",
    description: "Arándanos y fruta fresca de exportación",
    descriptionEn: "Export blueberries and fresh fruit",
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
    nameEn: "🏗️ Bagged cement and clinker (PALLETS · 24 pallets at 1,000 kg each)",
    categoryCode: "CONSTRUCTION",
    categoryName: "Construcción",
    categoryNameEn: "Construction",
    description: "Cemento y materiales de construcción embolsados",
    descriptionEn: "Bagged cement and construction materials",
    entryMethod: "PALLETS",
    quantity: 24,
    unitWeightKg: 1000,
    unitsPerEntry: 1,
    lengthCm: 120,
    widthCm: 100,
    heightCm: 160,
    totalWeightKg: 24000,
  },
];

function nullableNumber(value: number | null) { return value ?? ""; }
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
  const { localeTag, t } = useLocale();
  const displayNumber = useCallback((value: number | null, suffix = "") => (
    value === null ? t("No registrado", "Not recorded") : `${value.toLocaleString(localeTag)}${suffix}`
  ), [localeTag, t]);
  const displayDate = useCallback((value: string) => (
    value ? value.replace("T", " ").replace(".000Z", " UTC") : t("No aplica", "Not applicable")
  ), [t]);
  const [step, setStep] = useState(0);
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
  const [creatingDraft, setCreatingDraft] = useState(false);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [webMcpReady, setWebMcpReady] = useState(false);
  const [recommendationRegistrationError, setRecommendationRegistrationError] = useState<string | null>(null);
  const [draftReady, setDraftReady] = useState(initialValue.source !== "persisted");
  const [draftLoadError, setDraftLoadError] = useState<string | null>(null);
  const isEditable = form.status === "DRAFT";
  const readOnly = !isEditable;
  const totals = useMemo(() => getDisplayedTotals(form), [form]);
  const [originCoords, setOriginCoords] = useState(defaultCleanMode ? "" : "-12.0464, -77.0428");
  const [destCoords, setDestCoords] = useState(defaultCleanMode ? "" : "-33.4489, -70.6693");
  const requiresRefrigeration = form.requiresRefrigeration === true;
  const tempMin = form.temperatureMinC ?? "";
  const tempMax = form.temperatureMaxC ?? "";
  const isHazardous = form.isHazardous === true;
  const isFragile = form.isFragile === true;
  const isOversized = form.isOversized === true;
  const [palletPreset, setPalletPreset] = useState<"standard" | "euro" | "custom">("standard");
  const [hasBudgetLimit, setHasBudgetLimit] = useState(form.budgetMaxUsd !== null);
  const [localBudgetNotice, setLocalBudgetNotice] = useState<string | null>(null);
  const localizedCargoCategory = ({
    MACHINERY: t("Maquinaria", "Machinery"),
    GENERAL: t("Carga General", "General cargo"),
    AGRICULTURAL: t("Agrícola", "Agricultural"),
    CONSTRUCTION: t("Construcción", "Construction"),
  } as Record<string, string>)[form.cargoCategoryCode] ?? form.cargoCategory;

  const estimationContext = form.originCity && form.destinationCity
    ? `${form.originCity} ➔ ${form.destinationCity} · ${displayNumber(totals.weightKg, " kg")}`
    : t("Completa ruta y peso para mejorar la referencia", "Complete the route and weight for a better reference");

  function handleEstimateBudget() {
    setHasBudgetLimit(true);
    const weight = totals.weightKg || form.totalWeightKg || 8000;
    const corridorAdjustment = form.originCountry !== form.destinationCountry ? 350 : 120;
    const suggested = Math.round(600 + weight * 0.12 + corridorAdjustment);
    update("budgetMaxUsd", suggested);
    setLocalBudgetNotice(
      t(
        `Estimación local orientativa: USD ${suggested.toLocaleString("en-US")} según peso y tipo de corredor. Las cotizaciones provider se obtienen al iniciar el dispatch WebMCP.`,
        `Indicative local estimate: USD ${suggested.toLocaleString("en-US")} based on weight and corridor type. Provider quotes are retrieved when WebMCP dispatch starts.`,
      )
    );
  }

  function setRequiresRefrigeration(value: boolean) {
    if (readOnly) return;
    setForm((current) => ({
      ...current,
      requiresRefrigeration: value,
      temperatureMinC: value ? (current.temperatureMinC ?? -5) : null,
      temperatureMaxC: value ? (current.temperatureMaxC ?? 2) : null,
    }));
  }

  function setTempMin(value: string) {
    if (readOnly) return;
    setForm((current) => ({
      ...current,
      temperatureMinC: value === "" ? null : Number(value),
    }));
  }

  function setTempMax(value: string) {
    if (readOnly) return;
    setForm((current) => ({
      ...current,
      temperatureMaxC: value === "" ? null : Number(value),
    }));
  }

  function setIsHazardous(value: boolean) {
    if (!readOnly) setForm((current) => ({ ...current, isHazardous: value }));
  }

  function setIsFragile(value: boolean) {
    if (!readOnly) setForm((current) => ({ ...current, isFragile: value }));
  }

  function setIsOversized(value: boolean) {
    if (!readOnly) setForm((current) => ({ ...current, isOversized: value }));
  }

  function handleLoadCanonicalScenario() {
    setForm(createCanonicalFreightRequestDraftModel());
    setStep(0);
    setOriginCoords("-12.0464, -77.0428");
    setDestCoords("-33.4489, -70.6693");
    setPalletPreset("standard");
    setHasBudgetLimit(true);
    setSubmitError(null);
    setSaveNotice(t(
      "Escenario canónico FR-1042 cargado: Callao ➔ Santiago, 10 pallets.",
      "Canonical FR-1042 scenario loaded: Callao ➔ Santiago, 10 pallets.",
    ));
    if (typeof window !== "undefined" && window.history) {
      window.history.replaceState({}, "", "/freight-request/new");
    }
  }

  const loadCanonicalDraft = useCallback(async (signal: AbortSignal) => {
    if (!initialValue.freightRequestId) return;
    const draft = await fetchFreightRequestDraft(initialValue.freightRequestId, signal);
    setForm((current) => applyFreightRequestDraftToIntake(current, draft));
    setDraftLoadError(null);
    setDraftReady(true);
  }, [initialValue.freightRequestId]);

  useEffect(() => {
    if (initialValue.source !== "persisted" || !initialValue.freightRequestId) return;
    const controller = new AbortController();
    void loadCanonicalDraft(controller.signal).catch((error) => {
      if (controller.signal.aborted) return;
      setDraftReady(false);
      setDraftLoadError(error instanceof Error ? error.message : t("No fue posible cargar el borrador vigente desde D1-01.", "The current draft could not be loaded from D1-01."));
    });
    return () => controller.abort();
  }, [initialValue.source, initialValue.freightRequestId, loadCanonicalDraft, t]);

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
    const targetId = form.freightRequestId || initialValue.freightRequestId;
    if (!targetId) return;
    try {
      const draft = await fetchFreightRequestDraft(targetId, signal);
      setForm((current) => ({
        ...applyFreightRequestDraftToIntake(current, draft),
        requestId: draft.requestCode,
      }));
      setDraftLoadError(null);
      setDraftReady(true);
      setSaveNotice(t(`Borrador recargado tras cambio en el servidor (v${draft.draftVersion}). Consulta sugerencias nuevamente.`, `Draft reloaded after a server change (v${draft.draftVersion}). Request recommendations again.`));
    } catch {
      // Background stale notification shouldn't erase user's active inputs
    }
  }, [form.freightRequestId, initialValue.freightRequestId, t]);

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

  const handleCreateDraft = useCallback(async (signal?: AbortSignal) => {
    if (form.source !== "new-draft") return form;
    setCreatingDraft(true);
    setSubmitError(null);
    setSaveNotice(null);
    try {
      const abortSignal = signal ?? new AbortController().signal;
      const input = buildHonoFreightRequestInputFromForm(form);
      const created = await createFreightRequest(input, abortSignal);
      if (created.status !== "DRAFT" || created.draftVersion !== 1) {
        throw new FreightRequestHonoClientError(
          "INVALID_CANONICAL_INTAKE",
          "La creación Hono V2 debe devolver un borrador DRAFT con draft_version = 1.",
        );
      }
      const updatedModel = mapFreightRequestIntakeToForm(created);
      setForm(updatedModel);
      setDraftReady(true);
      setDraftLoadError(null);
      setSaveNotice(t(`Borrador creado exitosamente: ${updatedModel.requestId} (v${updatedModel.draftVersion}).`, `Draft created successfully: ${updatedModel.requestId} (v${updatedModel.draftVersion}).`));
      if (typeof window !== "undefined" && window.history) {
        const url = new URL(window.location.href);
        url.searchParams.set("requestCode", updatedModel.requestId);
        window.history.replaceState({}, "", url.toString());
      }
      return updatedModel;
    } catch (error) {
      const message = error instanceof FreightRequestHonoClientError
        ? error.message
        : error instanceof Error
          ? error.message
          : t("No fue posible crear el borrador en el servidor.", "The draft could not be created on the server.");
      setSubmitError(message);
      throw error;
    } finally {
      setCreatingDraft(false);
    }
  }, [form, t]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step < steps.length - 1) {
      setStep((current) => current + 1);
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    setSaveNotice(null);
    try {
      let currentDraft = form;
      if (currentDraft.source === "new-draft") {
        currentDraft = await handleCreateDraft();
      }

      if (!currentDraft.freightRequestId || currentDraft.draftVersion < 1) {
        throw new FreightRequestHonoClientError(
          "INVALID_CANONICAL_INTAKE",
          "El servidor no devolvió un borrador válido para enviar.",
        );
      }

      const submitted = await submitFreightRequest(
        currentDraft.freightRequestId,
        currentDraft.draftVersion,
      );
      const submittedModel = mapFreightRequestIntakeToForm(submitted);
      setForm(submittedModel);
      setDraftReady(true);
      setSaveNotice(t(
        `Solicitud ${submittedModel.requestId} enviada correctamente (PENDING, v${submittedModel.draftVersion}).`,
        `Request ${submittedModel.requestId} submitted successfully (PENDING, v${submittedModel.draftVersion}).`,
      ));
    } catch (error) {
      if (error instanceof FreightRequestHonoClientError && error.code === "STALE_DRAFT") {
        setSubmitError(t(
          "No se pudo enviar: otra sesión modificó este borrador. Recarga la solicitud y revisa la versión antes de reintentar.",
          "The request could not be submitted because another session modified this draft. Reload it and review the version before retrying.",
        ));
      } else {
        setSubmitError(error instanceof Error
          ? error.message.replace(/^INVALID_ARGUMENT:\s*/, "")
          : t("No fue posible enviar la solicitud.", "The request could not be submitted."));
      }
    } finally {
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
          <span className={styles.eyebrow}>{t("B-02 · Intake de carga", "B-02 · Freight intake")}</span>
          <h1>{t("Nueva solicitud de transporte", "New freight request")}</h1>
          <p>
            {form.source === "new-draft"
              ? t("Nuevo borrador sin persistir. Completa los datos y créalo para recibir su código y versión canónicos del servidor.", "New unsaved draft. Complete the details and create it to receive its canonical server code and version.")
              : form.source === "persisted"
                ? isEditable
                  ? t("Borrador editable activo. Captura tus datos operativos o aplica sugerencias WebMCP.", "Active editable draft. Enter operational data or apply WebMCP recommendations.")
                  : t("Revisa la solicitud persistida antes de iniciar la evaluación de providers.", "Review the persisted request before starting provider evaluation.")
                : t("Escenario fixture declarado para regresión visual; no inicia operaciones reales.", "Declared visual-regression fixture; it does not start real operations.")}
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.45rem" }}>
          <Badge
            className={styles.draftBadge}
            variant={form.status === "DRAFT" ? "draft" : form.status === "PENDING" ? "pending" : "confirmed"}
          >
            <ShieldCheck size={16} aria-hidden="true" />
            {form.source === "new-draft"
              ? t("Nuevo borrador sin persistir", "New unsaved draft")
              : form.source === "persisted"
                ? `${t("Borrador", "Draft")} v${form.draftVersion} (${form.status})`
                : t("Fixture visual", "Visual fixture")}
          </Badge>
          <Button
            type="button"
            variant="secondary"
            className={styles.cleanDraftButton}
            onClick={handleLoadCanonicalScenario}
            disabled={submitting || creatingDraft}
          >
            {t(
              "Cargar Escenario Canónico (Callao ➔ Santiago)",
              "Load Canonical Scenario (Callao ➔ Santiago)",
            )}
          </Button>
        </div>
      </header>

      {form.source === "persisted" && form.status === "DRAFT" && Boolean(form.freightRequestId) ? (
        <>
          <FreightRecommendationWebMcpHost
            onRegistrationChange={handleRegistrationChange}
            onRegistrationError={handleRegistrationError}
          />
          <FreightRecommendationPanel
            form={form}
            draftVersion={form.draftVersion}
            webMcpReady={webMcpReady && draftReady}
            registrationError={draftLoadError ?? recommendationRegistrationError}
            onApply={applyRecommendation}
            onStaleDraft={reloadStaleDraft}
          />
        </>
      ) : null}

      <ol className={styles.stepper} aria-label={t("Progreso del formulario", "Form progress")}>
        {steps.map(({ label, labelEn, icon: Icon }, index) => (
          <li key={label}>
            <Button
              type="button"
              variant="ghost"
              className={`${styles.step} ${index === step ? styles.stepActive : ""} ${index < step ? styles.stepDone : ""}`}
              aria-current={index === step ? "step" : undefined}
              onClick={() => setStep(index)}
              disabled={submitting || creatingDraft}
            >
              <span>{index < step ? <Check size={16} aria-hidden="true" /> : <Icon size={16} aria-hidden="true" />}</span>
              <small>{t("Paso", "Step")} {index + 1}</small>
              <strong>{t(label, labelEn)}</strong>
            </Button>
          </li>
        ))}
      </ol>

      <form className={styles.formLayout} onSubmit={submit} aria-busy={submitting || creatingDraft}>
        <section className={styles.formCard} aria-labelledby={`step-title-${step}`}>
          {step === 0 ? <>
            <FormHeading
              id="step-title-0"
              title={t("Contexto de la solicitud", "Request context")}
              description={t("Confirma la organización, responsable de la solicitud y perfil operativo aplicable.", "Confirm the organization, request owner, and applicable operating profile.")}
            />

            {/* SUB-BLOQUE 1: CONTEXTO DE IDENTIDAD */}
            <div className={styles.subSectionCard}>
              <div className={styles.subSectionHeader}>
                <span className={styles.subSectionBadge}>
                  <Building2 size={14} /> {t("1. Contexto de identidad", "1. Identity context")}
                </span>
                <small>{t("Datos del emisor verificados por sesión", "Sender details verified by the active session")}</small>
              </div>

              <div className={styles.contextGrid}>
                <div className={styles.contextInfoCard}>
                  <span className={styles.contextLabel}>{t("Organización", "Organization")}</span>
                  <span className={styles.contextValue}>
                    {form.organization}
                    <span className={styles.rolePill}>{t("Verificada", "Verified")}</span>
                  </span>
                  <span className={styles.contextSub}>ACME Mining Corporation</span>
                </div>

                <div className={styles.contextInfoCard}>
                  <span className={styles.contextLabel}>{t("Solicitado por", "Requested by")}</span>
                  <span className={styles.contextValue}>
                    CargoMesh Demo Operator
                    <span className={styles.rolePill}>{t("Solicitante", "Requester")}</span>
                  </span>
                  <span className={styles.contextSub}>demo.operator@cargomesh.test</span>
                </div>
              </div>

              <Field label={t("Supervisor responsable", "Responsible supervisor")} wide>
                {readOnly ? (
                  <Input value={form.requester || "CargoMesh Demo Operator — Supervisor de Operaciones"} readOnly />
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
                        {op.name} — {t(op.role, op.roleEn)}
                      </option>
                    ))}
                  </select>
                )}
                <small style={{ color: "#687573", fontSize: "0.68rem", marginTop: "0.25rem", display: "block" }}>
                  {t("Opcional · Recibe las excepciones que requieran revisión humana.", "Optional · Receives exceptions that require human review.")}
                </small>
              </Field>
            </div>

            {/* SUB-BLOQUE 2: CONFIGURACIÓN PREDEFINIDA */}
            <div className={styles.subSectionCard} style={{ marginTop: "1rem" }}>
              <div className={styles.subSectionHeader}>
                <span className={styles.subSectionBadge}>
                  <Boxes size={14} /> {t("2. Configuración predefinida", "2. Preset configuration")}
                </span>
                <small>{t("Plantillas operativas para acelerar la carga de datos", "Operational templates to speed up data entry")}</small>
              </div>

              <Field label={t("Perfil de carga", "Cargo profile")} wide>
                {readOnly ? (
                  <Input value={form.cargoProfile ? localizedCargoCategory : t("Personalizado", "Custom")} readOnly />
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
                        cargoDescription: profile.description,
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
                        {t(p.name, p.nameEn)}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
              <p className={styles.budgetHelpText} style={{ margin: "0.4rem 0 0" }}>
                {form.cargoProfile
                  ? t(`✓ Perfil aplicado: "${form.cargoProfile}". Preconfigura automáticamente categoría, presentación y dimensiones en el Paso 3.`, `✓ Applied profile: "${form.cargoProfile}". Category, packaging, and dimensions are preconfigured in Step 3.`)
                  : t("Al seleccionar un perfil estándar, CargoMesh preconfigurará categoría, embalaje y cubicaje en el Paso 3.", "Selecting a standard profile preconfigures category, packaging, and volume details in Step 3.")}
              </p>
            </div>
          </> : null}

          {step === 0 ? <>
            <FormHeading
              id="step-title-1"
              title={t("Origen y destino", "Origin and destination")}
              description={t("Define los puntos de recojo y entrega de la carga.", "Define the cargo pickup and delivery points.")}
            />

            {/* SECCIÓN 1: DATOS DEL ORIGEN (RECOJO) */}
            <div className={styles.subSectionCard}>
              <div className={styles.subSectionHeader}>
                <span className={styles.subSectionBadge}>
                  <MapPin size={14} /> {t("1. Origen (Recojo)", "1. Origin (Pickup)")}
                </span>
                <small>{t("Punto de partida", "Starting point")}</small>
              </div>
              <div className={styles.fieldGrid}>
                <Field label={t("País de origen", "Origin country")}>
                  {readOnly ? (
                    <Input value={`${originCountryData.flag} ${originCountryData.name} (${originCountryData.code})`} readOnly />
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
                <Field label={t("Departamento / Región", "State / Region")}>
                  {readOnly ? (
                    <Input value={form.originRegion || t("No registrado", "Not recorded")} readOnly />
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
                <Field label={t("Ciudad", "City")}>
                  {readOnly ? (
                    <Input value={form.originCity} readOnly />
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
                <Field label={t("Dirección de recojo", "Pickup address")}>
                  <Input
                    readOnly={readOnly}
                    placeholder={t("ej. Av. Néstor Gambetta 100, Almacén Central", "e.g. 100 Néstor Gambetta Ave., Central Warehouse")}
                    value={form.originAddress}
                    onChange={(event) => update("originAddress", event.target.value)}
                  />
                </Field>
              </div>

              <details className={styles.advancedRouteSection}>
                <summary><span>{t("👤 Datos operativos de contacto y ubicación (opcional) ▾", "👤 Operational contact and location details (optional) ▾")}</span></summary>
                <div className={styles.fieldGrid}>
                  <Field label={t("Contacto de recojo", "Pickup contact")}>
                    <Input
                      readOnly={readOnly}
                      placeholder={t("ej. Ana Pérez", "e.g. Ana Pérez")}
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
                  <Field label={t("Teléfono de recojo", "Pickup phone")}>
                    <div className={styles.phoneInputGroup}>
                      <span className={styles.dialBadge}>{getCountryDialCode(form.originCountry)}</span>
                      <Input
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
                  <Field label={t("Ubicación precisa (Lat, Lng) — opcional", "Precise location (Lat, Lng) — optional")} wide>
                    <Input
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
                  <MapPin size={14} /> {t("2. Destino (Entrega)", "2. Destination (Delivery)")}
                </span>
                <small>{t("Punto de llegada", "Arrival point")}</small>
              </div>
              <div className={styles.fieldGrid}>
                <Field label={t("País de destino", "Destination country")}>
                  {readOnly ? (
                    <Input value={`${destCountryData.flag} ${destCountryData.name} (${destCountryData.code})`} readOnly />
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
                <Field label={t("Departamento / Región", "State / Region")}>
                  {readOnly ? (
                    <Input value={form.destinationRegion || t("No registrado", "Not recorded")} readOnly />
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
                <Field label={t("Ciudad", "City")}>
                  {readOnly ? (
                    <Input value={form.destinationCity} readOnly />
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
                <Field label={t("Dirección de entrega", "Delivery address")}>
                  <Input
                    readOnly={readOnly}
                    placeholder={t("ej. Av. Logística 200, Centro de Distribución", "e.g. 200 Logistics Ave., Distribution Center")}
                    value={form.destinationAddress}
                    onChange={(event) => update("destinationAddress", event.target.value)}
                  />
                </Field>
              </div>

              <details className={styles.advancedRouteSection}>
                <summary><span>{t("👤 Datos operativos de contacto y ubicación (opcional) ▾", "👤 Operational contact and location details (optional) ▾")}</span></summary>
                <div className={styles.fieldGrid}>
                  <Field label={t("Empresa de entrega", "Receiving company")}>
                    <Input
                      readOnly={readOnly}
                      placeholder={t("ej. Destino Minero S.A.", "e.g. Mining Destination Inc.")}
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
                  <Field label={t("Contacto de entrega", "Delivery contact")}>
                    <Input
                      readOnly={readOnly}
                      placeholder={t("ej. Diego Ramos", "e.g. Diego Ramos")}
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
                  <Field label={t("Teléfono de entrega", "Delivery phone")}>
                    <div className={styles.phoneInputGroup}>
                      <span className={styles.dialBadge}>{getCountryDialCode(form.destinationCountry)}</span>
                      <Input
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
                  <Field label={t("Ubicación precisa (Lat, Lng) — opcional", "Precise location (Lat, Lng) — optional")}>
                    <Input
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
              <Field label={t("Instrucciones de ruta (opcional)", "Route instructions (optional)")} wide>
                <Input
                  readOnly={readOnly}
                  placeholder={t("ej. Indicaciones para aduana o almacén", "e.g. Customs or warehouse instructions")}
                  value={form.operationalNotes}
                  onChange={(event) => update("operationalNotes", event.target.value)}
                />
              </Field>
            </div>
          </> : null}

          {step === 1 ? <>
            <FormHeading
              id="step-title-2"
              title={t("Características de la carga", "Cargo characteristics")}
              description={t("Define la composición y requisitos operativos del envío.", "Define the shipment composition and operating requirements.")}
            />

            {/* BANNER DE PERFIL APLICADO */}
            {form.cargoProfile ? (
              <div className={styles.profileBanner}>
                <div className={styles.profileBannerContent}>
                  <span className={styles.profileBannerBadge}>
                    <Check size={13} aria-hidden="true" /> {t("Perfil aplicado", "Profile applied")}
                  </span>
                  <strong>{localizedCargoCategory} · {form.organization}</strong>
                </div>
                <Button
                  type="button"
                  className={styles.profileChangeBtn}
                  onClick={() => setStep(0)}
                >
                  {t("Cambiar en Paso 1", "Change in Step 1")}
                </Button>
              </div>
            ) : null}

            {/* BLOQUE 1: CLASIFICACIÓN DE LA CARGA */}
            <div className={styles.subSectionCard} style={{ marginTop: "0.75rem" }}>
              <div className={styles.subSectionHeader}>
                <span className={styles.subSectionBadge}>
                  <Layers size={14} /> {t("1. Clasificación logística y comercial", "1. Logistics and commercial classification")}
                </span>
                <div className={styles.badgeGroup} style={{ margin: 0 }}>
                  <span className={styles.badgeItem}>🚛 ROAD</span>
                  <span className={styles.badgeItem}>📦 FTL · {t("Carga dedicada", "Dedicated load")}</span>
                </div>
              </div>
              <div className={styles.fieldGrid}>
                <Field label={t("Categoría logística", "Logistics category")}>
                  {readOnly ? (
                    <Input value={localizedCargoCategory} readOnly />
                  ) : (
                    <select
                      value={form.cargoCategoryCode}
                      onChange={(event) => {
                        const code = event.target.value as OfficialCargoCategoryCode;
                        const labelMap: Record<OfficialCargoCategoryCode, string> = {
                          MACHINERY: "Maquinaria",
                          GENERAL: "Carga General",
                          AGRICULTURAL: "Agrícola",
                          CONSTRUCTION: "Construcción",
                        };
                        setForm((curr) => ({
                          ...curr,
                          cargoCategoryCode: code,
                          cargoCategory: labelMap[code] ?? code,
                        }));
                      }}
                    >
                      <option value="MACHINERY">{t("Maquinaria", "Machinery")} (MACHINERY)</option>
                      <option value="GENERAL">{t("Carga General", "General cargo")} (GENERAL)</option>
                      <option value="AGRICULTURAL">{t("Agrícola", "Agricultural")} (AGRICULTURAL)</option>
                      <option value="CONSTRUCTION">{t("Construcción", "Construction")} (CONSTRUCTION)</option>
                    </select>
                  )}
                </Field>
                <Field label={t("Descripción de la carga", "Cargo description")}>
                  <Input
                    type="text"
                    readOnly={readOnly}
                    placeholder={t("ej. Repuestos y maquinaria minera", "e.g. Mining parts and machinery")}
                    value={form.cargoDescription}
                    onChange={(event) => update("cargoDescription", event.target.value)}
                  />
                </Field>
                <Field label={t("Presentación / embalaje", "Packaging / presentation")} wide>
                  {readOnly ? (
                    <Input value={form.entryMethod} readOnly />
                  ) : (
                    <select
                      value={form.entryMethod}
                      onChange={(event) => update("entryMethod", event.target.value)}
                    >
                      <option value="PALLETS">Pallets ({t("Carga paletizada", "Palletized cargo")})</option>
                      <option value="UNITS">{t("Bultos / Cajas", "Packages / Boxes")}</option>
                      <option value="SACKS">{t("Sacos", "Sacks")}</option>
                      <option value="TOTAL_WEIGHT">{t("Carga suelta / a granel", "Loose / bulk cargo")}</option>
                    </select>
                  )}
                </Field>
              </div>
            </div>

            {/* BLOQUE 2: COMPOSICIÓN FÍSICA */}
            <div className={styles.subSectionCard} style={{ marginTop: "1rem" }}>
              <div className={styles.subSectionHeader}>
                <span className={styles.subSectionBadge}>
                  <Box size={14} /> {t("2. Composición física", "2. Physical composition")}
                </span>
                <small>{form.entryMethod === "TOTAL_WEIGHT" ? t("El peso se registra directamente; el volumen es opcional.", "Weight is entered directly; volume is optional.") : t("El peso y volumen total se calculan automáticamente según el embalaje.", "Total weight and volume are calculated automatically from the packaging.")}</small>
              </div>

              {form.entryMethod === "TOTAL_WEIGHT" ? (
                <>
                  <div className={styles.fieldGrid}>
                    <NumberField
                      label={t("Peso total de la carga (kg)", "Total cargo weight (kg)")}
                      value={form.totalWeightKg}
                      readOnly={readOnly}
                      onChange={(value) => update("totalWeightKg", value ?? 0)}
                    />
                    <Field label={t("Volumen total estimado (m³) — opcional", "Estimated total volume (m³) — optional")}>
                      <Input
                        type="number"
                        step="0.1"
                        readOnly={readOnly}
                        placeholder="ej. 18.0"
                        value={nullableNumber(form.totalVolumeM3)}
                        onChange={(e) => update("totalVolumeM3", e.target.value ? Number(e.target.value) : null)}
                      />
                    </Field>
                    {isOversized && (
                      <div className={styles.fieldWide}>
                        <span style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, color: "#86198f", marginBottom: "0.4rem" }}>
                          {t("Dimensiones máximas de la pieza sobredimensionada (Largo × Ancho × Alto cm)", "Maximum oversized-piece dimensions (Length × Width × Height cm)")}
                        </span>
                        <div className={styles.dimensionRow}>
                          <div className={styles.dimensionInputGroup}>
                            <span>{t("Largo (cm)", "Length (cm)")}</span>
                            <Input
                              type="number"
                              readOnly={readOnly}
                              value={nullableNumber(form.lengthCm)}
                              onChange={(e) => update("lengthCm", e.target.value ? Number(e.target.value) : null)}
                              placeholder="ej. 600"
                            />
                          </div>
                          <div className={styles.dimensionInputGroup}>
                            <span>{t("Ancho (cm)", "Width (cm)")}</span>
                            <Input
                              type="number"
                              readOnly={readOnly}
                              value={nullableNumber(form.widthCm)}
                              onChange={(e) => update("widthCm", e.target.value ? Number(e.target.value) : null)}
                              placeholder="ej. 250"
                            />
                          </div>
                          <div className={styles.dimensionInputGroup}>
                            <span>{t("Alto (cm)", "Height (cm)")}</span>
                            <Input
                              type="number"
                              readOnly={readOnly}
                              value={nullableNumber(form.heightCm)}
                              onChange={(e) => update("heightCm", e.target.value ? Number(e.target.value) : null)}
                              placeholder="ej. 280"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className={styles.totalsCards} aria-live="polite">
                    <div className={styles.totalCard}>
                      <span className={styles.totalCardLabel}>{t("Peso total", "Total weight")}</span>
                      <strong className={styles.totalCardValue}>{displayNumber(totals.weightKg, " kg")}</strong>
                      <small className={styles.totalCardSub}>{t("Informado directamente", "Entered directly")}</small>
                    </div>
                    <div className={styles.totalCard}>
                      <span className={styles.totalCardLabel}>{t("Volumen total", "Total volume")}</span>
                      <strong className={styles.totalCardValue}>
                        {totals.volumeM3 === null
                          ? t("No informado", "Not provided")
                          : `${totals.volumeM3.toLocaleString(localeTag, { maximumFractionDigits: 2 })} m³`}
                      </strong>
                      <small className={styles.totalCardSub}>
                        {totals.volumeM3 === null ? t("Opcional para carga suelta", "Optional for loose cargo") : t("Informado directamente", "Entered directly")}
                      </small>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className={styles.fieldGrid}>
                    <NumberField
                      label={
                        form.entryMethod === "PALLETS"
                          ? t("Número de pallets", "Number of pallets")
                          : form.entryMethod === "SACKS"
                            ? t("Número de sacos", "Number of sacks")
                            : t("Número de bultos / cajas", "Number of packages / boxes")
                      }
                      value={form.quantity}
                      readOnly={readOnly}
                      onChange={(value) => update("quantity", value)}
                    />
                    <NumberField
                      label={
                        form.entryMethod === "PALLETS"
                          ? t("Peso por pallet (kg)", "Weight per pallet (kg)")
                          : form.entryMethod === "SACKS"
                            ? t("Peso por saco (kg)", "Weight per sack (kg)")
                            : t("Peso por bulto (kg)", "Weight per package (kg)")
                      }
                      value={form.unitWeightKg}
                      readOnly={readOnly}
                      onChange={(value) => update("unitWeightKg", value)}
                    />

                    {form.entryMethod === "PALLETS" ? (
                      <div className={styles.fieldWide}>
                        <span style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, color: "#2e4340", marginBottom: "0.35rem" }}>
                          {t("Dimensiones del pallet", "Pallet dimensions")}
                        </span>
                        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.6rem" }}>
                          <Button
                            type="button"
                            className={`${styles.requirementPill} ${palletPreset === "standard" ? styles.requirementPillActive : ""}`}
                            onClick={() => {
                              setPalletPreset("standard");
                              setForm((curr) => ({ ...curr, lengthCm: 120, widthCm: 100 }));
                            }}
                          >
                            {t("Estándar", "Standard")} (120 × 100 cm)
                          </Button>
                          <Button
                            type="button"
                            className={`${styles.requirementPill} ${palletPreset === "euro" ? styles.requirementPillActive : ""}`}
                            onClick={() => {
                              setPalletPreset("euro");
                              setForm((curr) => ({ ...curr, lengthCm: 120, widthCm: 80 }));
                            }}
                          >
                            {t("Europeo", "Euro")} (120 × 80 cm)
                          </Button>
                          <Button
                            type="button"
                            className={`${styles.requirementPill} ${palletPreset === "custom" ? styles.requirementPillActive : ""}`}
                            onClick={() => setPalletPreset("custom")}
                          >
                            {t("Personalizado", "Custom")}
                          </Button>
                        </div>
                        <div className={styles.dimensionRow}>
                          <div className={styles.dimensionInputGroup}>
                            <span>{t("Largo (cm)", "Length (cm)")}</span>
                            <Input
                              type="number"
                              readOnly={readOnly || palletPreset !== "custom"}
                              value={nullableNumber(form.lengthCm ?? 120)}
                              onChange={(e) => update("lengthCm", e.target.value ? Number(e.target.value) : null)}
                              placeholder="120"
                            />
                          </div>
                          <div className={styles.dimensionInputGroup}>
                            <span>{t("Ancho (cm)", "Width (cm)")}</span>
                            <Input
                              type="number"
                              readOnly={readOnly || palletPreset !== "custom"}
                              value={nullableNumber(form.widthCm ?? 100)}
                              onChange={(e) => update("widthCm", e.target.value ? Number(e.target.value) : null)}
                              placeholder="100"
                            />
                          </div>
                          <div className={styles.dimensionInputGroup}>
                            <span>{t("Alto con carga (cm)", "Loaded height (cm)")}</span>
                            <Input
                              type="number"
                              readOnly={readOnly}
                              value={nullableNumber(form.heightCm)}
                              onChange={(e) => update("heightCm", e.target.value ? Number(e.target.value) : null)}
                              placeholder="160"
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className={styles.fieldWide}>
                        <span style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, color: "#2e4340", marginBottom: "0.4rem" }}>
                          {t("Dimensiones por unidad", "Dimensions per unit")} ({form.entryMethod === "SACKS" ? t("opcional para sacos", "optional for sacks") : t("opcional", "optional")})
                        </span>
                        <div className={styles.dimensionRow}>
                          <div className={styles.dimensionInputGroup}>
                            <span>{t("Largo (cm)", "Length (cm)")}</span>
                            <Input
                              type="number"
                              readOnly={readOnly}
                              value={nullableNumber(form.lengthCm)}
                              onChange={(e) => update("lengthCm", e.target.value ? Number(e.target.value) : null)}
                              placeholder="120"
                            />
                          </div>
                          <div className={styles.dimensionInputGroup}>
                            <span>{t("Ancho (cm)", "Width (cm)")}</span>
                            <Input
                              type="number"
                              readOnly={readOnly}
                              value={nullableNumber(form.widthCm)}
                              onChange={(e) => update("widthCm", e.target.value ? Number(e.target.value) : null)}
                              placeholder="100"
                            />
                          </div>
                          <div className={styles.dimensionInputGroup}>
                            <span>{t("Alto (cm)", "Height (cm)")}</span>
                            <Input
                              type="number"
                              readOnly={readOnly}
                              value={nullableNumber(form.heightCm)}
                              onChange={(e) => update("heightCm", e.target.value ? Number(e.target.value) : null)}
                              placeholder="160"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className={styles.totalsCards} aria-live="polite">
                    <div className={styles.totalCard}>
                      <span className={styles.totalCardLabel}>{t("Peso total", "Total weight")}</span>
                      <strong className={styles.totalCardValue}>
                        {form.quantity && form.unitWeightKg ? displayNumber(totals.weightKg, " kg") : "— kg"}
                      </strong>
                      <small className={styles.totalCardSub}>
                        {form.quantity && form.unitWeightKg
                          ? `${form.quantity} ${
                              form.entryMethod === "PALLETS"
                                ? "pallets"
                                : form.entryMethod === "SACKS"
                                  ? t("sacos", "sacks")
                                  : t("bultos", "packages")
                            } × ${form.unitWeightKg} kg`
                          : t("Completa cantidad y peso unitario", "Enter quantity and unit weight")}
                      </small>
                    </div>
                    <div className={styles.totalCard}>
                      <span className={styles.totalCardLabel}>{t("Volumen total", "Total volume")}</span>
                      <strong className={styles.totalCardValue}>
                        {totals.volumeM3 === null || !form.quantity
                          ? "— m³"
                          : `${totals.volumeM3.toLocaleString(localeTag, { maximumFractionDigits: 2 })} m³`}
                      </strong>
                      <small className={styles.totalCardSub}>
                        {totals.volumeM3 === null || !form.quantity
                          ? form.entryMethod === "SACKS"
                            ? t("No informado (opcional para sacos)", "Not provided (optional for sacks)")
                            : t("Completa dimensiones", "Enter dimensions")
                          : t("Calculado desde dimensiones", "Calculated from dimensions")}
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
                  <ShieldAlert size={14} /> {t("3. Requisitos de manejo", "3. Handling requirements")}
                </span>
                <small>{t("Se guardan en el borrador y se validan con cada provider durante coverage y capacity.", "They are saved in the draft and validated with each provider during coverage and capacity checks.")}</small>
              </div>

              <div style={{ marginBottom: "0.75rem" }}>
                <span style={{ display: "inline-block", fontSize: "0.72rem", color: "var(--muted)", background: "rgba(196, 144, 31, 0.12)", border: "1px solid rgba(196, 144, 31, 0.3)", borderRadius: "6px", padding: "4px 8px" }}>
                  {t("ℹ El servidor conserva estos requisitos; la compatibilidad comercial se confirma al consultar providers WebMCP.", "ℹ The server persists these requirements; commercial compatibility is confirmed through WebMCP provider checks.")}
                </span>
              </div>

              <div className={styles.requirementPillGroup}>
                <Button
                  type="button"
                  className={`${styles.requirementPill} ${requiresRefrigeration ? styles.requirementPillActive : ""}`}
                  onClick={() => setRequiresRefrigeration(!requiresRefrigeration)}
                  disabled={readOnly}
                >
                  {t("❄ Temperatura controlada", "❄ Temperature controlled")}
                </Button>
                <Button
                  type="button"
                  className={`${styles.requirementPill} ${isHazardous ? styles.requirementPillActive : ""}`}
                  onClick={() => setIsHazardous(!isHazardous)}
                  disabled={readOnly}
                >
                  {t("⚠ Mercancía peligrosa (Hazmat)", "⚠ Hazardous materials (Hazmat)")}
                </Button>
                <Button
                  type="button"
                  className={`${styles.requirementPill} ${isFragile ? styles.requirementPillActive : ""}`}
                  onClick={() => setIsFragile(!isFragile)}
                  disabled={readOnly}
                >
                  {t("◇ Carga frágil", "◇ Fragile cargo")}
                </Button>
                <Button
                  type="button"
                  className={`${styles.requirementPill} ${isOversized ? styles.requirementPillActive : ""}`}
                  onClick={() => setIsOversized(!isOversized)}
                  disabled={readOnly}
                >
                  {t("↔ Sobredimensionada", "↔ Oversized")}
                </Button>
              </div>

              {requiresRefrigeration && (
                <div className={styles.tempRangeRow}>
                  <span style={{ fontSize: "0.74rem", fontWeight: 700, color: "#0c6396" }}>
                    {t("Rango de temperatura requerido:", "Required temperature range:")}
                  </span>
                  <Input
                    type="number"
                    className={styles.tempInput}
                    value={tempMin}
                    onChange={(e) => setTempMin(e.target.value)}
                    readOnly={readOnly}
                  />
                  <span style={{ fontSize: "0.74rem", color: "#0c6396" }}>°C a</span>
                  <Input
                    type="number"
                    className={styles.tempInput}
                    value={tempMax}
                    onChange={(e) => setTempMax(e.target.value)}
                    readOnly={readOnly}
                  />
                  <span style={{ fontSize: "0.74rem", color: "#0c6396" }}>°C</span>
                </div>
              )}

              {isHazardous && (
                <div className={`${styles.requirementAlert} ${styles.hazardAlert}`}>
                  ⚠️ <strong>{t("Aviso:", "Notice:")}</strong> {t("Mercancía peligrosa (Hazmat) registrada. Cada provider confirmará su compatibilidad antes de cotizar.", "Hazardous materials (Hazmat) recorded. Each provider will confirm compatibility before quoting.")}
                </div>
              )}

              <Field label={t("Instrucciones especiales de manipuleo (opcional)", "Special handling instructions (optional)")} wide>
                <textarea
                  rows={3}
                  readOnly={readOnly}
                  className={styles.notesTextarea}
                  placeholder={t("ej. No apilar. Manipular únicamente con montacargas y mantener protegido de humedad.", "e.g. Do not stack. Handle with a forklift only and protect from moisture.")}
                  value={form.operationalNotes}
                  onChange={(event) => update("operationalNotes", event.target.value)}
                />
              </Field>
            </div>
          </> : null}

          {step === 2 ? <>
            <FormHeading
              id="step-title-3"
              title={t("Programación y preferencias", "Schedule and preferences")}
              description={t("Define la ventana de transporte, límites presupuestarios y documentos para la operación.", "Define the transport window, budget limits, and operation documents.")}
            />

            {/* SUB-BLOQUE 1: VENTANA DE TRANSPORTE */}
            <div className={styles.subSectionCard}>
              <div className={styles.subSectionHeader}>
                <span className={styles.subSectionBadge}>
                  <CalendarClock size={14} /> {t("1. Ventana de transporte", "1. Transport window")}
                </span>
                <small>{t("Horarios de recojo y plazo máximo de entrega", "Pickup times and final delivery deadline")}</small>
              </div>
              <div className={styles.fieldGrid}>
                <Field label={t("Modo de recojo", "Pickup mode")}>
                  {readOnly ? (
                    <Input readOnly value={form.pickupMode} />
                  ) : (
                    <select
                      value={form.pickupMode}
                      onChange={(event) => {
                        const mode = event.target.value as "ASAP" | "SCHEDULED";
                        setForm((curr) => ({ ...curr, pickupMode: mode }));
                      }}
                    >
                      <option value="SCHEDULED">{t("Ventana programada", "Scheduled window")} (SCHEDULED)</option>
                      <option value="ASAP">{t("Inmediato", "Immediate")} (ASAP)</option>
                    </select>
                  )}
                </Field>
                {form.pickupMode === "SCHEDULED" ? (
                  <>
                    <Field label={t("Inicio de ventana de recojo", "Pickup window start")}>
                      <Input
                        type="datetime-local"
                        readOnly={readOnly}
                        value={toDatetimeLocalValue(form.pickupWindowStart)}
                        onChange={(event) => update("pickupWindowStart", fromDatetimeLocalValue(event.target.value))}
                      />
                    </Field>
                    <Field label={t("Fin de ventana de recojo", "Pickup window end")}>
                      <Input
                        type="datetime-local"
                        readOnly={readOnly}
                        value={toDatetimeLocalValue(form.pickupWindowEnd)}
                        onChange={(event) => update("pickupWindowEnd", fromDatetimeLocalValue(event.target.value))}
                      />
                    </Field>
                    <Field label={t("Deadline de entrega en destino", "Destination delivery deadline")}>
                      <Input
                        type="datetime-local"
                        readOnly={readOnly}
                        value={toDatetimeLocalValue(form.deliveryDeadline)}
                        onChange={(event) => update("deliveryDeadline", fromDatetimeLocalValue(event.target.value))}
                      />
                    </Field>
                  </>
                ) : (
                  <Field label={t("Recojo requerido", "Required pickup")} wide>
                    <Input readOnly value={t("ASAP · Recolección prioritaria en el primer turno disponible", "ASAP · Priority pickup in the first available slot")} />
                  </Field>
                )}
              </div>
            </div>

            {/* SUB-BLOQUE 2: RESTRICCIÓN PRESUPUESTARIA */}
            <div className={styles.subSectionCard} style={{ marginTop: "1rem" }}>
              <div className={styles.subSectionHeader}>
                <span className={styles.subSectionBadge}>
                  <Building2 size={14} /> {t("2. Restricción presupuestaria", "2. Budget constraint")}
                </span>
                <small>{t("Límite máximo que CargoMesh no sobrepasará al seleccionar ofertas", "Maximum limit CargoMesh will not exceed when selecting offers")}</small>
              </div>

              <div style={{ marginTop: "0.4rem", marginBottom: "0.75rem", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
                <div className={styles.segmentedGroup}>
                  <Button
                    type="button"
                    className={`${styles.segmentedBtn} ${!hasBudgetLimit ? styles.segmentedBtnActive : ""}`}
                    onClick={() => {
                      setHasBudgetLimit(false);
                      update("budgetMaxUsd", null);
                      setLocalBudgetNotice(null);
                    }}
                  >
                    {t("Sin límite presupuestario", "No budget limit")}
                  </Button>
                  <Button
                    type="button"
                    className={`${styles.segmentedBtn} ${hasBudgetLimit ? styles.segmentedBtnActive : ""}`}
                    onClick={() => {
                      setHasBudgetLimit(true);
                      if (form.budgetMaxUsd === null) {
                        update("budgetMaxUsd", 2000);
                      }
                    }}
                  >
                    {t("Definir presupuesto máximo", "Set maximum budget")}
                  </Button>
                </div>

                {!readOnly && (
                  <Button
                    type="button"
                    className={styles.aiSuggestBtn}
                    onClick={handleEstimateBudget}
                  >
                    <span aria-hidden="true">≈</span> {t("Calcular estimación local", "Calculate local estimate")}
                  </Button>
                )}
              </div>

              {localBudgetNotice && (
                <div className={styles.aiSuggestNotice}>
                  <Sparkles size={14} />
                  <span>{localBudgetNotice}</span>
                </div>
              )}

              {hasBudgetLimit ? (
                <div className={styles.fieldGrid}>
                  <Field label={`${t("Presupuesto máximo", "Maximum budget")} (${form.currency})`}>
                    <Input
                      min="1"
                      required={!readOnly}
                      readOnly={readOnly}
                      type="number"
                      value={nullableNumber(form.budgetMaxUsd)}
                      onChange={(event) => update("budgetMaxUsd", event.target.value ? Number(event.target.value) : null)}
                    />
                  </Field>
                  <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
                    <div className={styles.historicalRefBadge}>
                      📊 {t("Contexto de la estimación local", "Local estimate context")}: <strong>{estimationContext}</strong>
                    </div>
                    <p className={styles.budgetHelpText}>
                      {t("El presupuesto actúa como", "The budget acts as a")} <strong>Hard Constraint</strong>: {t("cualquier cotización superior será descartada antes de la evaluación.", "any higher quote will be discarded before evaluation.")}
                    </p>
                  </div>
                </div>
              ) : (
                <p className={styles.budgetHelpText} style={{ margin: 0 }}>
                  {t("CargoMesh evaluará todas las ofertas recibidas según la estrategia óptima de costo y confiabilidad sin filtro de precio tope.", "CargoMesh will evaluate every received offer using the cost-and-reliability strategy without a price ceiling.")}
                </p>
              )}
            </div>

            {/* SUB-BLOQUE 3: ESTRATEGIA DE DECISIÓN */}
            <div className={styles.subSectionCard} style={{ marginTop: "1rem" }}>
              <div className={styles.subSectionHeader}>
                <span className={styles.subSectionBadge}>
                  <ShieldCheck size={14} /> {t("3. Estrategia de decisión", "3. Decision strategy")}
                </span>
                <small>{t("Fórmula determinística aplicada para el ranking de ofertas", "Deterministic formula applied to offer ranking")}</small>
              </div>

              <div className={styles.strategyCard}>
                <div className={styles.strategyCardHeader}>
                  <span className={styles.strategyBadge}>
                    ⚖️ {form.strategy} ({t("Determinístico", "Deterministic")})
                  </span>
                  <span style={{ fontSize: "0.68rem", color: "#687573", fontWeight: 750 }}>
                    {t("Política ACME Mining Perú", "ACME Mining Peru policy")}
                  </span>
                </div>
                <div className={styles.strategyWeights}>
                  {t("25% Costo · 25% SLA/Confiabilidad · 20% Tiempo · 10% Disponibilidad · 10% Experiencia de ruta · 10% Historial de la organización", "25% Cost · 25% SLA/Reliability · 20% Time · 10% Availability · 10% Route experience · 10% Organization history")}
                </div>
                <div className={styles.strategyPolicyNote}>
                  {t("Garantiza una ponderación transparente y auditable, protegiendo contra anomalías tarifarias o transportistas sin historial probado.", "Provides transparent, auditable weighting while guarding against pricing anomalies and carriers without a proven history.")}
                </div>
              </div>
            </div>

            {/* SUB-BLOQUE 4: DOCUMENTACIÓN DISPONIBLE */}
            <div className={styles.subSectionCard} style={{ marginTop: "1rem" }}>
              <div className={styles.subSectionHeader}>
                <span className={styles.subSectionBadge}>
                  <FileCheck2 size={14} /> {t("4. Documentación disponible", "4. Available documentation")}
                </span>
                <small>{t("Declara los documentos que tienes listos; WebMCP validará si el carrier o la aduana exigen adicionales", "Declare the documents you have ready; WebMCP will check whether the carrier or customs requires more")}</small>
              </div>
              <fieldset className={styles.documentFieldset} style={{ border: 0, padding: 0, margin: "0.5rem 0 0" }}>
                {documentOptions.map((doc) => (
                  <label key={doc.code}>
                    <Input
                      type="checkbox"
                      disabled={readOnly}
                      checked={form.documents.map(mapDocumentToCanonicalCode).includes(doc.code)}
                      onChange={() => toggleDocument(doc.code)}
                    />
                    <span>{t(doc.label, doc.labelEn)}</span>
                  </label>
                ))}
              </fieldset>
            </div>
          </> : null}

          {step === 3 ? <>
            <FormHeading
              id="step-title-4"
              title={t("Revisión de solicitud", "Request review")}
              description={t("Verifica los parámetros operativos antes de transferir el control al agente WebMCP.", "Review the operating parameters before handing control to the WebMCP agent.")}
            />
            <div className={styles.checklistGrid}>
              <div className={styles.checklistItem}>
                <span className={styles.checklistIcon}><Check size={16} aria-hidden="true" /></span>
                <div>
                  <span className={styles.checklistLabel}>{t("Organización y Solicitante", "Organization and requester")}</span>
                  <strong>{form.organization} · {form.requester || "CargoMesh Demo Operator"}</strong>
                  <small>{t("Empresa verificada · Solicitante autorizado", "Verified organization · Authorized requester")} (ROAD FTL)</small>
                </div>
              </div>
              <div className={styles.checklistItem}>
                <span className={styles.checklistIcon}><Check size={16} aria-hidden="true" /></span>
                <div>
                  <span className={styles.checklistLabel}>{t("Ruta autorizada", "Authorized route")}</span>
                  <strong>{originCountryData.flag} {form.originCity}, {form.originCountry} → {destCountryData.flag} {form.destinationCity}, {form.destinationCountry}</strong>
                  <small>{form.originCountry !== form.destinationCountry ? t("Corredor Internacional", "International corridor") : t("Ruta Nacional", "Domestic route")}</small>
                </div>
              </div>
              <div className={styles.checklistItem}>
                <span className={styles.checklistIcon}><Check size={16} aria-hidden="true" /></span>
                <div>
                  <span className={styles.checklistLabel}>{t("Carga y cubicaje", "Cargo and volume")}</span>
                  <strong>{form.quantity ? `${form.quantity} ${form.entryMethod === "PALLETS" ? "pallets" : form.entryMethod === "SACKS" ? t("sacos", "sacks") : t("bultos", "packages")} · ` : ""}{displayNumber(totals.weightKg, " kg")}{totals.volumeM3 !== null ? ` · ${totals.volumeM3.toLocaleString(localeTag, { maximumFractionDigits: 2 })} m³` : ""}</strong>
                  <small>{localizedCargoCategory}{form.cargoDescription && form.cargoDescription !== form.cargoCategory ? ` · ${form.cargoDescription}` : ""} · {form.entryMethod === "PALLETS" ? "Pallets" : form.entryMethod === "SACKS" ? t("Sacos", "Sacks") : form.entryMethod === "TOTAL_WEIGHT" ? t("Carga suelta", "Loose cargo") : t("Bultos", "Packages")}</small>
                </div>
              </div>
              <div className={styles.checklistItem}>
                <span className={styles.checklistIcon}><Check size={16} aria-hidden="true" /></span>
                <div>
                  <span className={styles.checklistLabel}>{t("Requisitos de manipuleo", "Handling requirements")}</span>
                  <strong>
                    {[
                      requiresRefrigeration ? `❄ Reefer (${tempMin}°C a ${tempMax}°C)` : null,
                      isHazardous ? "⚠ Hazmat" : null,
                      isFragile ? t("◇ Carga frágil", "◇ Fragile cargo") : null,
                      isOversized ? t("↔ Sobredimensionada", "↔ Oversized") : null,
                    ].filter(Boolean).join(" · ") || t("Estándar (Sin requisitos especiales)", "Standard (No special requirements)")}
                  </strong>
                  <small>{t("Guardado; sujeto a validación de cobertura y capacidad del provider.", "Saved; subject to provider coverage and capacity validation.")}</small>
                </div>
              </div>
              <div className={styles.checklistItem}>
                <span className={styles.checklistIcon}><Check size={16} aria-hidden="true" /></span>
                <div>
                  <span className={styles.checklistLabel}>{t("Ventana de transporte", "Transport window")}</span>
                  <strong>{form.pickupMode === "ASAP" ? t("ASAP (Recolección inmediata)", "ASAP (Immediate pickup)") : `${displayDate(form.pickupWindowStart)} → ${displayDate(form.pickupWindowEnd)}`}</strong>
                  <small>{t("Deadline", "Deadline")}: {displayDate(form.deliveryDeadline)}</small>
                </div>
              </div>
              <div className={styles.checklistItem}>
                <span className={styles.checklistIcon}><Check size={16} aria-hidden="true" /></span>
                <div>
                  <span className={styles.checklistLabel}>{t("Estrategia de Decisión", "Decision strategy")}</span>
                  <strong>{form.strategy} ({t("Motor BALANCED", "BALANCED engine")})</strong>
                  <small>{t("Presupuesto", "Budget")}: {form.budgetMaxUsd === null ? t("Sin límite", "No limit") : `${form.currency} ${form.budgetMaxUsd.toLocaleString("en-US")}`}</small>
                </div>
              </div>
              <div className={styles.checklistItem}>
                <span className={styles.checklistIcon}><Check size={16} aria-hidden="true" /></span>
                <div>
                  <span className={styles.checklistLabel}>{t("Documentos listos", "Documents ready")}</span>
                  <strong>{form.documents.length ? form.documents.join(", ") : t("Sin documentos adicionales", "No additional documents")}</strong>
                  <small>{t("Requeridos para cruce de frontera", "Required for border crossing")}</small>
                </div>
              </div>
            </div>

            {submitting ? (
              <div className={styles.searchingState} role="status" aria-live="polite">
                <span className={styles.searchingIcon}><LoaderCircle className={styles.spinner} size={22} aria-hidden="true" /></span>
                <span>
                  <strong>{t("Enviando solicitud", "Submitting request")}</strong>
                  <small>{t("CargoMesh crea el borrador DRAFT y valida su versión antes de pasarlo a PENDING.", "CargoMesh creates the DRAFT and validates its version before transitioning it to PENDING.")}</small>
                </span>
              </div>
            ) : (
              <div className={styles.readyNotice}>
                <FileCheck2 size={20} aria-hidden="true" />
                <span>
                  <strong>{t("La solicitud está lista para enviarse.", "The request is ready to submit.")}</strong>
                  <small>{t("El envío usa Hono V2 y expected_draft_version para impedir actualizaciones concurrentes.", "Submission uses Hono V2 and expected_draft_version to prevent concurrent updates.")}</small>
                </span>
              </div>
            )}
          </> : null}

          <footer className={styles.actions}>
            {saveNotice ? <p className={styles.infoBox} role="status">{saveNotice}</p> : null}
            {submitError ? <p className={styles.submitError} role="alert">{submitError}</p> : null}
            <Button
              type="button"
              variant="secondary"
              className={styles.secondaryButton}
              disabled={step === 0 || submitting || creatingDraft}
              onClick={() => setStep((current) => current - 1)}
            >
              <ArrowLeft size={17} aria-hidden="true" /> {t("Anterior", "Back")}
            </Button>
            {form.source === "new-draft" ? (
              <Button
                type="button"
                variant="secondary"
                className={styles.secondaryButton}
                disabled={submitting || creatingDraft}
                onClick={() => void handleCreateDraft()}
              >
                <FileCheck2 size={17} aria-hidden="true" />
                {creatingDraft ? t("Creando…", "Creating…") : t("Crear borrador", "Create draft")}
              </Button>
            ) : null}
            <Button
              type="submit"
              variant="primary"
              className={styles.primaryButton}
              isLoading={submitting}
              disabled={
                submitting ||
                creatingDraft ||
                (step === steps.length - 1 && form.status !== "DRAFT")
              }
            >
              {creatingDraft
                ? t("Creando borrador…", "Creating draft…")
                : step === steps.length - 1
                  ? t("Enviar solicitud", "Submit request")
                  : t("Siguiente", "Next")}
              {submitting ? null : <ArrowRight size={17} aria-hidden="true" />}
            </Button>
          </footer>
        </section>

        <aside className={styles.summaryCard} aria-label={t("Resumen de la solicitud", "Request summary")}>
          <span className={styles.eyebrow}>
            {readOnly
              ? t("ViewModel persistido (Cerrado)", "Persisted ViewModel (Closed)")
              : form.source === "new-draft"
                ? t("Nuevo borrador sin persistir", "New unsaved draft")
                : `${t("Borrador", "Draft")} v${form.draftVersion}`}
          </span>
          <h2>{form.requestId || t("Borrador sin persistir", "Unsaved draft")}</h2>
          <dl>
            <div>
              <dt>{t("Corredor en vivo", "Live corridor")}</dt>
              <dd>
                <strong>{originCountryData.flag} {form.originCity || t("Origen", "Origin")}, {form.originCountry}</strong>
                <br />
                <small style={{ color: "#2b7d72", fontWeight: 750 }}>
                  {form.originCountry !== form.destinationCountry ? t("↓ Internacional", "↓ International") : t("↓ Nacional", "↓ Domestic")}
                </small>
                <br />
                <strong>{destCountryData.flag} {form.destinationCity || t("Destino", "Destination")}, {form.destinationCountry}</strong>
              </dd>
            </div>
            <div>
              <dt>{t("Carga en vivo", "Live cargo")}</dt>
              <dd>
                <strong>{displayNumber(totals.weightKg, " kg")}</strong> · {totals.volumeM3 === null ? t("Volumen n/d", "Volume n/a") : `${totals.volumeM3.toLocaleString(localeTag, { maximumFractionDigits: 2 })} m³`}
                <div style={{ color: "#687573", fontSize: "0.68rem", marginTop: "0.15rem" }}>
                  {form.quantity ? `${form.quantity} ${form.entryMethod === "PALLETS" ? "pallets" : form.entryMethod === "SACKS" ? t("sacos", "sacks") : t("bultos", "packages")} · ` : ""}
                  {localizedCargoCategory}{form.cargoDescription && form.cargoDescription !== form.cargoCategory ? ` · ${form.cargoDescription}` : ""}
                </div>
                <div style={{ marginTop: "0.3rem" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", background: "#edf8f4", color: "#185c55", padding: "0.2rem 0.5rem", border: "1px solid #c2e5d9", borderRadius: "0.4rem", fontSize: "0.68rem", fontWeight: 800 }}>
                    🚚 FTL · {t("Carga dedicada", "Dedicated load")} (ROAD)
                  </span>
                </div>
              </dd>
            </div>
            {(requiresRefrigeration || isHazardous || isFragile || isOversized) ? (
              <div>
                <dt>{t("Requisitos de manejo", "Handling requirements")}</dt>
                <dd style={{ display: "flex", flexDirection: "column", gap: "0.3rem", marginTop: "0.25rem" }}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem" }}>
                    {requiresRefrigeration && (
                      <span style={{ background: "#edf8f4", color: "#185c55", border: "1px solid #c2e5d9", padding: "0.2rem 0.45rem", borderRadius: "0.35rem", fontSize: "0.65rem", fontWeight: 800 }}>
                        ❄ Reefer ({tempMin}°C {t("a", "to")} {tempMax}°C) · {t("Guardado", "Saved")}
                      </span>
                    )}
                    {isHazardous && (
                      <span style={{ background: "#edf8f4", color: "#185c55", border: "1px solid #c2e5d9", padding: "0.2rem 0.45rem", borderRadius: "0.35rem", fontSize: "0.65rem", fontWeight: 800 }}>
                        ⚠ Hazmat · {t("Guardado", "Saved")}
                      </span>
                    )}
                    {isFragile && (
                      <span style={{ background: "#edf8f4", color: "#185c55", border: "1px solid #c2e5d9", padding: "0.2rem 0.45rem", borderRadius: "0.35rem", fontSize: "0.65rem", fontWeight: 800 }}>
                        ◇ {t("Frágil", "Fragile")} · {t("Guardado", "Saved")}
                      </span>
                    )}
                    {isOversized && (
                      <span style={{ background: "#edf8f4", color: "#185c55", border: "1px solid #c2e5d9", padding: "0.2rem 0.45rem", borderRadius: "0.35rem", fontSize: "0.65rem", fontWeight: 800 }}>
                        ↔ {t("Sobredimensionada", "Oversized")} · {t("Guardado", "Saved")}
                      </span>
                    )}
                  </div>
                  <small style={{ color: "#185c55", fontSize: "0.65rem", lineHeight: 1.35 }}>
                    {t("Persistidos en el borrador. Coverage y capacity determinan qué providers pueden atenderlos.", "Persisted in the draft. Coverage and capacity determine which providers can serve them.")}
                  </small>
                </dd>
              </div>
            ) : null}
            <div>
              <dt>{t("Límite de presupuesto", "Budget limit")}</dt>
              <dd>
                <strong style={{ color: "#185c55", fontSize: "0.85rem" }}>
                  {form.budgetMaxUsd === null ? t("Sin límite presupuestario", "No budget limit") : `${form.currency} ${form.budgetMaxUsd.toLocaleString("en-US")}`}
                </strong>
              </dd>
            </div>
            <div>
              <dt>{t("Programación", "Schedule")}</dt>
              <dd>{form.pickupMode === "ASAP" ? t("⚡ Recolección inmediata (ASAP)", "⚡ Immediate pickup (ASAP)") : t("📅 Ventana programada", "📅 Scheduled window")}</dd>
            </div>
            <div>
              <dt>{t("Documentos listos", "Documents ready")}</dt>
              <dd>{form.documents.length} {t("documento(s) seleccionado(s)", "selected document(s)")}</dd>
            </div>
            <div>
              <dt>{t("Estrategia de Decisión", "Decision strategy")}</dt>
              <dd>
                <strong>{form.strategy}</strong>
                <br />
                <small style={{ color: "#687573" }}>{t("25% Costo · 25% SLA · 20% Tiempo · 10% Disponibilidad · 10% Ruta · 10% Historial", "25% Cost · 25% SLA · 20% Time · 10% Availability · 10% Route · 10% History")}</small>
              </dd>
            </div>
          </dl>
          <p>
            <ShieldCheck size={16} aria-hidden="true" />
            {readOnly
              ? t("El servidor conserva la fuente de verdad; esta vista no inventa ni reemplaza valores ausentes.", "The server remains the source of truth; this view neither invents nor replaces missing values.")
              : t("Persistencia mediante Hono V2 con control optimista de versión y manejo explícito de STALE_DRAFT.", "Persistence through Hono V2 with optimistic version control and explicit STALE_DRAFT handling.")}
          </p>
        </aside>
      </form>
    </div>
  );
}

function FormHeading({ id, title, description }: { id: string; title: string; description: string }) { const { t } = useLocale(); return <header className={styles.formHeading}><span className={styles.eyebrow}>{t("Configuración", "Configuration")}</span><h2 id={id}>{title}</h2><p>{description}</p></header>; }
function Field({ label, wide = false, children }: { label: string; wide?: boolean; children: React.ReactNode }) { return <label className={wide ? styles.fieldWide : undefined}><span>{label}</span>{children}</label>; }
function NumberField({ label, value, readOnly, onChange }: { label: string; value: number | null; readOnly: boolean; onChange: (value: number | null) => void }) { return <Field label={label}><Input min="1" required={!readOnly} readOnly={readOnly} type="number" value={nullableNumber(value)} onChange={(event) => onChange(event.target.value ? Number(event.target.value) : null)} /></Field>; }
function InfoBox({ children }: { children: React.ReactNode }) { return <p className={styles.infoBox}><ShieldCheck size={17} aria-hidden="true" /> {children}</p>; }
function ReviewItem({ label, value }: { label: string; value: string }) { return <div><small>{label}</small><strong>{value}</strong></div>; }

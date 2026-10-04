"use client";

import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  ClipboardCheck,
  ContactRound,
  Info,
  Loader2,
  MapPinned,
  Package,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Badge, Button, Checkbox, Input, Select, Textarea } from "@/components/ui";
import { useLocale } from "@/features/i18n/locale-provider";
import { CandidateResults } from "./components/candidate-results";
import { ConversationChat } from "./conversation-chat";
import type { ConversationField } from "./conversation-fields";
import { RoadCandidateMapBoundary } from "./components/road-candidate-map-boundary";
import type {
  FreightRequestV2Data,
  IntakeCargoCategoryGuidance,
  IntakeOption,
  IntakeOptionsData,
  RoadServiceabilityEvaluationV2Data,
} from "./contracts";
import { auditIntakeOptions, EMPTY_INTAKE_OPTIONS } from "./intake-options";
import { mapServiceabilityToMapViewProps } from "./mappers/road-map-props.mapper";
import {
  EMPTY_PROTOTYPE_DRAFT,
  applyChatFieldToDraft,
  buildPrototypeExample,
  findIntakeFacility,
  mapDraftToCreateFreightRequestV2Input,
  toggleRequirement,
  validatePrototypeReview,
  validatePrototypeStep,
  type PrototypeStep,
  type PrototypeValidationIssue,
  type V2IntakePrototypeDraft,
} from "./prototype-model";
import {
  V2IntakeApiError,
  assertFreightRequestRoundTrip,
  assertServiceabilityCorrelation,
  createFreightRequestV2,
  getFreightRequestV2,
  getRoadServiceabilityV2,
  loadIntakeOptions,
  reconcileCandidateSelection,
} from "./v2-intake-client";
import styles from "./v2-intake-prototype.module.css";

const STEP_ICONS = [MapPinned, Package, CalendarDays, ClipboardCheck] as const;
const CHAT_REQUEST_SESSION_KEY = "cargomesh-v2-chat-request-id";

type SubmitPhase = "idle" | "creating" | "reading" | "evaluating" | "success" | "error";
type Translate = (spanish: string, english: string) => string;

export function V2IntakePrototype() {
  const { locale, t } = useLocale();
  const [draft, setDraft] = useState<V2IntakePrototypeDraft>(EMPTY_PROTOTYPE_DRAFT);
  const [step, setStep] = useState<PrototypeStep>(1);
  const [maxVisited, setMaxVisited] = useState<PrototypeStep>(1);
  const [issues, setIssues] = useState<PrototypeValidationIssue[]>([]);
  const [options, setOptions] = useState<IntakeOptionsData | null>(null);
  const [optionsSource, setOptionsSource] = useState<"loading" | "api" | "fixture" | "error">("loading");
  const [optionsError, setOptionsError] = useState<V2IntakeApiError | null>(null);
  const [optionsAttempt, setOptionsAttempt] = useState(0);
  const [submitPhase, setSubmitPhase] = useState<SubmitPhase>("idle");
  const [submitError, setSubmitError] = useState<V2IntakeApiError | null>(null);
  const [request, setRequest] = useState<FreightRequestV2Data | null>(null);
  const [evaluation, setEvaluation] = useState<RoadServiceabilityEvaluationV2Data | null>(null);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [dirtyAfterCreate, setDirtyAfterCreate] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);
  const idempotencyRef = useRef<{ fingerprint: string; key: string } | null>(null);
  const flowSequenceRef = useRef(0);
  const draftRevisionRef = useRef(0);

  useEffect(() => {
    let active = true;
    setOptionsSource("loading");
    setOptionsError(null);
    void loadIntakeOptions()
      .then((result) => {
        if (!active) return;
        setOptions(result.options.data);
        setOptionsSource(result.source);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setOptions(null);
        setOptionsSource("error");
        setOptionsError(normalizeApiError(error));
      });
    return () => { active = false; };
  }, [optionsAttempt]);

  useEffect(() => {
    const requestId = window.sessionStorage.getItem(CHAT_REQUEST_SESSION_KEY);
    if (!requestId) return;
    let active = true;
    void getFreightRequestV2(requestId).then((loaded) => {
      if (!active) return;
      setRequest(loaded.data);
      setSubmitPhase("success");
    }).catch(() => {
      if (active) window.sessionStorage.removeItem(CHAT_REQUEST_SESSION_KEY);
    });
    return () => { active = false; };
  }, []);

  const activeOptions = options ?? EMPTY_INTAKE_OPTIONS;
  const origin = findIntakeFacility(activeOptions, draft.originFacilityId);
  const destination = findIntakeFacility(activeOptions, draft.destinationFacilityId);
  const optionCoverage = auditIntakeOptions(activeOptions);
  const stepLabels = [
    t("Sedes", "Facilities"),
    t("Carga y unidades", "Cargo & units"),
    t("Ventanas y contactos", "Windows & contacts"),
    t("Crear y evaluar", "Create & evaluate"),
  ];
  const mapProps = useMemo(() => {
    if (!request || !evaluation) return null;
    return mapServiceabilityToMapViewProps(
      request,
      evaluation,
      selectedCandidateId,
      setSelectedCandidateId,
    );
  }, [evaluation, request, selectedCandidateId]);

  const update = <K extends keyof V2IntakePrototypeDraft>(field: K, value: V2IntakePrototypeDraft[K]) => {
    draftRevisionRef.current += 1;
    setDraft((current) => ({ ...current, [field]: value }));
    setIssues((current) => current.filter((issue) => issue.field !== field));
    if (request) setDirtyAfterCreate(true);
  };
  const errorFor = (field: keyof V2IntakePrototypeDraft) => {
    const issue = issues.find((candidate) => candidate.field === field);
    if (!issue) return undefined;
    const labels: Record<PrototypeValidationIssue["code"], string> = {
      required: t("Este campo es obligatorio.", "This field is required."),
      "same-facility": t("Origen y destino deben ser sedes distintas.", "Origin and destination must be different facilities."),
      "positive-number": t("Ingresa un número mayor que cero.", "Enter a number greater than zero."),
      "positive-integer": t("Ingresa un entero mayor que cero.", "Enter an integer greater than zero."),
      "invalid-date": t("Ingresa una fecha y hora válidas.", "Enter a valid date and time."),
      "invalid-range": t("La ventana debe terminar después de iniciar y respetar el orden retiro→entrega.", "The window must end after it starts and preserve pickup→delivery order."),
      "invalid-email": t("Ingresa un correo válido.", "Enter a valid email."),
      "invalid-phone": t("Usa formato E.164, por ejemplo +51987654321.", "Use E.164 format, for example +51987654321."),
      "total-mismatch": t("El total debe coincidir con cantidad × medida por unidad.", "The total must match quantity × per-unit measurement."),
      "temperature-order": t("La temperatura máxima debe ser mayor o igual a la mínima.", "Maximum temperature must be greater than or equal to minimum."),
    };
    return labels[issue.code];
  };
  const focusValidationSummary = () => requestAnimationFrame(() => errorRef.current?.focus());
  const enterReview = () => {
    const validation = validatePrototypeReview(draft);
    if (!validation.valid) {
      setStep(validation.invalidStep);
      setIssues(validation.issues);
      focusValidationSummary();
      return false;
    }
    setIssues([]);
    setStep(4);
    setMaxVisited(4);
    return true;
  };
  const goNext = () => {
    const nextIssues = validatePrototypeStep(step, draft);
    setIssues(nextIssues);
    if (nextIssues.length) {
      focusValidationSummary();
      return;
    }
    const next = (step + 1) as PrototypeStep;
    if (next === 4) {
      enterReview();
      return;
    }
    setStep(next);
    setMaxVisited((current) => Math.max(current, next) as PrototypeStep);
  };
  const loadExample = () => {
    draftRevisionRef.current += 1;
    setDraft(buildPrototypeExample(activeOptions));
    setIssues([]);
    setSubmitError(null);
    if (request) setDirtyAfterCreate(true);
  };
  const reset = () => {
    flowSequenceRef.current += 1;
    draftRevisionRef.current += 1;
    setDraft(EMPTY_PROTOTYPE_DRAFT);
    setStep(1);
    setMaxVisited(1);
    setIssues([]);
    setSubmitPhase("idle");
    setSubmitError(null);
    setRequest(null);
    setEvaluation(null);
    setSelectedCandidateId(null);
    setDirtyAfterCreate(false);
    idempotencyRef.current = null;
    window.sessionStorage.removeItem(CHAT_REQUEST_SESSION_KEY);
  };

  const readAndEvaluate = async (
    created: FreightRequestV2Data,
    flowSequence: number,
    submittedDraftRevision?: number,
  ) => {
    setSubmitPhase("reading");
    const roundTrip = await getFreightRequestV2(created.id);
    if (flowSequence !== flowSequenceRef.current) return;
    assertFreightRequestRoundTrip(created, roundTrip.data);
    setRequest(roundTrip.data);
    window.sessionStorage.setItem(CHAT_REQUEST_SESSION_KEY, roundTrip.data.id);
    setSubmitPhase("evaluating");
    const result = await getRoadServiceabilityV2(roundTrip.data.id, roundTrip.data.draftVersion);
    if (flowSequence !== flowSequenceRef.current) return;
    assertServiceabilityCorrelation(roundTrip.data, result.data);
    setEvaluation(result.data);
    setSelectedCandidateId((current) => reconcileCandidateSelection(current, result.data));
    setSubmitPhase("success");
    if (submittedDraftRevision !== undefined) {
      setDirtyAfterCreate(draftRevisionRef.current !== submittedDraftRevision);
    }
  };
  const createDraftAndEvaluate = async () => {
    if (!enterReview()) return;
    setSubmitError(null);
    setEvaluation(null);
    const flowSequence = flowSequenceRef.current + 1;
    flowSequenceRef.current = flowSequence;
    const submittedDraftRevision = draftRevisionRef.current;
    try {
      const payload = mapDraftToCreateFreightRequestV2Input(draft, activeOptions);
      const fingerprint = JSON.stringify(payload);
      if (!idempotencyRef.current || idempotencyRef.current.fingerprint !== fingerprint) {
        idempotencyRef.current = { fingerprint, key: crypto.randomUUID() };
      }
      setSubmitPhase("creating");
      const created = await createFreightRequestV2(payload, idempotencyRef.current.key);
      if (flowSequence !== flowSequenceRef.current) return;
      setRequest(created.data);
      await readAndEvaluate(created.data, flowSequence, submittedDraftRevision);
    } catch (error) {
      if (flowSequence !== flowSequenceRef.current) return;
      setSubmitError(normalizeApiError(error));
      setSubmitPhase("error");
    }
  };
  const retryAfterCreate = async () => {
    if (!request) {
      await createDraftAndEvaluate();
      return;
    }
    setSubmitError(null);
    const flowSequence = flowSequenceRef.current + 1;
    flowSequenceRef.current = flowSequence;
    try {
      await readAndEvaluate(request, flowSequence);
    } catch (error) {
      if (flowSequence !== flowSequenceRef.current) return;
      setSubmitError(normalizeApiError(error));
      setSubmitPhase("error");
    }
  };

  const updateFromChat = (field: ConversationField, value: string) => {
    draftRevisionRef.current += 1;
    setDraft((current) => applyChatFieldToDraft(current, field, value));
    setIssues((current) => current.filter((issue) => issue.field !== field));
    if (request) setDirtyAfterCreate(true);
  };

  return (
    <div className={styles.page}>
      <div className={styles.frame}>
        <header className={styles.hero}>
          <div className={styles.heroCopy}>
            <span className={styles.eyebrow}>CargoMesh V2 · Sprint 2 · HAC-14</span>
            <h1>{t("Crear solicitud ROAD", "Create ROAD request")}</h1>
            <p>{t(
              "Flujo para clientes/shipper: crea un borrador y consulta elegibilidad preliminar sin convertirla en oferta ni reserva.",
              "Client/shipper flow: create a draft and read preliminary serviceability without turning it into an offer or booking.",
            )}</p>
          </div>
          <div className={styles.heroActions}>
            <Badge tone={optionsSource === "api" ? "confirmed" : optionsSource === "error" ? "unknown" : "preliminary"}>
              {optionsSource === "loading"
                ? t("Consultando opciones", "Loading options")
                : optionsSource === "api"
                  ? t("Opciones API V2", "V2 API options")
                  : optionsSource === "fixture"
                    ? t("Fixture dev explícito", "Explicit dev fixture")
                    : t("Error de opciones", "Options error")}
            </Badge>
            <Button variant="secondary" type="button" disabled={!options || options.facilities.length < 2 || !optionCoverage.complete} onClick={loadExample}><Sparkles size={16} aria-hidden="true" />{t("Cargar ejemplo V2", "Load V2 example")}</Button>
          </div>
        </header>

        <div className={`${styles.notice} ${optionsSource === "fixture" ? styles.fixtureNotice : ""}`} role="note">
          <Info size={18} aria-hidden="true" />
          <div>
            <strong>{optionsSource === "fixture" ? t("Fixture de desarrollo activado explícitamente", "Explicit development fixture enabled") : t("Estado local hasta crear", "Local state until creation")}</strong>
            <span>{optionsSource === "fixture"
              ? t("NEXT_PUBLIC_V2_INTAKE_OPTIONS_SOURCE=fixture omite el GET sólo en desarrollo. El JSON está rotulado SIMULATED y crear todavía requiere el POST real.", "NEXT_PUBLIC_V2_INTAKE_OPTIONS_SOURCE=fixture skips GET only in development. The JSON is labelled SIMULATED and creation still requires the real POST.")
              : t("No hay autosave: avanzar entre pasos no envía datos. Sólo «Crear DRAFT y evaluar» ejecuta POST→GET→serviceability.", "There is no autosave: moving between steps sends no data. Only “Create DRAFT & evaluate” runs POST→GET→serviceability.")}</span>
          </div>
        </div>

        {optionsSource === "loading" ? <OptionsLoadingState t={t} /> : null}
        {optionsSource === "error" && optionsError ? (
          <OptionsErrorState error={optionsError} retry={() => setOptionsAttempt((attempt) => attempt + 1)} t={t} />
        ) : null}
        {options && optionCoverage.emptyFacilities ? <EmptyFacilitiesState t={t} /> : null}
        {options && !optionCoverage.complete ? (
          <div className={styles.errorSummary} role="alert">
            <strong>{t("El catálogo no cubre todos los selectores", "The catalog does not cover every selector")}</strong>
            <span>{optionCoverage.missingCatalogGroups.join(", ")}</span>
          </div>
        ) : null}

        {options && !optionCoverage.emptyFacilities && optionCoverage.complete ? <>
        <nav className={styles.stepper} aria-label={t("Pasos del intake V2", "V2 intake steps")}>{stepLabels.map((label, index) => {
          const number = (index + 1) as PrototypeStep;
          const Icon = STEP_ICONS[index];
          const active = step === number;
          const complete = step > number;
          return (
            <button
              className={`${styles.stepButton} ${active ? styles.stepButtonActive : ""} ${complete ? styles.stepButtonComplete : ""}`}
              disabled={number > maxVisited}
              key={label}
              type="button"
              aria-current={active ? "step" : undefined}
              onClick={() => {
                if (number === 4) { enterReview(); return; }
                setStep(number);
                setIssues([]);
              }}
            >
              <span className={styles.stepNumber}>{complete ? <Check size={15} aria-hidden="true" /> : <Icon size={15} aria-hidden="true" />}</span>
              <span className={styles.stepCopy}><small>{t(`Paso ${number}`, `Step ${number}`)}</small><strong>{label}</strong></span>
            </button>
          );
        })}</nav>

        <div className={styles.workspace}>
          <section className={styles.card} aria-labelledby={`prototype-step-${step}`}>
            <header className={styles.cardHeader}>
              <div><span className={styles.eyebrow}>{t(`Paso ${step} de 4`, `Step ${step} of 4`)}</span><h2 id={`prototype-step-${step}`}>{stepLabels[step - 1]}</h2><p>{stepDescription(step, t)}</p></div>
              <Badge tone={step === 4 ? "confirmed" : "preliminary"}>{step === 4 ? t("Listo para crear", "Ready to create") : t("Edición local", "Local editing")}</Badge>
            </header>
            <div className={styles.cardBody}>
              {issues.length ? <div className={styles.errorSummary} role="alert" tabIndex={-1} ref={errorRef}><strong>{t("Revisa los campos marcados", "Review the marked fields")}</strong><span>{t(`Hay ${issues.length} dato(s) pendiente(s) en este paso.`, `There are ${issues.length} pending field(s) in this step.`)}</span></div> : null}
              {step === 1 ? <FacilityStep draft={draft} options={activeOptions} update={update} errorFor={errorFor} t={t} /> : null}
              {step === 2 ? <CargoStep draft={draft} options={activeOptions} update={update} errorFor={errorFor} t={t} /> : null}
              {step === 3 ? <ScheduleAndContactsStep draft={draft} options={activeOptions} update={update} errorFor={errorFor} t={t} /> : null}
              {step === 4 ? <ReviewStep draft={draft} options={activeOptions} request={request} dirtyAfterCreate={dirtyAfterCreate} t={t} locale={locale} /> : null}
              {submitError ? <ApiErrorState error={submitError} requestExists={Boolean(request)} retry={retryAfterCreate} t={t} /> : null}
            </div>
            <footer className={styles.footer}>
              <Button variant="ghost" type="button" onClick={reset}><RotateCcw size={16} aria-hidden="true" />{t("Reiniciar", "Reset")}</Button>
              <div className={styles.footerRight}>
                {step > 1 ? <Button variant="secondary" type="button" onClick={() => { setStep((step - 1) as PrototypeStep); setIssues([]); }}><ArrowLeft size={16} aria-hidden="true" />{t("Anterior", "Back")}</Button> : null}
                {step < 4 ? <Button type="button" onClick={goNext}>{t("Continuar", "Continue")}<ArrowRight size={16} aria-hidden="true" /></Button> : (
                  <Button variant="accent" type="button" isLoading={["creating", "reading", "evaluating"].includes(submitPhase)} loadingLabel={phaseLabel(submitPhase, t)} onClick={createDraftAndEvaluate}>
                    <ClipboardCheck size={16} aria-hidden="true" />{t("Crear DRAFT y evaluar", "Create DRAFT & evaluate")}
                  </Button>
                )}
              </div>
            </footer>
          </section>

          <LiveSummary draft={draft} options={activeOptions} request={request} evaluation={evaluation} dirtyAfterCreate={dirtyAfterCreate} t={t} />
        </div>

        {request ? (
          <section className={styles.integrationArea} aria-live="polite">
            <header className={styles.integrationHeader}>
              <div><span className={styles.eyebrow}>{request.referenceCode}</span><h2>{t("Borrador persistido y lectura operativa", "Persisted draft and operational read")}</h2><p>{t(`Estado ${request.status} · draftVersion ${request.draftVersion}`, `Status ${request.status} · draftVersion ${request.draftVersion}`)}</p></div>
              <Badge tone={request.status === "DRAFT" ? "preliminary" : "neutral"}>{request.status}</Badge>
            </header>
            {dirtyAfterCreate ? <div className={styles.pendingState} role="status">{t(
              "Los cambios del formulario son locales. Tarjetas y mapa todavía muestran el DRAFT persistido y la versión evaluada indicada arriba.",
              "Form changes are local. Cards and map still show the persisted DRAFT and the evaluated version shown above.",
            )}</div> : null}
            {evaluation ? <CandidateResults evaluation={evaluation} selectedCandidateId={selectedCandidateId} onSelectCandidate={setSelectedCandidateId} t={t} /> : <LoadingOrPending phase={submitPhase} retry={retryAfterCreate} t={t} />}
            {mapProps ? <RoadCandidateMapBoundary props={mapProps} t={t} /> : null}
          </section>
        ) : null}
        </> : null}
      </div>
      <ConversationChat draft={draft} options={activeOptions} optionsSource={optionsSource === "fixture" ? "fixture" : "api"} request={request} evaluation={evaluation} error={submitError ?? optionsError} draftDirty={dirtyAfterCreate}
        busy={submitPhase === "creating" || submitPhase === "reading" || submitPhase === "evaluating"}
        onField={updateFromChat} onCreate={() => { void createDraftAndEvaluate(); }}
        onRead={() => { void retryAfterCreate(); }} onEvaluate={() => { void retryAfterCreate(); }} onStartOver={reset} />
    </div>
  );
}

type UpdateDraft = <K extends keyof V2IntakePrototypeDraft>(field: K, value: V2IntakePrototypeDraft[K]) => void;
type FieldHelpers = {
  draft: V2IntakePrototypeDraft;
  options: IntakeOptionsData;
  update: UpdateDraft;
  errorFor: (field: keyof V2IntakePrototypeDraft) => string | undefined;
  t: Translate;
};

function OptionsLoadingState({ t }: { t: Translate }) {
  return <div className={styles.optionsState} role="status"><Loader2 className={styles.spinner} size={20} aria-hidden="true" /><div><strong>{t("Cargando selectores autenticados", "Loading authenticated selectors")}</strong><span>{t("Esperando los cinco grupos de GET /api/v2/intake/options.", "Waiting for the five groups from GET /api/v2/intake/options.")}</span></div></div>;
}

function OptionsErrorState({ error, retry, t }: { error: V2IntakeApiError; retry: () => void; t: Translate }) {
  return <div className={styles.optionsError} role="alert"><ShieldAlert size={20} aria-hidden="true" /><div><strong>{error.code}</strong><span>{error.message}</span><small>{t("El formulario permanece bloqueado: errores 401/403, red o contrato nunca activan el fixture automáticamente.", "The form remains blocked: 401/403, network, or contract errors never activate the fixture automatically.")}</small></div><Button variant="secondary" type="button" onClick={retry}><RefreshCw size={15} aria-hidden="true" />{t("Reintentar GET", "Retry GET")}</Button></div>;
}

function EmptyFacilitiesState({ t }: { t: Translate }) {
  return <div className={styles.optionsState} role="status"><MapPinned size={20} aria-hidden="true" /><div><strong>{t("No hay sedes disponibles", "No facilities available")}</strong><span>{t("El catálogo autenticado devolvió facilities: []. No se inventan sedes ni se habilita el POST.", "The authenticated catalog returned facilities: []. No facilities are invented and POST remains disabled.")}</span></div></div>;
}

function FacilityStep({ draft, options, update, errorFor, t }: FieldHelpers) {
  const origin = findIntakeFacility(options, draft.originFacilityId);
  const destination = findIntakeFacility(options, draft.destinationFacilityId);
  return <><h3 className={styles.sectionTitle}><MapPinned size={16} aria-hidden="true" />{t("Selecciona sedes de tu organización", "Select facilities in your organization")}</h3><div className={styles.formGrid}>
    <Select label={t("Sede de origen", "Origin facility")} value={draft.originFacilityId} error={errorFor("originFacilityId")} hint={t("El servidor vuelve a validar tenant y ubicación canónica.", "The server revalidates tenant and canonical location.")} onChange={(event) => update("originFacilityId", event.target.value)}><option value="">{t("Seleccionar origen", "Select origin")}</option>{options.facilities.map((facility) => <option value={facility.facilityId} key={facility.facilityId}>{facility.code} · {facility.label}</option>)}</Select>
    <Select label={t("Sede de destino", "Destination facility")} value={draft.destinationFacilityId} error={errorFor("destinationFacilityId")} onChange={(event) => update("destinationFacilityId", event.target.value)}><option value="">{t("Seleccionar destino", "Select destination")}</option>{options.facilities.map((facility) => <option value={facility.facilityId} key={facility.facilityId}>{facility.code} · {facility.label}</option>)}</Select>
    {origin ? <FacilityCard facility={origin} t={t} /> : null}{destination ? <FacilityCard facility={destination} t={t} /> : null}
  </div><div className={styles.boundaryNotice} role="note"><Info size={16} aria-hidden="true" /><span>{t("Seleccionar sedes no confirma ruta, cobertura, capacidad, precio ni persistencia. Esas conclusiones sólo proceden de las respuestas del servidor.", "Selecting facilities does not confirm route, coverage, capacity, price, or persistence. Those conclusions come only from server responses.")}</span></div></>;
}

function FacilityCard({ facility, t }: { facility: IntakeOptionsData["facilities"][number]; t: Translate }) {
  return <article className={styles.siteCard}><div className={styles.siteMeta}><Badge tone="preliminary">{t("Selector", "Selector")}</Badge><Badge tone={facility.lat == null ? "unknown" : "confirmed"}>{facility.lat == null ? "UNKNOWN GEO" : "CANONICAL GEO"}</Badge></div><strong>{facility.code} · {facility.label}</strong><span>{facility.city}, {facility.region ?? "—"}, {facility.countryCode}</span><small>{t("La pertenencia al tenant se confirma server-side al crear.", "Tenant ownership is confirmed server-side on creation.")}</small></article>;
}

function CargoStep({ draft, options, update, errorFor, t }: FieldHelpers) {
  const category = options.cargoCategories.find((option) => option.code === draft.categoryCode);
  const packaging = options.packagingOptions.find((option) => option.code === draft.packaging);
  const unitPackaging = options.packagingOptions.find((option) => option.code === draft.unitPackageType);
  return <><h3 className={styles.sectionTitle}><Package size={16} aria-hidden="true" />{t("Especificación y unidad de carga", "Cargo specification and unit")}</h3><div className={styles.formGrid}>
    <OptionSelect label={t("Categoría", "Category")} placeholder={t("Seleccionar categoría", "Select category")} options={options.cargoCategories} value={draft.categoryCode} error={errorFor("categoryCode")} onChange={(value) => update("categoryCode", value)} t={t} />
    <OptionSelect label={t("Embalaje", "Packaging")} placeholder={t("Seleccionar embalaje", "Select packaging")} options={options.packagingOptions} value={draft.packaging} error={errorFor("packaging")} onChange={(value) => { update("packaging", value); if (!draft.unitPackageType) update("unitPackageType", value); }} t={t} />
    {category ? <CategoryGuidanceEvidence guidance={category.guidance} t={t} /> : null}
    {packaging?.verification ? <OptionEvidence label="verification" value={`${packaging.verification} · ${t("El embalaje se captura, pero no confirma compatibilidad de manipulación.", "Packaging is captured, but handling compatibility is not confirmed.")}`} /> : null}
    <Textarea fieldClassName={styles.wide} label={t("Descripción", "Description")} rows={3} value={draft.cargoDescription} error={errorFor("cargoDescription")} onChange={(event) => update("cargoDescription", event.target.value)} />
    <Input label={t("Peso total (kg)", "Total weight (kg)")} type="number" min="0" step="0.1" value={draft.totalWeightKg} error={errorFor("totalWeightKg")} onChange={(event) => update("totalWeightKg", event.target.value)} />
    <Input label={t("Volumen total (m³)", "Total volume (m³)")} type="number" min="0" step="0.1" value={draft.totalVolumeM3} error={errorFor("totalVolumeM3")} onChange={(event) => update("totalVolumeM3", event.target.value)} />
    <Checkbox label={t("Carga divisible", "Divisible cargo")} hint={t("Dato declarado; no implica que un carrier pueda fraccionarla.", "Declared fact; it does not imply a carrier can split it.")} checked={draft.divisible} onChange={(event) => update("divisible", event.target.checked)} />
  </div>
  <fieldset className={styles.optionFieldset}><legend>{t("Requisitos especiales", "Special requirements")}</legend><div className={styles.checkboxGrid}>{options.requirementOptions.map((option) => <Checkbox key={option.code} label={optionLabel(option, t)} hint={verificationCopy(option.verification, t)} checked={draft.requirements.includes(option.code)} onChange={(event) => update("requirements", toggleRequirement(draft.requirements, option.code, event.target.checked))} />)}</div></fieldset>
  {draft.requirements.includes("TEMP_CONTROLLED") ? <div className={styles.formGrid}><Input label={t("Temperatura mínima (°C)", "Minimum temperature (°C)")} type="number" step="0.1" value={draft.temperatureMinCelsius} error={errorFor("temperatureMinCelsius")} onChange={(event) => update("temperatureMinCelsius", event.target.value)} /><Input label={t("Temperatura máxima (°C)", "Maximum temperature (°C)")} type="number" step="0.1" value={draft.temperatureMaxCelsius} error={errorFor("temperatureMaxCelsius")} onChange={(event) => update("temperatureMaxCelsius", event.target.value)} /></div> : null}
  <fieldset className={styles.optionFieldset}><legend>{t("Unidad de carga · units[0]", "Cargo unit · units[0]")}</legend><div className={styles.formGrid}>
    <OptionSelect label={t("Tipo de paquete", "Package type")} placeholder={t("Seleccionar tipo", "Select type")} options={options.packagingOptions} value={draft.unitPackageType} error={errorFor("unitPackageType")} onChange={(value) => update("unitPackageType", value)} t={t} />
    {unitPackaging?.verification ? <OptionEvidence label="verification" value={`${unitPackaging.verification} · ${t("Dato de captura; no prueba compatibilidad del carrier.", "Capture data; it does not prove carrier compatibility.")}`} /> : null}
    <Input label={t("Cantidad", "Quantity")} type="number" min="1" step="1" value={draft.unitQuantity} error={errorFor("unitQuantity")} onChange={(event) => update("unitQuantity", event.target.value)} />
    <Input label={t("Peso por unidad (kg)", "Weight per unit (kg)")} type="number" min="0" step="0.1" value={draft.unitWeightPerUnitKg} error={errorFor("unitWeightPerUnitKg")} onChange={(event) => update("unitWeightPerUnitKg", event.target.value)} />
    <Input label={t("Volumen por unidad (m³)", "Volume per unit (m³)")} type="number" min="0" step="0.1" value={draft.unitVolumePerUnitM3} error={errorFor("unitVolumePerUnitM3")} onChange={(event) => update("unitVolumePerUnitM3", event.target.value)} />
    <Input label={t("Largo (cm)", "Length (cm)")} type="number" min="0" step="0.1" value={draft.unitLengthCm} error={errorFor("unitLengthCm")} onChange={(event) => update("unitLengthCm", event.target.value)} />
    <Input label={t("Ancho (cm)", "Width (cm)")} type="number" min="0" step="0.1" value={draft.unitWidthCm} error={errorFor("unitWidthCm")} onChange={(event) => update("unitWidthCm", event.target.value)} />
    <Input label={t("Alto (cm)", "Height (cm)")} type="number" min="0" step="0.1" value={draft.unitHeightCm} error={errorFor("unitHeightCm")} onChange={(event) => update("unitHeightCm", event.target.value)} />
    <Checkbox label={t("Unidad indivisible", "Indivisible unit")} checked={draft.unitIndivisible} onChange={(event) => update("unitIndivisible", event.target.checked)} />
    <Checkbox label={t("Apilable", "Stackable")} checked={draft.unitStackable} onChange={(event) => update("unitStackable", event.target.checked)} />
  </div></fieldset></>;
}

function ScheduleAndContactsStep({ draft, options, update, errorFor, t }: FieldHelpers) {
  return <><h3 className={styles.sectionTitle}><CalendarDays size={16} aria-hidden="true" />{t("Ventanas y equipo requerido", "Windows and required equipment")}</h3><div className={styles.formGrid}>
    <Input label={t("Retiro desde", "Pickup starts")} type="datetime-local" value={draft.pickupWindowStartsAt} error={errorFor("pickupWindowStartsAt")} onChange={(event) => update("pickupWindowStartsAt", event.target.value)} />
    <Input label={t("Retiro hasta", "Pickup ends")} type="datetime-local" value={draft.pickupWindowEndsAt} error={errorFor("pickupWindowEndsAt")} onChange={(event) => update("pickupWindowEndsAt", event.target.value)} />
    <Input label={t("Entrega desde", "Delivery starts")} type="datetime-local" value={draft.deliveryWindowStartsAt} error={errorFor("deliveryWindowStartsAt")} onChange={(event) => update("deliveryWindowStartsAt", event.target.value)} />
    <Input label={t("Entrega hasta", "Delivery ends")} type="datetime-local" value={draft.deliveryWindowEndsAt} error={errorFor("deliveryWindowEndsAt")} onChange={(event) => update("deliveryWindowEndsAt", event.target.value)} />
    <OptionSelect fieldClassName={styles.wide} label={t("Equipo ROAD requerido", "Required ROAD equipment")} placeholder={t("Seleccionar equipo", "Select equipment")} options={options.equipmentOptions} value={draft.requiredEquipment} error={errorFor("requiredEquipment")} onChange={(value) => update("requiredEquipment", value)} t={t} />
    <OptionEvidence label={t("Contrato de equipo", "Equipment contract")} value={t("Se envía exactamente el code ROAD del backend; seleccionarlo no confirma disponibilidad de un activo.", "The exact backend ROAD code is sent; selecting it does not confirm asset availability.")} />
  </div>
  <h3 className={styles.sectionTitle}><ContactRound size={16} aria-hidden="true" />{t("Contactos operativos", "Operational contacts")}</h3><div className={styles.contactGrid}><ContactFields kind="pickup" draft={draft} update={update} errorFor={errorFor} t={t} /><ContactFields kind="recipient" draft={draft} update={update} errorFor={errorFor} t={t} /></div></>;
}

function ContactFields({ kind, draft, update, errorFor, t }: Pick<FieldHelpers, "draft" | "update" | "errorFor" | "t"> & { kind: "pickup" | "recipient" }) {
  const pickup = kind === "pickup";
  const name = pickup ? "pickupContactName" : "recipientContactName";
  const phone = pickup ? "pickupContactPhoneE164" : "recipientContactPhoneE164";
  const email = pickup ? "pickupContactEmail" : "recipientContactEmail";
  return <fieldset className={styles.optionFieldset}><legend>{pickup ? t("Contacto de retiro", "Pickup contact") : t("Destinatario", "Recipient")}</legend><div className={styles.contactFields}><Input label={t("Nombre", "Name")} value={draft[name]} error={errorFor(name)} onChange={(event) => update(name, event.target.value)} /><Input label={t("Teléfono E.164", "E.164 phone")} type="tel" placeholder="+51987654321" value={draft[phone]} error={errorFor(phone)} onChange={(event) => update(phone, event.target.value)} /><Input label={t("Correo", "Email")} type="email" value={draft[email]} error={errorFor(email)} onChange={(event) => update(email, event.target.value)} /></div></fieldset>;
}

function ReviewStep({ draft, options, request, dirtyAfterCreate, t, locale }: { draft: V2IntakePrototypeDraft; options: IntakeOptionsData; request: FreightRequestV2Data | null; dirtyAfterCreate: boolean; t: Translate; locale: "es" | "en" }) {
  const origin = findIntakeFacility(options, draft.originFacilityId);
  const destination = findIntakeFacility(options, draft.destinationFacilityId);
  return <div className={styles.reviewGrid}>
    <ReviewSection title={t("Sedes", "Facilities")} items={[[t("Origen", "Origin"), origin?.label ?? "—"], [t("Destino", "Destination"), destination?.label ?? "—"]]} />
    <ReviewSection title={t("Carga y unidad", "Cargo and unit")} items={[[t("Categoría", "Category"), draft.categoryCode], [t("Peso / volumen", "Weight / volume"), `${draft.totalWeightKg} kg · ${draft.totalVolumeM3} m³`], [t("Unidad", "Unit"), `${draft.unitQuantity} × ${draft.unitPackageType}`], [t("Equipo", "Equipment"), draft.requiredEquipment]]} />
    <ReviewSection title={t("Ventanas", "Windows")} items={[[t("Retiro", "Pickup"), formatLocalRange(draft.pickupWindowStartsAt, draft.pickupWindowEndsAt, locale)], [t("Entrega", "Delivery"), formatLocalRange(draft.deliveryWindowStartsAt, draft.deliveryWindowEndsAt, locale)]]} />
    <ReviewSection title={t("Límites comerciales", "Commercial boundaries")} tone="unknown" items={[[t("Elegibilidad", "Serviceability"), t("Se lee después de persistir DRAFT", "Read after DRAFT persistence")], [t("Precio / oferta / booking", "Price / offer / booking"), t("No confirmados ni creados", "Not confirmed or created")]]} />
    {request ? <div className={styles.persistedNotice} role="status"><strong>{request.referenceCode} · {request.status} · v{request.draftVersion}</strong><span>{dirtyAfterCreate ? t("Hay cambios locales posteriores; no se guardaron automáticamente.", "There are later local changes; they were not autosaved.") : t("El GET devolvió el borrador persistido.", "GET returned the persisted draft.")}</span></div> : null}
  </div>;
}

function ReviewSection({ title, items, tone = "preliminary" }: { title: string; items: string[][]; tone?: "preliminary" | "unknown" }) {
  return <section className={styles.reviewSection}><header><h3>{title}</h3><Badge tone={tone}>{tone === "unknown" ? "UNKNOWN" : "LOCAL"}</Badge></header><div className={styles.reviewList}>{items.map(([label, value]) => <div className={styles.reviewItem} key={label}><span>{label}</span><strong>{value}</strong></div>)}</div></section>;
}

function LiveSummary({ draft, options, request, evaluation, dirtyAfterCreate, t }: { draft: V2IntakePrototypeDraft; options: IntakeOptionsData; request: FreightRequestV2Data | null; evaluation: RoadServiceabilityEvaluationV2Data | null; dirtyAfterCreate: boolean; t: Translate }) {
  const origin = findIntakeFacility(options, draft.originFacilityId);
  const destination = findIntakeFacility(options, draft.destinationFacilityId);
  return <aside className={`${styles.card} ${styles.summary}`} aria-label={t("Resumen en vivo", "Live summary")}><header className={styles.cardHeader}><div><span className={styles.eyebrow}>{t("Resumen local", "Local summary")}</span><h2>{t("Solicitud de cliente", "Client request")}</h2><p>{t("Los pasos no se guardan automáticamente.", "Steps are not autosaved.")}</p></div></header><div className={styles.summaryBody}>
    <SummaryRow label={t("Origen", "Origin")} value={origin?.label ?? t("Sin seleccionar", "Not selected")} tone={origin ? "preliminary" : "neutral"} status={origin ? t("Local", "Local") : t("Pendiente", "Pending")} />
    <SummaryRow label={t("Destino", "Destination")} value={destination?.label ?? t("Sin seleccionar", "Not selected")} tone={destination ? "preliminary" : "neutral"} status={destination ? t("Local", "Local") : t("Pendiente", "Pending")} />
    <SummaryRow label={t("Carga", "Cargo")} value={draft.cargoDescription || t("Sin describir", "Not described")} tone={draft.cargoDescription ? "preliminary" : "neutral"} status={draft.cargoDescription ? t("Local", "Local") : t("Pendiente", "Pending")} />
    <SummaryRow label={t("Persistencia", "Persistence")} value={request ? `${request.referenceCode} · v${request.draftVersion}` : t("Aún no creada", "Not created yet")} tone={request ? "confirmed" : "unknown"} status={request ? request.status : "UNKNOWN"} hint={dirtyAfterCreate ? t("Cambios locales sin autosave", "Local changes without autosave") : undefined} />
    <SummaryRow label={t("Elegibilidad", "Serviceability")} value={evaluation ? `${evaluation.summaryCounts.totalEvaluated} ${t("evaluados", "evaluated")}` : t("Aún no consultada", "Not queried yet")} tone={evaluation?.overallStatus === "eligible" ? "confirmed" : "unknown"} status={evaluation?.overallStatus.toUpperCase() ?? "UNKNOWN"} />
  </div><div className={styles.statusLegend}><Legend tone="preliminary" label={t("Local", "Local")} text={t("Editable; no persistido.", "Editable; not persisted.")} /><Legend tone="unknown" label="UNKNOWN" text={t("Sin evidencia suficiente.", "Insufficient evidence.")} /><Legend tone="confirmed" label="DRAFT" text={t("Devuelto por POST y GET V2.", "Returned by V2 POST and GET.")} /></div></aside>;
}

function ApiErrorState({ error, requestExists, retry, t }: { error: V2IntakeApiError; requestExists: boolean; retry: () => Promise<void>; t: Translate }) {
  return <div className={styles.apiError} role="alert"><div><strong>{error.code}</strong><span>{error.message}</span><small>{requestExists ? t("El DRAFT ya fue creado; el reintento sólo vuelve a leer y evaluar.", "The DRAFT was already created; retry only reads and evaluates again.") : t("No se declara persistencia hasta recibir el envelope v2.0.", "Persistence is not claimed until the v2.0 envelope is received.")}</small></div><Button variant="secondary" type="button" onClick={() => void retry()}><RefreshCw size={15} aria-hidden="true" />{t("Reintentar", "Retry")}</Button></div>;
}

function LoadingOrPending({ phase, retry, t }: { phase: SubmitPhase; retry: () => Promise<void>; t: Translate }) {
  const loading = ["reading", "evaluating"].includes(phase);
  return <div className={styles.pendingState} role="status"><span>{loading ? phaseLabel(phase, t) : t("La evaluación todavía no está disponible.", "The evaluation is not available yet.")}</span>{!loading ? <Button variant="secondary" type="button" onClick={() => void retry()}><RefreshCw size={15} aria-hidden="true" />{t("Consultar de nuevo", "Query again")}</Button> : null}</div>;
}

function OptionSelect({ label, placeholder, options, value, error, onChange, fieldClassName, t }: { label: string; placeholder: string; options: IntakeOption[]; value: string; error?: string; onChange: (value: string) => void; fieldClassName?: string; t: Translate }) {
  return <Select fieldClassName={fieldClassName} label={label} value={value} error={error} onChange={(event) => onChange(event.target.value)}><option value="">{placeholder}</option>{options.map((option) => <option value={option.code} key={option.code}>{optionLabel(option, t)}</option>)}</Select>;
}

function optionLabel(option: IntakeOption, t: Translate) {
  return `${t(option.labelEs, option.labelEn)} · ${option.code}`;
}

function verificationCopy(verification: IntakeOption["verification"], t: Translate) {
  if (verification === "RESOURCE_EVIDENCE") {
    return t("verification: RESOURCE_EVIDENCE · requiere evidencia del mismo recurso portador.", "verification: RESOURCE_EVIDENCE · evidence from the same carrying resource is required.");
  }
  if (verification === "REQUIRES_REVIEW") {
    return t("verification: REQUIRES_REVIEW · permanece desconocido hasta revisión documental y operativa.", "verification: REQUIRES_REVIEW · remains unknown until document and operational review.");
  }
  if (verification === "CAPTURE_ONLY") {
    return t("verification: CAPTURE_ONLY · sólo captura; no confirma compatibilidad.", "verification: CAPTURE_ONLY · capture only; compatibility is not confirmed.");
  }
  return undefined;
}

function CategoryGuidanceEvidence({ guidance, t }: { guidance: IntakeCargoCategoryGuidance; t: Translate }) {
  const fields = Array.isArray(guidance.intakeSpecificationSchema.fields)
    ? guidance.intakeSpecificationSchema.fields.filter((field): field is string => typeof field === "string")
    : [];
  const requirements = Object.entries(guidance.suggestedRequirements)
    .filter(([, enabled]) => enabled === true)
    .map(([code]) => code);
  const rows = [
    { label: t("Métodos", "Entry methods"), value: guidance.recommendedEntryMethods.join(", ") || "UNKNOWN" },
    { label: t("Campos", "Fields"), value: fields.join(", ") || "UNKNOWN" },
    { label: t("Requisitos sugeridos", "Suggested requirements"), value: requirements.join(", ") || t("ninguno declarado", "none declared") },
    { label: t("Vehículos recomendados", "Recommended vehicles"), value: guidance.recommendedVehicleClasses.join(", ") || "UNKNOWN" },
  ];
  return <div className={styles.optionEvidence}>
    <small>{t("Guía de categoría", "Category guidance")}</small>
    <dl className={styles.guidanceList}>{rows.map((row) => <div key={row.label}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl>
  </div>;
}

function OptionEvidence({ label, value }: { label: string; value: string }) {
  return <div className={styles.optionEvidence}><small>{label}</small><strong>{value}</strong></div>;
}

function SummaryRow({ label, value, tone, status, hint }: { label: string; value: string; tone: "preliminary" | "unknown" | "confirmed" | "neutral"; status: string; hint?: string }) {
  return <div className={styles.summaryRow}><span>{label}</span><div className={styles.summaryValue}><strong>{value}</strong><Badge tone={tone}>{status}</Badge></div>{hint ? <small className={styles.summaryHint}>{hint}</small> : null}</div>;
}

function Legend({ tone, label, text }: { tone: "preliminary" | "unknown" | "confirmed"; label: string; text: string }) {
  return <div className={styles.legendItem}><Badge tone={tone}>{label}</Badge><span>{text}</span></div>;
}

function normalizeApiError(error: unknown) {
  if (error instanceof V2IntakeApiError) return error;
  return new V2IntakeApiError({
    code: "NETWORK_ERROR",
    message: error instanceof Error ? error.message : "The V2 API could not be reached.",
    status: 0,
    retryable: true,
  });
}

function phaseLabel(phase: SubmitPhase, t: Translate) {
  if (phase === "creating") return t("Creando DRAFT…", "Creating DRAFT…");
  if (phase === "reading") return t("Leyendo DRAFT…", "Reading DRAFT…");
  if (phase === "evaluating") return t("Evaluando servicio…", "Evaluating serviceability…");
  return t("Procesando…", "Processing…");
}

function stepDescription(step: PrototypeStep, t: Translate) {
  return [
    t("Elige facilityId; el servidor conserva la autoridad sobre tenant y coordenadas.", "Choose facilityId; the server remains authoritative for tenant and coordinates."),
    t("Captura CargoSpecification y units[] sin calcular capacidad en el navegador.", "Capture CargoSpecification and units[] without computing capacity in the browser."),
    t("Define ventanas, equipo y ambos ShipmentContact.", "Define windows, equipment, and both ShipmentContact values."),
    t("Revalida y ejecuta POST → GET → GET serviceability con una clave idempotente.", "Revalidate and run POST → GET → GET serviceability with an idempotency key."),
  ][step - 1];
}

function formatLocalRange(start: string, end: string, locale: "es" | "en") {
  if (!start || !end) return "—";
  const formatter = new Intl.DateTimeFormat(locale === "es" ? "es-PE" : "en-US", { dateStyle: "medium", timeStyle: "short" });
  return `${formatter.format(new Date(start))} → ${formatter.format(new Date(end))}`;
}

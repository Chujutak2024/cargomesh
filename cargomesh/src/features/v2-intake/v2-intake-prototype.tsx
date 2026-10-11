"use client";

import {
  ArrowLeft,
  ArrowRight,
  Bot,
  CalendarDays,
  Check,
  ChevronDown,
  ClipboardCheck,
  ContactRound,
  Copy,
  Info,
  Loader2,
  MapPinned,
  Package,
  Route,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  Truck,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

import { Badge, Button, Checkbox, Input, Select, Textarea } from "@/components/ui";
import { useLocale } from "@/features/i18n/locale-provider";
import { CandidateResults } from "./components/candidate-results";
import { FacilityPicker } from "./components/facility-picker";
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
  applyChatFieldsToDraft,
  buildPrototypeExample,
  findIntakeFacility,
  mapDraftToCreateFreightRequestV2Input,
  mapDraftToRevisionInput,
  requestToPrototypeDraft,
  toggleRequirement,
  updatePrototypeDraftField,
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
  reviseFreightRequestV2,
} from "./v2-intake-client";
import { ContentMotion } from "@/features/product-motion/content-motion";
import styles from "./v2-intake-prototype.module.css";

const STEP_ICONS = [MapPinned, Package, CalendarDays, ClipboardCheck] as const;
const CHAT_REQUEST_SESSION_KEY = "cargomesh-v2-chat-request-id";

type SubmitPhase = "idle" | "creating" | "revising" | "reading" | "evaluating" | "success" | "error";
type Translate = (spanish: string, english: string) => string;

export function V2IntakePrototype({embedded=false,onPersisted,onEvaluation}:{embedded?:boolean;onPersisted?:(request:FreightRequestV2Data)=>void;
 onEvaluation?:(request:FreightRequestV2Data,evaluation:RoadServiceabilityEvaluationV2Data,selectedCandidateId:string|null)=>void}={}) {
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
  const revisionKeyRef = useRef<{ fingerprint: string; key: string } | null>(null);
  const recoveryAttemptedRef = useRef(false);
  const onPersistedRef = useRef(onPersisted);
  onPersistedRef.current = onPersisted;
  const flowSequenceRef = useRef(0);
  const draftRevisionRef = useRef(0);
  const submitInFlightRef = useRef(false);

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
    if (!options || recoveryAttemptedRef.current) return;
    recoveryAttemptedRef.current = true;
    const requestId = window.sessionStorage.getItem(CHAT_REQUEST_SESSION_KEY);
    if (!requestId) return;
    let active = true;
    setSubmitPhase("reading");
    void getFreightRequestV2(requestId).then(async (loaded) => {
      if (!active) return;
      const restored = requestToPrototypeDraft(loaded.data);
      setRequest(loaded.data);
      onPersistedRef.current?.(loaded.data);
      if (restored && options.facilities.some((facility) => facility.facilityId === restored.originFacilityId)
        && options.facilities.some((facility) => facility.facilityId === restored.destinationFacilityId)) {
        setDraft(restored);
        setStep(4);
        setMaxVisited(4);
        setDirtyAfterCreate(false);
      } else {
        setSubmitError(new V2IntakeApiError({ code: "REQUEST_NOT_EDITABLE_IN_INTAKE", message: "This saved request has locations or units this guided intake cannot edit without losing data. Open its request workspace.", status: 422, retryable: false }));
      }
      const result = await getRoadServiceabilityV2(loaded.data.id, loaded.data.draftVersion);
      if (!active) return;
      assertServiceabilityCorrelation(loaded.data, result.data);
      setEvaluation(result.data);
      setSelectedCandidateId(reconcileCandidateSelection(null, result.data));
      if (restored && options.facilities.some((facility) => facility.facilityId === restored.originFacilityId)
        && options.facilities.some((facility) => facility.facilityId === restored.destinationFacilityId)) setSubmitPhase("success");
    }).catch((error: unknown) => {
      if (!active) return;
      setSubmitError(normalizeApiError(error));
      setSubmitPhase("error");
    });
    return () => { active = false; };
  }, [options]);

  useEffect(()=>{
    if(request && evaluation && request.id===evaluation.freightRequestId && request.draftVersion===evaluation.evaluatedDraftVersion)
      onEvaluation?.(request,evaluation,selectedCandidateId);
  },[request,evaluation,selectedCandidateId,onEvaluation]);

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
  const ActiveStepIcon = STEP_ICONS[step - 1];
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
    setDraft((current) => updatePrototypeDraftField(current, field, value));
    setIssues((current) => current.filter((issue) => issue.field !== field));
    if (request) { setDirtyAfterCreate(true); setEvaluation(null); setSelectedCandidateId(null); }
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
    if (request) { setEvaluation(null); setSelectedCandidateId(null); }
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
    submitInFlightRef.current = false;
    idempotencyRef.current = null;
    revisionKeyRef.current = null;
    recoveryAttemptedRef.current = true;
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
    onPersisted?.(roundTrip.data);
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
    if (submitInFlightRef.current) return;
    if (!enterReview()) return;
    if (request && !dirtyAfterCreate) { await retryAfterCreate(); return; }
    if (request && request.status !== "DRAFT") {
      setSubmitError(new V2IntakeApiError({ code: "INVALID_TRANSITION", message: "Only a DRAFT can be revised here.", status: 409, retryable: false }));
      return;
    }
    if (request && !requestToPrototypeDraft(request)) {
      setSubmitError(new V2IntakeApiError({ code: "REQUEST_NOT_EDITABLE_IN_INTAKE", message: "This request cannot be represented safely in the guided intake. Open its request workspace.", status: 422, retryable: false }));
      return;
    }
    submitInFlightRef.current = true;
    setSubmitError(null);
    setEvaluation(null);
    const flowSequence = flowSequenceRef.current + 1;
    flowSequenceRef.current = flowSequence;
    const submittedDraftRevision = draftRevisionRef.current;
    try {
      let payload: ReturnType<typeof mapDraftToCreateFreightRequestV2Input>;
      try {
        payload = request ? mapDraftToRevisionInput(draft, activeOptions, request)
          : mapDraftToCreateFreightRequestV2Input(draft, activeOptions);
      } catch (error) {
        throw new V2IntakeApiError({ code: "LOCAL_CONTRACT_ERROR", message: error instanceof Error ? error.message : "The current selection cannot be mapped to the V2 request contract.", status: 422, retryable: false });
      }
      const fingerprint = JSON.stringify({ requestId: request?.id, version: request?.draftVersion, payload });
      let created: { data: FreightRequestV2Data };
      if (request) {
        if (!revisionKeyRef.current || revisionKeyRef.current.fingerprint !== fingerprint) {
          revisionKeyRef.current = { fingerprint, key: crypto.randomUUID() };
        }
        setSubmitPhase("revising");
        created = await reviseFreightRequestV2(request.id, request.draftVersion, payload, revisionKeyRef.current.key);
        revisionKeyRef.current = null;
      } else {
        if (!idempotencyRef.current || idempotencyRef.current.fingerprint !== fingerprint) {
          idempotencyRef.current = { fingerprint, key: crypto.randomUUID() };
        }
        setSubmitPhase("creating");
        created = await createFreightRequestV2(payload, idempotencyRef.current.key);
      }
      if (flowSequence !== flowSequenceRef.current) return;
      setRequest(created.data);
      window.sessionStorage.setItem(CHAT_REQUEST_SESSION_KEY, created.data.id);
      setDirtyAfterCreate(draftRevisionRef.current !== submittedDraftRevision);
      await readAndEvaluate(created.data, flowSequence, submittedDraftRevision);
    } catch (error) {
      if (flowSequence !== flowSequenceRef.current) return;
      setSubmitError(normalizeApiError(error));
      setSubmitPhase("error");
    } finally {
      submitInFlightRef.current = false;
    }
  };
  const retryAfterCreate = async () => {
    if (submitInFlightRef.current) return;
    submitInFlightRef.current = true;
    if (!request) {
      submitInFlightRef.current = false;
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
    } finally {
      submitInFlightRef.current = false;
    }
  };

  const reloadPersisted = async () => {
    if (!request || submitInFlightRef.current) return;
    submitInFlightRef.current = true;
    const flowSequence = ++flowSequenceRef.current;
    setSubmitPhase("reading");
    setSubmitError(null);
    setEvaluation(null);
    setSelectedCandidateId(null);
    try {
      const loaded = await getFreightRequestV2(request.id);
      if (flowSequence !== flowSequenceRef.current) return;
      const restored = requestToPrototypeDraft(loaded.data);
      if (!restored || !activeOptions.facilities.some((facility) => facility.facilityId === restored.originFacilityId)
        || !activeOptions.facilities.some((facility) => facility.facilityId === restored.destinationFacilityId)) {
        throw new V2IntakeApiError({ code: "REQUEST_NOT_EDITABLE_IN_INTAKE", message: "This request cannot be represented safely in the guided intake. Open its request workspace.", status: 422, retryable: false });
      }
      draftRevisionRef.current += 1;
      setDraft(restored);
      setRequest(loaded.data);
      setDirtyAfterCreate(false);
      setIssues([]);
      revisionKeyRef.current = null;
      await readAndEvaluate(loaded.data, flowSequence);
    } catch (error) {
      if (flowSequence !== flowSequenceRef.current) return;
      setSubmitError(normalizeApiError(error));
      setSubmitPhase("error");
    } finally {
      submitInFlightRef.current = false;
    }
  };

  const updateFromChat = (fields: ReadonlyArray<{ field: ConversationField; value: string }>) => {
    if (!fields.length) return;
    draftRevisionRef.current += 1;
    setDraft((current) => applyChatFieldsToDraft(current, fields));
    setIssues((current) => current.filter((issue) => !fields.some((item) => item.field === issue.field)));
    if (request) { setDirtyAfterCreate(true); setEvaluation(null); setSelectedCandidateId(null); }
  };

  return (
    <div className={`${styles.page} ${embedded?styles.embedded:""}`}>
      <div className={styles.frame}>
        <header className={styles.hero}>
          <div className={styles.heroMain}>
            {!embedded ? <span className={styles.heroIcon} aria-hidden="true"><Package size={24} /></span> : null}
            <div className={styles.heroCopy}>
              {embedded?<h2>{t("Datos de la solicitud", "Request details")}</h2>:<h1>{t("Crea tu solicitud de transporte", "Create your freight request")}</h1>}
              {embedded ? <p>{t("Prepara el borrador y comprueba sus datos antes de enviarlo.", "Prepare the draft and check its details before saving it.")}</p> : null}
            </div>
          </div>
          {(!embedded || optionsSource !== "api") ? <div className={styles.heroActions}>
            {optionsSource !== "api" ? <Badge tone={optionsSource === "error" ? "unknown" : "preliminary"}>
              {optionsSource === "loading" ? t("Consultando opciones", "Loading options")
                : optionsSource === "fixture" ? t("Fixture dev explícito", "Explicit dev fixture")
                : t("Error de opciones", "Options error")}
            </Badge> : null}
            {!embedded ? <>
              <Button variant="secondary" type="button" disabled={!options || options.facilities.length < 2 || !optionCoverage.complete} onClick={loadExample}><Sparkles size={16} aria-hidden="true" />{t("Cargar ejemplo V2", "Load V2 example")}</Button>
              <Button variant="secondary" type="button" onClick={() => document.getElementById("v2-chat-text")?.focus()}><Bot size={16} aria-hidden="true" />{t("Escribir al asistente", "Write to assistant")}</Button>
            </> : null}
          </div> : null}
        </header>

        {!embedded && options && optionCoverage.complete && !optionCoverage.emptyFacilities ? <ConversationChat presentation="inline" draft={draft} options={activeOptions} optionsSource={optionsSource === "fixture" ? "fixture" : "api"} request={request} evaluation={evaluation} error={submitError ?? optionsError} draftDirty={dirtyAfterCreate}
          canRevise={Boolean(request && requestToPrototypeDraft(request) && request.status === "DRAFT")}
          busy={["creating", "revising", "reading", "evaluating"].includes(submitPhase)} onFields={updateFromChat}
          onSave={() => { void createDraftAndEvaluate(); }} onRead={() => { void retryAfterCreate(); }} onEvaluate={() => { void retryAfterCreate(); }}
          onEdit={(target) => { setStep(target); setMaxVisited((current) => Math.max(current, target) as PrototypeStep); setIssues([]); }}
          onReload={() => { void reloadPersisted(); }} onStartOver={reset} /> : null}

        {optionsSource === "fixture" ? <div className={`${styles.notice} ${styles.fixtureNotice}`} role="note">
          <Info size={18} aria-hidden="true" />
          <div><strong>{t("Fixture de desarrollo activado explícitamente", "Explicit development fixture enabled")}</strong>
          <span>{t("NEXT_PUBLIC_V2_INTAKE_OPTIONS_SOURCE=fixture omite el GET sólo en desarrollo. El JSON está rotulado SIMULATED y crear todavía requiere el POST real.", "NEXT_PUBLIC_V2_INTAKE_OPTIONS_SOURCE=fixture skips GET only in development. The JSON is labelled SIMULATED and creation still requires the real POST.")}</span></div>
        </div> : null}

        {optionsSource === "loading" ? <OptionsLoadingState t={t} embedded={embedded} /> : null}
        {optionsSource === "error" && optionsError ? (
          <OptionsErrorState error={optionsError} retry={() => setOptionsAttempt((attempt) => attempt + 1)} t={t} embedded={embedded} />
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
        <div className={styles.stepProgress} aria-hidden="true"><span style={{width:`${step/4*100}%`}}/></div>

        <div className={styles.workspace}>
          <ContentMotion identity={step} focusOnChange className={styles.stepMotion}><section className={styles.card} aria-labelledby={`prototype-step-${step}`}>
            <header className={styles.cardHeader}>
              <span className={styles.stepHeaderIcon} aria-hidden="true"><ActiveStepIcon size={20} /></span>
              <div><span className={styles.eyebrow}>{t(`Paso ${step} de 4`, `Step ${step} of 4`)}</span><h2 tabIndex={-1} id={`prototype-step-${step}`}>{stepLabels[step - 1]}</h2></div>
              <Badge tone={step === 4 ? "confirmed" : "preliminary"}>{step === 4 ? t("Listo para crear", "Ready to create") : t("Edición local", "Local editing")}</Badge>
            </header>
            <div className={styles.cardBody}>
              {issues.length ? <div className={styles.errorSummary} role="alert" tabIndex={-1} ref={errorRef}><strong>{t("Revisa los campos marcados", "Review the marked fields")}</strong><span>{t(`Hay ${issues.length} dato(s) pendiente(s) en este paso.`, `There are ${issues.length} pending field(s) in this step.`)}</span></div> : null}
              {step === 1 ? <FacilityStep draft={draft} options={activeOptions} update={update} errorFor={errorFor} t={t} /> : null}
              {step === 2 ? <CargoStep draft={draft} options={activeOptions} update={update} errorFor={errorFor} t={t} /> : null}
              {step === 3 ? <ScheduleAndContactsStep draft={draft} options={activeOptions} update={update} errorFor={errorFor} t={t} /> : null}
              {step === 4 ? <ReviewStep draft={draft} options={activeOptions} request={request} dirtyAfterCreate={dirtyAfterCreate} t={t} locale={locale} onEdit={(target) => { setStep(target); setIssues([]); }} /> : null}
              {submitError ? <ApiErrorState error={submitError} requestExists={Boolean(request)} dirty={dirtyAfterCreate} retry={dirtyAfterCreate ? createDraftAndEvaluate : retryAfterCreate} reload={request ? reloadPersisted : undefined} t={t} embedded={embedded} /> : null}
            </div>
            <footer className={styles.footer}>
              <Button variant="ghost" type="button" onClick={reset}><RotateCcw size={16} aria-hidden="true" />{t("Reiniciar", "Reset")}</Button>
              <div className={styles.footerRight}>
                {step > 1 ? <Button variant="secondary" type="button" onClick={() => { setStep((step - 1) as PrototypeStep); setIssues([]); }}><ArrowLeft size={16} aria-hidden="true" />{t("Anterior", "Back")}</Button> : null}
                {step < 4 ? <Button type="button" onClick={goNext}>{t("Continuar", "Continue")}<ArrowRight size={16} aria-hidden="true" /></Button> : (
                  <Button variant="accent" type="button" isLoading={["creating", "revising", "reading", "evaluating"].includes(submitPhase)} loadingLabel={phaseLabel(submitPhase, t)} onClick={createDraftAndEvaluate}>
                    <ClipboardCheck size={16} aria-hidden="true" />{request && dirtyAfterCreate ? t("Guardar revisión y reevaluar", "Save revision & reevaluate") : request ? t("Consultar evaluación", "Refresh evaluation") : t("Crear DRAFT y evaluar", "Create DRAFT & evaluate")}
                  </Button>
                )}
              </div>
            </footer>
          </section></ContentMotion>

          <LiveSummary draft={draft} options={activeOptions} request={request} evaluation={evaluation} dirtyAfterCreate={dirtyAfterCreate} t={t} />
        </div>

        {request ? (
          <section className={styles.integrationArea} aria-live="polite">
            <header className={styles.integrationHeader}>
              <div><span className={styles.eyebrow}>{request.referenceCode}</span><h2>{t("Borrador persistido y lectura operativa", "Persisted draft and operational read")}</h2><p>{t(`Estado ${request.status} · draftVersion ${request.draftVersion}`, `Status ${request.status} · draftVersion ${request.draftVersion}`)}</p></div>
              <div className={styles.integrationActions}><Badge tone={request.status === "DRAFT" ? "preliminary" : "neutral"}>{request.status}</Badge><Link className={styles.requestLink} href={`/requests/${request.id}`}>{t("Continuar solicitud", "Continue request")}<ArrowRight size={14}/></Link></div>
            </header>
            {dirtyAfterCreate ? <div className={styles.pendingState} role="status">{t(
              "Los cambios del formulario son locales. La evaluación anterior se ocultó; confirma la revisión para actualizar tarjetas y mapa.",
              "Form changes are local. The previous evaluation is hidden; confirm the revision to refresh cards and map.",
            )}</div> : null}
            {evaluation ? <CandidateResults evaluation={evaluation} selectedCandidateId={selectedCandidateId} onSelectCandidate={setSelectedCandidateId} t={t} /> : <LoadingOrPending phase={submitPhase} dirty={dirtyAfterCreate} retry={retryAfterCreate} t={t} />}
            {mapProps ? <RoadCandidateMapBoundary props={mapProps} t={t} /> : null}
          </section>
        ) : null}
        </> : null}
      </div>
      {embedded ? <ConversationChat draft={draft} options={activeOptions} optionsSource={optionsSource === "fixture" ? "fixture" : "api"} request={request} evaluation={evaluation} error={submitError ?? optionsError} draftDirty={dirtyAfterCreate}
        canRevise={Boolean(request && requestToPrototypeDraft(request) && request.status === "DRAFT")}
        busy={["creating", "revising", "reading", "evaluating"].includes(submitPhase)} onFields={updateFromChat} onSave={() => { void createDraftAndEvaluate(); }}
        onRead={() => { void retryAfterCreate(); }} onEvaluate={() => { void retryAfterCreate(); }}
        onEdit={(target) => { setStep(target); setMaxVisited((current) => Math.max(current, target) as PrototypeStep); setIssues([]); }}
        onReload={() => { void reloadPersisted(); }} onStartOver={reset} /> : null}
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

function OptionsLoadingState({ t, embedded = false }: { t: Translate; embedded?: boolean }) {
  return <div className={styles.optionsState} role="status"><Loader2 className={styles.spinner} size={20} aria-hidden="true" /><div><strong>{embedded ? t("Consultando el catálogo", "Loading the catalog") : t("Cargando selectores autenticados", "Loading authenticated selectors")}</strong><span>{embedded ? t("Cargando ubicaciones y opciones de carga autorizadas.", "Loading authorized locations and cargo options.") : t("Esperando los cinco grupos de GET /api/v2/intake/options.", "Waiting for the five groups from GET /api/v2/intake/options.")}</span></div></div>;
}

function OptionsErrorState({ error, retry, t, embedded = false }: { error: V2IntakeApiError; retry: () => void; t: Translate; embedded?: boolean }) {
  return <div className={styles.optionsError} role="alert"><ShieldAlert size={20} aria-hidden="true" /><div><strong>{embedded ? t("No se pudo cargar el catálogo", "The catalog could not be loaded") : error.code}</strong><span>{embedded ? intakeErrorCopy(error, t) : error.message}</span><small>{embedded ? t("El formulario estará disponible cuando podamos consultar tus opciones autorizadas.", "The form will be available when your authorized options can be loaded.") : t("El formulario permanece bloqueado: errores 401/403, red o contrato nunca activan el fixture automáticamente.", "The form remains blocked: 401/403, network, or contract errors never activate the fixture automatically.")}</small></div><Button variant="secondary" type="button" onClick={retry}><RefreshCw size={15} aria-hidden="true" />{embedded ? t("Reintentar", "Retry") : t("Reintentar GET", "Retry GET")}</Button></div>;
}

function EmptyFacilitiesState({ t }: { t: Translate }) {
  return <div className={styles.optionsState} role="status"><MapPinned size={20} aria-hidden="true" /><div><strong>{t("No hay sedes disponibles", "No facilities available")}</strong><span>{t("El catálogo autenticado devolvió facilities: []. No se inventan sedes ni se habilita el POST.", "The authenticated catalog returned facilities: []. No facilities are invented and POST remains disabled.")}</span></div></div>;
}

function FacilityStep({ draft, options, update, errorFor, t }: FieldHelpers) {
  return <div className={styles.facilityGrid}>
    <FacilityPicker kind="origin" facilities={options.facilities} value={draft.originFacilityId} excludedFacilityId={draft.destinationFacilityId} error={errorFor("originFacilityId")} onChange={(value) => update("originFacilityId", value)} t={t} />
    <FacilityPicker kind="destination" facilities={options.facilities} value={draft.destinationFacilityId} excludedFacilityId={draft.originFacilityId} error={errorFor("destinationFacilityId")} onChange={(value) => update("destinationFacilityId", value)} t={t} />
  </div>;
}

function CargoStep({ draft, options, update, errorFor, t }: FieldHelpers) {
  const category = options.cargoCategories.find((option) => option.code === draft.categoryCode);
  const packaging = options.packagingOptions.find((option) => option.code === draft.packaging);
  const unitPackaging = options.packagingOptions.find((option) => option.code === draft.unitPackageType);
  const dimensionFields: Array<keyof V2IntakePrototypeDraft> = ["unitLengthCm", "unitWidthCm", "unitHeightCm"];
  const hasDimensionErrors = dimensionFields.some((field) => Boolean(errorFor(field)));
  const [unitDetailsOpen, setUnitDetailsOpen] = useState(Boolean(draft.unitLengthCm));
  useEffect(() => { if (hasDimensionErrors) setUnitDetailsOpen(true); }, [hasDimensionErrors]);
  const suggestedRequirements = category ? Object.entries(category.guidance.suggestedRequirements)
    .filter(([, enabled]) => enabled === true)
    .map(([code]) => code)
    .filter((code) => options.requirementOptions.some((option) => option.code === code)) : [];

  return <>
    <section className={styles.formSection}>
      <header className={styles.formSectionHeader}><div><h3 className={styles.sectionTitle}><Package size={17} aria-hidden="true" />{t("¿Qué necesitas transportar?", "What are you shipping?")}</h3></div></header>
      <div className={styles.formGrid}>
        <OptionSelect label={t("Categoría de carga", "Cargo category")} placeholder={t("Seleccionar categoría", "Select category")} options={options.cargoCategories} value={draft.categoryCode} error={errorFor("categoryCode")} onChange={(value) => update("categoryCode", value)} t={t} />
        <OptionSelect label={t("Embalaje principal", "Primary packaging")} placeholder={t("Seleccionar embalaje", "Select packaging")} options={options.packagingOptions} value={draft.packaging} error={errorFor("packaging")} onChange={(value) => { update("packaging", value); if (!draft.unitPackageType) update("unitPackageType", value); }} t={t} />
        <Textarea fieldClassName={styles.wide} label={t("Descripción operativa", "Operational description")} hint={t("Describe el contenido sin incluir precio, carrier o supuestos de cobertura.", "Describe the contents without price, carrier, or coverage assumptions.")} rows={3} value={draft.cargoDescription} error={errorFor("cargoDescription")} onChange={(event) => update("cargoDescription", event.target.value)} />
        <Checkbox label={t("La carga puede dividirse", "Cargo may be split")} hint={t("Dato declarado; no implica que un carrier pueda fraccionarla.", "Declared fact; it does not imply a carrier can split it.")} checked={draft.divisible} onChange={(event) => update("divisible", event.target.checked)} />
        {packaging?.verification ? <OptionEvidence label="verification" value={`${packaging.verification} · ${t("Captura del embalaje; no confirma manipulación ni compatibilidad.", "Packaging capture; it does not confirm handling or compatibility.")}`} /> : null}
      </div>
      {category ? <details className={styles.guidanceDisclosure}><summary><span>{t("Ver guía recomendada por la categoría", "View category guidance")}</span><ChevronDown size={16} aria-hidden="true" /></summary><CategoryGuidanceEvidence guidance={category.guidance} t={t} /></details> : null}
    </section>

    {category ? <fieldset className={styles.choiceFieldset}><legend>{t("Condiciones y requisitos", "Conditions and requirements")}</legend><div className={styles.choiceHeading}><p>{t("Selecciona únicamente lo que necesita esta carga. Cada estado de verificación se conserva.", "Select only what this cargo needs. Every verification state is preserved.")}</p>{suggestedRequirements.length ? <Button variant="ghost" type="button" onClick={() => update("requirements", [...new Set([...draft.requirements, ...suggestedRequirements])])}><Sparkles size={14} aria-hidden="true" />{t("Aplicar sugeridos", "Apply suggested")}</Button> : null}</div><div className={styles.checkboxGrid}>{options.requirementOptions.map((option) => <Checkbox key={option.code} label={optionLabel(option, t)} hint={verificationCopy(option.verification, t)} checked={draft.requirements.includes(option.code)} onChange={(event) => update("requirements", toggleRequirement(draft.requirements, option.code, event.target.checked))} />)}</div></fieldset> : null}

    {draft.requirements.includes("TEMP_CONTROLLED") ? <section className={`${styles.formSection} ${styles.temperatureSection}`}><header className={styles.formSectionHeader}><div><span className={styles.sectionKicker}>TEMP_CONTROLLED</span><h3>{t("Rango de temperatura declarado", "Declared temperature range")}</h3></div><Badge tone="unknown">RESOURCE_EVIDENCE</Badge></header><div className={styles.formGrid}><Input label={t("Temperatura mínima (°C)", "Minimum temperature (°C)")} type="number" step="0.1" value={draft.temperatureMinCelsius} error={errorFor("temperatureMinCelsius")} onChange={(event) => update("temperatureMinCelsius", event.target.value)} /><Input label={t("Temperatura máxima (°C)", "Maximum temperature (°C)")} type="number" step="0.1" value={draft.temperatureMaxCelsius} error={errorFor("temperatureMaxCelsius")} onChange={(event) => update("temperatureMaxCelsius", event.target.value)} /></div></section> : null}

    {draft.packaging ? <section className={styles.formSection}>
      <header className={styles.formSectionHeader}><div><span className={styles.sectionKicker}>{t("Una sola captura", "One capture")}</span><h3 className={styles.sectionTitle}>{t("Unidad de carga", "Cargo unit")}</h3><p>{t("Ingresa cantidad y medidas por unidad; los totales se calculan automáticamente.", "Enter quantity and per-unit measures; totals are calculated automatically.")}</p></div></header>
      <div className={styles.unitGrid}>
        <OptionSelect label={t("Tipo de paquete", "Package type")} placeholder={t("Seleccionar tipo", "Select type")} options={options.packagingOptions} value={draft.unitPackageType} error={errorFor("unitPackageType")} onChange={(value) => update("unitPackageType", value)} t={t} />
        <Input label={t("Cantidad", "Quantity")} type="number" min="1" step="1" value={draft.unitQuantity} error={errorFor("unitQuantity")} onChange={(event) => update("unitQuantity", event.target.value)} />
        <Input label={t("Peso por unidad (kg)", "Weight per unit (kg)")} type="number" min="0" step="0.1" value={draft.unitWeightPerUnitKg} error={errorFor("unitWeightPerUnitKg")} onChange={(event) => update("unitWeightPerUnitKg", event.target.value)} />
        <Input label={t("Volumen por unidad (m³)", "Volume per unit (m³)")} type="number" min="0" step="0.1" value={draft.unitVolumePerUnitM3} error={errorFor("unitVolumePerUnitM3")} onChange={(event) => update("unitVolumePerUnitM3", event.target.value)} />
      </div>
      <div className={styles.computedTotals} aria-live="polite"><div><span>{t("Peso total calculado", "Calculated total weight")}</span><strong>{draft.totalWeightKg ? `${draft.totalWeightKg} kg` : "—"}</strong>{errorFor("totalWeightKg") ? <small>{errorFor("totalWeightKg")}</small> : null}</div><div><span>{t("Volumen total calculado", "Calculated total volume")}</span><strong>{draft.totalVolumeM3 ? `${draft.totalVolumeM3} m³` : "—"}</strong>{errorFor("totalVolumeM3") ? <small>{errorFor("totalVolumeM3")}</small> : null}</div></div>
      {unitPackaging?.verification ? <OptionEvidence label="verification" value={`${unitPackaging.verification} · ${t("Dato de captura; no prueba compatibilidad del carrier.", "Capture data; it does not prove carrier compatibility.")}`} /> : null}
      <details className={styles.advancedDisclosure} open={unitDetailsOpen} onToggle={(event) => setUnitDetailsOpen(event.currentTarget.open)}><summary><span><strong>{t("Dimensiones y manipulación", "Dimensions and handling")}</strong><small>{t("Campos contractuales obligatorios", "Required contract fields")}</small></span><ChevronDown size={17} aria-hidden="true" /></summary><div className={styles.formGrid}><Input label={t("Largo (cm)", "Length (cm)")} type="number" min="0" step="0.1" value={draft.unitLengthCm} error={errorFor("unitLengthCm")} onChange={(event) => update("unitLengthCm", event.target.value)} /><Input label={t("Ancho (cm)", "Width (cm)")} type="number" min="0" step="0.1" value={draft.unitWidthCm} error={errorFor("unitWidthCm")} onChange={(event) => update("unitWidthCm", event.target.value)} /><Input label={t("Alto (cm)", "Height (cm)")} type="number" min="0" step="0.1" value={draft.unitHeightCm} error={errorFor("unitHeightCm")} onChange={(event) => update("unitHeightCm", event.target.value)} /><div className={styles.handlingGrid}><Checkbox label={t("Unidad indivisible", "Indivisible unit")} checked={draft.unitIndivisible} onChange={(event) => update("unitIndivisible", event.target.checked)} /><Checkbox label={t("Apilable", "Stackable")} checked={draft.unitStackable} onChange={(event) => update("unitStackable", event.target.checked)} /></div></div></details>
    </section> : null}
  </>;
}

function ScheduleAndContactsStep({ draft, options, update, errorFor, t }: FieldHelpers) {
  const category = options.cargoCategories.find((option) => option.code === draft.categoryCode);
  const recommended = new Set(category?.guidance.recommendedVehicleClasses ?? []);
  const copyPickupContact = () => {
    update("recipientContactName", draft.pickupContactName);
    update("recipientContactPhoneE164", draft.pickupContactPhoneE164);
    update("recipientContactEmail", draft.pickupContactEmail);
  };
  return <>
    <section className={styles.formSection}>
      <header className={styles.formSectionHeader}><div><h3 className={styles.sectionTitle}><CalendarDays size={17} aria-hidden="true" />{t("¿Cuándo debe moverse?", "When should it move?")}</h3></div></header>
      <div className={styles.windowGrid}>
        <fieldset className={styles.windowCard}><legend>{t("Retiro", "Pickup")}</legend><Input label={t("Desde", "Starts")} type="datetime-local" value={draft.pickupWindowStartsAt} error={errorFor("pickupWindowStartsAt")} onChange={(event) => update("pickupWindowStartsAt", event.target.value)} /><Input label={t("Hasta", "Ends")} type="datetime-local" value={draft.pickupWindowEndsAt} error={errorFor("pickupWindowEndsAt")} onChange={(event) => update("pickupWindowEndsAt", event.target.value)} /></fieldset>
        <span className={styles.windowArrow} aria-hidden="true"><ArrowRight size={18} /></span>
        <fieldset className={styles.windowCard}><legend>{t("Entrega", "Delivery")}</legend><Input label={t("Desde", "Starts")} type="datetime-local" value={draft.deliveryWindowStartsAt} error={errorFor("deliveryWindowStartsAt")} onChange={(event) => update("deliveryWindowStartsAt", event.target.value)} /><Input label={t("Hasta", "Ends")} type="datetime-local" value={draft.deliveryWindowEndsAt} error={errorFor("deliveryWindowEndsAt")} onChange={(event) => update("deliveryWindowEndsAt", event.target.value)} /></fieldset>
      </div>
    </section>

    <fieldset className={styles.choiceFieldset}><legend>{t("Equipo ROAD requerido", "Required ROAD equipment")}</legend><div className={styles.equipmentGrid} role="radiogroup" aria-label={t("Equipo ROAD", "ROAD equipment")}>
      {options.equipmentOptions.map((option) => { const active = option.code === draft.requiredEquipment; const suggested = recommended.has(option.code); return <button className={styles.equipmentCard} data-selected={active ? "true" : "false"} type="button" role="radio" aria-checked={active} key={option.code} onClick={() => update("requiredEquipment", option.code)}><span className={styles.equipmentIcon}><Truck size={20} aria-hidden="true" /></span><span><strong>{t(option.labelEs, option.labelEn)}</strong><small>{option.code}</small></span>{suggested ? <Badge tone="preliminary">{t("Sugerido", "Suggested")}</Badge> : null}<span className={styles.equipmentCheck}><Check size={14} aria-hidden="true" /></span></button>; })}
    </div>{errorFor("requiredEquipment") ? <p className={styles.fieldError} role="alert">{errorFor("requiredEquipment")}</p> : null}</fieldset>

    <section className={styles.formSection}>
      <header className={styles.formSectionHeader}><div><h3 className={styles.sectionTitle}><ContactRound size={17} aria-hidden="true" />{t("Contactos operativos", "Operational contacts")}</h3></div>{draft.pickupContactName || draft.pickupContactPhoneE164 || draft.pickupContactEmail ? <Button variant="ghost" type="button" onClick={copyPickupContact}><Copy size={14} aria-hidden="true" />{t("Copiar al destinatario", "Copy to recipient")}</Button> : null}</header>
      <div className={styles.contactGrid}><ContactFields kind="pickup" draft={draft} update={update} errorFor={errorFor} t={t} /><ContactFields kind="recipient" draft={draft} update={update} errorFor={errorFor} t={t} /></div>
    </section>
  </>;
}

function ContactFields({ kind, draft, update, errorFor, t }: Pick<FieldHelpers, "draft" | "update" | "errorFor" | "t"> & { kind: "pickup" | "recipient" }) {
  const pickup = kind === "pickup";
  const name = pickup ? "pickupContactName" : "recipientContactName";
  const phone = pickup ? "pickupContactPhoneE164" : "recipientContactPhoneE164";
  const email = pickup ? "pickupContactEmail" : "recipientContactEmail";
  return <fieldset className={styles.contactCard}><legend>{pickup ? t("Contacto de retiro", "Pickup contact") : t("Destinatario", "Recipient")}</legend><div className={styles.contactFields}><Input label={t("Nombre", "Name")} autoComplete="name" value={draft[name]} error={errorFor(name)} onChange={(event) => update(name, event.target.value)} /><Input label={t("Teléfono E.164", "E.164 phone")} autoComplete="tel" type="tel" placeholder="+51987654321" value={draft[phone]} error={errorFor(phone)} onChange={(event) => update(phone, event.target.value)} /><Input label={t("Correo", "Email")} autoComplete="email" type="email" value={draft[email]} error={errorFor(email)} onChange={(event) => update(email, event.target.value)} /></div></fieldset>;
}

function ReviewStep({ draft, options, request, dirtyAfterCreate, t, locale, onEdit }: { draft: V2IntakePrototypeDraft; options: IntakeOptionsData; request: FreightRequestV2Data | null; dirtyAfterCreate: boolean; t: Translate; locale: "es" | "en"; onEdit: (step: PrototypeStep) => void }) {
  const origin = findIntakeFacility(options, draft.originFacilityId);
  const destination = findIntakeFacility(options, draft.destinationFacilityId);
  return <div className={styles.reviewGrid}>
    <ReviewSection title={t("Corredor", "Lane")} editLabel={t("Editar sedes", "Edit facilities")} onEdit={() => onEdit(1)} items={[[t("Origen", "Origin"), origin ? `${origin.label} · ${origin.city}` : "—"], [t("Destino", "Destination"), destination ? `${destination.label} · ${destination.city}` : "—"]]} />
    <ReviewSection title={t("Carga y unidad", "Cargo and unit")} editLabel={t("Editar carga", "Edit cargo")} onEdit={() => onEdit(2)} items={[[t("Categoría", "Category"), draft.categoryCode], [t("Peso / volumen", "Weight / volume"), `${Number(draft.totalWeightKg).toLocaleString(locale, { maximumFractionDigits: 6 })} kg · ${Number(draft.totalVolumeM3).toLocaleString(locale, { maximumFractionDigits: 6 })} m³`], [t("Unidad", "Unit"), `${draft.unitQuantity} × ${draft.unitPackageType}`], [t("Requisitos", "Requirements"), draft.requirements.join(", ") || t("Ninguno", "None")]]} />
    <ReviewSection title={t("Agenda y equipo", "Schedule and equipment")} editLabel={t("Editar agenda", "Edit schedule")} onEdit={() => onEdit(3)} items={[[t("Retiro", "Pickup"), formatLocalRange(draft.pickupWindowStartsAt, draft.pickupWindowEndsAt, locale)], [t("Entrega", "Delivery"), formatLocalRange(draft.deliveryWindowStartsAt, draft.deliveryWindowEndsAt, locale)], [t("Equipo", "Equipment"), draft.requiredEquipment]]} />
    <ReviewSection title={t("Límites comerciales", "Commercial boundaries")} tone="unknown" items={[[t("Elegibilidad", "Serviceability"), t("Se lee después de persistir DRAFT", "Read after DRAFT persistence")], [t("Precio / oferta / booking", "Price / offer / booking"), t("No confirmados ni creados", "Not confirmed or created")]]} />
    {request ? <div className={styles.persistedNotice} role="status"><strong>{request.referenceCode} · {request.status} · v{request.draftVersion}</strong><span>{dirtyAfterCreate ? t("Hay cambios locales posteriores; no se guardaron automáticamente.", "There are later local changes; they were not autosaved.") : t("El GET devolvió el borrador persistido.", "GET returned the persisted draft.")}</span></div> : null}
  </div>;
}

function ReviewSection({ title, items, tone = "preliminary", editLabel, onEdit }: { title: string; items: string[][]; tone?: "preliminary" | "unknown"; editLabel?: string; onEdit?: () => void }) {
  return <section className={styles.reviewSection}><header><div><h3>{title}</h3><Badge tone={tone}>{tone === "unknown" ? "UNKNOWN" : "LOCAL"}</Badge></div>{onEdit ? <Button variant="ghost" type="button" onClick={onEdit}>{editLabel}</Button> : null}</header><div className={styles.reviewList}>{items.map(([label, value]) => <div className={styles.reviewItem} key={label}><span>{label}</span><strong>{value}</strong></div>)}</div></section>;
}

function LiveSummary({ draft, options, request, evaluation, dirtyAfterCreate, t }: { draft: V2IntakePrototypeDraft; options: IntakeOptionsData; request: FreightRequestV2Data | null; evaluation: RoadServiceabilityEvaluationV2Data | null; dirtyAfterCreate: boolean; t: Translate }) {
  const origin = findIntakeFacility(options, draft.originFacilityId);
  const destination = findIntakeFacility(options, draft.destinationFacilityId);
  return <aside className={`${styles.card} ${styles.summary}`} aria-label={t("Resumen de la solicitud", "Request summary")}><header className={styles.cardHeader}><span className={styles.stepHeaderIcon} aria-hidden="true"><Route size={19} /></span><div><h2>{t("Tu solicitud", "Your request")}</h2></div></header><div className={styles.summaryRoute}><span className={styles.routeDot}/><div><small>{t("Origen", "Origin")}</small><strong>{origin?.city ?? "—"}</strong></div><span className={styles.routeDash}/><span className={styles.routeDot}/><div><small>{t("Destino", "Destination")}</small><strong>{destination?.city ?? "—"}</strong></div></div><div className={styles.summaryBody}>
    <SummaryRow label={t("Origen", "Origin")} value={origin?.label ?? t("Sin seleccionar", "Not selected")} tone={origin ? "preliminary" : "neutral"} status={origin ? t("Local", "Local") : t("Pendiente", "Pending")} />
    <SummaryRow label={t("Destino", "Destination")} value={destination?.label ?? t("Sin seleccionar", "Not selected")} tone={destination ? "preliminary" : "neutral"} status={destination ? t("Local", "Local") : t("Pendiente", "Pending")} />
    <SummaryRow label={t("Carga", "Cargo")} value={draft.cargoDescription || t("Sin describir", "Not described")} tone={draft.cargoDescription ? "preliminary" : "neutral"} status={draft.cargoDescription ? t("Local", "Local") : t("Pendiente", "Pending")} />
    <SummaryRow label={t("Persistencia", "Persistence")} value={request ? `${request.referenceCode} · v${request.draftVersion}` : t("Aún no creada", "Not created yet")} tone={request ? "confirmed" : "unknown"} status={request ? request.status : "UNKNOWN"} hint={dirtyAfterCreate ? t("Cambios locales sin autosave", "Local changes without autosave") : undefined} />
    <SummaryRow label={t("Elegibilidad", "Serviceability")} value={evaluation ? `${evaluation.summaryCounts.totalEvaluated} ${t("evaluados", "evaluated")}` : t("Aún no consultada", "Not queried yet")} tone={evaluation?.overallStatus === "eligible" ? "confirmed" : "unknown"} status={evaluation?.overallStatus.toUpperCase() ?? "UNKNOWN"} />
  </div></aside>;
}

function ApiErrorState({ error, requestExists, dirty, retry, reload, t, embedded = false }: { error: V2IntakeApiError; requestExists: boolean; dirty: boolean; retry: () => Promise<void>; reload?: () => Promise<void>; t: Translate; embedded?: boolean }) {
  const stale = error.code === "STALE_DRAFT";
  return <div className={styles.apiError} role="alert"><div><strong>{embedded ? t("No se pudo completar la consulta", "The request could not be completed") : error.code}</strong><span>{embedded ? intakeErrorCopy(error, t) : error.message}</span><small>{stale ? t("El borrador cambió en el servidor. Recargar descartará los cambios locales sin guardar.", "The server draft changed. Reloading will discard unsaved local changes.") : requestExists && dirty ? t("La revisión no se confirmó. Reintentar conserva la misma clave de idempotencia.", "The revision was not confirmed. Retry retains the same idempotency key.") : requestExists ? t("El borrador existe; se volverá a leer y evaluar.", "The draft exists; it will be read and evaluated again.") : t("No se declara persistencia hasta recibir el envelope v2.0.", "Persistence is not claimed until the v2.0 envelope is received.")}</small></div>{stale && reload ? <Button variant="secondary" type="button" onClick={() => void reload()}><RefreshCw size={15} aria-hidden="true" />{t("Recargar versión actual", "Reload current version")}</Button> : error.retryable ? <Button variant="secondary" type="button" onClick={() => void retry()}><RefreshCw size={15} aria-hidden="true" />{t("Reintentar", "Retry")}</Button> : null}</div>;
}

function intakeErrorCopy(error: V2IntakeApiError, t: Translate) {
  if (error.status === 401) return t("Inicia sesión para consultar tus datos y vuelve a intentarlo.", "Sign in to access your data, then try again.");
  if (error.status === 403) return t("Tu cuenta no tiene permiso para esta acción.", "Your account is not authorized for this action.");
  if (error.status === 409) return t("El registro cambió. Consulta su versión actual antes de continuar.", "The record has changed. Load its current version before continuing.");
  return t("El servicio no devolvió datos disponibles para continuar. Vuelve a intentarlo más tarde.", "The service did not return usable data to continue. Try again later.");
}

function LoadingOrPending({ phase, dirty, retry, t }: { phase: SubmitPhase; dirty: boolean; retry: () => Promise<void>; t: Translate }) {
  const loading = ["reading", "evaluating"].includes(phase);
  return <div className={styles.pendingState} role="status"><span>{loading ? phaseLabel(phase, t) : dirty ? t("Guarda la revisión para obtener una nueva evaluación.", "Save the revision to get a new evaluation.") : t("La evaluación todavía no está disponible.", "The evaluation is not available yet.")}</span>{!loading && !dirty ? <Button variant="secondary" type="button" onClick={() => void retry()}><RefreshCw size={15} aria-hidden="true" />{t("Consultar de nuevo", "Query again")}</Button> : null}</div>;
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
  if (phase === "revising") return t("Guardando revisión…", "Saving revision…");
  if (phase === "reading") return t("Leyendo DRAFT…", "Reading DRAFT…");
  if (phase === "evaluating") return t("Evaluando servicio…", "Evaluating serviceability…");
  return t("Procesando…", "Processing…");
}

function formatLocalRange(start: string, end: string, locale: "es" | "en") {
  if (!start || !end) return "—";
  const formatter = new Intl.DateTimeFormat(locale === "es" ? "es-PE" : "en-US", { dateStyle: "medium", timeStyle: "short" });
  return `${formatter.format(new Date(start))} → ${formatter.format(new Date(end))}`;
}

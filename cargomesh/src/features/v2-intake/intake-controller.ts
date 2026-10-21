"use client";
import {replaceCargoGroups,type DraftCargoGroup} from "./cargo-groups";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale } from "@/features/i18n/locale-provider";
import type { ConversationField } from "./conversation-fields";
import type { FreightRequestV2Data, IntakeOptionsData, RoadServiceabilityEvaluationV2Data } from "./contracts";
import { auditIntakeOptions, EMPTY_INTAKE_OPTIONS } from "./intake-options";
import { mapServiceabilityToMapViewProps } from "./mappers/road-map-props.mapper";
import { EMPTY_PROTOTYPE_DRAFT, applyChatFieldsToDraft, buildPrototypeExample, findIntakeFacility, mapDraftToCreateFreightRequestV2Input, mapDraftToRevisionInput, requestToPrototypeDraft, updatePrototypeDraftField, validatePrototypeReview, validatePrototypeStep, type PrototypeStep, type PrototypeValidationIssue, type V2IntakePrototypeDraft } from "./prototype-model";
import { V2IntakeApiError, assertFreightRequestRoundTrip, assertServiceabilityCorrelation, createFreightRequestV2, getFreightRequestV2, getRoadServiceabilityV2, loadIntakeOptions, reconcileCandidateSelection, reviseFreightRequestV2 } from "./v2-intake-client";

const CHAT_REQUEST_SESSION_KEY = "cargomesh-v2-chat-request-id";
export type SubmitPhase = "idle" | "creating" | "revising" | "reading" | "evaluating" | "success" | "error";

/** One in-memory draft and one versioned API flow for the client form and copilot. */
export function useIntakeController() {
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



  const activeOptions = options ?? EMPTY_INTAKE_OPTIONS;
  const origin = findIntakeFacility(activeOptions, draft.originFacilityId);
  const destination = findIntakeFacility(activeOptions, draft.destinationFacilityId);
  const optionCoverage = auditIntakeOptions(activeOptions);
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
  const updateCargoGroups=(groups:DraftCargoGroup[])=>{
    draftRevisionRef.current+=1;setDraft(current=>replaceCargoGroups(current,groups));setIssues([]);
    if(request){setDirtyAfterCreate(true);setEvaluation(null);setSelectedCandidateId(null);}
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

  return { locale, t, draft, step, maxVisited, issues, options, optionsSource, optionsError, submitPhase, submitError,
    request, evaluation, selectedCandidateId, dirtyAfterCreate, errorRef, activeOptions, origin, destination, optionCoverage,
    mapProps, update, updateCargoGroups, errorFor, enterReview, goNext, loadExample, reset, createDraftAndEvaluate, retryAfterCreate,
    reloadPersisted, updateFromChat, setStep, setMaxVisited, setIssues, setOptionsAttempt, setSelectedCandidateId };
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

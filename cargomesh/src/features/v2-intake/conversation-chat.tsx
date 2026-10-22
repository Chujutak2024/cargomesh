"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { workspaceHref } from "@/features/workspace-mode/paths";
import {workspaceFetch} from "@/features/workspace-mode/workspace-fetch";
import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { ArrowUp, ChevronDown, GripVertical, MessageSquareText, Mic, PanelRightClose, PanelRightOpen, SquarePen, X } from "lucide-react";
import { useReducedMotionPreference } from "@/features/product-motion/use-motion-preference";
import { ASSISTANT_TRANSITION, AssistantLiveContent, AssistantMascot, AssistantSurface, useAssistantEntrance } from "./assistant-motion";
import { assistantWelcomeMotion } from "./chat-surface-model";
import { useFloatingChat } from "./use-floating-chat";
import { lockDocumentScroll } from "@/shared/browser/scroll-lock";
import type { FreightRequestV2Data, IntakeOptionsData, RoadServiceabilityEvaluationV2Data } from "./contracts";
import type { PrototypeStep, V2IntakePrototypeDraft } from "./prototype-model";
import { applyChatFieldsToDraft, validatePrototypeReview, validatePrototypeStep } from "./prototype-model";
import { CONVERSATION_FIELDS, choicesForField, matchingConversationChoices, questionForField, resolveConversationSuggestions, type ConversationField, type GuidedConversationField } from "./conversation-fields";
import { useConversationVoice } from "@/features/v2-conversation-prep/voice-controls";
import { NovaVoicePreview, type NovaTextSender } from "@/features/v2-conversation-prep/nova-voice-preview";
import { applyVoiceTranscript, recentVoiceContext, spokenUserDetails, type VoiceTurn } from "@/features/v2-conversation-prep/voice-transcript";
import { InterpretationResponseSchema, guardExplicitCorrection, helpTopic, isHelpFollowUp, type Interpretation } from "@/features/v2-conversation-prep/interpretation";
import { conversationLanguage, type ConversationLanguage } from "@/features/v2-conversation-prep/conversation-language";
import { voiceDraftContext } from "@/features/v2-conversation-prep/voice-draft-context";
import { readCargoReadiness, summarizeCargoReadiness } from "./workflow-chat-client";
import { wantsQuoteSearch } from "./chat-quote-action";
import { DateClarificationPanel, CargoClassificationPanel } from "./capture-clarification-panel";
import {spokenCaptureClarification} from "./spoken-capture-clarification";
import { dateClarification, needsCargoClassification, type DateClarification } from "./capture-clarification";
import { ChatCommercialPanel } from "./chat-commercial-panel";
import { commercialChatIntent } from "./chat-commercial-action";
import { ChatQuotePanel } from "./chat-quote-panel";
import { measurementTurn, measurementReply, type PendingMeasurement } from "./measurement-clarification";
import { interpretDeterministically } from "@/features/v2-conversation-prep/interpretation";
import { conversationContext } from "./conversation-context";
import { serviceabilityReply } from "./serviceability-reply";
import type { V2IntakeApiError } from "./v2-intake-client";
import { readRequestWorkflow } from "./workflow-chat-client";
import { summarizeWorkflow } from "./workflow-chat-summary";
import { workflowChatIntent } from "./workflow-chat-intent";
import { chatSendGate } from "./chat-send-gate";
import { buildSpokenRequestReview, spokenReviewCommand, spokenRouteConflictsWithDraft, spokenTotalWeightKg } from "./spoken-request-review";
import { prepareSpokenRequestJson } from "./spoken-request-json";
import { checkedSpokenField, lastSpokenQuestionField } from "./spoken-field-guard";
import { contextualHelpReply } from "./contextual-help";
import { canApproveDraftReview, proposeDraftReview, type DraftReview } from "./draft-review";
import styles from "./conversation-chat.module.css";
import { useLocale } from "@/features/i18n/locale-provider";

type Message = VoiceTurn;
type Choice = { value: string; label: string; field: ConversationField };
const GREETING_EN = "Hi, I'm CargoMesh. Tell me what you need to ship, and I'll help you prepare a request and review preliminary ROAD options.";
const unavailable = "I cannot quote or book transportation here yet. The ROAD check is preliminary; it is neither an offer nor a reservation.";
function conversationAcknowledgment(value: string | undefined): string | undefined {
  return value?.trim() || undefined;
}

const positive = /^(yes|yes,? (?:create|save) (?:the )?(?:draft|revision)|(?:create|save) (?:the )?(?:draft|revision)|confirm|go ahead|s[ií]|s[ií],? (?:crea(?:r)?|guarda(?:r)?) (?:el |la )?(?:borrador|revisi[oó]n)|(?:crea(?:r)?|guarda(?:r)?) (?:el |la )?(?:borrador|revisi[oó]n)|confirmo|confirmar|adelante)$/i;

function missingField(draft: V2IntakePrototypeDraft, filled: Set<ConversationField> = new Set()): GuidedConversationField | null {
  return CONVERSATION_FIELDS.find((field) => !filled.has(field) && !String(draft[field] ?? "").trim()) ?? null;
}

function locationName(id: string, options: IntakeOptionsData) {
  const facility = options.facilities.find((item) => item.facilityId === id);
  if (!facility) return "not selected";
  return facility.label.includes("[SYNTHETIC]") ? `${facility.city} (synthetic test facility)` : `${facility.label}, ${facility.city}`;
}

function draftSummary(draft: V2IntakePrototypeDraft, options: IntakeOptionsData, request: FreightRequestV2Data | null, language:"es"|"en") {
  if(language==="es")return `Revisa los datos estructurados: ${locationName(draft.originFacilityId,options)} → ${locationName(draft.destinationFacilityId,options)}; ${draft.unitQuantity} unidad(es), ${draft.totalWeightKg} kg y ${draft.totalVolumeM3} m³ en total. ${request?`Guardar actualizará ${request.referenceCode}, versión ${request.draftVersion}.`:"Guardar creará un borrador para tu organización autorizada."} Confirma explícitamente o indica qué corregir.`;
  return `Review the structured details below. ${locationName(draft.originFacilityId, options)} → ${locationName(draft.destinationFacilityId, options)}; ${draft.unitQuantity} unit(s) of ${draft.categoryCode.toLowerCase()}. ${request ? `Saving will revise ${request.referenceCode} from version ${request.draftVersion}.` : "Saving will create a DRAFT for your authorized organization."} Confirm explicitly or tell me what to change.`;
}

function reviewRows(draft: V2IntakePrototypeDraft, options: IntakeOptionsData,language:"es"|"en"="en") {
  const spanish:Partial<Record<keyof V2IntakePrototypeDraft,string>>={originFacilityId:'Recojo',destinationFacilityId:'Entrega',categoryCode:'Categoría',packaging:'Embalaje',cargoDescription:'Mercancía',unitQuantity:'Unidades',unitWeightPerUnitKg:'Peso por unidad (kg)',unitVolumePerUnitM3:'Volumen por unidad (m³)',totalWeightKg:'Peso total (kg)',totalVolumeM3:'Volumen total (m³)',unitLengthCm:'Largo por unidad (cm)',unitWidthCm:'Ancho por unidad (cm)',unitHeightCm:'Alto por unidad (cm)',pickupWindowStartsAt:'Recojo desde',pickupWindowEndsAt:'Recojo hasta',deliveryWindowStartsAt:'Entrega desde',deliveryWindowEndsAt:'Entrega hasta',requiredEquipment:'Equipo',pickupContactName:'Contacto de recojo',pickupContactPhoneE164:'Teléfono de recojo',pickupContactEmail:'Correo de recojo',recipientContactName:'Persona que recibe',recipientContactPhoneE164:'Teléfono de entrega',recipientContactEmail:'Correo de entrega',requirements:'Requisitos',divisible:'Carga divisible',unitIndivisible:'Unidad indivisible',unitStackable:'Apilable'};
  const labels: Partial<Record<keyof V2IntakePrototypeDraft, string>> = {
    originFacilityId: "Pickup facility", destinationFacilityId: "Delivery facility", categoryCode: "Cargo category",
    packaging: "Packaging", cargoDescription: "Cargo description", unitQuantity: "Quantity",
    unitWeightPerUnitKg: "Weight per unit (kg)", unitVolumePerUnitM3: "Volume per unit (m³)",
    totalWeightKg: "Total weight (kg)", totalVolumeM3: "Total volume (m³)",
    unitLengthCm: "Unit length (cm)", unitWidthCm: "Unit width (cm)", unitHeightCm: "Unit height (cm)",
    pickupWindowStartsAt: "Pickup from", pickupWindowEndsAt: "Pickup until",
    deliveryWindowStartsAt: "Delivery from", deliveryWindowEndsAt: "Delivery until",
    requiredEquipment: "Required equipment", pickupContactName: "Pickup contact",
    pickupContactPhoneE164: "Pickup phone", pickupContactEmail: "Pickup email",
    recipientContactName: "Recipient contact", recipientContactPhoneE164: "Recipient phone",
    recipientContactEmail: "Recipient email", temperatureMinCelsius: "Minimum temperature (°C)",
    temperatureMaxCelsius: "Maximum temperature (°C)", requirements: "Requirements",
    divisible: "Cargo divisible", unitIndivisible: "Unit indivisible", unitStackable: "Unit stackable",
  };
  return (Object.entries(draft) as Array<[keyof V2IntakePrototypeDraft, V2IntakePrototypeDraft[keyof V2IntakePrototypeDraft]]>)
    .filter(([field, value]) => field !== "unitPackageType" && (typeof value === "boolean" || (Array.isArray(value) ? value.length > 0 : Boolean(String(value).trim()))))
    .map(([field, value]) => ({ label: (language==="es"?spanish[field]:null)??labels[field]??field, value: field === "originFacilityId" || field === "destinationFacilityId"
      ? locationName(String(value), options) : Array.isArray(value) ? value.join(", ") : typeof value === "boolean" ? value ? "Yes" : "No" : String(value) }));
}

export function ConversationChat({ draft, options, optionsSource = "api", request, evaluation, error = null, draftDirty = false, busy, presentation = "floating", canRevise = false, catalogStatus = "ready", catalogError, onRetryCatalog, onDockedChange, onFields, onSave, onRead, onEvaluate, onEdit, onReload, onStartOver }: {
  draft: V2IntakePrototypeDraft;
  options: IntakeOptionsData;
  optionsSource?: "api" | "fixture";
  request: FreightRequestV2Data | null;
  evaluation: RoadServiceabilityEvaluationV2Data | null;
  error?: V2IntakeApiError | null;
  draftDirty?: boolean;
  busy: boolean;
  presentation?: "floating" | "inline" | "workspace";
  catalogStatus?: "ready" | "loading" | "error" | "empty";
  catalogError?: string;
  onRetryCatalog?: () => void;
  onDockedChange?: (docked: boolean) => void;
  canRevise?: boolean;
  onFields: (fields: ReadonlyArray<{ field: ConversationField; value: string }>) => void;
  onSave: () => void;
  onRead: () => void;
  onEvaluate: () => void;
  onEdit?: (step: PrototypeStep) => void;
  onReload?: () => void;
  onStartOver?: () => void;
}) {
  const { locale, t } = useLocale();
  const pathname = usePathname();
  const [language, setLanguage] = useState<ConversationLanguage>(locale === "es" ? "es" : "en");
  const launcherLabel = t("Preguntar a CargoMesh", "Ask CargoMesh");
  const [open, setOpen] = useState(presentation === "inline");
  const [surfaceMode, setSurfaceMode] = useState<"sidebar" | "detached">("sidebar");
  const [launcherExpanded, setLauncherExpanded] = useState(false);
  const motionId = useId();
  const reducedMotion = useReducedMotionPreference();
  const intro = useAssistantEntrance(catalogStatus !== "loading", open, presentation === "workspace");
  const [mobile, setMobile] = useState(false);
  const [conversationEpoch, setConversationEpoch] = useState(0);
  const launcherPosition = useFloatingChat();
  const detachedPosition = useFloatingChat(open);
  const panelRef = useRef<HTMLElement>(null);
  const launcherInputRef = useRef<HTMLInputElement>(null);
  const incomingRef = useRef<(value: string) => void>(() => {});
  const sendInFlightRef = useRef(false);
  const [newMessages, setNewMessages] = useState(false);
  const [text, setText] = useState("");
  const [history, setHistory] = useState<Message[]>([{ speaker: "assistant", text: locale === "es" ? "Hola, soy CargoMesh. Cuéntame qué necesitas transportar y te ayudaré a preparar la solicitud, paso a paso." : GREETING_EN }]);
  const [announcement, setAnnouncement] = useState("");
  const [sendNotice, setSendNotice] = useState("");
  const spokenDetails = spokenUserDetails(history);
  const [voiceReviewOpen, setVoiceReviewOpen] = useState(false);
  const [voiceMode,setVoiceMode]=useState(false);
  const [novaSpeaking,setNovaSpeaking]=useState(false);
  const novaTextSenderRef = useRef<NovaTextSender | null>(null);
  const [novaTextPending, setNovaTextPending] = useState(false);
  const chatMountedRef = useRef(true);
  const currentTextScope = JSON.stringify([pathname, optionsSource, request?.id ?? null, request?.draftVersion ?? null]);
  const textScopeRef = useRef(currentTextScope); textScopeRef.current = currentTextScope;
  useEffect(() => { chatMountedRef.current = true; return () => { chatMountedRef.current = false; }; }, []);
  const [queuedVoiceAction,setQueuedVoiceAction]=useState<"review"|"confirm"|"apply"|null>(null);
  const awaitVoiceReplyRef=useRef(false);
  const [responseFinishedEpoch,setResponseFinishedEpoch]=useState(0);
  const voiceConfirmationRef=useRef<{review:DraftReview;requestId:string|null;version:number|null}|null>(null);
  const [voiceReviewNotice, setVoiceReviewNotice] = useState("");
  const [voiceInterpretPending, setVoiceInterpretPending] = useState(false);
  const voiceReview = buildSpokenRequestReview(history, options, draft);
  const reviewIssues = ([1, 2, 3] as PrototypeStep[]).flatMap((step) => validatePrototypeStep(step, draft).map((issue) => ({ ...issue, step })));
  const spokenRouteConflict = spokenRouteConflictsWithDraft(voiceReview, options, draft);
  const declaredWeightKg = spokenTotalWeightKg(voiceReview.weight);
  const spokenWeightConflict = declaredWeightKg !== null && Boolean(draft.totalWeightKg)
    && Math.abs(Number(draft.totalWeightKg) - declaredWeightKg) > 0.001;
  const voicePayload = prepareSpokenRequestJson(draft, options, spokenRouteConflict, declaredWeightKg, request);
  const [failedMessage, setFailedMessage] = useState("");
  const [interpretationBusy, setInterpretationBusy] = useState(false);
  const [providerMode,setProviderMode]=useState<"BEDROCK"|"DETERMINISTIC"|null>(null);
  const [commercialCommand,setCommercialCommand] = useState<{kind:"SELECT"|"BOOK";index:number;nonce:number}|null>(null);
  const [quotePanelOpen, setQuotePanelOpen] = useState(false);
  const [workflowBusy, setWorkflowBusy] = useState(false);
  const novaVoiceEnabled = process.env.NEXT_PUBLIC_CARGOMESH_NOVA_VOICE_PREVIEW === "true";
  const [audioReplies, setAudioReplies] = useState(true);
  const voiceLanguage = language === "es" ? "es-PE" as const : "en-US" as const;
  const [voiceRate, setVoiceRate] = useState(0.96);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const confirmationRef = useRef<{ review: DraftReview; requestId: string | null; version: number | null } | null>(null);
  const measurementPendingRef = useRef<PendingMeasurement | null>(null);
  const capturePendingRef = useRef<{date:DateClarification|null;classification:boolean}>({date:null,classification:false});
  const [capturePending,setCapturePending] = useState(capturePendingRef.current);
  const [measurementPending, setMeasurementPending] = useState<PendingMeasurement | null>(null);
  const [choices, setChoices] = useState<Choice[]>([]);
  const [viewport, setViewport] = useState<{ height: number; keyboardInset: number } | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const scrollMetricsRef = useRef<{ height: number; contentHeight: number } | null>(null);
  const followLatestRef = useRef(true);
  const reviewRef = useRef<HTMLElement>(null);
  const voiceHistoryRef = useRef<Message[]>(history);
  const voiceDraftRef = useRef(draft);
  const appliedVoiceTurnsRef = useRef<Set<string>>(new Set());
  const voiceInterpretQueueRef = useRef<Promise<void>>(Promise.resolve());
  const voiceInterpretCountRef = useRef(0);
  const processedVoiceCommandsRef = useRef<Set<string>>(new Set());
  const voiceSaveInFlightRef = useRef(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const announcedDraftRef = useRef<string | null>(null);
  const lastSpokenMessage = useRef(0);
  const failedAttempts = useRef(0);
  const previousHelpTopic = useRef<"PURPOSE" | "SELECTION" | "SERVICES" | null>(null);
  const latestAssistant = history.findLast((message) => message.speaker === "assistant")?.text ?? "";
  const voice = useConversationVoice({
    onTranscript: (recognized) => { setText(recognized); inputRef.current?.focus(); },
    onSilence: (recognized) => { setText(recognized); inputRef.current?.focus(); },
    responseText: latestAssistant,
    language: voiceLanguage,
    rate: voiceRate,
  });
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("assistant") === "open") setOpen(true);
    const seed = window.sessionStorage.getItem("cargomesh-v2-chat-seed-v1");
    if (seed) {
      window.sessionStorage.removeItem("cargomesh-v2-chat-seed-v1");
      setText(seed);
    }
  }, []);
  useEffect(() => {
    const openAssistant = () => { setOpen(true); setLauncherExpanded(false); };
    const receiveMessage = (event: Event) => {
      const value = (event as CustomEvent<{ text?: string }>).detail?.text;
      if (typeof value === "string" && value.trim()) incomingRef.current(value);
    };
    window.addEventListener("cargomesh:open-assistant", openAssistant);
    window.addEventListener("cargomesh:assistant-message", receiveMessage);
    return () => { window.removeEventListener("cargomesh:open-assistant", openAssistant); window.removeEventListener("cargomesh:assistant-message", receiveMessage); };
  }, []);
  incomingRef.current = (value) => { setText(value); void send(value); };
  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const update = () => setMobile(media.matches);
    update(); media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    onDockedChange?.(open && surfaceMode === "sidebar" && presentation === "workspace");
    return () => onDockedChange?.(false);
  }, [open, surfaceMode, presentation, onDockedChange]);
  useEffect(() => { if (launcherExpanded && !open) launcherInputRef.current?.focus(); }, [launcherExpanded, open]);
  const nextField = missingField(draft);
  const ask = (field: GuidedConversationField) => questionForField(field, voiceLanguage);


  const scrollToLatest = () => {
    const area = scrollAreaRef.current;
    if (!area) return;
    followLatestRef.current = true;
    setNewMessages(false);
    area.scrollTop = area.scrollHeight;
  };
  useLayoutEffect(() => {
    const area = scrollAreaRef.current;
    if (!open || !area) return;
    const preserveReadingPosition = () => {
      if (followLatestRef.current) area.scrollTop = area.scrollHeight;
      scrollMetricsRef.current = { height: area.clientHeight, contentHeight: area.scrollHeight };
    };
    preserveReadingPosition();
    const observer = new ResizeObserver(preserveReadingPosition);
    observer.observe(area);
    return () => observer.disconnect();
  }, [open, surfaceMode]);
  useEffect(() => {
    const area = scrollAreaRef.current;
    if (!area || voiceReviewOpen) return;
    if (followLatestRef.current) area.scrollTop = area.scrollHeight;
    else setNewMessages(true);
    scrollMetricsRef.current = { height: area.clientHeight, contentHeight: area.scrollHeight };
  }, [history, choices, voiceReviewOpen]);
  useEffect(() => {
    const area = scrollAreaRef.current;
    const review = reviewRef.current;
    if (!voiceReviewOpen || !area || !review) return;
    area.scrollTop += review.getBoundingClientRect().top - area.getBoundingClientRect().top;
    followLatestRef.current = false;
  }, [voiceReviewOpen]);
  useEffect(() => { voiceHistoryRef.current = history; }, [history]);
  useEffect(() => { voiceDraftRef.current = draft; }, [draft]);
  useEffect(() => { if (!busy) voiceSaveInFlightRef.current = false; }, [busy, request?.draftVersion, error]);
  useEffect(() => {
    const index = history.length - 1;
    const latest = history[index];
    if (!open || (novaVoiceEnabled && (!history.some(turn => turn.speaker === "user") || latest?.contentId?.startsWith("nova:"))) || novaSpeaking || !audioReplies || !latest || latest.speaker !== "assistant" || index <= lastSpokenMessage.current || latest.text.endsWith("…") || busy || interpretationBusy) return;
    lastSpokenMessage.current = index;
    voice.finishProcessing();
    voice.readResponse(latest.text);
  }, [history, busy, interpretationBusy, audioReplies, open, novaSpeaking, novaVoiceEnabled]);
  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);
  useEffect(() => {
    const confirmation = confirmationRef.current;
    if (awaitingConfirmation && confirmation && (!canApproveDraftReview(confirmation.review, draft)
      || confirmation.requestId !== (request?.id ?? null) || confirmation.version !== (request?.draftVersion ?? null))) {
      confirmationRef.current = null;
      setAwaitingConfirmation(false);
      setAnnouncement("The draft changed. Review the current details before confirming again.");
    }
  }, [draft, request, awaitingConfirmation]);
  useEffect(() => {
    if (!open || !window.visualViewport) return;
    const visual = window.visualViewport;
    const update = () => setViewport({ height: visual.height, keyboardInset: Math.max(0, window.innerHeight - visual.height - visual.offsetTop) });
    update();
    visual.addEventListener("resize", update);
    visual.addEventListener("scroll", update);
    return () => { visual.removeEventListener("resize", update); visual.removeEventListener("scroll", update); };
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const releaseScroll = mobile ? lockDocumentScroll(document) : () => {};
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented) return;
      if (event.key === "Escape") { event.preventDefault(); closePanel(); return; }
      if (event.key === "Tab" && mobile) {
        const controls = panelRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), summary, a[href], [tabindex="0"]');
        if (!controls?.length) return;
        const visible = [...controls].filter((element) => element.getClientRects().length > 0);
        const first = visible[0], last = visible.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => { releaseScroll(); document.removeEventListener("keydown", onKeyDown); };
  });
  useEffect(() => {
    if (!request) return;
    const key = `${request.id}:${request.draftVersion}`;
    if (announcedDraftRef.current === key) return;
    const prior = announcedDraftRef.current;
    announcedDraftRef.current = key;
    const message = prior ? `I saved revision ${request.draftVersion} of ${request.referenceCode}. ROAD is being refreshed for this version.`
      : `Draft ${request.referenceCode}, version ${request.draftVersion}, is loaded. You can correct its fields, review before saving a revision, or check ROAD.`;
    setHistory((current) => current.length === 1 && current[0]?.text === GREETING_EN ? [{ speaker: "assistant", text: message }] : [...current, { speaker: "assistant", text: message }]);
    setAnnouncement(message);
    setAwaitingConfirmation(false);
  }, [request]);
  useEffect(() => {
    if (!evaluation) return;
    const result = serviceabilityReply(evaluation, voiceLanguage);
    setHistory((current) => [...current, { speaker: "assistant", text: result }]);
    setAnnouncement(`ROAD result: ${evaluation.overallStatus}. The latest message explains the reasons and data sources.`);
  }, [evaluation]);
  useEffect(() => {
    if (!error) return;
    const reply = error.code === "STALE_DRAFT" ? "This draft version changed. Reload the authorized draft before evaluating it."
      : error.code === "FORBIDDEN_TENANT" || error.status === 403 ? "This request is not available to your organization."
      : error.status === 401 ? "Your session expired. Sign in again to continue."
      : error.code === "IDEMPOTENCY_CONFLICT" ? "This retry key belongs to different details. Review the draft before retrying."
      : "I could not complete that step. Your provisional details remain here; please retry.";
    setHistory((current) => [...current, { speaker: "assistant", text: reply }]);
    setAnnouncement(reply);
  }, [error]);

  function add(user: string | null, assistant: string) {
    setHistory((current) => [...current, ...(user ? [{ speaker: "user" as const, text: user }] : []), { speaker: "assistant", text: assistant }]);
    setAnnouncement(assistant);
  }

  function setCaptureClarification(next:typeof capturePendingRef.current) {
    capturePendingRef.current=next;setCapturePending(next);confirmationRef.current=null;setAwaitingConfirmation(false);
  }
  function handleCaptureClarification(value:string,user:string|null):boolean {
    const prompted=lastSpokenQuestionField(voiceHistoryRef.current);
    const roleHint=prompted?.startsWith("pickupWindow")?"pickup":prompted?.startsWith("deliveryWindow")?"delivery":undefined;
    const resolved=spokenCaptureClarification(value,capturePendingRef.current,options,Intl.DateTimeFormat().resolvedOptions().timeZone,Date.now(),roleHint);
    if(resolved.fields.length){
      voiceDraftRef.current=applyChatFieldsToDraft(voiceDraftRef.current,resolved.fields);onFields(resolved.fields);
      setCaptureClarification({date:resolved.dateResolved?null:capturePendingRef.current.date,classification:resolved.classificationResolved?false:capturePendingRef.current.classification});
      add(user,language==='es'?'Apliqué tu aclaración al borrador local. Puedes seguir hablando y corregir cualquier dato.':'Applied your clarification to the local draft. Keep speaking and correct any detail.');return true;
    }
    const date=dateClarification(value,Intl.DateTimeFormat().resolvedOptions().timeZone);
    const classification=needsCargoClassification(value);
    if(!date&&!classification)return false;
    setCaptureClarification({date:date??capturePendingRef.current.date,classification:classification||capturePendingRef.current.classification});
    const explicit=interpretDeterministically({schemaVersion:'2.0',text:value,currentField:null}).fields;
    const measures=measurementTurn(value,measurementPendingRef.current,voiceDraftRef.current);
    if(measures.handled){measurementPendingRef.current=measures.pending;setMeasurementPending(measures.pending);}
    const fields=[...measures.fields,...resolveConversationSuggestions(explicit.filter(f=>['unitQuantity','unitWeightPerUnitKg','packaging','originFacilityId','destinationFacilityId'].includes(f.field)),options).flatMap(f=>f.parsed===null?[]:[{field:f.field,value:f.parsed}])];
    if(fields.length){voiceDraftRef.current=applyChatFieldsToDraft(voiceDraftRef.current,fields);onFields(fields);}
    add(user,conversationLanguage(value,language)==='es'?'Conservé los datos claros. Aclara por voz la fecha, si es recojo o entrega y el horario; para mercancía, indica el producto y la categoría revisada. No elegiré por mi cuenta.':'I kept the explicit facts. Clarify the date, pickup or delivery and time range by voice, or the product and reviewed category. I will not choose for you.');
    return true;
  }
  function hasCaptureClarification(){return Boolean(capturePendingRef.current.date||capturePendingRef.current.classification);}

  function handleMeasurement(value: string, user: string | null): boolean {
    const current = voiceDraftRef.current;
    const result = measurementTurn(value, measurementPendingRef.current, current);
    if (!result.handled) return false;
    measurementPendingRef.current = result.pending;
    setMeasurementPending(result.pending);
    confirmationRef.current = null;
    setAwaitingConfirmation(false);
    // Keep explicit count/weight/route facts from mixed turns; never let a model apply ambiguous dimensions.
    const explicit = interpretDeterministically({schemaVersion:"2.0",text:value,currentField:null}).fields;
    const preserved = resolveConversationSuggestions(explicit.filter(item => ["unitQuantity","unitWeightPerUnitKg","packaging","originFacilityId","destinationFacilityId"].includes(item.field)),options)
      .flatMap(item=>item.parsed===null?[]:[{field:item.field,value:item.parsed}]);
    const fields = [...preserved,...result.fields];
    if (fields.length) { voiceDraftRef.current = applyChatFieldsToDraft(current,fields); onFields(fields); }
    const reply = measurementReply(result,conversationLanguage(value,language));
    setVoiceReviewNotice(reply);
    add(user,reply);
    return true;
  }

  function prepareConfirmation(nextDraft: V2IntakePrototypeDraft, user: string | null = null) {
    if (hasCaptureClarification()) { add(user,language==='es'?'Revisa primero las fechas o la clasificación pendientes.':'Review pending dates or classification first.'); return; }
    if (measurementPendingRef.current) { add(user, language === "es" ? "Antes de confirmar, aclara si las medidas son por unidad o del conjunto y su unidad de medida. Si son del conjunto, necesito además las de cada unidad." : "Before confirming, clarify the measurement unit and whether these dimensions are per unit or for the whole shipment. For a shipment total I still need each unit’s dimensions."); return; }
    const validation = validatePrototypeReview(nextDraft);
    if (!validation.valid) {
      const field = validation.issues[0]?.field;
      const question = field && CONVERSATION_FIELDS.includes(field as GuidedConversationField)
        ? ask(field as GuidedConversationField)
        : "Complete the highlighted detail in the request form.";
      add(user, `I still need a valid detail before saving. ${question}`);
      return;
    }
    if (request && (!canRevise || request.status !== "DRAFT")) {
      add(user, "This saved request cannot be revised in this intake. Open its request workspace to review the current state.");
      return;
    }
    if (request && !draftDirty) {
      add(user, "This version is already saved. Tell me what to correct, or use the form; I will ask for confirmation before saving a new revision.");
      return;
    }
    confirmationRef.current = { review: proposeDraftReview(nextDraft), requestId: request?.id ?? null, version: request?.draftVersion ?? null };
    setAwaitingConfirmation(true);
    add(user, draftSummary(nextDraft, options, request, language));
  }

  function confirmSave(user: string | null) {
    if (optionsSource === "fixture") {
      confirmationRef.current = null;
      setAwaitingConfirmation(false);
      add(user, (language==="es"?"Esta vista solo prueba la conversación. Inicia sesión en la página de solicitudes para guardar.":"This preview only tests the conversation. Sign in on the V2 freight page to save a request."));
      return;
    }
    const confirmation = confirmationRef.current;
    if (hasCaptureClarification() || measurementPendingRef.current || !confirmation || !canApproveDraftReview(confirmation.review, draft)
      || confirmation.requestId !== (request?.id ?? null) || confirmation.version !== (request?.draftVersion ?? null)
      || !validatePrototypeReview(draft).valid || (request && (!canRevise || request.status !== "DRAFT"))) {
      add(user, (language==="es"?"El borrador cambió, está incompleto o no se puede revisar aquí. Revísalo antes de guardar.":"The draft changed, is incomplete, or cannot be revised here. Review it again before saving."));
      confirmationRef.current = null;
      setAwaitingConfirmation(false);
      return;
    }
    add(user, request ? (language==="es"?"Guardando la revisión confirmada y consultando ROAD para la nueva versión…":"Saving the confirmed revision, then refreshing ROAD for its new version…") : (language==="es"?"Creando tu borrador autorizado y consultando elegibilidad ROAD…":"Creating your authorized draft, then checking ROAD eligibility…"));
    confirmationRef.current = null;
    setAwaitingConfirmation(false);
    onSave();
  }

  function closePanel() {
    if (voice.state === "listening" || voice.state === "requesting_permission") voice.stop();
    voice.stopResponse();
    setOpen(false);
    setLauncherExpanded(false);
    requestAnimationFrame(() => launcherRef.current?.focus());
  }

  function startNewChat() {
    if (busy || interpretationBusy || workflowBusy || voiceInterpretPending || sendInFlightRef.current) return;
    voice.stop(); voice.stopResponse();
    const greeting: Message[] = [{ speaker: "assistant", text: locale === "es" ? "Hola, soy CargoMesh. Cuéntame qué necesitas transportar y te ayudaré a preparar la solicitud, paso a paso." : GREETING_EN }];
    voiceHistoryRef.current = greeting;
    setHistory(greeting); setText(""); setChoices([]); setFailedMessage(""); setSendNotice("");
    setAwaitingConfirmation(false); confirmationRef.current = null;
    setVoiceReviewOpen(false); setVoiceReviewNotice(""); setNewMessages(false);
    voiceConfirmationRef.current=null;setQueuedVoiceAction(null);awaitVoiceReplyRef.current=false;setNovaSpeaking(false);setVoiceMode(false);
    appliedVoiceTurnsRef.current.clear(); processedVoiceCommandsRef.current.clear();
    failedAttempts.current = 0; previousHelpTopic.current = null; lastSpokenMessage.current = 0;
    followLatestRef.current = true;
    setConversationEpoch((epoch) => epoch + 1);
    setAnnouncement(t("Nueva conversación. Los datos de tu solicitud se conservan.", "New conversation. Your request details are preserved."));
    inputRef.current?.focus();
  }

  function goToFormStep(step: PrototypeStep) {
    onEdit?.(step);
    if (mobile || presentation === "floating") closePanel();
    window.setTimeout(() => {
      const heading = document.getElementById(`prototype-step-${step}`);
      heading?.scrollIntoView({ behavior: "smooth", block: "start" });
      heading?.focus({ preventScroll: true });
    }, 0);
  }

  function applySpokenDetails() {
    if (hasCaptureClarification() || measurementPendingRef.current) { setVoiceReviewNotice(language === "es" ? "Aclara primero las medidas pendientes." : "Clarify the pending measurements first."); return; }
    if (!voiceReview.fields.length) {
      setVoiceReviewNotice((language==="es"?"Los datos reconocidos ya están en el borrador local. Completa los campos pendientes.":"All matched spoken details are already in the local draft. Complete any missing fields below."));
      return;
    }
    const count = voiceReview.fields.length;
    onFields(voiceReview.fields);
    setVoiceReviewNotice(`${count} matched detail${count === 1 ? " was" : "s were"} applied to the local draft. No request has been created. Check the remaining fields in this review.`);
    window.requestAnimationFrame(() => reviewRef.current?.scrollIntoView({ block: "start" }));
  }

  function requestVoiceReview(waitForReply=false){
    awaitVoiceReplyRef.current=waitForReply;setQueuedVoiceAction('review');
  }
  useEffect(()=>{
    if(!queuedVoiceAction||awaitVoiceReplyRef.current||novaSpeaking||voiceInterpretPending||busy)return;
    setQueuedVoiceAction(null);
    if(queuedVoiceAction==='review'){
      voiceConfirmationRef.current={review:proposeDraftReview(draft),requestId:request?.id??null,version:request?.draftVersion??null};
      setVoiceReviewOpen(true);setVoiceReviewNotice(language==='es'?'Resumen del borrador actual. Corrige por voz o confirma explícitamente cuando esté completo.':'Current draft summary. Correct by voice or explicitly confirm when complete.');
    }else if(queuedVoiceAction==='apply')applySpokenDetails();
    else confirmSpokenDraft();
  },[queuedVoiceAction,novaSpeaking,voiceInterpretPending,busy,responseFinishedEpoch,draft,request]);

  function confirmSpokenDraft() {
    const approval=voiceConfirmationRef.current;
    if (!approval||!canApproveDraftReview(approval.review,draft)||approval.requestId!==(request?.id??null)||approval.version!==(request?.draftVersion??null)||novaSpeaking||hasCaptureClarification() || measurementPendingRef.current || !voiceReviewOpen || !voicePayload || busy || voiceInterpretCountRef.current > 0 || optionsSource === "fixture"
      || Boolean(request && (!canRevise || !draftDirty || request.status !== "DRAFT"))) {
      setVoiceReviewNotice((language==="es"?"Primero revisa los datos pendientes o contradictorios que aparecen aquí.":"I cannot create a draft yet. Review the missing or conflicting details shown here first."));
      return;
    }
    if (voiceSaveInFlightRef.current) return;
    voiceSaveInFlightRef.current = true;voiceConfirmationRef.current=null;
    setVoiceReviewNotice(request ? (language==="es"?"Guardando la revisión confirmada…":"Saving the confirmed draft revision…") : (language==="es"?"Creando el borrador confirmado y consultando opciones preliminares ROAD…":"Creating your confirmed draft and checking preliminary ROAD options…"));
    onSave();
  }

  async function interpret(value: string, currentDraft = draft, preferredField: GuidedConversationField | null = null): Promise<{ interpretation: Interpretation; mode: "BEDROCK" | "DETERMINISTIC" }> {
    const currentField = preferredField ?? missingField(currentDraft);
    const input = { schemaVersion: "2.0" as const, text: value, currentField, language: conversationLanguage(value, language),
      context: { ...conversationContext(currentDraft, currentField, failedAttempts.current), previousHelpTopic: previousHelpTopic.current } };
    const endpoint = optionsSource === "fixture" ? "/api/v2/conversation/preview" : "/api/v2/conversation/interpret";
    const response = await workspaceFetch(endpoint, {
      method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!response.ok) throw new Error(response.status === 401 ? (language==="es"?"Tu sesión o pertenencia a la organización ya no está activa. Inicia sesión de nuevo.":"Your session or organization membership is no longer active. Sign in again.") : (language==="es"?"No pude interpretar ese mensaje. Inténtalo otra vez.":"I could not interpret that message. Please retry."));
    const parsed = InterpretationResponseSchema.safeParse(await response.json());
    if (!parsed.success) throw new Error((language==="es"?"La respuesta del servicio no es válida. Inténtalo otra vez.":"The conversation service returned an invalid response. Please retry."));
    setProviderMode(parsed.data.mode);
    return { interpretation: parsed.data.interpretation, mode: parsed.data.mode };
  }

  async function interpretSpokenDetail(value: string, turns: Message[]) {
    if (optionsSource === "fixture" || spokenReviewCommand(value)) return;
    const currentDraft = voiceDraftRef.current;
    if (handleCaptureClarification(value,null) || handleMeasurement(value, null)) return;
    try {
      const expectedField = lastSpokenQuestionField(turns) ?? missingField(currentDraft);
      const { interpretation } = await interpret(value, currentDraft, expectedField);
      const proposal = guardExplicitCorrection(value, expectedField, interpretation);
      if (proposal.intent !== "PROVIDE" && proposal.intent !== "CORRECT") return;
      if(voiceDraftRef.current.categoryCode!=='CHEMICAL'&&proposal.fields.some(f=>f.field==='categoryCode'&&f.value.toUpperCase()==='CHEMICAL'))setCaptureClarification({...capturePendingRef.current,classification:true});
      const fields = resolveConversationSuggestions(proposal.fields, options)
        .filter(f=>(!capturePendingRef.current.date||!f.field.endsWith("At"))&&(!capturePendingRef.current.classification||f.field!=="categoryCode"))
        .filter(item => !measurementPendingRef.current || !["unitLengthCm","unitWidthCm","unitHeightCm","unitVolumePerUnitM3"].includes(item.field))
        .filter(({ field }) => JSON.stringify(voiceDraftRef.current[field]) === JSON.stringify(currentDraft[field]))
        .flatMap(({ field, parsed }) => {
          const checked = parsed === null ? null : checkedSpokenField(field, parsed, value, turns);
          return checked === null ? [] : [{ field, value: checked }];
        });
      if (!fields.length) return;
      voiceDraftRef.current = applyChatFieldsToDraft(voiceDraftRef.current, fields);
      onFields(fields);
      setVoiceReviewNotice(`${fields.length} more spoken detail${fields.length === 1 ? " was" : "s were"} added to the local draft. Review the structured values before confirming.`);
    } catch {
      setVoiceReviewNotice((language==="es"?"No pude validar un dato de voz. Revisa los campos e indica ese dato otra vez.":"I could not validate one spoken detail. Please review the fields and try that detail again."));
    }
  }

  async function send(value = text) {
    setOpen(true); setLauncherExpanded(false);
    if (catalogStatus !== "ready") {
      setText(value);
      setSendNotice(t("Espera a que estén disponibles los datos de tu organización para enviar el mensaje.", "Wait for your organization's catalog before sending this message."));
      return;
    }
    if (sendInFlightRef.current) return;
    sendInFlightRef.current = true;
    try {
      setLanguage(conversationLanguage(value, language));
      if (novaVoiceEnabled) await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      // Read/mutate business data through the existing reviewed workflow, never through the model.
      const localAction = awaitingConfirmation || commercialChatIntent(value) || wantsQuoteSearch(value) || workflowChatIntent(value)
        || /\b(?:start over|start again|empezar de nuevo|empecemos|reiniciar)\b/i.test(value.trim());
      if (novaVoiceEnabled && novaTextSenderRef.current && !localAction) {
        if (!value.trim() || busy || interpretationBusy || workflowBusy || novaSpeaking || voice.speaking) return;
        setNovaTextPending(true); setSendNotice("");
        const scope = textScopeRef.current;
        try { await novaTextSenderRef.current(value); if (chatMountedRef.current) setText(""); return; }
        catch { if (!chatMountedRef.current || scope !== textScopeRef.current) return; /* Old gateways keep native text/reading. */ }
        finally { setNovaTextPending(false); }
      }
      await processMessage(value);
    } finally { sendInFlightRef.current = false; }
  }

  async function processMessage(submitted: string) {
    const gate = chatSendGate(submitted, busy || interpretationBusy || workflowBusy, voice.speaking);
    if (gate.kind === "wait") {
      if (gate.notice) setSendNotice(gate.notice);
      return;
    }
    const value = gate.value;
    setLanguage(conversationLanguage(value, language));
    followLatestRef.current = true;
    setNewMessages(false);
    setSendNotice("");
    setFailedMessage("");
    if (voice.state === "listening" || voice.state === "requesting_permission") voice.stop();
    setText("");
    setChoices([]);
    const turnLanguage = conversationLanguage(value, language);
    if (handleCaptureClarification(value,value) || handleMeasurement(value,value)) return;
    const commercial = commercialChatIntent(value);
    if (commercial) {
      if(!request||optionsSource==='fixture'){add(value,turnLanguage==='es'?'Primero guarda una solicitud autorizada.':'First save an authorized request.');return;}
      setCommercialCommand({...commercial,nonce:Date.now()});
      add(value,turnLanguage==='es'?'Prepararé una revisión con datos actuales. Tu mensaje no confirma la selección ni autoriza reservas; usa el resumen y su confirmación separada.':'I will prepare a current review. Your message does not confirm selection or authorize bookings; review and confirm the action separately.');return;
    }
    if (wantsQuoteSearch(value)) {
      if (!request || optionsSource === "fixture") { add(value,turnLanguage === "es" ? "Primero revisa y guarda una solicitud con tu organización activa." : "First review and save an authorized request."); return; }
      setQuotePanelOpen(true);
      add(value,turnLanguage === "es" ? "Revisa el pedido y el plazo en el panel de cotización. Solo se solicitarán ofertas cuando marques el consentimiento y pulses Buscar ofertas; esto no selecciona ni contrata transporte." : "Review the request and deadline in the quotation panel. Quotes are requested only after checking consent and pressing Find offers; this does not select or book transportation.");
      return;
    }
    const workflowIntent = workflowChatIntent(value);
    if (workflowIntent) {
      if (optionsSource === "fixture") { add(value, "This preview uses synthetic facilities and cannot read commercial records. Sign in to view an authorized request."); return; }
      if (!request) { add(value, turnLanguage === "es" ? "Primero revisa y guarda una solicitud. Después puedo consultar sus ofertas, campos pendientes, reservas y seguimiento." : "First save a freight request. Then I can check its current offers, booking state or recorded execution."); return; }
      setWorkflowBusy(true);
      try {
        if (workflowIntent === "readiness") {
          if (draftDirty) add(value, turnLanguage === "es" ? "Hay cambios sin guardar. Revisa y confirma la revisión para comprobar la versión actual." : "Review and save the local changes before checking the current version.");
          else add(value, summarizeCargoReadiness(await readCargoReadiness(request.id, request.draftVersion), conversationLanguage(value, language)));
        } else add(value, summarizeWorkflow(workflowIntent, await readRequestWorkflow(request.id, workflowIntent), turnLanguage));
      }
      catch (error) { add(value, error instanceof Error ? error.message : "I could not load the current workflow. Please retry."); }
      finally { setWorkflowBusy(false); }
      return;
    }
    if (awaitingConfirmation && positive.test(value)) {
      confirmSave(value);
      return;
    }
    if (awaitingConfirmation && /^(no|not yet|cancel|no todav[ií]a|cancelar)$/i.test(value)) {
      setAwaitingConfirmation(false);
      confirmationRef.current = null;
      add(value, "Nothing was saved. Tell me what to correct, for example: “change the pickup to Lima.”");
      return;
    }
    if (awaitingConfirmation) {
      confirmationRef.current = null;
      setAwaitingConfirmation(false);
    }
    setInterpretationBusy(true);
    try {
      const { interpretation: received, mode } = await interpret(value);
      const proposal = guardExplicitCorrection(value, nextField, received);
      if (proposal.intent === "PRICE" || proposal.intent === "BOOKING") {
        add(value, turnLanguage === "es" ? "Puedo consultar ofertas de una solicitud guardada. La selección y la autorización se revisan en Operaciones; una consulta de precio no contrata transporte." : unavailable); return;
      }
      if (proposal.intent === "HELP") {
        if (!isHelpFollowUp(value)) previousHelpTopic.current = helpTopic(value);
        const guided = contextualHelpReply(draft, options, nextField, value, conversationLanguage(value, language));
        const modelReply = mode === "BEDROCK" ? conversationAcknowledgment(proposal.acknowledgment) : undefined;
        const explanatoryReply = conversationAcknowledgment(proposal.acknowledgment);
        add(value, (turnLanguage === "es" ? guided : null) ?? modelReply ?? (/\b(?:services|offer|available|selection|compare|what is|what can|para qu[eé]|servicios|escoger|comparar)\b/i.test(value) ? explanatoryReply : undefined) ?? guided ?? explanatoryReply ?? "Tell me what you need to ship, and I'll guide you through the request.");
        return;
      }
      if (proposal.intent === "START_OVER") {
        setCaptureClarification({date:null,classification:false});
        measurementPendingRef.current=null;setMeasurementPending(null);setQuotePanelOpen(false);setCommercialCommand(null);
        onStartOver?.();
        failedAttempts.current = 0;
        previousHelpTopic.current = null;
        setAwaitingConfirmation(false);
        add(value, turnLanguage==="es"?"Empecemos un borrador nuevo. ¿Dónde recogemos la carga?":"Let’s start a new provisional request. Where should the cargo be picked up?");
        return;
      }
      if (proposal.intent === "READ") {
        if (!request) add(value, "There is no saved draft yet. Tell me about the shipment first.");
        else { add(value, `Reading draft ${request.referenceCode} with your current authorization…`); onRead(); }
        return;
      }
      if (proposal.intent === "EVALUATE") {
        if (!request) add(value, "I need a saved draft before checking ROAD.");
        else if (draftDirty) add(value, "Your changes are local. Review and confirm a saved revision before checking ROAD again.");
        else if (evaluation) add(value, serviceabilityReply(evaluation, voiceLanguage));
        else { add(value, "Checking ROAD for the saved draft version…"); onEvaluate(); }
        return;
      }
      if (proposal.intent === "CREATE" && !proposal.fields.length) {
        if (optionsSource === "fixture") { add(value, "We can prepare the details here, but this preview does not save requests."); return; }
        prepareConfirmation(draft, value);
        return;
      }
      const accepted = new Set<ConversationField>();
      const applied: Array<{ field: ConversationField; value: string }> = [];
      let clarification: string | null = null;
      if(voiceDraftRef.current.categoryCode!=='CHEMICAL'&&proposal.fields.some(f=>f.field==='categoryCode'&&f.value.toUpperCase()==='CHEMICAL'))setCaptureClarification({...capturePendingRef.current,classification:true});
      for (const suggestion of resolveConversationSuggestions(proposal.fields, options).filter(f=>(!capturePendingRef.current.date||!f.field.endsWith('At'))&&(!capturePendingRef.current.classification||f.field!=='categoryCode')).filter(item => !measurementPendingRef.current || !["unitLengthCm","unitWidthCm","unitHeightCm","unitVolumePerUnitM3"].includes(item.field))) {
        const field = suggestion.field;
        const parsed = suggestion.parsed;
        if (parsed === null) {
          if (field === "categoryCode") {
            applied.push({ field: "cargoDescription", value: suggestion.value });
            accepted.add("cargoDescription");
            const categories = choicesForField("categoryCode", options);
            const examples = [categories.find((choice) => choice.value === "MACHINERY"), categories.find((choice) => choice.value === "GENERAL")]
              .filter((choice): choice is { value: string; label: string } => Boolean(choice)).map((choice) => choice.label).join(" or ");
            clarification ??= `I noted “${suggestion.value}” as the cargo description. ${ask("categoryCode")}${examples ? ` For example, ${examples}.` : ""}`;
            continue;
          }
          const matches = matchingConversationChoices(field, suggestion.value, options);
          if (matches.length > 1) {
            if (!clarification) {
              setChoices(matches.map((choice) => ({ ...choice, field })));
              clarification = "I found more than one authorized location. Please confirm one of the labeled choices below. No location has been saved yet.";
            }
          } else if (field === "originFacilityId" || field === "destinationFacilityId") {
            clarification ??= "I could not match that place to one of your organization's saved facilities. Searching and confirming other places is not available yet. Please name a saved facility or use the request form.";
          } else clarification ??= `I could not validate that detail. ${ask(field)}`;
          continue;
        }
        applied.push({ field, value: parsed });
        accepted.add(field);
      }
      if (applied.length) onFields(applied);
      const projected = applyChatFieldsToDraft(draft, applied);
      if (clarification) {
        failedAttempts.current = accepted.size ? 0 : Math.min(3, failedAttempts.current + 1);
        setAwaitingConfirmation(false);
        add(value, accepted.size ? `I kept the other ${accepted.size} valid detail${accepted.size === 1 ? "" : "s"}. ${clarification}`
          : failedAttempts.current >= 2 ? `${clarification} You can also enter this detail in the request form.` : clarification);
        return;
      }
      if (!accepted.size) {
        if (proposal.intent === "CORRECT" && proposal.acknowledgment) { add(value, proposal.acknowledgment); return; }
        failedAttempts.current = Math.min(3, failedAttempts.current + 1);
        if (mode === "DETERMINISTIC" && optionsSource !== "fixture" && /\b(?:help|how|what|can you|tell me)\b/i.test(value)) {
          add(value, contextualHelpReply(draft, options, nextField, value, conversationLanguage(value, language)) ?? `I can help you prepare a request. ${ask(nextField ?? "originFacilityId")}`);
          return;
        }
        if (mode === "BEDROCK" && conversationAcknowledgment(proposal.acknowledgment)) {
          add(value, conversationAcknowledgment(proposal.acknowledgment)!);
          return;
        }
        add(value, failedAttempts.current >= 2
          ? (language==="es"?"No pude identificar ese dato. Puedes escribir un valor concreto o completarlo en el formulario.":"I still could not identify that detail. You can type a specific value or enter it in the request form.")
          : `I did not catch a freight detail. ${ask(nextField ?? "originFacilityId")}`);
        return;
      }
      failedAttempts.current = 0;
      setAwaitingConfirmation(false);
      confirmationRef.current = null;
      const remaining = missingField(projected);
      const preface = (turnLanguage === "es" ? contextualHelpReply(projected, options, remaining, value, "es") : null) ?? conversationAcknowledgment(proposal.acknowledgment) ?? `I have ${[...accepted].map((field) => field === "originFacilityId" ? `pickup at ${locationName(projected.originFacilityId, options)}` : field === "destinationFacilityId" ? `delivery at ${locationName(projected.destinationFacilityId, options)}` : field === "unitQuantity" ? `${projected.unitQuantity} unit(s)` : field === "cargoDescription" ? `cargo described as ${projected.cargoDescription}` : field === "categoryCode" ? `${projected.categoryCode.toLowerCase()} cargo` : field === "packaging" ? `${projected.packaging.toLowerCase()} packaging` : "that detail").join(" and ")}.`;
      const changed = proposal.intent === "CORRECT" ? ` Updated ${[...accepted].map((field) => field === "originFacilityId" ? "pickup" : field === "destinationFacilityId" ? "delivery" : field).join(", ")}.` : "";
      if (remaining) add(value, turnLanguage === "es" ? preface : `${preface}${changed} ${ask(remaining)}`);
      else {
        add(value, turnLanguage === "es" ? `${preface} El resumen está actualizado. Revísalo y confirma cuando esté listo.` : `${preface}${changed} The structured summary is updated. Review and confirm when ready.`);
      }
    } catch (error) {
      setFailedMessage(value);
      add(value, error instanceof Error ? error.message : "I could not process that message. Please retry.");
    } finally {
      setInterpretationBusy(false);
    }
  }

  return <aside className={styles.shell} data-presentation={presentation} data-chat-open={open} aria-label="CargoMesh ROAD assistant" style={viewport ? { "--chat-visual-height": `${viewport.height}px`, "--chat-keyboard-inset": `${viewport.keyboardInset}px` } as CSSProperties : undefined}>
    <LayoutGroup id={motionId}>
    {intro && <div className={styles.entrancePosition}>
      <div className={styles.entranceWelcome}>
      <p className={styles.entranceBubble}>{t("Soy", "I'm")} <strong>CargoMesh</strong>{t(", tu asistente de transporte con IA.", ", your freight AI.")}</p>
      <button type="button" className={styles.entranceButton} onClick={() => setOpen(true)} aria-label={launcherLabel} aria-controls="v2-chat-panel">
        <motion.span layoutId="assistant-orb" transition={ASSISTANT_TRANSITION}><AssistantMascot large welcoming active={false} /></motion.span>
      </button>
      </div>
    </div>}
    <div className={styles.launcherPosition} ref={launcherPosition.ref} style={launcherPosition.style} hidden={open} data-intro={intro} data-expanded={launcherExpanded}>
      <button type="button" className={styles.dragHandle} {...launcherPosition.handle} aria-label={t("Mover asistente. Usa las flechas; Inicio restaura la posición.", "Move assistant. Use arrow keys; Home resets its position.")} title={t("Arrastra para mover", "Drag to move")}><GripVertical size={18} aria-hidden="true" /></button>
      {launcherExpanded ? <form className={styles.launcherComposer} onSubmit={(event) => { event.preventDefault(); void send(); }}>
        <AssistantMascot active={!open} />
        <label className={styles.srOnly} htmlFor="assistant-launcher-text">{t("Mensaje para CargoMesh", "Message CargoMesh")}</label>
        <input id="assistant-launcher-text" ref={launcherInputRef} value={text} onChange={(event) => setText(event.target.value)} maxLength={4096} placeholder={t("¿Qué necesitas transportar?", "What do you need to ship?")} autoComplete="off" onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); setLauncherExpanded(false); requestAnimationFrame(() => launcherRef.current?.focus()); } }} />
        <button type="button" className={styles.launcherAction} title={t("Abrir panel", "Open sidebar")} aria-label={t("Abrir panel del asistente", "Open assistant sidebar")} onClick={() => { setOpen(true); setLauncherExpanded(false); }}><PanelRightOpen size={18}/></button>
        <button type="button" className={styles.launcherAction} title={t("Hablar con CargoMesh", "Talk to CargoMesh")} aria-label={t("Hablar con CargoMesh", "Talk to CargoMesh")} onClick={() => { setOpen(true); setLauncherExpanded(false); if (!novaVoiceEnabled && catalogStatus === "ready") voice.start(); }}><Mic size={18}/></button>
        <button type="submit" className={styles.launcherSend} disabled={!text.trim() || busy || interpretationBusy || workflowBusy || novaTextPending || novaSpeaking || voice.speaking} aria-label={t("Enviar mensaje y abrir panel", "Send message and open sidebar")}><ArrowUp size={18}/></button>
      </form> : <div className={styles.launcherPill}>
        <button ref={launcherRef} type="button" className={styles.launcher} onClick={() => setOpen(true)} aria-label={launcherLabel} aria-expanded={false} aria-controls="v2-chat-panel">
          {!intro && <motion.span className={styles.launcherOrb} layoutId="assistant-orb" transition={reducedMotion ? { duration: 0 } : { ...ASSISTANT_TRANSITION, duration: .7 }}><AssistantMascot active={!open} /></motion.span>}
          <span className={styles.launcherCopy}>{t("Pregunta, crea, planifica", "Ask, create, plan")}</span>
        </button>
        <button type="button" className={styles.quickCompose} onClick={() => setLauncherExpanded(true)} aria-label={t("Escribir un mensaje rápido", "Write a quick message")} title={t("Escribir un mensaje", "Write a message")}><SquarePen size={17}/></button>
      </div>}
    </div>
    <AnimatePresence>
    {open && <AssistantSurface key="assistant-panel" mode={surfaceMode} mobile={mobile} hostRef={detachedPosition.ref} style={surfaceMode === "detached" && !mobile ? detachedPosition.style : undefined}>
    <section ref={panelRef} id="v2-chat-panel" className={styles.panel} role={mobile ? "dialog" : undefined} aria-modal={mobile ? true : undefined} aria-labelledby="v2-chat-title">
      <header className={styles.header}>
        {surfaceMode === "detached" && !mobile ? <button type="button" className={styles.panelGrip} {...detachedPosition.handle} aria-label={t("Mover ventana del chat", "Move chat window")} title={t("Arrastra para mover", "Drag to move")}><GripVertical size={16}/></button> : null}
        <AssistantMascot thinking={interpretationBusy || workflowBusy || busy} />
        <div className={styles.headerCopy}><strong id="v2-chat-title">CargoMesh <span>Copilot</span></strong></div>
        <div className={styles.headerActions}>
          <button type="button" className={styles.iconButton} onClick={startNewChat} disabled={busy || interpretationBusy || workflowBusy || voiceInterpretPending} aria-label={t("Nueva conversación", "Start new chat")} title={t("Nueva conversación · conserva tu solicitud", "Start new chat · keeps your request")}><SquarePen size={18}/></button>
          <button type="button" className={styles.iconButton} onClick={() => setSurfaceMode((mode) => mode === "sidebar" ? "detached" : "sidebar")} aria-label={surfaceMode === "sidebar" ? t("Desacoplar del panel lateral", "Detach from sidebar") : t("Acoplar al panel lateral", "Dock to sidebar")} title={surfaceMode === "sidebar" ? t("Desacoplar del panel lateral", "Detach from sidebar") : t("Acoplar al panel lateral", "Dock to sidebar")}>{surfaceMode === "sidebar" ? <PanelRightClose size={18}/> : <PanelRightOpen size={18}/>}</button>
          <button type="button" className={styles.iconButton} aria-label={t("Cerrar asistente", "Close assistant")} title={t("Cerrar asistente", "Close assistant")} onClick={closePanel}><X size={19}/></button>
        </div>
      </header>
      <ChatStructuredSummary draft={draft} options={options} request={request} dirty={draftDirty} onEdit={onEdit ? goToFormStep : undefined} t={t} />
      {catalogStatus !== "ready" && <div className={styles.catalogNotice} role="status"><strong>{catalogStatus === "loading" ? t("Preparando los datos de tu organización…", "Loading your organization's catalog…") : t("No se pudo preparar el asistente", "The assistant needs your catalog")}</strong>{catalogError && <span>{catalogError}</span>}{catalogStatus === "empty" && <span>{t("Faltan sedes u opciones compatibles. Revisa el catálogo de tu organización.", "Facilities or supported options are missing. Review your organization's catalog.")}</span>}{catalogStatus !== "loading" && onRetryCatalog && <button type="button" onClick={onRetryCatalog}>{t("Reintentar", "Retry")}</button>}</div>}
      <div className={styles.conversationContent}>
      <div className={styles.messagePane}>
      <div ref={scrollAreaRef} className={styles.scrollArea} onScroll={(event) => {
        const area = event.currentTarget;
        const following = area.scrollHeight - area.scrollTop - area.clientHeight < 80;
        const metrics = scrollMetricsRef.current;
        // Resizing the summary or docking is not a user decision to stop following.
        if (following || !metrics || (metrics.height === area.clientHeight && metrics.contentHeight === area.scrollHeight)) followLatestRef.current = following;
        if (following) setNewMessages(false);
      }}>
        <p role="status">{providerMode==="BEDROCK"?(language==="es"?"Texto interpretado con Amazon Bedrock. Las acciones requieren confirmación.":"Text interpreted with Amazon Bedrock. Actions require confirmation."):providerMode==="DETERMINISTIC"?(language==="es"?"Modo guiado por reglas: interpretación de texto sin modelo generativo.":"Rule-guided mode: text interpretation without a generative model."):null}</p>
        {history.length === 1 && history[0]?.speaker === "assistant" && <div key={`welcome:${conversationEpoch}`} className={styles.welcome}>
          <motion.div className={styles.welcomeMascot} {...assistantWelcomeMotion("mascot", reducedMotion)}><AssistantMascot large /></motion.div>
          <motion.h2 {...assistantWelcomeMotion("title", reducedMotion)}>{t("Planifiquemos tu envío", "Let's plan your shipment")}</motion.h2>
        </div>}
        <div className={styles.history} role="log" aria-live="off" aria-label="Conversation messages">
          {history.map((message, index) => <motion.div key={`${conversationEpoch}:${index}`} className={message.speaker === "user" ? styles.userRow : styles.assistantRow}
            {...(history.length === 1 && message.speaker === "assistant" ? assistantWelcomeMotion("greeting", reducedMotion) : {
              initial: reducedMotion ? false as const : { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 },
              transition: { duration: reducedMotion ? 0 : .36, ease: ASSISTANT_TRANSITION.ease },
            })}><p className={message.speaker === "user" ? styles.user : styles.assistant}><span className={styles.speaker}>{message.speaker === "user" ? "You" : "CargoMesh"}</span>{message.text}</p></motion.div>)}
        </div>
        <div className={styles.srOnly} role="status" aria-live="polite" aria-atomic="true">{announcement}</div>
        {choices.length > 0 && <div className={styles.choiceList} aria-label="Confirm a location">{choices.map((choice) => <button key={choice.value} type="button" onClick={() => { const field = { field: choice.field, value: choice.value }; onFields([field]); setChoices([]); add(null, `Confirmed ${choice.label}. ${ask(missingField(applyChatFieldsToDraft(draft, [field])) ?? "categoryCode")}`); }}>{choice.label}</button>)}</div>}
        {voiceReviewOpen && <section ref={reviewRef} className={styles.spokenReview} aria-label={language==='es'?'Confirmar solicitud por voz':'Review spoken freight request'}>
          <header><strong>{language==='es'?'Revisa y confirma tu solicitud':'Review and confirm your request'}</strong><p>{language==='es'?'Puedes corregir cualquier dato hablando. El resumen se actualiza; no se guarda automáticamente.':'Correct any detail by voice. The summary updates; it is not saved automatically.'}</p></header>
          <dl>{reviewRows(draft,options,language).map(row=><div key={row.label}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl>
          {voiceReviewNotice&&<p role="status" className={styles.reviewPending}>{voiceReviewNotice}</p>}
          {(reviewIssues.length>0||spokenRouteConflict||spokenWeightConflict||hasCaptureClarification()||measurementPending)&&<p className={styles.reviewPending}>{language==='es'?`Quedan datos pendientes o contradictorios. Sigue respondiendo por voz. ${nextField?ask(nextField):''}`:`Some details need clarification. Keep answering by voice. ${nextField?ask(nextField):''}`}</p>}
          <p className={styles.reviewPending}>{language==='es'?'Di «quiero corregir» para continuar o «confirmo guardar el borrador» después de revisar todos los datos. Un «sí» no crea una solicitud ni reserva transporte.':'Say “keep editing” to continue, or “confirm and save my draft” after reviewing every detail. A bare yes never creates a request or books transport.'}</p>
          <div className={styles.reviewActions}>
            <button type="button" onClick={()=>{voiceConfirmationRef.current=null;setVoiceReviewOpen(false);}}>{language==='es'?'Seguir corrigiendo por voz':'Keep correcting by voice'}</button>
            <button type="button" disabled={novaSpeaking||voiceInterpretPending||busy} onClick={()=>requestVoiceReview()}>{language==='es'?'Revisar resumen actualizado':'Review updated summary'}</button>
            {voicePayload&&<button type="button" className={styles.reviewAction} disabled={novaSpeaking||busy||voiceInterpretPending||optionsSource==='fixture'||Boolean(measurementPending)||hasCaptureClarification()||!canApproveDraftReview(voiceConfirmationRef.current?.review??null,draft)} onClick={confirmSpokenDraft}>{language==='es'?'Confirmar y guardar borrador':'Confirm and save draft'}</button>}
          </div>
        </section>}
        {!voiceMode&&capturePending.date && <DateClarificationPanel key={JSON.stringify(capturePending.date)} pending={capturePending.date} language={language} onDiscard={()=>setCaptureClarification({...capturePendingRef.current,date:null})} onConfirm={(role,start,end)=>{const fields=[{field:role==='pickup'?'pickupWindowStartsAt' as const:'deliveryWindowStartsAt' as const,value:start},{field:role==='pickup'?'pickupWindowEndsAt' as const:'deliveryWindowEndsAt' as const,value:end}];voiceDraftRef.current=applyChatFieldsToDraft(voiceDraftRef.current,fields);onFields(fields);setCaptureClarification({...capturePendingRef.current,date:null});add(null,language==='es'?'Ventana aplicada al borrador local. Revisa el resumen antes de guardar.':'Window applied to the local draft. Review before saving.');}}/>}
        {!voiceMode&&capturePending.classification && <CargoClassificationPanel options={options} language={language} onConfirm={(code,product)=>{const fields=[{field:'categoryCode' as const,value:code},{field:'cargoDescription' as const,value:product}];voiceDraftRef.current=applyChatFieldsToDraft(voiceDraftRef.current,fields);onFields(fields);setCaptureClarification({...capturePendingRef.current,classification:false});add(null,language==='es'?'Apliqué tu clasificación revisada; los requisitos y documentos todavía deben validarse.':'Applied your reviewed classification; requirements and documents still need validation.');}}/>}
        {commercialCommand && request && optionsSource!=='fixture' && <ChatCommercialPanel key={`${request.id}:${request.draftVersion}`} requestId={request.id} organizationId={request.organizationId} version={request.draftVersion} command={commercialCommand} blocked={busy||draftDirty||Boolean(measurementPending || capturePending.date || capturePending.classification)} language={language} onChanged={onRead}/>}
        {quotePanelOpen && request && optionsSource !== "fixture" && <ChatQuotePanel key={`${request.id}:${request.draftVersion}:${request.status}`} request={request}
          blocked={busy || interpretationBusy || Boolean(measurementPending || capturePending.date || capturePending.classification) || draftDirty} language={language} onChanged={onRead}
          onDiscuss={() => add(null, language === "es" ? "Las ofertas son atribuibles al transportista. El precio histórico es solo una referencia; no confirma precio o capacidad actual." : "Offers belong to their carrier. Historical prices are references, not current price or capacity confirmations.")}/>}
        {request && !draftDirty && optionsSource !== "fixture" && <div className={styles.confirmation} role="group" aria-label={language === "es" ? "Continuar con la solicitud guardada" : "Continue with the saved request"}>
          <strong>{request.referenceCode} · {language === "es" ? "versión" : "version"} {request.draftVersion}</strong>
          <p>{language === "es" ? "Revisa las alternativas de esta solicitud en Operaciones. Solicitar cotizaciones, seleccionar una opción y autorizar una reserva requieren sus propias confirmaciones; abrir la pantalla no contrata transporte." : "Review this request's alternatives in Operations. Requesting quotes, selecting an option and authorizing a booking each require their own confirmation; opening this screen does not book transportation."}</p>
          <button className={styles.suggestion} type="button" disabled={busy || interpretationBusy || Boolean(measurementPending || capturePending.date || capturePending.classification)} onClick={() => setQuotePanelOpen(current=>!current)}>{language === "es" ? (quotePanelOpen ? "Cerrar cotización" : "Buscar cotizaciones con confirmación") : (quotePanelOpen ? "Close quotation" : "Request quotes with confirmation")}</button>
          <Link className={styles.suggestion} href={workspaceHref(`/requests/${encodeURIComponent(request.id)}`, pathname ?? "")}>
            {language === "es" ? "Revisar alternativas y acciones" : "Review alternatives and actions"}
          </Link>
        </div>}
        {measurementPending && <p className={styles.notice} role="alert">{language === "es" ? "Medidas pendientes de aclaración. La confirmación desde el asistente está bloqueada." : "Measurements need clarification. Assistant confirmation is blocked."}</p>}
        {!awaitingConfirmation && !busy && (!request || draftDirty) && <button type="button" className={styles.suggestion} onClick={() => prepareConfirmation(draft)}>{request ? t("Revisar cambios antes de guardar", "Review changes before saving") : t("Revisar borrador antes de crear", "Review draft before creating")}</button>}
        {awaitingConfirmation && <div className={styles.confirmation} role="group" aria-label="Confirm request save"><strong>{language === "es" ? (request ? "Guardar revisión del borrador" : "Crear borrador") : (request ? "Save DRAFT revision" : "Create DRAFT")}</strong><p>{request ? `Expected version ${request.draftVersion} will be used.` : "A DRAFT will be created for your current organization."} Check every detail below. This approval expires after five minutes; no booking will occur.</p><dl>{reviewRows(draft, options,language).map((row) => <div key={row.label}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl><div><button type="button" onClick={() => confirmSave(null)} disabled={busy || Boolean(measurementPending || capturePending.date || capturePending.classification)}>{language === "es" ? (request ? "Confirmar revisión" : "Confirmar creación") : (request ? "Confirm revision" : "Confirm creation")}</button><button type="button" onClick={() => { confirmationRef.current = null; setAwaitingConfirmation(false); add(null, "Nothing was saved. You can keep editing."); }}>{language === "es" ? "Seguir editando" : "Keep editing"}</button></div></div>}
        {draftDirty && <p className={styles.notice} role="status">{t("Hay cambios locales sin guardar. Confirma la revisión para volver a evaluar ROAD.", "Local changes are unsaved. Confirm the revision before checking ROAD again.")}</p>}
        {error?.code === "STALE_DRAFT" && onReload && <div className={styles.conflict} role="alert"><strong>{t("Conflicto de versión", "Version conflict")}</strong><p>{t("Otro cambio actualizó el DRAFT. Recargar la versión del servidor descartará tus cambios locales sin guardar.", "Another change updated this DRAFT. Reloading the server version will discard your unsaved local changes.")}</p><button type="button" onClick={onReload}>{t("Recargar versión actual", "Reload current version")}</button></div>}
        {interpretationBusy && <p className={styles.loading} role="status">{t("Interpretando tu mensaje…", "Interpreting your message…")}</p>}
        {workflowBusy && <p className={styles.loading} role="status">{t("Consultando datos actuales…", "Reading current records…")}</p>}
        {busy && <p className={styles.loading} role="status">{t("Guardando y consultando la solicitud…", "Saving and reading your request…")}</p>}
        {failedMessage && <button type="button" className={styles.retry} onClick={() => { setText(failedMessage); setFailedMessage(""); inputRef.current?.focus(); }}>{t("Reintentar mensaje", "Retry message")}</button>}
      </div>
      {newMessages && <button type="button" className={styles.latest} onClick={scrollToLatest}>{t("Ver mensajes recientes", "View latest messages")}</button>}
      </div>
      </div>
      <div className={styles.composerDock}>
        {!novaVoiceEnabled && (voice.message || voice.state === "unsupported") && <p className={styles.voiceStatus} role="status">{voice.message || "Speech recognition is unavailable here. You can type every step."}</p>}
        {sendNotice && <p className={styles.voiceStatus} role="status">{sendNotice}</p>}
        <form onSubmit={(event) => { event.preventDefault(); void send(); }} className={styles.composer}>
          <label className={styles.srOnly} htmlFor="v2-chat-text">Your message or editable voice transcript</label>
          <textarea rows={2} maxLength={4096} className={styles.messageInput} onKeyDown={event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.nativeEvent.isComposing){event.preventDefault();event.currentTarget.form?.requestSubmit();}}} ref={inputRef} id="v2-chat-text" value={text} onChange={(event) => setText(event.target.value)} placeholder={t("Describe tu carga o corrige un dato…", "Describe cargo or correct a detail…")} autoComplete="off" disabled={busy || interpretationBusy || workflowBusy || novaTextPending} />
          {!novaVoiceEnabled && (voice.state === "listening" || voice.state === "requesting_permission")
            ? <button type="button" className={styles.micActive} aria-label="Stop listening" title="Stop listening" onClick={voice.stop}>■</button>
            : !novaVoiceEnabled && <button type="button" className={styles.mic} aria-label={voice.state === "unsupported" ? "Speech recognition unavailable" : "Dictate message"} title={voice.state === "unsupported" ? "Speech recognition unavailable" : "Dictate message"} disabled={catalogStatus !== "ready" || voice.state === "unsupported" || voice.state === "checking" || voice.state === "processing" || voice.speaking || busy || interpretationBusy || workflowBusy} onClick={voice.start}><svg aria-hidden="true" viewBox="0 0 24 24" fill="none"><rect x="9" y="3" width="6" height="12" rx="3" stroke="currentColor" strokeWidth="1.8"/><path d="M6 11a6 6 0 0 0 12 0M12 17v4m-4 0h8" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg></button>}
          <button type="submit" className={styles.send} aria-label="Send message" title="Send message" disabled={!text.trim() || busy || interpretationBusy || workflowBusy || novaTextPending || novaSpeaking || voice.speaking}><svg aria-hidden="true" viewBox="0 0 24 24" fill="none"><path d="m4 12 15-8-3 16-4-6-8-2Zm8 2 7-10" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg></button>
        </form>
        {novaVoiceEnabled && catalogStatus === "ready" && <>
          <AssistantLiveContent><NovaVoicePreview externalSpeaking={voice.speaking} audioReplies={audioReplies} textInputRef={novaTextSenderRef} key={conversationEpoch} preview={optionsSource === "fixture"} language={language} draftContext={voiceDraftContext(draft, request?.draftVersion ?? null, [...(measurementPending ? ["MEASUREMENT_SCOPE_PENDING" as const] : []),...(capturePending.date ? ["DATE_WINDOW_PENDING" as const] : []),...(capturePending.classification ? ["CLASSIFICATION_PENDING" as const] : [])], measurementPending, {timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone,pendingDates:capturePending.date?.alternatives??[]})} voiceContext={recentVoiceContext(history)} onPlaybackStateChange={speaking=>{setNovaSpeaking(speaking);if(speaking)setVoiceMode(true);}} onResponseFinished={()=>{awaitVoiceReplyRef.current=false;setResponseFinishedEpoch(n=>n+1);}} onTurn={(update) => {
            const nextHistory = applyVoiceTranscript(voiceHistoryRef.current, update);
            voiceHistoryRef.current = nextHistory;
            setHistory(nextHistory);
            if (update.final && update.role === "assistant") setAnnouncement(update.text);
            if (update.final && update.role === "user") setLanguage(current => conversationLanguage(update.text, current));
            if (update.final && update.role === "user" && !appliedVoiceTurnsRef.current.has(update.contentId)) {
              appliedVoiceTurnsRef.current.add(update.contentId);setVoiceMode(true);
              const reviewCommand=spokenReviewCommand(update.text);
              if(reviewCommand){
                if(processedVoiceCommandsRef.current.has(update.contentId))return;
                processedVoiceCommandsRef.current.add(update.contentId);
                if(reviewCommand==='continue'){voiceConfirmationRef.current=null;setVoiceReviewOpen(false);setQueuedVoiceAction(null);return;}
                if(reviewCommand==='review'){requestVoiceReview(true);return;}
                if(reviewCommand==='confirm'&&!voiceReviewOpen){setVoiceReviewNotice(language==='es'?'Pide revisar el resumen antes de confirmar.':'Ask to review the summary before confirming.');return;}
                awaitVoiceReplyRef.current=true;setQueuedVoiceAction(reviewCommand);return;
              }
              if (handleCaptureClarification(update.text,null) || handleMeasurement(update.text, null)) return;
              const commercial = commercialChatIntent(update.text);
              if(commercial&&request&&optionsSource!=='fixture'){setCommercialCommand({...commercial,nonce:Date.now()});add(null,language==='es'?'Revisa la acción y confirma en pantalla; todavía no ejecuté selección ni reserva.':'Review and confirm the action on screen; no selection or booking was executed yet.');return;}
              if (wantsQuoteSearch(update.text)) {
                if (request && optionsSource !== "fixture") {
                  setQuotePanelOpen(true);
                  add(null, language === "es" ? "Abre el panel de cotización, revisa el pedido y el plazo y confirma con la casilla y el botón. Tu petición de voz todavía no ha solicitado ni contratado transporte." : "Review the quotation panel and deadline, then confirm with the checkbox and button. Your voice request has not requested quotes or booked transportation yet.");
                } else add(null,language === "es" ? "Primero revisa y guarda una solicitud autorizada." : "First review and save an authorized request.");
                return;
              }
              if (!spokenReviewCommand(update.text)) {
                const fields = buildSpokenRequestReview([{speaker:"user",text:update.text,contentId:update.contentId,provisional:false}], options, voiceDraftRef.current).fields.filter(f=>(!capturePendingRef.current.date||!f.field.endsWith("At"))&&(!capturePendingRef.current.classification||f.field!=="categoryCode")&&(!measurementPendingRef.current||!["unitLengthCm","unitWidthCm","unitHeightCm","unitVolumePerUnitM3"].includes(f.field)));
                if (fields.length) {
                  voiceDraftRef.current = applyChatFieldsToDraft(voiceDraftRef.current, fields);
                  onFields(fields);
                  setVoiceReviewNotice(`${fields.length} recognized detail${fields.length === 1 ? " was" : "s were"} added to the local draft. Review everything before creating it.`);
                }
                voiceInterpretCountRef.current += 1;
                setVoiceInterpretPending(true);
                voiceInterpretQueueRef.current = voiceInterpretQueueRef.current.then(() => interpretSpokenDetail(update.text, nextHistory)).finally(() => {
                  voiceInterpretCountRef.current -= 1;
                  if (voiceInterpretCountRef.current === 0) setVoiceInterpretPending(false);
                });
              }
            }

          }} /></AssistantLiveContent>
          {spokenDetails && <button type="button" className={styles.retry} onClick={() => requestVoiceReview()}>{language==="es"?"Revisar datos de voz":"Review spoken request details"}</button>}
          {onEdit && <button type="button" className={styles.retry} disabled={novaSpeaking} onClick={() => goToFormStep(1)}>{language==="es"?"Ir al formulario":"Go to request form"}</button>}
        </>}
        {novaVoiceEnabled && <div className={styles.audioActions}><button type="button" aria-pressed={audioReplies} onClick={() => { setAudioReplies(enabled => !enabled); if (audioReplies) voice.stopResponse(); }}>{audioReplies ? t("Respuestas con voz activadas", "Voice replies on") : t("Respuestas con voz desactivadas", "Voice replies off")}</button></div>}
        {!novaVoiceEnabled && <div className={styles.audioActions}><button type="button" onClick={() => { setAudioReplies((enabled) => !enabled); if (audioReplies) voice.stopResponse(); }} aria-pressed={audioReplies}>{audioReplies ? "Voice replies on" : "Voice replies off"}</button><button type="button" onClick={() => voice.readResponse()} disabled={!voice.canRead || voice.speaking}>Replay</button><button type="button" onClick={voice.stopResponse} disabled={!voice.speaking}>Stop audio</button><label>Voice <select aria-label="Voice for spoken replies" value={voice.selectedVoiceURI} onChange={(event) => voice.setSelectedVoiceURI(event.target.value)}><option value="">Automatic · Zira preferred</option>{voice.availableVoices.map((option) => <option key={option.voiceURI} value={option.voiceURI}>{option.name} ({option.lang}){option.localService ? " · device" : ""}</option>)}</select></label><label>Pace <select aria-label="Voice pace" value={voiceRate} onChange={(event) => setVoiceRate(Number(event.target.value))}><option value={0.88}>Relaxed</option><option value={0.96}>Natural</option><option value={1.06}>Brisk</option></select></label><button type="button" onClick={() => voice.readResponse("Hello, I'm CargoMesh. Tell me what you need to ship, and I'll help you step by step.")} disabled={voice.speaking}>Test voice</button></div>}
      </div>
    </section></AssistantSurface>}
    </AnimatePresence>
    </LayoutGroup>
  </aside>;
}

function ChatStructuredSummary({ draft, options, request, dirty, onEdit, t }: { draft: V2IntakePrototypeDraft; options: IntakeOptionsData; request: FreightRequestV2Data | null; dirty: boolean; onEdit?: (step: PrototypeStep) => void; t: (es: string, en: string) => string }) {
  const rows: Array<{ label: string; value: string; step: PrototypeStep }> = [
    { label: t("Origen", "Origin"), value: draft.originFacilityId ? locationName(draft.originFacilityId, options) : t("Por elegir", "Choose a facility"), step: 1 },
    { label: t("Destino", "Destination"), value: draft.destinationFacilityId ? locationName(draft.destinationFacilityId, options) : t("Por elegir", "Choose a facility"), step: 1 },
    { label: t("Carga", "Cargo"), value: draft.unitQuantity ? `${draft.unitQuantity} × ${draft.packaging || "—"} · ${draft.categoryCode || t("categoría pendiente", "category pending")}` : t("Por definir", "Not specified"), step: 2 },
    { label: t("Retiro", "Pickup"), value: draft.pickupWindowStartsAt || t("Por definir", "Not specified"), step: 3 },
    { label: t("Entrega", "Delivery"), value: draft.deliveryWindowStartsAt || t("Por definir", "Not specified"), step: 3 },
    { label: t("Equipo", "Equipment"), value: draft.requiredEquipment || t("Por definir", "Not specified"), step: 3 },
  ];
  const validation = validatePrototypeReview(draft);
  const completed = [draft.originFacilityId, draft.destinationFacilityId, draft.unitQuantity && draft.categoryCode, draft.pickupWindowStartsAt, draft.deliveryWindowStartsAt, draft.requiredEquipment].filter(Boolean).length;
  return <details className={styles.structuredSummary}>
    <summary><span className={styles.draftIcon} aria-hidden="true"><MessageSquareText size={17}/></span><span className={styles.draftLabel}><strong>{t("Borrador compartido", "Shared draft")}</strong><small>{dirty ? t("Cambios sin guardar", "Unsaved changes") : request ? t(`Guardado · versión ${request.draftVersion}`, `Saved · version ${request.draftVersion}`) : t("Aún sin guardar", "Not saved yet")}</small></span><span className={styles.draftCount} aria-label={t(`${completed} de 6 datos principales`, `${completed} of 6 main details`)}>{completed}/6</span><ChevronDown size={16} aria-hidden="true" /></summary>
    {request && <p className={styles.summaryReference}>{request.referenceCode}</p>}
    <dl>{rows.map((row) => <div key={row.label}><dt>{row.label}</dt><dd>{row.value}</dd>{onEdit ? <button type="button" onClick={() => onEdit(row.step)} aria-label={`${t("Editar", "Edit")} ${row.label}`}>{t("Editar", "Edit")}</button> : null}</div>)}</dl>
    <p className={styles.summaryStatus}>{validation.valid ? t("Listo para revisión humana; no hay booking automático.", "Ready for human review; no automatic booking.") : t(`${validation.issues.length} dato(s) pendiente(s) antes de guardar.`, `${validation.issues.length} detail(s) needed before saving.`)}</p>
  </details>;
}

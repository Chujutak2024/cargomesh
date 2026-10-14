"use client";

import {workspaceFetch} from "@/features/workspace-mode/workspace-fetch";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { FreightRequestV2Data, IntakeOptionsData, RoadServiceabilityEvaluationV2Data } from "./contracts";
import type { PrototypeStep, V2IntakePrototypeDraft } from "./prototype-model";
import { applyChatFieldsToDraft, validatePrototypeReview } from "./prototype-model";
import { CONVERSATION_FIELDS, choicesForField, matchingConversationChoices, questionForField, resolveConversationSuggestions, type ConversationField, type GuidedConversationField } from "./conversation-fields";
import { useConversationVoice } from "@/features/v2-conversation-prep/voice-controls";
import { InterpretationResponseSchema, guardExplicitCorrection, helpTopic, isHelpFollowUp, type Interpretation } from "@/features/v2-conversation-prep/interpretation";
import { conversationContext } from "./conversation-context";
import { serviceabilityReply } from "./serviceability-reply";
import type { V2IntakeApiError } from "./v2-intake-client";
import { readRequestWorkflow } from "./workflow-chat-client";
import { summarizeWorkflow } from "./workflow-chat-summary";
import { workflowChatIntent } from "./workflow-chat-intent";
import { chatSendGate } from "./chat-send-gate";
import { contextualHelpReply } from "./contextual-help";
import { canApproveDraftReview, proposeDraftReview, type DraftReview } from "./draft-review";
import styles from "./conversation-chat.module.css";
import { useLocale } from "@/features/i18n/locale-provider";

type Message = { speaker: "assistant" | "user"; text: string };
type Choice = { value: string; label: string; field: ConversationField };
const GREETING_EN = "Hi, I'm CargoMesh. Tell me what you need to ship, and I'll help you prepare a request and review preliminary ROAD options.";
const unavailable = "I cannot quote or book transportation here yet. The ROAD check is preliminary; it is neither an offer nor a reservation.";
function englishAcknowledgment(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return /\b(?:claro|puedo|ayudarte|dime|necesito|solicitud|borrador|carga|recoger|entrega|origen|servicios|todav[ií]a)\b/i.test(value)
    ? undefined : value;
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

function draftSummary(draft: V2IntakePrototypeDraft, options: IntakeOptionsData, request: FreightRequestV2Data | null) {
  return `Review the structured details below. ${locationName(draft.originFacilityId, options)} → ${locationName(draft.destinationFacilityId, options)}; ${draft.unitQuantity} unit(s) of ${draft.categoryCode.toLowerCase()}. ${request ? `Saving will revise ${request.referenceCode} from version ${request.draftVersion}.` : "Saving will create a DRAFT for your authorized organization."} Confirm explicitly or tell me what to change.`;
}

function reviewRows(draft: V2IntakePrototypeDraft, options: IntakeOptionsData) {
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
    .map(([field, value]) => ({ label: labels[field] ?? field, value: field === "originFacilityId" || field === "destinationFacilityId"
      ? locationName(String(value), options) : Array.isArray(value) ? value.join(", ") : typeof value === "boolean" ? value ? "Yes" : "No" : String(value) }));
}

export function ConversationChat({ draft, options, optionsSource = "api", request, evaluation, error = null, draftDirty = false, busy, presentation = "floating", canRevise = false, onFields, onSave, onRead, onEvaluate, onEdit, onReload, onStartOver }: {
  draft: V2IntakePrototypeDraft;
  options: IntakeOptionsData;
  optionsSource?: "api" | "fixture";
  request: FreightRequestV2Data | null;
  evaluation: RoadServiceabilityEvaluationV2Data | null;
  error?: V2IntakeApiError | null;
  draftDirty?: boolean;
  busy: boolean;
  presentation?: "floating" | "inline";
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
  const launcherLabel = t("Preguntar a CargoMesh", "Ask CargoMesh");
  const [open, setOpen] = useState(presentation === "inline");
  const [text, setText] = useState("");
  const [history, setHistory] = useState<Message[]>([{ speaker: "assistant", text: GREETING_EN }]);
  const [announcement, setAnnouncement] = useState("");
  const [sendNotice, setSendNotice] = useState("");
  const [failedMessage, setFailedMessage] = useState("");
  const [interpretationBusy, setInterpretationBusy] = useState(false);
  const [workflowBusy, setWorkflowBusy] = useState(false);
  const [audioReplies, setAudioReplies] = useState(true);
  const voiceLanguage = locale === "es" ? "es-PE" as const : "en-US" as const;
  const [voiceRate, setVoiceRate] = useState(0.96);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const confirmationRef = useRef<{ review: DraftReview; requestId: string | null; version: number | null } | null>(null);
  const [choices, setChoices] = useState<Choice[]>([]);
  const [viewport, setViewport] = useState<{ height: number; keyboardInset: number } | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
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
      setText(seed.slice(0, 1000));
    }
  }, []);
  useEffect(() => {
    const openAssistant = () => setOpen(true);
    window.addEventListener("cargomesh:open-assistant", openAssistant);
    return () => window.removeEventListener("cargomesh:open-assistant", openAssistant);
  }, []);
  const nextField = missingField(draft);
  const ask = (field: GuidedConversationField) => questionForField(field, voiceLanguage);


  useEffect(() => { endRef.current?.scrollIntoView({ block: "nearest" }); }, [history, choices]);
  useEffect(() => {
    const index = history.length - 1;
    const latest = history[index];
    if (!audioReplies || !latest || latest.speaker !== "assistant" || index <= lastSpokenMessage.current || latest.text.endsWith("…") || busy || interpretationBusy) return;
    lastSpokenMessage.current = index;
    voice.finishProcessing();
    voice.readResponse(latest.text);
  }, [history, busy, interpretationBusy, audioReplies]);
  useEffect(() => { if (open && presentation === "floating") inputRef.current?.focus(); }, [open, presentation]);
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
    if (!open || presentation === "inline") return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      closePanel();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
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

  function prepareConfirmation(nextDraft: V2IntakePrototypeDraft, user: string | null = null) {
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
    add(user, draftSummary(nextDraft, options, request));
  }

  function confirmSave(user: string | null) {
    if (optionsSource === "fixture") {
      confirmationRef.current = null;
      setAwaitingConfirmation(false);
      add(user, "This preview only tests the conversation. Sign in on the V2 freight page to save a request.");
      return;
    }
    const confirmation = confirmationRef.current;
    if (!confirmation || !canApproveDraftReview(confirmation.review, draft)
      || confirmation.requestId !== (request?.id ?? null) || confirmation.version !== (request?.draftVersion ?? null)
      || !validatePrototypeReview(draft).valid || (request && (!canRevise || request.status !== "DRAFT"))) {
      add(user, "The draft changed, is incomplete, or cannot be revised here. Review it again before saving.");
      confirmationRef.current = null;
      setAwaitingConfirmation(false);
      return;
    }
    add(user, request ? "Saving the confirmed revision, then refreshing ROAD for its new version…" : "Creating your authorized draft, then checking ROAD eligibility…");
    confirmationRef.current = null;
    setAwaitingConfirmation(false);
    onSave();
  }

  function closePanel() {
    if (voice.state === "listening" || voice.state === "requesting_permission") voice.stop();
    voice.stopResponse();
    setOpen(false);
    launcherRef.current?.focus();
  }

  async function interpret(value: string): Promise<{ interpretation: Interpretation; mode: "BEDROCK" | "DETERMINISTIC" }> {
    const input = { schemaVersion: "2.0" as const, text: value, currentField: nextField,
      context: { ...conversationContext(draft, nextField, failedAttempts.current), previousHelpTopic: previousHelpTopic.current } };
    const endpoint = optionsSource === "fixture" ? "/api/v2/conversation/preview" : "/api/v2/conversation/interpret";
    const response = await workspaceFetch(endpoint, {
      method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!response.ok) throw new Error(response.status === 401 ? "Your session or organization membership is no longer active. Sign in again." : "I could not interpret that message. Please retry.");
    const parsed = InterpretationResponseSchema.safeParse(await response.json());
    if (!parsed.success) throw new Error("The conversation service returned an invalid response. Please retry.");
    return { interpretation: parsed.data.interpretation, mode: parsed.data.mode };
  }

  async function send() {
    const gate = chatSendGate(text, busy || interpretationBusy || workflowBusy, voice.speaking);
    if (gate.kind === "wait") {
      if (gate.notice) setSendNotice(gate.notice);
      return;
    }
    const value = gate.value;
    setSendNotice("");
    setFailedMessage("");
    if (voice.state === "listening" || voice.state === "requesting_permission") voice.stop();
    setText("");
    setChoices([]);
    const workflowIntent = workflowChatIntent(value);
    if (workflowIntent) {
      if (optionsSource === "fixture") { add(value, "This preview uses synthetic facilities and cannot read commercial records. Sign in to view an authorized request."); return; }
      if (!request) { add(value, "First save a freight request. Then I can check its current offers, booking state or recorded execution."); return; }
      setWorkflowBusy(true);
      try { add(value, summarizeWorkflow(workflowIntent, await readRequestWorkflow(request.id, workflowIntent))); }
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
      if (proposal.intent === "PRICE" || proposal.intent === "BOOKING") { add(value, unavailable); return; }
      if (proposal.intent === "HELP") {
        if (!isHelpFollowUp(value)) previousHelpTopic.current = helpTopic(value);
        const guided = contextualHelpReply(draft, options, nextField, value);
        const modelReply = mode === "BEDROCK" ? englishAcknowledgment(proposal.acknowledgment) : undefined;
        const explanatoryReply = englishAcknowledgment(proposal.acknowledgment);
        add(value, modelReply ?? (/\b(?:services|offer|available|selection|compare|what is|what can|para qu[eé]|servicios|escoger|comparar)\b/i.test(value) ? explanatoryReply : undefined) ?? guided ?? explanatoryReply ?? "Tell me what you need to ship, and I'll guide you through the request.");
        return;
      }
      if (proposal.intent === "START_OVER") {
        onStartOver?.();
        failedAttempts.current = 0;
        previousHelpTopic.current = null;
        setAwaitingConfirmation(false);
        add(value, "Let’s start a new provisional request. Where should the cargo be picked up?");
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
      for (const suggestion of resolveConversationSuggestions(proposal.fields, options)) {
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
          add(value, contextualHelpReply(draft, options, nextField, value) ?? `I can help you prepare a request. ${ask(nextField ?? "originFacilityId")}`);
          return;
        }
        if (mode === "BEDROCK" && englishAcknowledgment(proposal.acknowledgment)) {
          add(value, englishAcknowledgment(proposal.acknowledgment)!);
          return;
        }
        add(value, failedAttempts.current >= 2
          ? "I still could not identify that detail. You can type a specific value or enter it in the request form."
          : `I did not catch a freight detail. ${ask(nextField ?? "originFacilityId")}`);
        return;
      }
      failedAttempts.current = 0;
      setAwaitingConfirmation(false);
      confirmationRef.current = null;
      const remaining = missingField(projected);
      const preface = englishAcknowledgment(proposal.acknowledgment) ?? `I have ${[...accepted].map((field) => field === "originFacilityId" ? `pickup at ${locationName(projected.originFacilityId, options)}` : field === "destinationFacilityId" ? `delivery at ${locationName(projected.destinationFacilityId, options)}` : field === "unitQuantity" ? `${projected.unitQuantity} unit(s)` : field === "cargoDescription" ? `cargo described as ${projected.cargoDescription}` : field === "categoryCode" ? `${projected.categoryCode.toLowerCase()} cargo` : field === "packaging" ? `${projected.packaging.toLowerCase()} packaging` : "that detail").join(" and ")}.`;
      const changed = proposal.intent === "CORRECT" ? ` Updated ${[...accepted].map((field) => field === "originFacilityId" ? "pickup" : field === "destinationFacilityId" ? "delivery" : field).join(", ")}.` : "";
      if (remaining) add(value, `${preface}${changed} ${ask(remaining)}`);
      else {
        add(value, `${preface}${changed} The structured summary is updated. Review and confirm when ready.`);
      }
    } catch (error) {
      setFailedMessage(value);
      add(value, error instanceof Error ? error.message : "I could not process that message. Please retry.");
    } finally {
      setInterpretationBusy(false);
    }
  }

  return <aside className={styles.shell} data-presentation={presentation} aria-label="CargoMesh ROAD assistant" style={viewport ? { "--chat-visual-height": `${viewport.height}px`, "--chat-keyboard-inset": `${viewport.keyboardInset}px` } as CSSProperties : undefined}>
    {presentation === "floating" ? <button ref={launcherRef} type="button" className={styles.launcher} onClick={() => open ? closePanel() : setOpen(true)} aria-label={launcherLabel + " — " + (open ? t("cerrar asistente", "close assistant") : t("abrir asistente", "open assistant"))} aria-expanded={open} aria-controls="v2-chat-panel">
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none"><path d="M4 5.5h16v11H9l-5 3v-14Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/><path d="M8 10h8M8 13h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg><span>{launcherLabel}</span>
    </button> : null}
    {open && <section id="v2-chat-panel" className={styles.panel} aria-label="ROAD freight conversation">
      <header className={styles.header}><span className={styles.headerIcon} aria-hidden="true">CM</span><div className={styles.headerCopy}><strong>{t("Planifica con CargoMesh", "Plan with CargoMesh")}</strong></div>{presentation === "floating" ? <button type="button" className={styles.close} aria-label="Close CargoMesh assistant" onClick={closePanel}>×</button> : request ? <span className={styles.headerState}>{request.referenceCode} · v{request.draftVersion}</span> : null}</header>
      <div className={styles.conversationContent}>
      <div className={styles.scrollArea}>
        <div className={styles.history} role="log" aria-live="off" aria-label="Conversation messages">
          {history.map((message, index) => <div key={index} className={message.speaker === "user" ? styles.userRow : styles.assistantRow}><p className={message.speaker === "user" ? styles.user : styles.assistant}><span className={styles.speaker}>{message.speaker === "user" ? "You" : "CargoMesh"}</span>{message.text}</p></div>)}
        </div>
        <div className={styles.srOnly} role="status" aria-live="polite" aria-atomic="true">{announcement}</div>
        {choices.length > 0 && <div className={styles.choiceList} aria-label="Confirm a location">{choices.map((choice) => <button key={choice.value} type="button" onClick={() => { const field = { field: choice.field, value: choice.value }; onFields([field]); setChoices([]); add(null, `Confirmed ${choice.label}. ${ask(missingField(applyChatFieldsToDraft(draft, [field])) ?? "categoryCode")}`); }}>{choice.label}</button>)}</div>}
        {!awaitingConfirmation && !busy && (!request || draftDirty) && <button type="button" className={styles.suggestion} onClick={() => prepareConfirmation(draft)}>{request ? t("Revisar cambios antes de guardar", "Review changes before saving") : t("Revisar borrador antes de crear", "Review draft before creating")}</button>}
        {awaitingConfirmation && <div className={styles.confirmation} role="group" aria-label="Confirm request save"><strong>{request ? "Save DRAFT revision" : "Create DRAFT"}</strong><p>{request ? `Expected version ${request.draftVersion} will be used.` : "A DRAFT will be created for your current organization."} Check every detail below. This approval expires after five minutes; no booking will occur.</p><dl>{reviewRows(draft, options).map((row) => <div key={row.label}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl><div><button type="button" onClick={() => confirmSave(null)} disabled={busy}>{request ? "Confirm revision" : "Confirm creation"}</button><button type="button" onClick={() => { confirmationRef.current = null; setAwaitingConfirmation(false); add(null, "Nothing was saved. You can keep editing."); }}>Keep editing</button></div></div>}
        {draftDirty && <p className={styles.notice} role="status">{t("Hay cambios locales sin guardar. Confirma la revisión para volver a evaluar ROAD.", "Local changes are unsaved. Confirm the revision before checking ROAD again.")}</p>}
        {error?.code === "STALE_DRAFT" && onReload && <div className={styles.conflict} role="alert"><strong>{t("Conflicto de versión", "Version conflict")}</strong><p>{t("Otro cambio actualizó el DRAFT. Recargar la versión del servidor descartará tus cambios locales sin guardar.", "Another change updated this DRAFT. Reloading the server version will discard your unsaved local changes.")}</p><button type="button" onClick={onReload}>{t("Recargar versión actual", "Reload current version")}</button></div>}
        {interpretationBusy && <p className={styles.loading} role="status">{t("Interpretando tu mensaje…", "Interpreting your message…")}</p>}
        {workflowBusy && <p className={styles.loading} role="status">{t("Consultando datos actuales…", "Reading current records…")}</p>}
        {busy && <p className={styles.loading} role="status">{t("Guardando y consultando la solicitud…", "Saving and reading your request…")}</p>}
        {failedMessage && <button type="button" className={styles.retry} onClick={() => { setText(failedMessage); setFailedMessage(""); inputRef.current?.focus(); }}>{t("Reintentar mensaje", "Retry message")}</button>}
        <div ref={endRef} />
      </div>
      <ChatStructuredSummary draft={draft} options={options} request={request} dirty={draftDirty} onEdit={onEdit} t={t} />
      </div>
      <div className={styles.composerDock}>
        {(voice.message || voice.state === "unsupported") && <p className={styles.voiceStatus} role="status">{voice.message || "Speech recognition is unavailable here. You can type every step."}</p>}
        {sendNotice && <p className={styles.voiceStatus} role="status">{sendNotice}</p>}
        <form onSubmit={(event) => { event.preventDefault(); void send(); }} className={styles.composer}>
          <label className={styles.srOnly} htmlFor="v2-chat-text">Your message or editable voice transcript</label>
          <input ref={inputRef} id="v2-chat-text" value={text} onChange={(event) => setText(event.target.value)} placeholder={t("Describe tu carga o corrige un dato…", "Describe cargo or correct a detail…")} autoComplete="off" disabled={busy || interpretationBusy || workflowBusy} />
          {voice.state === "listening" || voice.state === "requesting_permission"
            ? <button type="button" className={styles.micActive} aria-label="Stop listening" title="Stop listening" onClick={voice.stop}>■</button>
            : <button type="button" className={styles.mic} aria-label={voice.state === "unsupported" ? "Speech recognition unavailable" : "Dictate message"} title={voice.state === "unsupported" ? "Speech recognition unavailable" : "Dictate message"} disabled={voice.state === "unsupported" || voice.state === "checking" || voice.state === "processing" || voice.speaking || busy || interpretationBusy || workflowBusy} onClick={voice.start}><svg aria-hidden="true" viewBox="0 0 24 24" fill="none"><rect x="9" y="3" width="6" height="12" rx="3" stroke="currentColor" strokeWidth="1.8"/><path d="M6 11a6 6 0 0 0 12 0M12 17v4m-4 0h8" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg></button>}
          <button type="submit" className={styles.send} aria-label="Send message" title="Send message" disabled={!text.trim() || busy || interpretationBusy || workflowBusy}><svg aria-hidden="true" viewBox="0 0 24 24" fill="none"><path d="m4 12 15-8-3 16-4-6-8-2Zm8 2 7-10" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg></button>
        </form>
        <div className={styles.audioActions}><button type="button" onClick={() => { setAudioReplies((enabled) => !enabled); if (audioReplies) voice.stopResponse(); }} aria-pressed={audioReplies}>{audioReplies ? "Voice replies on" : "Voice replies off"}</button><button type="button" onClick={() => voice.readResponse()} disabled={!voice.canRead || voice.speaking}>Replay</button><button type="button" onClick={voice.stopResponse} disabled={!voice.speaking}>Stop audio</button><label>Voice <select aria-label="Voice for spoken replies" value={voice.selectedVoiceURI} onChange={(event) => voice.setSelectedVoiceURI(event.target.value)}><option value="">Automatic</option>{voice.availableVoices.map((option) => <option key={option.voiceURI} value={option.voiceURI}>{option.name} ({option.lang}){option.localService ? " · device" : ""}</option>)}</select></label><label>Pace <select aria-label="Voice pace" value={voiceRate} onChange={(event) => setVoiceRate(Number(event.target.value))}><option value={0.88}>Relaxed</option><option value={0.96}>Natural</option><option value={1.06}>Brisk</option></select></label><button type="button" onClick={() => voice.readResponse("Hello, I'm CargoMesh. Tell me what you need to ship, and I'll help you step by step.")} disabled={voice.speaking}>Test voice</button></div>
      </div>
    </section>}
  </aside>;
}

function ChatStructuredSummary({ draft, options, request, dirty, onEdit, t }: { draft: V2IntakePrototypeDraft; options: IntakeOptionsData; request: FreightRequestV2Data | null; dirty: boolean; onEdit?: (step: PrototypeStep) => void; t: (es: string, en: string) => string }) {
  const rows: Array<{ label: string; value: string; step: PrototypeStep }> = [
    { label: t("Origen", "Origin"), value: locationName(draft.originFacilityId, options), step: 1 },
    { label: t("Destino", "Destination"), value: locationName(draft.destinationFacilityId, options), step: 1 },
    { label: t("Carga", "Cargo"), value: draft.unitQuantity ? `${draft.unitQuantity} × ${draft.packaging || "—"} · ${draft.categoryCode || t("categoría pendiente", "category pending")}` : t("Por definir", "Not specified"), step: 2 },
    { label: t("Retiro", "Pickup"), value: draft.pickupWindowStartsAt || t("Por definir", "Not specified"), step: 3 },
    { label: t("Entrega", "Delivery"), value: draft.deliveryWindowStartsAt || t("Por definir", "Not specified"), step: 3 },
    { label: t("Equipo", "Equipment"), value: draft.requiredEquipment || t("Por definir", "Not specified"), step: 3 },
  ];
  const validation = validatePrototypeReview(draft);
  return <section className={styles.structuredSummary} aria-label={t("Resumen editable de la solicitud", "Editable request summary")}>
    <div className={styles.summaryHead}><span>{t("BORRADOR COMPARTIDO", "SHARED DRAFT")}</span><strong>{request ? `${request.referenceCode} · v${request.draftVersion}` : t("Aún sin guardar", "Not saved yet")}</strong><p>{dirty ? t("Cambios locales pendientes", "Local changes pending") : request ? t("Datos recuperados del servidor", "Loaded from server") : t("Chat y formulario usan los mismos datos", "Chat and form use the same data")}</p></div>
    <dl>{rows.map((row) => <div key={row.label}><dt>{row.label}</dt><dd>{row.value}</dd>{onEdit ? <button type="button" onClick={() => onEdit(row.step)} aria-label={`${t("Editar", "Edit")} ${row.label}`}>{t("Editar", "Edit")}</button> : null}</div>)}</dl>
    <p className={styles.summaryStatus}>{validation.valid ? t("Listo para revisión humana; no hay booking automático.", "Ready for human review; no automatic booking.") : t(`${validation.issues.length} dato(s) pendiente(s) antes de guardar.`, `${validation.issues.length} detail(s) needed before saving.`)}</p>
  </section>;
}

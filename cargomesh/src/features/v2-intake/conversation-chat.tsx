"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { FreightRequestV2Data, IntakeOptionsData, RoadServiceabilityEvaluationV2Data } from "./contracts";
import type { V2IntakePrototypeDraft } from "./prototype-model";
import { validatePrototypeReview } from "./prototype-model";
import { CONVERSATION_FIELDS, choicesForField, matchingConversationChoices, questionForField, resolveConversationSuggestions, type ConversationField, type GuidedConversationField } from "./conversation-fields";
import { useConversationVoice } from "@/features/v2-conversation-prep/voice-controls";
import { InterpretationResponseSchema, helpTopic, isHelpFollowUp, type Interpretation } from "@/features/v2-conversation-prep/interpretation";
import { conversationContext } from "./conversation-context";
import { serviceabilityReply } from "./serviceability-reply";
import type { V2IntakeApiError } from "./v2-intake-client";
import { readRequestWorkflow } from "./workflow-chat-client";
import { summarizeWorkflow } from "./workflow-chat-summary";
import { workflowChatIntent } from "./workflow-chat-intent";
import { chatSendGate } from "./chat-send-gate";
import styles from "./conversation-chat.module.css";

type Message = { speaker: "assistant" | "user"; text: string };
type Choice = { value: string; label: string; field: ConversationField };
const GREETING_EN = "Hi, I'm CargoMesh. Tell me what you need to ship, and I'll help you prepare a request and review preliminary ROAD options.";
const unavailable = "I cannot quote or book transportation here yet. The ROAD check is preliminary; it is neither an offer nor a reservation.";
function englishAcknowledgment(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return /\b(?:claro|puedo|ayudarte|dime|necesito|solicitud|borrador|carga|recoger|entrega|origen|servicios|todav[ií]a)\b/i.test(value)
    ? undefined : value;
}

const positive = /^(yes|yes,? create (?:the )?draft|create (?:the )?draft|confirm|go ahead|s[ií]|s[ií],? crea(?:r)? (?:el )?borrador|crea(?:r)? (?:el )?borrador|confirmo|confirmar|adelante)$/i;

function missingField(draft: V2IntakePrototypeDraft, filled: Set<ConversationField> = new Set()): GuidedConversationField | null {
  return CONVERSATION_FIELDS.find((field) => !filled.has(field) && !String(draft[field] ?? "").trim()) ?? null;
}

function locationName(id: string, options: IntakeOptionsData) {
  const facility = options.facilities.find((item) => item.facilityId === id);
  if (!facility) return "not selected";
  return facility.label.includes("[SYNTHETIC]") ? `${facility.city} (synthetic test facility)` : `${facility.label}, ${facility.city}`;
}

function draftSummary(draft: V2IntakePrototypeDraft, options: IntakeOptionsData) {
  return `Review the draft: ${locationName(draft.originFacilityId, options)} → ${locationName(draft.destinationFacilityId, options)}; ${draft.unitQuantity} unit(s) of ${draft.categoryCode.toLowerCase()}, ${draft.unitWeightPerUnitKg} kg and ${draft.unitVolumePerUnitM3} m³ per unit; pickup ${draft.pickupWindowStartsAt}–${draft.pickupWindowEndsAt}; delivery ${draft.deliveryWindowStartsAt}–${draft.deliveryWindowEndsAt}. It will be saved for your current authorized organization. Say “yes, create the draft” to save it, or tell me what to change.`;
}

export function ConversationChat({ draft, options, optionsSource = "api", request, evaluation, error = null, draftDirty = false, busy, onField, onCreate, onRead, onEvaluate, onStartOver }: {
  draft: V2IntakePrototypeDraft;
  options: IntakeOptionsData;
  optionsSource?: "api" | "fixture";
  request: FreightRequestV2Data | null;
  evaluation: RoadServiceabilityEvaluationV2Data | null;
  error?: V2IntakeApiError | null;
  draftDirty?: boolean;
  busy: boolean;
  onField: (field: ConversationField, value: string) => void;
  onCreate: () => void;
  onRead: () => void;
  onEvaluate: () => void;
  onStartOver?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [history, setHistory] = useState<Message[]>([{ speaker: "assistant", text: GREETING_EN }]);
  const [announcement, setAnnouncement] = useState("");
  const [sendNotice, setSendNotice] = useState("");
  const [interpretationBusy, setInterpretationBusy] = useState(false);
  const [workflowBusy, setWorkflowBusy] = useState(false);
  const [audioReplies, setAudioReplies] = useState(true);
  const voiceLanguage = "en-US" as const;
  const [voiceRate, setVoiceRate] = useState(0.96);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
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
  const nextField = request ? null : missingField(draft);
  const syntheticCatalog = optionsSource === "fixture" || options.facilities.some((facility) => facility.label.includes("[SYNTHETIC]"));
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
  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);
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
    if (announcedDraftRef.current === request.id) return;
    announcedDraftRef.current = request.id;
    const message = `I saved draft ${request.referenceCode}, version ${request.draftVersion}. You can say “show the draft” or “check ROAD”.`;
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
    const response = await fetch(endpoint, {
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
      if (optionsSource === "fixture") {
        setAwaitingConfirmation(false);
        add(value, "This preview only tests the conversation. Sign in on the V2 freight page to save a request.");
        return;
      }
      if (request || !validatePrototypeReview(draft).valid) {
        add(value, "The draft changed or is incomplete. I will review it again before saving.");
        setAwaitingConfirmation(false);
        return;
      }
      add(value, "Creating your authorized draft, then checking ROAD eligibility…");
      setAwaitingConfirmation(false);
      onCreate();
      return;
    }
    if (awaitingConfirmation && /^(no|not yet|cancel|no todav[ií]a|cancelar)$/i.test(value)) {
      setAwaitingConfirmation(false);
      add(value, "Nothing was saved. Tell me what to correct, for example: “change the pickup to Lima.”");
      return;
    }
    setInterpretationBusy(true);
    try {
      const { interpretation: proposal, mode } = await interpret(value);
      if (proposal.intent === "PRICE" || proposal.intent === "BOOKING") { add(value, unavailable); return; }
      if (proposal.intent === "HELP") { if (!isHelpFollowUp(value)) previousHelpTopic.current = helpTopic(value); add(value, englishAcknowledgment(proposal.acknowledgment) ?? "Tell me the pickup and delivery locations, cargo and dates. I will ask only for missing details, and you can correct them before saving."); return; }
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
        else if (draftDirty) add(value, "Your changes are local and have not been saved. Start a new request with the corrected details before checking ROAD again.");
        else if (evaluation) add(value, serviceabilityReply(evaluation, voiceLanguage));
        else { add(value, "Checking ROAD for the saved draft version…"); onEvaluate(); }
        return;
      }
      if (request) {
        add(value, "I cannot edit this saved draft in chat yet. You can start a new request, show the draft, or check ROAD.");
        return;
      }
      if (proposal.intent === "CREATE" && !proposal.fields.length) {
        if (optionsSource === "fixture") { add(value, "We can prepare the details here, but this preview does not save requests."); return; }
        if (!validatePrototypeReview(draft).valid) add(value, `I still need one detail before saving. ${ask(missingField(draft) ?? "originFacilityId")}`);
        else { setAwaitingConfirmation(true); add(value, draftSummary(draft, options)); }
        return;
      }
      const accepted = new Set<ConversationField>();
      const applied: Partial<Record<GuidedConversationField, string>> = {};
      let clarification: string | null = null;
      for (const suggestion of resolveConversationSuggestions(proposal.fields, options)) {
        const field = suggestion.field;
        const parsed = suggestion.parsed;
        if (parsed === null) {
          if (field === "categoryCode") {
            onField("cargoDescription", suggestion.value);
            applied.cargoDescription = suggestion.value;
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
        onField(field, parsed);
        applied[field] = parsed;
        accepted.add(field);
      }
      if (clarification) {
        failedAttempts.current = accepted.size ? 0 : Math.min(3, failedAttempts.current + 1);
        setAwaitingConfirmation(false);
        add(value, accepted.size ? `I kept the other ${accepted.size} valid detail${accepted.size === 1 ? "" : "s"}. ${clarification}`
          : failedAttempts.current >= 2 ? `${clarification} You can also enter this detail in the request form.` : clarification);
        return;
      }
      if (!accepted.size) {
        failedAttempts.current = Math.min(3, failedAttempts.current + 1);
        if (mode === "DETERMINISTIC" && optionsSource !== "fixture") {
          add(value, "The conversation service is unavailable right now. Your provisional details remain here; you can provide a specific detail or continue in the form.");
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
      const remaining = missingField(draft, accepted);
      const preface = englishAcknowledgment(proposal.acknowledgment) ?? "Got it.";
      const changed = proposal.intent === "CORRECT" ? ` Updated ${[...accepted].map((field) => field === "originFacilityId" ? "pickup" : field === "destinationFacilityId" ? "delivery" : field).join(", ")}.` : "";
      if (remaining) add(value, `${preface}${changed} ${ask(remaining)}`);
      else { setAwaitingConfirmation(true); add(value, draftSummary({ ...draft, ...applied }, options)); }
    } catch (error) {
      add(value, error instanceof Error ? error.message : "I could not process that message. Please retry.");
    } finally {
      setInterpretationBusy(false);
    }
  }

  return <aside className={styles.shell} aria-label="CargoMesh ROAD assistant" style={viewport ? { "--chat-visual-height": `${viewport.height}px`, "--chat-keyboard-inset": `${viewport.keyboardInset}px` } as CSSProperties : undefined}>
    <button ref={launcherRef} type="button" className={styles.launcher} onClick={() => open ? closePanel() : setOpen(true)} aria-label={open ? "Close CargoMesh assistant" : "Open CargoMesh assistant"} aria-expanded={open} aria-controls="v2-chat-panel">
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none"><path d="M4 5.5h16v11H9l-5 3v-14Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/><path d="M8 10h8M8 13h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg><span>Ask CargoMesh</span>
    </button>
    {open && <section id="v2-chat-panel" className={styles.panel} aria-label="ROAD freight conversation">
      <header className={styles.header}><span className={styles.headerIcon} aria-hidden="true">CM</span><div className={styles.headerCopy}><strong>CargoMesh assistant</strong><span>{syntheticCatalog ? "V2 demo · synthetic facilities" : "ROAD freight"}</span></div><button type="button" className={styles.close} aria-label="Close CargoMesh assistant" onClick={closePanel}>×</button></header>
      <div className={styles.scrollArea}>
        <div className={styles.history} role="log" aria-live="off" aria-label="Conversation messages">
          {history.map((message, index) => <div key={index} className={message.speaker === "user" ? styles.userRow : styles.assistantRow}><p className={message.speaker === "user" ? styles.user : styles.assistant}><span className={styles.speaker}>{message.speaker === "user" ? "You" : "CargoMesh"}</span>{message.text}</p></div>)}
        </div>
        <div className={styles.srOnly} role="status" aria-live="polite" aria-atomic="true">{announcement}</div>
        {!request && !awaitingConfirmation && !interpretationBusy && nextField && !history.at(-1)?.text.includes(ask(nextField)) && !/[?？]\s*$/.test(history.at(-1)?.text ?? "") && <p className={styles.nextQuestion}>{ask(nextField)}</p>}
        {choices.length > 0 && <div className={styles.choiceList} aria-label="Confirm a location">{choices.map((choice) => <button key={choice.value} type="button" onClick={() => { onField(choice.field, choice.value); setChoices([]); add(null, `Confirmed ${choice.label}. ${ask(missingField(draft, new Set([choice.field])) ?? "categoryCode")}`); }}>{choice.label}</button>)}</div>}
        {optionsSource !== "fixture" && !request && !nextField && !awaitingConfirmation && !busy && <button type="button" className={styles.suggestion} onClick={() => { setAwaitingConfirmation(true); add(null, draftSummary(draft, options)); }}>Review draft before saving</button>}
        {draftDirty && <p className={styles.notice} role="status">Local edits are not saved. ROAD cannot be reevaluated for them yet.</p>}
        {busy && <p className={styles.loading} role="status">Working on your saved request…</p>}
        <div ref={endRef} />
      </div>
      <div className={styles.composerDock}>
        {(voice.message || voice.state === "unsupported") && <p className={styles.voiceStatus} role="status">{voice.message || "Speech recognition is unavailable here. You can type every step."}</p>}
        {sendNotice && <p className={styles.voiceStatus} role="status">{sendNotice}</p>}
        <form onSubmit={(event) => { event.preventDefault(); void send(); }} className={styles.composer}>
          <label className={styles.srOnly} htmlFor="v2-chat-text">Your message or editable voice transcript</label>
          <input ref={inputRef} id="v2-chat-text" value={text} onChange={(event) => setText(event.target.value)} placeholder="Message CargoMesh…" autoComplete="off" disabled={busy || interpretationBusy || workflowBusy} />
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

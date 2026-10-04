"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { FreightRequestV2Data, IntakeOptionsData, RoadServiceabilityEvaluationV2Data } from "./contracts";
import type { V2IntakePrototypeDraft } from "./prototype-model";
import { validatePrototypeReview } from "./prototype-model";
import { CONVERSATION_FIELDS, FIELD_QUESTION, matchingConversationChoices, parseConversationField, type ConversationField, type GuidedConversationField } from "./conversation-fields";
import { useConversationVoice } from "@/features/v2-conversation-prep/voice-controls";
import { InterpretationResponseSchema, interpretDeterministically, type Interpretation } from "@/features/v2-conversation-prep/interpretation";
import type { V2IntakeApiError } from "./v2-intake-client";
import styles from "./conversation-chat.module.css";

type Message = { speaker: "assistant" | "user"; text: string };
type Choice = { value: string; label: string; field: ConversationField };
const GREETING = "Hi! I can help you prepare a ROAD freight request.";
const unavailable = "I can't quote a carrier price or book freight yet. ROAD eligibility is preliminary, not an offer.";
const positive = /^(yes|yes,? create (?:the )?draft|create (?:the )?draft|confirm|go ahead)$/i;

function missingField(draft: V2IntakePrototypeDraft, filled: Set<ConversationField> = new Set()): GuidedConversationField | null {
  return CONVERSATION_FIELDS.find((field) => !filled.has(field) && !String(draft[field] ?? "").trim()) ?? null;
}

function locationName(id: string, options: IntakeOptionsData) {
  const facility = options.facilities.find((item) => item.facilityId === id);
  if (!facility) return "not selected";
  return facility.label.includes("[SYNTHETIC]") ? `${facility.city} (synthetic test facility)` : `${facility.label}, ${facility.city}`;
}

function draftSummary(draft: V2IntakePrototypeDraft, options: IntakeOptionsData) {
  return `Please review: ${locationName(draft.originFacilityId, options)} → ${locationName(draft.destinationFacilityId, options)}; ${draft.unitQuantity} unit(s) of ${draft.categoryCode.toLowerCase()} cargo, ${draft.unitWeightPerUnitKg} kg and ${draft.unitVolumePerUnitM3} m³ per unit; pickup ${draft.pickupWindowStartsAt}–${draft.pickupWindowEndsAt}; delivery ${draft.deliveryWindowStartsAt}–${draft.deliveryWindowEndsAt}. The saved draft will use the current authorized organization. Reply “yes, create draft” to save it, or tell me what to change.`;
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
  const [history, setHistory] = useState<Message[]>([{ speaker: "assistant", text: GREETING }]);
  const [announcement, setAnnouncement] = useState("");
  const [interpretationBusy, setInterpretationBusy] = useState(false);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const [choices, setChoices] = useState<Choice[]>([]);
  const [viewport, setViewport] = useState<{ height: number; keyboardInset: number } | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const announcedDraftRef = useRef<string | null>(null);
  const voiceTurnActive = useRef(false);
  const lastSpokenMessage = useRef(-1);
  const latestAssistant = history.findLast((message) => message.speaker === "assistant")?.text ?? "";
  const voice = useConversationVoice({
    onTranscript: (recognized) => { setText(recognized); inputRef.current?.focus(); },
    onSilence: (recognized) => { void send(recognized, true); },
    responseText: latestAssistant,
  });
  const nextField = request ? null : missingField(draft);
  const syntheticCatalog = optionsSource === "fixture" || options.facilities.some((facility) => facility.label.includes("[SYNTHETIC]"));

  useEffect(() => { endRef.current?.scrollIntoView({ block: "nearest" }); }, [history, choices]);
  useEffect(() => {
    const index = history.length - 1;
    const latest = history[index];
    if (!voiceTurnActive.current || !latest || latest.speaker !== "assistant" || index <= lastSpokenMessage.current || latest.text.endsWith("…")) return;
    lastSpokenMessage.current = index;
    voice.finishProcessing();
    voice.readResponse(latest.text);
  }, [history]);
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
    const message = `Saved draft ${request.referenceCode}, version ${request.draftVersion}. Ask “show draft” or “check ROAD”.`;
    setHistory((current) => current.length === 1 && current[0]?.text === GREETING ? [{ speaker: "assistant", text: message }] : [...current, { speaker: "assistant", text: message }]);
    setAnnouncement(message);
    setAwaitingConfirmation(false);
  }, [request]);
  useEffect(() => {
    if (!evaluation) return;
    const details = evaluation.candidates.length ? evaluation.candidates.map((candidate) =>
      `${candidate.carrier.commercialName}: ${candidate.status}; reasons ${candidate.reasons.join(", ") || "none"}; capacity source ${candidate.checks.capacityWindow.provenance.dataSource}; observed ${candidate.checks.capacityWindow.provenance.observedAt ?? "unknown"}`).join(". ")
      : "The service returned no carrier candidates and no carrier-specific reason codes.";
    const result = `ROAD is ${evaluation.overallStatus}. ${details} Evaluated ${evaluation.evaluatedAt} against draft version ${evaluation.evaluatedDraftVersion}. This is not a quote or booking.`;
    setHistory((current) => [...current, { speaker: "assistant", text: result }]);
    setAnnouncement(`ROAD result ${evaluation.overallStatus}. Reasons and provenance are in the latest message.`);
  }, [evaluation]);
  useEffect(() => {
    if (!error) return;
    const reply = error.code === "STALE_DRAFT" ? "This draft version changed. Reload the authorized draft before evaluating it."
      : error.code === "FORBIDDEN_TENANT" || error.status === 403 ? "This request is not available to your organization."
      : error.status === 401 ? "Your session expired. Sign in again to continue."
      : error.code === "IDEMPOTENCY_CONFLICT" ? "This retry key belongs to different details. Review the draft before trying again."
      : "I could not complete that step. Your provisional details remain here; please retry.";
    setHistory((current) => [...current, { speaker: "assistant", text: reply }]);
    setAnnouncement(reply);
  }, [error]);

  function add(user: string | null, assistant: string) {
    setHistory((current) => [...current, ...(user ? [{ speaker: "user" as const, text: user }] : []), { speaker: "assistant", text: assistant }]);
    setAnnouncement(assistant);
  }

  function closePanel() {
    voiceTurnActive.current = false;
    if (voice.state === "listening" || voice.state === "requesting_permission") voice.stop();
    voice.stopResponse();
    setOpen(false);
    launcherRef.current?.focus();
  }

  async function interpret(value: string): Promise<Interpretation> {
    const input = { schemaVersion: "2.0" as const, text: value, currentField: nextField };
    if (optionsSource === "fixture") return interpretDeterministically(input);
    const response = await fetch("/api/v2/conversation/interpret", {
      method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!response.ok) throw new Error(response.status === 401 ? "Your session or organization membership is no longer active. Sign in again." : "I could not interpret that message. Please retry.");
    const parsed = InterpretationResponseSchema.safeParse(await response.json());
    if (!parsed.success) throw new Error("The conversation service returned an invalid response. Please retry.");
    return parsed.data.interpretation;
  }

  async function send(override?: string, fromVoice = false) {
    const value = (override ?? text).trim();
    if (!value || busy || interpretationBusy || voice.speaking) {
      if (fromVoice) voice.finishProcessing();
      return;
    }
    if (!fromVoice && (voice.state === "listening" || voice.state === "requesting_permission")) voice.stop();
    voiceTurnActive.current = fromVoice;
    setText("");
    setChoices([]);
    if (awaitingConfirmation && positive.test(value)) {
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
    if (awaitingConfirmation && /^(no|not yet|cancel)$/i.test(value)) {
      setAwaitingConfirmation(false);
      add(value, "Nothing was saved. Tell me what to correct, for example “change origin to Lima”.");
      return;
    }
    setInterpretationBusy(true);
    try {
      const proposal = await interpret(value);
      if (proposal.intent === "PRICE" || proposal.intent === "BOOKING") { add(value, unavailable); return; }
      if (proposal.intent === "HELP") { add(value, "Tell me a pickup and delivery place, cargo details and timing. I will ask for missing details one at a time. You can correct a detail before saving."); return; }
      if (proposal.intent === "START_OVER") {
        onStartOver?.();
        setAwaitingConfirmation(false);
        add(value, "Starting a new provisional request. Where should the freight be picked up?");
        return;
      }
      if (proposal.intent === "READ") {
        if (!request) add(value, "There is no saved draft yet. Tell me about your shipment first.");
        else { add(value, `Reading saved draft ${request.referenceCode} with your current authorization…`); onRead(); }
        return;
      }
      if (proposal.intent === "EVALUATE") {
        if (!request) add(value, "I need a saved draft before checking ROAD.");
        else if (draftDirty) add(value, "Your changes are only local and have not been saved. I cannot reevaluate them yet. Start a new request for changed details.");
        else { add(value, "Checking ROAD for the saved draft version…"); onEvaluate(); }
        return;
      }
      if (request) {
        add(value, "I cannot update this saved draft in chat yet. Start over for a new request, or ask me to show the saved draft or check ROAD.");
        return;
      }
      if (proposal.intent === "CREATE") {
        if (!validatePrototypeReview(draft).valid) add(value, `I still need one detail before saving. ${FIELD_QUESTION[missingField(draft) ?? "originFacilityId"]}`);
        else { setAwaitingConfirmation(true); add(value, draftSummary(draft, options)); }
        return;
      }
      const accepted = new Set<ConversationField>();
      for (const suggestion of proposal.fields) {
        const field = suggestion.field as ConversationField;
        const parsed = parseConversationField(field, suggestion.value, options);
        if (parsed === null) {
          const matches = matchingConversationChoices(field, suggestion.value, options);
          if (matches.length > 1) {
            setChoices(matches.map((choice) => ({ ...choice, field })));
            add(value, "I found more than one authorized location. Please confirm one of the labeled choices below. No location has been saved yet.");
          } else if (field === "originFacilityId" || field === "destinationFacilityId") {
            add(value, "I could not match that place to one of your organization's saved facilities. Searching and confirming other places is not available yet. Please name a saved facility or use the request form.");
          } else add(value, `I could not validate that detail. ${FIELD_QUESTION[field]}`);
          return;
        }
        onField(field, parsed);
        accepted.add(field);
      }
      if (!accepted.size) { add(value, `I did not catch a freight detail. ${FIELD_QUESTION[nextField ?? "originFacilityId"]}`); return; }
      setAwaitingConfirmation(false);
      const remaining = missingField(draft, accepted);
      const preface = proposal.acknowledgment ?? "Got it.";
      const changed = proposal.intent === "CORRECT" ? ` Updated ${[...accepted].map((field) => field === "originFacilityId" ? "pickup" : field === "destinationFacilityId" ? "delivery" : field).join(", ")}.` : "";
      if (remaining) add(value, `${preface}${changed} ${FIELD_QUESTION[remaining]}`);
      else { setAwaitingConfirmation(true); add(value, draftSummary({ ...draft, ...Object.fromEntries(proposal.fields.map((item) => [item.field, parseConversationField(item.field as ConversationField, item.value, options) ?? item.value])) }, options)); }
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
        {!request && !awaitingConfirmation && !interpretationBusy && nextField && !history.at(-1)?.text.includes(FIELD_QUESTION[nextField]) && <p className={styles.nextQuestion}>{FIELD_QUESTION[nextField]}</p>}
        {choices.length > 0 && <div className={styles.choiceList} aria-label="Confirm a location">{choices.map((choice) => <button key={choice.value} type="button" onClick={() => { onField(choice.field, choice.value); setChoices([]); add(null, `Confirmed ${choice.label}. ${FIELD_QUESTION[missingField(draft, new Set([choice.field])) ?? "categoryCode"]}`); }}>{choice.label}</button>)}</div>}
        {!request && !nextField && !awaitingConfirmation && !busy && <button type="button" className={styles.suggestion} onClick={() => { setAwaitingConfirmation(true); add(null, draftSummary(draft, options)); }}>Review draft before saving</button>}
        {request && !draftDirty && <div className={styles.suggestions}><button type="button" onClick={() => { add(null, `Reading ${request.referenceCode}…`); onRead(); }}>Show saved draft</button><button type="button" onClick={() => { add(null, "Checking the current saved version…"); onEvaluate(); }}>Check ROAD</button></div>}
        {draftDirty && <p className={styles.notice} role="status">Local edits are not saved. ROAD cannot be reevaluated for them yet.</p>}
        {busy && <p className={styles.loading} role="status">Working on your saved request…</p>}
        <div ref={endRef} />
      </div>
      <div className={styles.composerDock}>
        {(voice.message || voice.state === "unsupported") && <p className={styles.voiceStatus} role="status">{voice.message || "Speech recognition is unavailable here. You can type every step."}</p>}
        <form onSubmit={(event) => { event.preventDefault(); void send(); }} className={styles.composer}>
          <label className={styles.srOnly} htmlFor="v2-chat-text">Your message or editable voice transcript</label>
          <input ref={inputRef} id="v2-chat-text" value={text} onChange={(event) => setText(event.target.value)} placeholder="Message CargoMesh…" autoComplete="off" disabled={busy || interpretationBusy || voice.speaking} />
          {voice.state === "listening" || voice.state === "requesting_permission"
            ? <button type="button" className={styles.micActive} aria-label="Stop listening" title="Stop listening" onClick={voice.stop}>■</button>
            : <button type="button" className={styles.mic} aria-label={voice.state === "unsupported" ? "Speech recognition unavailable" : "Dictate message"} title={voice.state === "unsupported" ? "Speech recognition unavailable" : "Dictate message"} disabled={voice.state === "unsupported" || voice.state === "checking" || voice.state === "processing" || voice.speaking || busy || interpretationBusy} onClick={voice.start}><svg aria-hidden="true" viewBox="0 0 24 24" fill="none"><rect x="9" y="3" width="6" height="12" rx="3" stroke="currentColor" strokeWidth="1.8"/><path d="M6 11a6 6 0 0 0 12 0M12 17v4m-4 0h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg></button>}
          <button type="submit" className={styles.send} aria-label="Send message" title="Send message" disabled={!text.trim() || busy || interpretationBusy || voice.speaking}><svg aria-hidden="true" viewBox="0 0 24 24" fill="none"><path d="m4 12 15-8-3 16-4-6-8-2Zm8 2 7-10" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg></button>
        </form>
        <div className={styles.audioActions}><button type="button" onClick={() => voice.readResponse()} disabled={!voice.canRead || voice.speaking}>Read response</button><button type="button" onClick={voice.stopResponse} disabled={!voice.speaking}>Stop audio</button></div>
      </div>
    </section>}
  </aside>;
}

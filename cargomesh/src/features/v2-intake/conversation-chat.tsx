"use client";

import { useEffect, useRef, useState } from "react";
import type { FreightRequestV2Data, IntakeOptionsData, RoadServiceabilityEvaluationV2Data } from "./contracts";
import type { V2IntakePrototypeDraft } from "./prototype-model";
import { CONVERSATION_FIELDS, FIELD_QUESTION, choicesForField, parseConversationField, type ConversationField } from "./conversation-fields";
import { PreparatoryVoiceControls } from "@/features/v2-conversation-prep/voice-controls";
import { GuidedMessageV2Schema } from "@/features/v2-conversation-prep/contract";
import styles from "./conversation-chat.module.css";

type Message = { speaker: "assistant" | "user"; text: string };

const GREETING = "Hi! I can help prepare a ROAD freight draft. Choose a pickup facility to begin. All details stay provisional until you create a valid draft.";

export function ConversationChat({ draft, options, optionsSource = "api", request, evaluation, draftDirty = false, busy, onField, onCreate, onRead, onEvaluate, onStartOver }: {
  draft: V2IntakePrototypeDraft;
  options: IntakeOptionsData;
  optionsSource?: "api" | "fixture";
  request: FreightRequestV2Data | null;
  evaluation: RoadServiceabilityEvaluationV2Data | null;
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
  const [cursor, setCursor] = useState(0);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [inputMode, setInputMode] = useState<"TEXT" | "EDITED_VOICE_TRANSCRIPT">("TEXT");
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const field = CONVERSATION_FIELDS[cursor] ?? null;
  const choices = field ? choicesForField(field, options) : [];

  useEffect(() => { endRef.current?.scrollIntoView({ block: "nearest" }); }, [history]);
  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);

  function add(user: string, assistant: string) {
    setHistory((current) => [...current, { speaker: "user", text: user }, { speaker: "assistant", text: assistant }]);
  }

  function send() {
    const parsedMessage = GuidedMessageV2Schema.safeParse({ schemaVersion: "2.0", text, inputMode });
    if (!parsedMessage.success) return;
    const value = parsedMessage.data.text;
    setText("");
    setInputMode("TEXT");
    const lower = value.toLowerCase();
    if (/^(price|quote|cost|book|booking|reserve|reservation)\b/.test(lower)) {
      add(value, "Price and booking are unavailable until attributable V2 offer and booking services are live. ROAD eligibility is not a quote.");
      return;
    }
    if (lower === "help") {
      add(value, "Answer each question, or type 'correct <field number> <value>' to change a provisional detail. You can also edit the form directly. No data is saved to the server until draft creation.");
      return;
    }
    if (lower.startsWith("correct ")) {
      const match = /^correct\s+(\d+)\s+(.+)$/i.exec(value);
      const index = Number(match?.[1]) - 1;
      const target = CONVERSATION_FIELDS[index];
      const parsed = target && match ? parseConversationField(target, match[2], options) : null;
      if (!target || parsed === null) {
        add(value, "I could not apply that correction. Use 'correct <field number> <value>' and a valid option number where needed.");
        return;
      }
      onField(target, parsed);
      add(value, `Updated ${FIELD_QUESTION[target]} This is still provisional. ${field ? FIELD_QUESTION[field] : "Review the draft before creating it."}`);
      return;
    }
    if (!field) {
      add(value, request ? "Use Read draft or Evaluate ROAD below to retrieve the current authorized result." : "All guided fields are collected. Review the full form and create the draft when valid.");
      return;
    }
    const parsed = parseConversationField(field, value, options);
    if (parsed === null) {
      add(value, choices.length ? "That choice is ambiguous or unavailable. Select its number from the current list." : "Please enter a valid value for this field.");
      return;
    }
    onField(field, parsed);
    const next = CONVERSATION_FIELDS[cursor + 1];
    setCursor(cursor + 1);
    add(value, next ? `Saved provisionally. ${FIELD_QUESTION[next]}` : "The guided details are collected. Review the form for any remaining requirements, then create the ROAD draft.");
  }

  return <aside className={styles.shell} aria-label="CargoMesh ROAD assistant">
    <button type="button" className={styles.launcher} onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="v2-chat-panel">{open ? "Close chat" : "Chat about ROAD freight"}</button>
    {open && <section id="v2-chat-panel" className={styles.panel} aria-label="ROAD freight conversation">
      <header className={styles.header}><strong>CargoMesh ROAD assistant</strong><span>Draft & eligibility only · English</span></header>
      <div className={styles.history} role="log" aria-live="polite" aria-relevant="additions text">
        {history.map((message, index) => <p key={index} className={message.speaker === "user" ? styles.user : styles.assistant}><b>{message.speaker === "user" ? "You" : "CargoMesh"}:</b> {message.text}</p>)}
        {request && <p className={styles.assistant}>Draft {request.referenceCode} · version {request.draftVersion}. You can recover it with the authorized request page.</p>}
        {evaluation && <p className={styles.assistant}>ROAD result: {evaluation.overallStatus}. {evaluation.candidates.map((candidate) => `${candidate.carrier.commercialName}: ${candidate.status} (${candidate.reasons.join(", ") || "no reason code"}; capacity source ${candidate.checks.capacityWindow.provenance.dataSource}; checked ${candidate.checks.capacityWindow.provenance.observedAt ?? "unknown"})`).join("; ") || "no candidates"}. Evaluated {evaluation.evaluatedAt} for draft version {evaluation.evaluatedDraftVersion}.{draftDirty ? " This result predates your local corrections." : ""}</p>}
        <div ref={endRef} />
      </div>
      {field && <div className={styles.prompt}><strong>{cursor + 1}. {FIELD_QUESTION[field]}</strong>
        {choices.length > 0 && <ol>{choices.map((choice) => <li key={choice.value}>{choice.label}</li>)}</ol>}
      </div>}
      <form onSubmit={(event) => { event.preventDefault(); send(); }} className={styles.composer}>
        <label htmlFor="v2-chat-text">Your message {inputMode === "EDITED_VOICE_TRANSCRIPT" ? "(edited voice transcript)" : ""}</label>
        <div><input ref={inputRef} id="v2-chat-text" value={text} onChange={(event) => setText(event.target.value)} placeholder="Type a detail, help, price or booking" /><button type="submit" disabled={!text.trim()}>Send</button></div>
      </form>
      <button type="button" className={styles.link} onClick={() => setVoiceOpen(!voiceOpen)} aria-expanded={voiceOpen}>Optional voice controls</button>
      {voiceOpen && <PreparatoryVoiceControls onUseTranscript={(edited) => { setText(edited); setInputMode("EDITED_VOICE_TRANSCRIPT"); }} responseText={history.at(-1)?.speaker === "assistant" ? history.at(-1)?.text ?? "" : ""} />}
      <div className={styles.actions}>
        <button type="button" disabled={busy || Boolean(request)} onClick={onCreate}>Create valid draft</button>
        <button type="button" disabled={busy || !request} onClick={onRead}>Read draft</button>
        <button type="button" disabled={busy || !request || draftDirty} onClick={onEvaluate}>Evaluate ROAD</button>
        {onStartOver && <button type="button" disabled={busy} onClick={() => { onStartOver(); setCursor(0); setHistory([{ speaker: "assistant", text: GREETING }]); setText(""); }}>Start over</button>}
      </div>
      {draftDirty && <p className={styles.notice} role="status">Your corrections are local only. The current ROAD result belongs to the saved draft version. Updating that draft requires the HAC-35 contract; start a new request for changed details.</p>}
      <p className={styles.notice}>{optionsSource === "fixture" ? "Synthetic local selector preview; no server request is made here." : "Facilities come from the authenticated V2 options API. The form remains available for every field and for corrections."} Price and booking are disabled.</p>
    </section>}
  </aside>;
}

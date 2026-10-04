"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { FreightRequestV2Data, IntakeOptionsData, RoadServiceabilityEvaluationV2Data } from "./contracts";
import type { V2IntakePrototypeDraft } from "./prototype-model";
import { CONVERSATION_FIELDS, FIELD_QUESTION, choicesForField, parseConversationField, type ConversationField } from "./conversation-fields";
import { useConversationVoice } from "@/features/v2-conversation-prep/voice-controls";
import { GuidedMessageV2Schema } from "@/features/v2-conversation-prep/contract";
import { validatePrototypeReview } from "./prototype-model";
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
  const [announcement, setAnnouncement] = useState("");
  const [cursor, setCursor] = useState(0);
  const [inputMode, setInputMode] = useState<"TEXT" | "EDITED_VOICE_TRANSCRIPT">("TEXT");
  const [viewport, setViewport] = useState<{ height: number; keyboardInset: number } | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const field = CONVERSATION_FIELDS[cursor] ?? null;
  const choices = field ? choicesForField(field, options) : [];
  const canCreate = validatePrototypeReview(draft).valid;
  const syntheticCatalog = optionsSource === "fixture" || options.facilities.some((facility) => facility.label.includes("[SYNTHETIC]"));
  const environmentLabel = optionsSource === "fixture" ? "UI preview · synthetic options" : syntheticCatalog ? "V2 API · synthetic scenario" : "V2 API · authenticated";
  const voice = useConversationVoice({
    onTranscript: (recognized) => { setText(recognized); setInputMode("EDITED_VOICE_TRANSCRIPT"); inputRef.current?.focus(); },
    responseText: history.at(-1)?.speaker === "assistant" ? history.at(-1)?.text ?? "" : "",
  });

  useEffect(() => { endRef.current?.scrollIntoView({ block: "nearest" }); }, [history]);
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
      if (event.key === "Escape") {
        event.preventDefault();
        voice.stopResponse();
        if (voice.state === "listening" || voice.state === "requesting_permission") voice.stop();
        setOpen(false);
        launcherRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, voice]);
  useEffect(() => {
    if (request) {
      setHistory((current) => current.length === 1 && current[0]?.text === GREETING
        ? [{ speaker: "assistant", text: `Saved draft ${request.referenceCode} was reauthorized. Read it or evaluate ROAD, or start over to prepare another request.` }]
        : current);
      setAnnouncement(`Saved draft ${request.referenceCode}, version ${request.draftVersion}.`);
    }
  }, [request]);
  useEffect(() => {
    if (evaluation) setAnnouncement(`ROAD result ${evaluation.overallStatus}. ${evaluation.candidates.length} candidates. Reasons and provenance are in the conversation.`);
  }, [evaluation]);

  function add(user: string, assistant: string) {
    setHistory((current) => [...current, { speaker: "user", text: user }, { speaker: "assistant", text: assistant }]);
    setAnnouncement(assistant);
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
    if (request) {
      add(value, "A saved draft is already open. Use Read draft or Evaluate ROAD, or Start over to prepare a separate request. Corrections to this form remain local until a V2 update contract is available.");
      return;
    }
    if (!field) {
      add(value, "All guided fields are collected. Review the full form and create the draft when valid.");
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

  function closePanel() {
    if (voice.state === "listening" || voice.state === "requesting_permission") voice.stop();
    voice.stopResponse();
    setOpen(false);
    launcherRef.current?.focus();
  }

  return <aside className={styles.shell} aria-label="CargoMesh ROAD assistant" style={viewport ? { "--chat-visual-height": `${viewport.height}px`, "--chat-keyboard-inset": `${viewport.keyboardInset}px` } as CSSProperties : undefined}>
    <button ref={launcherRef} type="button" className={styles.launcher} onClick={() => open ? closePanel() : setOpen(true)} aria-label={open ? "Close CargoMesh assistant" : "Open CargoMesh assistant"} aria-expanded={open} aria-controls="v2-chat-panel">
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none"><path d="M4 5.5h16v11H9l-5 3v-14Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/><path d="M8 10h8M8 13h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
      <span>Ask CargoMesh</span>
    </button>
    {open && <section id="v2-chat-panel" className={styles.panel} aria-label="ROAD freight conversation">
      <header className={styles.header}>
        <span className={styles.headerIcon} aria-hidden="true">CM</span>
        <div className={styles.headerCopy}><strong>CargoMesh assistant</strong><span>ROAD drafts & eligibility</span></div>
        <button type="button" className={styles.close} aria-label="Close CargoMesh assistant" onClick={closePanel}>×</button>
      </header>
      <div className={styles.environment}><span className={styles.statusDot} aria-hidden="true" />{environmentLabel}<span className={styles.language}>English</span></div>
      <div className={styles.scrollArea}>
        <div className={styles.history} role="log" aria-live="off" aria-label="Conversation messages">
          {history.map((message, index) => <div key={index} className={message.speaker === "user" ? styles.userRow : styles.assistantRow}>
            <p className={message.speaker === "user" ? styles.user : styles.assistant}><span className={styles.speaker}>{message.speaker === "user" ? "You" : "CargoMesh"}</span>{message.text}</p>
          </div>)}
          {request && <div className={styles.assistantRow}><p className={styles.assistant}><span className={styles.speaker}>Saved draft</span>{request.referenceCode} · version {request.draftVersion}</p></div>}
          {evaluation && <div className={styles.assistantRow}><p className={styles.assistant}><span className={styles.speaker}>ROAD result · {evaluation.overallStatus}</span>{evaluation.candidates.map((candidate) => `${candidate.carrier.commercialName}: ${candidate.status} (${candidate.reasons.join(", ") || "no reason code"}; capacity source ${candidate.checks.capacityWindow.provenance.dataSource}; observed ${candidate.checks.capacityWindow.provenance.observedAt ?? "unknown"})`).join("; ") || "No candidates"}. Evaluated {evaluation.evaluatedAt} for draft version {evaluation.evaluatedDraftVersion}.{draftDirty ? " This result predates your local corrections." : ""}</p></div>}
          <div ref={endRef} />
        </div>
        <div className={styles.srOnly} role="status" aria-live="polite" aria-atomic="true">{announcement}</div>
        {request && <div className={styles.prompt}><strong>Saved draft recovered.</strong><p>Read or evaluate this authorized draft. Start over to prepare another request.</p></div>}
        {!request && field && <div className={styles.prompt}><strong>{cursor + 1}. {FIELD_QUESTION[field]}</strong>
          {choices.length > 0 && <ol>{choices.map((choice) => <li key={choice.value}>{choice.label}</li>)}</ol>}
        </div>}
        <div className={styles.actions}>
          <button type="button" disabled={busy || Boolean(request) || !canCreate} onClick={onCreate}>Create draft</button>
          <button type="button" disabled={busy || !request} onClick={onRead}>Read draft</button>
          <button type="button" disabled={busy || !request || draftDirty} onClick={onEvaluate}>Evaluate ROAD</button>
          {onStartOver && <button type="button" disabled={busy} onClick={() => { onStartOver(); setCursor(0); setHistory([{ speaker: "assistant", text: GREETING }]); setText(""); }}>Start over</button>}
        </div>
        {draftDirty && <p className={styles.notice} role="status">Corrections are local only. This ROAD result belongs to the saved version. Start a new request for changed details until the V2 update contract is available.</p>}
        <p className={styles.notice}>{optionsSource === "fixture" ? "Visual preview only. No server request is made." : "Authenticated V2 options and ROAD services."} Price and booking are unavailable.</p>
      </div>
      <div className={styles.composerDock}>
        <div className={styles.voiceStatus} role="status" aria-live="polite">
          {voice.message || (voice.state === "unsupported" ? "Speech recognition is unsupported here. You can type every step." : voice.state === "available" ? "Microphone available · text always works." : "Checking microphone support…")}
        </div>
        <form onSubmit={(event) => { event.preventDefault(); send(); }} className={styles.composer}>
          <label className={styles.srOnly} htmlFor="v2-chat-text">Your message {inputMode === "EDITED_VOICE_TRANSCRIPT" ? "(editable voice transcript)" : ""}</label>
          <input ref={inputRef} id="v2-chat-text" value={text} onChange={(event) => setText(event.target.value)} placeholder="Type your message…" autoComplete="off" />
          {voice.state === "listening" || voice.state === "requesting_permission"
            ? <button type="button" className={styles.micActive} aria-label="Stop listening" title="Stop listening" onClick={voice.stop}>■</button>
            : <button type="button" className={styles.mic} aria-label={voice.state === "unsupported" ? "Speech recognition unavailable" : "Dictate message"} title={voice.state === "unsupported" ? "Speech recognition unavailable" : "Dictate message"} disabled={voice.state === "unsupported" || voice.state === "checking" || voice.state === "processing"} onClick={voice.start}><svg aria-hidden="true" viewBox="0 0 24 24" fill="none"><rect x="9" y="3" width="6" height="12" rx="3" stroke="currentColor" strokeWidth="1.8"/><path d="M6 11a6 6 0 0 0 12 0M12 17v4m-4 0h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg></button>}
          <button type="submit" className={styles.send} aria-label="Send message" title="Send message" disabled={!text.trim()}><svg aria-hidden="true" viewBox="0 0 24 24" fill="none"><path d="m4 12 15-8-3 16-4-6-8-2Zm8 2 7-10" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg></button>
        </form>
        <div className={styles.audioActions}><button type="button" onClick={voice.readResponse} disabled={!voice.canRead}>Read latest response</button><button type="button" onClick={voice.stopResponse}>Stop audio</button></div>
      </div>
    </section>}
  </aside>;
}

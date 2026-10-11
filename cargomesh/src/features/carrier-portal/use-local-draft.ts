"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { CURRENT_ORIGIN, PREVIOUS_CURRENT_ORIGIN, LEGACY_DRAFT_KEY, LEGACY_ORIGIN, LOCAL_DRAFT_KEY, ORIGINAL_DRAFT_KEY,
  importLocalDraft, isLocalTransfer, readLocalDraft, LocalDraftEnvelopeSchema, type LocalDraftEnvelope } from "./local-draft-model";
import { resolveWorkspaceDraft } from "./local-request-demo";
export type SaveLocalDraft = (next: LocalDraftEnvelope | ((current: LocalDraftEnvelope) => LocalDraftEnvelope)) => boolean;

/** Import once; later edits on this origin always win over the previous workspace. */
export function useLocalDraft() {
  const [record, setRecord] = useState<LocalDraftEnvelope | null>(null);
  const [phase, setPhase] = useState<"reading" | "ready" | "empty" | "unavailable" | "invalid" | "storage-error">("reading");
  const [attempt, setAttempt] = useState(0);
  const [enabled, setEnabled] = useState(false);
  const current = useRef<LocalDraftEnvelope | null>(null);
  const save = useCallback<SaveLocalDraft>((update) => {
    try {
      if (typeof update === "function" && !current.current) return false;
      const next = LocalDraftEnvelopeSchema.parse(typeof update === "function" ? update(current.current!) : update);
      // Never remove/overwrite the immutable original or the legacy workspace key.
      if (localStorage.getItem(ORIGINAL_DRAFT_KEY) === null) localStorage.setItem(ORIGINAL_DRAFT_KEY, next.originalRaw);
      localStorage.setItem(LOCAL_DRAFT_KEY, JSON.stringify(next));
      current.current = next; setRecord(next); setPhase("ready"); return true;
    } catch { setPhase("storage-error"); return false; }
  }, []);
  useEffect(() => {
    // /v2-workspace is portable: every browser origin has its own saved state.
    // Only the historical 8080 origin may contact the old 8083 transfer bridge.
    setEnabled(true);
    let sameOrigin: string | null = null;
    try {
      const existing = readLocalDraft(localStorage.getItem(LOCAL_DRAFT_KEY));
      if (existing) { current.current = existing; setRecord(existing); setPhase("ready"); return; }
      sameOrigin = localStorage.getItem(LEGACY_DRAFT_KEY);
    } catch { setPhase("invalid"); return; }
    const restoreLegacy = () => {
      if (current.current) return;
      try {
        save(resolveWorkspaceDraft(null, sameOrigin, window.location.origin, new Date().toISOString()));
      } catch { setPhase("invalid"); }
    };
    if (window.location.origin !== CURRENT_ORIGIN) { restoreLegacy(); return; }
    setPhase("reading");
    const nonce = crypto.randomUUID();
    const frame = document.createElement("iframe");
    frame.hidden = true; frame.title = "Local CargoMesh draft transfer";
    frame.src = `${PREVIOUS_CURRENT_ORIGIN}/local-draft-transfer.html#${nonce}`;
    const receive = (event: MessageEvent) => {
      if (!isLocalTransfer(event, frame.contentWindow, nonce, PREVIOUS_CURRENT_ORIGIN) || current.current) return;
      clearTimeout(timeout);
      try {
        const previous = readLocalDraft(event.data.recordRaw ?? null);
        if (previous) save(previous);
        else if (event.data.raw) save(importLocalDraft(event.data.raw, LEGACY_ORIGIN, new Date().toISOString()));
        else restoreLegacy();
      }
      catch { setPhase("invalid"); }
    };
    window.addEventListener("message", receive);
    const timeout = window.setTimeout(restoreLegacy, 3000);
    document.body.append(frame);
    return () => { clearTimeout(timeout); window.removeEventListener("message", receive); frame.remove(); };
  }, [attempt, save]);
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key !== LOCAL_DRAFT_KEY || !event.newValue) return;
      try { const next = readLocalDraft(event.newValue); if (next) { current.current = next; setRecord(next); setPhase("ready"); } }
      catch { setPhase("invalid"); }
    };
    window.addEventListener("storage", sync); return () => window.removeEventListener("storage", sync);
  }, []);
  return { record, phase, enabled, save, retry: () => setAttempt(n => n + 1) };
}

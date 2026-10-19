"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { LEGACY_DRAFT_KEY, LOCAL_DRAFT_KEY, ORIGINAL_DRAFT_KEY,
  readLocalDraft, LocalDraftEnvelopeSchema, type LocalDraftEnvelope } from "./local-draft-model";
import { resolveWorkspaceDraft } from "./local-request-demo";
export type SaveLocalDraft = (next: LocalDraftEnvelope | ((current: LocalDraftEnvelope) => LocalDraftEnvelope)) => boolean;

/** Import once; later edits on this origin always win over the previous workspace. */
export function useLocalDraft(active = true) {
  const [record, setRecord] = useState<LocalDraftEnvelope | null>(null);
  const [phase, setPhase] = useState<"reading" | "ready" | "empty" | "unavailable" | "invalid" | "storage-error">("reading");
  const [attempt, setAttempt] = useState(0);
  const [enabled, setEnabled] = useState(false);
  const current = useRef<LocalDraftEnvelope | null>(null);
  const save = useCallback<SaveLocalDraft>((update) => {
    if (!active) return false;
    try {
      if (typeof update === "function" && !current.current) return false;
      const next = LocalDraftEnvelopeSchema.parse(typeof update === "function" ? update(current.current!) : update);
      // Never remove/overwrite the immutable original or the legacy workspace key.
      if (localStorage.getItem(ORIGINAL_DRAFT_KEY) === null) localStorage.setItem(ORIGINAL_DRAFT_KEY, next.originalRaw);
      localStorage.setItem(LOCAL_DRAFT_KEY, JSON.stringify(next));
      current.current = next; setRecord(next); setPhase("ready"); return true;
    } catch { setPhase("storage-error"); return false; }
  }, [active]);
  useEffect(() => {
    if (!active) { setEnabled(false); return; }
    // One app/origin. Restore same-origin saved data; never depend on a retired preview.
    setEnabled(true);
    try {
      const existing = readLocalDraft(localStorage.getItem(LOCAL_DRAFT_KEY));
      if (existing) { current.current = existing; setRecord(existing); setPhase("ready"); return; }
      const legacy = localStorage.getItem(LEGACY_DRAFT_KEY);
      save(resolveWorkspaceDraft(null, legacy, window.location.origin, new Date().toISOString()));
    } catch { setPhase("invalid"); }
  }, [active, attempt, save]);
  useEffect(() => {
    if (!active) return;
    const sync = (event: StorageEvent) => {
      if (event.key !== LOCAL_DRAFT_KEY || !event.newValue) return;
      try { const next = readLocalDraft(event.newValue); if (next) { current.current = next; setRecord(next); setPhase("ready"); } }
      catch { setPhase("invalid"); }
    };
    window.addEventListener("storage", sync); return () => window.removeEventListener("storage", sync);
  }, [active]);
  return { record: active ? record : null, phase, enabled: active && enabled, save, retry: () => setAttempt(n => n + 1) };
}

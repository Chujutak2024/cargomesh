"use client";
import {readJuanHash} from "./juan-navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { type LocalDraftEnvelope } from "./local-draft-model";
import { ACTIVE_LOCAL_REQUEST_KEY, DEMO_REQUESTS_KEY, USER_REQUEST_ID, initialDemoRequests, readDemoRequests,
  serializeDemoRequests, updateDemoRequest, type LocalRequestEntry } from "./local-request-demo";
import type { SaveLocalDraft } from "./use-local-draft";

export function useLocalRequestExamples(original: LocalDraftEnvelope | null, enabled: boolean, saveOriginal: SaveLocalDraft) {
  const [examples, setExamples] = useState<LocalRequestEntry[]>([]), [activeId, setActiveId] = useState(USER_REQUEST_ID);
  const [storageError, setStorageError] = useState(false);
  const current = useRef<LocalRequestEntry[]>([]);
  const writable = useRef(false);
  useEffect(() => {
    if (!enabled) return;
    try {
      const raw = localStorage.getItem(DEMO_REQUESTS_KEY), records = readDemoRequests(raw, window.location.origin);
      if (raw === null) localStorage.setItem(DEMO_REQUESTS_KEY, serializeDemoRequests(records));
      current.current = records; setExamples(records);
      writable.current = true; setStorageError(false);
      const applySelection = () => {
        const explicit = readJuanHash().match(/^#\/shipments\/details\/([^/?#]+)/)?.[1];
        const id = explicit ?? localStorage.getItem(ACTIVE_LOCAL_REQUEST_KEY);
        if (id === USER_REQUEST_ID || id && current.current.some(entry => entry.id === id)) {
          localStorage.setItem(ACTIVE_LOCAL_REQUEST_KEY, id); setActiveId(id);
        }
      };
      applySelection();
    } catch { const records = initialDemoRequests(window.location.origin); current.current = records; setExamples(records); writable.current = false; setStorageError(true); }
    const sync = (event: StorageEvent) => {
      if (event.key !== DEMO_REQUESTS_KEY || !event.newValue) return;
      try { const records = readDemoRequests(event.newValue); current.current = records; setExamples(records); writable.current = true; setStorageError(false); }
      catch { writable.current = false; setStorageError(true); }
    };
    const syncSelection = () => {
      if (!writable.current) return;
      const id = readJuanHash().match(/^#\/shipments\/details\/([^/?#]+)/)?.[1];
      if (id && (id === USER_REQUEST_ID || current.current.some(entry => entry.id === id))) {
        try { localStorage.setItem(ACTIVE_LOCAL_REQUEST_KEY, id); setActiveId(id); } catch { setStorageError(true); }
      }
    };
    window.addEventListener("storage", sync); window.addEventListener("hashchange", syncSelection);window.addEventListener("cm-carrier-route", syncSelection);window.addEventListener("popstate", syncSelection);
    return () => { window.removeEventListener("storage", sync); window.removeEventListener("hashchange", syncSelection);window.removeEventListener("cm-carrier-route", syncSelection);window.removeEventListener("popstate", syncSelection); };
  }, [enabled]);
  const select = useCallback((id: string) => {
    if (!writable.current || (id !== USER_REQUEST_ID && !current.current.some(entry => entry.id === id))) return false;
    try { localStorage.setItem(ACTIVE_LOCAL_REQUEST_KEY, id); setActiveId(id); setStorageError(false); return true; }
    catch { setStorageError(true); return false; }
  }, []);
  const save = useCallback<SaveLocalDraft>(update => {
    if (activeId === USER_REQUEST_ID) return saveOriginal(update);
    if (!writable.current) return false;
    try {
      const records = updateDemoRequest(current.current, activeId, update);
      localStorage.setItem(DEMO_REQUESTS_KEY, serializeDemoRequests(records));
      current.current = records; setExamples(records); setStorageError(false); return true;
    } catch { setStorageError(true); return false; }
  }, [activeId, saveOriginal]);
  const entries = [...(original ? [{ id: USER_REQUEST_ID, example: false, record: original }] : []), ...examples];
  const selected = entries.find(entry => entry.id === activeId) ?? entries[0];
  return { entries, selected, save, select, storageError };
}

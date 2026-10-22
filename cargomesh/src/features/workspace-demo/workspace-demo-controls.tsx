"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { ArrowRight, Building2, RefreshCw, ShieldCheck, Truck } from "lucide-react";
import { useLocale } from "@/features/i18n/locale-provider";
import { workspaceSwitchDecision, type WorkspaceSwitchDetail } from "./switch-guard";
import s from "./workspace-demo.module.css";
import { WorkspaceLoader, WorkspaceLoadingScreen } from "@/features/landing/workspace-loader";
import loaderStyles from "@/features/landing/workspace-loader.module.css";

type Workspace = "client" | "carrier";
type WorkspaceChange = { version: 1; id: string; sender: string; workspace: Workspace };
type PendingSwitch = { workspace: Workspace; phase: "switching" | "failed"; message?: string };
type ApprovalPrompt = { workspace: Workspace; kind: "confirmation" | "blocked"; message: string };
type PendingApproval = { resolve: (approved: boolean) => void; trigger: HTMLElement | null };
type DemoWorkspaceControls = {
  enabled: boolean;
  approveSwitch: (workspace: Workspace) => Promise<boolean>;
  beginSwitch: (workspace: Workspace, retry: () => void) => void;
  failSwitch: (workspace: Workspace, message: string) => void;
};
const DemoWorkspaceContext = createContext<DemoWorkspaceControls>({ enabled: false, approveSwitch: async () => false, beginSwitch: () => {}, failSwitch: () => {} });
const CHANGE_KEY = "cargomesh-demo-workspace-change-v1";
let currentTabId: string | undefined;
const tabId = () => currentTabId ??= window.crypto.randomUUID();
const destinationFor = (workspace: Workspace) => workspace === "client" ? "/clients" : "/carriers";

function parseChange(value: unknown): WorkspaceChange | null {
  if (!value || typeof value !== "object") return null;
  const event = value as Partial<WorkspaceChange>;
  return event.version === 1 && typeof event.id === "string" && event.id.length <= 64
    && typeof event.sender === "string" && event.sender.length <= 64
    && (event.workspace === "client" || event.workspace === "carrier") ? event as WorkspaceChange : null;
}

/** Only presentation metadata crosses tabs. Authentication stays in server cookies. */
function announceSwitch(workspace: Workspace) {
  const message: WorkspaceChange = { version: 1, id: window.crypto.randomUUID(), sender: tabId(), workspace };
  try {
    const channel = new BroadcastChannel(CHANGE_KEY);
    channel.postMessage(message);
    channel.close();
  } catch { /* The storage event remains available in browsers without BroadcastChannel. */ }
  try { window.localStorage.setItem(CHANGE_KEY, JSON.stringify(message)); }
  catch { /* Switching still works when optional cross-tab storage is unavailable. */ }
}

/** Prevents an old tab from operating with a newly selected shared cookie identity. */
export function DemoWorkspaceProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const { t } = useLocale();
  const [changed, setChanged] = useState<Workspace | null>(null);
  const [pendingSwitch, setPendingSwitch] = useState<PendingSwitch | null>(null);
  const [approvalPrompt, setApprovalPrompt] = useState<ApprovalPrompt | null>(null);
  const approval = useRef<PendingApproval | null>(null);
  const sessionChanged = useRef<Workspace | null>(null);
  const retrySwitch = useRef<(() => void) | null>(null);
  const received = useRef(new Set<string>());
  const dialog = useRef<HTMLElement>(null);
  const finishApproval = useCallback((approved: boolean) => {
    const active = approval.current;
    approval.current = null;
    setApprovalPrompt(null);
    active?.resolve(approved);
    if (!approved && !sessionChanged.current && active?.trigger) {
      requestAnimationFrame(() => {
        if (active.trigger?.isConnected && !active.trigger.closest("[inert]")) active.trigger.focus();
      });
    }
  }, []);
  const approveSwitch = useCallback(async (workspace: Workspace): Promise<boolean> => {
    if (!enabled || approval.current) return false;
    const detail: WorkspaceSwitchDetail = { workspace };
    const before = new CustomEvent("cargomesh:before-workspace-switch", { cancelable: true, detail });
    const decision = workspaceSwitchDecision(detail, !window.dispatchEvent(before));
    if (decision.kind === "ready") return true;
    return new Promise<boolean>(resolve => {
      approval.current = { resolve, trigger: document.activeElement instanceof HTMLElement ? document.activeElement : null };
      flushSync(() => setApprovalPrompt({ workspace, kind: decision.kind, message: decision.message || t("Inténtalo de nuevo en un momento.", "Try again in a moment.") }));
    });
  }, [enabled, t]);
  useEffect(() => () => {
    approval.current?.resolve(false);
    approval.current = null;
  }, []);
  useEffect(() => { if (!enabled && approval.current) finishApproval(false); }, [enabled, finishApproval]);
  const beginSwitch = useCallback((workspace: Workspace, retry: () => void) => {
    retrySwitch.current = retry;
    setPendingSwitch({ workspace, phase: "switching" });
  }, []);
  const failSwitch = useCallback((workspace: Workspace, message: string) => {
    setPendingSwitch({ workspace, phase: "failed", message });
  }, []);
  useEffect(() => {
    if (!enabled) return;
    const receive = (value: unknown) => {
      const message = parseChange(value);
      if (!message || message.sender === tabId() || received.current.has(message.id)) return;
      if (received.current.size >= 32) received.current.clear();
      received.current.add(message.id);
      sessionChanged.current = message.workspace;
      const active = approval.current;
      approval.current = null;
      active?.resolve(false);
      flushSync(() => { setApprovalPrompt(null); setChanged(message.workspace); });
    };
    let channel: BroadcastChannel | undefined;
    try {
      channel = new BroadcastChannel(CHANGE_KEY);
      channel.onmessage = event => receive(event.data);
    } catch { /* Listen to the storage event as the compatible fallback. */ }
    const storage = (event: StorageEvent) => {
      if (event.key !== CHANGE_KEY || !event.newValue || event.newValue.length > 1024) return;
      try { receive(JSON.parse(event.newValue)); } catch { /* Ignore unrelated or malformed metadata. */ }
    };
    window.addEventListener("storage", storage);
    return () => { channel?.close(); window.removeEventListener("storage", storage); };
  }, [enabled]);
  const blocked = enabled && (changed !== null || pendingSwitch !== null || approvalPrompt !== null);
  const loadingWorkspace = !changed && !approvalPrompt && pendingSwitch?.phase === "switching" ? pendingSwitch.workspace : null;
  useEffect(() => {
    if (!blocked) return;
    const first = dialog.current?.querySelector<HTMLButtonElement>("button:not([disabled])");
    (first ?? dialog.current)?.focus();
  }, [blocked, changed, pendingSwitch?.phase, approvalPrompt?.kind]);
  const workspaceName = (workspace: Workspace) => workspace === "client" ? t("Cliente", "Client") : "Carrier";
  return <DemoWorkspaceContext.Provider value={{ enabled, approveSwitch, beginSwitch, failSwitch }}>
    <div className={s.application} inert={blocked} aria-hidden={blocked || undefined}>{children}</div>
    {blocked ? <div className={loadingWorkspace ? loaderStyles.screen : s.sessionBackdrop}>
      <section ref={dialog} tabIndex={-1} className={loadingWorkspace ? loaderStyles.surface : s.sessionCard} role="dialog" aria-modal="true" aria-labelledby="demo-session-change-title"
        aria-describedby="demo-session-change-description" onKeyDown={event => {
          if (event.key === "Tab") {
            const controls = dialog.current?.querySelectorAll<HTMLButtonElement>("button:not([disabled])");
            const first = controls?.[0], last = controls?.[controls.length - 1];
            if (!first || !last) { event.preventDefault(); dialog.current?.focus(); }
            else if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last.focus(); }
            else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog.current)) { event.preventDefault(); first.focus(); }
          }
          if (event.key === "Escape") {
            event.preventDefault(); event.stopPropagation();
            if (approvalPrompt) finishApproval(false);
          }
        }}>
        {!loadingWorkspace && <span className={s.cardIcon}><ShieldCheck size={25} aria-hidden="true" /></span>}
        {approvalPrompt ? <>
          <h2 id="demo-session-change-title">{approvalPrompt.kind === "confirmation" ? t("¿Cambiar a", "Switch to") + " " + workspaceName(approvalPrompt.workspace) + "?" : t("Espera un momento", "Please wait")}</h2>
          <p id="demo-session-change-description">{approvalPrompt.message}</p>
          <div className={s.recoveryButtons}>
            {approvalPrompt.kind === "confirmation" ? <>
              <button type="button" className={s.secondaryButton} onClick={() => finishApproval(false)}>{t("Cancelar", "Cancel")}</button>
              <button type="button" className={s.primaryButton} onClick={() => finishApproval(true)}>{t("Continuar", "Continue")}<ArrowRight size={17} aria-hidden="true" /></button>
            </> : <button type="button" className={s.primaryButton} onClick={() => finishApproval(false)}>{t("Entendido", "Got it")}</button>}
          </div>
        </> : changed ? <>
          <h2 id="demo-session-change-title">{t("Sesión actualizada", "Session updated")}</h2>
          <p id="demo-session-change-description">{changed === "client" ? t("Continúa en Cliente.", "Continue in Client.") : t("Continúa en Carrier.", "Continue in Carrier.")}</p>
          <button type="button" className={s.primaryButton} onClick={async () => {
            const target = changed;
            if (await approveSwitch(target)) window.location.assign(destinationFor(target));
          }}>
            {changed === "client" ? <Building2 size={18} aria-hidden="true" /> : <Truck size={18} aria-hidden="true" />}
            {t("Continuar", "Continue")}
            <ArrowRight size={17} aria-hidden="true" />
          </button>
        </> : pendingSwitch?.phase === "switching" ? <>
          <div role="status" aria-live="polite"><WorkspaceLoader workspace={pendingSwitch.workspace} titleId="demo-session-change-title" descriptionId="demo-session-change-description"/></div>
        </> : <>
          <h2 id="demo-session-change-title">{t("No pudimos abrir el espacio", "Could not open workspace")}</h2>
          <p id="demo-session-change-description" role="alert">{pendingSwitch?.message}</p>
          <div className={s.recoveryButtons}>
            <button type="button" className={s.primaryButton} onClick={() => retrySwitch.current?.()}><RefreshCw size={17} aria-hidden="true" />{t("Reintentar", "Retry")}</button>
            <button type="button" className={s.secondaryButton} onClick={() => window.location.reload()}>{t("Recargar", "Reload")}</button>
          </div>
        </>}
      </section>
    </div> : null}
  </DemoWorkspaceContext.Provider>;
}

function useWorkspaceSwitch() {
  const { enabled, approveSwitch, beginSwitch, failSwitch } = useContext(DemoWorkspaceContext);
  const { t } = useLocale();
  const pending = useRef(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const switchTo = useCallback(async (workspace: Workspace, preserveCurrent = false, guardPassed = false): Promise<void> => {
    if (!enabled || pending.current) return;
    pending.current = true;
    if (!guardPassed) {
      if (!await approveSwitch(workspace)) { pending.current = false; return; }
    }
    // Commit the inert boundary before starting a request that can replace identity cookies.
    flushSync(() => beginSwitch(workspace, () => { void switchTo(workspace, preserveCurrent, true); }));
    const abort = new AbortController();
    controller.current = abort;
    const timeout = window.setTimeout(() => abort.abort(), 15000);
    let navigating = false;
    try {
      const response = await fetch("/api/auth/workspace-session", {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "same-origin", cache: "no-store", body: JSON.stringify({ workspace }), signal: abort.signal,
      });
      const value: unknown = await response.json();
      if (!response.ok || !value || typeof value !== "object" || !("destination" in value)
        || value.destination !== destinationFor(workspace)) throw new Error("Workspace unavailable");
      announceSwitch(workspace);
      navigating = true;
      const root = destinationFor(workspace);
      const within = window.location.pathname === root || window.location.pathname.startsWith(root + "/");
      window.location.assign(preserveCurrent && within
        ? window.location.pathname + window.location.search + window.location.hash : root);
    } catch {
      const message = abort.signal.aborted
        ? t("La conexión tardó demasiado.", "The connection timed out.")
        : t("Inténtalo de nuevo.", "Please try again.");
      failSwitch(workspace, message);
    } finally {
      window.clearTimeout(timeout);
      if (controller.current === abort) controller.current = null;
      if (!navigating) pending.current = false;
    }
  }, [enabled, approveSwitch, beginSwitch, failSwitch, t]);
  return { switchTo };
}

/** Direct entry; only unrelated accounts need explicit approval to use the demo. */
export function DemoWorkspaceEntry({ workspace, automatic = false }: { workspace: Workspace; automatic?: boolean }) {
  const { enabled } = useContext(DemoWorkspaceContext);
  const { t } = useLocale();
  const { switchTo } = useWorkspaceSwitch();
  const automaticStarted = useRef(false);
  const name = workspace === "client" ? t("Cliente", "Client") : "Carrier";
  const loginHref = "/login?connected=1&returnTo=" + encodeURIComponent(destinationFor(workspace));
  useEffect(() => {
    if (!enabled || !automatic) return;
    let active = true;
    // Avoid duplicate login requests during React's development effect replay.
    queueMicrotask(() => {
      if (!active || automaticStarted.current) return;
      automaticStarted.current = true;
      void switchTo(workspace, true);
    });
    return () => { active = false; };
  }, [enabled, automatic, workspace, switchTo]);
  if (enabled && automatic) return <main className={s.entryPage} data-workspace-entry={workspace}>
    <WorkspaceLoadingScreen workspace={workspace}/>
  </main>;
  return <main className={s.entryPage} data-workspace-entry={workspace}>
    <section className={s.entryCard} aria-labelledby="workspace-access-title">
      <h1 id="workspace-access-title">{enabled ? t("Abrir", "Open") + " " + name : t("Inicia sesión", "Sign in")}</h1>
      <p>{enabled ? t("Usarás la cuenta de prueba.", "Use the demo account.")
        : t("Necesitas una cuenta con acceso a", "You need an account with access to") + " " + name + "."}</p>
      <div className={s.recoveryButtons}>
        {enabled ? <button type="button" className={s.primaryButton} onClick={() => { void switchTo(workspace, true); }}>
          {t("Continuar", "Continue")}<ArrowRight size={17} aria-hidden="true" />
        </button> : <a className={s.primaryButton} href={loginHref}>{t("Iniciar sesión", "Sign in")}<ArrowRight size={17} aria-hidden="true" /></a>}
        {enabled ? <a className={s.textLink} href={loginHref}>{t("Usar mi cuenta", "Use my account")}</a>
          : <a className={s.textLink} href={destinationFor(workspace === "client" ? "carrier" : "client")}>{t("Volver", "Back")}</a>}
      </div>
    </section>
  </main>;
}

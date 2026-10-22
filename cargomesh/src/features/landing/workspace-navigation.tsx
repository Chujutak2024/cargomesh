"use client";

import { createContext, useCallback, useContext, useEffect, useReducer, useRef, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useLocale } from "@/features/i18n/locale-provider";
import { WorkspaceLoader, type EntryWorkspace } from "./workspace-loader";
import { workspaceNavigationReducer } from "./workspace-navigation-state";
import s from "./workspace-loader.module.css";

const NavigationContext = createContext<(workspace: EntryWorkspace) => void>(() => {});
export const useWorkspaceNavigation = () => useContext(NavigationContext);

/** Keeps the visual transition above streamed layouts. Never creates or changes a session. */
export function WorkspaceNavigationProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { t } = useLocale();
  const [pending, dispatch] = useReducer(workspaceNavigationReducer, null);
  const surface = useRef<HTMLElement>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const begin = useCallback((workspace: EntryWorkspace) => {
    trigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dispatch({ type: "begin", workspace, from: pathname });
  }, [pathname]);
  useEffect(() => { dispatch({ type: "route", pathname }); }, [pathname]);
  useEffect(() => {
    const reset = () => dispatch({ type: "reset" });
    window.addEventListener("pageshow", reset);
    return () => window.removeEventListener("pageshow", reset);
  }, []);
  const loading = pending?.phase === "loading";
  useEffect(() => {
    if (!loading) return;
    const timeout = window.setTimeout(() => dispatch({ type: "slow" }), 15000);
    return () => window.clearTimeout(timeout);
  }, [loading]);
  useEffect(() => {
    if (pending?.phase !== "leaving") return;
    const timeout = window.setTimeout(() => dispatch({ type: "reset" }), window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 220);
    return () => window.clearTimeout(timeout);
  }, [pending?.phase]);
  const blocked = pending !== null;
  useEffect(() => {
    if (!blocked) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    surface.current?.focus();
    return () => { document.body.style.overflow = previous; };
  }, [blocked]);
  const dismiss = () => {
    dispatch({ type: "reset" });
    requestAnimationFrame(() => { if (trigger.current?.isConnected) trigger.current.focus(); });
  };
  return <NavigationContext.Provider value={begin}>
    <div style={{ display: "contents" }} inert={blocked} aria-hidden={blocked || undefined}>{children}</div>
    {pending && <div className={s.screen} data-phase={pending.phase}>
      <section ref={surface} tabIndex={-1} className={s.surface} role="dialog" aria-modal="true" aria-labelledby="workspace-opening-title" aria-describedby="workspace-opening-description"
        onKeyDown={event => {
          if (event.key !== "Tab") return;
          const buttons = surface.current?.querySelectorAll<HTMLButtonElement>("button");
          const first = buttons?.[0], last = buttons?.[buttons.length - 1];
          if (!first || !last) { event.preventDefault(); }
          else if (event.shiftKey && (document.activeElement === first || document.activeElement === surface.current)) { event.preventDefault(); last.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        }}>
        <div role="status" aria-live="polite"><WorkspaceLoader workspace={pending.workspace} titleId="workspace-opening-title" descriptionId="workspace-opening-description"/></div>
        {pending.slow && <div className={s.recovery} role="status">
          <p>{t("Está tardando más de lo habitual.", "This is taking longer than usual.")}</p>
          <div className={s.actions}>
            <button type="button" onClick={() => window.location.assign(pending.workspace === "client" ? "/clients" : "/carriers")}>{t("Reintentar", "Retry")}</button>
            <button type="button" onClick={dismiss}>{t("Volver", "Go back")}</button>
          </div>
        </div>}
      </section>
    </div>}
  </NavigationContext.Provider>;
}

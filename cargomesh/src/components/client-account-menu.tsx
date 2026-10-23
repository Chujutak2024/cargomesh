"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { ChevronUp, LogOut, UserRound } from "lucide-react";
import { WorkspaceLink as Link } from "@/features/workspace-mode/workspace-link";
import { useLocale } from "@/features/i18n/locale-provider";
import styles from "./client-account-menu.module.css";

export function ClientAccountMenu({ name, organization, role, initials, collapsed, preview, demo, routeKey, onNavigate }: {
  name: string; organization: string; role: string; initials: string; collapsed: boolean;
  preview: boolean; demo: boolean; routeKey: string; onNavigate: () => void;
}) {
  const { t } = useLocale(), [open, setOpen] = useState(false), id = useId();
  const root = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null), menu = useRef<HTMLDivElement>(null);
  useEffect(() => { setOpen(false); }, [routeKey, collapsed]);
  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  function keyboard(event: KeyboardEvent<HTMLDivElement>) {
    if (!open) return;
    if (event.key === "Escape") {
      event.preventDefault(); event.stopPropagation(); setOpen(false); trigger.current?.focus(); return;
    }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    const items = Array.from(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    if (!items.length) return;
    event.preventDefault();
    const current = items.indexOf(document.activeElement as HTMLElement);
    const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1
      : (current + (event.key === "ArrowUp" ? -1 : 1) + items.length) % items.length;
    items[next].focus();
  }
  const leave = () => { setOpen(false); onNavigate(); };
  const signOutLabel = preview ? t("Salir de prueba", "Exit test session") : demo ? t("Salir de demo", "Exit demo") : t("Cerrar sesión", "Sign out");
  const displayOrg = organization.replace(/\s*·\s*Demo$/i, "").trim() || organization;
  const displayRole = role ? role.charAt(0).toUpperCase() + role.slice(1).toLowerCase() : "";

  return <div ref={root} className={styles.account} data-collapsed={collapsed} onKeyDownCapture={keyboard}
    onBlur={event => { if (event.relatedTarget instanceof Node && !event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <button ref={trigger} type="button" className={styles.trigger} aria-label={`${displayOrg} - ${displayRole}`}
      aria-expanded={open} aria-controls={`${id}-menu`} aria-haspopup="menu" title={`${displayOrg} · ${displayRole}`}
      onClick={() => setOpen(value => !value)} onKeyDown={event => { if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); setOpen(true); } }}>
      <span className={styles.avatar} aria-hidden="true">{initials}</span>
      <div className={styles.userMeta}>
        <strong className={styles.companyName}>{displayOrg}</strong>
        <span className={styles.userRole}>{displayRole}</span>
      </div>
      <ChevronUp className={styles.chevron} size={16} aria-hidden="true"/>
    </button>
    {open && <div className={styles.panel}>
      <div ref={menu} id={`${id}-menu`} role="menu" aria-label={t("Opciones de cuenta", "Account options")}>
        <Link href="/organization" role="menuitem" className={styles.item} onClick={leave}><UserRound size={16} aria-hidden="true"/>{t("Perfil de empresa", "Company profile")}</Link>
        {demo && !preview ? <Link href="/" role="menuitem" className={styles.item} onClick={leave}><LogOut size={16} aria-hidden="true"/>{signOutLabel}</Link>
          : <form action={preview ? "/api/local/client-session" : "/api/auth/logout"} method="post">
            {preview && <input type="hidden" name="action" value="exit"/>}
            <button type="submit" role="menuitem" className={styles.item}><LogOut size={16} aria-hidden="true"/>{signOutLabel}</button>
          </form>}
      </div>
    </div>}
  </div>;
}

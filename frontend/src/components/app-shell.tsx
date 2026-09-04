"use client";

import {
  Building2,
  CircleHelp,
  ClipboardList,
  Headphones,
  LayoutDashboard,
  MapPinned,
  Menu,
  PackagePlus,
  Route,
  Search,
  ShieldAlert,
  Waypoints,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { LanguageSwitcher } from "./language-switcher";
import { JudgeDrawer } from "./judge-drawer";
import { useLocale } from "@/features/i18n/locale-provider";
import styles from "./app-shell.module.css";

type ShellIdentity = { organizationName: string; displayName: string; role: string } | null;

export function AppShell({ children, identity }: { children: ReactNode; identity: ShellIdentity }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { t } = useLocale();
  const navigation = [
    { label: t("Principal", "Main"), items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/freight-request/new?requestCode=FR-1042", label: t("Nueva carga", "New shipment"), icon: PackagePlus },
      { href: "/requests", label: t("Mis cargas", "My shipments"), icon: ClipboardList },
      { href: "/dispatch", label: t("Despachos", "Dispatch"), icon: Route },
      { href: "/tracking", label: t("Seguimiento", "Tracking"), icon: MapPinned },
    ] },
    { label: t("Gestión", "Management"), items: [
      { href: "/organization", label: t("Organización", "Organization"), icon: Building2 },
      { href: "/supervisor/exceptions", label: t("Excepciones", "Exceptions"), icon: ShieldAlert },
    ] },
    { label: t("Otros", "Other"), items: [
      { href: "/support", label: t("Soporte", "Support"), icon: Headphones },
      { href: "/help", label: t("Centro de ayuda", "Help center"), icon: CircleHelp },
    ] },
  ];
  const contexts = [
    ["/freight-request/new", t("Nueva carga", "New shipment"), t("Intake guiado de FreightRequest", "Guided FreightRequest intake")],
    ["/booking/", "Booking", t("Selección humana y confirmación", "Human selection and confirmation")],
    ["/dispatch", t("Despachos", "Dispatch"), t("Evaluación dinámica de opciones", "Dynamic option evaluation")],
    ["/requests", t("Mis cargas", "My shipments"), t("Solicitudes de la organización", "Organization requests")],
    ["/tracking", t("Seguimiento", "Tracking"), t("Eventos reportados por carriers", "Carrier-reported events")],
    ["/organization", t("Organización", "Organization"), t("Perfil, miembros y políticas", "Profile, members, and policies")],
    ["/supervisor/exceptions", t("Excepciones", "Exceptions"), t("Revisión operativa", "Operational review")],
    ["/support", t("Soporte", "Support"), t("Canales de asistencia", "Support channels")],
    ["/help", t("Centro de ayuda", "Help center"), t("Guías del flujo operativo", "Operational flow guides")],
  ] as const;
  const match = contexts.find(([prefix]) => pathname.startsWith(prefix));
  const pageContext = match
    ? { title: match[1], subtitle: match[2] }
    : { title: "Dashboard", subtitle: t("Vista general de operaciones", "Operations overview") };
  const initials = identity?.displayName.split(/\s+/).slice(0, 2).map((word) => word[0]).join("").toUpperCase() || "CM";

  if (pathname === "/login") {
    return <>{children}</>;
  }

  return (
    <div className={styles.shell}>
      <a className={styles.skipLink} href="#main-content">{t("Saltar al contenido", "Skip to content")}</a>

      <aside className={`${styles.sidebar} ${open ? styles.sidebarOpen : ""}`}>
        <div className={styles.brandRow}>
          <Link className={styles.brand} href="/dashboard" onClick={() => setOpen(false)}>
            <span className={styles.brandMark} aria-hidden="true"><Waypoints size={21} /></span>
            <span><strong>CargoMesh</strong><small>Control Tower</small></span>
          </Link>
          <button className={styles.closeButton} type="button" aria-label={t("Cerrar navegación", "Close navigation")} onClick={() => setOpen(false)}>
            <X size={20} />
          </button>
        </div>

        <div className={styles.workspace}>
          <span className={styles.workspaceIcon} aria-hidden="true"><Building2 size={17} /></span>
          <span><small>{t("Organización activa", "Active organization")}</small><strong>{identity?.organizationName ?? "CargoMesh"}</strong></span>
        </div>

        <nav className={styles.navigation} aria-label={t("Navegación principal", "Main navigation")}>
          {navigation.map((section) => (
            <div className={styles.navSection} key={section.label}>
              <p>{section.label}</p>
              {section.items.map(({ href, label, icon: Icon }) => {
                const active = pathname === href || pathname.startsWith(`${href}/`);
                return (
                  <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`${styles.navLink} ${active ? styles.navLinkActive : ""}`} onClick={() => setOpen(false)}>
                    <Icon size={17} strokeWidth={1.8} aria-hidden="true" />
                    <span>{label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className={styles.sidebarFoot}>
          <span className={styles.environmentDot} aria-hidden="true" />
          <span><strong>{t("Sistema operativo", "System operational")}</strong><small>{t("Datos protegidos por organización", "Organization-scoped data")}</small></span>
        </div>
      </aside>

      {open ? <div className={styles.backdrop} aria-hidden="true" onClick={() => setOpen(false)} /> : null}

      <div className={styles.contentColumn}>
        <header className={styles.topbar}>
          <button className={styles.menuButton} type="button" aria-label={t("Abrir navegación", "Open navigation")} aria-expanded={open} onClick={() => setOpen(true)}>
            <Menu size={20} />
          </button>
          <div className={styles.context}>
            <strong>{pageContext.title}</strong>
            <span>{pageContext.subtitle}</span>
          </div>
          <div className={styles.topbarActions}>
            <LanguageSwitcher compact />
            <JudgeDrawer />
            <form className={styles.search} action="/requests">
              <Search size={17} aria-hidden="true" />
              <span className={styles.srOnly}>{t("Buscar en operaciones", "Search operations")}</span>
              <input name="q" type="search" placeholder={t("Buscar operación", "Search operation")} />
              <kbd>↵</kbd>
            </form>
            <div className={styles.avatar} aria-hidden="true">{initials}</div>
            <div className={styles.userCopy}>
              <strong>{identity?.displayName ?? "CargoMesh"}</strong>
              <span>{identity?.role ?? t("Invitado", "Guest")}</span>
            </div>
          </div>
        </header>
        <main id="main-content" className={styles.main}>{children}</main>
      </div>
    </div>
  );
}

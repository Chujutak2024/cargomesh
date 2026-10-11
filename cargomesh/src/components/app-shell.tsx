"use client";

import {
  Bot,
  Building2,
  CircleHelp,
  ClipboardList,
  History,
  Headphones,
  LayoutDashboard,
  LogOut,
  MapPinned,
  Menu,
  PackagePlus,
  Route,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { LanguageSwitcher } from "./language-switcher";
import { useLocale } from "@/features/i18n/locale-provider";
import { ContentMotion } from "@/features/product-motion/content-motion";
import styles from "./app-shell.module.css";

type ShellIdentity = { organizationName: string; displayName: string; role: string } | null;

export function AppShell({ children, identity }: { children: ReactNode; identity: ShellIdentity }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { t } = useLocale();
  const navigation = [
    { label: t("Principal", "Main"), items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/freight-request/new", label: t("Nueva carga", "New shipment"), icon: PackagePlus },
      { href: "/requests", label: t("Mis cargas", "My shipments"), icon: ClipboardList },
      { href: "/facilities", label: t("Sedes y perfiles", "Facilities & profiles"), icon: Building2 },
      { href: "/bookings", label: t("Reservas", "Bookings"), icon: Route },
      { href: "/tracking", label: t("Seguimiento", "Tracking"), icon: MapPinned },
      { href: "/history", label: t("Historial", "History"), icon: History },
    ] },
    { label: t("Gestión", "Management"), items: [
      { href: "/organization", label: t("Organización", "Organization"), icon: Building2 },
    ] },
    { label: t("Otros", "Other"), items: [
      { href: "/support", label: t("Soporte", "Support"), icon: Headphones },
      { href: "/help", label: t("Centro de ayuda", "Help center"), icon: CircleHelp },
    ] },
  ];
  const contexts = [
    ["/freight-request/new", t("Nueva carga V2", "New shipment V2"), t("Intake cliente · DRAFT y elegibilidad ROAD", "Client intake · DRAFT and ROAD serviceability")],
    ["/bookings", t("Reservas V2", "V2 bookings"), t("Compromisos persistidos", "Persisted commitments")],
    ["/requests", t("Mis cargas", "My shipments"), t("Solicitudes de la organización", "Organization requests")],
    ["/tracking", t("Seguimiento", "Tracking"), t("Eventos reportados por carriers", "Carrier-reported events")],
    ["/facilities", t("Sedes y perfiles", "Facilities & profiles"), t("Datos canónicos de tu organización", "Canonical organization data")],
    ["/history", t("Historial", "History"), t("Solicitudes y eventos físicos", "Requests and physical events")],
    ["/organization", t("Organización", "Organization"), t("Perfil, miembros y políticas", "Profile, members, and policies")],
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

      <aside className={`${styles.sidebar} ${open ? styles.sidebarOpen : ""}`} aria-label={t("Espacio de trabajo del cliente", "Shipper workspace")}>
        <div className={styles.brandRow}>
          <Link className={styles.brand} href="/dashboard" onClick={() => setOpen(false)}>
            <Image className={styles.brandMark} src="/v2-workspace/cargomesh-icon.png" width={42} height={42} sizes="42px" alt="" aria-hidden="true" priority />
            <span className={styles.brandCopy}><strong>CargoMesh</strong><small>{t("PORTAL CLIENTE", "SHIPPER PORTAL")}</small></span>
          </Link>
          <button className={styles.closeButton} type="button" aria-label={t("Cerrar navegación", "Close navigation")} onClick={() => setOpen(false)}>
            <X size={20} />
          </button>
        </div>

        <div className={styles.workspace}>
          <span className={styles.workspaceIcon} aria-hidden="true"><Building2 size={17} /></span>
          <span className={styles.workspaceCopy}><small>{t("Organización activa", "Active organization")}</small><strong>{identity?.organizationName ?? "CargoMesh"}</strong></span>
          <ShieldCheck className={styles.workspaceVerified} size={16} aria-label={t("Sesión protegida", "Protected session")} />
        </div>

        <nav className={styles.navigation} aria-label={t("Navegación principal", "Main navigation")}>
          {navigation.map((section) => (
            <div className={styles.navSection} key={section.label}>
              <p>{section.label}</p>
              {section.items.map(({ href, label, icon: Icon }) => {
                const hrefPath = href.split("?")[0];
                const active = pathname === hrefPath || pathname.startsWith(`${hrefPath}/`);
                return (
                  <Link key={href} href={href} title={label} aria-label={label} aria-current={active ? "page" : undefined} className={`${styles.navLink} ${active ? styles.navLinkActive : ""}`} onClick={() => setOpen(false)}>
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
          <span className={styles.sidebarFootCopy}><strong>{t("CargoMesh V2", "CargoMesh V2")}</strong><small>{t("Datos protegidos por organización", "Organization-scoped data")}</small></span>
        </div>
      </aside>

      {open ? <div className={styles.backdrop} aria-hidden="true" onClick={() => setOpen(false)} /> : null}

      <div className={styles.contentColumn}>
        <header className={styles.topbar}>
          <button className={styles.menuButton} type="button" aria-label={t("Abrir navegación", "Open navigation")} aria-expanded={open} onClick={() => setOpen(true)}>
            <Menu size={20} />
          </button>
          <div className={styles.context}>
            <span className={styles.contextEyebrow}>{t("Espacio de trabajo shipper", "Shipper workspace")}</span>
            <strong>{pageContext.title}</strong>
            <span className={styles.contextSubtitle}>{pageContext.subtitle}</span>
          </div>
          <div className={styles.topbarActions}>
            <form className={styles.search} action="/requests">
              <Search size={17} aria-hidden="true" />
              <span className={styles.srOnly}>{t("Buscar en operaciones", "Search operations")}</span>
              <input name="q" type="search" placeholder={t("Buscar operación", "Search operation")} />
              <kbd>↵</kbd>
            </form>
            <Link className={styles.assistantButton} href="/freight-request/new?assistant=open" aria-label={t("Abrir asistente CargoMesh", "Open CargoMesh assistant")}>
              <Bot size={17} aria-hidden="true" />
              <span>{t("Asistente", "Assistant")}</span>
            </Link>
            <LanguageSwitcher compact />
            <div className={styles.avatar} aria-hidden="true">{initials}</div>
            <div className={styles.userCopy}>
              <strong>{identity?.displayName ?? "CargoMesh"}</strong>
              <span>{identity?.role ?? t("Invitado", "Guest")}</span>
            </div>
            <form className={styles.signOut} action="/api/auth/logout" method="post"><button type="submit" aria-label={t("Cerrar sesión", "Sign out")}><LogOut size={16} aria-hidden="true"/><span>{t("Salir", "Sign out")}</span></button></form>
          </div>
        </header>
        <main id="main-content" className={styles.main}>
          <ContentMotion identity={pathname} className={styles.motionRegion}>{children}</ContentMotion>
        </main>
      </div>
    </div>
  );
}

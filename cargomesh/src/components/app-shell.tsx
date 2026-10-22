"use client";

import {
  Building2,
  CircleHelp,
  ClipboardList,
  History,
  Headphones,
  LayoutDashboard,
  LogOut,
  MapPinned,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  PackagePlus,
  Route,
  Search,
  UserRound,
  X,
} from "lucide-react";
import Image from "next/image";
import {WorkspaceLink as Link} from "@/features/workspace-mode/workspace-link";
import {isShipperDemoPath, SHIPPER_DEMO_PREFIX,workspaceHref} from "@/features/workspace-mode/paths";
import {clientSectionPath} from '@/shared/navigation/workspaces';
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { LanguageSwitcher } from "./language-switcher";
import { useLocale } from "@/features/i18n/locale-provider";
import { ContentMotion } from "@/features/product-motion/content-motion";
import styles from "./app-shell.module.css";
import navStyles from "@/features/carrier-navigation/carrier-navigation.module.css";
import { lockDocumentScroll } from "@/shared/browser/scroll-lock";
import { IntakeSessionProvider } from "@/features/v2-intake/intake-session";
import { ClientAssistant } from "@/features/v2-intake/client-assistant";

type ShellIdentity = { organizationName: string; displayName: string; role: string } | null;

export function AppShell({ children, identity, preview=false }: { children: ReactNode; identity: ShellIdentity; preview?:boolean }) {
  const currentPath=usePathname(),legacyDemo=isShipperDemoPath(currentPath),demo=legacyDemo||preview;
  const pathname=legacyDemo?currentPath.slice(SHIPPER_DEMO_PREFIX.length):clientSectionPath(currentPath);
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [assistantDocked, setAssistantDocked] = useState(false);
  const sidebarId = useId();
  const sidebarTitleId = useId();
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const wasOpenRef = useRef(false);
  const { t } = useLocale();

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const onResize = () => {
      setMobile(media.matches);
      if (!media.matches) setOpen(false);
    };
    onResize();
    media.addEventListener("change", onResize);
    return () => media.removeEventListener("change", onResize);
  }, []);

  useEffect(() => { setOpen(false); }, [currentPath]);

  useEffect(() => {
    if (!open || !mobile) {
      if (wasOpenRef.current) triggerRef.current?.focus();
      wasOpenRef.current = false;
      return;
    }
    wasOpenRef.current = true;
    closeButtonRef.current?.focus();
    const releaseScroll = lockDocumentScroll(document);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
      } else if (event.key === "Tab") {
        const controls = sidebarRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])');
        if (!controls?.length) return;
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      releaseScroll();
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, mobile]);

  const closeNavigation = () => {
    setOpen(false);
  };
  const toggleNavigation = () => {
    if (mobile) {
      triggerRef.current = document.activeElement as HTMLElement;
      setOpen((value) => !value);
    } else setCollapsed((value) => !value);
  };
  const navigation = [
    { id: "overview", label: t("Resumen", "Overview"), items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    ] },
    { id: "operations", label: t("Operaciones de transporte", "Transport operations"), items: [
      { href: "/freight-request/new", label: t("Nueva carga", "New shipment"), icon: PackagePlus },
      { href: "/requests", label: t("Mis cargas", "My shipments"), icon: ClipboardList },
      { href: "/bookings", label: t("Reservas", "Bookings"), icon: Route },
      { href: "/tracking", label: t("Seguimiento", "Tracking"), icon: MapPinned },
      { href: "/history", label: t("Historial", "History"), icon: History },
    ] },
    { id: "management", label: t("Administración", "Administration"), items: [
      { href: "/facilities", label: t("Sedes y perfiles", "Facilities & profiles"), icon: Building2 },
      { href: "/organization", label: t("Organización", "Organization"), icon: Building2 },
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
    : { title: "Dashboard", subtitle: "" };
  const initials = identity?.displayName.split(/\s+/).slice(0, 2).map((word) => word[0]).join("").toUpperCase() || "CM";

  if (pathname === "/login") {
    return <>{children}</>;
  }

  return (
    <IntakeSessionProvider><div className={`${navStyles.frame} ${styles.shell}`} data-cm-workspace="client" data-collapsed={collapsed} data-open={open} data-assistant-docked={assistantDocked} data-cm-client-preview={preview?"true":undefined}>
      <a className={navStyles.skip} href="#main-content">{t("Saltar al contenido", "Skip to content")}</a>

      <aside ref={sidebarRef} id={sidebarId} className={navStyles.sidebar} role={mobile && open ? "dialog" : undefined} aria-modal={mobile && open ? true : undefined} aria-labelledby={sidebarTitleId} inert={mobile && !open}>
        <div className={navStyles.brandRow}>
          <Link className={navStyles.brand} href="/dashboard" aria-label="CargoMesh" onClick={closeNavigation}>
            <Image src="/v2-workspace/cargomesh-icon.png" width={30} height={30} sizes="30px" alt="" priority />
            <span>CargoMesh</span>
          </Link>
          <span id={sidebarTitleId} className={navStyles.srOnly}>{t("Navegación cliente", "Shipper navigation")}</span>
          <button ref={closeButtonRef} className={navStyles.closeButton} type="button" aria-label={t("Cerrar menú cliente", "Close shipper menu")} onClick={closeNavigation}>
            <X size={19} aria-hidden="true" />
          </button>
        </div>

        <nav className={navStyles.nav} aria-label={t("Menú cliente", "Shipper menu")}>
          {navigation.map((section) => (
            <section className={navStyles.group} key={section.id} aria-labelledby={`${sidebarId}-${section.id}`}>
              <h2 id={`${sidebarId}-${section.id}`} className={navStyles.groupLabel}>{section.label}</h2>
              {section.items.map(({ href, label, icon: Icon }) => {
                const hrefPath = href.split("?")[0];
                const active = pathname === hrefPath || pathname.startsWith(`${hrefPath}/`);
                return (
                  <Link key={href} href={href} title={collapsed && !mobile ? label : undefined} aria-label={label} aria-current={active ? "page" : undefined} className={navStyles.item} onClick={closeNavigation}>
                    <Icon size={18} strokeWidth={1.5} aria-hidden="true" />
                    <span className={navStyles.itemLabel}>{label}</span>
                  </Link>
                );
              })}
            </section>
          ))}
        </nav>

        <div className={navStyles.identity} title={identity?.organizationName ?? "CargoMesh"}>
          <span className={navStyles.avatar} aria-hidden="true"><UserRound size={19} /></span>
          <div><strong>{t("Espacio cliente", "Shipper workspace")}</strong><span>{demo ? t("Demo visual · solo lectura", "Visual demo · read only") : identity?.organizationName ?? "CargoMesh"}</span></div>
        </div>
      </aside>

      {mobile && open ? <button className={navStyles.backdrop} type="button" aria-label={t("Cerrar menú cliente", "Close shipper menu")} onClick={closeNavigation} tabIndex={-1} /> : null}

      <div className={`${navStyles.content} ${styles.contentColumn}`} inert={mobile && open}>
        <header className={styles.topbar}>
          <button ref={menuButtonRef} className={navStyles.menuButton} type="button" aria-label={mobile ? t("Abrir menú cliente", "Open shipper menu") : collapsed ? t("Expandir menú cliente", "Expand shipper menu") : t("Contraer menú cliente", "Collapse shipper menu")} aria-controls={sidebarId} aria-expanded={mobile ? open : !collapsed} onClick={toggleNavigation}>
            {mobile ? <Menu size={18} aria-hidden="true" /> : collapsed ? <PanelLeftOpen size={18} aria-hidden="true" /> : <PanelLeftClose size={18} aria-hidden="true" />}
          </button>
          <div className={styles.context}>
            <strong>{pageContext.title}</strong>
            {pageContext.subtitle ? <span className={styles.contextSubtitle}>{pageContext.subtitle}</span> : null}
          </div>
          <div className={styles.topbarActions}>
            <form className={styles.search} action={workspaceHref("/requests",currentPath)}>
              <Search size={17} aria-hidden="true" />
              <span className={styles.srOnly}>{t("Buscar en operaciones", "Search operations")}</span>
              <input name="q" type="search" placeholder={t("Buscar operación", "Search operation")} />
              <kbd>↵</kbd>
            </form>
            <LanguageSwitcher compact />
            <div className={styles.avatar} aria-hidden="true">{initials}</div>
            <div className={styles.userCopy}>
              <strong>{identity?.displayName ?? "CargoMesh"}</strong>
              <span>{identity?.role ?? t("Invitado", "Guest")}</span>
            </div>
            {preview ? (
              <form className={styles.signOut} action="/api/local/client-session" method="post">
                <input type="hidden" name="action" value="exit" />
                <button type="submit" aria-label={t("Salir de la sesión de prueba", "Exit test session")}><LogOut size={16} aria-hidden="true" /><span>{t("Salir de prueba", "Exit test session")}</span></button>
              </form>
            ) : demo ? (
              <Link className={`${styles.signOut} ${styles.signOutLink}`} href="/" aria-label={t("Salir de demo", "Exit demo")}><LogOut size={16} aria-hidden="true" /><span>{t("Salir de demo", "Exit demo")}</span></Link>
            ) : (
              <form className={styles.signOut} action="/api/auth/logout" method="post"><button type="submit" aria-label={t("Cerrar sesión", "Sign out")}><LogOut size={16} aria-hidden="true"/><span>{t("Salir", "Sign out")}</span></button></form>
            )}
          </div>
        </header>
        <main id="main-content" className={styles.main}>
          <ContentMotion identity={pathname} className={styles.motionRegion}>{children}</ContentMotion>
        </main>
      </div>
      <ClientAssistant onDockedChange={setAssistantDocked} />
    </div></IntakeSessionProvider>
  );
}

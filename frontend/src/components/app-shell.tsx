"use client";

import {
  BarChart3,
  Bell,
  Boxes,
  Building2,
  CircleHelp,
  ClipboardList,
  FileBarChart,
  Headphones,
  LayoutDashboard,
  Map,
  MapPinned,
  Menu,
  PackagePlus,
  Route,
  Search,
  Settings,
  Truck,
  UsersRound,
  Warehouse,
  Waypoints,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import styles from "./app-shell.module.css";

const navigation = [
  {
    label: "Principal",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, disabled: false },
      { href: "/freight-request/new", label: "Nueva carga", icon: PackagePlus, disabled: false },
      { href: "/requests", label: "Mis cargas", icon: ClipboardList, disabled: true },
      { href: "/tracking", label: "Seguimiento", icon: MapPinned, disabled: true },
      { href: "/dispatch", label: "Despachos", icon: Route, disabled: true },
      { href: "/drivers", label: "Conductores", icon: UsersRound, disabled: true },
      { href: "/vehicles", label: "Vehículos", icon: Truck, disabled: true },
    ],
  },
  {
    label: "Gestión",
    items: [
      { href: "/routes", label: "Rutas", icon: Map, disabled: true },
      { href: "/hubs", label: "Centros logísticos", icon: Warehouse, disabled: true },
      { href: "/analytics", label: "Analítica", icon: BarChart3, disabled: true },
      { href: "/reports", label: "Reportes", icon: FileBarChart, disabled: true },
    ],
  },
  {
    label: "Otros",
    items: [
      { href: "/settings", label: "Configuración", icon: Settings, disabled: true },
      { href: "/support", label: "Soporte", icon: Headphones, disabled: true },
      { href: "/help", label: "Centro de ayuda", icon: CircleHelp, disabled: true },
    ],
  },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const pageContext = pathname.startsWith("/freight-request/new")
    ? { title: "Nueva carga", subtitle: "Intake guiado de FreightRequest" }
    : pathname.startsWith("/booking/")
      ? { title: "Booking", subtitle: "Selección humana y confirmación" }
    : pathname.startsWith("/dispatch/")
      ? { title: "Smart Dispatch", subtitle: "Evaluación dinámica de opciones" }
      : { title: "Dashboard", subtitle: "Vista general de operaciones" };

  if (pathname === "/login") {
    return <>{children}</>;
  }

  return (
    <div className={styles.shell}>
      <a className={styles.skipLink} href="#main-content">Saltar al contenido</a>

      <aside className={`${styles.sidebar} ${open ? styles.sidebarOpen : ""}`}>
        <div className={styles.brandRow}>
          <Link className={styles.brand} href="/dashboard" onClick={() => setOpen(false)}>
            <span className={styles.brandMark} aria-hidden="true"><Waypoints size={21} /></span>
            <span><strong>CargoMesh</strong><small>Control Tower</small></span>
          </Link>
          <button className={styles.closeButton} type="button" aria-label="Cerrar navegación" onClick={() => setOpen(false)}>
            <X size={20} />
          </button>
        </div>

        <div className={styles.workspace}>
          <span className={styles.workspaceIcon} aria-hidden="true"><Building2 size={17} /></span>
          <span><small>Organización activa</small><strong>ACME Mining Perú</strong></span>
        </div>

        <nav className={styles.navigation} aria-label="Navegación principal">
          {navigation.map((section) => (
            <div className={styles.navSection} key={section.label}>
              <p>{section.label}</p>
              {section.items.map(({ href, label, icon: Icon, disabled }) => {
                const active = !disabled && (pathname === href || pathname.startsWith(`${href}/`));
                if (disabled) {
                  return (
                    <button key={href} className={`${styles.navLink} ${styles.navLinkDisabled}`} type="button" disabled title="Disponible en una tarea posterior">
                      <Icon size={17} strokeWidth={1.8} aria-hidden="true" />
                      <span>{label}</span>
                    </button>
                  );
                }
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
          <span><strong>Sistema operativo</strong><small>Entorno de demostración</small></span>
        </div>
      </aside>

      {open ? <div className={styles.backdrop} aria-hidden="true" onClick={() => setOpen(false)} /> : null}

      <div className={styles.contentColumn}>
        <header className={styles.topbar}>
          <button className={styles.menuButton} type="button" aria-label="Abrir navegación" aria-expanded={open} onClick={() => setOpen(true)}>
            <Menu size={20} />
          </button>
          <div className={styles.context}>
            <strong>{pageContext.title}</strong>
            <span>{pageContext.subtitle}</span>
          </div>
          <div className={styles.topbarActions}>
            <label className={styles.search}>
              <Search size={17} aria-hidden="true" />
              <span className={styles.srOnly}>Buscar en operaciones</span>
              <input type="search" placeholder="Buscar operación" />
              <kbd>⌘ K</kbd>
            </label>
            <button className={styles.iconButton} type="button" aria-label="Notificaciones">
              <Bell size={18} />
              <span className={styles.notificationDot} aria-hidden="true" />
            </button>
            <div className={styles.avatar} aria-hidden="true">CM</div>
            <div className={styles.userCopy}>
              <strong>Carlos Mendoza</strong>
              <span>Administrador</span>
            </div>
          </div>
        </header>
        <main id="main-content" className={styles.main}>{children}</main>
      </div>
    </div>
  );
}

"use client";

import {
  Bell,
  LayoutDashboard,
  Menu,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import styles from "./app-shell.module.css";

const navigation = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  if (pathname === "/login") {
    return <>{children}</>;
  }

  return (
    <div className={styles.shell}>
      <a className={styles.skipLink} href="#main-content">
        Saltar al contenido
      </a>

      <aside className={`${styles.sidebar} ${open ? styles.sidebarOpen : ""}`}>
        <div className={styles.brandRow}>
          <Link className={styles.brand} href="/dashboard" onClick={() => setOpen(false)}>
            <span className={styles.brandMark} aria-hidden="true">⬡</span>
            <span>CargoMesh</span>
          </Link>
          <button
            className={styles.closeButton}
            type="button"
            aria-label="Cerrar navegación"
            onClick={() => setOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        <div className={styles.workspace}>
          <span className={styles.workspaceEyebrow}>Organización activa</span>
          <strong>ACME Mining Perú</strong>
          <span>Operaciones internacionales</span>
        </div>

        <nav className={styles.navigation} aria-label="Navegación principal">
          {navigation.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`${styles.navLink} ${active ? styles.navLinkActive : ""}`}
                onClick={() => setOpen(false)}
              >
                <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className={styles.sidebarFoot}>
          <span className={styles.environmentDot} aria-hidden="true" />
          Demo WebMCP · Staging
        </div>
      </aside>

      {open ? (
        <button
          className={styles.backdrop}
          type="button"
          aria-label="Cerrar navegación"
          onClick={() => setOpen(false)}
        />
      ) : null}

      <div className={styles.contentColumn}>
        <header className={styles.topbar}>
          <button
            className={styles.menuButton}
            type="button"
            aria-label="Abrir navegación"
            aria-expanded={open}
            onClick={() => setOpen(true)}
          >
            <Menu size={21} />
          </button>
          <div className={styles.context}>
            <span>Control tower</span>
            <strong>Operaciones de carga</strong>
          </div>
          <div className={styles.topbarActions}>
            <button className={styles.iconButton} type="button" aria-label="Notificaciones">
              <Bell size={19} />
              <span className={styles.notificationDot} />
            </button>
            <div className={styles.avatar} aria-hidden="true">CM</div>
            <div className={styles.userCopy}>
              <strong>Carlos Mendoza</strong>
              <span>Owner</span>
            </div>
          </div>
        </header>
        <main id="main-content" className={styles.main}>{children}</main>
      </div>
    </div>
  );
}


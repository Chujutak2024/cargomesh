"use client";
import { useState } from "react";
import { ArrowRight, ClipboardList } from "lucide-react";
import { useLocale } from "@/features/i18n/locale-provider";
import { WorkspaceLink as Link } from "@/features/workspace-mode/workspace-link";
import { OperationRequestLink } from "./operations-navigation";
import type { DashboardActivityItem } from "./client-dashboard-model";
import { filterDashboardActivity, type DashboardActivityFilter } from "./dashboard-activity-model";
import s from "./client-dashboard.module.css";

export function DashboardActivity({ items, complete, unavailable }: { items: DashboardActivityItem[]; complete: boolean; unavailable: boolean }) {
  const { t } = useLocale();
  const [filter, setFilter] = useState<DashboardActivityFilter>("ALL");
  const visible = filterDashboardActivity(items, filter);
  const filters = [{ value: "ALL", label: t("Todas", "All") }, { value: "DRAFT", label: t("Borradores", "Drafts") }, { value: "PENDING", label: t("Pendientes", "Pending") }] as const;
  return <section className={`${s.card} ${s.activity}`} aria-labelledby="dashboard-activity-title">
    <header className={s.panelHeader}><div><h2 id="dashboard-activity-title">{t("Actividad reciente", "Recent activity")}</h2><p>{complete ? t("Últimas actualizaciones de tus solicitudes", "Latest updates to your requests") : t("Últimas actualizaciones de los registros cargados", "Latest updates in loaded records")}</p></div>
      <Link className={s.textLink} href="/requests">{t("Ver todo", "View all")}<ArrowRight size={15} aria-hidden="true"/></Link></header>
    <div className={s.activityToolbar}><div className={s.filters} role="group" aria-label={t("Filtrar actividad reciente", "Filter recent activity")}>{filters.map(item => <button key={item.value} type="button" aria-pressed={filter === item.value} onClick={() => setFilter(item.value)}>{item.label}</button>)}</div><small>{t("Últimos", "Latest")} {items.length}</small></div>
    <div className={s.activityList} aria-live="polite">{visible.map(item => <OperationRequestLink key={item.id} requestId={item.id} className={s.activityRow}>
      <span className={s.reference} title={item.fullReference}><strong>{item.reference}</strong><small>{item.date}</small></span>
      <span className={s.route}><strong>{item.route}</strong><small>{item.facilities}</small></span>
      <span className={s.cargo}><strong>{item.cargo}</strong><small>{item.description}</small></span>
      <span className={s.status} data-tone={item.tone}>{item.statusLabel}</span>
      <span className={s.rowAction} data-draft={item.status === "DRAFT"}>{item.status === "DRAFT" ? t("Continuar", "Resume") : t("Ver", "View")}<ArrowRight size={14} aria-hidden="true"/></span>
    </OperationRequestLink>)}
      {!visible.length && <div className={s.empty}><ClipboardList size={25} aria-hidden="true"/><strong>{unavailable ? t("No se pudo consultar la actividad", "Activity could not be loaded") : items.length ? t("Sin coincidencias en la actividad reciente", "No matches in recent activity") : t("Tu primera solicitud empieza aquí", "Your first shipment starts here")}</strong>
        <p>{items.length ? t("Puedes consultar todos los registros en Mis cargas.", "You can browse all records in My shipments.") : unavailable ? t("Reintenta la lectura antes de continuar.", "Retry the read before continuing.") : t("Describe tu envío al asistente o utiliza el formulario.", "Describe your shipment to the assistant or use the form.")}</p>
        {!unavailable && <Link className={s.textLink} href={items.length ? `/requests${filter === "DRAFT" ? "?status=DRAFT" : ""}` : "/freight-request/new"}>{items.length ? t("Ver solicitudes", "View requests") : t("Crear solicitud", "Create request")}<ArrowRight size={15}/></Link>}
      </div>}
    </div>
  </section>;
}

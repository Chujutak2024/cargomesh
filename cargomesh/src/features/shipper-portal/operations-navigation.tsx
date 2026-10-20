"use client";

import { ArrowLeft, ArrowRight, CalendarCheck2, ClipboardList, History, RefreshCw, TriangleAlert } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import type { ReactNode } from "react";
import { WorkspaceLink as Link } from "@/features/workspace-mode/workspace-link";
import { useLocale } from "@/features/i18n/locale-provider";
import type { OperationsCollection, OperationsReadIssue } from "@/server/services/v2-workspace/operations-collection";
import { operationDetailHref, operationView, operationsSearch, operationsHistoryState, parseOperationsQuery, type OperationsView } from "./operations-query";
import styles from "./operations.module.css";

export function OperationsNavigation({ detail = false }: { detail?: boolean }) {
  const { t } = useLocale(), path = usePathname(), params = useSearchParams();
  const query = parseOperationsQuery(params), current = detail ? query.view : operationView(path);
  const items = [
    { view: "requests" as const, label: t("Solicitudes", "Requests"), icon: ClipboardList },
    { view: "bookings" as const, label: t("Reservas", "Bookings"), icon: CalendarCheck2 },
    { view: "history" as const, label: t("Historial", "History"), icon: History },
  ];
  return <div className={styles.navigation}>
    {detail ? <Link className={styles.back} href={`/${query.view}${operationsSearch(query)}`}><ArrowLeft size={16}/>{t("Volver a Operaciones", "Back to Operations")}</Link> : null}
    <nav className={styles.tabs} aria-label={t("Vistas de Operaciones", "Operations views")}>{items.map(({ view, label, icon: Icon }) =>
      <Link key={view} href={`/${view}${operationsSearch({ ...query, view })}`} aria-current={current === view ? "page" : undefined}>
        <Icon size={17} aria-hidden="true"/>{label}
      </Link>)}</nav>
  </div>;
}

export function OperationRequestLink({ requestId, children, className }: { requestId: string; children: ReactNode; className?: string }) {
  const params = useSearchParams(), path = usePathname();
  const query = parseOperationsQuery(params);
  return <Link className={className} href={operationDetailHref(requestId, query, operationView(path))} onClick={() => {
    const current = new URL(window.location.href);
    current.searchParams.set("selected", requestId);
    window.history.replaceState(operationsHistoryState(window.history.state), "", `${current.pathname}${current.search}${current.hash}`);
  }}>{children}</Link>;
}

export function OperationsReadNotice({ issues }: { issues: OperationsReadIssue[] }) {
  const { t } = useLocale(), router = useRouter(), [pending, startTransition] = useTransition();
  if (!issues.length) return null;
  const names: Record<string, string> = { requests: t("solicitudes", "requests"), bookings: t("reservas", "bookings"),
    offers: t("ofertas", "offers"), decisions: t("decisiones", "decisions"), ranking: t("ranking", "ranking"),
    executions: t("ejecuciones", "executions"), facilities: t("sedes", "facilities"), routes: t("rutas", "routes"),
    plans: t("planes", "plans"), opportunities: t("oportunidades", "opportunities"), incidents: t("incidencias", "incidents"),
    "execution-events": t("eventos", "events") };
  return <section className={styles.readNotice} aria-label={t("Estado de lectura", "Read status")}>
    <TriangleAlert size={19} aria-hidden="true"/><div role="status"><strong>{t("Información incompleta", "Incomplete information")}</strong>
      <p>{issues.map(issue => `${names[issue.resource] ?? issue.resource}: ${issue.reason === "unavailable"
        ? t("no se pudo consultar", "could not be loaded") : t("lectura parcial", "partial read")}`).join(" · ")}</p>
      <p>{t("Los registros no cargados no cuentan como cero. Actualiza antes de tomar una decisión comercial.", "Unloaded records are not counted as zero. Refresh before making a commercial decision.")}</p></div>
    <button type="button" disabled={pending} onClick={() => startTransition(() => router.refresh())}><RefreshCw size={15} aria-hidden="true"/>
      {pending ? t("Actualizando…", "Refreshing…") : t("Reintentar lectura", "Retry read")}</button>
  </section>;
}

export function OperationsCollectionNotice({ collection, paginate = false }: {
  collection: OperationsCollection<unknown>; paginate?: boolean;
}) {
  const { t } = useLocale(), path = usePathname(), params = useSearchParams();
  const query = parseOperationsQuery(params), view: OperationsView = operationView(path);
  if (collection.complete && !collection.error) return null;
  return <div className={styles.collectionNotice}>
    <p>{collection.data.length ? t(`Se cargaron ${collection.data.length} registros desde la posición ${collection.offset + 1}.`,
      `Loaded ${collection.data.length} records starting at position ${collection.offset + 1}.`) : t("No hay registros cargados en este tramo.", "No records loaded in this range.")}
      {" "}{t("La búsqueda, los filtros y el orden se aplican a este tramo; no representan el catálogo completo.", "Search, filters and sorting apply to this range, not the complete collection.")}</p>
    {paginate ? <nav className={styles.pagination} aria-label={t("Paginación de solicitudes", "Request pagination")}>
      {collection.offset > 0 ? <Link href={`/${view}${operationsSearch({ ...query, offset: Math.max(0, collection.offset - collection.batchSize), selected: "" })}`}><ArrowLeft size={15}/>{t("Tramo anterior", "Previous range")}</Link> : null}
      {collection.nextOffset !== null && !collection.error ? <Link href={`/${view}${operationsSearch({ ...query, offset: collection.nextOffset, selected: "" })}`}>{t("Siguiente tramo", "Next range")}<ArrowRight size={15}/></Link> : null}
    </nav> : null}
  </div>;
}

import type { ReactNode } from "react";
import { ArrowRight, Building2, CalendarCheck2, CircleDotDashed, ClipboardList, FilePenLine, History, MapPinned, PackagePlus } from "lucide-react";
import { WorkspaceLink as Link } from "@/features/workspace-mode/workspace-link";
import { ConversationEntry } from "@/features/v2-intake/conversation-entry";
import type { FreightRequestV2Data } from "@/features/v2-intake/contracts";
import { translate, type Locale } from "@/features/i18n/config";
import { dashboardRequests } from "./client-dashboard-model";
import { DashboardActivity } from "./dashboard-activity";
import { OperationRequestLink } from "./operations-navigation";
import s from "./client-dashboard.module.css";

export function ClientDashboard({ requests, complete, unavailable, counts, locale, readNotice }: {
  requests: FreightRequestV2Data[]; complete: boolean; unavailable: boolean;
  counts: { requests: string; active: string; bookings: string; executions: string; facilities: string };
  locale: Locale; readNotice?: ReactNode;
}) {
  const t = (es: string, en: string) => translate(locale, es, en);
  const { recent, draft } = dashboardRequests(requests, locale);
  const stages = [
    { label: t("Solicitudes", "Requests"), value: counts.requests, Icon: ClipboardList, href: "/requests" },
    { label: t("Abiertas", "Open"), value: counts.active, Icon: CircleDotDashed, href: "/requests" },
    { label: t("Reservas", "Bookings"), value: counts.bookings, Icon: CalendarCheck2, href: "/bookings" },
    { label: t("Ejecuciones", "Executions"), value: counts.executions, Icon: MapPinned, href: "/tracking" },
  ];
  const quick = [
    { label: t("Sedes", "Facilities"), detail: `${counts.facilities} ${t("registradas", "registered")}`, Icon: Building2, href: "/facilities" },
    { label: t("Reservas", "Bookings"), detail: t("Autorización y estado carrier", "Authorization and carrier status"), Icon: CalendarCheck2, href: "/bookings" },
    { label: t("Seguimiento", "Tracking"), detail: t("Eventos e incidencias", "Events and incidents"), Icon: MapPinned, href: "/tracking" },
    { label: t("Historial", "History"), detail: t("Solicitudes y eventos", "Requests and events"), Icon: History, href: "/history" },
  ];
  return <div className={s.dashboard}>{readNotice}<div className={s.grid}>
    <div className={s.primaryColumn}>
      <ConversationEntry/>
      <section className={s.card} aria-labelledby="dashboard-pipeline-title">
        <header className={s.panelHeader}><div><h2 id="dashboard-pipeline-title">{t("Tus cargas, de la solicitud al seguimiento", "Your shipments, from request to tracking")}</h2><p>{t("Registros de tu organización", "Your organization's records")}</p></div></header>
        <div className={s.stages} data-client-motion-group>{stages.map(({ label, value, Icon, href }) => <Link key={label} href={href} className={s.stage}><span className={s.stageIcon}><Icon size={18} aria-hidden="true"/></span><span><strong>{value}</strong><small>{label}</small></span></Link>)}</div>
      </section>
      <DashboardActivity items={recent} complete={complete} unavailable={unavailable}/>
    </div>
    <aside className={s.secondaryColumn} aria-label={t("Herramientas de envío", "Shipment tools")}>
      <section className={s.card}><header className={s.panelHeader}><div><h2>{t("Iniciar un envío", "Start a shipment")}</h2><p>{t("Prepara tu próxima solicitud", "Prepare your next request")}</p></div></header>
        <Link className={s.orderChoice} href="/freight-request/new"><span className={s.orderIcon}><PackagePlus size={21} aria-hidden="true"/></span><span><strong>{t("Nueva solicitud", "New request")}</strong><small>{t("Define la carga y la ruta, revisa y confirma.", "Define the cargo and route, then review and confirm.")}</small></span><ArrowRight size={17} aria-hidden="true"/></Link>
        <Link className={s.orderChoice} href="/requests?status=DRAFT"><span className={s.orderIcon}><FilePenLine size={21} aria-hidden="true"/></span><span><strong>{t("Mis borradores", "My drafts")}</strong><small>{t("Continúa una solicitud que ya comenzaste.", "Continue a request you've already started.")}</small></span><ArrowRight size={17} aria-hidden="true"/></Link>
      </section>
      {draft && <section className={`${s.card} ${s.draftCard}`}><header className={s.panelHeader}><div><h2>{t("Retoma donde lo dejaste", "Pick up where you left off")}</h2><p>{complete ? t("Tu borrador más reciente", "Your latest draft") : t("Último borrador en los registros cargados", "Latest draft in loaded records")}</p></div><FilePenLine size={19} aria-hidden="true"/></header>
        <div className={s.draftContent}><span className={s.draftReference} title={draft.fullReference}>{draft.reference}</span><strong>{draft.route}</strong><p>{draft.cargo}</p><small>{draft.description}</small><OperationRequestLink requestId={draft.id} className={s.outlineButton}>{t("Revisar borrador", "Review draft")}<ArrowRight size={16} aria-hidden="true"/></OperationRequestLink></div>
      </section>}
      <section className={s.card}><header className={s.panelHeader}><div><h2>{t("Accesos rápidos", "Quick access")}</h2></div></header>
        <div className={s.quickGrid} data-client-motion-group>{quick.map(({ label, detail, Icon, href }) => <Link key={href} href={href} className={s.quickCard}><Icon size={20} aria-hidden="true"/><strong>{label}</strong><small>{detail}</small></Link>)}</div>
      </section>
    </aside>
  </div></div>;
}

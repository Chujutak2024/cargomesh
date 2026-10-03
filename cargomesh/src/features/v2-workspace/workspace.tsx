"use client";

import { BriefcaseBusiness, CircleHelp, ClipboardList, FileText, LayoutDashboard, MapPinned, PackagePlus, Route } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useLocale } from "@/features/i18n/locale-provider";
import { RoadCandidateMapView } from "@/features/v2-road-map/road-candidate-map-view";
import { useLocalRoadPreview } from "./use-local-road-preview";
import { cityLabel, countryLabel, landRoutePolicy, locationRegions } from "./road-locations";
import {
  applyDraftChange, draftStorageKey, facilities, facilityFor, facilityLabel, initialDraft, mapPropsForDraft, readDraft,
  requestSteps, validateStep, type RequestStep, type WorkspaceDraft, type WorkspaceRole, type WorkspaceView,
} from "./workspace-model";
import styles from "./workspace.module.css";

const viewFromHash = (): WorkspaceView => {
  const name = window.location.hash.replace(/^#\/?/, "");
  return (["dashboard", "request", "shipments", "tracking", "desk", "help"] as WorkspaceView[]).includes(name as WorkspaceView)
    ? name as WorkspaceView : "dashboard";
};

function SectionHeading({ kicker, title, subtitle, action }: { kicker?: string; title: string; subtitle: string; action?: ReactNode }) {
  return <div className={styles.sectionHeading}><div>{kicker ? <span className={styles.kicker}>{kicker}</span> : null}<h1>{title}</h1><p>{subtitle}</p></div>{action}</div>;
}

function LocationSelect({ label, value, otherId, locale, onChange }: {
  label: string; value: string; otherId: string; locale: "es" | "en"; onChange: (id: string) => void;
}) {
  return <label>{label}<select value={value} onChange={event => onChange(event.target.value)}>
    {locationRegions.map(region => <optgroup key={region.id} label={region[locale]}>
      {facilities.filter(location => location.region === region.id).map(location =>
        <option key={location.id} value={location.id} disabled={location.id === otherId}>
          {facilityLabel(location.id, locale)}
        </option>)}
    </optgroup>)}
  </select></label>;
}

export function V2Workspace() {
  const { locale, t } = useLocale();
  const [view, setView] = useState<WorkspaceView>("dashboard");
  const [step, setStep] = useState<RequestStep>("context");
  const [draft, setDraft] = useState<WorkspaceDraft>(initialDraft);
  const [hydrated, setHydrated] = useState(false);
  const [saveState, setSaveState] = useState<"saving" | "saved" | "unavailable">("saved");
  const [role, setRole] = useState<WorkspaceRole>("client");
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>("road-scenario");
  const [search, setSearch] = useState("");
  const [formError, setFormError] = useState("");

  useEffect(() => {
    setView(viewFromHash());
    const onHashChange = () => setView(viewFromHash());
    window.addEventListener("hashchange", onHashChange);
    try {
      setDraft(readDraft(window.localStorage.getItem(draftStorageKey)));
      setRole(window.localStorage.getItem("cargomesh-v2-react-role") === "coordinator" ? "coordinator" : "client");
    } catch { setSaveState("unavailable"); }
    setHydrated(true);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    setSaveState("saving");
    const timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(draftStorageKey, JSON.stringify(draft));
        setSaveState("saved");
      } catch { setSaveState("unavailable"); }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [draft, hydrated]);

  useEffect(() => {
    if (hydrated && window.location.hash !== `#/${view}`) {
      window.history.replaceState(null, "", `#/${view}`);
    }
  }, [hydrated, locale, view]);

  const updateDraft = (change: Partial<WorkspaceDraft>) => {
    setDraft((current) => applyDraftChange(current, change));
    setFormError("");
  };
  const changeRole = (next: WorkspaceRole) => {
    setRole(next);
    try { window.localStorage.setItem("cargomesh-v2-react-role", next); } catch { /* Optional preference. */ }
    navigate("dashboard");
  };
  const navigate = (next: WorkspaceView, requestStep?: RequestStep) => {
    setView(next);
    if (requestStep) setStep(requestStep);
    setFormError("");
    window.location.hash = `/${next}`;
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  const onSelectCandidate = useCallback((id: string) => setSelectedCandidateId(id), []);
  const roadPreview = useLocalRoadPreview(draft.originId, draft.destinationId,
    hydrated && (view === "tracking" || (view === "request" && step === "route")));
  const mapProps = useMemo(() => mapPropsForDraft(draft, selectedCandidateId, onSelectCandidate, locale, roadPreview?.preview ?? null),
    [draft, selectedCandidateId, onSelectCandidate, locale, roadPreview?.preview]);
  const origin = facilityFor(draft.originId);
  const destination = facilityFor(draft.destinationId);
  const routePolicy = landRoutePolicy(draft.originId, draft.destinationId);
  const landConnectionNotice = t(
    "Este par no tiene conexión vial continua para camiones: requiere cruzar el mar o una zona sin carretera. Elige otro origen o destino dentro de una red terrestre conectada.",
    "This pair has no continuous road connection for trucks: it requires crossing the sea or an area without a through road. Choose another origin or destination within a connected land network.",
  );
  const cargoWeight = draft.quantity * draft.unitWeightKg;
  const status = draft.savedForReview ? t("Guardado para revisar", "Saved for review") : t("Borrador", "Draft");
  const visibleDraft = `${origin.city} → ${destination.city} ${draft.cargoDescription}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase());
  const navItems = role === "client" ? [
    { view: "dashboard" as const, label: t("Panel", "Dashboard"), icon: LayoutDashboard },
    { view: "request" as const, label: t("Solicitud", "Request"), icon: FileText },
    { view: "shipments" as const, label: t("Mis envíos", "My shipments"), icon: BriefcaseBusiness },
    { view: "tracking" as const, label: t("Seguimiento", "Tracking"), icon: MapPinned },
    { view: "help" as const, label: t("Ayuda", "Help"), icon: CircleHelp },
  ] : [
    { view: "dashboard" as const, label: t("Panel", "Dashboard"), icon: LayoutDashboard },
    { view: "shipments" as const, label: t("Solicitudes", "Requests"), icon: ClipboardList },
    { view: "desk" as const, label: t("Mesa de carga", "Freight desk"), icon: BriefcaseBusiness },
    { view: "tracking" as const, label: t("Seguimiento", "Tracking"), icon: MapPinned },
    { view: "help" as const, label: t("Ayuda", "Help"), icon: CircleHelp },
  ];
  const stepNames = [t("Contexto", "Context"), t("Ruta", "Route"), t("Carga", "Cargo"), t("Fechas", "Schedule"), t("Revisión", "Review")];

  const advance = () => {
    if (!validateStep(draft, step)) {
      setFormError(t("Revisa los campos de este paso antes de continuar.", "Review this step's fields before continuing."));
      return;
    }
    const index = requestSteps.indexOf(step);
    if (index === requestSteps.length - 1) {
      setDraft((current) => ({ ...current, completedStep: 5, savedForReview: true }));
      navigate("dashboard");
      return;
    }
    setDraft((current) => ({ ...current, completedStep: Math.max(current.completedStep, index + 1) }));
    setStep(requestSteps[index + 1]);
    setFormError("");
    window.scrollTo({ top: 0, behavior: "instant" });
  };

  const mapNotice = <p className={styles.disclosure}>{roadPreview?.status === "estimated" ? t(
    "Ubicaciones de escenario. La ruta de Google Routes es una estimación vial; no valida restricciones de camión, instalaciones comerciales, cobertura ni despacho. El camión identifica el origen, no un vehículo asignado.",
    "Scenario locations. A Google Routes route is a driving estimate; it does not validate truck restrictions, commercial facilities, coverage, or dispatch. The truck identifies the origin, not an assigned vehicle.",
  ) : mapProps.candidates.length ? t(
    "Ubicaciones de escenario; aún no hay una ruta vial calculada. El camión marca el origen y la empresa el destino, sin confirmar un vehículo ni instalaciones comerciales.",
    "Scenario locations; no driving route has been calculated yet. The truck marks the origin and the company the destination, without confirming a vehicle or commercial facilities.",
  ) : t(
    "Solo se muestran origen y destino. No hay candidato ni geometría de ruta para este par; la cobertura sigue sin verificar.",
    "Only origin and destination are shown. This pair has no candidate or route geometry; coverage remains unverified.",
  )}</p>;
  const routeStatus = <p className={styles.routeStatus} role="status">{
    routePolicy === "disconnected_networks" ? landConnectionNotice
      : routePolicy === "same_location" ? t("Selecciona un origen y un destino distintos.", "Choose different origin and destination locations.")
      :
    roadPreview?.status === "estimated" ? <><span className={styles.onlineDot} aria-hidden="true" />{t("Ruta vial calculada", "Driving route calculated")}
      {roadPreview.calculatedAt ? <small>{t("Consultada", "Fetched")} {new Date(roadPreview.calculatedAt).toLocaleString(locale === "es" ? "es-PE" : "en-US")}</small> : null}</>
      : roadPreview?.reason === "non_road_route" ? t("El proveedor devolvió un tramo en ferry o transporte distinto de carretera. No se muestra como ruta de camión.", "The provider returned a ferry or a non-road segment. It is not displayed as a truck route.")
      : roadPreview?.status === "unavailable" ? t("No se pudo obtener la ruta vial. Se conservan los puntos de origen y destino, sin línea de reemplazo.", "The driving route could not be retrieved. Origin and destination remain visible without a replacement line.")
        : t("Obteniendo ruta vial…", "Fetching driving route…")
  }</p>;

  return <div className={styles.app}>
    <a className={styles.skip} href="#workspace-main" onClick={(event) => { event.preventDefault(); document.getElementById("workspace-main")?.focus(); }}>{t("Saltar al contenido", "Skip to content")}</a>
    <aside className={styles.sidebar} aria-label={t("Navegación CargoMesh V2", "CargoMesh V2 navigation")}>
      <div className={styles.brand}>
        <Image src="/v2-workspace/cargomesh-icon.png" alt="" width={40} height={40} />
        <div><strong>CargoMesh</strong><small>{t("ESPACIO LOGÍSTICO", "LOGISTICS WORKSPACE")}</small></div>
      </div>
      <nav className={styles.navigation}>
        {navItems.map(({ view: itemView, label, icon: Icon }) => <button type="button" key={itemView} className={`${styles.navItem} ${view === itemView ? styles.navActive : ""}`} onClick={() => navigate(itemView, itemView === "request" ? requestSteps[Math.min(draft.completedStep, 4)] : undefined)} aria-current={view === itemView ? "page" : undefined}><Icon size={17} aria-hidden="true" />{label}</button>)}
      </nav>
      <div className={styles.sideFoot}><span className={styles.onlineDot} aria-hidden="true" />{t("Vista de escenario V2", "V2 scenario view")}<small>{t("Borrador guardado en este dispositivo", "Draft saved on this device")}</small></div>
    </aside>

    <div className={styles.workspace}>
      <header className={styles.topbar}>
        <span className={styles.topContext}>{t("CargoMesh V2 · escenario ROAD", "CargoMesh V2 · ROAD scenario")}</span>
        <div className={styles.topActions}>
          <span className={styles.saveState} role="status"><span className={styles.onlineDot} aria-hidden="true" />{saveState === "saving" ? t("Guardando…", "Saving…") : saveState === "saved" ? t("Guardado en este dispositivo", "Saved on this device") : t("Guardado no disponible", "Saving unavailable")}</span>
          <LanguageSwitcher compact />
          <label className={styles.roleSelect}><span>{t("Ver como (demo)", "View as (demo)")}</span><select value={role} onChange={(event) => changeRole(event.target.value === "coordinator" ? "coordinator" : "client")}><option value="client">{t("Cliente / Remitente", "Client / Shipper")}</option><option value="coordinator">{t("Coordinador", "Coordinator")}</option></select></label>
          <strong className={styles.account}>{t("Escenario V2", "V2 scenario")}</strong>
        </div>
      </header>

      <main id="workspace-main" className={styles.main} tabIndex={-1}>
        {view === "dashboard" ? <>
          <SectionHeading title={t("Panel", "Dashboard")} subtitle={t("Tu solicitud y su siguiente paso, de un vistazo.", "Your request and its next action, at a glance.")} />
          <div className={styles.overview} aria-label={t("Resumen de solicitudes", "Request summary")}>
            <div><span>{t("Solicitudes", "Requests")}</span><strong>1</strong></div>
            <div><span>{t("Borradores", "Drafts")}</span><strong>{draft.savedForReview ? 0 : 1}</strong></div>
            <div><span>{t("En curso", "In progress")}</span><strong>0</strong></div>
            <div><span>{t("Listo para revisar", "Ready for review")}</span><strong>{draft.savedForReview ? 1 : 0}</strong></div>
            <div><span>{t("Pasos comprobados", "Checked steps")}</span><strong>{draft.completedStep}/5</strong></div>
          </div>
          <div className={styles.sectionTitle}><h2>{t("Requiere atención", "Needs attention")}</h2><p>{t("Continúa donde te quedaste.", "Pick up where you left off.")}</p></div>
          <article className={styles.attention}>
            <div><span className={styles.kicker}>V2-LOCAL-01 · {status}</span><div className={styles.routePair}><span><small>{t("ORIGEN", "ORIGIN")}</small><strong>{facilityLabel(origin.id, locale)}</strong><small>{t("Referencia de ciudad", "City reference")}</small></span><Route size={19} aria-hidden="true" /><span><small>{t("DESTINO", "DESTINATION")}</small><strong>{facilityLabel(destination.id, locale)}</strong><small>{t("Referencia de ciudad", "City reference")}</small></span></div></div>
            <div className={styles.attentionAction}><span>{t("Progreso", "Progress")} · {draft.completedStep} / 5</span><div className={styles.progressTrack}><i style={{ width: `${draft.completedStep * 20}%` }} /></div><button className={styles.primaryButton} type="button" onClick={() => navigate("request", requestSteps[Math.min(draft.completedStep, 4)])}>{t("Revisar solicitud", "Review request")} →</button><button className={styles.textButton} type="button" onClick={() => navigate("tracking")}>{t("Ver mapa", "View map")}</button></div>
          </article>
          <div className={styles.visualGrid}>
            <section className={styles.visualCard} aria-label={t("Estado de la solicitud", "Request status")}><div className={styles.cardHead}><h2>{t("Solicitudes por estado", "Requests by status")}</h2><small>{t("Solo esta solicitud del navegador", "This browser request only")}</small></div><div className={styles.donutLayout}><div className={styles.donut}><span><strong>1</strong>{t("solicitud", "request")}</span></div><div className={styles.legend}><div><i className={styles.tealDot} />{status}<strong>1</strong></div><div className={styles.legendTrack}><i /></div><p>{t("La solicitud permanece en el navegador; no se envió a un transportista.", "This request stays in the browser; no carrier submission occurred.")}</p></div></div></section>
            <section className={styles.visualCard}><div className={styles.cardHead}><h2>{t("Rutas de un vistazo", "Routes at a glance")}</h2><small>{t("Par de ciudades seleccionado", "Selected city pair")}</small></div><div className={styles.routeOverview}><strong>V2-LOCAL-01</strong><span>{status}</span><div className={styles.routeLine}><b>{facilityLabel(origin.id, locale)}</b><span aria-hidden="true"><i /></span><b>{facilityLabel(destination.id, locale)}</b></div></div>{mapNotice}</section>
          </div>
          <div className={styles.tableHeading}><div><h2>{t("Solicitudes recientes", "Recent requests")}</h2><p>{t("1 solicitud editable en este espacio del navegador", "1 editable request in this browser workspace")}</p></div><button className={styles.secondaryButton} type="button" onClick={() => navigate("request", "context")}>{t("Editar solicitud", "Edit request")} +</button></div>
          <RequestTable draft={draft} locale={locale} onEdit={() => navigate("request", requestSteps[Math.min(draft.completedStep, 4)])} onTrack={() => navigate("tracking")} />
        </> : null}

        {view === "request" ? <>
          <SectionHeading kicker="V2-LOCAL-01 · DEMO" title={t("Solicitud ROAD", "ROAD request")} subtitle={t("Completa el escenario; los cambios se guardan en este dispositivo.", "Complete the scenario; changes are saved on this device.")} />
          <nav className={styles.stepper} aria-label={t("Pasos de la solicitud", "Request steps")}>{requestSteps.map((item, index) => <button key={item} type="button" className={step === item ? styles.stepActive : index < draft.completedStep ? styles.stepDone : ""} disabled={index > draft.completedStep} aria-current={step === item ? "step" : undefined} onClick={() => { setStep(item); setFormError(""); }}><span>{index < draft.completedStep ? "✓" : index + 1}</span>{stepNames[index]}</button>)}</nav>
          {step === "context" ? <section className={styles.formCard}>
            <div className={styles.cardHead}><div><h2>{t("Origen y destino", "Origin and destination")}</h2><p>{t("Explora ciudades de distintas regiones. El transporte es exclusivamente por carretera.", "Explore cities across regions. Transport is road only.")}</p></div><small>{facilities.length} {t("ciudades", "cities")} · {new Set(facilities.map(location => location.countryCode)).size} {t("países", "countries")}</small></div>
            <div className={styles.regionList} aria-label={t("Regiones disponibles", "Available regions")}>{locationRegions.map(region => <span key={region.id}>{region[locale]}</span>)}</div>
            <div className={styles.formGrid}>
              <LocationSelect label={t("Origen", "Origin")} value={draft.originId} otherId={draft.destinationId} locale={locale} onChange={originId => updateDraft({ originId })} />
              <LocationSelect label={t("Destino", "Destination")} value={draft.destinationId} otherId={draft.originId} locale={locale} onChange={destinationId => updateDraft({ destinationId })} />
            </div>
            {routePolicy === "disconnected_networks" ? <p className={styles.connectionNotice} role="status">{landConnectionNotice}</p>
              : routePolicy === "same_location" ? <p className={styles.connectionNotice} role="status">{t("El origen y el destino deben ser distintos.", "Origin and destination must be different.")}</p> : null}
            <p className={styles.formNote}>{t("Solo carretera · sin ferris ni transporte marítimo. Las ciudades son referencias locales, no instalaciones verificadas. La ruta se consulta automáticamente en el siguiente paso; fronteras, peso, altura y permisos del camión requieren validación.", "Road only · no ferries or sea transport. Cities are local references, not verified facilities. The route is requested automatically in the next step; borders, truck weight, height, and permits require validation.")}</p>
          </section> : null}
          {step === "route" ? <>{routeStatus}<RoadCandidateMapView {...mapProps} />{mapNotice}</> : null}
          {step === "cargo" ? <section className={styles.formCard}><div className={styles.cardHead}><div><h2>{t("Carga", "Cargo")}</h2><p>{t("Describe la carga sin asumir capacidad disponible.", "Describe the cargo without assuming available capacity.")}</p></div></div><div className={styles.formGrid}><label>{t("Descripción", "Description")}<input value={draft.cargoDescription} maxLength={120} onChange={(event) => updateDraft({ cargoDescription: event.target.value })} /></label><label>{t("Número de unidades", "Number of units")}<input type="number" min="1" step="1" value={draft.quantity} onChange={(event) => updateDraft({ quantity: Number(event.target.value) })} /></label><label>{t("Peso por unidad (kg)", "Weight per unit (kg)")}<input type="number" min="0.01" step="0.01" value={draft.unitWeightKg} onChange={(event) => updateDraft({ unitWeightKg: Number(event.target.value) })} /></label></div><p className={styles.formNote}>{t("Peso total capturado", "Captured total weight")}: {cargoWeight.toLocaleString(locale === "es" ? "es-PE" : "en-US")} kg. {t("No verifica equipo ni cupo.", "It does not verify equipment or capacity.")}</p></section> : null}
          {step === "schedule" ? <section className={styles.formCard}><div className={styles.cardHead}><div><h2>{t("Ventana de fechas", "Date window")}</h2><p>{t("La entrega no puede ser anterior a la recogida.", "Delivery cannot precede pickup.")}</p></div></div><div className={styles.formGrid}><label>{t("Recogida", "Pickup")}<input type="date" value={draft.pickupDate} onChange={(event) => updateDraft({ pickupDate: event.target.value })} /></label><label>{t("Entrega", "Delivery")}<input type="date" value={draft.deliveryDate} onChange={(event) => updateDraft({ deliveryDate: event.target.value })} /></label></div><p className={styles.formNote}>{t("Estas fechas no reservan capacidad ni prometen una hora de llegada.", "These dates do not reserve capacity or promise an arrival time.")}</p></section> : null}
          {step === "review" ? <section className={styles.formCard}><div className={styles.cardHead}><div><h2>{t("Revisión", "Review")}</h2><p>{t("Confirma los datos antes de guardarlos en este dispositivo.", "Check the details before saving them on this device.")}</p></div></div><div className={styles.reviewGrid}><div><small>{t("Ruta", "Route")}</small><strong>{origin.city} → {destination.city}</strong></div><div><small>{t("Carga", "Cargo")}</small><strong>{draft.cargoDescription} · {draft.quantity} × {draft.unitWeightKg} kg</strong></div><div><small>{t("Fechas", "Dates")}</small><strong>{draft.pickupDate || "—"} → {draft.deliveryDate || "—"}</strong></div><div><small>{t("Elegibilidad", "Eligibility")}</small><strong>UNKNOWN</strong></div></div><p className={styles.formNote}>{t("Guardar para revisar no envía la solicitud, no crea una reserva y no confirma cobertura de transportista.", "Saving for review does not submit the request, create a booking, or confirm carrier coverage.")}</p></section> : null}
          <div className={styles.formActions}><button className={styles.secondaryButton} type="button" onClick={() => { const index = requestSteps.indexOf(step); if (index === 0) navigate("dashboard"); else setStep(requestSteps[index - 1]); }}>{t("Volver", "Back")}</button><span role="alert" className={styles.formError}>{formError}</span><button className={styles.primaryButton} type="button" onClick={advance}>{step === "review" ? t("Guardar para revisar", "Save for review") : t("Continuar", "Continue")} →</button></div>
        </> : null}

        {view === "shipments" ? <><SectionHeading title={t("Mis envíos", "My shipments")} subtitle={t("Consulta el borrador guardado en este navegador.", "Review the draft saved in this browser.")} action={<button className={styles.primaryButton} type="button" onClick={() => navigate("request", "context")}><PackagePlus size={16} aria-hidden="true" /> {t("Editar solicitud", "Edit request")}</button>} /><label className={styles.searchLabel}>{t("Buscar por ciudad o carga", "Search by city or cargo")}<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("Buscar solicitud…", "Search request…")} /></label>{visibleDraft ? <RequestTable draft={draft} locale={locale} onEdit={() => navigate("request", requestSteps[Math.min(draft.completedStep, 4)])} onTrack={() => navigate("tracking")} /> : <div className={styles.empty} role="status">{t("No hay solicitudes que coincidan.", "No matching requests.")}</div>}</> : null}

        {view === "tracking" ? <><SectionHeading kicker="V2-LOCAL-01 · DEMO" title={t("Seguimiento", "Tracking")} subtitle={t("Ruta vial para las coordenadas seleccionadas; sin GPS ni despacho conectado.", "Driving route for the selected coordinates; no GPS or dispatch is connected.")} />{routeStatus}<RoadCandidateMapView {...mapProps} />{mapNotice}<div className={styles.infoGrid}><div><small>{t("Distancia", "Distance")}</small><strong>{roadPreview?.preview?.distanceKm != null ? `${roadPreview.preview.distanceKm.toLocaleString(locale === "es" ? "es-PE" : "en-US")} km` : t("No disponible", "Unavailable")}</strong></div><div><small>{t("Tiempo vial estimado", "Estimated driving time")}</small><strong>{roadPreview?.preview?.estimatedTransitHours != null ? `${roadPreview.preview.estimatedTransitHours.toLocaleString(locale === "es" ? "es-PE" : "en-US")} h` : t("No disponible", "Unavailable")}</strong></div><div><small>{t("Cobertura", "Coverage")}</small><strong>UNKNOWN</strong></div></div></> : null}

        {view === "desk" ? <><SectionHeading title={t("Mesa de carga", "Freight desk")} subtitle={t("Vista de coordinación del mismo borrador de escenario.", "Coordinator view of the same scenario draft.")} /><div className={styles.notice}><strong>{t("Sin evaluación de transportistas", "No carrier evaluation")}</strong><p>{t("No hay respuesta de serviceability, precio ni reserva para este borrador.", "This draft has no serviceability result, price, or booking.")}</p></div><RequestTable draft={draft} locale={locale} onEdit={() => navigate("request", requestSteps[Math.min(draft.completedStep, 4)])} onTrack={() => navigate("tracking")} /></> : null}

        {view === "help" ? <><SectionHeading title={t("Ayuda", "Help")} subtitle={t("Cómo interpretar este espacio de escenario V2.", "How to interpret this V2 scenario workspace.")} /><div className={styles.notice}><h2>{t("Qué significa el mapa", "What the map means")}</h2><p>{t("El camión marca el origen y la empresa el destino; son referencias de ciudad, no instalaciones verificadas ni un vehículo asignado. El servidor local consulta Google Routes para los pares dentro de una red terrestre conectada. Europa, Asia y África pueden compartir la red; cruzar una frontera no confirma permisos ni cobertura. Se bloquean cruces de océano y el paso vial entre Norteamérica y Sudamérica. Se pide evitar ferris y se rechaza cualquier resultado con ferry o transporte distinto de carretera. La geometría real se etiqueta ESTIMATED: no valida las restricciones de un camión. Si faltan datos, UNKNOWN muestra sólo los puntos, sin inventar una línea.", "The truck marks the origin and the company the destination; these are city references, not verified facilities or an assigned vehicle. The local server queries Google Routes for pairs within a connected land network. Europe, Asia, and Africa can share the network; crossing a border does not confirm permits or coverage. Ocean crossings and the through-road journey between North and South America are blocked. Ferries are avoided and any result containing a ferry or non-road transport is rejected. Real geometry is labeled ESTIMATED: it does not validate truck restrictions. When data is missing, UNKNOWN shows only the points without inventing a line.")}</p><p>{t("Los borradores se guardan únicamente en este navegador. No hay envío a un carrier ni sincronización cloud en esta vista.", "Drafts are saved only in this browser. This view does not submit to a carrier or sync to cloud storage.")}</p></div></> : null}
      </main>
    </div>
  </div>;
}

function RequestTable({ draft, locale, onEdit, onTrack }: { draft: WorkspaceDraft; locale: "es" | "en"; onEdit: () => void; onTrack: () => void }) {
  const { t } = useLocale();
  const origin = facilityFor(draft.originId);
  const destination = facilityFor(draft.destinationId);
  return <div className={styles.tableWrap}><table><thead><tr><th>{t("SOLICITUD", "REQUEST")}</th><th>{t("RUTA", "ROUTE")}</th><th>{t("CARGA", "CARGO")}</th><th>{t("ESTADO", "STATUS")}</th><th>{t("RECOGIDA", "PICKUP")}</th><th>{t("ACCIÓN", "ACTION")}</th></tr></thead><tbody><tr><th scope="row">V2-LOCAL-01<small>{t("En este dispositivo", "On this device")}</small></th><td><strong>{cityLabel(origin, locale)} → {cityLabel(destination, locale)}</strong><small>{countryLabel(origin.countryCode, locale)} → {countryLabel(destination.countryCode, locale)}</small></td><td>{draft.cargoDescription} · {draft.quantity} × {draft.unitWeightKg.toLocaleString(locale === "es" ? "es-PE" : "en-US")} kg</td><td><span className={styles.statusPill}>{draft.savedForReview ? t("Guardado para revisar", "Saved for review") : t("Borrador", "Draft")}</span></td><td>{draft.pickupDate || t("Sin registrar", "Not recorded")}</td><td><div className={styles.tableActions}><button type="button" onClick={onEdit}>{t("Revisar", "Review")}</button><button type="button" onClick={onTrack}>{t("Ver mapa", "View map")} →</button></div></td></tr></tbody></table></div>;
}

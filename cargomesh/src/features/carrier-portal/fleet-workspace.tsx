"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Download, Fuel, Gauge, Info, LayoutGrid, List, MapPin, RefreshCw, Search, ShieldCheck, Truck, Wrench } from "lucide-react";
import { useLocale } from "@/features/i18n/locale-provider";
import { ContentMotion } from "@/features/product-motion/content-motion";
import { portalErrorCopy } from "./api";
import { loadFleet } from "./fleet-client";
import { fleetPhotos, fleetReferencePhoto } from "./fleet-photos";
import { EXAMPLE_AS_OF, filterFleet, fleetSummary, remainingRangeKm, matchesFleetFilter, type FleetFilter, type FleetSort, type FleetStatus, type FleetVehicle } from "./fleet-model";
import { applyDemoCommand, createFleetDemo, demoFleetVehicles, type DemoCommand } from "./fleet-demo";
import { useFleetDemo } from "./use-fleet-demo";
import { FleetAssignmentBoard, FleetCoverage, FleetJourneySummary } from "./fleet-operational-views";
import { DriverPortrait, DriverProfile } from "./driver-profile";
import { fleetPortraitPhotos } from "./fleet-portrait-photos";
import {useOperations} from "./use-operations";
import {CarrierSites} from "./carrier-sites";
import {TruckRegistration} from "./truck-registration";
import {vehicleCarrierId} from "./operations-model";
import {TruckInspection} from "./truck-inspection";
import {inspectFleet} from "./truck-inspection-model";
import s from "./fleet.module.css";

const filters: { id: FleetFilter; es: string; en: string }[] = [
  { id: "all", es: "Todos", en: "All" }, { id: "service", es: "En servicio", en: "In service" },
  { id: "maintenance", es: "En taller", en: "In shop" }, { id: "due", es: "Servicio próximo", en: "Service due" },
  { id: "fuel", es: "Combustible bajo", en: "Low fuel" }, { id: "reefer", es: "Refrigerados", en: "Reefers" },
];
const statusLabels: Record<FleetStatus, [string, string]> = { AVAILABLE: ["Disponible (registro)", "Available (record)"],
  IN_SERVICE: ["En servicio", "In service"], MAINTENANCE: ["En taller", "In shop"], OUT_OF_SERVICE: ["Fuera de servicio", "Out of service"] };
function VehicleStatus({ vehicle }: { vehicle: FleetVehicle }) {
  const { t } = useLocale();
  return <span className={s.status} data-status={vehicle.status}><span aria-hidden="true" />{t(...statusLabels[vehicle.status])}</span>;
}
function FuelValue({ value }: { value: number | null }) {
  const { t } = useLocale();
  return <><strong>{value === null ? "—" : value + "%"}</strong>{value === null ? <small>{t("Sin lectura", "No reading")}</small>
    : <meter className={s.fuelMeter} min={0} max={100} low={25} high={100} optimum={80} value={value} aria-label={t("Nivel de combustible", "Fuel level")} />}</>;
}
function ServiceValue({ vehicle }: { vehicle: FleetVehicle }) {
  const { t, localeTag } = useLocale();
  return vehicle.maintenance ? <><strong className={s.serviceDate}>{new Date(vehicle.maintenance.startsAt).toLocaleDateString(localeTag, { day: "numeric", month: "short" })}</strong>
    <small>{vehicle.maintenance.kind}</small></> : <><strong>—</strong><small>{t("Sin registro", "No record")}</small></>;
}
function ReferencePhoto({ vehicle, eager = false }: { vehicle: FleetVehicle; eager?: boolean }) {
  const { t } = useLocale();
  const photo = fleetReferencePhoto(vehicle);
  return <>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={photo.src} width={1200} height={800} loading={eager ? "eager" : "lazy"} decoding="async"
      style={{ objectPosition: photo.position }} alt={t(photo.es, photo.en) + t(" · fotografía de referencia", " · reference photograph")} />
    <span className={s.imageCaption}>{vehicle.photoDataUrl?t("Foto del camión","Truck photo"):t("Foto de referencia", "Reference photo")}</span>
  </>;
}
function PhotoCredits() {
  const { t } = useLocale();
  return <details className={s.photoCredits}>
    <summary>{t("Créditos de las fotografías", "Photograph credits")}</summary>
    <p>{t("Las fotografías ilustran tipos de camión; no muestran los vehículos registrados. Imágenes reducidas y convertidas a WebP, con encuadre adaptado a las tarjetas.", "The photographs illustrate truck types; they do not depict registered vehicles. Images are resized and converted to WebP, with framing adapted to the cards.")}</p>
    <ul>{Object.values(fleetPhotos).map(photo => <li key={photo.src}>
      <a href={photo.sourceUrl} target="_blank" rel="noreferrer">{t(photo.es, photo.en)}</a>
      <span> · {photo.author} · </span><a href={photo.licenseUrl} target="_blank" rel="noreferrer">{photo.license}</a>
    </li>)}</ul>
    <p>{t("Retratos de stock para las fichas de conductores; los nombres y datos de la demo no identifican a las personas fotografiadas.","Stock portraits for driver profiles; demo names and data do not identify the people photographed.")}</p>
    <ul>{fleetPortraitPhotos.map(photo=><li key={photo.id}><a href={photo.sourceUrl} target="_blank" rel="noreferrer">{photo.author}</a> · <a href={photo.licenseUrl} target="_blank" rel="noreferrer">{photo.license}</a></li>)}</ul>
  </details>;
}
function VehicleFacts({ vehicle }: { vehicle: FleetVehicle }) {
  const { t, localeTag } = useLocale();
  const date = (value: string | null) => value ? new Date(value.length === 10 ? value + "T12:00:00Z" : value).toLocaleDateString(localeTag) : "—";
  return <>
    <dl className={s.vehicleFacts}>
      <div><dt>{t("Placa", "Plate")}</dt><dd>{vehicle.plate || "—"}</dd></div>
      <div><dt>{t("Capacidad de carga", "Load capacity")}</dt><dd>{vehicle.capacityKg.toLocaleString(localeTag)} kg</dd></div>
      <div><dt>{t("Fecha de registro", "Registration date")}</dt><dd>{date(vehicle.registeredAt)}</dd></div>
      <div><dt>{t("Alta en CargoMesh", "Added to CargoMesh")}</dt><dd>{date(vehicle.createdAt)}</dd></div>
    </dl>
    <p className={s.cardDescription}>{vehicle.description || t("Descripción sin registrar", "Description not recorded")}</p>
    <div className={s.statusContext}><span>{t("Último estado", "Latest state")}</span><VehicleStatus vehicle={vehicle} />
      <p>{vehicle.statusReason || t("Sin descripción de estado", "No state description")}</p>
      <dl><div><dt>{t("Estado desde", "State since")}</dt><dd>{date(vehicle.statusChangedAt)}</dd></div>
        <div><dt>{t("Última modificación", "Last modified")}</dt><dd>{vehicle.updatedAt ? new Date(vehicle.updatedAt).toLocaleString(localeTag, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}</dd></div></dl>
    </div>
  </>;
}
function RangeValue({ vehicle }: { vehicle: FleetVehicle }) {
  const { t, localeTag } = useLocale();
  const range = remainingRangeKm(vehicle);
  return <small className={s.rangeValue}>{range === null ? t("Autonomía sin datos", "Range unavailable") : "≈ " + range.toLocaleString(localeTag) + " km · " + t("autonomía estimada", "estimated range")}</small>;
}
function VehicleCard({ vehicle, open, openDriver, buttonRef, list }: { vehicle: FleetVehicle; open: () => void; openDriver:()=>void; buttonRef: (node: HTMLButtonElement | null) => void; list: boolean }) {
  const { t } = useLocale();
  return <article className={`${s.vehicleCard} ${list ? s.listCard : ""}`} data-body={vehicle.variant}>
    <button className={s.cardOpen} ref={buttonRef} onClick={open} aria-label={t("Ver camión ", "View truck ") + vehicle.code} aria-describedby={`fleet-model-${vehicle.id}`} />
    <div className={s.truckImage} data-variant={vehicle.variant}>
      <div className={s.imageBadges}><VehicleStatus vehicle={vehicle} />{vehicle.conditionScore !== null ? <span className={s.condition}><Gauge size={14} aria-hidden="true" />{t("Condición", "Condition")} {vehicle.conditionScore}</span> : null}</div>
      <ReferencePhoto vehicle={vehicle} />
    </div>
    <div className={s.cardBody}><div className={s.identity}><div><h2>{vehicle.code}</h2><p id={`fleet-model-${vehicle.id}`}>{vehicle.model || vehicle.body}</p></div>
      <span className={s.cardPlate}>{vehicle.plate??"—"}</span></div>
      {vehicle.driverProfile?<button className={s.driverPreview} onClick={openDriver} aria-label={t("Ver conductor: ","View driver: ")+vehicle.driverProfile.name}>
        <DriverPortrait driver={vehicle.driverProfile}/><span><strong>{vehicle.driverProfile.name}</strong><small>{vehicle.driverProfileRole==="regular"?t("Habitual","Regular"):t("Asignado","Assigned")} · {vehicle.driverProfile.licenseClass} · {vehicle.driverProfile.experienceYears} {t("años","years")}</small></span><ArrowRight size={15} aria-hidden="true"/>
      </button>:null}
      <span className={s.cardPrompt}>{t("Ver detalles del camión", "View truck details")}<ArrowRight size={17} aria-hidden="true" /></span>
    </div>
  </article>;
}

export function FleetWorkspace() {
  const { t, locale, localeTag } = useLocale();
  const [source, setSource] = useState<"example" | "service">("example"), [filter, setFilter] = useState<FleetFilter>("all"), [search, setSearch] = useState(""), [sort, setSort] = useState<FleetSort>("attention"), [layout, setLayout] = useState<"grid" | "list">("grid");
  const [selected, setSelected] = useState<string | null>(null), [reference, setReference] = useState("");
  const [inspectionId,setInspectionId]=useState<string|null>(null);
  const [driverView,setDriverView]=useState(false),[driverFromDetail,setDriverFromDetail]=useState(false);
  const [view, setView] = useState<"vehicles" | "coverage" | "assignment" | "carriers" | "register">("vehicles");
  const operations=useOperations();
  const { demo, setDemo, ready, storageAvailable } = useFleetDemo(operations.inventory,operations.ready);
  const [result, setResult] = useState<Awaited<ReturnType<typeof loadFleet>> | null>(null), [loading, setLoading] = useState(false), [error, setError] = useState("");
  const [checkedAt, setCheckedAt] = useState(() => Date.now());
  const request = useRef<AbortController | null>(null), cardButtons = useRef(new Map<string, HTMLButtonElement>()), returnTo = useRef<string | null>(null);
  const examples = useMemo(() => demoFleetVehicles(demo,operations.inventory), [demo,operations.inventory]);
  useEffect(()=>{const sync=()=>{const parts=window.location.hash.split("/"),service=parts[2]==="service",suffix=parts[service?3:2],id=parts[service?4:3];setSource(service?"service":"example");if(suffix==="vehicle"&&id){setView("vehicles");setSelected(decodeURIComponent(id));setDriverView(false);}else if(["vehicles","coverage","assignment","carriers","register"].includes(suffix)) {setView(suffix as typeof view);setSelected(null);}else if(!suffix){setView("vehicles");setSelected(null);}};sync();window.addEventListener("hashchange",sync);return()=>window.removeEventListener("hashchange",sync);},[]);
  const changeView=(next:typeof view)=>{setSelected(null);setView(next);window.location.hash="/fleet/"+(source==="service"?"service/":"")+next;};
  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => { if (!selected && returnTo.current) { cardButtons.current.get(returnTo.current)?.focus(); returnTo.current = null; } }, [selected]);
  useEffect(()=>{request.current?.abort();setLoading(false);setError("");setFilter("all");setSearch("");},[source]);
  const connect = async () => {
    request.current?.abort(); const controller = new AbortController(); request.current = controller;
    setResult(null); setSelected(null); setError(""); setLoading(true);
    try { const loaded = await loadFleet(reference.trim(), controller.signal); if (!controller.signal.aborted) { setResult(loaded); setCheckedAt(Date.now()); } }
    catch (failure) { if (!controller.signal.aborted) setError(portalErrorCopy(failure, locale === "es")); }
    finally { if (!controller.signal.aborted) setLoading(false); }
  };
  const vehicles = source === "example" ? examples : result?.vehicles ?? [];
  const inspected=vehicles.find(vehicle=>vehicle.id===inspectionId);
  const inspection=useMemo(()=>inspected?inspectFleet(inspected,operations.state.carriers):null,[inspected,operations.state.carriers]);
  useEffect(()=>setInspectionId(null),[source,view,selected]);
  const now = source === "example" ? Date.parse(EXAMPLE_AS_OF) : checkedAt;
  const visible = filterFleet(vehicles, filter, search, sort, now);
  const vehicle = selected ? vehicles.find(value => value.id === selected) : null;
  const summary = fleetSummary(vehicles, now);
  const registerButton = (id: string, node: HTMLButtonElement | null) => { if (node) cardButtons.current.set(id, node); else cardButtons.current.delete(id); };
  const command = (value: DemoCommand) => { const next = applyDemoCommand(demo, value,undefined,operations.inventory); if (!next.error) setDemo(next.state); return next.error; };
  const open = (id: string) => { returnTo.current = id; setDriverView(false); setSelected(id); };
  const openDriver=(id:string,fromDetail=false)=>{returnTo.current=id;setSelected(id);setDriverView(true);setDriverFromDetail(fromDetail);};
  const back = () => { setSelected(null); if(window.location.hash.includes("/vehicle/")) window.location.hash="/fleet/"+(source==="service"?"service/":"")+"vehicles"; };
  return <div className={s.workspace}>
    <div className={s.sourceBar}>
      <span className={s.provenance}><Info size={15} aria-hidden="true" />{source === "example" ? t("Sin conexión GPS", "No GPS connection") : t("Registros autorizados · Sin telemetría conectada", "Authorized records · No connected telemetry")}</span>
    </div>
    {source === "example" ? !vehicle ? <p className={s.sourceNote}>{t("Consulta los camiones, sus zonas de trabajo y la asignación de conductores.", "View trucks, work zones and driver assignments.")}</p> : null : <form className={s.connection} onSubmit={event => { event.preventDefault(); void connect(); }}>
      <label>{t("Referencia del transportista", "Carrier reference")}<input value={reference} onChange={event => setReference(event.target.value)} autoComplete="off" placeholder={t("Referencia entregada por el administrador", "Reference supplied by the administrator")} disabled={loading} /></label>
      <button className={s.primary} disabled={loading} type="submit"><RefreshCw size={16} aria-hidden="true" />{loading ? t("Consultando…", "Loading…") : t("Consultar flota", "Fetch fleet")}</button>
      <small>{t("Se requiere tu sesión y permiso de lectura. Esta vista no modifica vehículos ni asignaciones.", "Your session and read permission are required. This view does not change vehicles or assignments.")}</small></form>}
    {error ? <div className={s.error} role="alert"><ShieldCheck size={20} aria-hidden="true" /><p>{error}</p><a href="/login">{t("Iniciar sesión", "Sign in")} →</a></div> : null}
    {result?.gaps || result?.truncated ? <p className={s.sourceNote} role="status">{t("Consulta parcial: algunas referencias no están disponibles o quedan más páginas. Los conteos pertenecen a los registros consultados.", "Partial read: some related records are unavailable or more pages remain. Counts cover the retrieved records.")}</p> : null}
    {!vehicle && view!=="register" ? <>
        <div className={s.summary}>
          <div className={s.summaryPrimary}><Truck size={22} aria-hidden="true" /><span>{t("Total de camiones", "Total trucks")}</span><strong>{source === "service" && !result ? "—" : summary.total}</strong><small>{source === "example" ? t("Registrados en la flota", "Fleet records") : t("Registros consultados", "Retrieved records")}</small></div>
          <div><ShieldCheck size={22} aria-hidden="true" /><span>{t("Estado normal", "Normal operating state")}</span><strong>{source === "service" && !result ? "—" : summary.normal}</strong><small>{t("Disponibles o en servicio", "Available or in service")}</small></div>
          <div><Wrench size={22} aria-hidden="true" /><span>{t("En mantenimiento", "In maintenance")}</span><strong>{source === "service" && !result ? "—" : summary.maintenance}</strong><small>{t("Estado actual registrado", "Current recorded state")}</small></div>
          <div><Gauge size={22} aria-hidden="true" /><span>{t("Mantenimiento · último año", "Maintenance · past year")}</span><strong>{summary.annualPercent === null ? "—" : summary.annualPercent.toLocaleString(localeTag, { maximumFractionDigits: 1 }) + "%"}</strong><small>{summary.annualPercent === null ? t("Historial anual no disponible", "Annual history unavailable") : summary.maintained + t(" de ", " of ") + summary.total + t(" camiones con mantenimiento", " trucks with maintenance")}</small></div>
        </div>
        <p className={s.kpiNote}>{t("Estado normal no confirma disponibilidad para reservar. Indicador anual: camiones con al menos un mantenimiento completado / total de camiones, del ", "Normal state does not confirm booking availability. Annual indicator: trucks with at least one completed maintenance / total trucks, from ")}{new Date(summary.startsAt).toLocaleDateString(localeTag)} — {new Date(summary.endsAt).toLocaleDateString(localeTag)}.</p>
        <div className={s.viewSwitch} role="group" aria-label={t("Secciones de flota", "Fleet sections")}>
          <button aria-pressed={view === "vehicles"} onClick={() => changeView("vehicles")}><Truck size={17} aria-hidden="true" />{t("Camiones", "Trucks")}</button>
          <button aria-pressed={view === "coverage"} onClick={() => changeView("coverage")}><MapPin size={17} aria-hidden="true" />{t("Zonas y destinos", "Areas and destinations")}</button>
          <button aria-pressed={view === "assignment"} disabled={source !== "example"} onClick={() => changeView("assignment")}><List size={17} aria-hidden="true" />{t("Asignación de conductores", "Driver assignment")}</button>
          {source==="example"?<><button aria-pressed={view==="carriers"} onClick={()=>changeView("carriers")}><MapPin size={17}/>{t("Sedes y cobertura","Depots and coverage")}</button><button onClick={()=>changeView("register")}><Truck size={17}/>{t("Nuevo camión","New truck")}</button></>:null}
        </div>
    </> : null}
    <ContentMotion identity={selected?`${selected}:${driverView?"driver":"truck"}`:view} focusOnChange>
      {vehicle ? driverView&&vehicle.driverProfile?<DriverProfile vehicle={vehicle} back={()=>driverFromDetail?setDriverView(false):back()} openTruck={()=>setDriverView(false)}/>:<VehicleDetail vehicle={vehicle} back={back} openDriver={()=>openDriver(vehicle.id,true)} /> : source === "service" && !result ? <section className={s.empty} aria-busy={loading}><Truck size={32} aria-hidden="true" /><h2>{loading ? t("Consultando la flota…", "Fetching the fleet…") : t("Consulta los vehículos registrados", "Fetch registered vehicles")}</h2><p>{t("Los datos del servicio aparecerán al completar una consulta autorizada.", "Service data appears after an authorized read.")}</p></section>
        : view==="register"&&source==="example"?<TruckRegistration back={()=>changeView("vehicles")} registered={id=>{window.location.hash="/fleet/vehicle/"+id;}}/>
        : view==="carriers"&&source==="example"?<CarrierSites/>
        : view === "coverage" ? <FleetCoverage vehicles={vehicles} open={open} registerButton={registerButton} />
        : view === "assignment" && source === "example" ? <FleetAssignmentBoard state={demo} vehicles={vehicles} command={command} reset={() => setDemo(createFleetDemo(operations.inventory))} ready={ready} storageAvailable={storageAvailable} open={open} registerButton={registerButton} /> : <>
        <div className={s.directoryHeading}><div><h2 tabIndex={-1}>{t("Directorio de vehículos", "Vehicle directory")}</h2><p>{t("Localiza un camión y consulta su contexto operativo.", "Find a truck and inspect its operating context.")}</p></div><div className={s.layoutSwitch} role="group" aria-label={t("Vista de vehículos", "Vehicle view")}><button aria-label={t("Tarjetas", "Cards")} aria-pressed={layout === "grid"} onClick={() => setLayout("grid")}><LayoutGrid size={18} aria-hidden="true" /></button><button aria-label={t("Lista", "List")} aria-pressed={layout === "list"} onClick={() => setLayout("list")}><List size={18} aria-hidden="true" /></button></div></div>
        <div className={s.toolbar}><label className={s.search}><span>{t("Buscar camión, conductor o ubicación", "Search truck, driver or location")}</span><div><Search size={18} aria-hidden="true" /><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder={t("Ej. CM-204, Callao…", "E.g. CM-204, Callao…")} /></div></label><label className={s.sort}>{t("Ordenar por", "Sort by")}<select value={sort} onChange={event => setSort(event.target.value as FleetSort)}><option value="attention">{t("Atención necesaria", "Attention needed")}</option><option value="code">{t("Código del vehículo", "Vehicle code")}</option><option value="fuel">{t("Menor combustible", "Lowest fuel")}</option></select></label></div>
        <div className={s.filters} role="group" aria-label={t("Filtros de flota", "Fleet filters")}>{filters.map(value => <button key={value.id} aria-pressed={filter === value.id} onClick={() => setFilter(value.id)}>{filter === value.id ? <Check size={14} aria-hidden="true" /> : null}{t(value.es, value.en)}<span>{vehicles.filter(vehicle => matchesFleetFilter(vehicle, value.id, now)).length}</span></button>)}</div>
        <p className={s.results} role="status" aria-live="polite">{visible.length} {t("de", "of")} {vehicles.length} {t("vehículos", "vehicles")} · {source === "example" ? t("Actualizado el 8 oct. 2026", "Updated Oct 8, 2026") : result?.readAt ? t("Consultado: ", "Fetched: ") + new Date(result.readAt).toLocaleString(localeTag) : ""}</p>
        {visible.length ? <div className={layout === "grid" ? s.vehicleGrid : s.vehicleList}>{visible.map(vehicle => <VehicleCard key={vehicle.id} vehicle={vehicle} list={layout === "list"} open={() => setInspectionId(vehicle.id)} openDriver={()=>openDriver(vehicle.id)} buttonRef={node => registerButton(vehicle.id, node)} />)}</div>
          : <section className={s.empty}><Search size={30} aria-hidden="true" /><h3>{vehicles.length ? t("Sin coincidencias", "No matches") : t("No hay vehículos de carretera en esta consulta", "No road vehicles in this read")}</h3><p>{t("Prueba otro filtro o término de búsqueda.", "Try another filter or search term.")}</p><button onClick={() => { setFilter("all"); setSearch(""); }}>{t("Limpiar filtros", "Clear filters")}</button></section>}
      </>}
    </ContentMotion>
    {view!=="register"&&view!=="carriers"?<><p className={s.photoNote}>{t("Fotografías de referencia: ilustran el tipo de camión, no el vehículo registrado.", "Reference photographs: they illustrate the truck type, not the registered vehicle.")}</p>
    <PhotoCredits /></>:null}
    {inspection?<TruckInspection key={inspection.id} context={inspection} onClose={()=>setInspectionId(null)}/>:null}
  </div>;
}

function VehicleDetail({ vehicle, back, openDriver }: { vehicle: FleetVehicle; back: () => void; openDriver:()=>void }) {
  const { t, localeTag } = useLocale();
  const operations=useOperations(),carrier=vehicle.source==="EXAMPLE"?operations.state.carriers.find(c=>c.id===vehicleCarrierId(vehicle)):null;
  const download = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ ...vehicle, notice: vehicle.source === "EXAMPLE" ? "SIMULATED LOCAL EXAMPLE — NO REAL TELEMETRY" : "Recorded service data. Null metrics are unavailable. No circulation or capacity confirmation." }, null, 2)], { type: "application/json" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `CargoMesh-${vehicle.code}.json`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <section className={s.detail}>
    <div className={s.detailHeading}><div><button onClick={back} className={s.back}><ArrowLeft size={18} aria-hidden="true" />{t("Volver a la flota", "Back to fleet")}</button><p className={s.detailTrail}>{t("Flota / Camiones / ", "Fleet / Trucks / ")}{vehicle.code}</p><h2 tabIndex={-1}>{vehicle.model || vehicle.body} <span>· {vehicle.code}</span></h2></div><button onClick={download}><Download size={16} aria-hidden="true" />{t("Descargar ficha", "Download record")}</button></div>
    <div className={s.detailHero}><div className={s.detailVisual}><ReferencePhoto vehicle={vehicle} eager /><span className={s.detailCode}>{vehicle.code}</span></div><div className={s.detailInfo}><div className={s.detailStatusLine}><VehicleStatus vehicle={vehicle} />{vehicle.conditionScore !== null ? <span className={s.condition}><Gauge size={14} aria-hidden="true" />{t("Condición", "Condition")} {vehicle.conditionScore}/100</span> : null}</div><p className={s.provenance}>{t("Última actualización: ", "Last updated: ")}{new Date(vehicle.updatedAt).toLocaleString(localeTag)}</p><dl>
      <div><dt>{vehicle.driverProfileRole==="regular"?t("Conductor habitual","Regular driver"):t("Conductor asignado", "Assigned driver")}</dt><dd>{vehicle.driverProfile?<button className={s.driverLink} onClick={openDriver}><DriverPortrait driver={vehicle.driverProfile}/><span>{vehicle.driverProfile.name}</span><ArrowRight size={14} aria-hidden="true"/></button>:vehicle.driver || t("Sin registro", "Not recorded")}</dd></div>
      <div><dt>{t("Última posición", "Last position")}</dt><dd>{vehicle.location || t("No disponible", "Unavailable")}</dd></div>
      <div><dt>{t("Velocidad", "Speed")}</dt><dd>{vehicle.speedKmh === null ? t("No disponible", "Unavailable") : vehicle.speedKmh + " km/h"}</dd></div>
      <div><dt>{t("Placa", "Plate")}</dt><dd>{vehicle.plate || "—"}</dd></div><div><dt>{t("Carrocería", "Body type")}</dt><dd>{vehicle.body}</dd></div><div><dt>{t("Base", "Home base")}</dt><dd>{vehicle.depot || t("Sin registro", "Not recorded")}</dd></div>
    </dl>{vehicle.coordinates ? <a className={s.mapLink} href={`https://www.google.com/maps/search/?api=1&query=${vehicle.coordinates.lat},${vehicle.coordinates.lng}`} target="_blank" rel="noreferrer"><MapPin size={16} aria-hidden="true" />{t("Ver posición registrada", "View recorded position")} ↗</a> : null}<small>{vehicle.source === "SERVICE" ? t("La posición registrada no incluye fecha de observación; no confirma movimiento actual.", "The recorded position has no observation timestamp; it does not confirm current motion.") : ""}</small></div></div>
    <div className={s.detailMetrics}>
      <div><Gauge size={18} aria-hidden="true" /><span>{t("Odómetro", "Odometer")}</span><strong>{vehicle.odometerKm === null ? "—" : vehicle.odometerKm.toLocaleString(localeTag) + " km"}</strong><small>{t("Lectura registrada", "Recorded reading")}</small></div>
      <div><Fuel size={18} aria-hidden="true" /><span>{t("Combustible", "Fuel")}</span><FuelValue value={vehicle.fuelPercent} /><RangeValue vehicle={vehicle} /></div>
      <div><Truck size={18} aria-hidden="true" /><span>{t("Utilización · 30 días", "Utilization · 30 days")}</span><strong>{vehicle.utilizationPercent === null ? "—" : vehicle.utilizationPercent + "%"}</strong>{vehicle.utilizationPercent !== null ? <meter className={s.utilizationMeter} min={0} max={100} value={vehicle.utilizationPercent} aria-label={t("Utilización del camión en 30 días", "Truck utilization over 30 days")} /> : null}{vehicle.source === "SERVICE" ? <small>{t("Sin medición", "No measurement")}</small> : null}</div>
      <div><Gauge size={18} aria-hidden="true" /><span>{t("Costo por km", "Cost per km")}</span><strong>{vehicle.costPerKm === null ? "—" : "S/ " + vehicle.costPerKm.toFixed(2)}</strong><small>{vehicle.source === "EXAMPLE" ? t("PEN", "PEN") : t("Sin registro", "No record")}</small></div>
      <div><Wrench size={18} aria-hidden="true" /><span>{t("Próximo servicio", "Next service")}</span><ServiceValue vehicle={vehicle} /></div>
    </div>
    {carrier?<section className={s.panel}><h3>Carrier y sede</h3><p><strong>{carrier.name}</strong> · {vehicle.depot}</p><a href="#/fleet/carriers">Consultar sedes y alcance</a>{vehicle.volumeM3!==undefined?<dl className={s.vehicleFacts}><div><dt>Año del modelo</dt><dd>{vehicle.modelYear}</dd></div><div><dt>Volumen útil</dt><dd>{vehicle.volumeM3} m³</dd></div><div><dt>Seguro vigente hasta</dt><dd>{vehicle.insuranceUntil}</dd></div><div><dt>Revisión técnica vigente hasta</dt><dd>{vehicle.inspectionUntil}</dd></div></dl>:null}</section>:null}
    <EngineChart key={vehicle.id} vehicle={vehicle} />
    <div className={s.detailBottom}><section className={s.panel}><div className={s.panelTitle}><Truck size={21} aria-hidden="true" /><h3>{t("Registro y estado", "Registration and state")}</h3></div><VehicleFacts vehicle={vehicle} /></section>
      <section className={s.panel}><div className={s.panelTitle}><MapPin size={21} aria-hidden="true" /><h3>{t("Zonas y destino", "Areas and destination")}</h3></div><FleetJourneySummary vehicle={vehicle} />{vehicle.source === "SERVICE" ? <small>{t("Solo se muestran destinos y zonas vinculados por el servicio.", "Only destinations and areas linked by the service are shown.")}</small> : null}</section></div>
    <div className={s.detailBottom}><section className={s.panel}><div className={s.panelTitle}><Wrench size={21} aria-hidden="true" /><h3>{t("Mantenimiento", "Maintenance")}</h3></div>{vehicle.maintenance ? <><strong>{vehicle.maintenance.kind}</strong><p>{new Date(vehicle.maintenance.startsAt).toLocaleString(localeTag)} — {new Date(vehicle.maintenance.endsAt).toLocaleString(localeTag)}</p><span className={s.maintenanceTag}>{vehicle.maintenance.status === "IN_PROGRESS" ? t("En progreso", "In progress") : t("Programado", "Scheduled")}</span></> : <p>{t("No hay un mantenimiento próximo en los registros consultados.", "No upcoming maintenance in the retrieved records.")}</p>}</section>
      <section className={s.panel}><div className={s.panelTitle}><ShieldCheck size={21} aria-hidden="true" /><h3>{t("Datos del vehículo", "Vehicle data")}</h3></div><p><strong>{vehicle.capacityKg.toLocaleString(localeTag)} kg</strong> · {t("Capacidad útil declarada", "Declared useful capacity")}</p><p>{t("La capacidad declarada y el estado operativo no confirman disponibilidad. Requiere comprobar reservas, mantenimiento y reposicionamiento.", "Declared capacity and operating status do not confirm availability. Reservations, maintenance and repositioning must be checked.")}</p>{vehicle.source === "SERVICE" ? <small>{t("Fuente: registros del servicio V2 consultados con tu sesión.", "Source: V2 service records retrieved using your session.")}</small> : null}</section></div>
  </section>;
}

function EngineChart({ vehicle }: { vehicle: FleetVehicle }) {
  const { t, localeTag } = useLocale();
  const [period, setPeriod] = useState<7 | 14>(14), [active, setActive] = useState<string | null>(null);
  const days = vehicle.engineDays.slice(-period), highlighted = days.find(day => day.date === active);
  const total = days.reduce((sum, day) => sum + day.driving + day.idle, 0);
  return <section className={`${s.panel} ${s.chartPanel}`}><div className={s.chartHeading}><div><h3>{t("Horas de motor por día", "Engine hours per day")}</h3><p>{days.length ? total.toLocaleString(localeTag, { maximumFractionDigits: 1 }) + " h" : t("Sin lecturas de motor disponibles", "No engine readings available")}</p></div><div className={s.chartPeriods} role="group" aria-label={t("Periodo del gráfico", "Chart period")}><button aria-pressed={period === 7} onClick={() => { setPeriod(7); setActive(null); }}>7 {t("días", "days")}</button><button aria-pressed={period === 14} onClick={() => { setPeriod(14); setActive(null); }}>14 {t("días", "days")}</button></div></div>
    {days.length ? <><div className={s.legend}><span><i />{t("Conducción", "Driving")}</span><span><i />{t("Motor en ralentí", "Engine idle")}</span><span><i />{t("Día seleccionado", "Selected day")}</span></div><div className={s.chart}>
      <div className={s.axis} aria-hidden="true">{[12, 9, 6, 3, 0].map(value => <span key={value}>{value} h</span>)}</div><div className={s.plot} data-days={days.length} style={{ gridTemplateColumns: `repeat(${days.length},minmax(0,1fr))` }}>{days.map(day => <button key={day.date} className={s.barColumn} aria-pressed={active === day.date} onMouseEnter={() => setActive(day.date)} onFocus={() => setActive(day.date)} onClick={() => setActive(day.date)} aria-label={new Date(day.date + "T12:00:00Z").toLocaleDateString(localeTag) + ": " + day.driving + " h " + t("conducción", "driving") + ", " + day.idle + " h " + t("ralentí", "idle")}>
        <span className={s.barTrack}><span className={s.stackedBar} style={{ height: `${(day.driving + day.idle) / 12 * 100}%` }}><i className={s.idleBar} style={{ flex: day.idle }} /><i className={s.drivingBar} style={{ flex: day.driving }} /></span></span><span className={s.barDate}>{new Date(day.date + "T12:00:00Z").toLocaleDateString(localeTag, { day: "numeric", month: "short" })}</span></button>)}</div></div>
      <p className={s.chartReadout} aria-live="polite">{highlighted ? <>{new Date(highlighted.date + "T12:00:00Z").toLocaleDateString(localeTag)} · <strong>{highlighted.driving} h</strong> {t("conducción", "driving")} · <strong>{highlighted.idle} h</strong> {t("ralentí", "idle")}</> : t("Pasa el cursor o usa Tab para consultar cada día.", "Hover or use Tab to inspect each day.")}</p></>
      : <div className={s.chartEmpty}><Gauge size={28} aria-hidden="true" /><p>{t("No hay lecturas de conducción ni de ralentí disponibles.", "Driving and idle readings are unavailable.")}</p></div>}
  </section>;
}

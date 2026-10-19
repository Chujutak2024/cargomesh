"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Download, Fuel, Gauge, Info, LayoutGrid, List, MapPin, RefreshCw, Search, ShieldCheck, Truck, Wrench } from "lucide-react";
import { useLocale } from "@/features/i18n/locale-provider";
import { ContentMotion } from "@/features/product-motion/content-motion";
import type {CarrierPortalAccessV2} from '@/shared/schemas/v2/carrier-portal';
import { ConnectedFleet } from "./connected-fleet";
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
import { Button, SearchField, Select } from "@/components/ui";
import { truckDesigns } from "@/features/logistics-3d/visual-catalog";
import {VehicleCard,VehicleDetail,PhotoCredits} from "./fleet-presentation";
import s from "./fleet.module.css";

const filters: { id: FleetFilter; es: string; en: string }[] = [
  { id: "all", es: "Todos", en: "All" }, { id: "service", es: "En servicio", en: "In service" },
  { id: "maintenance", es: "En taller", en: "In shop" }, { id: "due", es: "Servicio próximo", en: "Service due" },
  { id: "fuel", es: "Combustible bajo", en: "Low fuel" }, { id: "reefer", es: "Refrigerados", en: "Reefers" },
];
function DemoFleetWorkspace() {
  const { t, locale, localeTag } = useLocale();
  const [source] = useState<"example" | "service">("example"), [filter, setFilter] = useState<FleetFilter>("all"), [search, setSearch] = useState(""), [sort, setSort] = useState<FleetSort>("attention"), [layout, setLayout] = useState<"grid" | "list">("grid");
  const [selected, setSelected] = useState<string | null>(null);
  const [inspectionId,setInspectionId]=useState<string|null>(null);
  const [driverView,setDriverView]=useState(false),[driverFromDetail,setDriverFromDetail]=useState(false);
  const [view, setView] = useState<"vehicles" | "coverage" | "assignment" | "carriers" | "register">("vehicles");
  const operations=useOperations();
  const { demo, setDemo, ready, storageAvailable } = useFleetDemo(operations.inventory,operations.ready);
  const cardButtons = useRef(new Map<string, HTMLButtonElement>()), returnTo = useRef<string | null>(null);
  const examples = useMemo(() => demoFleetVehicles(demo,operations.inventory), [demo,operations.inventory]);
  useEffect(()=>{const sync=()=>{const parts=window.location.hash.split("/"),explicit=parts[2]==="service"||parts[2]==="demo",suffix=parts[explicit?3:2],id=parts[explicit?4:3];if(suffix==="vehicle"&&id){setView("vehicles");setSelected(decodeURIComponent(id));setDriverView(false);}else if(["vehicles","coverage","assignment","carriers","register"].includes(suffix)) {setView(suffix as typeof view);setSelected(null);}else if(!suffix){setView("vehicles");setSelected(null);}};sync();window.addEventListener("hashchange",sync);return()=>window.removeEventListener("hashchange",sync);},[]);
  const changeView=(next:typeof view)=>{setSelected(null);setView(next);window.location.hash="/fleet/demo/"+next;};
  useEffect(() => { if (!selected && returnTo.current) { cardButtons.current.get(returnTo.current)?.focus(); returnTo.current = null; } }, [selected]);
  const vehicles = examples;
  const inspected=vehicles.find(vehicle=>vehicle.id===inspectionId);
  const inspection=useMemo(()=>inspected?inspectFleet(inspected,operations.state.carriers):null,[inspected,operations.state.carriers]);
  useEffect(()=>setInspectionId(null),[source,view,selected]);
  const now = Date.parse(EXAMPLE_AS_OF);
  const visible = filterFleet(vehicles, filter, search, sort, now);
  const vehicle = selected ? vehicles.find(value => value.id === selected) : null;
  const summary = fleetSummary(vehicles, now);
  const registerButton = (id: string, node: HTMLButtonElement | null) => { if (node) cardButtons.current.set(id, node); else cardButtons.current.delete(id); };
  const command = (value: DemoCommand) => { const next = applyDemoCommand(demo, value,undefined,operations.inventory); if (!next.error) setDemo(next.state); return next.error; };
  const open = (id: string) => { returnTo.current = id; setDriverView(false); setSelected(id); };
  const openDriver=(id:string,fromDetail=false)=>{returnTo.current=id;setSelected(id);setDriverView(true);setDriverFromDetail(fromDetail);};
  const back = () => { setSelected(null); if(window.location.hash.includes("/vehicle/")) window.location.hash="/fleet/demo/vehicles"; };
  return <div className={s.workspace}>
    <div className={s.sourceBar}><a href="/v2-workspace#/fleet/service/vehicles">Open connected fleet</a>
      <span className={s.provenance}><Info size={15} aria-hidden="true" />{source === "example" ? t("Demo local · Sin GPS", "Local demo · No GPS") : t("Registros autorizados · Sin telemetría conectada", "Authorized records · No connected telemetry")}</span>
    </div>
    {!vehicle?<p className={s.sourceNote}>{t("Consulta los camiones de ejemplo, sus zonas y asignaciones locales.", "Inspect example trucks, areas and local assignments.")}</p>:null}
    {!vehicle && view!=="register" ? <>
        <div className={s.summary}>
          <div className={s.summaryPrimary}><Truck size={22} aria-hidden="true" /><span>{t("Total de camiones", "Total trucks")}</span><strong>{summary.total}</strong><small>{source === "example" ? t("Registrados en la flota", "Fleet records") : t("Registros consultados", "Retrieved records")}</small></div>
          <div><ShieldCheck size={22} aria-hidden="true" /><span>{t("Estado normal", "Normal operating state")}</span><strong>{summary.normal}</strong><small>{t("Disponibles o en servicio", "Available or in service")}</small></div>
          <div><Wrench size={22} aria-hidden="true" /><span>{t("En mantenimiento", "In maintenance")}</span><strong>{summary.maintenance}</strong><small>{t("Estado actual registrado", "Current recorded state")}</small></div>
          <div><Gauge size={22} aria-hidden="true" /><span>{t("Mantenimiento · último año", "Maintenance · past year")}</span><strong>{summary.annualPercent === null ? "—" : summary.annualPercent.toLocaleString(localeTag, { maximumFractionDigits: 1 }) + "%"}</strong><small>{summary.annualPercent === null ? t("Historial anual no disponible", "Annual history unavailable") : summary.maintained + t(" de ", " of ") + summary.total + t(" camiones con mantenimiento", " trucks with maintenance")}</small></div>
        </div>
        <p className={s.kpiNote}>{t("Estado normal no confirma disponibilidad para reservar. Indicador anual: camiones con al menos un mantenimiento completado / total de camiones, del ", "Normal state does not confirm booking availability. Annual indicator: trucks with at least one completed maintenance / total trucks, from ")}{new Date(summary.startsAt).toLocaleDateString(localeTag)} — {new Date(summary.endsAt).toLocaleDateString(localeTag)}.</p>
        <div className={s.sectionNavigation}><div className={s.viewSwitch} role="group" aria-label={t("Secciones de flota", "Fleet sections")}>
          <Button variant="secondary" size="compact" aria-pressed={view === "vehicles"} onClick={() => changeView("vehicles")}><Truck size={17} aria-hidden="true" />{t("Camiones", "Trucks")}</Button>
          <Button variant="secondary" size="compact" aria-pressed={view === "coverage"} onClick={() => changeView("coverage")}><MapPin size={17} aria-hidden="true" />{t("Zonas y destinos", "Areas and destinations")}</Button>
          <Button variant="secondary" size="compact" aria-pressed={view === "assignment"} disabled={source !== "example"} onClick={() => changeView("assignment")}><List size={17} aria-hidden="true" />{t("Asignación de conductores", "Driver assignment")}</Button>
          {source==="example"?<><Button variant="secondary" size="compact" aria-pressed={view==="carriers"} onClick={()=>changeView("carriers")}><MapPin size={17}/>{t("Sedes y cobertura","Depots and coverage")}</Button></>:null}
        </div>{source==="example"?<Button variant="primary" onClick={()=>changeView("register")}><Truck size={17}/>{t("Nuevo camión","New truck")}</Button>:null}</div>
    </> : null}
    <ContentMotion identity={selected?`${selected}:${driverView?"driver":"truck"}`:view} focusOnChange animateOnMount>
      {vehicle ? driverView&&vehicle.driverProfile?<DriverProfile vehicle={vehicle} back={()=>driverFromDetail?setDriverView(false):back()} openTruck={()=>setDriverView(false)}/>:<VehicleDetail carrier={operations.state.carriers.find(c=>c.id===vehicleCarrierId(vehicle))??null} vehicle={vehicle} back={back} openDriver={()=>openDriver(vehicle.id,true)} /> : view==="register"&&source==="example"?<TruckRegistration back={()=>changeView("vehicles")} registered={id=>{window.location.hash="/fleet/demo/vehicle/"+id;}}/>
        : view==="carriers"&&source==="example"?<CarrierSites/>
        : view === "coverage" ? <FleetCoverage vehicles={vehicles} open={open} registerButton={registerButton} />
        : view === "assignment" && source === "example" ? <FleetAssignmentBoard state={demo} vehicles={vehicles} command={command} reset={() => setDemo(createFleetDemo(operations.inventory))} ready={ready} storageAvailable={storageAvailable} open={open} registerButton={registerButton} /> : <>
        <div className={s.directoryHeading}><div><h2 tabIndex={-1}>{t("Directorio de vehículos", "Vehicle directory")}</h2><p>{t("Localiza un camión y consulta su contexto operativo.", "Find a truck and inspect its operating context.")}</p></div><div className={s.layoutSwitch} role="group" aria-label={t("Vista de vehículos", "Vehicle view")}><Button variant="secondary" size="compact" aria-label={t("Tarjetas", "Cards")} aria-pressed={layout === "grid"} onClick={() => setLayout("grid")}><LayoutGrid size={18} aria-hidden="true" /></Button><Button variant="secondary" size="compact" aria-label={t("Lista", "List")} aria-pressed={layout === "list"} onClick={() => setLayout("list")}><List size={18} aria-hidden="true" /></Button></div></div>
        <div className={s.toolbar}><SearchField fieldClassName={s.search} label={t("Buscar camión, conductor o ubicación", "Search truck, driver or location")} value={search} onValueChange={setSearch} clearLabel={t("Limpiar búsqueda", "Clear search")} placeholder={t("Ej. CM-204, Callao…", "E.g. CM-204, Callao…")} shortcut/><Select fieldClassName={s.sort} label={t("Ordenar por", "Sort by")} value={sort} onChange={event => setSort(event.target.value as FleetSort)}><option value="attention">{t("Atención necesaria", "Attention needed")}</option><option value="code">{t("Código del vehículo", "Vehicle code")}</option><option value="fuel">{t("Menor combustible", "Lowest fuel")}</option></Select></div>
        <div className={s.filters} role="group" aria-label={t("Filtros de flota", "Fleet filters")}>{filters.map(value => <Button variant="secondary" size="compact" key={value.id} aria-pressed={filter === value.id} onClick={() => setFilter(value.id)}>{filter === value.id ? <Check size={14} aria-hidden="true" /> : null}{t(value.es, value.en)}<span>{vehicles.filter(vehicle => matchesFleetFilter(vehicle, value.id, now)).length}</span></Button>)}</div>
        <p className={s.results} role="status" aria-live="polite">{visible.length} {t("de", "of")} {vehicles.length} {t("vehículos", "vehicles")} · {t("Actualizado el 8 oct. 2026", "Updated Oct 8, 2026")}</p>
        {visible.length ? <div className={layout === "grid" ? s.vehicleGrid : s.vehicleList}>{visible.map(vehicle => <VehicleCard key={vehicle.id} vehicle={vehicle} list={layout === "list"} open={() => setInspectionId(vehicle.id)} openDriver={()=>openDriver(vehicle.id)} buttonRef={node => registerButton(vehicle.id, node)} />)}</div>
          : <section className={s.empty}><Search size={30} aria-hidden="true" /><h3>{vehicles.length ? t("Sin coincidencias", "No matches") : t("No hay vehículos de carretera en esta consulta", "No road vehicles in this read")}</h3><p>{t("Prueba otro filtro o término de búsqueda.", "Try another filter or search term.")}</p><Button variant="secondary" size="compact" onClick={() => { setFilter("all"); setSearch(""); }}>{t("Limpiar filtros", "Clear filters")}</Button></section>}
      </>}
    </ContentMotion>
    {view!=="register"&&view!=="carriers"?<><p className={s.photoNote}>{t("Fotografías de referencia: ilustran el tipo de camión, no el vehículo registrado.", "Reference photographs: they illustrate the truck type, not the registered vehicle.")}</p>
    <PhotoCredits /></>:null}
    {inspection?<TruckInspection key={inspection.id} context={inspection} onClose={()=>setInspectionId(null)}/>:null}
  </div>;
}

/** Connected and demo trees have separate hooks; local fixture state never backs the connected view. */
export function FleetWorkspace({carrierContext,demoOnly=false,demoAvailable=false}:{carrierContext?:CarrierPortalAccessV2;demoOnly?:boolean;demoAvailable?:boolean}={}){
 const [route,setRoute]=useState<{demo:boolean;section:string}|null>(null);
 useEffect(()=>{const sync=()=>{const parts=window.location.hash.replace(/^#\//,'').split('/');const explicit=parts[1]==='demo'||parts[1]==='service';setRoute({demo:parts[1]==='demo',section:parts[explicit?2:1]||'vehicles'});};sync();window.addEventListener('hashchange',sync);return()=>window.removeEventListener('hashchange',sync);},[]);
 if(!route)return <p role="status">Opening fleet…</p>;
 return <><div className={s.sourceBar}><a href="/vehicle-designs" target="_blank" rel="noopener noreferrer">3D design studio · {truckDesigns.length} truck designs / 5 depot layouts</a></div>{demoOnly?<DemoFleetWorkspace/>:<ConnectedFleet demoAvailable={demoAvailable} carrierContext={carrierContext} register={route.section==='register'} section={route.section} onNavigate={next=>{window.location.hash='/fleet/service/'+next;}}/>}</>;
}

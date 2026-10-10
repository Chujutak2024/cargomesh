"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Check, Flag, MapPin, RotateCcw, Route, Truck, UserRound, Wrench } from "lucide-react";
import { useLocale } from "@/features/i18n/locale-provider";
import { demoDrivers, demoStages, driverBusy, type DemoCommand, type DemoError, type DemoStage, type FleetDemoState } from "./fleet-demo";
import { fleetReferencePhoto } from "./fleet-photos";
import type { FleetVehicle } from "./fleet-model";
import s from "./fleet-operations.module.css";

type RegisterButton = (id: string, node: HTMLButtonElement | null) => void;
export function FleetJourneySummary({ vehicle }: { vehicle: FleetVehicle }) {
  const { t, localeTag } = useLocale();
  return <div className={s.journeySummary}>
    <div className={s.sectionLabel}><Route size={16} aria-hidden="true" />{t("Destino previsto", "Planned destination")}</div>
    {vehicle.journey ? <><div className={s.routePair}><span>{vehicle.journey.origin}</span><ArrowRight size={17} aria-hidden="true" /><strong>{vehicle.journey.destination}</strong></div>
      <p>{vehicle.journey.facility}</p><small>{t("Llegada prevista: ", "Planned arrival: ")}{new Date(vehicle.journey.arrivalAt).toLocaleString(localeTag, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</small></>
      : <p>{t("Sin destino vinculado a esta consulta", "No destination linked to this read")}</p>}
    <div className={s.sectionLabel}><MapPin size={16} aria-hidden="true" />{t("Zona de trabajo", "Working area")}</div>
    {vehicle.workingZones?.length ? <div className={s.zoneChips}>{vehicle.workingZones.map(zone => <span key={zone.id}>{zone.name}</span>)}</div>
      : <p>{t("Zonas sin registrar", "Areas not recorded")}</p>}
  </div>;
}

export function FleetCoverage({ vehicles, open, registerButton }: { vehicles: FleetVehicle[]; open: (id: string) => void; registerButton: RegisterButton }) {
  const { t } = useLocale();
  const [zoneId, setZoneId] = useState("all");
  const zones = useMemo(() => [...new Map(vehicles.flatMap(vehicle => vehicle.workingZones ?? []).map(zone => [zone.id, zone])).values()], [vehicles]);
  const visible = vehicles.filter(vehicle => vehicle.workingZones?.length && (zoneId === "all" || vehicle.workingZones.some(zone => zone.id === zoneId)));
  return <section>
    <header className={s.viewHeading}><div><h2 tabIndex={-1}>{t("Zonas y destinos", "Working areas and destinations")}</h2><p>{t("Consulta dónde trabaja cada camión y el destino previsto de su viaje.", "See each truck’s working areas and planned journey destination.")}</p></div>{vehicles.every(vehicle => vehicle.source === "SERVICE") ? <span className={s.demoTag}>{t("Registros consultados", "Retrieved records")}</span> : null}</header>
    {!zones.length ? <div className={s.empty}><MapPin size={28} aria-hidden="true" /><h3>{t("Sin zonas vinculadas", "No linked areas")}</h3><p>{t("No hay zonas de trabajo ni destinos registrados para los vehículos consultados.", "No working areas or destinations are recorded for the retrieved vehicles.")}</p></div> : <div className={s.coverageLayout}>
      <aside className={s.zonePanel}><h3>{t("Corredores de trabajo", "Working corridors")}</h3><div role="group" aria-label={t("Filtrar por zona", "Filter by area")}>
        <button aria-pressed={zoneId === "all"} onClick={() => setZoneId("all")}><MapPin size={18} aria-hidden="true" /><span>{t("Todas las zonas", "All areas")}</span><strong>{vehicles.filter(vehicle => vehicle.workingZones?.length).length}</strong></button>
        {zones.map(zone => <button key={zone.id} aria-pressed={zoneId === zone.id} onClick={() => setZoneId(zone.id)}><span className={s.zoneDot} aria-hidden="true" /><span><strong>{zone.name}</strong><small>{zone.cities.join(" · ")}</small></span><b>{vehicles.filter(vehicle => vehicle.workingZones?.some(value => value.id === zone.id)).length}</b></button>)}
      </div><small>{t("Las zonas de trabajo no representan una posición GPS ni una ruta vial.", "Working areas do not represent a GPS position or road geometry.")}</small></aside>
      <div><p className={s.resultCount} role="status">{visible.length} {t("camiones en esta zona", "trucks in this area")}</p><div className={s.coverageGrid}>{visible.map(vehicle => {
        const photo = fleetReferencePhoto(vehicle);
        return <article key={vehicle.id} className={s.coverageCard}><div className={s.coverageIdentity}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo.src} width={120} height={80} loading="lazy" alt={t("Fotografía de referencia", "Reference photograph")} />
          <div><h3><button ref={node => registerButton(vehicle.id, node)} onClick={() => open(vehicle.id)}>{vehicle.code}<ArrowRight size={15} aria-hidden="true" /></button></h3><p>{vehicle.model}</p><span>{vehicle.plate}</span></div></div>
          <FleetJourneySummary vehicle={vehicle} />
        </article>;
      })}</div></div>
    </div>}
  </section>;
}

const stageCopy: Record<DemoStage, [string, string]> = { UNASSIGNED: ["Sin conductor", "Unassigned"], ASSIGNED: ["Asignado", "Assigned"], EN_ROUTE: ["En ruta", "En route"], COMPLETED: ["Finalizado", "Completed"] };
const errorCopy: Record<DemoError, [string, string]> = {
  INVALID_TRIP: ["No se encontró el viaje seleccionado.", "The selected journey was not found."],
  VEHICLE_BLOCKED: ["Este camión está en taller o fuera de servicio.", "This truck is in maintenance or out of service."],
  INVALID_DRIVER: ["Selecciona un conductor habilitado.", "Select an enabled driver."],
  DRIVER_BUSY: ["El conductor ya tiene otro viaje activo. Selecciona otro.", "The driver already has another active journey. Select another."],
  INVALID_TRANSITION: ["Completa la etapa anterior antes de continuar.", "Complete the previous stage before proceeding."],
};

export function FleetAssignmentBoard({ state, vehicles, command, reset, ready, storageAvailable, open, registerButton }:
  { state: FleetDemoState; vehicles: FleetVehicle[]; command: (command: DemoCommand) => DemoError | null; reset: () => void;
    ready: boolean; storageAvailable: boolean; open: (id: string) => void; registerButton: RegisterButton }) {
  const { t, localeTag } = useLocale();
  const [choices, setChoices] = useState<Record<string, string>>({}), [notice, setNotice] = useState(""), [failure, setFailure] = useState(false);
  const [movedId, setMovedId] = useState<string | null>(null), titleButtons = useRef(new Map<string, HTMLButtonElement>());
  useEffect(() => { if (movedId) { titleButtons.current.get(movedId)?.focus(); setMovedId(null); } }, [state, movedId]);
  const act = (value: DemoCommand) => {
    const error = command(value); setFailure(!!error);
    setNotice(error ? t(...errorCopy[error]) : t("Viaje actualizado: ", "Journey updated: ") + value.tripId.replace("trip-", ""));
    if (!error) setMovedId(value.tripId);
  };
  const free = demoDrivers.filter(driver => driver.enabled && !driverBusy(state, driver.id)).length;
  return <section>
    <header className={s.viewHeading}><div><h2 tabIndex={-1}>{t("Asignación de conductores", "Driver assignment")}</h2><p>{t("Asigna un conductor y actualiza el estado de cada viaje.", "Assign a driver and update each journey status.")}</p></div>
      <button className={s.resetButton} disabled={!ready} onClick={() => { reset(); setChoices({}); setFailure(false); setNotice(t("Vista inicial restablecida", "Initial view restored")); }}><RotateCcw size={16} aria-hidden="true" />{t("Restablecer vista", "Reset view")}</button></header>
    <div className={s.boardInfo}><span><UserRound size={17} aria-hidden="true" /><strong>{free}</strong> {t("conductores disponibles", "available drivers")}</span><small>{storageAvailable ? t("Los cambios se guardan en este navegador.", "Changes are saved in this browser.") : t("Los cambios durarán mientras mantengas abierta esta vista.", "Changes last while this view stays open.")}</small></div>
    <p className={s.notice} role={failure ? "alert" : "status"} aria-live="polite">{notice || t("Sin conductor → Asignado → En ruta → Finalizado", "Unassigned → Assigned → En route → Completed")}</p>
    <div className={s.pipeline}>{demoStages.map((stage, index) => <section className={s.column} data-stage={stage} key={stage} aria-labelledby={`fleet-stage-${stage}`}>
      <header><span className={s.stageNumber}>{index + 1}</span><h3 id={`fleet-stage-${stage}`}>{t(...stageCopy[stage])}</h3><b>{state.trips.filter(trip => trip.stage === stage).length}</b></header>
      <div className={s.stageCards}>{state.trips.filter(trip => trip.stage === stage).map(trip => {
        const vehicle = vehicles.find(vehicle => vehicle.id === trip.vehicleId);
        if (!vehicle) return null;
        const driver = demoDrivers.find(driver => driver.id === trip.driverId), blocked = ["MAINTENANCE", "OUT_OF_SERVICE"].includes(vehicle.status);
        return <article className={s.assignmentCard} key={trip.id}><div className={s.assignmentIdentity}><Truck size={20} aria-hidden="true" /><div><h4><button ref={node => { registerButton(vehicle.id, node); if (node) titleButtons.current.set(trip.id, node); else titleButtons.current.delete(trip.id); }} onClick={() => open(vehicle.id)}>{vehicle.code}</button></h4><span>{vehicle.plate} · {vehicle.capacityKg.toLocaleString(localeTag)} kg</span></div></div>
          <p className={s.assignmentRoute}>{vehicle.journey?<>{vehicle.journey.origin}<ArrowRight size={15} aria-hidden="true" /><strong>{vehicle.journey.destination}</strong></>:<>{vehicle.depot??vehicle.location} · {t("Destino por programar","Destination to be planned")}</>}</p>
          {driver ? <div className={s.assignedDriver}><UserRound size={17} aria-hidden="true" /><span>{driver.name}<small>{stage === "COMPLETED" ? t("Conductor del viaje", "Journey driver") : t("Conductor asignado", "Assigned driver")}</small></span></div> : null}
          {blocked ? <p className={s.blocked}><Wrench size={17} aria-hidden="true" />{t("En taller · asignación bloqueada", "In maintenance · assignment blocked")}</p> : stage === "UNASSIGNED" ? <form onSubmit={event => { event.preventDefault(); act({ type: "assign", tripId: trip.id, driverId: choices[trip.id] ?? "" }); }}>
            <label>{t("Conductor", "Driver")}<select value={choices[trip.id] ?? ""} onChange={event => setChoices(previous => ({ ...previous, [trip.id]: event.target.value }))} required disabled={!ready}>
              <option value="">{t("Seleccionar conductor", "Select driver")}</option>{demoDrivers.map(driver => <option key={driver.id} value={driver.id} disabled={!driver.enabled || driverBusy(state, driver.id)}>{driver.name}{!driver.enabled ? t(" · no habilitado", " · not enabled") : driverBusy(state, driver.id) ? t(" · ocupado", " · busy") : ""}</option>)}
            </select></label><button type="submit" className={s.primary} disabled={!ready}><UserRound size={15} aria-hidden="true" />{t("Asignar conductor", "Assign driver")}</button>
          </form> : stage === "ASSIGNED" ? <div className={s.assignmentActions}><button className={s.primary} disabled={!ready} onClick={() => act({ type: "start", tripId: trip.id })}><Route size={15} aria-hidden="true" />{t("Iniciar viaje", "Start journey")}</button><button disabled={!ready} onClick={() => act({ type: "release", tripId: trip.id })}>{t("Liberar conductor", "Release driver")}</button></div>
          : stage === "EN_ROUTE" ? <button className={s.primary} disabled={!ready} onClick={() => act({ type: "finish", tripId: trip.id })}><Flag size={15} aria-hidden="true" />{t("Finalizar viaje", "Complete journey")}</button>
          : <p className={s.completed}><Check size={16} aria-hidden="true" />{t("Viaje finalizado", "Journey completed")}</p>}
          <small className={s.updated}>{t("Actualizado: ", "Updated: ")}{new Date(vehicle.updatedAt).toLocaleString(localeTag, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</small>
        </article>;
      })}{!state.trips.some(trip => trip.stage === stage) ? <p className={s.emptyColumn}>{t("Sin viajes en esta etapa", "No journeys in this stage")}</p> : null}</div>
    </section>)}</div>
  </section>;
}

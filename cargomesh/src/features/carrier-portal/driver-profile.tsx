"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, BadgeCheck, CalendarDays, Clock3, MapPin, ShieldCheck, Truck } from "lucide-react";
import { useLocale } from "@/features/i18n/locale-provider";
import type { FleetDriver } from "./fleet-drivers";
import type { FleetVehicle } from "./fleet-model";
import { fleetReferencePhoto } from "./fleet-photos";
import s from "./driver-profile.module.css";

export function DriverPortrait({driver,large=false}:{driver:FleetDriver;large?:boolean}) {
  const [failed,setFailed]=useState(false);
  return <span className={`${s.portrait} ${large?s.largePortrait:""}`} data-driver={driver.id}>
    {failed||!driver.photo?<span>{driver.name.split(" ").map(part=>part[0]).slice(0,2).join("")}</span>:
      /* eslint-disable-next-line @next/next/no-img-element */
      <img src={`/v2-workspace/drivers/${driver.photo}.webp`} alt="" width={large?180:48} height={large?180:48} loading={large?"eager":"lazy"} onError={()=>setFailed(true)}/>}
  </span>;
}

export function DriverProfile({vehicle,profile,back,openTruck}:{vehicle?:FleetVehicle|null;profile?:FleetDriver;back:()=>void;openTruck:()=>void}) {
  const {t,localeTag}=useLocale();const driver=profile??vehicle?.driverProfile;
  const top=useRef<HTMLDivElement>(null);
  useEffect(()=>{top.current?.scrollIntoView({block:"start",behavior:"instant"});},[driver?.id]);
  const [selected,setSelected]=useState(6);
  const days=vehicle?.engineDays.slice(-7)??[],day=days[selected];
  const date=(value:string|null)=>value?new Date(value+"T12:00:00Z").toLocaleDateString(localeTag,{day:"numeric",month:"short",year:"numeric"}):t("Pendiente de datos","Pending data");
  const photo=vehicle?fleetReferencePhoto(vehicle):null;
  if(!driver)return null;
  return <section className={s.profile}>
    <div ref={top} className={s.top}><button className={s.back} onClick={back}><ArrowLeft size={18} aria-hidden="true"/>{t("Volver","Back")}</button><span>{t("Flota / Conductores","Fleet / Drivers")}</span></div>
    <div className={s.hero}><DriverPortrait driver={driver} large/><div className={s.identity}>
      <span className={s.eyebrow}>{t("Ficha del conductor","Driver profile")}</span><h2 tabIndex={-1}>{driver.name}</h2>
      <p><MapPin size={16} aria-hidden="true"/>{driver.base??t("Base sin registrar","Base not recorded")}<span>·</span>{t("Conductor profesional","Professional driver")}</p>
      <div className={s.tags}>{driver.specialties.map(value=><span key={value}>{value}</span>)}</div>
    </div><div className={s.licenseBadge}><BadgeCheck size={24} aria-hidden="true"/><strong>{driver.licenseClass}</strong><span>{t("Licencia de conducir","Driving license")}</span></div></div>
    <div className={s.metrics}>
      <div><span>{t("Viajes completados","Completed trips")}</span><strong>{driver.completedTrips??"—"}</strong><small>{t("Historial acumulado","Cumulative history")}</small></div>
      <div><span>{t("Puntualidad","On-time arrival")}</span><strong>{driver.punctualityPercent===null?"—":driver.punctualityPercent+"%"}</strong>{driver.punctualityPercent!==null?<meter min={0} max={100} value={driver.punctualityPercent} aria-label={t("Porcentaje de puntualidad","On-time arrival percentage")}/>:<small>Pending data</small>}</div>
      <div><span>{t("Experiencia","Experience")}</span><strong>{driver.experienceYears??"—"}<small> {t("años","years")}</small></strong><small>{t("Transporte de carga","Freight transport")}</small></div>
      <div><span>{t("Camión vinculado","Linked truck")}</span><strong>{vehicle?.code??"—"}</strong><small>{vehicle?.driverProfileRole==="assigned"?t("Asignación actual","Current assignment"):vehicle?.source==="EXAMPLE"?t("Unidad habitual","Regular vehicle"):t("Sin asignación verificada","No verified assignment")}</small></div>
    </div>
    <div className={s.columns}><section className={s.panel}><h3><ShieldCheck size={20} aria-hidden="true"/>{t("Datos profesionales","Professional details")}</h3><dl>
      <div><dt>{t("Licencia","License")}</dt><dd>{driver.licenseClass}</dd></div><div><dt>{t("Vencimiento","Expires")}</dt><dd>{date(driver.licenseExpiresAt)}</dd></div>
      <div><dt>{t("Fecha de ingreso","Joined")}</dt><dd>{date(driver.joinedAt)}</dd></div><div><dt>{t("Base de operación","Operating base")}</dt><dd>{driver.base??"Pending data"}</dd></div>
      <div><dt>{t("Turno habitual","Regular shift")}</dt><dd><Clock3 size={14} aria-hidden="true"/>{driver.shift??"Pending data"}</dd></div>
      <div><dt>{t("Operación","Operations")}</dt><dd>{driver.enabled===null?t("Consultar agenda y asignaciones","Check agenda & assignments"):driver.enabled?t("Habilitado para asignación","Enabled for assignment"):t("Asignación suspendida","Assignment suspended")}</dd></div>
    </dl></section><section className={s.panel}><h3><Truck size={20} aria-hidden="true"/>{t("Vehículo y recorrido","Vehicle and journey")}</h3>
      {vehicle&&photo?<><button className={s.vehicle} onClick={openTruck}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo.src} alt="" width={136} height={100}/><span><strong>{vehicle.code}</strong><span>{vehicle.model}</span><small>{vehicle.plate} · {vehicle.capacityKg.toLocaleString(localeTag)} kg</small></span><ArrowRight size={18} aria-hidden="true"/>
      </button><div className={s.route}><MapPin size={18} aria-hidden="true"/><div><strong>{vehicle.journey?.origin??vehicle.location}</strong><span>↓</span><strong>{vehicle.journey?.destination??"—"}</strong></div></div>
      <div className={s.tags}>{vehicle.workingZones?.map(zone=><span key={zone.id}>{zone.name}</span>)}</div></>:<p>Vehicle assignment and journey are pending verified records.</p>}
    </section></div>
    <section className={s.panel}><div className={s.chartHeading}><div><h3><CalendarDays size={20} aria-hidden="true"/>{t("Actividad de la unidad","Vehicle activity")}</h3><p>{t("Horas de conducción · últimos 7 días","Driving hours · last 7 days")}</p></div><span>{day?date(day.date):""}<strong>{day?`${day.driving} h`:"—"}</strong></span></div>
      {!days.length?<p>Pending driving activity data.</p>:null}<div className={s.chart} role="group" aria-label={t("Actividad diaria de la unidad","Daily vehicle activity")}>{days.map((value,index)=><button key={value.date} aria-pressed={index===selected} onClick={()=>setSelected(index)} aria-label={`${date(value.date)}: ${value.driving} ${t("horas de conducción","driving hours")}`}>
        <span className={s.barTrack}><span style={{height:`${value.driving/12*100}%`}}/></span><small>{new Date(value.date+"T12:00:00Z").toLocaleDateString(localeTag,{weekday:"short"})}</small>
      </button>)}</div>
    </section>
  </section>;
}

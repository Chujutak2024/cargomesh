"use client";
import {Fragment} from 'react';
import {useLocale} from '@/features/i18n/locale-provider';
import {CarrierLink} from '@/features/carrier-navigation/carrier-link';
import {carrierStatusLabel} from '@/features/carrier-navigation/carrier-status';
import {displayReference,vehicleDisplayName} from '@/shared/lib/display-identity';
import type {RegularDriverRecordV2} from '@/shared/schemas/v2/regular-driver';
import {recordData,recordName,recordStatus,type PortalRecord} from './records';
import s from './crew-agenda.module.css';

export function CrewAgenda({executions,vehicleAssignments,driverAssignments,holds,assets,drivers,regularDrivers=[],regularDriversUnavailable=true,partial}:{
 executions:PortalRecord[];vehicleAssignments:PortalRecord[];driverAssignments:PortalRecord[];
 holds:PortalRecord[];assets:PortalRecord[];drivers:PortalRecord[];regularDrivers?:RegularDriverRecordV2[];regularDriversUnavailable?:boolean;partial:boolean;
}){
 const {t,localeTag,locale}=useLocale();
 const date=(raw:unknown)=>{const at=typeof raw==='string'?Date.parse(raw):NaN;return Number.isFinite(at)?new Intl.DateTimeFormat(localeTag,{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'America/Lima',hour12:false}).format(at):'—';};
 const status=(value:string)=>carrierStatusLabel(value,locale==='es');
 const rows=executions.filter(row=>['PLANNED','IN_PROGRESS'].includes(recordStatus(row))).sort((a,b)=>String((recordData(a).plannedWindow as Record<string,unknown>|undefined)?.startsAt??'').localeCompare(String((recordData(b).plannedWindow as Record<string,unknown>|undefined)?.startsAt??'')));
 const assignments=(records:PortalRecord[],row:PortalRecord)=>records.filter(record=>record.carrierId===row.carrierId&&recordData(record).serviceId===recordData(row).serviceId&&recordData(record).executionId===row.id&&!['CANCELLED','RELEASED'].includes(recordStatus(record)));
 const resource=(records:PortalRecord[],assignment:PortalRecord,key:string)=>records.find(row=>row.carrierId===assignment.carrierId&&recordData(row).serviceId===recordData(assignment).serviceId&&row.id===recordData(assignment)[key]);
 return <div className={s.agenda}>
  <div className={s.summary}><span>{rows.length}{partial?'+':''} {t('operaciones programadas o en curso','scheduled or active operations')}</span><small>PET · UTC−5</small></div>
  {partial?<p role="status" className={s.notice}>{t('Lectura incompleta. Algunos recursos siguen sin verificar.','Incomplete read. Some resources remain unverified.')}</p>:null}
  <div className={s.tableScroll} role="region" aria-label={t('Agenda de operaciones','Operations schedule')} tabIndex={0}>
   <table className={s.table}><thead><tr>{[t('Orden','Order'),t('Horario · PET','Time · PET'),t('Camión','Truck'),t('Conductor habitual','Usual driver'),t('Reserva','Reservation'),t('Estado','Status'),t('Acción','Action')].map(label=><th scope="col" key={label}>{label}</th>)}</tr></thead>
    <tbody>{rows.map(row=>{const data=recordData(row),window=data.plannedWindow as Record<string,unknown>|undefined,vehicles=assignments(vehicleAssignments,row),crew=assignments(driverAssignments,row);
     const slots:Array<PortalRecord|null>=vehicles.length?vehicles:[null];
     return <Fragment key={row.id}>{slots.map((assignment,index)=>{
      const truck=assignment?resource(assets,assignment,'assetId'):null;
      const value=truck?recordData(truck):{},road=value.roadVehicle as Record<string,unknown>|undefined;
      const habitual=truck?regularDrivers.find(link=>link.carrierId===row.carrierId&&link.serviceId===data.serviceId&&link.assetId===truck.id):null;
      const driver=habitual?.driverId?drivers.find(candidate=>candidate.carrierId===habitual.carrierId&&recordData(candidate).serviceId===habitual.serviceId&&candidate.id===habitual.driverId):null;
      const reservationId=assignment?recordData(assignment).reservationId:null;
      const reservation=holds.find(hold=>hold.id===reservationId&&hold.carrierId===row.carrierId&&recordData(hold).bookingId===data.bookingId);
      return <tr key={assignment?.id??row.id}>
       {index===0?<><th scope="rowgroup" rowSpan={slots.length}><strong>{typeof data.bookingId==='string'?displayReference(data.bookingId,'BKG'):displayReference(row.id,'OP')}</strong><small>{displayReference(row.id,'OP')}</small><details className={s.tripDrivers}><summary>{t('Conductores de la operación','Operation drivers')}</summary>{crew.length?crew.map(item=>{const person=resource(drivers,item,'driverId');return <p key={item.id}>{person?recordName(person):t('Sin verificar','Unverified')} · {status(recordStatus(item))}</p>}):<p>{t('Pendientes de asignar','Awaiting assignment')}</p>}</details></th><td rowSpan={slots.length}><span>{date(window?.startsAt)}</span><small>{date(window?.endsAt)}</small></td></>:null}
       <td><strong>{truck?vehicleDisplayName(truck.id,String(value.code??truck.id),typeof road?.plate==='string'?road.plate:null):t('Por asignar','Unassigned')}</strong>{assignment?<small>{status(recordStatus(assignment))}</small>:null}</td>
       <td>{driver?recordName(driver):regularDriversUnavailable||habitual?.driverId?t('Sin verificar','Unverified'):t('Sin habitual','No usual driver')}</td>
       <td>{reservation?<><strong>{displayReference(reservation.id,'RES')}</strong><small>{status(recordStatus(reservation))}</small></>:<small>{t('Sin verificar','Unverified')}</small>}</td>
       {index===0?<><td rowSpan={slots.length}><span className={s.status}>{status(recordStatus(row))}</span></td><td rowSpan={slots.length}>{typeof data.bookingId==='string'?<CarrierLink href={'/carriers/orders/details/'+encodeURIComponent(data.bookingId)}>{t('Ver orden','View order')} →</CarrierLink>:<span>—</span>}</td></>:null}
      </tr>;
     })}</Fragment>;
    })}</tbody>
   </table>
   {!rows.length?<div className={s.empty}>{partial?t('Sin operaciones en esta lectura parcial.','No operations in this partial read.'):t('No hay operaciones programadas.','No scheduled operations.')}</div>:null}
  </div>
 </div>;
}

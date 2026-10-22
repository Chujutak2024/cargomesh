"use client";
import {useLocale} from '@/features/i18n/locale-provider';
import {driverDisplayName} from '@/shared/lib/display-identity';
import {useEffect,useRef,useState} from 'react';
import {Dialog} from '@/components/ui/dialog';
import {recordData,type PortalRecord} from '@/features/carrier-portal/records';
import {portalErrorCopy,mutationReceipt} from '@/features/carrier-portal/api';
import {saveRegularDriver} from '@/features/carrier-portal/regular-driver-client';
import type {RegularDriverRecordV2} from '@/shared/schemas/v2/regular-driver';
import s from './fleet.module.css';
export function RegularDriverEditor({carrierId,serviceId,assetId,plate,record,drivers,close,saved,onBusyChange}:{carrierId:string;serviceId:string;assetId:string;plate:string;record?:RegularDriverRecordV2;drivers:PortalRecord[];close:()=>void;saved:()=>void;onBusyChange:(value:boolean)=>void}){
 const {t}=useLocale();
 const [driverId,setDriverId]=useState(record?.driverId??''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const receipt=useRef<{fingerprint:string;key:string}|null>(null),request=useRef<AbortController|null>(null);
 useEffect(()=>()=>request.current?.abort(),[]);
 const save=async()=>{
  if(busy)return;const controller=new AbortController();request.current=controller;
  const value={schemaVersion:'2.0',serviceId,driverId:driverId||null,expectedVersion:record?.version??0};
  receipt.current=mutationReceipt(receipt.current,carrierId+'/'+assetId,value,()=>crypto.randomUUID());
  setBusy(true);onBusyChange(true);setError('');
  try{await saveRegularDriver(carrierId,assetId,value,receipt.current.key,controller.signal);saved();}
  catch(e){if(!controller.signal.aborted)setError(portalErrorCopy(e,false));}
  finally{setBusy(false);onBusyChange(false);}
 };
 const options=drivers.filter(row=>recordData(row).serviceId===serviceId);
 return <Dialog open title={t('Conductor habitual','Usual driver')+' · '+plate} description={t('Unidad habitual del conductor. Cada viaje confirma disponibilidad y habilitaciones.','The driver’s usual vehicle. Availability and qualifications are checked for each trip.') } closeLabel={t('Cerrar','Close')} onClose={close} closeDisabled={busy} footer={<><button type="button" disabled={busy} onClick={close}>{t('Cancelar','Cancel')}</button><button type="button" disabled={busy} onClick={()=>void save()}>{busy?t('Guardando…','Saving…'):t('Guardar','Save')}</button></>}>
  <label className={s.regularDriverField}>{t('Conductor habitual','Usual driver')}<select value={driverId} disabled={busy} onChange={event=>setDriverId(event.target.value)}><option value="">{t('Sin conductor habitual','No usual driver')}</option>{options.map(row=><option key={row.id} value={row.id}>{driverDisplayName(String(recordData(row).fullName),row.id)}</option>)}</select></label>
  {!options.length?<p>{t('No hay conductores registrados para este servicio.','No drivers are registered for this service.')}</p>:null}
  {error?<p role="alert" className={s.error}>{error} Close and refresh the fleet if the record changed.</p>:null}
 </Dialog>;
}

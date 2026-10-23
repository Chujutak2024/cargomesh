"use client";
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {z} from 'zod';
import {Button,Input,Select} from '@/components/ui';
import {useLocale} from '@/features/i18n/locale-provider';
import {TimeWindowV2Schema} from '@/shared/schemas/v2/freight-request';
import {portalRequest,portalErrorCopy} from './api';
import {recordData,recordName,type PortalRecord} from './records';
import s from './connected-fleet.module.css';
const Result=z.object({status:z.enum(['eligible','ineligible','unknown']),reasons:z.array(z.string()),scope:z.literal('RESOURCE_WINDOW_ONLY'),provenanceStatus:z.enum(['VERIFIED','ESTIMATED','SIMULATED','UNKNOWN']),resourceId:z.string().uuid(),serviceId:z.string().uuid(),resourceVersion:z.number().int().positive(),checkedAt:z.string().datetime({offset:true}),window:TimeWindowV2Schema}).strict();
const instant=(text:string)=>text+(text.length===16?':00':'')+'-05:00';
export function ResourceAvailability({carrierId,serviceId,assets,drivers}:{carrierId:string;serviceId:string;assets:PortalRecord[];drivers:PortalRecord[]}){
 const {t,localeTag}=useLocale();
 const [kind,setKind]=useState<'asset'|'driver'>('asset'),[id,setId]=useState(''),[starts,setStarts]=useState(''),[ends,setEnds]=useState(''),[result,setResult]=useState<z.infer<typeof Result>|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const request=useRef<AbortController|null>(null);useEffect(()=>()=>request.current?.abort(),[]);
 const clear=()=>{request.current?.abort();setResult(null);setError('');setBusy(false);};
 const validPeriod=!!starts&&!!ends&&Date.parse(instant(ends))>Date.parse(instant(starts));
 async function submit(event:FormEvent){event.preventDefault();if(busy)return;setResult(null);setError('');
  const resource=(kind==='asset'?assets:drivers).find(row=>row.id===id&&row.carrierId===carrierId&&(!serviceId||recordData(row).serviceId===serviceId));
  const resourceServiceId=resource?String(recordData(resource).serviceId):'';
  const period=TimeWindowV2Schema.safeParse({startsAt:instant(starts),endsAt:instant(ends)});
  if(!period.success||!validPeriod||!resource||!resourceServiceId){setError(t('Elige un recurso y un horario válido.','Choose a resource and a valid time window.'));return;}
  const controller=new AbortController();request.current=controller;setBusy(true);
  try{const response=await portalRequest('/api/v2/carrier-portal/carriers/'+carrierId+'/availability',{method:'POST',signal:controller.signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({serviceId:resourceServiceId,kind,resourceId:id,window:period.data})});const checked=Result.parse(response.data);if(checked.resourceId!==id||checked.serviceId!==resourceServiceId||Date.parse(checked.window.startsAt)!==Date.parse(period.data.startsAt)||Date.parse(checked.window.endsAt)!==Date.parse(period.data.endsAt))throw new Error('INVALID_RESPONSE');if(!controller.signal.aborted)setResult(checked);}catch(failure){if(!controller.signal.aborted)setError(portalErrorCopy(failure,false));}finally{if(!controller.signal.aborted)setBusy(false);}
 }
 return <form className={s.availabilityForm} onSubmit={submit}>
  <div className={s.fields}>
   <Select label={t('Tipo','Type')} value={kind} onChange={event=>{clear();setKind(event.target.value as typeof kind);setId('');}}><option value="asset">{t('Camión','Truck')}</option><option value="driver">{t('Conductor','Driver')}</option></Select>
   <Select label={kind==='asset'?t('Camión','Truck'):t('Conductor','Driver')} value={id} onChange={event=>{clear();setId(event.target.value);}}><option value="">{t('Seleccionar','Select')}</option>{(kind==='asset'?assets:drivers).map(row=><option key={row.id} value={row.id}>{recordName(row)}</option>)}</Select>
   <Input label={t('Desde · PET','From · PET')} type="datetime-local" required value={starts} onChange={event=>{clear();setStarts(event.target.value);if(ends&&event.target.value>=ends)setEnds('');}}/>
   <Input label={t('Hasta · PET','Until · PET')} type="datetime-local" required min={starts||undefined} value={ends} onChange={event=>{clear();setEnds(event.target.value);}}/>
  </div>
  <div className={s.toolbar}><small>{t('Hora de Perú (UTC−5). La consulta no reserva el recurso.','Peru time (UTC−5). This check does not reserve the resource.')}</small><Button type="submit" disabled={!id||!validPeriod} isLoading={busy} loadingLabel={t('Consultando…','Checking…')}>{t('Consultar disponibilidad','Check availability')}</Button></div>
  {starts&&ends&&!validPeriod?<p role="alert">{t('El final debe ser posterior al inicio.','The end must be later than the start.')}</p>:null}
  {error?<p role="alert">{error}</p>:null}
  {result?<div role="status" className={s.availabilityResult}><strong>{result.status==='eligible'?t('Disponible en esta ventana','Available for this window'):result.status==='ineligible'?t('No disponible en esta ventana','Unavailable for this window'):t('Disponibilidad por verificar','Availability unverified')}</strong><small>{new Intl.DateTimeFormat(localeTag,{dateStyle:'short',timeStyle:'short',timeZone:'America/Lima'}).format(new Date(result.checkedAt))} PET · {result.provenanceStatus}</small><details><summary>{t('Ver motivos y alcance','Reasons & scope')}</summary><ul>{result.reasons.map(reason=><li key={reason}>{reason.replaceAll('_',' ')}</li>)}</ul><p>{t('La compatibilidad de carga, la ruta y el reposicionamiento se comprueban por separado.','Cargo compatibility, routing and repositioning are checked separately.')}</p></details></div>:null}
 </form>;
}

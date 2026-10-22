'use client';
import {useEffect,useRef,useState} from 'react';
import type {z} from 'zod';
import {Button,Input,Select} from '@/components/ui';
import {WorkspaceLink as Link} from '@/features/workspace-mode/workspace-link';
import {workspaceFetch} from '@/features/workspace-mode/workspace-fetch';
import {useLocale} from '@/features/i18n/locale-provider';
import {CreateIncidentRecoverySchema,IncidentRecoveryContextSchema,IncidentRecoverySchema} from '@/shared/schemas/v2/incident-recovery';
import type {FreightRequestV2Data} from '@/features/v2-intake/contracts';
import styles from './shipper-portal.module.css';
import s from './incident-recovery-panel.module.css';
type Context=z.infer<typeof IncidentRecoveryContextSchema>;
async function api(path:string,init?:RequestInit){
 const response=await workspaceFetch('/api/v2'+path,{...init,credentials:'same-origin',headers:{Accept:'application/json',...(init?.body?{'Content-Type':'application/json'}:{}),...init?.headers}});
 const result=await response.json();
 if(!response.ok)throw new Error(result.error?.code??'RECOVERY_UNAVAILABLE');
 return result.data;
}
/** Recovery stays on the existing order screen; its replacement uses native comparison/authorization. */
export function IncidentRecoveryPanel({request}:{request:FreightRequestV2Data}){
 const {t}=useLocale();const [context,setContext]=useState<Context|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const [incidentId,setIncidentId]=useState(''),[selected,setSelected]=useState<string[]>([]),[cause,setCause]=useState('CARRIER_ACCIDENT');
 const [city,setCity]=useState(request.origin.city),[country,setCountry]=useState(request.origin.countryCode),[label,setLabel]=useState(request.origin.label);
 const [pickupStart,setPickupStart]=useState(''),[pickupEnd,setPickupEnd]=useState(''),[deliveryStart,setDeliveryStart]=useState(''),[deliveryEnd,setDeliveryEnd]=useState('');
 const [remaining,setRemaining]=useState<Record<number,string>>({}),[consent,setConsent]=useState(false);
 const retry=useRef<{payload:string;key:string}|null>(null);
 const incident=context?.incidents.find(i=>i.id===incidentId);
 useEffect(()=>{let live=true;setContext(null);setError('');setIncidentId('');setSelected([]);setRemaining({});setConsent(false);retry.current=null;setCity(request.origin.city);setCountry(request.origin.countryCode);setLabel(request.origin.label);void api(`/freight/requests/${request.id}/recoveries`).then(data=>{if(live)setContext(IncidentRecoveryContextSchema.parse(data));}).catch(e=>{if(live)setError(e instanceof Error?e.message:'RECOVERY_UNAVAILABLE');});return()=>{live=false;};},[request.id]);
 const allocations=new Map<number,number>();for(const reservation of incident?.reservations??[])if(selected.includes(reservation.id))for(const a of reservation.allocations??[])allocations.set(a.unitIndex,(allocations.get(a.unitIndex)??0)+a.quantity);
 async function create(){if(!incident||busy||!consent)return;setBusy(true);setError('');try{
  const iso=(v:string)=>new Date(v+'Z').toISOString();
  const unchanged=label===request.origin.label&&city===request.origin.city&&country===request.origin.countryCode;
  const origin=unchanged?(request.origin.facilityId?{facilityId:request.origin.facilityId}:{label,countryCode:country,city,region:request.origin.region,lat:request.origin.lat,lng:request.origin.lng}):{label,countryCode:country,city};
  const input=CreateIncidentRecoverySchema.parse({schemaVersion:'2.0',expectedIncidentVersion:incident.version,cause,reservationIds:selected,
   origin,pickupWindow:{startsAt:iso(pickupStart),endsAt:iso(pickupEnd)},deliveryWindow:{startsAt:iso(deliveryStart),endsAt:iso(deliveryEnd)},timeZone:'UTC',consent:'AUTHORIZE_RECOVERY_SEARCH',
   ...(incident.executionStatus==='IN_PROGRESS'?{confirmRemainingCargo:true,remainingAllocations:[...allocations].map(([unitIndex,qty])=>({unitIndex,quantity:Number(remaining[unitIndex]??qty)})).filter(a=>a.quantity>0)}:{})});
  const payload=JSON.stringify(input);if(retry.current?.payload!==payload)retry.current={payload,key:crypto.randomUUID()};
  const recovery=IncidentRecoverySchema.parse(await api(`/incidents/${incident.id}/recoveries`,{method:'POST',headers:{'Idempotency-Key':retry.current.key},body:payload}));
  setContext(value=>value?{cases:[...value.cases.filter(c=>c.id!==recovery.id),recovery],incidents:value.incidents.filter(i=>i.id!==incident.id)}:value);setIncidentId('');setConsent(false);
 }catch(e){setError(e instanceof Error?e.message:'RECOVERY_UNAVAILABLE');}finally{setBusy(false);}}
 if(!context&&!error||context&&!context.cases.length&&!context.incidents.length)return null;
 return <section className={styles.panel} aria-label={t('Recuperación por incidencia','Incident recovery')}>
  <header className={styles.panelHeader}><h2>{t('Recuperación por incidencia','Incident recovery')}</h2></header>
  <div className={styles.section}>
   {error?<p role="alert">{t('No se pudo completar la recuperación','Recovery could not be completed')}: {error}</p>:null}
   {!context&&!error?<p role="status">{t('Consultando incidencias…','Loading incidents…')}</p>:null}
   {context?.cases.map(c=><article key={c.id}><strong>{c.phase==='REPLACED'?t('Reemplazo confirmado','Replacement confirmed'):c.phase==='AWAITING_CLIENT'?t('Ofertas listas para comparar','Offers ready to compare'):c.phase==='AWAITING_CARRIER'?t('Esperando confirmación del Carrier','Awaiting Carrier confirmation'):t('Sin reemplazo confirmado · requiere atención','No confirmed replacement · attention required')}</strong><p>{t('Prioridad urgente · recargo por urgencia: USD 0. La tarifa normal puede variar.','Urgent priority · urgency surcharge: USD 0. Normal tariff may vary.')}</p>
    <Link className={styles.secondary} href={`/requests/${c.originalRequestId===request.id?c.replacementRequestId:c.originalRequestId}`}>{c.originalRequestId===request.id?t('Comparar ofertas del reemplazo','Compare replacement offers'):t('Ver pedido original','View original request')}</Link>
   </article>)}
   {context?.incidents.length?<Select label={t('Incidencia','Incident')} disabled={busy} value={incidentId} onChange={e=>{setIncidentId(e.target.value);setSelected([]);setRemaining({});setConsent(false);}}><option value="">{t('Selecciona una incidencia','Choose an incident')}</option>{context.incidents.map(i=><option key={i.id} value={i.id}>{i.kind} · {i.description.slice(0,100)}</option>)}</Select>:null}
   {incident?<form className={s.form} onSubmit={e=>{e.preventDefault();void create();}}>
    <p>{t('Selecciona la carga afectada. El pedido y su historial se conservan.','Select affected cargo. The original request and history are preserved.')}</p>
    <Select label={t('Motivo','Reason')} value={cause} disabled={busy} onChange={e=>setCause(e.target.value)}><option value="CARRIER_ACCIDENT">{t('Accidente del transportista','Carrier accident')}</option><option value="CARRIER_NONCOMPLIANCE">{t('Incumplimiento del transportista','Carrier noncompliance')}</option></Select>
    <fieldset disabled={busy}><legend>{t('Reservas afectadas','Affected reservations')}</legend>{incident.reservations.map((r,index)=><label key={r.id} style={{display:'block'}}><input type="checkbox" checked={selected.includes(r.id)} disabled={!r.allocations?.length} onChange={e=>{setSelected(ids=>e.target.checked?[...ids,r.id]:ids.filter(id=>id!==r.id));setRemaining({});}}/> {t('Recurso','Resource')} {index+1} · {r.weightKg??'—'} kg · {r.volumeM3??'—'} m³</label>)}</fieldset>
    {incident.executionStatus==='IN_PROGRESS'?<fieldset disabled={busy}><legend>{t('Bultos que aún requieren entrega','Packages still awaiting delivery')}</legend>{[...allocations].map(([unitIndex,qty])=><Input key={unitIndex} label={`${t('Grupo','Group')} ${unitIndex+1} (${request.cargoSpecification.units[unitIndex]?.packageType})`} type="number" min="0" max={qty} value={remaining[unitIndex]??qty} onChange={e=>setRemaining(v=>({...v,[unitIndex]:e.target.value}))}/>)}</fieldset>:null}
    <fieldset className={s.fields} disabled={busy}><legend>{t('Punto real de recojo y ventanas aceptables (UTC)','Actual pickup location and accepted windows (UTC)')}</legend>
     <Input label={t('Lugar de recojo','Pickup location')} required value={label} onChange={e=>setLabel(e.target.value)}/>
     <Input label={t('Ciudad','City')} required value={city} onChange={e=>setCity(e.target.value)}/>
     <Input label={t('País (código de dos letras)','Country (two-letter code)')} required pattern="[A-Z]{2}" maxLength={2} value={country} onChange={e=>setCountry(e.target.value.toUpperCase())}/>
     {[[t('Recojo desde','Pickup from'),pickupStart,setPickupStart],[t('Recojo hasta','Pickup until'),pickupEnd,setPickupEnd],[t('Entrega desde','Delivery from'),deliveryStart,setDeliveryStart],[t('Entrega hasta','Delivery until'),deliveryEnd,setDeliveryEnd]].map(([name,value,set])=><Input key={String(name)} label={String(name)} required type="datetime-local" value={String(value)} onChange={e=>(set as (v:string)=>void)(e.target.value)}/>)}
    </fieldset>
    <label><input type="checkbox" disabled={busy} checked={consent} onChange={e=>setConsent(e.target.checked)}/>{t('Confirmo la carga pendiente y el recojo. Autorizo buscar reemplazo sin recargo por urgencia; aprobaré su tarifa antes de contratar.','I confirm remaining cargo and pickup. Find a replacement without an urgency surcharge; I will approve its tariff before booking.')}</label>
    <Button type="submit" disabled={busy||!consent||!selected.length}>{busy?t('Preparando…','Preparing…'):t('Buscar reemplazo','Find replacement')}</Button>
   </form>:null}
  </div>
 </section>;
}

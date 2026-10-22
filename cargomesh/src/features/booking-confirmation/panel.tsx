'use client';
import {useEffect,useRef,useState} from 'react';
import {z} from 'zod';
import {Button,Input} from '@/components/ui';
import {useLocale} from '@/features/i18n/locale-provider';
import {workspaceFetch} from '@/features/workspace-mode/workspace-fetch';
import {QuoteConfirmationSchema,QuoteConfirmationInputSchema} from '@/shared/schemas/v2/quote-automation';
type Window=z.infer<typeof QuoteConfirmationSchema>;
export function BookingConfirmationWindow({bookingId,carrierId,onChanged,canAct=true}:{bookingId:string;carrierId?:string;onChanged?:()=>void;canAct?:boolean}){
 const {t,localeTag}=useLocale();const [window,setWindow]=useState<Window|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[deadline,setDeadline]=useState(''),[reason,setReason]=useState(''),[now,setNow]=useState(Date.now());
 const intent=useRef<{payload:string;key:string}|null>(null),inFlight=useRef(false);
 const path=carrierId?`/api/v2/carriers/${encodeURIComponent(carrierId)}/bookings/${encodeURIComponent(bookingId)}/confirmation-window`:`/api/v2/bookings/${encodeURIComponent(bookingId)}/confirmation-window`;
 async function request(init:RequestInit){const response=await workspaceFetch(path,{...init,credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json',...init.headers}});const body=await response.json();if(!response.ok)throw new Error(body?.error?.code??'CONFIRMATION_UNAVAILABLE');return QuoteConfirmationSchema.nullable().parse(body.data);}
 useEffect(()=>{const c=new AbortController();setWindow(null);setError('');void request({signal:c.signal}).then(value=>{if(!c.signal.aborted)setWindow(value);}).catch(()=>{if(!c.signal.aborted)setError(t('No se pudo leer el plazo de confirmación.','Confirmation deadline could not be read.'));});return()=>c.abort();},[path]);
 useEffect(()=>{const timer=globalThis.setInterval(()=>setNow(Date.now()),30000);return()=>globalThis.clearInterval(timer);},[]);
 const date=(value:string)=>new Intl.DateTimeFormat(localeTag,{dateStyle:'medium',timeStyle:'short'}).format(new Date(value));
 async function action(action:'PROPOSE'|'APPROVE'|'DECLINE'|'EXPIRE'){
  if(!window||!canAct||inFlight.current||!reason.trim())return;inFlight.current=true;setBusy(true);setError('');try{
   const payload=JSON.stringify(QuoteConfirmationInputSchema.parse({action,expectedVersion:window.version,deadline:action==='PROPOSE'?new Date(deadline).toISOString():null,reason}));
   if(intent.current?.payload!==payload)intent.current={payload,key:crypto.randomUUID()};
   const value=await request({method:'POST',headers:{'Idempotency-Key':intent.current!.key},body:payload});setWindow(value);setReason('');onChanged?.();
  }catch(e){setError(e instanceof Error?e.message:t('No se pudo actualizar.','Update failed.'));}finally{inFlight.current=false;setBusy(false);}
 }
 if(!window)return error?<p role="status">{error}</p>:null;
 const expired=Date.parse(window.deadline)<=now,pending=window.bookingStatus==='AUTHORIZED';
 if(!pending)return error?<p role="status">{error}</p>:null;
 return <section aria-label={t('Confirmación del transporte','Transport confirmation')} style={{fontSize:14,lineHeight:1.5,marginBlock:12}}>
  <strong>{t('Confirmación de Carrier hasta','Carrier confirmation by')}: {date(window.deadline)} {t('(hora local)','(local time)')}</strong>
  <p>{pending?(expired?t('Plazo vencido. No hay transporte confirmado.','Deadline expired. Transport is not confirmed.'):t('Pendiente de confirmar recursos y reserva.','Awaiting resource and booking confirmation.')):t('Consulta el estado actualizado de la reserva.','Check the updated booking status.')}</p>
  {error?<p role="alert">{error}</p>:null}
  {pending&&canAct?<><Input label={t('Motivo de la acción','Reason for action')} value={reason} maxLength={300} disabled={busy} onChange={e=>setReason(e.target.value)}/>
   {carrierId&&!window.extensionUsed&&Date.parse(window.maxDeadline)>now?<><Input label={t('Solicitar prórroga hasta (hora local)','Request extension until (local time)')} type="datetime-local" disabled={busy} value={deadline} onChange={e=>setDeadline(e.target.value)}/><Button variant="secondary" disabled={busy||!deadline||!reason.trim()} onClick={()=>void action('PROPOSE')}>{t('Solicitar prórroga','Request extension')}</Button></>:null}
   {window.proposedDeadline?<><p>{t('Prórroga propuesta','Proposed extension')}: {date(window.proposedDeadline)}</p>{!carrierId?<><Button disabled={busy||!reason.trim()} onClick={()=>void action('APPROVE')}>{t('Autorizar prórroga','Approve extension')}</Button> <Button variant="secondary" disabled={busy||!reason.trim()} onClick={()=>void action('DECLINE')}>{t('Rechazar','Decline')}</Button></>:<p>{t('Esperando autorización del Cliente.','Waiting for Client consent.')}</p>}</>:null}
   {expired?<Button variant="secondary" disabled={busy||!reason.trim()} onClick={()=>void action('EXPIRE')}>{t('Cerrar por vencimiento y liberar recursos','Close expired booking and release resources')}</Button>:null}
  </>:null}
 </section>;
}

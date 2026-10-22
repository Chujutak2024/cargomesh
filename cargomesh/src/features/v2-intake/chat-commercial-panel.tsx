"use client";
import {displayReference} from '@/shared/lib/display-identity';
import styles from "./conversation-chat.module.css";
import {useEffect,useRef,useState} from "react";
import {readCommercialChatState,prepareCommercialAction,confirmCommercialAction,type PreparedCommercialAction} from "./chat-commercial-action";
import type {CommercialIntent} from "@/features/shipper-portal/commercial-intent";
export function ChatCommercialPanel({requestId,organizationId,version,command,blocked,language,onChanged}:{requestId:string;organizationId:string;version:number;command:{kind:"SELECT"|"BOOK";index:number;nonce:number};blocked:boolean;language:"es"|"en";onChanged:()=>void}){
 const [proposal,setProposal]=useState<PreparedCommercialAction|null>(null),[consent,setConsent]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[result,setResult]=useState('');
 const [reload,setReload]=useState(0);
 const keys=useRef(new Map<string,CommercialIntent>()),lock=useRef(false),es=language==='es';
 useEffect(()=>{let cancelled=false;setProposal(null);setConsent(false);setError('');setResult('');
  void readCommercialChatState(requestId,organizationId).then(state=>{if(cancelled)return;if(state.context.request.draftVersion!==version)throw new Error('STALE_DRAFT');setProposal(prepareCommercialAction(state,command.kind,command.index));}).catch(e=>{if(!cancelled)setError(e instanceof Error?e.message:'READ_FAILED');});
  return()=>{cancelled=true;};
 },[requestId,organizationId,version,command.nonce,command.kind,command.index,reload]);
 return <section className={styles.actionReview} aria-label={es?'Revisión de acción comercial':'Commercial action review'}>
  <h3>{command.kind==='SELECT'?(es?'Revisar selección':'Review selection'):(es?'Revisar autorización de reserva':'Review booking authorization')}</h3>
  {!proposal&&!error&&<p role="status">{es?'Consultando ofertas y vigencias…':'Reading current offers and validity…'}</p>}
  {proposal&&<><p>{es?'Alternativa':'Option'} {proposal.optionIndex+1} · USD {(proposal.totalCents/100).toFixed(2)}</p>
   <p>{displayReference(proposal.request.referenceCode,'PED',proposal.request.id)}: {proposal.request.origin.label} → {proposal.request.destination.label}</p><p>{es?'Recojo':'Pickup'}: {proposal.request.pickupWindow.startsAt} — {proposal.request.pickupWindow.endsAt} · {es?'Entrega':'Delivery'}: {proposal.request.deliveryWindow.startsAt} — {proposal.request.deliveryWindow.endsAt}</p>
   <ul>{proposal.offers.map(offer=><li key={offer.id}>{displayReference(offer.data.carrierReference,'OFE',offer.id)}: {offer.data.price.currency} {offer.data.price.amount.toFixed(2)} · {es?'vigente hasta':'valid until'} {offer.data.validity.endsAt}{offer.data.estimatedPickupAt?` · ${es?'Recojo':'Pickup'}: ${new Date(offer.data.estimatedPickupAt).toLocaleString(es?'es-PE':'en-US')}`:''}{offer.data.estimatedDeliveryAt?` · ${es?'Llegada':'Arrival'}: ${new Date(offer.data.estimatedDeliveryAt).toLocaleString(es?'es-PE':'en-US')}`:''}</li>)}</ul>
   <p>{command.kind==='SELECT'?(es?'Seleccionar guarda tu decisión; todavía no autoriza reservas.':'Selecting records your decision; it does not authorize bookings.'):(es?'Autorizar crea reservas por oferta y revalida la capacidad. Se confirman automáticamente si el transportista lo autorizó; de lo contrario, quedan pendientes de su confirmación.':'Authorization creates per-offer bookings and revalidates capacity. They are confirmed automatically when authorized by the carrier; otherwise they await carrier confirmation.')}</p>
   <label><input type="checkbox" checked={consent} disabled={busy||blocked} onChange={e=>setConsent(e.target.checked)}/>{es?'He revisado esta acción, sus importes y consecuencias.':'I reviewed this action, its amounts and consequences.'}</label>
   <button type="button" disabled={!consent||busy||blocked} onClick={()=>{if(lock.current||!consent||blocked)return;lock.current=true;setBusy(true);setError('');
    void confirmCommercialAction(proposal,true,keys.current).then(value=>{setConsent(false);setResult(value.kind==='SELECT'?(es?'Selección persistida y releída. La reserva requiere otra confirmación.':'Selection persisted and reread. Booking requires separate consent.'):(es?`${value.receipts.length} reserva(s) autorizada(s) y releída(s). Revisa el estado de confirmación del transportista en Operaciones.`:`${value.receipts.length} booking(s) authorized and reread. Check carrier confirmation in Operations.`));onChanged();}).catch(e=>{setConsent(false);setError((e instanceof Error?e.message:'ACTION_FAILED')+(es?'. Recarga y revisa los recibos: un fallo de red puede haber ocurrido después de una operación parcial.':'. Reload and review receipts: a network error may follow a partial operation.'));onChanged();}).finally(()=>{lock.current=false;setBusy(false);});
   }}>{busy?(es?'Procesando…':'Processing…'):command.kind==='SELECT'?(es?'Confirmar selección':'Confirm selection'):(es?'Autorizar reservas y preparación':'Authorize bookings and preparation')}</button>
  </>}
  <button type="button" disabled={busy} onClick={()=>setReload(n=>n+1)}>{es?"Actualizar propuesta y volver a revisar":"Refresh proposal and review again"}</button>
  {error&&<p role="alert">{error}</p>}{result&&<p role="status">{result}</p>}
 </section>;
}

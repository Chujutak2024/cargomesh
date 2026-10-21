'use client';
import {useRef,useState} from 'react';
import {Button} from '@/components/ui';
import {useLocale} from '@/features/i18n/locale-provider';
import {BookingPreparationResponseSchema} from '@/shared/schemas/v2/booking-preparation';
import {workspaceFetch} from '@/features/workspace-mode/workspace-fetch';
import {ShipperApiError} from './shipper-api';
export async function prepareBookingCapacity(id:string,version:number,key:string){
 const response=await workspaceFetch(`/api/v2/bookings/${encodeURIComponent(id)}/preparations`,{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json','Idempotency-Key':key},body:JSON.stringify({expectedVersion:version,consent:'PREPARE_AUTHORIZED_CAPACITY'})});
 const body=await response.json().catch(()=>null);if(!response.ok)throw new ShipperApiError(body?.error?.code??'CAPACITY_PREPARATION_FAILED',body?.error?.message??'Capacity could not be prepared.',response.status,response.status>=500);
 const result=BookingPreparationResponseSchema.parse(body).data;if(result.bookingId!==id)throw new Error('INVALID_BOOKING_SCOPE');return result;
}
export function BookingPreparation({id,version,enabled,onChanged}:{id:string;version:number;enabled:boolean;onChanged:()=>void}){
 const {t}=useLocale(),[busy,setBusy]=useState(false),[error,setError]=useState('');const pending=useRef<string|null>(null);
 return <div><p>{t('La autorización solicita una retención temporal. El transportista debe confirmar la capacidad y asignar sus recursos.','Authorization requests a temporary hold. The carrier must confirm capacity and assign its resources.')}</p><Button variant="secondary" disabled={!enabled||busy} isLoading={busy} onClick={()=>{if(busy)return;setBusy(true);setError('');pending.current??=crypto.randomUUID();void prepareBookingCapacity(id,version,pending.current).then(onChanged).catch(e=>setError(e instanceof ShipperApiError?e.code:'CAPACITY_PREPARATION_FAILED')).finally(()=>setBusy(false));}}>{t('Preparar o recuperar capacidad','Prepare or recover capacity')}</Button>{error?<p role="alert">{error}</p>:null}</div>;
}

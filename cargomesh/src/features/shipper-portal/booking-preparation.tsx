'use client';
import {useRef,useState} from 'react';
import {Button} from '@/components/ui';
import {useLocale} from '@/features/i18n/locale-provider';
import {ShipperApiError} from './shipper-api';
import {prepareBookingCapacity} from './booking-preparation-client';
export {prepareBookingCapacity} from './booking-preparation-client';
export function BookingPreparation({id,version,enabled,onChanged}:{id:string;version:number;enabled:boolean;onChanged:()=>void}){
 const {t}=useLocale(),[busy,setBusy]=useState(false),[error,setError]=useState('');const pending=useRef<string|null>(null);
 return <div><p>{t('La capacidad se revalida al preparar la reserva. Se confirma automáticamente si el transportista lo autorizó; de lo contrario, queda pendiente de su confirmación.','Capacity is revalidated when preparing the booking. Confirmation is automatic when authorized by the carrier; otherwise it awaits carrier confirmation.')}</p><Button variant="secondary" disabled={!enabled||busy} isLoading={busy} onClick={()=>{if(busy)return;setBusy(true);setError('');pending.current??=crypto.randomUUID();void prepareBookingCapacity(id,version,pending.current).then(onChanged).catch(e=>setError(e instanceof ShipperApiError?e.code:'CAPACITY_PREPARATION_FAILED')).finally(()=>setBusy(false));}}>{t('Preparar o recuperar capacidad','Prepare or recover capacity')}</Button>{error?<p role="alert">{error}</p>:null}</div>;
}

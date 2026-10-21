'use client';
import {useRef,useState} from 'react';
import {Button} from '@/components/ui';
import {useLocale} from '@/features/i18n/locale-provider';
import {ShipperApiError} from './shipper-api';
import {prepareBookingCapacity} from './booking-preparation-client';
export {prepareBookingCapacity} from './booking-preparation-client';
export function BookingPreparation({id,version,enabled,onChanged}:{id:string;version:number;enabled:boolean;onChanged:()=>void}){
 const {t}=useLocale(),[busy,setBusy]=useState(false),[error,setError]=useState('');const pending=useRef<string|null>(null);
 return <div><p>{t('La autorización solicita una retención temporal. El transportista debe confirmar la capacidad y asignar sus recursos.','Authorization requests a temporary hold. The carrier must confirm capacity and assign its resources.')}</p><Button variant="secondary" disabled={!enabled||busy} isLoading={busy} onClick={()=>{if(busy)return;setBusy(true);setError('');pending.current??=crypto.randomUUID();void prepareBookingCapacity(id,version,pending.current).then(onChanged).catch(e=>setError(e instanceof ShipperApiError?e.code:'CAPACITY_PREPARATION_FAILED')).finally(()=>setBusy(false));}}>{t('Preparar o recuperar capacidad','Prepare or recover capacity')}</Button>{error?<p role="alert">{error}</p>:null}</div>;
}

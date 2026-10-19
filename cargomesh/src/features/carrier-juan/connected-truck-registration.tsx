"use client";
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {ArrowLeft,Building2,ClipboardCheck,Fuel,Truck} from 'lucide-react';
import {FleetInputsV2} from '@/shared/schemas/v2/fleet';
import {RoadEquipmentCodeV2Schema} from '@/shared/schemas/v2/intake-options';
import {mutationReceipt,portalErrorCopy} from '@/features/carrier-portal/api';
import {saveConnectedVehicle} from '@/features/carrier-portal/connected-fleet-client';
import {recordData,recordName,type PortalRecord} from '@/features/carrier-portal/records';
import {registeredAsset} from './truck-registration-model';
import {truckTypes} from './local-truck-preference';
import {TruckPhoto} from './local-draft-controls';
import {operationalPanel} from './carrier-sites';
import s from './operations.module.css';

export function ConnectedTruckRegistration({carrierId,carrierName,serviceId,depots,partners,record,canWrite,back,saved,onBusyChange}:{carrierId:string;carrierName:string;serviceId:string;depots:PortalRecord[];partners:PortalRecord[];record?:PortalRecord;canWrite:boolean;onBusyChange?:(busy:boolean)=>void;back:()=>void;saved:(row:PortalRecord)=>void}){
 const old=record?FleetInputsV2.assets.parse(recordData(record)):null,r=old?.roadVehicle;
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[role,setRole]=useState(old?.role??'LOAD_BEARING');
 const request=useRef<AbortController|null>(null),receipt=useRef<ReturnType<typeof mutationReceipt>|null>(null);
 useEffect(()=>()=>{request.current?.abort();onBusyChange?.(false);},[onBusyChange]);
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(busy||!canWrite)return;
  let value;try{value=registeredAsset(new FormData(event.currentTarget),serviceId,record);}catch(failure){setError(failure instanceof Error?failure.message:'Check vehicle details.');return;}
  const body=record?{expectedVersion:record.version,value}:value;
  receipt.current=mutationReceipt(receipt.current,carrierId+'/'+(record?.id??'new'),body,()=>crypto.randomUUID());
  const controller=new AbortController();request.current=controller;setBusy(true);onBusyChange?.(true);setError('');
  try{const row=await saveConnectedVehicle({carrierId,serviceId,record,value,key:receipt.current.key,signal:controller.signal});if(!controller.signal.aborted)saved(row);}
  catch(failure){if(!controller.signal.aborted)setError(portalErrorCopy(failure,false));}
  finally{if(!controller.signal.aborted){setBusy(false);onBusyChange?.(false);}}
 }
 return <section className={s.root}><div className={s.header}><div><h2>{record?'Edit truck':'New truck'}</h2><p>Save the vehicle to the selected authorized Carrier and service.</p></div><button className={s.mutedButton} disabled={busy} onClick={back}><ArrowLeft size={17}/>Back to fleet</button></div>
 {error?<div role="alert" className={s.error}>{error}</div>:null}
 {!canWrite?<p role="status">Saving requires ADMIN, an active service and complete catalog references.</p>:null}
 <form className={`${s.form} ${operationalPanel}`} onSubmit={submit}>
 <fieldset disabled={busy||!canWrite}><legend><Truck size={19}/>Identification and capacity</legend><div className={s.fields}>
 <label>Vehicle code<input name="code" required pattern="[A-Z][A-Z0-9_]*" defaultValue={old?.code??''} placeholder="CM_401"/><small>Uppercase letters, numbers and underscores.</small></label>
 <label>Plate<input name="plate" required defaultValue={r?.plate??''} placeholder="ABC-123"/></label>
 <label>Brand<input name="brand" defaultValue={r?.brand??''} placeholder="Volvo"/></label><label>Model<input name="model" defaultValue={r?.model??''} placeholder="FH 460"/></label>
 <label>Year<input name="year" disabled placeholder="Pending persistence"/><small>Not stored by the current vehicle contract.</small></label>
 <label>Body type<input name="variant" required list="juan-truck-bodies" defaultValue={r?.bodyType??''}/><datalist id="juan-truck-bodies">{truckTypes.map(type=><option key={type.id} value={type.id}>{type.en}</option>)}</datalist></label>
 <label>Equipment classification<select name="equipment" defaultValue={old?.equipmentType??'BOX_TRUCK'}>{[...new Set([...RoadEquipmentCodeV2Schema.options,...(old?[old.equipmentType]:[])])].map(code=><option key={code}>{code}</option>)}</select><small>Classification follows the backend catalog; body type chooses only the reference illustration.</small></label>
 <label>Resource role<select name="role" value={role} onChange={e=>setRole(e.target.value as typeof role)}><option value="LOAD_BEARING">Load bearing</option><option value="AUXILIARY">Auxiliary — no cargo capacity</option></select></label>
 <label>Useful capacity (kg)<input name="capacity" type="number" required disabled={role==='AUXILIARY'} min="0.01" step="any" defaultValue={old?.usefulCapacityKg??''}/></label><label>Usable volume (m³)<input name="volume" type="number" disabled={role==='AUXILIARY'} min="0.01" step="any" defaultValue={old?.usableVolumeM3??''}/></label>
 <label className={s.wide}>Description and equipment<textarea name="description" disabled rows={2} placeholder="Pending persistence"/></label>
 </div></fieldset>
 <fieldset disabled={busy||!canWrite}><legend><Building2 size={19}/>Carrier and operating base</legend><div className={s.fields}>
 <label>Carrier<input readOnly value={carrierName}/></label><label>Home depot<select name="site" defaultValue={old?.homeDepotId??''}><option value="">Not recorded</option>{depots.map(depot=><option key={depot.id} value={depot.id}>{recordName(depot)}</option>)}</select><small>A home depot does not confirm current presence or service coverage.</small></label>
 <label>Registration date<input name="registeredAt" type="date" defaultValue={r?.registeredAt??''}/></label><label>Operating state<select name="status" defaultValue={old?.operatingStatus??'OUT_OF_SERVICE'}>{['AVAILABLE','IN_SERVICE','MAINTENANCE','OUT_OF_SERVICE'].map(status=><option key={status}>{status}</option>)}</select></label>
 <label className={s.wide}>State / condition note<input name="statusReason" defaultValue={r?.conditionReason??''}/></label>
 <label>Ownership / source<select name="provenance" defaultValue={old?.provenance??'OWN'}>{['OWN','CONTRACTED','PARTNER'].map(value=><option key={value}>{value}</option>)}</select></label>
 <label>Registered partner<select name="partner" defaultValue={old?.partnerId??''}><option value="">Not applicable</option>{partners.map(partner=><option key={partner.id} value={partner.id}>{recordName(partner)}</option>)}</select></label>
 <label className={s.wide}>Source / evidence reference<input name="evidence" defaultValue={old?.evidence??''}/></label>
 </div></fieldset>
 <fieldset disabled={busy||!canWrite}><legend><Fuel size={19}/>Operations and documents</legend><div className={s.fields}>
 <label>Odometer (km)<input name="odometer" type="number" min="0" step="any" defaultValue={r?.odometerKm??''}/></label>
 <label>Fuel level (%)<input name="fuel" disabled placeholder="Pending source"/></label><label>Tank capacity (L)<input name="tank" disabled placeholder="Pending persistence"/></label><label>Consumption (L / 100 km)<input name="consumption" disabled placeholder="Pending source"/></label><label>Insurance valid until<input name="insurance" disabled placeholder="Pending document connection"/></label><label>Inspection valid until<input name="inspection" disabled placeholder="Pending document connection"/></label>
 <fieldset disabled className={s.wide}><legend>Vehicle photo</legend><TruckPhoto photo={null} onChange={()=>{}} t={(_es,en)=>en}/><small>Photo upload and document fields remain visible pending their storage contract; they are not submitted.</small></fieldset>
 </div></fieldset>
 <div className={s.row}><button type="submit" className={s.primary} disabled={busy||!canWrite}><ClipboardCheck size={17}/>{busy?'Saving…':record?'Save revision':'Register truck'}</button><button type="button" disabled={busy} onClick={back}>Cancel</button></div>
 </form></section>;
}

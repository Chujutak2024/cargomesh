"use client";
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { z } from 'zod';
import { Button, Input, Select } from '@/components/ui';
import { FleetInputsV2 } from '@/shared/schemas/v2/fleet';
import { RoadEquipmentCodeV2Schema } from '@/shared/schemas/v2/intake-options';
import { mutationReceipt, portalErrorCopy } from './api';
import { saveConnectedVehicle } from './connected-fleet-client';
import { recordData, recordName, type PortalRecord } from './records';
import s from './connected-fleet.module.css';
type Asset = z.infer<typeof FleetInputsV2.assets>;
export function ConnectedVehicleForm({carrierId,serviceId,record,depots,partners,onSaved,onClose}:{
  carrierId:string;serviceId:string;record?:PortalRecord;depots:PortalRecord[];partners:PortalRecord[];onSaved:(record:PortalRecord)=>void;onClose:()=>void;
}) {
  const [value,setValue]=useState<Asset>(()=>record ? FleetInputsV2.assets.parse(recordData(record)) : {
    schemaVersion:'2.0',serviceId,code:'',mode:'ROAD',equipmentType:'BOX_TRUCK',role:'LOAD_BEARING',usefulCapacityKg:0,
    usableVolumeM3:null,operatingStatus:'OUT_OF_SERVICE',homeDepotId:null,provenance:'OWN',partnerId:null,evidence:null,
    roadVehicle:{plate:'',registrationCode:null,registeredAt:null,brand:null,model:null,variant:null,bodyType:'',usableDimensions:null,grossWeightLimitKg:null,odometerKm:null,conditionReason:null,axleConfig:null}
  });
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const request=useRef<AbortController|null>(null),receipt=useRef<ReturnType<typeof mutationReceipt>|null>(null);
  useEffect(()=>()=>request.current?.abort(),[]);
  const update=(patch:Partial<Asset>)=>setValue(old=>({...old,...patch}));
  const road=(key:string,next:unknown)=>setValue(old=>({...old,roadVehicle:{...old.roadVehicle!,[key]:next}}));
  async function submit(event:FormEvent) {
    event.preventDefault();if(busy)return;
    const checked=FleetInputsV2.assets.safeParse(value);
    if(!checked.success){setError(checked.error.issues.map(issue=>issue.path.join('.')+': '+issue.message).join(' · '));return;}
    const path=carrierId+'/'+(record?.id??'new');const body=record?{expectedVersion:record.version,value:checked.data}:checked.data;
    receipt.current=mutationReceipt(receipt.current,path,body,()=>crypto.randomUUID());
    const controller=new AbortController();request.current=controller;setBusy(true);setError('');
    try {const saved=await saveConnectedVehicle({carrierId,serviceId,value:checked.data,record,key:receipt.current.key,signal:controller.signal});if(!controller.signal.aborted)onSaved(saved);}
    catch(e){if(!controller.signal.aborted)setError(portalErrorCopy(e,false));}
    finally{if(!controller.signal.aborted)setBusy(false);}
  }
  const r=value.roadVehicle!;
  return <form className={s.panel} onSubmit={submit}>
    <h2>{record?'Edit vehicle':'Register vehicle'}</h2><p>Saved to your authorized carrier and service. Operating state does not confirm booking availability.</p>
    <fieldset disabled={busy} className={s.fields}>
      <Input label="Vehicle code" required value={value.code} onChange={e=>update({code:e.target.value})} hint="Uppercase letters, numbers and underscores, e.g. CM_204."/>
      <Input label="Plate" required value={r.plate} onChange={e=>road('plate',e.target.value)}/>
      <Input label="Brand" value={r.brand??''} onChange={e=>road('brand',e.target.value||null)}/>
      <Input label="Model" value={r.model??''} onChange={e=>road('model',e.target.value||null)}/>
      <Select label="Equipment" value={value.equipmentType} onChange={e=>update({equipmentType:e.target.value as Asset['equipmentType']})}>
        {[...new Set([...RoadEquipmentCodeV2Schema.options,value.equipmentType])].map(type=><option key={type} value={type}>{type.replaceAll('_',' ')}</option>)}
      </Select>
      <Input label="Body type" required value={r.bodyType} onChange={e=>road('bodyType',e.target.value)}/>
      <Select label="Resource role" value={value.role} onChange={e=>update({role:e.target.value as Asset['role'],...(e.target.value==='AUXILIARY'?{usefulCapacityKg:0,usableVolumeM3:null}:{})})}><option value="LOAD_BEARING">Load bearing</option><option value="AUXILIARY">Auxiliary — no load capacity</option></Select>
      <Input label="Useful capacity (kg)" required type="number" min={value.role==='AUXILIARY'?0:0.01} step="any" disabled={value.role==='AUXILIARY'} value={value.usefulCapacityKg} onChange={e=>update({usefulCapacityKg:Number(e.target.value)})}/>
      <Input label="Usable volume (m³)" type="number" min="0.01" step="any" disabled={value.role==='AUXILIARY'} value={value.usableVolumeM3??''} onChange={e=>update({usableVolumeM3:e.target.value===''?null:Number(e.target.value)})}/>
      <Input label="Gross weight limit (kg)" type="number" min="0.01" step="any" value={r.grossWeightLimitKg??''} onChange={e=>road('grossWeightLimitKg',e.target.value===''?null:Number(e.target.value))}/>
      <Input label="Odometer (km)" type="number" min="0" step="any" value={r.odometerKm??''} onChange={e=>road('odometerKm',e.target.value===''?null:Number(e.target.value))}/>
      <Input label="Registration code" value={r.registrationCode??''} onChange={e=>road('registrationCode',e.target.value||null)}/>
      <Input label="Axle configuration" value={r.axleConfig??''} onChange={e=>road('axleConfig',e.target.value||null)}/>
      <Input label="Variant" value={r.variant??''} onChange={e=>road('variant',e.target.value||null)}/>
      {(['length','width','height'] as const).map(dimension=><Input key={dimension} label={'Usable '+dimension+' (cm)'} type="number" min="0.01" step="any" value={r.usableDimensions?.[dimension]??''} onChange={e=>road('usableDimensions',{length:0,width:0,height:0,...r.usableDimensions,[dimension]:e.target.value===''?0:Number(e.target.value)})}/>)}
      {r.usableDimensions?<Button type="button" variant="secondary" onClick={()=>road('usableDimensions',null)}>Clear dimensions</Button>:null}
      <Input label="Registration date" type="date" value={r.registeredAt??''} onChange={e=>road('registeredAt',e.target.value||null)}/>
      <Select label="Operating state" value={value.operatingStatus} onChange={e=>update({operatingStatus:e.target.value as Asset['operatingStatus']})}>{['OUT_OF_SERVICE','AVAILABLE','IN_SERVICE','MAINTENANCE'].map(type=><option key={type} value={type}>{type.replaceAll('_',' ')}</option>)}</Select>
      <Input label="State / condition note" value={r.conditionReason??''} onChange={e=>road('conditionReason',e.target.value||null)}/>
      <Select label="Home depot" value={value.homeDepotId??''} onChange={e=>update({homeDepotId:e.target.value||null})}><option value="">Not recorded</option>{depots.map(depot=><option key={depot.id} value={depot.id}>{recordName(depot)}</option>)}</Select>
      <Select label="Ownership / source" value={value.provenance} onChange={e=>update({provenance:e.target.value as Asset['provenance'],partnerId:e.target.value==='PARTNER'?value.partnerId:null})}>{['OWN','CONTRACTED','PARTNER'].map(type=><option key={type} value={type}>{type}</option>)}</Select>
      {value.provenance==='PARTNER'?<Select label="Registered partner" required value={value.partnerId??''} onChange={e=>update({partnerId:e.target.value||null})}><option value="">Select partner</option>{partners.map(partner=><option key={partner.id} value={partner.id}>{recordName(partner)}</option>)}</Select>:null}
      <Input label="Source / evidence reference" value={value.evidence??''} onChange={e=>update({evidence:e.target.value||null})}/>
    </fieldset>
    {error?<p role="alert" className={s.error}>{error}</p>:null}
    <div className={s.actions}><Button type="submit" isLoading={busy} loadingLabel="Saving…">{record?'Save revision':'Register vehicle'}</Button><Button variant="secondary" type="button" disabled={busy} onClick={onClose}>Cancel</Button></div>
  </form>;
}

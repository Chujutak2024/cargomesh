"use client";
import {useState} from 'react';
import {ContractForm} from '@/features/carrier-portal/contract-form';
import {recordData,recordName,type PortalRecord} from '@/features/carrier-portal/records';
import {areaLabel,laneChoices,siteEditorPath,siteEditorSchema,validateSiteSaved,type SiteEditorKind} from './sites-model';
import s from './operations.module.css';

export function SiteCatalogEditor({kind,carrierId,serviceId,serviceMode,record,areas,partners,onSaved,onClose}:{
 kind:SiteEditorKind;carrierId:string;serviceId:string;serviceMode:string;record?:PortalRecord;areas:PortalRecord[];partners:PortalRecord[];
 onSaved:(row:PortalRecord)=>void;onClose:()=>void;
}) {
 const initial=record?recordData(record):{};
 const [source,setSource]=useState(String(initial.source??'OWN')),[partner,setPartner]=useState(String(initial.partnerId??''));
 const [pickup,setPickup]=useState(String(initial.pickupAreaId??'')),[delivery,setDelivery]=useState(String(initial.deliveryAreaId??''));
 const pickups=laneChoices(areas,'PICKUP'),deliveries=laneChoices(areas,'DELIVERY');
 // Preserve an existing authorized endpoint for revision, even if it has since been deactivated.
 const choices=(rows:PortalRecord[],selected:string)=>rows.some(r=>r.id===selected)?rows:rows.concat(areas.filter(r=>r.id===selected));
 const fixed=kind==='areas'?{source,partnerId:source==='OWN'?null:partner}:kind==='lanes'?{pickupAreaId:pickup,deliveryAreaId:delivery,mode:serviceMode}:{};
 const ready=kind==='depots'||kind==='areas'&&(source==='OWN'||partners.some(p=>p.id===partner))||kind==='lanes'&&areas.some(a=>a.id===pickup)&&areas.some(a=>a.id===delivery);
 let saved:PortalRecord|undefined;
 return <section className={s.form}>
 {kind==='areas'?<div className={s.fields}><label>Fulfilment source<select value={source} onChange={e=>{setSource(e.target.value);setPartner('');}}><option value="OWN">Own</option><option value="PARTNER">Registered partner</option></select></label>{source==='PARTNER'?<label>Authorized partner<select value={partner} onChange={e=>setPartner(e.target.value)}><option value="">Select partner</option>{partners.map(p=><option key={p.id} value={p.id}>{recordName(p)} · {String(recordData(p).status)}</option>)}</select></label>:null}</div>:null}
 {kind==='lanes'?<div className={s.fields}><label>Pickup area<select value={pickup} onChange={e=>setPickup(e.target.value)}><option value="">Select pickup area</option>{choices(pickups,pickup).map(a=><option key={a.id} value={a.id}>{areaLabel(a)}</option>)}</select></label><label>Delivery area<select value={delivery} onChange={e=>setDelivery(e.target.value)}><option value="">Select delivery area</option>{choices(deliveries,delivery).map(a=><option key={a.id} value={a.id}>{areaLabel(a)}</option>)}</select></label></div>:null}
 {ready?<ContractForm key={kind+JSON.stringify(fixed)} schema={siteEditorSchema(kind,fixed)} initial={record?recordData(record):undefined}
  path={siteEditorPath(carrierId,serviceId,kind,record)} revision={record?.version} title={(record?'Revise ':'Create ')+(kind==='depots'?'depot':kind==='areas'?'service area':'directed connection')}
  hiddenReviewFields={Object.keys(fixed)} validateSaved={raw=>{saved=validateSiteSaved(kind,carrierId,serviceId,record,raw);}} onSaved={()=>{if(saved)onSaved(saved);}} onClose={onClose}/>
  :<><p>Select references from this authorized catalog. Missing references cannot be entered manually.</p><button onClick={onClose}>Close editor</button></>}
 </section>;
}

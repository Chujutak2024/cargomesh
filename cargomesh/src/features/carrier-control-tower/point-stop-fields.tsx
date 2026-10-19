'use client';
import {useEffect,useState} from 'react';
import {Input,Select,Button} from '@/components/ui';
import {readFleetResource} from '@/features/carrier-portal/fleet-client';
import {recordData,type PortalRecord} from '@/features/carrier-portal/records';
import {PortalApiError} from '@/features/carrier-portal/api';
import type {StopFields} from './point-plan-client';
export function PointStopFields({carrierId,origin,destination,geocodingConfigured,onChange,onDenied}:{carrierId:string;origin:StopFields;destination:StopFields;geocodingConfigured:boolean;onChange:(role:'origin'|'destination',fields:StopFields)=>void;onDenied:(message:string)=>void}){
 const [sites,setSites]=useState<PortalRecord[]>([]),[state,setState]=useState('Loading saved Carrier sites…'),[retry,setRetry]=useState(0);
 useEffect(()=>{const controller=new AbortController();setSites([]);setState('Loading saved Carrier sites…');
  void readFleetResource(carrierId,'depots',controller.signal).then(result=>{if(controller.signal.aborted)return;if(result.truncated){setState('The saved-site catalog is incomplete. Refresh before choosing a site.');return;}setSites(result.records);setState(result.records.length?'':'No saved Carrier sites.');})
   .catch(error=>{if(controller.signal.aborted)return;setState('Saved sites could not be loaded.');if(error instanceof PortalApiError&&[401,403].includes(error.status))onDenied('Your session cannot read this Carrier’s planning sites.');});
  return()=>controller.abort();
 },[carrierId,retry,onDenied]);
 return <div style={{gridColumn:'1 / -1'}}><p>Choose the pickup and delivery properties or access points. Coordinates are planning inputs, not GPS positions. Saved sites do not grant coverage.</p>
  {!geocodingConfigured?<p role="status">Address and coordinate resolution needs server Geocoding configuration. You can use saved active Carrier sites with recorded coordinates.</p>:null}
  {state?<p role="status">{state} <Button type="button" variant="secondary" size="compact" onClick={()=>setRetry(n=>n+1)}>Refresh sites</Button></p>:null}
  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,260px),1fr))',gap:16}}>{(['origin','destination'] as const).map(role=>{
   const fields=role==='origin'?origin:destination,title=role==='origin'?'Pickup':'Delivery';
   const update=(patch:Partial<StopFields>)=>onChange(role,{...fields,...patch,confirmed:false});
   return <section key={role} aria-label={title+' location'} style={{border:'1px solid var(--cm-color-line)',borderRadius:10,padding:12,display:'grid',alignContent:'start',gap:10}}>
    <h3>{title} location</h3><Select label={title+' location source'} value={fields.kind} onChange={event=>update({kind:event.target.value as StopFields['kind'],depot:''})}><option value="DEPOT">Saved Carrier site</option><option value="ADDRESS">Street address</option><option value="COORDINATES">Exact coordinates</option></Select>
    {fields.kind==='DEPOT'?<Select label={title+' saved site'} value={fields.depot} onChange={event=>update({depot:event.target.value})}><option value="">Select a site</option>{sites.map(site=>{const value=recordData(site),loc=value.location as {lat?:unknown;lng?:unknown}|undefined,usable=value.active===true&&typeof loc?.lat==='number'&&typeof loc.lng==='number';return <option key={site.id} value={site.id+'@'+site.version} disabled={!usable}>{String(value.name??value.code??site.id.slice(0,8))}{!usable?' · inactive or coordinates missing':''}</option>;})}</Select>:fields.kind==='ADDRESS'?<Input label={title+' street address'} value={fields.address} onChange={event=>update({address:event.target.value})} placeholder="Street, number, city, country" maxLength={500} required/>:<><Input label={title+' point label'} value={fields.label} onChange={event=>update({label:event.target.value})} placeholder="Warehouse loading entrance" maxLength={200} required/><Input label={title+' latitude'} inputMode="decimal" value={fields.lat} onChange={event=>update({lat:event.target.value})} placeholder="-12.123456" required/><Input label={title+' longitude'} inputMode="decimal" value={fields.lng} onChange={event=>update({lng:event.target.value})} placeholder="-77.123456" required/></>}
    <label style={{display:'flex',alignItems:'flex-start',gap:8}}><input type="checkbox" checked={fields.confirmed} onChange={event=>onChange(role,{...fields,confirmed:event.target.checked})}/><span>I confirm this is the intended {title.toLowerCase()} location. Vehicle access still requires review.</span></label>
   </section>;
  })}</div>
 </div>;
}

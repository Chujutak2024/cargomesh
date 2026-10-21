'use client';
import {useEffect,useRef,useState} from 'react';
import {z} from 'zod';
import {Button,Input,Select} from '@/components/ui';
import type {CarrierPortalAccessV2} from '@/shared/schemas/v2/carrier-portal';
import {QuotePolicyRecordSchema,SaveQuotePolicySchema,type QuotePolicyValue} from '@/shared/schemas/v2/quote-automation';
import {portalRequest,portalErrorCopy} from './api';
import {readFleetResource} from './fleet-client';
import {recordName,type PortalRecord} from './records';
import s from './quote-policy.module.css';
type Policy=z.infer<typeof QuotePolicyRecordSchema>;
const empty={provenanceStatus:'SIMULATED',basis:'PER_TRIP',baseAmount:'',ratePerKm:'0',minimumAmount:'0',fuelAmount:'0',tollAmount:'0',handlingAmount:'0',taxAmount:'0',validityMinutes:'60',confirmationMinutes:'30',validUntil:'',terms:'',active:false,autoIssue:false};
export function QuotePolicyPanel({carrier}:{carrier:CarrierPortalAccessV2}){
 const [policies,setPolicies]=useState<Policy[]>([]),[services,setServices]=useState<PortalRecord[]>([]),[lanes,setLanes]=useState<PortalRecord[]>([]);
 const [serviceId,setServiceId]=useState(''),[laneId,setLaneId]=useState(''),[fields,setFields]=useState(empty),[consent,setConsent]=useState(false),[busy,setBusy]=useState(false),[loaded,setLoaded]=useState(false),[lanesLoaded,setLanesLoaded]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState(false);
 const intent=useRef<{payload:string;key:string}|null>(null);const endpoint=`/api/v2/carrier-portal/carriers/${encodeURIComponent(carrier.carrierId)}/quote-policies`;
 useEffect(()=>{const c=new AbortController();setLoaded(false);setError('');void Promise.all([portalRequest(endpoint,{signal:c.signal}),readFleetResource(carrier.carrierId,'services',c.signal)]).then(([r,page])=>{if(c.signal.aborted)return;if(page.truncated)throw new Error('PARTIAL_CATALOG');setPolicies(z.array(QuotePolicyRecordSchema).parse(r.data));setServices(page.records);setLoaded(true);}).catch(e=>{if(!c.signal.aborted)setError(portalErrorCopy(e,false));});return()=>c.abort();},[carrier.carrierId,endpoint]);
 useEffect(()=>{const c=new AbortController();setLanes([]);setLaneId('');setLanesLoaded(false);if(serviceId)void readFleetResource(carrier.carrierId,'lanes',c.signal,fetch,serviceId).then(page=>{if(c.signal.aborted)return;if(page.truncated)throw new Error('PARTIAL_CATALOG');setLanes(page.records);setLanesLoaded(true);}).catch(e=>{if(!c.signal.aborted)setError(portalErrorCopy(e,false));});return()=>c.abort();},[carrier.carrierId,serviceId]);
 const current=policies.find(p=>p.serviceId===serviceId&&p.laneId===laneId);
 useEffect(()=>{setConsent(false);setSaved(false);if(!current){setFields(empty);return;}const value=current.value;setFields({provenanceStatus:value.provenanceStatus,basis:value.basis,baseAmount:String(value.baseAmount),ratePerKm:String(value.ratePerKm),minimumAmount:String(value.minimumAmount),fuelAmount:String(value.fuelAmount),tollAmount:String(value.tollAmount),handlingAmount:String(value.handlingAmount),taxAmount:String(value.taxAmount),validityMinutes:String(value.validityMinutes),confirmationMinutes:String(value.confirmationMinutes),validUntil:localDateTime(value.validUntil),terms:value.terms,active:value.active,autoIssue:value.autoIssue});},[serviceId,laneId,current]);
 function field<K extends keyof typeof empty>(key:K,value:(typeof empty)[K]){setFields(f=>({...f,[key]:value}));setConsent(false);setSaved(false);}
 async function save(){if(busy||!consent||carrier.role!=='ADMIN')return;setBusy(true);setError('');setSaved(false);try{
  const value:QuotePolicyValue={schemaVersion:'2.0',serviceId,laneId,active:fields.active,autoIssue:fields.autoIssue,basis:fields.basis as QuotePolicyValue['basis'],baseAmount:Number(fields.baseAmount),ratePerKm:Number(fields.ratePerKm),minimumAmount:Number(fields.minimumAmount),fuelAmount:Number(fields.fuelAmount),tollAmount:Number(fields.tollAmount),handlingAmount:Number(fields.handlingAmount),taxAmount:Number(fields.taxAmount),validityMinutes:Number(fields.validityMinutes),confirmationMinutes:Number(fields.confirmationMinutes),validUntil:new Date(fields.validUntil).toISOString(),terms:fields.terms,provenanceStatus:fields.provenanceStatus as QuotePolicyValue['provenanceStatus'],acknowledgeAuthority:true};
  const input=SaveQuotePolicySchema.parse({expectedVersion:current?.version??0,value}),payload=JSON.stringify(input);
  if(intent.current?.payload!==payload)intent.current={payload,key:crypto.randomUUID()};
  const r=await portalRequest(endpoint,{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':intent.current!.key},body:payload});
  const policy=QuotePolicyRecordSchema.parse(r.data);if(policy.carrierId!==carrier.carrierId)throw new Error('INVALID_SCOPE');
  setPolicies(rows=>[...rows.filter(p=>p.id!==policy.id),policy]);setSaved(true);setConsent(false);
 }catch(e){setError(e instanceof z.ZodError?'Check tariff amounts, scope and validity.':portalErrorCopy(e,false));}finally{setBusy(false);}}
 const readonly=carrier.role!=='ADMIN'||busy;
 return <details className={s.panel}><summary>Automatic quote policy</summary><p>USD tariff per service and directed lane. Carrier administrator approval is required.</p>
  {error?<p role="alert">{error}</p>:null}
  <div className={s.grid}><Select label="Transport service" value={serviceId} disabled={!loaded||busy} onChange={e=>setServiceId(e.target.value)}><option value="">Select service</option>{services.map(row=><option key={row.id} value={row.id}>{recordName(row)}</option>)}</Select>
  <Select label="Directed lane" value={laneId} disabled={!lanesLoaded||busy} onChange={e=>setLaneId(e.target.value)}><option value="">Select lane</option>{lanes.map(row=><option key={row.id} value={row.id}>{recordName(row)}</option>)}</Select></div>
  {laneId?<><div className={s.grid}><Select label="Calculation" value={fields.basis} disabled={readonly} onChange={e=>{field('basis',e.target.value);if(e.target.value==='PER_TRIP')field('ratePerKm','0');}}><option value="PER_TRIP">Per trip</option><option value="PER_KM">Base + per km</option></Select>
   <Select label="Tariff evidence" value={fields.provenanceStatus} disabled={readonly} onChange={e=>field('provenanceStatus',e.target.value)}><option value="SIMULATED">Synthetic demo</option><option value="VERIFIED">Verified commercial tariff</option></Select>
   {(['baseAmount','ratePerKm','minimumAmount','fuelAmount','tollAmount','handlingAmount','taxAmount'] as const).map((key,i)=><Input key={key} label={['Base (USD)','Rate / km (USD)','Minimum transport (USD)','Fuel (USD)','Tolls (USD)','Handling (USD)','Tax (USD)'][i]} type="number" min="0" step="0.01" value={fields[key]} disabled={readonly||key==='ratePerKm'&&fields.basis==='PER_TRIP'} onChange={e=>field(key,e.target.value)}/>)}
   <Input label="Offer validity (minutes)" type="number" min="5" max="1440" value={fields.validityMinutes} disabled={readonly} onChange={e=>field('validityMinutes',e.target.value)}/>
   <Input label="Confirmation window (minutes)" type="number" min="5" max="1440" value={fields.confirmationMinutes} disabled={readonly} onChange={e=>field('confirmationMinutes',e.target.value)}/>
   <Input label="Policy expiry (local time)" type="datetime-local" value={fields.validUntil} disabled={readonly} onChange={e=>field('validUntil',e.target.value)}/>
   <Input label="Commercial terms" value={fields.terms} disabled={readonly} onChange={e=>field('terms',e.target.value)}/></div>
   <div className={s.options}><label><input type="checkbox" checked={fields.active} disabled={readonly} onChange={e=>field('active',e.target.checked)}/> Active policy</label><label><input type="checkbox" checked={fields.autoIssue} disabled={readonly} onChange={e=>field('autoIssue',e.target.checked)}/> Issue quotes automatically</label></div>
   {carrier.role==='ADMIN'?<><label><input type="checkbox" checked={consent} disabled={busy} onChange={e=>setConsent(e.target.checked)}/> I authorize this tariff and its automatic issuance on behalf of the carrier.</label><Button disabled={busy||!consent} isLoading={busy} onClick={()=>void save()}>Save approved policy</Button></>:<p>Only a carrier administrator can approve changes.</p>}
   {saved?<p role="status">Policy saved.</p>:null}</>:null}
 </details>;
}
function localDateTime(value:string){const d=new Date(value);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);}

"use client";
import {useEffect,useState} from 'react';
import {Button,Select} from '@/components/ui';
import {DepotPolicyV2Schema,DepotAppointmentV2Schema,DepotSlotV2Schema,DepotDecisionV2Schema,parseDepotRecord,type DepotPolicyV2} from '@/shared/schemas/v2/depot-operations';
import {EquipmentCodeV2Schema} from '@/shared/schemas/v2/freight-request';
import {ContractForm,DataValue} from './contract-form';
import {operationalSchema} from './operational-form';
import {portalRequest,portalErrorCopy,PortalApiError} from './api';
import {readFleetResource} from './fleet-client';
import {recordData,recordName,type PortalRecord} from './records';
import s from './connected-fleet.module.css';
type DepotRecord=ReturnType<typeof parseDepotRecord>;
export function DepotOperationsWorkspace({carrierId,depots,services,role,partial}:{carrierId:string;depots:PortalRecord[];services:PortalRecord[];role:string;partial:boolean}){
 const [depotId,setDepotId]=useState(''),[policy,setPolicy]=useState<DepotRecord|null>(null),[appointments,setAppointments]=useState<DepotRecord[]>([]),[executions,setExecutions]=useState<PortalRecord[]>([]);
 const [loading,setLoading]=useState(false),[error,setError]=useState(''),[loaded,setLoaded]=useState(false),[refresh,setRefresh]=useState(0),[dataPartial,setDataPartial]=useState(false);
 const [mode,setMode]=useState<'policy'|'appointment'|'check'|null>(null),[editing,setEditing]=useState<DepotRecord|undefined>(),[selectedServices,setSelectedServices]=useState<string[]>([]);
 const [serviceId,setServiceId]=useState(''),[resourceCode,setResourceCode]=useState(''),[activity,setActivity]=useState(''),[equipmentType,setEquipmentType]=useState(''),[executionId,setExecutionId]=useState('');
 const [decision,setDecision]=useState<ReturnType<typeof DepotDecisionV2Schema.parse>|null>(null);
 const base='/api/v2/carrier-portal/carriers/'+carrierId+'/depots/'+depotId+'/operations';
 useEffect(()=>{const controller=new AbortController();setPolicy(null);setAppointments([]);setExecutions([]);setMode(null);setEditing(undefined);setError('');setLoaded(false);setDecision(null);setServiceId('');setResourceCode('');setActivity('');setEquipmentType('');setExecutionId('');setSelectedServices([]);
  if(!depotId)return()=>controller.abort();setLoading(true);
  void Promise.all([portalRequest(base,{signal:controller.signal}),portalRequest(base+'/appointments',{signal:controller.signal}),readFleetResource(carrierId,'executions',controller.signal)]).then(([p,a,e])=>{
   if(controller.signal.aborted)return;
   const record=p.data===null?null:parseDepotRecord('policy',p.data);
   const rows=(Array.isArray(a.data)?a.data:[]).map(raw=>parseDepotRecord('appointment',raw));
   if(!Array.isArray(a.data)||[...(record?[record]:[]),...rows].some(r=>r.carrierId!==carrierId||r.depotId!==depotId))throw new PortalApiError(502,'INVALID_RESPONSE');
   setPolicy(record);setAppointments(rows);setExecutions(e.records);setDataPartial(a.meta?.partial===true||e.truncated);setSelectedServices(record?(record.value as DepotPolicyV2).serviceIds:[]);setLoaded(true);
  }).catch(e=>{if(!controller.signal.aborted)setError(e instanceof PortalApiError&&e.code==='DEPOT_OPERATIONS_NOT_INSTALLED'?'Depot operations database migration is pending in this environment. Existing depot and coverage records remain available.':portalErrorCopy(e,false));}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return()=>controller.abort();
 },[carrierId,depotId,base,refresh]);
 const rules=policy?.value as DepotPolicyV2|undefined;
 const allowedServices=services.filter(r=>rules?.serviceIds.includes(r.id));
 const resource=rules?.resources.find(r=>r.code===resourceCode);
 const writable=role==='ADMIN'&&loaded&&!partial&&!dataPartial;
 const slotReady=!!resource&&allowedServices.some(s=>s.id===serviceId)&&resource.activities.includes(activity as 'LOAD')&&EquipmentCodeV2Schema.safeParse(equipmentType).success;
 const slotFixed={schemaVersion:'2.0',serviceId,resourceCode,activity,equipmentType};
 const activeExecutions=executions.filter(r=>recordData(r).serviceId===serviceId&&['PLANNED','IN_PROGRESS'].includes(String(r.status)));
 function saved(){setRefresh(n=>n+1);}
 const validate=(kind:'policy'|'appointment')=>(raw:unknown)=>{const r=parseDepotRecord(kind,raw);if(r.carrierId!==carrierId||r.depotId!==depotId||editing&&r.id!==editing.id)throw new PortalApiError(502,'INVALID_RESPONSE');};
 return <section className={s.panel}><h2>Depot operating limits & appointments</h2><p>Operating limits apply to this depot's handling resources. Service coverage and vehicle/driver availability remain separate checks.</p>
 <Select label="Depot" value={depotId} onChange={e=>setDepotId(e.target.value)}><option value="">Select depot</option>{depots.map(d=><option key={d.id} value={d.id}>{recordName(d)}</option>)}</Select>
 {error?<div role="alert"><p>{error}</p><Button variant="secondary" onClick={()=>setRefresh(n=>n+1)}>Retry depot operations</Button></div>:loading?<p role="status">Loading depot rules and appointments…</p>:!depotId?<p>Select a depot to inspect its recorded limits.</p>:loaded?<>
 {dataPartial||partial?<p className={s.notice}>Partial catalog. Editing is disabled.</p>:null}
 <div className={s.actions}><Button variant="secondary" onClick={()=>setRefresh(n=>n+1)}>Refresh depot operations</Button><Button disabled={!writable} onClick={()=>{setEditing(undefined);setMode('policy');}}> {policy?'Edit operating limits':'Define operating limits'}</Button></div>
 {mode==='policy'?<><fieldset disabled={!!mode&&role!=='ADMIN'}><legend>Services supported by this depot</legend>{services.map(service=><label key={service.id}><input type="checkbox" checked={selectedServices.includes(service.id)} onChange={e=>setSelectedServices(ids=>e.target.checked?[...ids,service.id]:ids.filter(id=>id!==service.id))}/>{recordName(service)}</label>)}</fieldset>
 {selectedServices.length?<ContractForm key={'policy-'+depotId+'-'+selectedServices.join(',')} schema={operationalSchema(DepotPolicyV2Schema,{schemaVersion:'2.0',serviceIds:selectedServices})} initial={policy?.value} path={base} revision={policy?.version??0} hiddenReviewFields={['serviceIds']} title="Depot operating policy" onSaved={saved} onClose={()=>setMode(null)} validateSaved={validate('policy')}/>:<p>Select at least one supported service. This relation does not grant service coverage.</p>}</>:<>
 {rules?<><p>Policy revision {policy?.version} · {rules.active?'Active':'Inactive'} · source {rules.evidence?.provenanceStatus??'UNKNOWN'}</p><DataValue value={rules.operatingHours} es={false}/><div className={s.cards}>{rules.resources.map(r=><article key={r.code} className={s.card}><h3>{r.name}</h3><p>{r.activities.join(' · ')}</p><p>Concurrent vehicle limit: {r.maxConcurrentVehicles??'Unknown'}</p><p>Equipment: {r.equipmentTypes?.join(' · ')??'Unknown'}</p></article>)}</div><h3>Blocked windows</h3><DataValue value={rules.blockedWindows} es={false}/>
 <div className={s.context}><Select label="Supported service" value={serviceId} onChange={e=>{setServiceId(e.target.value);setMode(null);setExecutionId('');setDecision(null);}}><option value="">Select service</option>{allowedServices.map(r=><option key={r.id} value={r.id}>{recordName(r)}</option>)}</Select><Select label="Handling resource" value={resourceCode} onChange={e=>{setResourceCode(e.target.value);setMode(null);setActivity('');setDecision(null);}}><option value="">Select resource</option>{rules.resources.map(r=><option key={r.code} value={r.code}>{r.name}</option>)}</Select><Select label="Activity" value={activity} onChange={e=>{setActivity(e.target.value);setMode(null);setDecision(null);}}><option value="">Select activity</option>{resource?.activities.map(a=><option key={a} value={a}>{a}</option>)}</Select><Select label="Equipment type" value={equipmentType} onChange={e=>{setEquipmentType(e.target.value);setMode(null);setDecision(null);}}><option value="">Select equipment</option>{EquipmentCodeV2Schema.options.map(a=><option key={a} value={a}>{a.replaceAll('_',' ')}</option>)}</Select><Select label="Linked execution (optional)" value={executionId} onChange={e=>{setExecutionId(e.target.value);setMode(null);}}><option value="">No linked execution</option>{activeExecutions.map(r=><option key={r.id} value={r.id}>{recordName(r)}</option>)}</Select></div>
 <div className={s.actions}><Button variant="secondary" disabled={!slotReady} onClick={()=>{setEditing(undefined);setMode('check');}}>Check additional capacity</Button><Button disabled={!writable||!slotReady} onClick={()=>{setEditing(undefined);setMode('appointment');}}>Register appointment</Button></div>
 </>:<p>No operating policy recorded. Hours and capacity remain unknown.</p>}
 {mode==='check'?<ContractForm schema={operationalSchema(DepotSlotV2Schema,slotFixed)} path={base+'/availability'} hiddenReviewFields={Object.keys(slotFixed)} title="Check additional depot capacity — no reservation" onSaved={()=>{}} onClose={()=>setMode(null)} validateSaved={raw=>setDecision(DepotDecisionV2Schema.parse(raw))}/>:null}
 {mode==='appointment'?<ContractForm key={editing?.id??'new'} schema={operationalSchema(DepotAppointmentV2Schema,editing?{schemaVersion:'2.0',serviceId:(editing.value as Record<string,unknown>).serviceId,resourceCode:(editing.value as Record<string,unknown>).resourceCode,activity:(editing.value as Record<string,unknown>).activity,equipmentType:(editing.value as Record<string,unknown>).equipmentType,executionId:(editing.value as Record<string,unknown>).executionId}:{...slotFixed,executionId:executionId||null})} initial={editing?.value} path={base+'/appointments'+(editing?'/'+editing.id+'/revisions':'')} revision={editing?.version??0} hiddenReviewFields={Object.keys(slotFixed).concat('executionId')} title={editing?'Revise depot appointment':'Register depot appointment'} onSaved={saved} onClose={()=>setMode(null)} validateSaved={validate('appointment')}/>:null}
 {decision?<div role="status"><h3>Additional capacity: {decision.status}</h3><p>Source: {decision.provenanceStatus} · policy revision {decision.policyVersion??'Unknown'}</p><ul>{decision.reasons.map(r=><li key={r}>{r.replaceAll('_',' ')}</li>)}</ul><p>This check does not reserve a slot. Confirmation rechecks current occupancy atomically.</p></div>:null}
 <h3>Appointments</h3><div className={s.cards}>{appointments.map(a=>{const v=a.value as Record<string,unknown>;return <article key={a.id} className={s.card}><h4>{String(v.resourceCode)} · {String(v.activity)}</h4><p>{String(v.status)} · revision {a.version}</p><DataValue value={v.window} es={false}/><p>{String(v.units)} vehicle(s) · {String(v.reason)}</p>{writable&&!['CANCELLED','COMPLETED'].includes(String(v.status))?<Button variant="secondary" onClick={()=>{setEditing(a);setMode('appointment');}}>Edit / cancel appointment</Button>:null}</article>;})}</div>{!appointments.length?<p>No appointments recorded.</p>:null}
 </>}
 </>:null}
 </section>;
}

"use client";
import {useEffect,useState} from 'react';
import {Button} from '@/components/ui';
import {readFleetResource} from './fleet-client';
import {portalErrorCopy} from './api';
import {recordData,recordName,recordStatus,validCarrierId,type PortalRecord} from './records';
import {DataValue} from './contract-form';
import {carrierResourceKeys,type CarrierWorkspaceView} from './carrier-workspace-model';
import s from './connected-fleet.module.css';

const title=(row:PortalRecord,key:string)=>validCarrierId(recordName(row))?({opportunities:'Opportunity',offers:'Offer',executions:'Operation'}[key]??'Record')+' · '+row.id.slice(0,8).toUpperCase():recordName(row);
const detailLabels:Record<string,string>={carrierReference:'Carrier reference',responseDeadline:'Respond by',response:'Response',price:'Price',validUntil:'Valid until',transitMinutes:'Transit (minutes)',startsAt:'Starts at',endsAt:'Ends at',movementStatus:'Movement status',status:'Status'};
const labels:Record<string,string>={opportunities:'Received opportunities',offers:'Carrier offers',executions:'Transport executions'};
export function ConnectedCarrierInbox({carrierId,view}:{carrierId:string;view:CarrierWorkspaceView}) {
  const [groups,setGroups]=useState<Array<{key:string;records:PortalRecord[];truncated:boolean}>|null>(null);
  const [error,setError]=useState(''),[refresh,setRefresh]=useState(0),[selected,setSelected]=useState<{record:PortalRecord;key:string}|null>(null);
  useEffect(()=>{
    const controller=new AbortController();setGroups(null);setSelected(null);setError('');
    void Promise.all(carrierResourceKeys(view).map(async key=>({key,...await readFleetResource(carrierId,key,controller.signal)})))
      .then(result=>{if(!controller.signal.aborted)setGroups(result);})
      .catch(e=>{if(!controller.signal.aborted)setError(portalErrorCopy(e,false));});
    return()=>controller.abort();
  },[carrierId,view,refresh]);
  return <div className={s.workspace}>
    <p className={s.notice}>Customer requests remain owned by the customer. An opportunity is a pending commercial task; it does not reserve a truck or confirm a scheduled service.</p>
    <Button variant="secondary" onClick={()=>setRefresh(n=>n+1)}>Refresh authorized records</Button>
    {error?<p role="alert">{error}</p>:!groups?<p role="status">Loading carrier records…</p>:groups.map(group=><section className={s.panel} key={group.key}><h2>{labels[group.key]} · {group.records.length}{group.truncated?'+':''}</h2><p>Counts apply to loaded records.</p>
      {group.records.length?<div className={s.cards}>{group.records.map(row=><article className={s.card} key={row.id}><h3>{title(row,group.key)}</h3><p><DataValue value={recordStatus(row)} es={false}/></p><p>Updated: {new Date(row.updatedAt).toLocaleString('en-US')}</p><Button variant="secondary" onClick={()=>setSelected({record:row,key:group.key})}>View recorded details</Button></article>)}</div>:<p>No {labels[group.key].toLowerCase()} recorded for this carrier.</p>}
    </section>)}
    {selected?<section className={s.panel} aria-label="Recorded carrier details"><h2>{title(selected.record,selected.key)}</h2><dl>{Object.entries(recordData(selected.record)).filter(([key])=>['carrierReference','responseDeadline','response','price','validUntil','transitMinutes','startsAt','endsAt','movementStatus','status'].includes(key)).map(([key,value])=><div key={key}><dt>{detailLabels[key]}</dt><dd><DataValue value={value} es={false}/></dd></div>)}</dl><p>Full customer requirements, response forms and scheduling are pending connection to the authorized opportunity detail contract. This view cannot edit the customer's request.</p><Button variant="secondary" onClick={()=>setSelected(null)}>Close details</Button></section>:null}
    <p className={s.pending}>Next available date, depot operating limits, resource assignment and service recovery are pending connection. No tentative date, offer or availability is fabricated.</p>
  </div>;
}

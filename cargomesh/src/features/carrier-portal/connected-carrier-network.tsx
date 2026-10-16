"use client";
import {DepotOperationsWorkspace} from './depot-operations-workspace';
import {useEffect, useState} from 'react';
import {Button, Select} from '@/components/ui';
import {readFleetResource} from './fleet-client';
import {portalErrorCopy} from './api';
import {recordData, recordName, type PortalRecord} from './records';
import s from './connected-fleet.module.css';

export function ConnectedCarrierNetwork({carrierId,role}:{carrierId:string;role:string}) {
  const [catalog,setCatalog]=useState<{depots:PortalRecord[];services:PortalRecord[];partial:boolean}|null>(null);
  const [serviceId,setServiceId]=useState(''),[coverage,setCoverage]=useState<{areas:PortalRecord[];lanes:PortalRecord[];partial:boolean}|null>(null);
  const [error,setError]=useState(''),[coverageError,setCoverageError]=useState(''),[refresh,setRefresh]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();setCatalog(null);setCoverage(null);setServiceId('');setError('');
    void Promise.all(['depots','services'].map(key=>readFleetResource(carrierId,key,controller.signal))).then(([depots,services])=>{
      if(controller.signal.aborted)return;
      setCatalog({depots:depots.records,services:services.records,partial:depots.truncated||services.truncated});
      if(services.records.length===1)setServiceId(services.records[0].id);
    }).catch(e=>{if(!controller.signal.aborted)setError(portalErrorCopy(e,false));});
    return()=>controller.abort();
  },[carrierId,refresh]);
  useEffect(()=>{
    const controller=new AbortController();setCoverage(null);setCoverageError('');
    if(!serviceId)return()=>controller.abort();
    void Promise.all(['areas','lanes'].map(key=>readFleetResource(carrierId,key,controller.signal,fetch,serviceId))).then(([areas,lanes])=>{
      if(!controller.signal.aborted)setCoverage({areas:areas.records,lanes:lanes.records,partial:areas.truncated||lanes.truncated});
    }).catch(e=>{if(!controller.signal.aborted)setCoverageError(portalErrorCopy(e,false));});
    return()=>controller.abort();
  },[carrierId,serviceId,refresh]);
  return <div className={s.workspace}>
    <p className={s.notice}>Depots are physical bases. Pickup and delivery coverage belongs to a service. A depot's country does not authorize service throughout that country.</p>
    <Button variant="secondary" onClick={()=>setRefresh(n=>n+1)}>Refresh network</Button>
    {error?<p role="alert">{error}</p>:!catalog?<p role="status">Loading authorized network…</p>:<>
      {catalog.partial?<p className={s.notice}>Partial catalog. Counts apply to loaded records.</p>:null}
      <section className={s.panel}><h2>Recorded depots</h2><div className={s.cards}>{catalog.depots.map(row=>{
        const d=recordData(row),location=d.location as Record<string,unknown>;
        return <article className={s.card} key={row.id}><h3>{recordName(row)}</h3><p>{String(location.city)} · {String(location.countryCode)}</p><p>{d.active?'Active base':'Inactive base'}</p><p>Handling: {Array.isArray(d.handling)&&d.handling.length?d.handling.join(', '):'Not recorded'}</p></article>;
      })}</div>{!catalog.depots.length?<p>No depots recorded. Service coverage must be checked separately.</p>:null}
      <p className={s.pending}>Depot operations are configured below. A missing policy keeps hours and capacity unknown.</p></section>
      <DepotOperationsWorkspace carrierId={carrierId} role={role} depots={catalog.depots} services={catalog.services} partial={catalog.partial}/>
      <section className={s.panel}><h2>Service coverage</h2><Select label="Carrier service" value={serviceId} onChange={e=>setServiceId(e.target.value)}><option value="">Select service</option>{catalog.services.map(row=><option key={row.id} value={row.id}>{recordName(row)}</option>)}</Select>
      {!catalog.services.length?<p>No services recorded.</p>:null}
      {coverageError?<p role="alert">{coverageError}</p>:serviceId&&!coverage?<p role="status">Loading service areas and directed lanes…</p>:coverage?<>
        {coverage.partial?<p className={s.notice}>Partial coverage read. Absence from this list does not confirm lack of coverage.</p>:null}
        <h3>Pickup & delivery areas</h3><div className={s.cards}>{coverage.areas.map(row=>{
          const a=recordData(row),g=a.geography as Record<string,unknown>;
          return <article key={row.id} className={s.card}><h4>{[g.countryCode,g.region,g.city,g.postalCode].filter(Boolean).join(' · ')}</h4><p>{String(a.role)} · {String(a.inclusion)} · {String(g.granularity)}</p><p>{a.active?'Active':'Inactive'} · {String(a.source)}</p><p>Validity: {String(a.validFrom??'Not recorded')} — {String(a.validUntil??'Not recorded')}</p></article>;
        })}</div>{!coverage.areas.length?<p>No areas recorded for this service. Coverage is not confirmed.</p>:null}
        <h3>Directed service lanes</h3><div className={s.cards}>{coverage.lanes.map(row=>{
          const lane=recordData(row);
          const areaName=(id:unknown)=>{const area=coverage.areas.find(a=>a.id===id);if(!area)return 'Area reference unavailable';const g=recordData(area).geography as Record<string,unknown>;return [g.countryCode,g.region,g.city,g.postalCode].filter(Boolean).join(' · ');};
          return <article className={s.card} key={row.id}><h4>{areaName(lane.pickupAreaId)} → {areaName(lane.deliveryAreaId)}</h4><p>{String(lane.mode)} · {lane.active?'Active':'Inactive'}</p><p>{lane.crossBorderProhibited?'Cross-border prohibited':lane.borderReviewRequired?'Border review required':'Border review flag not set; permission is evaluated separately'}</p><p>Validity: {String(lane.validFrom??'Not recorded')} — {String(lane.validUntil??'Not recorded')}</p></article>;
        })}</div>{!coverage.lanes.length?<p>No directed lanes recorded. Reverse coverage is never inferred.</p>:null}
      </>:<p>Select a service to inspect its published areas and lanes.</p>}
      <p className={s.notice}>Published coverage is one input. Cargo, equipment, time windows, permissions and resource availability must still be evaluated before an offer can be confirmed.</p></section>
    </>}
  </div>;
}

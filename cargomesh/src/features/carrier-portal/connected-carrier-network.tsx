"use client";
import {DepotOperationsWorkspace} from './depot-operations-workspace';
import {useEffect, useState,type CSSProperties} from 'react';
import {Building2,Clock3,MapPin,Route,ArrowRight} from 'lucide-react';
import o from './operations.module.css';
import portal from './portal.module.css';
import {Button, Select} from '@/components/ui';
import {readFleetResource} from './fleet-client';
import {portalErrorCopy} from './api';
import {recordData, recordName, type PortalRecord} from './records';
import s from './connected-fleet.module.css';

export function ConnectedCarrierNetwork({carrierId,role}:{carrierId:string;role:string}) {
  const [selectedDepotId,setSelectedDepotId]=useState('');
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
  const selected=catalog?.depots.find(r=>r.id===selectedDepotId)??catalog?.depots[0];
  const depot=selected?recordData(selected):null,location=depot?.location as Record<string,unknown>|undefined;
  const geography=(value:Record<string,unknown>)=>[value.countryCode,value.region,value.city,value.postalCode].filter(Boolean).join(' - ');
  const areaName=(id:unknown)=>{const area=coverage?.areas.find(a=>a.id===id);return area?geography(recordData(area).geography as Record<string,unknown>):'Area reference unavailable';};
  return <div className={o.root} style={{"--carrier":"var(--cm-color-logistics, #008c95)"} as CSSProperties}>
    <div className={o.header}><div><h2>Depots and service coverage</h2><p>Inspect the Carrier's physical bases and its published directed service lanes.</p></div><Button variant="secondary" onClick={()=>setRefresh(n=>n+1)}>Refresh network</Button></div>
    <p className={o.hint}>A depot is a physical base. Service coverage and vehicle presence are separate records; neither is inferred from a depot's country.</p>
    {error?<p role="alert" className={o.error}>{error}</p>:!catalog?<p role="status">Loading authorized network...</p>:<>
      {catalog.partial?<p role="status" className={s.notice}>Partial catalog. Counts apply only to loaded records.</p>:null}
      <div className={o.siteGrid}>{catalog.depots.map(row=>{const d=recordData(row),place=d.location as Record<string,unknown>;return <button key={row.id} className={o.siteCard} aria-pressed={selected?.id===row.id} onClick={()=>setSelectedDepotId(row.id)}><header><Building2 size={24}/><span><strong>{recordName(row)}</strong><small>{d.active?'Active operational base':'Inactive base'}</small></span></header><span className={o.row}><MapPin size={14}/>{geography(place)}</span><span className={o.chips}>{Array.isArray(d.handling)?d.handling.map(value=><span key={String(value)}>{String(value)}</span>):null}</span><small className={o.row}><Clock3 size={13}/>Hours and resources: inspect the recorded policy below</small></button>;})}</div>
      {!catalog.depots.length?<section className={portal.card}><h3>No depots recorded</h3><p>Coverage is evaluated from the service's areas, directed lanes and documented partners.</p></section>:null}
      {selected&&location?<section className={`${portal.card} ${o.siteDetail}`} aria-label="Selected depot"><div><h3>{recordName(selected)}</h3><dl className={o.factList}><div><dt>Location</dt><dd>{geography(location)}</dd></div><div><dt>Address / location label</dt><dd>{String(location.label??'Pending data')}</dd></div><div><dt>Recorded coordinates</dt><dd>{location.lat==null?'Pending coordinates':String(location.lat)+', '+String(location.lng)}</dd></div><div><dt>Revision</dt><dd>{selected.version}</dd></div></dl></div><div><h3 className={o.row}><Route size={19}/>Directed lanes</h3><p>Choose a service below to inspect its published pickup and delivery connections.</p><ul className={o.lanes}>{coverage?.lanes.map(row=>{const lane=recordData(row);return <li key={row.id}>{areaName(lane.pickupAreaId)}<ArrowRight size={14}/>{areaName(lane.deliveryAreaId)}</li>;})}</ul><p className={o.hint}>A home depot does not establish current vehicle presence or booking availability.</p></div></section>:null}
      <section className={portal.card}><h2>Operating limits and appointments</h2><p>Recorded policy, handling resources and appointments remain connected to the authorized backend.</p><DepotOperationsWorkspace carrierId={carrierId} role={role} depots={catalog.depots} services={catalog.services} partial={catalog.partial} selectedDepotId={selected?.id} onSelectDepot={setSelectedDepotId}/></section>
      <section className={portal.card}><h2>Service coverage</h2><Select label="Carrier service" value={serviceId} onChange={e=>setServiceId(e.target.value)}><option value="">Select service</option>{catalog.services.map(row=><option key={row.id} value={row.id}>{recordName(row)}</option>)}</Select>
      {!catalog.services.length?<p>No services recorded.</p>:null}
      {coverageError?<p role="alert">{coverageError}</p>:serviceId&&!coverage?<p role="status">Loading service areas and directed lanes...</p>:coverage?<>
        {coverage.partial?<p role="status" className={s.notice}>Partial coverage read. Absence is not evidence of lack of coverage.</p>:null}
        <h3>Pickup and delivery areas</h3><div className={o.siteGrid}>{coverage.areas.map(row=>{const a=recordData(row),g=a.geography as Record<string,unknown>;return <article key={row.id} className={s.card}><h4>{geography(g)}</h4><p>{String(a.role)} - {String(a.inclusion)} - {String(g.granularity)}</p><p>{a.active?'Active':'Inactive'} - {String(a.source)}</p><p>Validity: {String(a.validFrom??'Not recorded')} - {String(a.validUntil??'Not recorded')}</p></article>;})}</div>{!coverage.areas.length?<p>No areas recorded for this service. Coverage is not confirmed.</p>:null}
        <h3>Directed service lanes</h3><ul className={o.lanes}>{coverage.lanes.map(row=>{const lane=recordData(row);return <li key={row.id}><div><strong>{areaName(lane.pickupAreaId)} <ArrowRight size={14}/> {areaName(lane.deliveryAreaId)}</strong><p>{String(lane.mode)} - {lane.active?'Active':'Inactive'}</p><p>{lane.crossBorderProhibited?'Cross-border prohibited':lane.borderReviewRequired?'Border review required':'Border permission is evaluated separately'}</p><small>Validity: {String(lane.validFrom??'Not recorded')} - {String(lane.validUntil??'Not recorded')}</small></div></li>;})}</ul>{!coverage.lanes.length?<p>No directed lanes recorded. Reverse coverage is never inferred.</p>:null}
      </>:<p>Select a service to inspect its published areas and lanes.</p>}
      <p className={o.hint}>Published coverage does not confirm cargo compatibility, resource availability or border permission.</p></section>
    </>}
  </div>;
}

"use client";
import {useEffect,useState,type CSSProperties} from 'react';
import {ArrowRight,Building2,Clock3,MapPin,Plus,Route} from 'lucide-react';
import {useLocale} from '@/features/i18n/locale-provider';
import {ContentMotion} from '@/features/product-motion/content-motion';
import {WorkspaceSkeleton,WorkspaceUpdating} from '@/features/product-motion/workspace-skeleton';
import {useCarrierMemoryState} from '@/features/carrier-navigation/carrier-continuity';
import {portalErrorCopy,PortalApiError} from '@/features/carrier-portal/api';
import {recordData,recordName,type PortalRecord} from '@/features/carrier-portal/records';
import {DepotOperationsWorkspace} from '@/features/carrier-portal/depot-operations-workspace';
import {DataValue} from '@/features/carrier-portal/contract-form';
import type {useConnectedFleet} from './use-connected-fleet';
import {ExampleCarrierSites} from './carrier-sites-example';
import {readSitesCatalog,readServiceCoverage} from './sites-client';
import {areaLabel,canEditSites,keepSiteSelection,type SiteEditorKind} from './sites-model';
import {SiteCatalogEditor} from './site-catalog-editor';
import s from './operations.module.css';
import layout from './sites-workspace.module.css';
export const operationalPanel='cm-rounded-2xl cm-border cm-border-line cm-bg-white cm-p-5 cm-shadow-panel';
type Context=Pick<ReturnType<typeof useConnectedFleet>,'carrier'|'carrierId'|'serviceId'|'current'>;
export function CarrierSites({example=false,context}:{example?:boolean;context?:Context}) {
 return example?<ExampleCarrierSites/>:context?<ConnectedSites key={context.carrierId+':'+context.serviceId} context={context}/>:<p>Select an authorized Carrier.</p>;
}
function ConnectedSites({context}:{context:Context}) {
 const {carrier,carrierId,serviceId}=context;
 const {t}=useLocale();
 const [reading,setReading]=useState(true),[coverageReading,setCoverageReading]=useState(true),[rulesOpen,setRulesOpen]=useState(false);
 const [revision,setRevision]=useState(0),[siteId,setSiteId]=useCarrierMemoryState('sites:selection:'+carrierId,''),[message,setMessage]=useState('');
 const [catalog,setCatalog]=useCarrierMemoryState<(Awaited<ReturnType<typeof readSitesCatalog>>&{revision:number})|null>('sites:catalog:'+carrierId,null);
 const [coverage,setCoverage]=useCarrierMemoryState<(Awaited<ReturnType<typeof readServiceCoverage>>&{revision:number})|null>('sites:coverage:'+carrierId+':'+serviceId,null);
 const [error,setError]=useState(''),[coverageError,setCoverageError]=useState(''),[fatal,setFatal]=useState(false);
 const [editor,setEditor]=useState<{kind:SiteEditorKind;record?:PortalRecord}|null>(null);
 const authorized=!!carrier&&carrier.carrierId===carrierId;
 const current=authorized&&catalog?.carrierId===carrierId&&!fatal?catalog:null;
 const selectedService=current?.services.find(row=>row.id===serviceId);
 const serviceCoverage=authorized&&coverage?.carrierId===carrierId&&coverage.serviceId===serviceId&&!fatal?coverage:null;
 useEffect(()=>{const controller=new AbortController();setReading(true);setError('');setCoverageError('');setFatal(false);setEditor(null);
  if(!authorized){setReading(false);setCatalog(null);setCoverage(null);return()=>controller.abort();}
  void readSitesCatalog(carrierId,controller.signal).then(result=>{if(!controller.signal.aborted){setCatalog({...result,revision});setSiteId(id=>keepSiteSelection(id,result.depots));}})
   .catch(e=>{if(!controller.signal.aborted){setError(portalErrorCopy(e,false));if(e instanceof PortalApiError&&[401,403].includes(e.status)){setFatal(true);setCatalog(null);setCoverage(null);setEditor(null);}}})
   .finally(()=>{if(!controller.signal.aborted)setReading(false);});
  return()=>controller.abort();
 },[carrierId,authorized,revision,context.current?.readAt]);
 useEffect(()=>{const controller=new AbortController();setCoverageReading(true);setCoverageError('');
  if(!authorized||!selectedService||fatal){setCoverageReading(false);return()=>controller.abort();}
  void readServiceCoverage(carrierId,serviceId,controller.signal).then(result=>{if(!controller.signal.aborted)setCoverage({...result,revision});})
   .catch(e=>{if(!controller.signal.aborted){setCoverageError(portalErrorCopy(e,false));if(e instanceof PortalApiError&&[401,403].includes(e.status)){setFatal(true);setCatalog(null);setCoverage(null);setEditor(null);}}})
   .finally(()=>{if(!controller.signal.aborted)setCoverageReading(false);});
  return()=>controller.abort();
 },[carrierId,serviceId,authorized,selectedService?.id,revision,fatal,context.current?.readAt]);
 const refresh=()=>{setEditor(null);setReading(true);setCoverageReading(true);setRevision(n=>n+1);};
 const site=current?.depots.find(d=>d.id===keepSiteSelection(siteId,current.depots));
 const value=site?recordData(site):null,location=value?.location as Record<string,unknown>|undefined;
 const writable=!reading&&!error&&!fatal&&catalog?.revision===revision&&canEditSites(carrier?.role??'',!!current,current?.partial??true);
 const coverageWritable=writable&&!coverageReading&&!coverageError&&coverage?.revision===revision&&!!selectedService&&!!serviceCoverage&&!serviceCoverage.partial;
 const areas=serviceCoverage?.areas??[],lanes=serviceCoverage?.lanes??[];
 const saved=(row:PortalRecord)=>{if(editor?.kind==='depots')setSiteId(row.id);setMessage(t('Sede guardada. Actualizando…','Saved. Updating…'));refresh();};
 const open=(kind:SiteEditorKind,record?:PortalRecord)=>{setMessage('');setEditor({kind,record});};
 const endpoint=(id:unknown)=>{const area=areas.find(row=>row.id===id);return area?areaLabel(area):'Area reference unavailable in this read';};
 return <div className={`${s.root} ${layout.workspace}`} style={{'--carrier':'#087f86'} as CSSProperties}>
  <div className={layout.header}><div className={layout.title}><h2>{t('Sedes','Sites')}</h2><span className={layout.count}>{current?current.depots.length+(current.partial?'+':'')+' '+t('registradas','recorded'):t('Ubicaciones autorizadas','Authorized locations')}</span></div><div className={s.row}>{reading&&current?<WorkspaceUpdating>{t('Actualizando sedes…','Updating sites…')}</WorkspaceUpdating>:null}<button className={s.primary} disabled={!writable} onClick={()=>open('depots')}><Plus size={17}/>{t('Nueva sede','New site')}</button></div></div>
  {!authorized?<p>Select an authorized Carrier in the workspace controls.</p>:null}
  {message?<p className={s.success} role="status">{message}</p>:null}
  {error||coverageError?<div className={s.error} role="alert">{error||coverageError}<button onClick={refresh}>Retry</button></div>:null}
  {fatal?<p>Access could not be confirmed. Previous records and editors have been cleared.</p>:<>
  {authorized&&!current&&!error&&reading?<WorkspaceSkeleton shape="sites" variant="carrier-sites" label={t('Cargando sedes','Loading sites')}/>:null}
  {current?.issues.map(issue=><p role="status" key={issue}>{issue} Editing is disabled until the catalog is complete.</p>)}
  {current&&carrier?.role!=='ADMIN'?<p>Read-only access. An administrator can create or revise these records.</p>:null}
  {editor&&current&&(editor.kind==='depots'?writable:coverageWritable)?<SiteCatalogEditor key={carrierId+serviceId+editor.kind+(editor.record?.id??'new')} {...editor} carrierId={carrierId} serviceId={serviceId} serviceMode={String(selectedService?recordData(selectedService).mode:'')} areas={areas} partners={current.partners} onSaved={saved} onClose={()=>setEditor(null)}/>:null}
  <ContentMotion identity="sites-data" ready={!!current} animateOnChange={false} className={layout.grid}>{current?.depots.map(row=>{const v=recordData(row),l=v.location as Record<string,unknown>;return <button key={row.id} className={layout.card} data-carrier-motion-item aria-pressed={row.id===site?.id} onClick={()=>{setSiteId(row.id);setEditor(null);}}><header><Building2 color="#087f86" size={26}/><span><strong>{recordName(row)}</strong><small>{v.active?'Active depot':'Inactive depot'}</small></span></header><span className={layout.location}><MapPin size={15}/>{[l.city,l.region,l.countryCode].filter(Boolean).join(' · ')}</span><span className={layout.capabilities}>{(v.handling as string[]).length?(v.handling as string[]).map(code=><span key={code}>{code}</span>):<span>Handling not recorded</span>}</span><small className={s.row}><Clock3 size={13}/>Hours and appointments in operating rules</small></button>;})}</ContentMotion>
  {current&&!current.depots.length?<section className={operationalPanel}><h3>{current.issues.some(i=>i.startsWith('depots:'))?'Depot records unavailable':'No depots recorded'}</h3><p>Service coverage can exist without a physical depot. No local examples are loaded automatically.</p></section>:null}
  {site&&value&&location?<ContentMotion identity={site.id} animateOnMount className={layout.detail}><div><div className={layout.detailHeader}><h3>{recordName(site)}</h3><button disabled={!writable} onClick={()=>open('depots',site)}>Edit depot</button></div><p>Physical location and recorded handling capabilities.</p><dl className={layout.facts}><div><dt>Location</dt><dd>{[location.city,location.region,location.countryCode].filter(Boolean).join(' · ')}</dd></div><div><dt>Address reference</dt><dd>{String(location.label??'Not recorded')}</dd></div>{location.lat!=null&&location.lng!=null?<div><dt>Coordinates</dt><dd>{location.lat+', '+location.lng}</dd></div>:null}<div><dt>Handling</dt><dd>{(value.handling as string[]).join(' · ')||'Not recorded'}</dd></div></dl></div><div><div className={layout.connectionsHeading}><Route size={21}/><h3>Service connections</h3></div><p>{selectedService?'Registered directions for the selected service. Coverage is separate from depot location.':'Choose a transport service above to see its connections.'}</p><ul className={layout.connections}>{lanes.map(lane=>{const v=recordData(lane);return <li key={lane.id}><span>{endpoint(v.pickupAreaId)}</span><ArrowRight size={15}/><span>{endpoint(v.deliveryAreaId)}</span></li>;})}</ul>{serviceCoverage&&!lanes.length?<p>No directed connections recorded.</p>:null}</div></ContentMotion>:null}
  {site&&current?<details className={layout.rules} open={rulesOpen} onToggle={event=>setRulesOpen(event.currentTarget.open)}><summary>{t('Reglas y citas','Rules and appointments')}</summary><div>{rulesOpen?<DepotOperationsWorkspace key={carrierId+':'+serviceId+':'+site.id} carrierId={carrierId} role={carrier?.role??''} depots={current.depots} services={current.services} partial={current.partial||reading||!!error} selectedDepotId={site.id} selectedServiceId={serviceId} hideDepotSelector onCatalogChanged={refresh}/>:null}</div></details>:null}
  <details className={layout.rules}><summary>{t('Cobertura del servicio','Service coverage')}</summary><section className={operationalPanel}><div className={s.header}><div><h3>{t('Áreas y conexiones','Areas and connections')}</h3><p>{selectedService?recordName(selectedService):'Select a service in the workspace controls.'} Coverage is independent of depot location.</p></div><div className={s.row}><button disabled={!coverageWritable} onClick={()=>open('areas')}>New service area</button><button disabled={!coverageWritable||!areas.length} onClick={()=>open('lanes')}>New directed connection</button></div></div>
   {selectedService&&!serviceCoverage&&!coverageError&&coverageReading?<WorkspaceSkeleton shape="table" label={t('Cargando cobertura','Loading coverage')}/>:null}{coverageReading&&serviceCoverage?<WorkspaceUpdating/>:null}
   {serviceCoverage?.issues.map(issue=><p role="status" key={issue}>{issue} Coverage editing is disabled.</p>)}
   {serviceCoverage?<><h3>Pickup, delivery and exclusions</h3><div className={s.siteGrid}>{areas.map(area=>{const v=recordData(area),partner=current?.partners.find(p=>p.id===v.partnerId);return <article key={area.id} className={operationalPanel}><h4>{areaLabel(area)}</h4><p>{String(v.role)} · {String(v.inclusion)} · {v.active?'Active':'Inactive'}</p><p>Source: {String(v.source)}{v.source==='PARTNER'?' · '+(partner?recordName(partner):'Partner reference unavailable'):''}</p><dl className={s.factList}><div><dt>Evidence</dt><dd>{String(v.evidence??'Pending')}</dd></div><div><dt>Verified</dt><dd>{String(v.verifiedAt??'Unknown')}</dd></div><div><dt>Valid from / until</dt><dd>{String(v.validFrom??'Unknown')} / {String(v.validUntil??'Unknown')}</dd></div></dl><details><summary>Recorded geography</summary><DataValue value={v.geography} es={false}/></details><button disabled={!coverageWritable} onClick={()=>open('areas',area)}>Revise area · revision {area.version}</button></article>;})}</div>{!areas.length?<p>No service areas in this read. Coverage is not confirmed.</p>:null}
   <h3>Directed connections</h3><div className={s.siteGrid}>{lanes.map(lane=>{const v=recordData(lane);return <article key={lane.id} className={operationalPanel}><h4>{endpoint(v.pickupAreaId)} → {endpoint(v.deliveryAreaId)}</h4><p>{String(v.mode)} · {String(v.kind)} · {v.active?'Active':'Inactive'}</p><p>Validity: {String(v.validFrom??'Unknown')} / {String(v.validUntil??'Unknown')}</p><p>Evidence: {String(v.evidence??'Pending')} · verified {String(v.verifiedAt??'Unknown')}</p><p>Transit source: {String(v.transitProvenanceStatus)} · {v.plannedTransitMinutes==null?'Duration unknown':String(v.plannedTransitMinutes)+' minutes'}</p><p>Border review: {v.borderReviewRequired?'Required':'Not recorded as required'} · Cross-border prohibition: {v.crossBorderProhibited?'Recorded':'Not recorded'}</p>{v.crossBorderProhibitionReference?<p>{String(v.crossBorderProhibitionReference)}</p>:null}<button disabled={!coverageWritable} onClick={()=>open('lanes',lane)}>Revise connection · revision {lane.version}</button></article>;})}</div>{!lanes.length?<p>No directed connections in this read. Reverse coverage is not inferred.</p>:null}</>:null}
  </section></details>
  </>}
 </div>;
}

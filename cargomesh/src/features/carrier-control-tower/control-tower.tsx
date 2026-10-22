'use client';
import {RoadPlanner} from './road-planner';
import {selectedRoad,type RoadDisplay} from './road-plan-client';
import {useCallback,useEffect,useMemo,useState} from 'react';
import {Activity,ArrowRight,ArrowUpRight,Bell,Building2,ChevronRight,Clock3,Globe2,List,Map,MapPinned,RefreshCw,Route,Search,ShieldCheck,Truck,X} from 'lucide-react';
import {Button,SearchField} from '@/components/ui';
import {CarrierLink} from '@/features/carrier-navigation/carrier-link';
import {CarrierNavigation,CarrierMenuButton,CarrierBreadcrumb} from '@/features/carrier-navigation/carrier-navigation';
import {ContentMotion} from '@/features/product-motion/content-motion';
import type {CarrierPortalAccessV2} from '@/shared/schemas/v2/carrier-portal';
import {recordData} from '@/features/carrier-portal/records';
import {CARRIER_ROUTE_LAB,CARRIER_TOWER} from '@/features/carrier-navigation/workspace-route';
import {GoogleOperationMap} from './google-operation-map';
import {useConnectedTower,useTowerIncidents} from './use-connected-tower';
import {filterTower,towerDate,towerItems,towerSites} from './tower-model';
import s from './tower.module.css';
import navStyles from '@/features/carrier-navigation/carrier-navigation.module.css';
import {useLocale} from '@/features/i18n/locale-provider';

export function ControlTower({embedded=false,dashboard=false,carrier,refreshToken=0}:{embedded?:boolean;dashboard?:boolean;carrier?:CarrierPortalAccessV2;refreshToken?:number}){
 const {t}=useLocale();
 const [query,setQuery]=useState(''),[status,setStatus]=useState('All'),[selectedId,setSelectedId]=useState<string|null>(null),[view,setView]=useState<'map'|'list'>('map'),[showSites,setShowSites]=useState(true),[refresh,setRefresh]=useState(0),[incidentFilter,setIncidentFilter]=useState('Open');
 const [road,setRoad]=useState<RoadDisplay|null>(null);const displayRoad=useCallback((value:RoadDisplay|null)=>setRoad(value),[]),showRoadMap=useCallback(()=>setView('map'),[]);
 const {snapshot,error,invalidate}=useConnectedTower(carrier?.carrierId,refresh+refreshToken);
 const items=useMemo(()=>snapshot?towerItems(snapshot):[],[snapshot]);
 const sites=useMemo(()=>snapshot?towerSites(snapshot):[],[snapshot]);
 const visible=useMemo(()=>filterTower(items,query,status),[items,query,status]);
 const selected=visible.find(item=>item.id===selectedId)??null;
 const incidents=useTowerIncidents(carrier?.carrierId,selected,refresh+refreshToken);
 useEffect(()=>{if(incidents.denied)invalidate(incidents.error);},[incidents.denied,incidents.error,invalidate]);
 const displayedIncidents=incidents.rows.filter(row=>incidentFilter==='All'||row.status==='OPEN');
 const select=useCallback((id:string)=>setSelectedId(id),[]);
 useEffect(()=>{setSelectedId(null);setQuery('');setStatus('All');setRoad(null);},[carrier?.carrierId,carrier?.operatorId]);
 useEffect(()=>{if(embedded)document.querySelector<HTMLElement>('#tower-main h1')?.focus({preventScroll:true});},[embedded]);
 const positions=visible.filter(item=>item.position!==null).length;
 const resources=snapshot?.records.assets.filter(row=>recordData(row).mode==='ROAD')??[];
 const conditions=['AVAILABLE','IN_SERVICE','MAINTENANCE','OUT_OF_SERVICE'];
 const count=(key:'executions'|'assets'|'depots')=>snapshot?.loaded[key]?snapshot.records[key].length:'—';
 const roadPlanner=carrier&&snapshot&&!error?<RoadPlanner key={carrier.operatorId+':'+carrier.carrierId} carrierId={carrier.carrierId} revision={snapshot.readAt} onDisplay={displayRoad} onDenied={invalidate} onShowMap={showRoadMap}/>:null;
 const operationStates=['All',...new Set(items.map(item=>item.status))];
 const operationFilterControls=dashboard?(
  <>
   <SearchField fieldClassName={s.dashboardSearch} label={t('Buscar operaciones','Search operations')} placeholder={t('Vehículo, operación o ciudad…','Vehicle, operation or city…')} value={query} onValueChange={setQuery} hideLabel/>
   <select className={s.dashboardStatus} aria-label={t('Estado registrado','Recorded state')} value={status} onChange={event=>setStatus(event.target.value)}>
    {operationStates.map(value=><option key={value} value={value}>{value==='All'?t('Todos los estados','All statuses'):value.replaceAll('_',' ')}</option>)}
   </select>
  </>
 ):(
  <div className={s.statusFilters} aria-label="Recorded state">
   {operationStates.map(value=><Button variant="secondary" size="compact" key={value} aria-pressed={status===value} onClick={()=>setStatus(value)}>{value}</Button>)}
  </div>
 );
 const content=<div className={`${s.shell} ${navStyles.workspaceSurface} ${dashboard?s.dashboard:''}`}><div className={s.workspace}>
  {!dashboard?<header className={s.topbar}>{!embedded?<><CarrierMenuButton/><CarrierBreadcrumb className={s.breadcrumb} currentLabel="Control tower" workspaceHref="/carriers"/></>:null}
   <SearchField fieldClassName={s.search} label="Search operations, vehicles or cities" placeholder="Search operations, vehicles or cities…" value={query} onValueChange={setQuery} hideLabel shortcut/>
   <div className={s.headerActions}><span><Globe2 size={14}/>EN</span><span className={s.alertIndicator} aria-label="Incidents are read for the selected operation"><Bell size={18}/></span></div>
  </header>:null}
  <main id="tower-main" className={s.main}><ContentMotion identity="tower" animateOnMount>
   {!dashboard?<div className={s.pageHeading}><div>{!embedded?<><div className={s.eyebrow}><Activity size={13}/>OPERATIONS OVERVIEW</div><h1 tabIndex={-1}>Control tower</h1></>:null}<p>{carrier?.carrierName??'Select an authorized Carrier'} · Operations, assigned resources and recorded sites.</p></div><Button variant="secondary" disabled={!carrier} onClick={()=>setRefresh(n=>n+1)}><RefreshCw size={15}/>Refresh</Button></div>:null}
   {!dashboard?<><div className={s.demoNotice}><ShieldCheck size={16}/><span><strong>Authorized Carrier records.</strong> Positions are last recorded reports, not live GPS. Vehicle availability and road access require separate validation.</span></div>
   <CarrierLink className={s.routePreviewLink} href={CARRIER_ROUTE_LAB}>Explore calculated road routes<ArrowUpRight size={14}/><span>Separate calculation preview</span></CarrierLink></>:null}
   {!carrier?<p role="status">Select an authorized Carrier in the workspace header.</p>:error?<p role="alert">{error}</p>:!snapshot?<p role="status">Loading authorized operations and resources…</p>:null}
   {snapshot?.partial?<div role="status" className={s.demoNotice}><span><strong>Incomplete read.</strong> Counts cover loaded records; missing relationships remain unknown.<ul>{snapshot.issues.map(issue=><li key={issue}>{issue}</li>)}</ul></span></div>:null}
   <section className={s.metrics} aria-label="Loaded Carrier records">{[
    {label:t('Operaciones','Operations'),value:count('executions'),caption:t('Ejecuciones registradas','Loaded execution records'),Icon:Route},
    {label:t('Vehículos de carretera','Road vehicles'),value:snapshot?.loaded.assets?resources.length:'—',caption:t('Catálogo · no indica disponibilidad','Catalog records, not available capacity'),Icon:Truck},
    {label:t('Posiciones registradas','Recorded positions'),value:snapshot?.loaded.executions?items.filter(item=>item.position).length:'—',caption:t('Reportadas · sin extrapolación','Operation positions; no extrapolation'),Icon:MapPinned},
    {label:t('Sedes del Carrier','Carrier sites'),value:count('depots'),caption:t('Sedes · no indica cobertura','Recorded sites, not service coverage'),Icon:Building2},
   ].map(({label,value,caption,Icon})=><div className={s.metric} key={label}><span className={s.metricIcon}><Icon size={18}/></span><div><span>{label}</span><strong>{value}</strong><small>{caption}</small></div></div>)}</section>
   {!dashboard?roadPlanner:null}
   <div className={s.operationGrid}><section className={s.mapCard} aria-labelledby="transportation-map-title">
    <div className={s.mapHeader}><div><h2 id="transportation-map-title">{t('Mapa de operaciones','Operations map')}</h2><p>{t('Posiciones registradas y sedes del Carrier','Recorded operation positions and Carrier sites')}</p></div><div className={s.viewToggle} aria-label="Operation view"><Button variant="secondary" size="compact" aria-pressed={view==='map'} onClick={()=>setView('map')}><Map size={14}/>{t('Mapa','Map')}</Button><Button variant="secondary" size="compact" aria-pressed={view==='list'} onClick={()=>setView('list')}><List size={15}/>{t('Lista','List')}</Button></div></div>
    <div className={s.filters}>
     {operationFilterControls}
     <label className={s.sitesToggle}><input type="checkbox" checked={showSites} onChange={e=>setShowSites(e.target.checked)}/><Building2 size={13}/>{t('Sedes','Sites')}</label>
    </div>
    <ContentMotion identity={view} className={s.visualFrame}><div hidden={view!=='map'}><GoogleOperationMap key={carrier?.operatorId+':'+carrier?.carrierId} items={visible} sites={sites} selected={selected} onSelect={select} showSites={showSites} road={road}/></div>
     {view==='list'?<div className={s.listView} aria-label="Authorized operations and vehicles">{visible.map(item=><button type="button" className={s.shipmentRow} key={item.id} onClick={()=>select(item.id)} aria-pressed={selected?.id===item.id}><span className={s.vehicleIcon}><Truck size={18}/></span><span style={{minWidth:0,flex:1,overflowWrap:'anywhere'}}><strong style={{flexWrap:'wrap'}}>{item.vehicle}<small>{item.operationId?'Operation '+item.operationId.slice(0,8):'Vehicle record'}</small></strong><span>{item.origin} → {item.destination}</span><small style={{display:'block',marginLeft:0}}>{item.position?'Last recorded position · '+item.provenance:item.positionIssue}</small></span><span className={s.statusBadge}>{item.status}</span><ChevronRight size={16}/></button>)}{!visible.length?<div className={s.empty}><Search size={26}/><strong>{error?'Records unavailable':snapshot?'No matching records':'Waiting for authorized records'}</strong></div>:null}</div>:null}
     {selected&&view==='map'?<article className={s.mapDetail} aria-label="Selected operation"><div><span className={s.detailIcon}><Truck size={18}/></span><span><strong>{selected.vehicle}</strong><small>{selected.status}</small></span><Button variant="secondary" size="compact" onClick={()=>setSelectedId(null)} aria-label="Close selected operation"><X size={16}/></Button></div><h3>{selected.origin}<ArrowRight size={14}/>{selected.destination}</h3><p>{selected.cargo}</p><div className={s.detailFacts}><span>Planned end<strong>{towerDate(selected.plannedEnd)}</strong></span><span>Position source<strong>{selected.position?selected.provenance:selected.positionIssue}</strong></span></div><small className={s.detailSource}>Observed: {towerDate(selected.observedAt)} · Accuracy unknown</small></article>:null}
     {view==='map'&&snapshot&&!positions&&!selectedRoad(road)?<div className={s.noMatches} role="status">No operation positions to plot. Vehicles remain in the list; site markers do not locate trucks. <Button variant="secondary" size="compact" onClick={()=>setView('list')}>View records</Button></div>:null}
    </ContentMotion><div className={s.mapFooter}><span role="status" aria-live="polite">{visible.length} loaded records · {positions} plotted positions</span><span>Google Maps · {selectedRoad(road)?'Planning route from Google · not saved to an order':'No calculated route attached'}</span></div>
   </section>
   <div className={dashboard?s.dashboardRail:undefined}>
   {dashboard?<section className={s.operationsPanel} aria-labelledby="dashboard-operations-title"><header><h2 id="dashboard-operations-title">{t('Operaciones','Operations')}</h2><CarrierLink href="/carriers/orders">{t('Ver todas','View all')}<ArrowRight size={14}/></CarrierLink></header><div className={s.operationQueue}>{visible.filter(item=>item.operationId).slice(0,4).map(item=><button key={item.id} type="button" aria-pressed={selectedId===item.id} onClick={()=>select(item.id)}><span className={s.vehicleIcon}><Truck size={17}/></span><span><strong>{item.vehicle}</strong><small>{item.origin} → {item.destination}</small><span className={s.statusBadge}>{item.status.replaceAll('_',' ')}</span></span><ChevronRight size={15}/></button>)}{!visible.some(item=>item.operationId)?<p role="status">{snapshot?t('No hay operaciones para estos filtros.','No operations match these filters.'):t('Consultando operaciones…','Loading operations…')}</p>:null}</div></section>:null}
   <aside className={s.exceptionPanel} aria-labelledby="exception-title"><div className={s.exceptionHeading}><div><h2 id="exception-title">{t('Incidencias','Operation incidents')}</h2><p>{t('De la operación seleccionada','Read for the selected operation.')}</p></div></div><div className={s.exceptionTabs}>{['Open','All'].map(value=><Button variant="secondary" size="compact" key={value} aria-pressed={incidentFilter===value} onClick={()=>setIncidentFilter(value)}>{value==='Open'?t('Abiertas','Open'):t('Todas','All')}</Button>)}</div>
    <div className={s.exceptionList}>{incidents.error?<p role="alert" className={s.empty}>{incidents.error}</p>:incidents.loading?<p role="status" className={s.empty}>Loading incidents…</p>:!selected?.operationId?<div className={s.empty}><Search size={26}/><strong>Select an operation</strong><p>Incident counts are not inferred from the loaded fleet.</p></div>:displayedIncidents.length?displayedIncidents.map(row=><article key={row.id} className={s.exceptionCard}><div className={s.exceptionTop}><strong>{row.data.kind}</strong><span>{row.data.severity} · {row.status}</span></div><p>{row.data.description}</p><small>Occurred {towerDate(row.data.occurredAt)}</small><p>Evidence: {row.data.evidence.map(ev=>ev.provenanceStatus).join(', ')||'Unknown'}</p></article>):<div className={s.empty}><strong>No incidents in this read</strong></div>}</div>
    <div className={s.queueNote}><Clock3 size={14}/>{incidents.partial?'Incident read incomplete.':'No live telemetry or automatic alerts.'}</div>
   </aside></div></div>
   {dashboard?<div className={s.dashboardPlanner}>{roadPlanner}</div>:null}
   <details open={!dashboard} className={s.contextDetails}><summary>{t('Detalle operativo y red','Operational details & network')}</summary>
   <section className={s.bottomGrid} aria-label="Operational context"><article className={s.contextCard}><div><Route size={17}/><h2>Selected operation</h2></div>{selected?<><h3>{selected.origin} → {selected.destination}</h3><p>{selected.vehicle} · {selected.equipment}</p><p>Assigned drivers: {selected.driver}</p><p>{selected.position?'Last recorded position: '+towerDate(selected.observedAt)+' · '+selected.provenance:selected.positionIssue}</p>{selected.issues.map(issue=><p key={issue}>{issue}</p>)}{selected.bookingId?<CarrierLink href={'/carriers/orders/details/'+selected.bookingId}>Open linked order<ArrowRight size={14}/></CarrierLink>:selected.operationId?<CarrierLink href="/carriers/orders">Inspect Orders<ArrowRight size={14}/></CarrierLink>:<CarrierLink href="/carriers/fleet">Inspect Fleet<ArrowRight size={14}/></CarrierLink>}</>:<><h3>Select a record</h3><p>Map, list and incident details use the same selection.</p></>}</article>
    <article className={s.contextCard}><div><Truck size={17}/><h2>Fleet operating conditions</h2></div><div className={s.fleetBar}>{resources.map(row=><span key={row.id} className={recordData(row).operatingStatus==='MAINTENANCE'?s.maintenance:s.assigned} title={String(recordData(row).code)+' · '+String(recordData(row).operatingStatus)}/>)}</div><dl style={{flexWrap:'wrap'}}>{conditions.map(value=><div key={value}><dt>{value.replaceAll('_',' ')}</dt><dd>{snapshot?.loaded.assets?resources.filter(row=>recordData(row).operatingStatus===value).length:'—'}</dd></div>)}</dl><p>Catalog condition does not establish availability for a date or physical location.</p></article>
    <article className={s.contextCard}><div><Building2 size={17}/><h2>Network context</h2></div>{sites.map(site=><div key={site.id} className={s.hubRow}><span className={s.hubIcon}><Building2 size={16}/></span><span><strong>{site.name}</strong><small>{site.location} · {site.active?'Active':'Inactive'} · {site.position?'Coordinates recorded':'Coordinates unavailable'}</small></span></div>)}{snapshot?.loaded.depots&&!sites.length?<p>No Carrier sites recorded.</p>:null}<p>A site is not evidence of coverage or truck presence.</p><CarrierLink href="/carriers/sites">Open Sites & coverage</CarrierLink></article>
   </section></details>{snapshot?<p className={s.queueNote}>Read at {towerDate(snapshot.readAt)}. Counts cover loaded records.</p>:null}
  </ContentMotion></main></div></div>;
 return embedded?content:<CarrierNavigation current="tower" locale="en" workspaceHref="/carriers" towerHref={CARRIER_TOWER} sourceLabel={carrier?.carrierName??'Authorized records required'}>{content}</CarrierNavigation>;
}

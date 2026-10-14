'use client';
import Image from 'next/image';
import { useCallback,useEffect,useMemo,useRef,useState } from 'react';
import { Activity,ArrowLeft,ArrowRight,ArrowUpRight,Bell,Building2,Check,ChevronRight,CircleHelp,Clock3,FileCheck2,Globe2,LayoutDashboard,Map,MapPinned,Menu,Network,Route,Search,ShieldCheck,Truck,X,AlertTriangle,Package,SlidersHorizontal,List } from 'lucide-react';
import { GoogleOperationMap } from './google-operation-map';
import { depots,exceptions,fleet,filterShipments,shipments,type Exception } from './demo-model';
import s from './tower.module.css';
const carrier='/v2-workspace';
const nav=[['Overview','dashboard',LayoutDashboard],['Requests','shipments',Package],['Fleet & drivers','fleet',Truck],['Route','tracking',MapPinned],['Help','help',CircleHelp]] as const;
export function ControlTower(){
 const [query,setQuery]=useState(''),[status,setStatus]=useState('All'),[selectedId,setSelectedId]=useState<string|null>(null),[view,setView]=useState<'map'|'list'>('map'),[exceptionTab,setExceptionTab]=useState('Open'),[showSites,setShowSites]=useState(true),[drawer,setDrawer]=useState(false),[dialog,setDialog]=useState<Exception|null>(null);
 const visible=useMemo(()=>filterShipments(query,status),[query,status]);
 const selected=visible.find(item=>item.id===selectedId)??null;
 const select=useCallback((id:string)=>setSelectedId(id),[]);
 const visibleExceptions=exceptions.filter(e=>visible.some(item=>item.id===e.shipmentId)&&(exceptionTab!=='Critical'||e.severity==='Critical'));
 const critical=exceptions.filter(e=>e.severity==='Critical').length;
 const selectAlert=(alert:Exception)=>{setQuery('');setStatus('All');setSelectedId(alert.shipmentId);};
 return <div className={s.shell}>
  <a href="#tower-main" className={s.skip}>Skip to control tower</a>
  <aside className={`${s.sidebar} ${drawer?s.sidebarOpen:''}`} aria-label="Carrier sidebar">
   <a href={`${carrier}#/fleet`} className={s.brand}><Image src="/v2-workspace/cargomesh-icon.png" width={38} height={38} alt="" priority/><span>CargoMesh<small>CARRIER WORKSPACE</small></span></a>
   <button className={s.closeNav} onClick={()=>setDrawer(false)} aria-label="Close navigation"><X size={20}/></button>
   <p className={s.navLabel}>WORKSPACE</p>
   <nav aria-label="Carrier navigation">
    <a href={`${carrier}#/dashboard`}><LayoutDashboard size={18}/>Overview<ArrowUpRight size={13} className={s.external}/></a>
    <a href="/carrier-control-tower" aria-current="page"><Activity size={18}/>Control tower<span className={s.previewPill}>Preview</span></a>
    {nav.slice(1).map(([label,section,Icon])=><a href={`${carrier}#/${section}`} key={section}><Icon size={18}/>{label}<ArrowUpRight size={13} className={s.external}/></a>)}
   </nav>
   <div className={s.sidebarFoot}><div><span className={s.avatar}>CM</span><span><strong>Carrier demo</strong><small>Visual scenario · read only</small></span></div><a href="/"><ArrowLeft size={15}/>Back to CargoMesh</a></div>
  </aside>
  {drawer?<button className={s.scrim} onClick={()=>setDrawer(false)} aria-label="Close sidebar"/>:null}
  <div className={s.workspace}>
   <header className={s.topbar}>
    <button className={s.menuButton} aria-label="Open Carrier navigation" aria-expanded={drawer} onClick={()=>setDrawer(!drawer)}><Menu size={20}/></button>
    <div className={s.breadcrumb}>Carrier <ChevronRight size={13}/><strong>Control tower</strong></div>
    <label className={s.search}><Search size={16}/><input aria-label="Search shipments, vehicles or cities" placeholder="Search shipments, vehicles or cities…" value={query} onChange={e=>setQuery(e.target.value)}/>{query?<button onClick={()=>setQuery('')} aria-label="Clear search"><X size={14}/></button>:<kbd>/</kbd>}</label>
    <div className={s.headerActions}><span><Globe2 size={14}/>EN</span><span className={s.alertIndicator} aria-label={`${exceptions.length} sample exceptions`}><Bell size={18}/><i>{exceptions.length}</i></span><span className={s.avatar}>CM</span></div>
   </header>
   <main id="tower-main" className={s.main}>
    <div className={s.pageHeading}><div><div className={s.eyebrow}><Activity size={13}/>OPERATIONS OVERVIEW</div><h1>Control tower <span>Preview</span></h1><p>Your shipments, available vehicles and exceptions in one view.</p></div><span className={s.scenarioDate}><Clock3 size={14}/>Scenario · Oct 13, 2026</span></div>
    <div className={s.demoNotice}><ShieldCheck size={16}/><span><strong>Simulated operation.</strong> Sample positions and illustrative routes. No live GPS, road validation or operational writes.</span></div>
    <section className={s.metrics} aria-label="Sample operation summary">
     {[{label:'Active shipments',value:shipments.filter(item=>item.status!=='Delivered').length,caption:'2 in transit · 1 scheduled',Icon:Route},{label:'Available vehicles',value:fleet.filter(item=>item.status==='Available').length,caption:`${fleet.length} vehicles in this scenario`,Icon:Truck},{label:'Open exceptions',value:exceptions.length,caption:`${critical} critical · review first`,Icon:AlertTriangle},{label:'Demo hubs',value:depots.length,caption:'Recorded sites, not service coverage',Icon:Building2}].map(({label,value,caption,Icon})=><div className={s.metric} key={label}><span className={s.metricIcon}><Icon size={18}/></span><div><span>{label}</span><strong>{value}</strong><small>{caption}</small></div></div>)}
    </section>
    <div className={s.operationGrid}>
     <section className={s.mapCard} aria-labelledby="transportation-map-title">
      <div className={s.mapHeader}><div><h2 id="transportation-map-title">Transportation map</h2><p>ROAD · Peru demonstration</p></div><div className={s.viewToggle} aria-label="Operation view"><button aria-pressed={view==='map'} onClick={()=>setView('map')}><Map size={14}/>Map</button><button aria-pressed={view==='list'} onClick={()=>setView('list')}><List size={15}/>List</button></div></div>
      <div className={s.filters}><div className={s.statusFilters} aria-label="Shipment status">{['All','In transit','Scheduled','Delivered'].map(value=><button key={value} aria-pressed={status===value} onClick={()=>setStatus(value)}>{value}{value==='All'?<span>{shipments.length}</span>:null}</button>)}</div><label className={s.sitesToggle}><input type="checkbox" checked={showSites} onChange={e=>setShowSites(e.target.checked)}/><Building2 size={13}/>Hubs</label></div>
      <div className={s.visualFrame}>
       <div hidden={view!=='map'}><GoogleOperationMap items={visible} selected={selected} onSelect={select} showSites={showSites}/></div>
       {view==='list'?<div className={s.listView} aria-label="Demo shipment list">{visible.length?visible.map(item=><button className={s.shipmentRow} key={item.id} onClick={()=>select(item.id)} aria-pressed={selected?.id===item.id}><span className={s.vehicleIcon}><Truck size={18}/></span><span><strong>{item.vehicle}<small>{item.id}</small></strong><span>{item.origin} → {item.destination}</span></span><span className={`${s.statusBadge} ${item.status==='Delivered'?s.positive:''}`}>{item.status}</span><ChevronRight size={16}/></button>):<div className={s.empty}><Search size={26}/><strong>No shipments match your filters</strong><button onClick={()=>{setQuery('');setStatus('All');}}>Reset filters</button></div>}</div>:null}
       {selected&&view==='map'?<article className={s.mapDetail} aria-label="Selected shipment"><div><span className={s.detailIcon}><Truck size={18}/></span><span><strong>{selected.vehicle}</strong><small>{selected.id}</small></span><button onClick={()=>setSelectedId(null)} aria-label="Close selected shipment"><X size={16}/></button></div><h3>{selected.origin}<ArrowRight size={14}/>{selected.destination}</h3><p>{selected.cargo}</p><div className={s.detailFacts}><span>Estimated arrival<strong>{selected.eta}</strong></span><span>Journey status<strong>{selected.status}</strong></span></div><div className={s.progressTrack} role="progressbar" aria-label="Simulated journey progress" aria-valuenow={selected.progress} aria-valuemin={0} aria-valuemax={100}><span style={{width:`${selected.progress}%`}}/></div><small className={s.detailSource}>Sample report · {selected.lastReport}</small></article>:null}
       {!visible.length&&view==='map'?<div className={s.noMatches} role="status">No matching shipments. Try another search or status.</div>:null}
      </div>
      <div className={s.mapFooter}><span><i/>{visible.length} of {shipments.length} sample shipments</span><span>Google Maps · Route lines are illustrative</span></div>
     </section>
     <aside className={s.exceptionPanel} aria-labelledby="exception-title"><div className={s.exceptionHeading}><div><h2 id="exception-title">Exception queue</h2><p>Prioritize what needs attention.</p></div><span>{exceptions.length}</span></div>
      <div className={s.exceptionTabs} aria-label="Exception priority">{['Open','Critical','All'].map(tab=><button key={tab} aria-pressed={exceptionTab===tab} onClick={()=>setExceptionTab(tab)}>{tab}<span>{tab==='Critical'?critical:exceptions.length}</span></button>)}</div>
      <div className={s.exceptionList}>{visibleExceptions.length?visibleExceptions.map(alert=><article key={alert.id} className={`${s.exceptionCard} ${alert.shipmentId===selected?.id?s.exceptionSelected:''}`}><div className={s.exceptionTop}><span className={`${s.severityIcon} ${s[alert.severity.toLowerCase()]}`}><AlertTriangle size={16}/></span><button className={s.alertTitle} onClick={()=>selectAlert(alert)}><strong>{alert.title}</strong><small>{alert.shipmentId} · <span className={s[alert.severity.toLowerCase()]}>{alert.severity}</span></small></button><button className={s.locate} onClick={()=>{selectAlert(alert);setView('map');}} aria-label={`Locate ${alert.shipmentId}`}><MapPinned size={17}/></button></div><p>{alert.detail}</p><div className={s.exceptionBottom}><small>Sample · {alert.reportedAt}</small><button onClick={()=>setDialog(alert)}>Review details<ArrowUpRight size={13}/></button></div></article>):<div className={s.empty}><Check size={25}/><strong>No matching exceptions</strong><p>There are no sample exceptions for the current filters.</p></div>}</div>
      <div className={s.queueNote}><Clock3 size={14}/>Reports are simulated, not live telemetry.</div>
     </aside>
    </div>
    <section className={s.bottomGrid} aria-label="Operational context">
     <article className={s.contextCard}><div><Route size={17}/><h2>{selected?'Selected journey':'Journey overview'}</h2></div>{selected?<><h3>{selected.origin} → {selected.destination}</h3><p>{selected.equipment} · {selected.vehicle}</p><dl><div><dt>Sample driver</dt><dd>{selected.driver}</dd></div><div><dt>Progress</dt><dd>{selected.progress}%</dd></div></dl></>:<><h3>Choose a vehicle or exception</h3><p>The map, shipment details and exception queue share the same selection.</p><button onClick={()=>{setQuery('');setStatus('All');select(shipments[0].id);}}>Explore a sample journey<ArrowRight size={14}/></button></>}</article>
     <article className={s.contextCard}><div><Truck size={17}/><h2>Fleet readiness</h2></div><div className={s.fleetBar}>{fleet.map(unit=><span key={unit.id} className={unit.status==='Available'?s.available:unit.status==='Maintenance'?s.maintenance:s.assigned} title={`${unit.id} · ${unit.status}`}/>)}</div><dl>{['Available','Assigned','Maintenance'].map(value=><div key={value}><dt>{value}</dt><dd>{fleet.filter(unit=>unit.status===value).length}</dd></div>)}</dl><p>Sample fleet state. No capacity is reserved by this preview.</p></article>
     <article className={s.contextCard}><div><Building2 size={17}/><h2>Network context</h2></div>{depots.map(depot=><div key={depot.id} className={s.hubRow}><span className={s.hubIcon}><Building2 size={16}/></span><span><strong>{depot.name}</strong><small>Simulated site · Peru</small></span></div>)}<p>A site does not imply permitted routes or service coverage.</p></article>
    </section>
   </main>
  </div>
  {dialog?<ExceptionDialog alert={dialog} onClose={()=>setDialog(null)} onView={()=>{selectAlert(dialog);setDialog(null);setView('map');}}/>:null}
 </div>;
}
function ExceptionDialog({alert,onClose,onView}:{alert:Exception;onClose:()=>void;onView:()=>void}){
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const node=ref.current;node?.showModal();return()=>node?.close();},[]);
 return <dialog ref={ref} className={s.dialog} aria-labelledby="review-title" onCancel={onClose} onClick={e=>{if(e.target===e.currentTarget)onClose();}}><button autoFocus aria-label="Close exception details" onClick={onClose}><X size={20}/></button><span className={s.eyebrow}>EXCEPTION REVIEW · PREVIEW</span><h2 id="review-title">{alert.title}</h2><p>{alert.detail}</p><dl><div><dt>Shipment</dt><dd>{alert.shipmentId}</dd></div><div><dt>Severity</dt><dd>{alert.severity}</dd></div><div><dt>Source</dt><dd>Explicit simulated scenario</dd></div><div><dt>Report time</dt><dd>Oct 13, 2026 · {alert.reportedAt}</dd></div></dl><p className={s.dialogNotice}>This preview does not contact a driver, acknowledge an incident or update operational records.</p><button className={s.dialogAction} onClick={onView}>View shipment on map<ArrowRight size={16}/></button></dialog>;
}

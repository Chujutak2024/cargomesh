'use client';
import {useEffect,useRef,useState} from 'react';
import {Button,Select,Input} from '@/components/ui';
import {PortalApiError} from '@/features/carrier-portal/api';
import {recordData} from '@/features/carrier-portal/records';
import {readRoadPlanner,calculateCarrierRoad,roadFailure,roadAlternatives,type RoadDisplay} from './road-plan-client';
import {activeRoadService,emptyRoadFields,roadInput,routeSummary,type RoadFields} from './road-plan-model';
import {towerDate} from './tower-model';
import s from './tower.module.css';
import {PointStopFields} from './point-stop-fields';
import {calculatePointRoad,pointRoadInput,emptyStop,type StopFields} from './point-plan-client';

export function RoadPlanner({carrierId,revision,onDisplay,onDenied,onShowMap}:{carrierId:string;revision:string;onDisplay:(display:RoadDisplay|null)=>void;onDenied:(message:string)=>void;onShowMap:()=>void}){
 const [open,setOpen]=useState(false),[catalog,setCatalog]=useState<Awaited<ReturnType<typeof readRoadPlanner>>|null>(null),[fields,setFields]=useState<RoadFields>(emptyRoadFields),[error,setError]=useState(''),[busy,setBusy]=useState(false),[result,setResult]=useState<RoadDisplay|null>(null),[refresh,setRefresh]=useState(0);
 const [mode,setMode]=useState<'points'|'cities'>('points'),[stops,setStops]=useState<{origin:StopFields;destination:StopFields}>({origin:{...emptyStop},destination:{...emptyStop}});
 const request=useRef<AbortController|null>(null),generation=useRef(0);
 const callbacks=useRef({onDisplay,onDenied,onShowMap});callbacks.current={onDisplay,onDenied,onShowMap};
 const invalidate=()=>{generation.current++;request.current?.abort();setBusy(false);setResult(null);callbacks.current.onDisplay(null);};
 useEffect(()=>{invalidate();setCatalog(null);setError('');setFields(emptyRoadFields);setStops({origin:{...emptyStop},destination:{...emptyStop}});if(!open)return;const controller=new AbortController();request.current=controller;const token=generation.current;
  void readRoadPlanner(carrierId,controller.signal).then(value=>{if(controller.signal.aborted||token!==generation.current)return;setCatalog(value);const first=value.services.find(activeRoadService);setFields({...emptyRoadFields,serviceId:first?.id??''});}).catch(error=>{if(controller.signal.aborted||token!==generation.current)return;const message=roadFailure(error);setError(message);if(error instanceof PortalApiError&&[401,403].includes(error.status))callbacks.current.onDenied(message);});
  return()=>{generation.current++;controller.abort();request.current?.abort();callbacks.current.onDisplay(null);};
 },[carrierId,revision,open,refresh]);
 function change<K extends keyof RoadFields>(key:K,value:RoadFields[K]){invalidate();setError('');setFields(current=>({...current,[key]:value}));}
 async function calculate(event:React.FormEvent){event.preventDefault();invalidate();setError('');if(!catalog||catalog.partial)return;const service=catalog.services.find(row=>row.id===fields.serviceId);if(!service){setError('Select a recorded ROAD service.');return;}
  let input;try{input=mode==='points'?pointRoadInput(fields,stops.origin,stops.destination,service):roadInput(fields,service,catalog.options);}catch(error){setError(error instanceof Error?error.message:'Check the planning inputs.');return;}
  const controller=new AbortController();request.current=controller;const token=generation.current;setBusy(true);
  try{const display:RoadDisplay=mode==='points'?await calculatePointRoad(carrierId,input,service,controller.signal):await calculateCarrierRoad(carrierId,input,service,controller.signal).then(assessment=>({assessment,selectedId:assessment.routing?.status==='estimated'?assessment.routing.selectedId:''}));if(controller.signal.aborted||token!==generation.current)return;
   setResult(display);callbacks.current.onDisplay(display);if(display.selectedId)callbacks.current.onShowMap();
  }catch(error){if(controller.signal.aborted||token!==generation.current)return;const message=roadFailure(error);setError(message);if(error instanceof PortalApiError&&[401,403].includes(error.status))callbacks.current.onDenied(message);if(error instanceof PortalApiError&&error.code==='STALE_COVERAGE')setCatalog(null);
  }finally{if(token===generation.current)setBusy(false);}
 }
 const options=catalog?.options,alternatives=roadAlternatives(result),assessment=result?.assessment;
 return <section className={s.contextCard} aria-labelledby="carrier-road-plan-title" style={{marginBottom:18}}>
  <div><h2 id="carrier-road-plan-title">Road route planning</h2><Button variant="secondary" size="compact" aria-expanded={open} onClick={()=>{invalidate();setOpen(value=>!value);}}>{open?'Close planner':'Plan a road route'}</Button></div>
  <p>Plan pickup-to-delivery road routes after checking this service’s published coverage. This planning estimate is separate from the selected operation, customer request and vehicle position.</p>
  {open?<><p>Google Routes is called only after coverage is established. Address resolution is a separate provider lookup. Manual calculations and address lookups may incur provider charges. Nothing is booked, assigned or saved to an order.</p>
   <Button variant="secondary" size="compact" disabled={busy} onClick={()=>{invalidate();setRefresh(value=>value+1);}}>Refresh planning catalog</Button>
   {error?<p role="alert">{error}</p>:null}
   {!catalog&&!error?<p role="status">Loading authorized ROAD services and supported city references…</p>:null}
   {catalog?.partial?<p role="status">Service catalog is incomplete. Calculation is disabled; refresh before continuing.</p>:null}
   {options&&!options.enabled?<p role="status">Carrier road calculation is disabled in this environment.</p>:null}
   {catalog&&options?<form onSubmit={event=>void calculate(event)}>
    <fieldset disabled={busy||catalog.partial||!options.enabled} style={{border:0,padding:0,margin:'16px 0',display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,230px),1fr))',gap:12}}>
     <Select label="Carrier ROAD service" value={fields.serviceId} onChange={event=>change('serviceId',event.target.value)}><option value="">Select a service</option>{catalog.services.map(row=><option key={row.id} value={row.id} disabled={!activeRoadService(row)}>{String(recordData(row).serviceClass)} · {row.id.slice(0,8)} · {String(recordData(row).status)}</option>)}</Select>
     <Select label="Location precision" value={mode} onChange={event=>{invalidate();setError('');setMode(event.target.value as 'points'|'cities');}}><option value="points">Pickup and delivery points</option><option value="cities">Representative cities</option></Select>
     {mode==='points'?<PointStopFields carrierId={carrierId} origin={stops.origin} destination={stops.destination} geocodingConfigured={options.geocodingConfigured===true} onDenied={onDenied} onChange={(role,value)=>{invalidate();setError('');setStops(current=>({...current,[role]:value}));}}/>:null}
     {mode==='cities'?(['originReferenceId','destinationReferenceId'] as const).map(key=><Select key={key} label={key==='originReferenceId'?'Origin city reference':'Destination city reference'} value={fields[key]} onChange={event=>change(key,event.target.value)}><option value="">Select a city</option>{options.references.map(city=><option key={city.id} value={city.id}>{city.city} · {city.countryCode}</option>)}</Select>):null}
     {(['pickupStart','pickupEnd','deliveryStart','deliveryEnd'] as const).map((key,index)=><Input key={key} label={['Pickup starts','Pickup ends','Delivery starts','Delivery ends'][index]} value={fields[key]} onChange={event=>change(key,event.target.value)} placeholder="YYYY-MM-DDTHH:mm:ss-05:00" required autoComplete="off"/>)}
     <Select label="Comparison objective" value={fields.objective} onChange={event=>change('objective',event.target.value as RoadFields['objective'])}><option value="FASTEST">Fastest returned route</option><option value="SHORTEST_RETURNED">Shortest returned route</option></Select>
     <Select label="Traffic estimate" value={fields.traffic} onChange={event=>change('traffic',event.target.value as RoadFields['traffic'])}><option value="TRAFFIC_UNAWARE">Without traffic baseline</option><option value="TRAFFIC_AWARE_OPTIMAL">Traffic-aware at pickup start</option></Select>
    </fieldset>
    <p>All four times require Z or an explicit UTC offset. These are operator planning windows, not recovered customer windows. Driving time excludes loading, unloading, rests, border waits and repositioning.</p>
    <Button type="submit" disabled={busy||catalog.partial||!options.enabled||!fields.serviceId}>{busy?'Checking coverage and calculating…':'Check coverage & calculate'}</Button>
   </form>:null}
   {result?.pointEvidence?<section aria-label="Resolved planning locations" style={{marginTop:16}}><h3>Resolved pickup and delivery</h3>{([['Pickup',result.pointEvidence.originStop],['Delivery',result.pointEvidence.destinationStop]] as const).map(([label,stop])=><p key={label}><strong>{label}:</strong> {stop.label} · {stop.lat}, {stop.lng} · {stop.source.replaceAll('_',' ')} · {stop.precision}</p>)}<p>Road access may be up to 200 m from a requested point. No straight connector is added. Loading access and truck restrictions remain unverified.</p></section>:null}
   {assessment?<div aria-live="polite" style={{marginTop:16}}><h3>Coverage: {assessment.coverage.status}</h3><p>Pickup: {assessment.coverage.pickup.status} · Delivery: {assessment.coverage.delivery.status} · Directed connection: {assessment.coverage.lane.status}</p>
    <ul>{assessment.coverage.reasons.map(reason=><li key={reason}>{reason.replaceAll('_',' ')}</li>)}</ul>
    {assessment.coverage.borderReviewRequired?<p>Border review is required. A road estimate does not authorize crossing.</p>:null}
    {assessment.notCalculatedReason?<p>No route calculated: {assessment.notCalculatedReason.replaceAll('_',' ')}. No substitute line was drawn.</p>:null}
    {assessment.routing&&assessment.routing.status!=='estimated'?<p role="status">Road calculation unavailable: {assessment.routing.reason.replaceAll('_',' ')}. No substitute line was drawn.</p>:null}
    {alternatives.length?<><h3>Google road alternatives</h3><p>Compared only within returned alternatives. Truck access, resource availability and travel authorization remain unconfirmed.</p><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,230px),1fr))',gap:12}}>{alternatives.map(route=>{const facts=routeSummary(route.distanceMeters,route.durationSeconds);return <article key={route.id} style={{border:'1px solid var(--cm-color-line)',borderRadius:10,padding:12}}><h4>Alternative {route.providerIndex+1}{assessment.routing?.status==='estimated'&&assessment.routing.selectedId===route.id?' · Recommended by objective':''}</h4><p>{facts.distance} · {facts.driving}</p><ul>{route.warnings.map((warning,i)=><li key={i}>{warning}</li>)}</ul><Button variant="secondary" size="compact" aria-pressed={result?.selectedId===route.id} onClick={()=>{const display={...result,assessment,selectedId:route.id};setResult(display);callbacks.current.onDisplay(display);callbacks.current.onShowMap();}}>Show this route</Button></article>;})}</div></>:null}
    <details><summary>Source, coverage versions and limitations</summary><p>Assessment: {towerDate(assessment.checkedAt)} · {assessment.timeBasis.replaceAll('_',' ')}</p><p>Provider calculation: {assessment.routing?.status==='estimated'?towerDate(assessment.routing.calculatedAt):'Not available'} · GOOGLE ROUTES API</p><p>Coverage fingerprint: {assessment.catalogFingerprint}</p><ul>{assessment.coverage.references.map(ref=><li key={ref.kind+ref.id}>{ref.kind} · {ref.id.slice(0,8)} · revision {ref.version} · {ref.source}</li>)}</ul><p>Non-atomic read, rechecked after provider. Revalidation is required before any commitment. No capacity reserved. Transit countries and truck restrictions have not been verified.</p></details>
   </div>:null}
  </>:null}
 </section>;
}

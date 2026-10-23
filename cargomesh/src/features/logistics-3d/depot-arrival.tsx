'use client';
import dynamic from 'next/dynamic';
import { Component, useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Building2, Eye, Pause, Play, RotateCcw, Truck, Warehouse, Wrench, ZoomIn, ZoomOut } from 'lucide-react';
import { useReducedMotionPreference } from '@/features/product-motion/use-motion-preference';
import type { TruckInspectionContext } from '@/features/carrier-portal/truck-inspection-model';
import { createDepotCoordinator, yardPhaseLabels, type DepotCoordinator } from './depot-coordinator';
import type { YardViewControls } from './depot-yard-scene';
import { getTruckEnvironment } from './truck-environment';
import { depotTemplate, depotTemplates, type DepotTemplateId } from './depot-templates';
import { truckDesigns, compatibleTruckDesign, familyDesign, truckBody } from './visual-catalog';
import s from './depot.module.css';
const DepotYardScene = dynamic(() => import('./depot-yard-scene'), { ssr: false, loading: () => null });
class DepotBoundary extends Component<{ children: ReactNode; failed: () => void }, { error: boolean }> {
  state = { error: false }; static getDerivedStateFromError() { return { error: true }; }
  componentDidCatch() { this.props.failed(); } render() { return this.state.error ? null : this.props.children; }
}
export default function DepotArrival({ context, coordinator, referenceOnly = false, compact = false }: { context: Pick<TruckInspectionContext, 'depot'>; coordinator?: DepotCoordinator; referenceOnly?: boolean; compact?: boolean }) {
  const [local] = useState(createDepotCoordinator), controller = coordinator ?? local;
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const preferredReduced = useReducedMotionPreference();
  const playing = (snapshot.requestedPlay ?? !preferredReduced) && !snapshot.completed;
  const reduced = preferredReduced && snapshot.requestedPlay !== true;
  const [error, setError] = useState(false), [loadedTemplate, setLoadedTemplate] = useState<DepotTemplateId | null>(null), [retry, setRetry] = useState(0);
  const loaded = loadedTemplate === snapshot.templateId;
  const [visible, setVisible] = useState(false), [hidden, setHidden] = useState(false), [clock, setClock] = useState<Date | null>(null);
  const host = useRef<HTMLDivElement>(null), controls = useRef<YardViewControls | null>(null);
  const receiveControls = useCallback((value: YardViewControls | null) => { controls.current = value; }, []);
  const failed = useCallback(() => setError(true), []), ready = useCallback(() => setLoadedTemplate(snapshot.templateId), [snapshot.templateId]);
  useEffect(() => {
    const observer = new IntersectionObserver(entries => setVisible(entries.some(entry => entry.isIntersecting)));
    if (host.current) observer.observe(host.current);
    const visibility = () => { setHidden(document.hidden); if (!document.hidden) setClock(new Date()); };
    visibility(); const timer = window.setInterval(visibility, 30000); document.addEventListener('visibilitychange', visibility);
    return () => { observer.disconnect(); window.clearInterval(timer); document.removeEventListener('visibilitychange', visibility); };
  }, []);
  const active = visible && !hidden && !error;
  useEffect(() => {
    if (!active || !playing || !loaded) return;
    let last = performance.now();
    // This clock lives outside R3F. Inactive views freeze without rewinding.
    const timer = window.setInterval(() => { if (document.hidden) return; const now = performance.now(); controller.advance(Math.min(100, now - last)); last = now; }, 1000 / 30);
    return () => window.clearInterval(timer);
  }, [controller, active, playing, loaded]);
  useEffect(() => { if (!visible || loaded || error) return; const timeout = window.setTimeout(failed, 12000); return () => window.clearTimeout(timeout); }, [visible, loaded, error, failed, retry]);
  const selected = snapshot.vehicles.find(vehicle => vehicle.assetId === snapshot.selectedAssetId);
  const groups = [
    { label: 'Present', vehicles: snapshot.vehicles.filter(v => !['departing', 'departed', 'unknown'].includes(v.phase)) },
    { label: 'Departures', vehicles: snapshot.vehicles.filter(v => ['departing', 'departed'].includes(v.phase)) },
    { label: 'Location unknown', vehicles: snapshot.vehicles.filter(v => v.phase === 'unknown') },
  ];
  return <section className={`${s.root} ${compact ? s.compact : ''}`} aria-label="Depot visual simulation" data-depot-time={snapshot.elapsedMs} data-scenario-id={snapshot.scenarioId}>
    {!compact ? <><header className={s.facility}><span className={s.brand}><Building2 size={23}/></span><div><h3>{referenceOnly ? 'Facility architecture' : 'Depot operations'}</h3><p>{context.depot.name} · {context.depot.city}</p></div><span className={s.simulation}>{referenceOnly ? 'Visual reference' : 'Visual simulation'}</span></header>
    <p className={s.disclaimer}>{referenceOnly ? 'Explicit architectural reference. No coverage, capacity, inventory, availability or vehicle presence is implied.' : `${snapshot.vehicles.length} illustrative vehicles share one yard. This scene does not report live positions or availability.`}</p>
    {referenceOnly ? <p>{depotTemplate(snapshot.templateId).name} · {depotTemplate(snapshot.templateId).description}</p> : <div className={s.designControls}>
      <label>Depot design · {depotTemplates.length} visual layouts<select aria-label="Depot design" value={snapshot.templateId} onChange={event => { setError(false); controller.setTemplate(event.target.value as DepotTemplateId); }}>{depotTemplates.map(template => <option key={template.id} value={template.id}>{template.name}</option>)}</select></label>
      {selected ? <label>Vehicle design<select aria-label="Vehicle design" value={selected.designId} onChange={event => controller.setDesign(selected.assetId, event.target.value)}>{truckDesigns.filter(design => compatibleTruckDesign(design, selected.family, selected.body ?? truckBody(familyDesign(selected.family))) && (!selected.cargo || !design.appearance.bodyStyle)).map(design => <option key={design.id} value={design.id}>{design.name}</option>)}</select></label> : null}
      <p>{depotTemplate(snapshot.templateId).description} Visual layout only.</p>
    </div>}
    </> : null}
    <div className={referenceOnly || compact ? s.referenceLayout : s.layout}><div className={s.viewer}>
      <div ref={host} className={s.stage} data-depot-state={error ? 'failed' : loaded ? 'ready' : 'loading'}>
        {!error && visible ? <DepotBoundary key={retry} failed={failed}><DepotYardScene controller={controller} color={context.depot.color} active={active} running={playing && active} reduced={reduced} night={getTruckEnvironment(clock ?? new Date(2000, 0, 1, 12)).night} onReady={ready} onFailure={failed} onControls={receiveControls}/></DepotBoundary> : null}
        {error ? <div className={s.error} role="alert"><Building2 size={32}/><strong>The 3D view is unavailable</strong><p>{referenceOnly ? 'The facility details and explicit reference are still available.' : 'The vehicle list and scenario state are still available.'}</p><button onClick={() => { setLoadedTemplate(null); setError(false); setRetry(value => value + 1); }}>Retry 3D view</button></div> : !loaded ? <div className={s.preparing} role="status">{referenceOnly ? 'Preparing the facility…' : 'Preparing the depot…'}</div> : null}
        {loaded && !error ? <div className={s.sceneLegend}><span className={s.dot}/>{selected ? selected.label : 'Site overview'}<span>·</span>{snapshot.interior ? 'Interior' : 'Exterior'}</div> : null}
      </div>
      <div className={s.toolbar} role="group" aria-label="Depot view controls">
        {!referenceOnly && !compact ? <button className={s.playback} disabled={snapshot.completed} aria-pressed={playing} onClick={() => controller.setPlaying(!playing)}>{playing ? <Pause size={16}/> : <Play size={16}/>} {snapshot.completed ? 'Scenario complete' : playing ? 'Pause visualization' : 'Resume visualization'}</button> : null}
        {!compact ? <><button onClick={() => { controller.select(null); controls.current?.overview(); }} aria-label="Site overview" title="Site overview"><RotateCcw size={17}/></button>
        <button disabled={!loaded || error} onClick={() => controls.current?.zoom(1.2)} aria-label="Zoom in" title="Zoom in"><ZoomIn size={17}/></button>
        <button disabled={!loaded || error} onClick={() => controls.current?.zoom(1 / 1.2)} aria-label="Zoom out" title="Zoom out"><ZoomOut size={17}/></button>
        </> : null}<button aria-pressed={snapshot.interior} onClick={() => controller.setInterior(!snapshot.interior)}><Warehouse size={17}/>{snapshot.interior ? 'Exterior' : 'Interior'}</button>
      </div>
      {!compact ? <p className={s.playbackNote}>{referenceOnly ? 'Drag to orbit; scroll to zoom. The architecture is illustrative and does not alter the recorded location.' : 'Playback only affects this visualization. Leaving this view keeps its state.'}</p> : null}
    </div>{!referenceOnly && !compact ? <aside className={s.roster} aria-label="Depot vehicle list">
      <div className={s.rosterHeading}><h4>Vehicles</h4><span>{snapshot.vehicles.length}</span></div>
      {snapshot.vehicles.length === 0 ? <p className={s.empty}>No vehicles in this visual scenario.</p> : groups.filter(group => group.vehicles.length).map(group => <div key={group.label} className={s.group}><h5>{group.label}<span>{group.vehicles.length}</span></h5><ul>{group.vehicles.map(vehicle => <li key={vehicle.assetId}><button className={s.vehicle} data-phase={vehicle.phase} aria-pressed={snapshot.selectedAssetId === vehicle.assetId} onClick={event => controller.select(snapshot.selectedAssetId === vehicle.assetId ? null : vehicle.assetId, event.detail === 0)}>
        <span className={s.vehicleIcon}>{vehicle.phase === 'maintenance' ? <Wrench size={19}/> : <Truck size={19}/>}</span><span className={s.vehicleText}><strong>{vehicle.label}<small>{vehicle.family}</small></strong><span>{yardPhaseLabels[vehicle.phase]}{vehicle.reserved ? ' · Reserved' : ''}</span><small>{vehicle.resourceCode ? vehicle.resourceCode.replace('_', ' ') : vehicle.phase === 'unknown' ? 'Not placed in the yard' : vehicle.phase === 'parked' ? 'Parking area · No task' : vehicle.phase === 'waiting' ? 'Queue · Bay 02 next' : vehicle.phase === 'departed' ? 'Outside the yard' : 'Yard lane'}</small></span><Eye className={s.focusIcon} size={15}/>
      </button></li>)}</ul></div>)}
    </aside> : null}</div>
    {!referenceOnly && !compact ? <div className={s.event} role="status" aria-live="polite"><span className={s.dot}/><p>{snapshot.lastEvent}</p></div> : null}
  </section>;
}

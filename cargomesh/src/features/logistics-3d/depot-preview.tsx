'use client';
import dynamic from 'next/dynamic';
import { useRef, useState, useSyncExternalStore } from 'react';
import { TruckInspection } from '@/features/carrier-portal/truck-inspection';
import type { TruckInspectionContext } from '@/features/carrier-portal/truck-inspection-model';
import { createDepotCoordinator } from './depot-coordinator';
import DepotArrival from './depot-arrival';
import { VisualDesignCatalog } from './visual-design-catalog';
import { truckDesigns } from './visual-catalog';
import { depotTemplates, type DepotTemplateId } from './depot-templates';
import { createFacilityEndpointState } from './facility-visual';
import type { VisualTripClock } from './visual-trip';
import s from './depot-preview.module.css';
const VisualTrip = dynamic(() => import('./visual-trip').then(module => module.VisualTrip), { ssr: false });
const FacilityReferencePreview = dynamic(() => import('./facility-reference-preview').then(module => module.FacilityReferencePreview), { ssr: false });

const context: TruckInspectionContext = {
  id: 'visual-depot-preview', title: 'Truck A · Box trailer', subtitle: 'Visual scenario', variant: 'articulated',
  custom: false, photo: '/v2-workspace/trucks/articulated-3d.png', photoReference: true, status: 'Visual simulation',
  facts: [{ label: 'Source', value: 'Presentation fixture — no business records' }], routeDraft: null,
  origin: 'Demo yard', destination: 'No geographic route',
  map: { selectedCandidate: null, markers: [], paths: [], provenanceStatus: 'UNKNOWN', geometrySource: null, distanceKm: null, estimatedTransitHours: null },
  depot: { name: 'CargoMesh demonstration depot', city: 'Visual scenario', carrier: null, color: '#147d88', site: null, planned: false },
};

export function DepotPreview({ initialView = 'yard', development = true }: { initialView?: 'yard' | 'designs'; development?: boolean }) {
  const [controller] = useState(() => { const value = createDepotCoordinator(); value.setTemplate('cross-dock'); return value; });
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const [view, setView] = useState<'yard' | 'summary' | 'designs' | 'trip' | 'facilities'>(initialView), [inspect, setInspect] = useState(false);
  const [designId, setDesignId] = useState('car-carrier');
  const [facilityState] = useState(createFacilityEndpointState);
  const [facilityDesigns, setFacilityDesigns] = useState<[DepotTemplateId, DepotTemplateId]>(['industrial-plant', 'pharmaceutical-centre']);
  const tripClocks = useRef(new Map<string, VisualTripClock>());
  const selected = snapshot.vehicles.find(vehicle => vehicle.assetId === snapshot.selectedAssetId) ?? snapshot.vehicles[0];
  if (!tripClocks.current.has(selected.assetId)) tripClocks.current.set(selected.assetId, { distance: 0, requestedPlay: null });
  return <main className={s.page}>
    <header className={s.header}><div><h1>3D design studio</h1><p>{truckDesigns.length} truck designs · {depotTemplates.length} depot layouts · Visual simulation, separate from fleet records</p></div><div className={s.headerActions}><a href="/v2-workspace#/fleet">Back to fleet</a>{development ? <button onClick={() => setInspect(true)}>Open inspection dialog</button> : null}</div></header>
    <nav className={s.tabs} aria-label="Preview views"><button aria-current={view === 'designs' ? 'page' : undefined} onClick={() => setView('designs')}>Truck designs</button><button aria-current={view === 'yard' ? 'page' : undefined} onClick={() => setView('yard')}>Depot designs</button><button aria-current={view === 'trip' ? 'page' : undefined} onClick={() => setView('trip')}>Scenic trip</button><button aria-current={view === 'facilities' ? 'page' : undefined} onClick={() => setView('facilities')}>Facility endpoints</button>{development ? <button aria-current={view === 'summary' ? 'page' : undefined} onClick={() => setView('summary')}>Scenario summary</button> : null}</nav>
    {inspect ? null : view === 'facilities' ? <FacilityReferencePreview state={facilityState} designs={facilityDesigns} onDesign={(index, id) => setFacilityDesigns(values => index === 0 ? [id, values[1]] : [values[0], id])}/> : view === 'designs' ? <VisualDesignCatalog selectedId={designId} onSelect={setDesignId} openYard={() => setView('yard')}/> : view === 'yard' ? <DepotArrival context={context} coordinator={controller}/> : view === 'trip' ? <><label className={s.tripSelect}>Visual vehicle<select value={selected.assetId} onChange={event => controller.select(event.target.value, true)}>{snapshot.vehicles.map(vehicle => <option key={vehicle.assetId} value={vehicle.assetId}>{vehicle.label} · {vehicle.family}{vehicle.tripId ? '' : ' · No trip assigned'}</option>)}</select></label><VisualTrip key={selected.assetId} vehicle={selected} siteId={snapshot.siteId} clock={tripClocks.current.get(selected.assetId)!}/></> : <section className={s.summary}><h2>Scenario summary</h2><p>The yard is unmounted. Its coordinator is retained above all views.</p><dl><div><dt>Scenario clock</dt><dd data-retained-time>{controller.getElapsedMs().toFixed(0)} ms</dd></div><div><dt>Selected vehicle</dt><dd>{snapshot.selectedAssetId ?? 'Site overview'}</dd></div><div><dt>Depot design</dt><dd>{snapshot.templateId}</dd></div></dl><p>Return to Yard to continue from the same point.</p></section>}
    {inspect ? <TruckInspection context={context} onClose={() => setInspect(false)}/> : null}
  </main>;
}

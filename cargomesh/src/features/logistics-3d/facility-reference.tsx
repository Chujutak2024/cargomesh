'use client';
import { useState } from 'react';
import type { FacilityV2 } from '@/shared/schemas/v2/facilities';
import type { CanonicalLocationV2 } from '@/shared/schemas/v2/freight-request';
import DepotArrival from './depot-arrival';
import { facilityVisualController, resolveFacilityVisual, type FacilityVisualBinding, type FacilityVisualReference, type FacilityEndpointState } from './facility-visual';
import type { DepotCoordinator } from './depot-coordinator';
import s from './depot-preview.module.css';

export function FacilityReference({ reference, controller }: { reference: FacilityVisualReference; controller: DepotCoordinator }) {
  const title = reference.usage === 'PICKUP' ? 'Pickup facility' : reference.usage === 'DELIVERY' ? 'Delivery facility' : 'Facility reference';
  return <section aria-label={title}>
    <p>{reference.name} · {reference.function} · {reference.location.city}, {reference.location.countryCode}</p>
    <DepotArrival referenceOnly context={{ depot: { name: reference.name, city: reference.location.city, color: '#147d88', carrier: null, site: null, planned: false } }} coordinator={controller}/>
  </section>;
}

/** Own both coordinators above the view switch; role never determines appearance. */
export function FacilityEndpointVisuals({ organizationId, origin, destination, facilities, references, state }: {
  organizationId: string; origin: CanonicalLocationV2; destination: CanonicalLocationV2;
  facilities: readonly FacilityV2[]; references: readonly FacilityVisualBinding[];
  state: FacilityEndpointState;
}) {
  const [usage, setUsage] = useState(state.usage), controllers = state.controllers;
  const reference = resolveFacilityVisual({ organizationId, location: usage === 'PICKUP' ? origin : destination, usage, facilities, references });
  const view = reference ? facilityVisualController(controllers, reference) : null;
  const selectUsage = (next: 'PICKUP' | 'DELIVERY') => { state.usage = next; setUsage(next); };
  return <section aria-label="Facility endpoint references">
    <div className={s.tabs} role="group" aria-label="Facility endpoint"><button aria-pressed={usage === 'PICKUP'} onClick={() => selectUsage('PICKUP')}>Pickup facility</button><button aria-pressed={usage === 'DELIVERY'} onClick={() => selectUsage('DELIVERY')}>Delivery facility</button></div>
    {reference && view ? <FacilityReference key={view.key} reference={reference} controller={view.controller}/> : <p role="status">No explicit 3D reference for this facility. The recorded location is unchanged.</p>}
  </section>;
}

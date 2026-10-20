'use client';
import type { FacilityV2 } from '@/shared/schemas/v2/facilities';
import { FacilityDirectory } from '@/features/shipper-portal/facility-directory';
import { FacilityEndpointVisuals } from './facility-reference';
import { depotTemplates, type DepotTemplateId } from './depot-templates';
import type { FacilityEndpointState, FacilityVisualBinding } from './facility-visual';
import s from './depot-preview.module.css';

// Studio-only examples; no API writes or enterprise facility records.
const organizationId = '10000000-0000-4000-8000-000000000001';
const facilities: FacilityV2[] = ['Production reference', 'Receiving reference'].map((name, index) => ({
  id: `20000000-0000-4000-8000-00000000000${index + 1}`, organizationId, version: 1,
  createdAt: '2026-10-19T00:00:00Z', updatedAt: '2026-10-19T00:00:00Z',
  value: { schemaVersion: '2.0', code: `VISUAL-${index + 1}`, name, facilityType: index ? 'WAREHOUSE' : 'SHIPPER_SITE',
    active: true, accessRestrictions: [], operatingHours: null,
    location: { label: 'Studio fixture — not a geographic address', countryCode: 'PE', city: 'Visual reference', region: null, lat: null, lng: null } },
}));
export function FacilityReferencePreview({ state, designs, onDesign }: { state: FacilityEndpointState; designs: [DepotTemplateId, DepotTemplateId]; onDesign: (index: number, id: DepotTemplateId) => void }) {
  const references: FacilityVisualBinding[] = facilities.map((facility, index) => ({ organizationId, facilityId: facility.id, templateId: designs[index] }));
  return <section>
    <h2>Pickup and delivery references</h2>
    <p>Local preview fixtures, not saved facilities. Owner, recorded facility function and visual architecture are separate. No operations or inventory are represented.</p>
    <div className={s.tripSelect}>{references.map((reference, index) => <label key={reference.facilityId}>{index ? 'Delivery design' : 'Pickup design'}<select value={reference.templateId} onChange={event => onDesign(index, event.target.value as DepotTemplateId)}>{depotTemplates.map(template => <option key={template.id} value={template.id}>{template.name}</option>)}</select></label>)}</div>
    <FacilityEndpointVisuals organizationId={organizationId} facilities={facilities} references={references} state={state}
      origin={{ ...facilities[0].value.location, facilityId: facilities[0].id }} destination={{ ...facilities[1].value.location, facilityId: facilities[1].id }}/>
    <details><summary>Existing facility directory integration</summary><FacilityDirectory facilities={facilities} visualReferences={references}/></details>
  </section>;
}

import { z } from 'zod';
import { FacilityV2Schema, type FacilityV2 } from '@/shared/schemas/v2/facilities';
import { CanonicalLocationV2Schema, type CanonicalLocationV2 } from '@/shared/schemas/v2/freight-request';
import { depotTemplates, type DepotTemplateId } from './depot-templates';
import { createDepotCoordinator } from './depot-coordinator';

/** Presentation metadata, deliberately outside FacilityInputV2 and business writes. */
export type FacilityVisualBinding = { organizationId: string; facilityId: string; templateId: DepotTemplateId };
export type FacilityUsage = 'PICKUP' | 'DELIVERY' | null;
const Binding = z.object({ organizationId: z.string().uuid(), facilityId: z.string().uuid(), templateId: z.string() }).strict();

/** Caller supplies facilities already authorized by its existing read boundary. */
export function resolveFacilityVisual(input: {
  organizationId: string; location: CanonicalLocationV2; usage: FacilityUsage;
  facilities: readonly FacilityV2[]; references: readonly FacilityVisualBinding[];
}) {
  const point = CanonicalLocationV2Schema.safeParse(input.location);
  if (!point.success || !point.data.facilityId || ![null, 'PICKUP', 'DELIVERY'].includes(input.usage)) return null;
  const facilities = input.facilities.filter(item => item.id === point.data.facilityId && item.organizationId === input.organizationId);
  const references = input.references.filter(item => item.facilityId === point.data.facilityId && item.organizationId === input.organizationId);
  if (facilities.length !== 1 || references.length !== 1) return null;
  const facility = FacilityV2Schema.safeParse(facilities[0]), binding = Binding.safeParse(references[0]);
  if (!facility.success || !binding.success) return null;
  const template = depotTemplates.find(item => item.id === binding.data.templateId);
  if (!template) return null;
  return { facilityId: facility.data.id, organizationId: facility.data.organizationId,
    name: facility.data.value.name, function: facility.data.value.facilityType,
    usage: input.usage, location: point.data, templateId: template.id, source: 'EXPLICIT_VISUAL_REFERENCE' as const };
}
export type FacilityVisualReference = NonNullable<ReturnType<typeof resolveFacilityVisual>>;
export function createFacilityEndpointState() {
  return { usage: 'PICKUP' as 'PICKUP' | 'DELIVERY', controllers: new Map<string, ReturnType<typeof createDepotCoordinator>>() };
}
export type FacilityEndpointState = ReturnType<typeof createFacilityEndpointState>;
export function facilityVisualController(controllers: FacilityEndpointState['controllers'], reference: FacilityVisualReference) {
  const key = `${reference.usage ?? 'REFERENCE'}:${reference.organizationId}:${reference.facilityId}:${reference.templateId}`;
  if (!controllers.has(key)) controllers.set(key, createFacilityVisualCoordinator(reference));
  return { key, controller: controllers.get(key)! };
}

export function createFacilityVisualCoordinator(reference: FacilityVisualReference) {
  const controller = createDepotCoordinator({ scenarioId: 'facility-reference-' + reference.facilityId,
    siteId: reference.facilityId, source: 'SIMULATED', durationMs: 90000, vehicles: [], events: [] });
  controller.setTemplate(reference.templateId); controller.setPlaying(false);
  return controller;
}

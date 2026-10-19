import { Hono } from 'hono';
import { z } from 'zod';
import { carrierPortalIdentity } from './carrier-portal';
import { requireAuthenticatedCarrier } from '@/server/auth/carrier';
import { RoadOperationService } from '@/server/modules/carrier-road-routing/application/road-operation-service';
import { CarrierRoadService, type RoadActor } from '@/server/modules/carrier-road-routing/application/carrier-road-service';
import { coveredRoadProvider } from '@/server/modules/carrier-road-routing/infrastructure/google-road-provider';
import { CatalogServiceV2 } from '@/server/modules/catalog/application/catalog-service';
import { catalogRepositoryV2 } from '@/server/modules/catalog/infrastructure/supabase-catalog-repository';
import { CarrierAvailabilityService } from '@/server/modules/fleet/application/availability-service';
import { CarrierOperationalAssessmentService } from '@/server/modules/fleet/application/operational-assessment-service';
import { WorkflowServiceV2 } from '@/server/modules/workflow/application/workflow-service';
import { workflowRepositoryV2 } from '@/server/modules/workflow/infrastructure/supabase-workflow-repository';
import { DepotOperationsService } from '@/server/modules/depot-operations/application/depot-service';
import { depotRepository } from '@/server/modules/depot-operations/infrastructure/depot-repository';
import { V2DraftError } from '@/server/modules/freight-requests/application/draft-service';

async function body(request: Request) {
  if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json')
    throw new V2DraftError('VALIDATION_ERROR', 'JSON body required.', 400);
  const reader = request.body?.getReader();
  if (!reader) throw new V2DraftError('VALIDATION_ERROR', 'JSON body required.', 400);
  const parts: Uint8Array[] = []; let bytes = 0;
  try {
    while (true) {
      const part = await reader.read(); if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > 16384) { await reader.cancel(); throw new V2DraftError('PAYLOAD_TOO_LARGE', 'Operation body exceeds 16384 bytes.', 413); }
      parts.push(part.value);
    }
    const buffer = new Uint8Array(bytes); let offset = 0;
    for (const part of parts) { buffer.set(part, offset); offset += part.length; }
    try { return JSON.parse(new TextDecoder().decode(buffer)) as unknown; }
    catch { throw new V2DraftError('VALIDATION_ERROR', 'Valid JSON required.', 400); }
  } finally { reader.releaseLock(); }
}

export function createCarrierRoadOperationRouter(dependencies: {
  enabled?: boolean; authenticate?: (carrierId: string) => Promise<RoadActor>;
  service?: () => Promise<Pick<RoadOperationService, 'assess'>>;
} = {}) {
  const router = new Hono();
  router.post('/carrier-portal/carriers/:carrierId/road-operation-assessments', c => carrierPortalIdentity(c, async () => {
    const carrierId = z.string().uuid().parse(c.req.param('carrierId'));
    const actor = await (dependencies.authenticate ?? requireAuthenticatedCarrier)(carrierId);
    if (actor.carrierId !== carrierId) throw new V2DraftError('FORBIDDEN_CARRIER_IDENTITY', 'Carrier scope mismatch.', 403);
    if (!(dependencies.enabled ?? process.env.CARGOMESH_CARRIER_ROAD_ENABLED === 'true'))
      throw new V2DraftError('ROUTING_NOT_ENABLED', 'Carrier road evaluation is not enabled.', 503);
    const input = await body(c.req.raw);
    if (dependencies.service) return c.json(await (await dependencies.service()).assess(actor, input));
    const [repository, workflow, depot] = await Promise.all([catalogRepositoryV2(), workflowRepositoryV2(), depotRepository()]);
    const catalog = new CatalogServiceV2(repository);
    const operations = new CarrierOperationalAssessmentService(
      new CarrierAvailabilityService(catalog, new WorkflowServiceV2(workflow)), new DepotOperationsService(depot));
    return c.json(await new RoadOperationService(catalog, new CarrierRoadService(catalog, coveredRoadProvider), operations).assess(actor, input));
  }));
  return router;
}
export const carrierRoadOperationRouter = createCarrierRoadOperationRouter();

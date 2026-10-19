import { Hono, type Context } from 'hono';
import { carrierPortalIdentity } from './carrier-portal';
import { requireAuthenticatedCarrier } from '@/server/auth/carrier';
import { V2DraftError } from '@/server/modules/freight-requests/application/draft-service';
import { BorderOperationsService, type BorderAction, type BorderActor } from '@/server/modules/border-operations/application/border-service';
import { borderRepository } from '@/server/modules/border-operations/infrastructure/border-repository';

export function createCarrierBordersRouter(dependencies: {
  authenticate?: (carrierId: string) => Promise<BorderActor>;
  service?: () => Promise<BorderOperationsService>;
} = {}) {
const router = new Hono();
const base = '/carrier-portal/carriers/:carrierId/border-crossings';
for (const [suffix, action, post] of [
  ['', 'list', false], ['', 'create', true], ['/:id', 'read', false],
  ['/:id/reviews', 'review', true], ['/:id/passage-events', 'passage', true],
  ['/:id/history', 'history', false], ['/:id/assessment', 'assessment', false],
] as const) {
  const handler = (c: Context) => carrierPortalIdentity(c, async () => {
    const actor = await (dependencies.authenticate ?? requireAuthenticatedCarrier)(c.req.param('carrierId')!);
    const body = post ? await c.req.json().catch(() => {
      throw new V2DraftError('VALIDATION_ERROR', 'JSON body required.', 400);
    }) : null;
    const service = dependencies.service ? await dependencies.service() : new BorderOperationsService(await borderRepository());
    const result = await service.execute(actor, action as BorderAction,
      body, c.req.header('Idempotency-Key'), c.req.param('id'));
    return c.json(result, action === 'create' && !result.meta.idempotentReplay ? 201 : 200);
  });
  if (post) router.post(base + suffix, handler);
  else router.get(base + suffix, handler);
}
return router;
}
export const carrierBordersRouter = createCarrierBordersRouter();

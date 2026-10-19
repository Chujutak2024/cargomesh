import {Hono} from 'hono';
import {carrierPortalIdentity} from './carrier-portal';
import {requireAuthenticatedCarrier} from '@/server/auth/carrier';
import {V2DraftError} from '@/server/modules/freight-requests/application/draft-service';
import {RegularDriverService} from '@/server/modules/fleet/application/regular-driver-service';
import {regularDriverRepository} from '@/server/modules/fleet/infrastructure/regular-driver-repository';
export const carrierRegularDriversRouter=new Hono();
const base='/carrier-portal/carriers/:carrierId';
carrierRegularDriversRouter.get(base+'/regular-drivers',c=>carrierPortalIdentity(c,async()=>{
 const actor=await requireAuthenticatedCarrier(c.req.param('carrierId')!);
 const result=await new RegularDriverService(await regularDriverRepository()).execute(actor,null,undefined,undefined,Number(c.req.query('offset')??0));
 return c.json(result);
}));
carrierRegularDriversRouter.post(base+'/assets/:assetId/regular-driver',c=>carrierPortalIdentity(c,async()=>{
 const actor=await requireAuthenticatedCarrier(c.req.param('carrierId')!);
 const body=await c.req.json().catch(()=>{throw new V2DraftError('VALIDATION_ERROR','JSON required.',400);});
 return c.json(await new RegularDriverService(await regularDriverRepository()).execute(actor,c.req.param('assetId')!,body,c.req.header('Idempotency-Key')));
}));

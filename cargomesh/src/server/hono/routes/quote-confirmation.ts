import {Hono} from 'hono';
import type {AuthVariables} from '../middleware/auth';
import {v2AuthMiddleware} from '../middleware/v2-auth';
import {v2Error} from '../middleware/v2-error';
import {carrierPortalIdentity} from './carrier-portal';
import {requireAuthenticatedCarrier} from '@/server/auth/carrier';
import {hasSessionOrigin} from '@/server/auth/session-origin';
import {quoteConfirmation} from '@/server/modules/commercial/application/quote-service';
import {V2DraftError} from '@/server/modules/freight-requests/application/draft-service';
export const quoteConfirmationRouter=new Hono<{Variables:AuthVariables}>();
const client='/bookings/:id/confirmation-window',carrier='/carriers/:carrierId/bookings/:id/confirmation-window';
quoteConfirmationRouter.use(client,v2AuthMiddleware);
for(const method of ['get','post'] as const){
 quoteConfirmationRouter[method](client,async c=>{c.header('Cache-Control','private, no-store');try{
  if(method==='post'&&!c.req.header('Authorization')&&!hasSessionOrigin(c.req.raw))throw new V2DraftError('FORBIDDEN_ORIGIN','Same-origin session request required.',403);
  const member=c.get('member'),body=method==='get'?null:await c.req.json().catch(()=>{throw new V2DraftError('VALIDATION_ERROR','JSON required.',400);});
  const data=await quoteConfirmation(member,c.req.param('id'),body,c.req.header('Idempotency-Key'));
  return c.json({schemaVersion:'2.0',data});
 }catch(e){return v2Error(c,e);}});
 quoteConfirmationRouter[method](carrier,c=>carrierPortalIdentity(c,async()=>{c.header('Cache-Control','private, no-store');
  const actor=await requireAuthenticatedCarrier(c.req.param('carrierId')!);
  const body=method==='get'?null:await c.req.json().catch(()=>{throw new V2DraftError('VALIDATION_ERROR','JSON required.',400);});
  const data=await quoteConfirmation(actor,c.req.param('id')!,body,c.req.header('Idempotency-Key'));
  return c.json({schemaVersion:'2.0',data});
 }));
}

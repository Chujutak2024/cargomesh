import {Hono} from 'hono';
import {carrierPortalIdentity} from './carrier-portal';
import {requireAuthenticatedCarrier} from '@/server/auth/carrier';
import {readQuotePolicies,saveQuotePolicy} from '@/server/modules/commercial/application/quote-service';
import {V2DraftError} from '@/server/modules/freight-requests/application/draft-service';
export const carrierQuotePoliciesRouter=new Hono();
const path='/carrier-portal/carriers/:carrierId/quote-policies';
carrierQuotePoliciesRouter.get(path,c=>carrierPortalIdentity(c,async()=>{
 const actor=await requireAuthenticatedCarrier(c.req.param('carrierId')!);
 const data=await readQuotePolicies(actor);
 return c.json({schemaVersion:'2.0',data});
}));
carrierQuotePoliciesRouter.post(path,c=>carrierPortalIdentity(c,async()=>{
 const actor=await requireAuthenticatedCarrier(c.req.param('carrierId')!);
 const body=await c.req.json().catch(()=>{throw new V2DraftError('VALIDATION_ERROR','JSON required.',400);});
 const data=await saveQuotePolicy(actor,body,c.req.header('Idempotency-Key'));
 return c.json({schemaVersion:'2.0',data});
}));

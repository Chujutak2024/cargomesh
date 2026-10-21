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

quoteConfirmationRouter.post('/bookings/:id/preparations',v2AuthMiddleware,async c=>{
 c.header('Cache-Control','private, no-store');try{
  if(!c.req.header('Authorization')&&!hasSessionOrigin(c.req.raw))throw new V2DraftError('FORBIDDEN_ORIGIN','Same-origin session request required.',403);
  const [{prepareAuthorizedBooking},{WorkflowServiceV2},{workflowRepositoryV2}]=await Promise.all([import('@/server/modules/commercial/application/booking-preparation'),import('@/server/modules/workflow/application/workflow-service'),import('@/server/modules/workflow/infrastructure/supabase-workflow-repository')]);
  const member=c.get('member'),id=c.req.param('id'),body=await c.req.json().catch(()=>{throw new V2DraftError('VALIDATION_ERROR','JSON required.',400);});
  const [{BookingPreparationInputSchema,BookingPreparationResponseSchema},{quoteRpc},{z}]=await Promise.all([import('@/shared/schemas/v2/booking-preparation'),import('@/server/modules/commercial/infrastructure/supabase-quotes'),import('zod')]);
  const input=BookingPreparationInputSchema.parse(body),key=z.string().uuid().parse(c.req.header('Idempotency-Key'));z.string().uuid().parse(id);
  const scheduled=await quoteRpc('prepare_v2_delegated_booking',{p_organization_id:member.organizationId,p_member_id:member.memberId,p_booking_id:id,p_expected_version:input.expectedVersion,p_key:key,p_consent:input.consent});
  if(scheduled!==null)return c.json(BookingPreparationResponseSchema.parse(scheduled));
  return c.json(await prepareAuthorizedBooking(member,id,body,c.req.header('Idempotency-Key'),new WorkflowServiceV2(await workflowRepositoryV2()),async()=>{const window=await quoteConfirmation(member,id,null,undefined);return window?.deadline??null;}));
 }catch(e){return v2Error(c,e);}
});

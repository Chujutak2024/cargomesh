import {Hono} from 'hono';
import {carrierPortalIdentity} from './carrier-portal';
import {requireAuthenticatedMember} from '@/server/auth/member';
import {createIncidentRecovery,readIncidentRecoveries} from '@/server/modules/commercial/application/incident-recovery';
import {V2DraftError} from '@/server/modules/freight-requests/application/draft-service';
export const incidentRecoveryRouter=new Hono();
incidentRecoveryRouter.get('/freight/requests/:requestId/recoveries',c=>carrierPortalIdentity(c,async()=>{
 const actor=await requireAuthenticatedMember();
 return c.json({schemaVersion:'2.0',data:await readIncidentRecoveries(actor,c.req.param('requestId'))});
}));
incidentRecoveryRouter.post('/incidents/:incidentId/recoveries',c=>carrierPortalIdentity(c,async()=>{
 const actor=await requireAuthenticatedMember();
 const body=await c.req.json().catch(()=>{throw new V2DraftError('VALIDATION_ERROR','JSON required.',400);});
 const result=await createIncidentRecovery(actor,c.req.param('incidentId'),body,c.req.header('Idempotency-Key'));
 return c.json({schemaVersion:'2.0',data:result.recovery,meta:{quoteSearchNotice:result.quoteSearchNotice}},201);
}));

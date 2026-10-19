import {Hono} from 'hono';
import {carrierPortalIdentity} from './carrier-portal';
import {v2Error} from '../middleware/v2-error';
import {PreparationService,type PreparationActor} from '@/server/modules/offer-preparations/application/preparation-service';
import {V2DraftError} from '@/server/modules/freight-requests/application/draft-service';
type Dependencies={actor:(carrierId:string)=>Promise<PreparationActor>;service:()=>Promise<PreparationService>};
/** Separate route: saving a preparation cannot invoke offers.create or mutate Customer records. */
export function createOfferPreparationsRouter(deps:Dependencies){
 const app=new Hono(),base='/api/v2/carriers/:carrierId/offer-preparations';
 app.get(base,c=>carrierPortalIdentity(c,async()=>{const actor=await deps.actor(c.req.param('carrierId')),service=await deps.service();return c.json(await service.list(actor,c.req.query()));}));
 app.post(base,c=>carrierPortalIdentity(c,async()=>{const actor=await deps.actor(c.req.param('carrierId')),service=await deps.service();const body=await c.req.json().catch(()=>{throw new V2DraftError('VALIDATION_ERROR','JSON required.',400);});return c.json(await service.save(actor,body,c.req.header('Idempotency-Key')));}));
 app.onError((error,c)=>v2Error(c,error));return app;
}
export async function productionPreparationService(){
 const {preparationRepository}=await import('@/server/modules/offer-preparations/infrastructure/preparation-repository');
 const {workflowRepositoryV2}=await import('@/server/modules/workflow/infrastructure/supabase-workflow-repository');
 const {WorkflowServiceV2}=await import('@/server/modules/workflow/application/workflow-service');
 const {parseCommercialRecord}=await import('@/features/carrier-portal/commercial-model');
 const workflow=new WorkflowServiceV2(await workflowRepositoryV2());
 return new PreparationService(await preparationRepository(),async(actor,value)=>{
  const context={carrierId:actor.carrierId,requestId:null,parentId:null,id:value.opportunityId};
  const o=await workflow.read(actor,'opportunities',context,{});
  const f=value.supersedesOfferId?await workflow.read(actor,'offers',{...context,id:value.supersedesOfferId},{}):null;
  return {opportunity:parseCommercialRecord('opportunities',o.data,actor.carrierId,value.opportunityId),supersedes:f?parseCommercialRecord('offers',f.data,actor.carrierId,value.supersedesOfferId!):null};
 });
}

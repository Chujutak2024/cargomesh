import {Hono,type Context} from 'hono';
import {carrierPortalIdentity} from './carrier-portal';
import {DepotOperationsService,type DepotAction} from '@/server/modules/depot-operations/application/depot-service';
import {depotRepository} from '@/server/modules/depot-operations/infrastructure/depot-repository';
import {requireAuthenticatedCarrier} from '@/server/auth/carrier';
import {V2DraftError} from '@/server/modules/freight-requests/application/draft-service';
export const carrierOperationsRouter=new Hono();
const base='/carrier-portal/carriers/:carrierId/depots/:depotId/operations';
for(const [suffix,action,post] of [['','policy.read',false],['','policy.save',true],['/appointments','appointments.list',false],['/appointments','appointment.save',true],['/appointments/:id/revisions','appointment.save',true],['/availability','availability',true]] as const){
 const handler=(c:Context)=>carrierPortalIdentity(c,async()=>{
  const actor=await requireAuthenticatedCarrier(c.req.param('carrierId')!);
  const body=post?await c.req.json().catch(()=>{throw new V2DraftError('VALIDATION_ERROR','JSON required.',400);}):null;
  const service=new DepotOperationsService(await depotRepository());
  return c.json(await service.execute(actor,c.req.param('depotId')!,action as DepotAction,body,c.req.header('Idempotency-Key'),c.req.param('id')));
 });
 if(post)carrierOperationsRouter.post(base+suffix,handler);else carrierOperationsRouter.get(base+suffix,handler);
}
carrierOperationsRouter.post('/carrier-portal/carriers/:carrierId/availability',c=>carrierPortalIdentity(c,async()=>{
 const {CarrierAvailabilityService}=await import('@/server/modules/fleet/application/availability-service');
 const {CatalogServiceV2}=await import('@/server/modules/catalog/application/catalog-service');
 const {catalogRepositoryV2}=await import('@/server/modules/catalog/infrastructure/supabase-catalog-repository');
 const {WorkflowServiceV2}=await import('@/server/modules/workflow/application/workflow-service');
 const {workflowRepositoryV2}=await import('@/server/modules/workflow/infrastructure/supabase-workflow-repository');
 const actor=await requireAuthenticatedCarrier(c.req.param('carrierId')!),body=await c.req.json().catch(()=>{throw new V2DraftError('VALIDATION_ERROR','JSON required.',400);});
 const [catalog,workflow]=await Promise.all([catalogRepositoryV2(),workflowRepositoryV2()]);
 return c.json(await new CarrierAvailabilityService(new CatalogServiceV2(catalog),new WorkflowServiceV2(workflow)).evaluate(actor,body));
}));

carrierOperationsRouter.post('/carrier-portal/carriers/:carrierId/operational-assessments',c=>carrierPortalIdentity(c,async()=>{
 const {CarrierAvailabilityService}=await import('@/server/modules/fleet/application/availability-service');
 const {CarrierOperationalAssessmentService}=await import('@/server/modules/fleet/application/operational-assessment-service');
 const {CatalogServiceV2}=await import('@/server/modules/catalog/application/catalog-service');
 const {catalogRepositoryV2}=await import('@/server/modules/catalog/infrastructure/supabase-catalog-repository');
 const {WorkflowServiceV2}=await import('@/server/modules/workflow/application/workflow-service');
 const {workflowRepositoryV2}=await import('@/server/modules/workflow/infrastructure/supabase-workflow-repository');
 const actor=await requireAuthenticatedCarrier(c.req.param('carrierId')!),body=await c.req.json().catch(()=>{throw new V2DraftError('VALIDATION_ERROR','JSON required.',400);});
 const [catalog,workflow,depot]=await Promise.all([catalogRepositoryV2(),workflowRepositoryV2(),depotRepository()]);
 return c.json(await new CarrierOperationalAssessmentService(new CarrierAvailabilityService(new CatalogServiceV2(catalog),new WorkflowServiceV2(workflow)),new DepotOperationsService(depot)).assess(actor,body));
}));

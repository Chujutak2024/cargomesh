import {z} from 'zod';
import {CarrierOperationalAssessmentInputV2Schema,CarrierOperationalAssessmentV2Schema,type CarrierOperationalAssessmentV2} from '@/shared/schemas/v2/operational-assessment';
import {DepotDecisionV2Schema} from '@/shared/schemas/v2/depot-operations';
import {TimeWindowV2Schema} from '@/shared/schemas/v2/freight-request';
import {V2DraftError} from '../../freight-requests/application/draft-service';
import type {CatalogActorV2} from '../../catalog/application/catalog-service';
import type {CarrierAvailabilityService} from './availability-service';
import type {DepotOperationsService} from '../../depot-operations/application/depot-service';
const Id=z.string().uuid();
type Actor=Extract<CatalogActorV2,{kind:'carrier'}>;
type Check=CarrierOperationalAssessmentV2['checks'][number];
const ResourceDecision=z.object({status:z.enum(['eligible','ineligible','unknown']),reasons:z.array(z.string()),scope:z.literal('RESOURCE_WINDOW_ONLY'),provenanceStatus:z.string(),resourceId:Id,serviceId:Id,resourceVersion:z.number().int().positive(),checkedAt:z.string().datetime({offset:true}),window:TimeWindowV2Schema}).strict();
const sameWindow=(a:{startsAt:string;endsAt:string},b:{startsAt:string;endsAt:string})=>Date.parse(a.startsAt)===Date.parse(b.startsAt)&&Date.parse(a.endsAt)===Date.parse(b.endsAt);
export class CarrierOperationalAssessmentService {
 constructor(private readonly fleet:Pick<CarrierAvailabilityService,'evaluateMany'>,private readonly depots:Pick<DepotOperationsService,'execute'>,private readonly clock:()=>string=()=>new Date().toISOString()){}
 async assess(actor:Actor,raw:unknown){
  Id.parse(actor.operatorId);Id.parse(actor.carrierId);
  const input=CarrierOperationalAssessmentInputV2Schema.parse(raw),startedAt=this.clock(),checks:Check[]=[];
  if(input.resources.length){
   const result=await this.fleet.evaluateMany(actor,input.resources.map(r=>({...r,serviceId:input.serviceId})));
   if(result.data.length!==input.resources.length)throw new V2DraftError('INVALID_ASSESSMENT_RESPONSE','Incomplete resource response.',502);
   for(const [index,rawDecision] of result.data.entries()){
    const query=input.resources[index],parsed=ResourceDecision.safeParse(rawDecision);if(!parsed.success)throw new V2DraftError('INVALID_ASSESSMENT_RESPONSE','Invalid resource contract.',502);const r=parsed.data;
    if(r.resourceId!==query.resourceId||r.serviceId!==input.serviceId||!sameWindow(r.window,query.window))throw new V2DraftError('INVALID_ASSESSMENT_RESPONSE','Resource response scope mismatch.',502);
    const provenance=['VERIFIED','ESTIMATED','SIMULATED','UNKNOWN'].includes(r.provenanceStatus)?r.provenanceStatus as Check['provenanceStatus']:'UNKNOWN';
    checks.push({kind:query.kind,referenceId:r.resourceId,resourceCode:null,window:query.window,status:r.status==='eligible'&&!['VERIFIED','SIMULATED'].includes(provenance)?'unknown':r.status,reasons:r.status==='eligible'&&!['VERIFIED','SIMULATED'].includes(provenance)?[...r.reasons,'AVAILABILITY_EVIDENCE_UNKNOWN']:r.reasons,provenanceStatus:provenance,resourceVersion:r.resourceVersion,policyVersion:null});
   }
  }
  for(const query of input.depots){
   const {depotId,...slot}=query;let r:z.infer<typeof DepotDecisionV2Schema>;
   try{const response=await this.depots.execute(actor,depotId,'availability',{schemaVersion:'2.0',serviceId:input.serviceId,...slot});const parsed=DepotDecisionV2Schema.safeParse(response.data);if(!parsed.success)throw new V2DraftError('INVALID_ASSESSMENT_RESPONSE','Invalid depot contract.',502);r=parsed.data;}
   catch(error){if(!(error instanceof V2DraftError)||error.code!=='DEPOT_OPERATIONS_NOT_INSTALLED')throw error;r={status:'unknown',reasons:['DEPOT_OPERATIONS_NOT_INSTALLED'],provenanceStatus:'UNKNOWN',policyVersion:null};}
   const evidenceMissing=r.status==='eligible'&&(r.policyVersion===null||!['VERIFIED','SIMULATED'].includes(r.provenanceStatus));
   checks.push({kind:'depot',referenceId:depotId,resourceCode:query.resourceCode,window:query.window,status:evidenceMissing?'unknown':r.status,reasons:evidenceMissing?[...r.reasons,'DEPOT_EVIDENCE_UNKNOWN']:r.reasons,provenanceStatus:r.provenanceStatus,resourceVersion:null,policyVersion:r.policyVersion});
  }
  const status=checks.some(c=>c.status==='ineligible')?'ineligible':checks.some(c=>c.status==='unknown')?'unknown':'eligible';
  return {schemaVersion:'2.0' as const,data:CarrierOperationalAssessmentV2Schema.parse({schemaVersion:'2.0',carrierId:actor.carrierId,serviceId:input.serviceId,scope:'EXPLICIT_OPERATIONAL_REQUIREMENTS_ONLY',status,checks,startedAt,completedAt:this.clock(),consistency:'NON_ATOMIC_READ',coverageEvaluated:false,cargoCompatibilityEvaluated:false,planEligibilityEvaluated:false,capacityReserved:false,requiresCommitRevalidation:true})};
 }
}

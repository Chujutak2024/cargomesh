import {z} from 'zod';
import {DepotPolicyV2Schema,DepotAppointmentV2Schema,DepotSlotV2Schema,DepotDecisionV2Schema,parseDepotRecord} from '@/shared/schemas/v2/depot-operations';
import {V2DraftError} from '../../freight-requests/application/draft-service';
export type DepotAction='policy.read'|'policy.save'|'appointments.list'|'appointment.save'|'availability';
export type DepotActor={operatorId:string;carrierId:string};
export type DepotCommand={id:string|null;expectedVersion:number|null;key:string|null;value:unknown};
export interface DepotRepository {run(actor:DepotActor,depotId:string,action:DepotAction,input:DepotCommand):Promise<unknown>}
const Id=z.string().uuid();
export class DepotOperationsService {
 constructor(private readonly repository:DepotRepository){}
 async execute(actor:DepotActor,depotId:string,action:DepotAction,body:unknown,key?:string,id?:string){
  Id.parse(actor.operatorId);Id.parse(actor.carrierId);Id.parse(depotId);
  let input:DepotCommand={id:null,expectedVersion:null,key:null,value:null};
  if(action==='availability')input.value=DepotSlotV2Schema.parse(body);
  if(action==='policy.save'||action==='appointment.save'){
   const revision=z.object({expectedVersion:z.number().int().nonnegative(),value:z.unknown()}).strict().parse(body);
   input={id:id?Id.parse(id):null,expectedVersion:revision.expectedVersion,key:Id.parse(key),value:(action==='policy.save'?DepotPolicyV2Schema:DepotAppointmentV2Schema).parse(revision.value)};
   if(action==='policy.save'&&id||action==='appointment.save'&&!!id!==(revision.expectedVersion>0))throw new V2DraftError('VALIDATION_ERROR','Record/version mismatch.',400);
  }
  const raw=z.object({data:z.unknown(),replay:z.boolean().optional()}).strict().parse(await this.repository.run(actor,depotId,action,input));
  const record=(value:unknown,kind:'policy'|'appointment')=>{const r=parseDepotRecord(kind,value);if(r.carrierId!==actor.carrierId||r.depotId!==depotId||kind==='policy'&&r.id!==depotId)throw new V2DraftError('FORBIDDEN_DEPOT_SCOPE','Depot scope mismatch.',403);return r;};
  const data=action==='availability'?DepotDecisionV2Schema.parse(raw.data):action==='appointments.list'?z.array(z.unknown()).max(1001).parse(raw.data).slice(0,1000).map(r=>record(r,'appointment')):action==='policy.read'&&raw.data===null?null:record(raw.data,action.startsWith('policy')?'policy':'appointment');
  return {schemaVersion:'2.0' as const,data,meta:{idempotentReplay:raw.replay??false,partial:action==='appointments.list'&&Array.isArray(raw.data)&&raw.data.length>1000}};
 }
}

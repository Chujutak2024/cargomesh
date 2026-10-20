import {z} from 'zod';
import {FacilityVisualInputSchema,FacilityVisualResponseSchema} from '@/shared/schemas/v2/facility-visual';
import {V2DraftError,type V2Actor} from '../../freight-requests/application/draft-service';
type VisualActor=V2Actor & {role:string};
export interface FacilityVisualRepository {
 command(actor:V2Actor,facilityId:string,input:{templateId:string|null;expectedVersion:number;key:string}|null):Promise<unknown>;
}
export class FacilityVisualService {
 constructor(private readonly repository:FacilityVisualRepository){}
 async get(actor:VisualActor,id:unknown){return this.run(actor,z.string().uuid().parse(id),null);}
 async save(actor:VisualActor,id:unknown,raw:unknown,key:unknown){
  if(!['OWNER','SUPERVISOR'].includes(actor.role))throw new V2DraftError('FORBIDDEN_TENANT','Your role cannot change the facility reference.',403);
  const input=FacilityVisualInputSchema.parse(raw);
  return this.run(actor,z.string().uuid().parse(id),{...input,key:z.string().uuid().parse(key)});
 }
 private async run(actor:V2Actor,id:string,input:Parameters<FacilityVisualRepository['command']>[2]){
  const result=FacilityVisualResponseSchema.parse(await this.repository.command(actor,id,input));
  if(result.data.organizationId!==actor.organizationId||result.data.facilityId!==id)
   throw new V2DraftError('FORBIDDEN_TENANT','Facility reference scope mismatch.',403);
  return result;
 }
}

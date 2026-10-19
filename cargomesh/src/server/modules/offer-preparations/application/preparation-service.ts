import {createHash} from 'node:crypto';
import {z} from 'zod';
import {OfferPreparationRecordV2Schema,SaveOfferPreparationV2Schema,type OfferPreparationRecord,type OfferPreparationValue} from '@/shared/schemas/v2/offer-preparation';
import {V2DraftError} from '../../freight-requests/application/draft-service';
import type {WorkflowActorV2} from '../../workflow/application/workflow-service';
import type {Opportunity,Offer} from '@/features/carrier-portal/commercial-model';
export type PreparationActor=Extract<WorkflowActorV2,{kind:'carrier'}>&{userId:string};
export interface PreparationRepository{
 list(actor:PreparationActor,page:{limit:number;offset:number}):Promise<unknown[]>;
 save(actor:PreparationActor,input:{key:string;payloadHash:string;expectedVersion:number;value:OfferPreparationValue}):Promise<{record:unknown;replay:boolean}>;
}
function canonical(value:unknown):string{return Array.isArray(value)?'['+value.map(canonical).join(',')+']':value!==null&&typeof value==='object'?'{'+Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>JSON.stringify(k)+':'+canonical(v)).join(',')+'}':JSON.stringify(value);}
export const preparationHash=(value:unknown)=>createHash('sha256').update(canonical(value)).digest('hex');
export class PreparationService{
 constructor(private readonly repository:PreparationRepository,private readonly references:(actor:PreparationActor,value:OfferPreparationValue)=>Promise<{opportunity:Opportunity;supersedes:Offer|null}> ){}
 private record(actor:PreparationActor,raw:unknown):OfferPreparationRecord{
  const r=OfferPreparationRecordV2Schema.parse(raw);if(r.carrierId!==actor.carrierId||r.operatorId!==actor.operatorId||r.userId!==actor.userId)throw new V2DraftError('FORBIDDEN_PREPARATION_SCOPE','Preparation belongs to another identity.',403);return r;
 }
 async list(actor:PreparationActor,raw:{limit?:string;offset?:string}){
  const page=z.object({limit:z.coerce.number().int().min(1).max(100).default(100),offset:z.coerce.number().int().nonnegative().default(0)}).parse(raw);
  const rows=await this.repository.list(actor,page);if(rows.length>page.limit)throw new V2DraftError('INVALID_RESPONSE','Invalid preparation page.',502);
  return {schemaVersion:'2.0' as const,data:rows.map(r=>this.record(actor,r)),meta:{nextOffset:rows.length===page.limit?page.offset+page.limit:null}};
 }
 async save(actor:PreparationActor,raw:unknown,key:unknown){
  z.object({carrierId:z.string().uuid(),operatorId:z.string().uuid(),userId:z.string().uuid()}).parse(actor);
  const input=SaveOfferPreparationV2Schema.parse(raw),idempotencyKey=z.string().uuid().parse(key);
  const {opportunity:o,supersedes:f}=await this.references(actor,input.value);
  if(o.carrierId!==actor.carrierId||o.id!==input.value.opportunityId||input.value.assignmentIds.some(id=>!o.data.assignmentIds.includes(id))
    ||input.value.supersedesOfferId!==null&&(!f||f.id!==input.value.supersedesOfferId||f.carrierId!==o.carrierId||f.requestId!==o.requestId||f.organizationId!==o.organizationId||f.data.opportunityId!==o.id||f.data.planCandidateId!==o.data.planId))throw new V2DraftError('INVALID_PREPARATION_REFERENCES','Preparation references are outside the opportunity.',400);
  // State/deadline are checked only when issuing. An incomplete preparation never creates an offer.
  const result=await this.repository.save(actor,{key:idempotencyKey,payloadHash:preparationHash(input),...input}),record=this.record(actor,result.record);
  if(record.requestId!==o.requestId||record.organizationId!==o.organizationId||record.value.opportunityId!==o.id||record.value.supersedesOfferId!==input.value.supersedesOfferId)throw new V2DraftError('INVALID_PREPARATION_RESPONSE','Preparation scope mismatch.',502);
  return {schemaVersion:'2.0' as const,data:record,meta:{idempotentReplay:result.replay}};
 }
}

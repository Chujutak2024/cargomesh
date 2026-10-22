import {z} from 'zod';
import {CreateIncidentRecoverySchema,IncidentRecoverySchema,IncidentRecoveryContextSchema} from '@/shared/schemas/v2/incident-recovery';
import type {V2Actor} from '../../freight-requests/application/draft-service';
import {quoteRpc} from '../infrastructure/supabase-quotes';
import {searchRequestQuotes,quoteChildKey} from './quote-search';
/** Web and future conversational adapters use the same native transaction. */
export async function createIncidentRecovery(actor:V2Actor,incidentId:string,raw:unknown,key:string|undefined){
 const input=CreateIncidentRecoverySchema.parse(raw);
 const recovery=IncidentRecoverySchema.parse(await quoteRpc('create_v2_incident_recovery',{
  p_organization_id:actor.organizationId,p_member_id:actor.memberId,p_incident_id:z.string().uuid().parse(incidentId),
  p_key:z.string().uuid().parse(key),p_value:input,
 }));
 // Creation is already durable and idempotent. A missing tariff or remote failure must not
 // create another case; the linked native quote screen can retry discovery with fresh consent.
 let quoteSearchNotice:string|null=null;
 if(recovery.status==='SEARCHING'){
  const responseDeadline=new Date(Math.min(Date.parse(recovery.createdAt)+60*60*1000,Date.parse(input.pickupWindow.startsAt)-1000)).toISOString();
  try{await searchRequestQuotes(actor,recovery.replacementRequestId,{schemaVersion:'2.0',expectedDraftVersion:2,responseDeadline,consent:'REQUEST_QUOTES'},quoteChildKey(recovery.id,'recovery-search'));}
  catch{quoteSearchNotice='RECOVERY_SEARCH_REQUIRES_REVIEW';}
 }
 const current=(await readIncidentRecoveries(actor,recovery.originalRequestId)).cases.find(c=>c.id===recovery.id)??recovery;
 return {recovery:current,quoteSearchNotice};
}
export async function readIncidentRecoveries(actor:V2Actor,requestId:string){
 return IncidentRecoveryContextSchema.parse(await quoteRpc('read_v2_incident_recovery',{
  p_organization_id:actor.organizationId,p_member_id:actor.memberId,p_request_id:z.string().uuid().parse(requestId),
 }));
}

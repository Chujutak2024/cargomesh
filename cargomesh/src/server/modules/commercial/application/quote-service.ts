import {z} from 'zod';
import {quoteRpc} from '../infrastructure/supabase-quotes';
import type {V2Actor} from '../../freight-requests/application/draft-service';
import {SaveQuotePolicySchema,QuotePolicyRecordSchema,QuoteHistorySchema,QuoteConfirmationSchema,QuoteConfirmationInputSchema} from '@/shared/schemas/v2/quote-automation';
type CarrierActor={carrierId:string;operatorId:string};
export async function readQuotePolicies(actor:CarrierActor){
 return z.array(QuotePolicyRecordSchema).parse(await quoteRpc('configure_v2_quote_policy',{p_carrier_id:actor.carrierId,p_operator_id:actor.operatorId,p_key:null,p_expected_version:null,p_value:null}));
}
export async function saveQuotePolicy(actor:CarrierActor,raw:unknown,key:string|undefined){
 const input=SaveQuotePolicySchema.parse(raw);
 return QuotePolicyRecordSchema.parse(await quoteRpc('configure_v2_quote_policy',{p_carrier_id:actor.carrierId,p_operator_id:actor.operatorId,p_key:z.string().uuid().parse(key),p_expected_version:input.expectedVersion,p_value:input.value}));
}
export async function readQuoteHistory(actor:V2Actor,id:string){
 return QuoteHistorySchema.parse(await quoteRpc('read_v2_quote_history',{p_organization_id:actor.organizationId,p_member_id:actor.memberId,p_request_id:z.string().uuid().parse(id)}));
}
export async function quoteConfirmation(actor:V2Actor|CarrierActor,id:string,raw:unknown,key:string|undefined){
 const input=raw===null?null:QuoteConfirmationInputSchema.parse(raw);
 const scope='carrierId' in actor?{p_carrier_id:actor.carrierId,p_operator_id:actor.operatorId,p_organization_id:null,p_member_id:null}:{p_carrier_id:null,p_operator_id:null,p_organization_id:actor.organizationId,p_member_id:actor.memberId};
 return QuoteConfirmationSchema.nullable().parse(await quoteRpc('command_v2_quote_confirmation',{...scope,p_booking_id:z.string().uuid().parse(id),p_action:input?.action??'READ',p_key:input?z.string().uuid().parse(key):null,p_expected_version:input?.expectedVersion??null,p_deadline:input?.deadline??null,p_reason:input?.reason??null}));
}

import {createV2ServerSupabaseClient} from '@/server/db/supabase/v2';
import {V2DraftError} from '../../freight-requests/application/draft-service';
import type {PreparationRepository} from '../application/preparation-service';
type RpcArgs={p_carrier_id:string;p_operator_id:string;p_action:string;p_limit:number;p_offset:number;p_key:string|null;p_hash:string|null;p_expected_version:number|null;p_value:unknown};
export async function preparationRepository():Promise<PreparationRepository>{
 const db=await createV2ServerSupabaseClient();
 const rpc=db.rpc.bind(db) as unknown as (name:'offer_preparations_v2',args:RpcArgs)=>PromiseLike<{data:unknown;error:{code?:string;message:string}|null}>;
 async function call(args:RpcArgs){const {data,error}=await rpc('offer_preparations_v2',args);
  if(error){if(['PGRST202','42883'].includes(error.code??''))throw new V2DraftError('OFFER_PREPARATIONS_NOT_INSTALLED','Persistent commercial preparations are not installed in this environment.',503);
   const status:Record<string,number>={PT400:400,PT403:403,PT404:404,PT409:409};
   if(status[error.code??''])throw new V2DraftError(/^[A-Z][A-Z0-9_]+$/.test(error.message)?error.message:'PREPARATION_ERROR','Preparation could not be saved.',status[error.code??'']);
   throw new Error('PREPARATION_DATABASE_ERROR');}return data;
 }
 const base=(actor:{carrierId:string;operatorId:string}):RpcArgs=>({p_carrier_id:actor.carrierId,p_operator_id:actor.operatorId,p_action:'list',p_limit:100,p_offset:0,p_key:null,p_hash:null,p_expected_version:null,p_value:null});
 return {async list(actor,page){const value=await call({...base(actor),p_limit:page.limit,p_offset:page.offset});if(!Array.isArray(value))throw new Error('INVALID_PREPARATION_RESPONSE');return value;},
  async save(actor,input){const value=await call({...base(actor),p_action:'save',p_key:input.key,p_hash:input.payloadHash,p_expected_version:input.expectedVersion,p_value:input.value});
   if(!value||typeof value!=='object'||!('record' in value)||!('replay' in value)||typeof value.replay!=='boolean')throw new Error('INVALID_PREPARATION_RESPONSE');return {record:value.record,replay:value.replay};}};
}

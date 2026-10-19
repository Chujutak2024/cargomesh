import {createV2ServerSupabaseClient} from '@/server/db/supabase/v2';
import {V2DraftError} from '../../freight-requests/application/draft-service';
import type {DepotRepository} from '../application/depot-service';
type RpcArgs={p_operator_id:string;p_carrier_id:string;p_depot_id:string;p_action:string;p_id:string|null;p_expected_version:number|null;p_idempotency_key:string|null;p_value:unknown};
export async function depotRepository():Promise<DepotRepository>{
 const db=await createV2ServerSupabaseClient();
 // Narrow new RPC boundary until the generated DB snapshot is refreshed; every response is schema-checked by the service.
 const rpc=db.rpc.bind(db) as unknown as (name:'depot_operations_v2',args:RpcArgs)=>PromiseLike<{data:unknown;error:{code?:string;message:string}|null}>;
 return {async run(actor,depotId,action,input){
  const {data,error}=await rpc('depot_operations_v2',{p_operator_id:actor.operatorId,p_carrier_id:actor.carrierId,p_depot_id:depotId,p_action:action,p_id:input.id,p_expected_version:input.expectedVersion,p_idempotency_key:input.key,p_value:input.value});
  if(error){
   if(['PGRST202','42883'].includes(error.code??''))throw new V2DraftError('DEPOT_OPERATIONS_NOT_INSTALLED','Depot operations migration is not installed in this environment.',503);
   const status:Record<string,number>={PT400:400,PT403:403,PT404:404,PT409:409,'23503':400,'23514':400,'22P02':400};
   if(status[error.code??''])throw new V2DraftError(error.code?.startsWith('PT')&&/^[A-Z_]+$/.test(error.message)?error.message:'DEPOT_VALIDATION_ERROR','Depot operation could not be applied.',status[error.code??'']);
   throw new Error('DEPOT_DATABASE_ERROR');
  }return data;
 }};
}

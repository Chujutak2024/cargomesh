import {createV2ServerSupabaseClient} from '@/server/db/supabase/v2';
import {V2DraftError} from '../../freight-requests/application/draft-service';
import type {RegularDriverRepository} from '../application/regular-driver-service';
export async function regularDriverRepository():Promise<RegularDriverRepository>{
 const db=await createV2ServerSupabaseClient();
 const rpc=db.rpc.bind(db) as unknown as (name:'regular_vehicle_driver_v2',args:Record<string,unknown>)=>PromiseLike<{data:unknown;error:{code?:string;message:string}|null}>;
 return {async run(actor,assetId,value,key,offset){
  const {data,error}=await rpc('regular_vehicle_driver_v2',{p_operator_id:actor.operatorId,p_carrier_id:actor.carrierId,p_asset_id:assetId,p_value:value,p_key:key,p_offset:offset});
  if(error){
   if(['PGRST202','42883'].includes(error.code??''))throw new V2DraftError('REGULAR_DRIVERS_NOT_INSTALLED','Regular driver migration is not installed.',503);
   const statuses:Record<string,number>={PT400:400,PT403:403,PT404:404,PT409:409,'23503':400,'23514':400,'22P02':400};
   if(statuses[error.code??''])throw new V2DraftError(error.code?.startsWith('PT')&&/^[A-Z_]+$/.test(error.message)?error.message:'INVALID_DRIVER_REFERENCE','Regular driver change could not be applied.',statuses[error.code??'']);
   throw new Error('REGULAR_DRIVER_DATABASE_ERROR');
  }return data;
 }};
}

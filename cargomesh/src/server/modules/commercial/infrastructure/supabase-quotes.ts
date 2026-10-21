import {createV2ServerSupabaseClient} from '@/server/db/supabase/v2';
import {V2DraftError} from '../../freight-requests/application/draft-service';
import type {Json} from '@/types/database-v2.types';
export async function quoteRpc(name:string,args:Record<string,unknown>){
 const db=await createV2ServerSupabaseClient();
 const result=await (db.rpc as unknown as (name:string,args:Record<string,Json|undefined>)=>Promise<{data:unknown;error:{code:string;message:string}|null}>)(name,args as Record<string,Json>);
 if(result.error){const status=({PT400:400,PT403:403,PT404:404,PT409:409,'22P02':400,'23514':400,'23505':409} as Record<string,number>)[result.error.code];
  if(!status)throw new V2DraftError('QUOTE_BACKEND_UNAVAILABLE','Quote configuration is unavailable.',503);
  throw new V2DraftError(/^[A-Z][A-Z0-9_]{0,80}$/.test(result.error.message)?result.error.message:'QUOTE_VALIDATION_ERROR','Quote operation could not be completed.',status);
 }return result.data;
}

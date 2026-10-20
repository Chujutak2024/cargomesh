import 'server-only';
import {createV2ServerSupabaseClient} from '@/server/db/supabase/v2';
import {V2DraftError} from '../../freight-requests/application/draft-service';
import type {FacilityVisualRepository} from '../application/facility-visual-service';
export async function facilityVisualRepository():Promise<FacilityVisualRepository>{
 const db=await createV2ServerSupabaseClient();
 return {async command(actor,id,input){
  const {data,error}=await db.rpc('facility_visual_reference_v2' as never,{p_organization_id:actor.organizationId,p_member_id:actor.memberId,
   p_facility_id:id,p_template_id:input?.templateId??null,p_expected_version:input?.expectedVersion??null,p_key:input?.key??null} as never);
  if(error){
   const status=error.code==='PT403'?403:error.code==='PT404'?404:error.code==='PT409'?409:error.code==='PT400'?400:503;
   const code=status===503?'FACILITY_VISUAL_UNAVAILABLE':error.message;
   throw new V2DraftError(code,status===503?'The facility reference is unavailable.':code,status);
  }
  return data;
 }};
}

import {cookies} from 'next/headers';
import {assignedDemoConfig} from '@/server/auth/assigned-demo';
import {createAssignedDemoHandler,syntheticCarrierAccess,syntheticClientAccess} from '@/server/auth/assigned-demo-policy';
import {CLIENT_PREVIEW_COOKIE,CLIENT_PREVIEW_TTL,signClientPreview} from '@/server/auth/local-client-preview-policy';
import {createV2ServerSupabaseClient} from '@/server/db/supabase/v2';
export const dynamic='force-dynamic';
export async function POST(request:Request){
 return createAssignedDemoHandler(assignedDemoConfig(),{
  startClient:async secret=>{(await cookies()).set(CLIENT_PREVIEW_COOKIE,signClientPreview(secret),{httpOnly:true,secure:true,sameSite:'strict',path:'/',maxAge:CLIENT_PREVIEW_TTL});},
  startConnectedClient:async(email,password,organizationId)=>{
   const db=await createV2ServerSupabaseClient();
   const current=await db.auth.getUser();
   let user=current.data.user;
   if(current.error||user?.email!==email){const login=await db.auth.signInWithPassword({email,password});if(login.error||!login.data.user)return false;user=login.data.user;}
   const member=await db.from('organization_members').select('organization_id,role,status,organizations!inner(name,status)')
    .eq('auth_user_id',user!.id).eq('organization_id',organizationId).eq('status','ACTIVE').maybeSingle();
   const access=await db.rpc('read_v2_carrier_portal_access');
   if(member.error||!syntheticClientAccess(member.data,organizationId)||access.error||!syntheticCarrierAccess(access.data)){
    await db.auth.signOut({scope:'local'});return false;
   }
   (await cookies()).delete(CLIENT_PREVIEW_COOKIE);
   return true;
  },
  startCarrier:async(email,password)=>{
   const db=await createV2ServerSupabaseClient();
   const current=await db.auth.getUser();
   if(current.error||current.data.user?.email!==email){const login=await db.auth.signInWithPassword({email,password});if(login.error||!login.data.user)return false;}
   const access=await db.rpc('read_v2_carrier_portal_access');
   if(access.error||!syntheticCarrierAccess(access.data)){await db.auth.signOut({scope:'local'});return false;}
   return true;
  },
 })(request);
}

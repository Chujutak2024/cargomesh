import "server-only";
import {createV2ServerSupabaseClient} from "@/server/db/supabase/v2";
import {CarrierPortalAccessListV2Schema} from "@/shared/schemas/v2/carrier-portal";
import {V2DraftError} from "@/server/modules/freight-requests/application/draft-service";
import {resolveLoginAccess} from "./login-access";

async function readAuthorizedCarriers(db:Awaited<ReturnType<typeof createV2ServerSupabaseClient>>){
 const result=await db.rpc("read_v2_carrier_portal_access");
 if(result.error)throw new V2DraftError("CARRIER_PORTAL_UNAVAILABLE","Carrier access could not be checked.",503);
 return CarrierPortalAccessListV2Schema.parse(result.data);
}

export async function readCarrierPortalAccess(){
 const db=await createV2ServerSupabaseClient();
 const {data:{user},error}=await db.auth.getUser();
 if(error||!user)throw new V2DraftError("UNAUTHORIZED","Authentication required.",401);
 return readAuthorizedCarriers(db);
}
export async function authenticatedLoginDestination(preferred?:unknown){
 const db=await createV2ServerSupabaseClient();
 const {data:{user},error}=await db.auth.getUser();if(error||!user)return null;
 return resolveLoginAccess(preferred,{
  member:async()=>{
   const {data:member,error:memberError}=await db.from("organization_members").select("id,organizations!inner(status)")
    .eq("auth_user_id",user.id).eq("status","ACTIVE").eq("organizations.status","ACTIVE").limit(1).maybeSingle();
   if(memberError)throw new Error("LOGIN_IDENTITY_UNAVAILABLE");
   return !!member;
  },
  carriers:()=>readAuthorizedCarriers(db),
 });
}

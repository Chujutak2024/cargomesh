import "server-only";
import {createV2ServerSupabaseClient} from "@/server/db/supabase/v2";
import {CarrierPortalAccessListV2Schema,loginDestination,safeLoginReturnTo} from "@/shared/schemas/v2/carrier-portal";
import {V2DraftError} from "@/server/modules/freight-requests/application/draft-service";
export async function readCarrierPortalAccess(){
 const db=await createV2ServerSupabaseClient();
 const {data:{user},error}=await db.auth.getUser();
 if(error||!user)throw new V2DraftError("UNAUTHORIZED","Authentication required.",401);
 const result=await db.rpc("read_v2_carrier_portal_access");
 if(result.error)throw new V2DraftError("CARRIER_PORTAL_UNAVAILABLE","Carrier access could not be checked.",503);
 return CarrierPortalAccessListV2Schema.parse(result.data);
}
export async function authenticatedLoginDestination(preferred?:unknown){
 const db=await createV2ServerSupabaseClient();
 const {data:{user},error}=await db.auth.getUser();if(error||!user)return null;
 const {data:member,error:memberError}=await db.from("organization_members").select("id,organizations!inner(status)")
  .eq("auth_user_id",user.id).eq("status","ACTIVE").eq("organizations.status","ACTIVE").limit(1).maybeSingle();
 if(memberError)throw new Error("LOGIN_IDENTITY_UNAVAILABLE");
 const carriers=member&&safeLoginReturnTo(preferred)!=="/carrier-portal"?[]:await readCarrierPortalAccess();
 return loginDestination(preferred,!!member,carriers);
}

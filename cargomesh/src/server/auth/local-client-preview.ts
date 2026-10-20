import 'server-only';
import {cookies,headers} from 'next/headers';
import {assignedDemoEnabled,assignedDemoConfig} from './assigned-demo';
import {assignedDemoAllowed,assignedCarrierPreviewAllowed} from './assigned-demo-policy';
import {createV2ServerSupabaseClient} from '@/server/db/supabase/v2';
import {CLIENT_PREVIEW_COOKIE,localClientPreviewAllowed,validClientPreview} from './local-client-preview-policy';
import {requireAuthenticatedMember} from './member';
import {useClientPreview} from './client-preview-selection';
export function clientPreviewConfig(){return {enabled:process.env.CARGOMESH_LOCAL_CLIENT_PREVIEW_ENABLED==='true'&&process.env.CM_ENABLE_DEMO==='1',production:process.env.NODE_ENV==='production',secret:assignedDemoConfig().enabled?assignedDemoConfig().secret:process.env.CARGOMESH_LOCAL_CLIENT_PREVIEW_SECRET};}
export async function localClientPreviewEnabled(){const host=(await headers()).get('host');return localClientPreviewAllowed(clientPreviewConfig(),host)||assignedDemoAllowed(assignedDemoConfig(),host);}
export async function hasLocalClientPreviewSession(){
 return useClientPreview(requireAuthenticatedMember,async()=>{
 // Hosted demo assigns only the read-only visual profile; it grants no Supabase membership.
 if(await assignedDemoEnabled())return true;
 if(!await localClientPreviewEnabled())return false;
 return validClientPreview((await cookies()).get(CLIENT_PREVIEW_COOKIE)?.value,clientPreviewConfig().secret!);
 },async()=>{
 const config=assignedDemoConfig(),host=(await headers()).get('host');
 if(!assignedDemoAllowed(config,host))return false;
 const db=await createV2ServerSupabaseClient();
 const user=await db.auth.getUser();
 if(user.error||user.data.user?.email!==config.carrierEmail)return false;
 const access=await db.rpc('read_v2_carrier_portal_access');
 return !access.error&&assignedCarrierPreviewAllowed(config,host,user.data.user?.email,access.data);
 });
}

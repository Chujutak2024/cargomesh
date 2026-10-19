import 'server-only';
import {cookies,headers} from 'next/headers';
import {assignedDemoEnabled,assignedDemoConfig} from './assigned-demo';
import {assignedDemoAllowed} from './assigned-demo-policy';
import {CLIENT_PREVIEW_COOKIE,localClientPreviewAllowed,validClientPreview} from './local-client-preview-policy';
export function clientPreviewConfig(){return {enabled:process.env.CARGOMESH_LOCAL_CLIENT_PREVIEW_ENABLED==='true'&&process.env.CM_ENABLE_DEMO==='1',production:process.env.NODE_ENV==='production',secret:assignedDemoConfig().enabled?assignedDemoConfig().secret:process.env.CARGOMESH_LOCAL_CLIENT_PREVIEW_SECRET};}
export async function localClientPreviewEnabled(){const host=(await headers()).get('host');return localClientPreviewAllowed(clientPreviewConfig(),host)||assignedDemoAllowed(assignedDemoConfig(),host);}
export async function hasLocalClientPreviewSession(){
 // Hosted demo assigns only the read-only visual profile; it grants no Supabase membership.
 if(await assignedDemoEnabled())return true;
 if(!await localClientPreviewEnabled())return false;
 return validClientPreview((await cookies()).get(CLIENT_PREVIEW_COOKIE)?.value,clientPreviewConfig().secret!);
}

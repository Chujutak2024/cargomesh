import 'server-only';
import {cookies,headers} from 'next/headers';
import {CLIENT_PREVIEW_COOKIE,localClientPreviewAllowed,validClientPreview} from './local-client-preview-policy';
export function clientPreviewConfig(){return {enabled:process.env.CARGOMESH_LOCAL_CLIENT_PREVIEW_ENABLED==='true'&&process.env.CM_ENABLE_DEMO==='1',production:process.env.NODE_ENV==='production',secret:process.env.CARGOMESH_LOCAL_CLIENT_PREVIEW_SECRET};}
export async function localClientPreviewEnabled(){return localClientPreviewAllowed(clientPreviewConfig(),(await headers()).get('host'));}
export async function hasLocalClientPreviewSession(){
 if(!await localClientPreviewEnabled())return false;
 return validClientPreview((await cookies()).get(CLIENT_PREVIEW_COOKIE)?.value,clientPreviewConfig().secret!);
}

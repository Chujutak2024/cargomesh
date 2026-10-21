import {cookies} from 'next/headers';
import {createWorkspaceDemoHandler} from '@/server/auth/workspace-demo-policy';
import {workspaceDemoConfig,startWorkspaceDemoSession} from '@/server/auth/workspace-demo';
import {CLIENT_PREVIEW_COOKIE,CLIENT_PREVIEW_TTL,signClientPreview} from '@/server/auth/local-client-preview-policy';
export const dynamic='force-dynamic';
export async function POST(request:Request){
 return createWorkspaceDemoHandler(workspaceDemoConfig(),{
  start:startWorkspaceDemoSession,
  preview:async secret=>{(await cookies()).set(CLIENT_PREVIEW_COOKIE,signClientPreview(secret),{httpOnly:true,secure:true,sameSite:'strict',path:'/',maxAge:CLIENT_PREVIEW_TTL});},
 })(request);
}

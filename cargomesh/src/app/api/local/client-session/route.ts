import {assignedDemoConfig} from '@/server/auth/assigned-demo';
import {assignedDemoAllowed} from '@/server/auth/assigned-demo-policy';
import {cookies} from 'next/headers';
import {hasSessionOrigin} from '@/server/auth/session-origin';
import {clientPreviewConfig,localClientFrontendPreviewEnabled} from '@/server/auth/local-client-preview';
import {CLIENT_PREVIEW_COOKIE,CLIENT_PREVIEW_TTL,localClientPreviewAllowed,signClientPreview} from '@/server/auth/local-client-preview-policy';
export const dynamic='force-dynamic';
export async function POST(request:Request){
 const config=clientPreviewConfig(),noStore={'Cache-Control':'no-store, private'};
 const hosted=assignedDemoAllowed(assignedDemoConfig(),request.headers.get('host'))&&request.headers.get('origin')===assignedDemoConfig().origin&&new URL(request.url).protocol==='https:';
 if(!hosted&&(!localClientPreviewAllowed(config,request.headers.get('host'))||new URL(request.url).protocol!=='http:'))return Response.json({ok:false},{status:404,headers:noStore});
 if(!hasSessionOrigin(request))return Response.json({ok:false},{status:403,headers:noStore});
 const input=await request.formData().catch(()=>null);const exit=input?.get('action')==='exit';
 const jar=await cookies();
 jar.set(CLIENT_PREVIEW_COOKIE,exit?'':signClientPreview(config.secret!),{httpOnly:true,sameSite:'strict',secure:hosted,path:'/',maxAge:exit?0:CLIENT_PREVIEW_TTL});
 const exitLocation=hosted?'/':'/login?returnTo=%2Fclients'+(await localClientFrontendPreviewEnabled()?'':'&connected=1');
 return new Response(null,{status:303,headers:{...noStore,Location:exit?exitLocation:'/clients'}});
}

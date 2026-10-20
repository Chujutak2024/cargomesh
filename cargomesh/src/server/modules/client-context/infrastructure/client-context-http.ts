import {ZodError} from 'zod';
import {hasSessionOrigin} from '@/server/auth/session-origin';
import {V2DraftError} from '../../freight-requests/application/draft-service';
import {clientContextForCurrentMember} from './client-context-server';
export async function clientContextHttp(request:Request,mode:'read'|'prepare'|'confirm'){
 const headers={'Cache-Control':'no-store, private','Vary':'Cookie'};
 try{
  if(mode!=='read'&&!hasSessionOrigin(request))throw new V2DraftError('FORBIDDEN_ORIGIN','Same-origin confirmation is required.',403);
  const service=await clientContextForCurrentMember();
  const body=mode==='read'?Object.fromEntries(new URL(request.url).searchParams):await request.json().catch(()=>{throw new V2DraftError('VALIDATION_ERROR','JSON body required.',400);});
  const data=mode==='read'?await service.read(body):mode==='prepare'?await service.prepare(body):await service.confirm(body);
  return Response.json(data,{headers});
 }catch(error){
  let code='CLIENT_CONTEXT_UNAVAILABLE',message='Client context is unavailable.',status=503;
  if(error instanceof V2DraftError){code=error.code;message=error.message;status=error.httpStatus;}
  else if(error instanceof ZodError){code='VALIDATION_ERROR';message=error.issues.map(v=>v.path.join('.')+': '+v.message).join('; ');status=400;}
  else if(error instanceof Error&&error.message.startsWith('UNAUTHENTICATED:')){code='UNAUTHORIZED';message='Authentication required.';status=401;}
  else if(error instanceof Error&&error.message.startsWith('FORBIDDEN:')){code='FORBIDDEN_TENANT';message='Active Client membership required.';status=403;}
  return Response.json({schemaVersion:'2.0',error:{code,message,retryable:status>=500}},{status,headers});
 }
}

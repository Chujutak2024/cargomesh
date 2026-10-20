import 'server-only';
import fs from 'node:fs/promises';
import {hasSessionOrigin} from '@/server/auth/session-origin';
import {createV2ServerSupabaseClient} from '@/server/db/supabase/v2';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff'};
function allowed(request:Request){
  return process.env.NODE_ENV!=='production'&&process.env.CARGOMESH_LOCAL_PROFILE==='hac52-client'
    &&process.env.NEXT_PUBLIC_SUPABASE_URL==='http://127.0.0.1:64621'
    &&request.headers.get('host')==='127.0.0.1:59580';
}
export async function GET(request:Request){
  if(!allowed(request))return new Response(null,{status:404,headers});
  return new Response('<!doctype html><html lang="en"><meta charset="utf-8"><title>Local Client access</title><main><h1>HAC-52 connected Client</h1><p>Synthetic local account. Data persists in the dedicated HAC-52 bank.</p><form method="post"><button>Open connected Client workspace</button></form></main></html>',{headers:{...headers,'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'none'; form-action 'self'; frame-ancestors 'none'"}});
}
export async function POST(request:Request){
  if(!allowed(request))return new Response(null,{status:404,headers});
  if(!hasSessionOrigin(request))return new Response(null,{status:403,headers});
  try{
    const config=JSON.parse(await fs.readFile(process.env.CARGOMESH_HAC52_ACCESS_FILE!,'utf8'));
    if(config.profile!=='hac52-client'||config.url!==process.env.NEXT_PUBLIC_SUPABASE_URL)throw new Error('LOCAL_PROFILE_MISMATCH');
    const db=await createV2ServerSupabaseClient();
    const result=await db.auth.signInWithPassword({email:config.email,password:config.password});
    if(result.error)return Response.json({error:'LOCAL_CLIENT_LOGIN_UNAVAILABLE'},{status:503,headers});
    return new Response(null,{status:303,headers:{...headers,Location:'/clients/organization'}});
  }catch{return Response.json({error:'LOCAL_CLIENT_LOGIN_UNAVAILABLE'},{status:503,headers});}
}

import 'server-only';
import {readFileSync} from 'node:fs';
import {cookies,headers} from 'next/headers';
import {createServerClient,type CookieOptions} from '@supabase/ssr';
import type {Database} from '@/types/database-v2.types';
import {localScenarioCookieOptions} from '@/server/db/supabase/local-profile';
import {assignedDemoConfig} from './assigned-demo';
import {activateDemoSession} from './workspace-demo-session';
import {CLIENT_PREVIEW_COOKIE} from './local-client-preview-policy';
import {workspaceDemoAllowed,automaticDemoIdentity,type WorkspaceDemoConfig,type DemoWorkspace,type DemoAccount} from './workspace-demo-policy';
import {createV2ServerSupabaseClient} from '@/server/db/supabase/v2';

export function workspaceDemoConfig():WorkspaceDemoConfig{
 const assigned=assignedDemoConfig(),local=process.env.CARGOMESH_LOCAL_WORKSPACE_DEMO_ENABLED==='true'&&process.env.CM_ENABLE_DEMO==='1';
 const origin=local?process.env.CARGOMESH_LOCAL_WORKSPACE_DEMO_ORIGIN:assigned.origin;
 const production=process.env.NODE_ENV==='production',supabaseUrl=process.env.NEXT_PUBLIC_SUPABASE_URL;
 let localAccounts:DemoAccount[]=[];
 // Optional existing private credentials file, development loopback ONLY. Never sent to the browser.
 if(local&&!production&&process.env.CARGOMESH_LOCAL_WORKSPACE_DEMO_ACCESS_FILE){
  try{
   if(workspaceDemoAllowed({mode:'local',production,origin,supabaseUrl},new URL(origin!).host)){
    const text=readFileSync(process.env.CARGOMESH_LOCAL_WORKSPACE_DEMO_ACCESS_FILE,'utf8');
    const emails=text.split(/\r?\n/).filter(row=>/^Email:/i.test(row)).map(row=>row.slice(row.indexOf(':')+1).trim());
    const passwords=text.split(/\r?\n/).filter(row=>/^Password:/i.test(row)).map(row=>row.slice(row.indexOf(':')+1).trim());
    if(emails.length===2&&passwords.length===2)localAccounts=emails.map((email,index)=>({email,password:passwords[index]}));
   }
  }catch{ /* Missing private setup yields a controlled unavailable state, never another identity. */ }
 }
 const clientEmail=process.env.CARGOMESH_DEMO_CLIENT_EMAIL??localAccounts[0]?.email,clientPassword=process.env.CARGOMESH_DEMO_CLIENT_PASSWORD??localAccounts[0]?.password;
 const carrierEmail=assigned.carrierEmail??localAccounts[1]?.email,carrierPassword=assigned.carrierPassword??localAccounts[1]?.password;
 const carrier=carrierEmail&&carrierPassword?{email:carrierEmail,password:carrierPassword}:undefined;
 const explicitClient=clientEmail||clientPassword?{email:clientEmail??'',password:clientPassword??''}:undefined;
 return {mode:local?'local':assigned.enabled?'assigned':'disabled',production,supabaseUrl,
  origin,assigned,carrier,
  client:explicitClient??(assigned.clientOrganizationId?carrier:undefined),clientOrganizationId:assigned.clientOrganizationId,previewSecret:assigned.secret};
}
export async function workspaceDemoEnabled(){return workspaceDemoAllowed(workspaceDemoConfig(),(await headers()).get('host'));}
/** Do not silently replace a real/unrelated signed-in account when it lacks a workspace. */
export async function automaticWorkspaceDemoEntry(){
 const config=workspaceDemoConfig();
 if(!workspaceDemoAllowed(config,(await headers()).get('host')))return false;
 const db=await createV2ServerSupabaseClient(),current=await db.auth.getUser();
 return automaticDemoIdentity(config,current.data.user);
}

/** Buffer all auth cookies until the target's actual native access checks pass. */
export async function startWorkspaceDemoSession(workspace:DemoWorkspace,account:DemoAccount,organizationId?:string){
 const store=await cookies(),jar=new Map(store.getAll().map(row=>[row.name,row.value]));
 const staged=new Map<string,{name:string;value:string;options?:CookieOptions}>();
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 if(!url||!key)return false;
 const db=createServerClient<Database>(url,key,{
  cookieOptions:localScenarioCookieOptions({profile:process.env.CARGOMESH_LOCAL_PROFILE,url,production:process.env.NODE_ENV==='production'}),
  cookies:{getAll:()=>[...jar].map(([name,value])=>({name,value})),setAll:(rows:{name:string;value:string;options?:CookieOptions}[])=>{
   for(const row of rows){jar.set(row.name,row.value);staged.set(row.name,row);}
  }},
 });
 return activateDemoSession(workspace,account,organizationId,{
  current:async()=>{const result=await db.auth.getUser();return result.error?null:result.data.user;},
  signIn:async credentials=>{const result=await db.auth.signInWithPassword(credentials);return result.error?null:result.data.user;},
  member:async userId=>{
   // Match requireAuthenticatedMember's effective tenant selection, not merely
   // the existence of the configured membership among other active tenants.
   const result=await db.from('organization_members').select('organization_id,role,status,organizations!inner(name,status)')
    .eq('auth_user_id',userId).eq('status','ACTIVE').eq('organizations.status','ACTIVE')
    .order('organization_id').limit(1).maybeSingle();
   if(result.error)throw Error('Demo membership unavailable');return result.data;
  },
  carriers:async()=>{const result=await db.rpc('read_v2_carrier_portal_access');if(result.error)throw Error('Demo carrier access unavailable');return result.data;},
  commit:()=>{for(const row of staged.values())store.set(row.name,row.value,row.options);store.delete(CLIENT_PREVIEW_COOKIE);},
 });
}

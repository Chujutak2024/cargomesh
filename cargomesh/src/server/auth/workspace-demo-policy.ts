import {assignedDemoAllowed,syntheticDemoEmail,type AssignedDemoConfig} from './assigned-demo-policy';
import {hasSessionOrigin} from './session-origin';

export type DemoWorkspace='client'|'carrier';
export type DemoAccount={email:string;password:string};
export type WorkspaceDemoConfig={mode:'disabled'|'local'|'assigned';origin?:string;production:boolean;supabaseUrl?:string;allowHostedLocal?:boolean;
 assigned?:AssignedDemoConfig;client?:DemoAccount;carrier?:DemoAccount;clientOrganizationId?:string;previewSecret?:string};
/** Also recognizes the pre-existing hac54.carrier.local fixture, without changing legacy policy. */
export function workspaceDemoSyntheticEmail(email:string){return syntheticDemoEmail(email)||/^hac\d+\.[a-z0-9._-]+@cargomesh\.test$/i.test(email);}
/** A phone-only or unrelated real identity must never be silently replaced. */
export function automaticDemoIdentity(config:Pick<WorkspaceDemoConfig,'client'|'carrier'>,user:{email?:string}|null){
 return !user||!!user.email&&workspaceDemoSyntheticEmail(user.email)
  &&[config.client,config.carrier].some(account=>!!account&&account.email===user.email);
}

/** Local convenience is independently opted in; hosted HTTPS policy remains unchanged. */
export function workspaceDemoAllowed(config:WorkspaceDemoConfig,host:string|null){
 if(config.mode==='disabled'||!config.origin)return false;
 if(config.mode==='assigned')return config.assigned?.origin===config.origin&&assignedDemoAllowed(config.assigned,host);
 if(config.production)return false;
 try{
  const origin=new URL(config.origin),api=new URL(config.supabaseUrl??'');
  const localApi=api.protocol==='http:'&&['127.0.0.1','localhost'].includes(api.hostname);
  const hostedApi=config.allowHostedLocal===true&&api.protocol==='https:'&&/^[a-z0-9]+\.supabase\.co$/.test(api.hostname)
   &&!api.port&&api.pathname==='/'&&!api.search&&!api.hash;
  const allowedHosts=hostedApi?['127.0.0.1:8090','localhost:8090']:['127.0.0.1:8080','localhost:8080'];
  return origin.origin===config.origin&&origin.protocol==='http:'&&!origin.username&&!origin.password
   &&allowedHosts.includes(origin.host)&&origin.host===host
   &&(localApi||hostedApi)&&!api.username&&!api.password;
 }catch{return false;}
}

export function createWorkspaceDemoHandler(config:WorkspaceDemoConfig,deps:{start:(workspace:DemoWorkspace,account:DemoAccount,organizationId?:string)=>Promise<boolean>;preview:(secret:string)=>Promise<void>}){
 const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store, private','Vary':'Origin, Cookie','X-Content-Type-Options':'nosniff'}});
 return async(request:Request)=>{
  if(!workspaceDemoAllowed(config,request.headers.get('host')))return json({ok:false,code:'DEMO_DISABLED'},404);
  if(request.method!=='POST'||!hasSessionOrigin(request)||request.headers.get('origin')!==config.origin
   ||new URL(request.url).protocol!==new URL(config.origin!).protocol)return json({ok:false,code:'FORBIDDEN_ORIGIN'},403);
  const input=await request.json().catch(()=>null);
  if(!input||Array.isArray(input)||Object.keys(input).length!==1||!['client','carrier'].includes(input.workspace))return json({ok:false,code:'INVALID_DEMO_WORKSPACE'},400);
  const workspace=input.workspace as DemoWorkspace,account=config[workspace];
  try{
   // Preserve only the explicitly configured legacy visual demo, never fallback after native failure.
   if(workspace==='client'&&config.mode==='assigned'&&!config.clientOrganizationId&&!config.client){
    if(!config.previewSecret)return json({ok:false,code:'DEMO_ACCOUNT_UNAVAILABLE'},503);
    await deps.preview(config.previewSecret);
   }else{
    if(!account||!workspaceDemoSyntheticEmail(account.email)||!account.password
     ||workspace==='client'&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(config.clientOrganizationId??''))
     return json({ok:false,code:'DEMO_ACCOUNT_UNAVAILABLE'},503);
    if(!await deps.start(workspace,account,config.clientOrganizationId))return json({ok:false,code:'DEMO_ACCOUNT_UNAVAILABLE'},503);
   }
   return json({ok:true,destination:workspace==='client'?'/clients':'/carriers'});
  }catch{return json({ok:false,code:'DEMO_SESSION_UNAVAILABLE'},503);}
 };
}

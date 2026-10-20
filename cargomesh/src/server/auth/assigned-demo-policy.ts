import {hasSessionOrigin} from './session-origin';
export type AssignedDemoConfig={enabled:boolean;origin?:string;secret?:string;carrierEmail?:string;carrierPassword?:string};
/** Explicitly scoped demo origin. No deployment or forwarded host enables this by itself. */
export function assignedDemoAllowed(config:AssignedDemoConfig,host:string|null){
 if(!config.enabled||!config.origin||!config.secret||config.secret.length<32)return false;
 try{const origin=new URL(config.origin);return origin.origin===config.origin&&origin.protocol==='https:'&&!origin.username&&!origin.password&&origin.host===host;}catch{return false;}
}
export function syntheticDemoEmail(email:string|undefined){return !!email&&/^(hac\d+[-_]|qa-v2-|demo)/i.test(email)&&/\.(invalid|test)$/.test(email);}
export function syntheticCarrierAccess(rows:unknown){return Array.isArray(rows)&&rows.length>0&&rows.every(row=>row&&typeof row.carrierName==='string'&&/^\[SYNTHETIC\]/i.test(row.carrierName));}
/** A configured synthetic Carrier may also view Client demo data; no business membership is granted. */
export function assignedCarrierPreviewAllowed(config:AssignedDemoConfig,host:string|null,email:string|undefined,access:unknown){
 return assignedDemoAllowed(config,host)&&syntheticDemoEmail(config.carrierEmail)
  &&email===config.carrierEmail&&syntheticCarrierAccess(access);
}
export function createAssignedDemoHandler(config:AssignedDemoConfig,deps:{startClient:(secret:string)=>Promise<void>;startCarrier:(email:string,password:string)=>Promise<boolean>}){
 const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff','Vary':'Origin, Cookie'}});
 return async(request:Request)=>{
  if(!assignedDemoAllowed(config,request.headers.get('host')))return json({ok:false,code:'DEMO_DISABLED'},404);
  if(request.method!=='POST'||!hasSessionOrigin(request)||request.headers.get('origin')!==config.origin||new URL(request.url).protocol!=='https:')return json({ok:false,code:'FORBIDDEN_ORIGIN'},403);
  const input=await request.json().catch(()=>null);
  if(!input||Object.keys(input).length!==1||!['client','carrier'].includes(input.workspace))return json({ok:false,code:'INVALID_DEMO_WORKSPACE'},400);
  try{
   if(input.workspace==='client'){await deps.startClient(config.secret!);return json({ok:true,destination:'/clients'});}
   if(!syntheticDemoEmail(config.carrierEmail)||!config.carrierPassword)return json({ok:false,code:'DEMO_ACCOUNT_UNAVAILABLE'},503);
   if(!await deps.startCarrier(config.carrierEmail!,config.carrierPassword))return json({ok:false,code:'DEMO_ACCOUNT_UNAVAILABLE'},503);
   return json({ok:true,destination:'/carriers'});
  }catch{return json({ok:false,code:'DEMO_SESSION_UNAVAILABLE'},503);}
 };
}

/** A voice preview grant is conversation-only and never carries a business actor. */
export function assignedVoicePreviewAllowed(config:AssignedDemoConfig,request:Request,preview:boolean){
 return preview&&assignedDemoAllowed(config,request.headers.get('host'))&&hasSessionOrigin(request)
  &&request.headers.get('origin')===config.origin&&new URL(request.url).protocol==='https:';
}

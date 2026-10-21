/** Explicit synthetic setup through genuine Auth + native Carrier RPCs. No JWT impersonation. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(import.meta.url);
const {createClient}=require(path.join(root,'cargomesh/node_modules/@supabase/supabase-js'));
const args=process.argv.slice(2),arg=name=>{const i=args.indexOf(name);return i<0?null:args[i+1];};
const source=fs.readFileSync(path.join(root,'supabase/scenarios/v2-client-carrier-quotes/seed.sql'),'utf8');
const match=source.match(/\$scenario\$([\s\S]+?)\$scenario\$/);if(!match)throw Error('SCENARIO_MISSING');
const scenario=JSON.parse(match[1]);
if(!args.includes('--apply-synthetic')){
 console.log(JSON.stringify({dryRun:true,scenario:scenario.scenarioId,target:scenario.targetProjectRef,carrierId:scenario.carrierId,steps:scenario.steps.map(s=>s.key),priceUSD:scenario.policy.baseAmount,provenance:scenario.provenanceStatus,validUntil:scenario.validUntil,notes:scenario.notes},null,2));
 process.exit(0);
}
if(!args.includes('--approve-tariff')||!arg('--private-config')||!arg('--private-login')||!arg('--evidence'))throw Error('EXPLICIT_TARIFF_APPROVAL_AND_PRIVATE_FILES_REQUIRED');
if(Date.parse(scenario.validUntil)<=Date.now())throw Error('SCENARIO_EXPIRED');
const config=JSON.parse(fs.readFileSync(arg('--private-config'),'utf8')),login=JSON.parse(fs.readFileSync(arg('--private-login'),'utf8'));
if(new URL(config.NEXT_PUBLIC_SUPABASE_URL).hostname!==scenario.targetProjectRef+'.supabase.co')throw Error('WRONG_PROJECT');
const db=createClient(config.NEXT_PUBLIC_SUPABASE_URL,config.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const state={scenario:scenario.scenarioId,projectRef:scenario.targetProjectRef,provenance:'SIMULATED',records:{},policy:null};
const refs={},evidencePath=path.resolve(arg('--evidence'));
function save(){fs.mkdirSync(path.dirname(evidencePath),{recursive:true});fs.writeFileSync(evidencePath,JSON.stringify(state,null,2));}
function key(label){const h=crypto.createHash('sha256').update(scenario.scenarioId+':'+label).digest('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;}
function resolve(v){if(typeof v==='string'&&v.startsWith('$')){if(!refs[v.slice(1)])throw Error('MISSING_SCENARIO_REFERENCE');return refs[v.slice(1)];}if(Array.isArray(v))return v.map(resolve);if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,resolve(x)]));return v;}
async function rpc(name,args){const {data,error}=await db.rpc(name,args);if(error)throw Error(`${name}:${error.code}:${/^[A-Z_]+$/.test(error.message)?error.message:'NATIVE_COMMAND_FAILED'}`);return data;}
try{
 const auth=await db.auth.signInWithPassword({email:login.CARGOMESH_DEMO_CARRIER_EMAIL,password:login.CARGOMESH_DEMO_CARRIER_PASSWORD});if(auth.error)throw Error('AUTH_FAILED');
 const access=await rpc('read_v2_carrier_portal_access',{});const actor=access.find(a=>a.carrierId===scenario.carrierId&&a.role==='ADMIN');if(!actor)throw Error('VERIFIED_CARRIER_ADMIN_REQUIRED');
 const own=await rpc('read_v2_carrier_catalog',{p_operator_id:actor.operatorId,p_kind:'carriers',p_carrier_id:actor.carrierId,p_service_id:null,p_id:actor.carrierId,p_limit:1,p_offset:0});
 const carrier=own[0]?.value;if(!carrier||!String(carrier.commercialName??'').startsWith('[SYNTHETIC]'))throw Error('SYNTHETIC_CARRIER_REQUIRED');
 for(const step of scenario.steps){
  const value=resolve(step.value);let response;
  if(step.family==='catalog')response=await rpc('command_v2_carrier_catalog',{p_operator_id:actor.operatorId,p_kind:step.kind,p_carrier_id:actor.carrierId,p_service_id:resolve(step.serviceScope),p_id:null,p_idempotency_key:key(step.key),p_expected_version:null,p_value:value});
  else response=await rpc('command_v2_carrier_workflow',{p_operator_id:actor.operatorId,p_action:step.action,p_context:{requestId:null,carrierId:actor.carrierId,parentId:null,id:null},p_key:key(step.key),p_value:value});
  const record=response.record;if(!record?.id)throw Error('INVALID_NATIVE_RECEIPT');
  if(response.replay){
   const rows=step.family==='catalog'?await rpc('read_v2_carrier_catalog',{p_operator_id:actor.operatorId,p_kind:step.kind,p_carrier_id:actor.carrierId,p_service_id:resolve(step.serviceScope),p_id:record.id,p_limit:1,p_offset:0})
    :await rpc('read_v2_carrier_workflow',{p_operator_id:actor.operatorId,p_kind:'limits',p_context:{requestId:null,carrierId:actor.carrierId,parentId:null,id:record.id},p_limit:1,p_offset:0});
   if(rows.length!==1||rows[0].version!==record.version)throw Error('SCENARIO_RESOURCE_DRIFT_REVIEW_REQUIRED');
  }
  refs[step.key]=record.id;
  state.records[step.key]={id:record.id,version:record.version,replay:response.replay};save();
 }
 const policies=await rpc('configure_v2_quote_policy',{p_carrier_id:actor.carrierId,p_operator_id:actor.operatorId,p_key:null,p_expected_version:null,p_value:null});
 const current=policies.find(p=>p.serviceId===refs.service&&p.laneId===refs.lane),value=resolve(scenario.policy);
 // Preserve an already modified approval; a rerun is not permission to overwrite another user's tariff.
 if(current&&JSON.stringify(current.value)!==JSON.stringify(value)){
  const canonical=v=>JSON.stringify(Object.keys(v).sort().map(k=>[k,v[k]]));
  if(canonical(current.value)!==canonical(value))throw Error('POLICY_DRIFT_REVIEW_REQUIRED');
 }
 const policy=current??await rpc('configure_v2_quote_policy',{p_carrier_id:actor.carrierId,p_operator_id:actor.operatorId,p_key:key('approved-policy'),p_expected_version:0,p_value:value});
 state.policy={id:policy.id,version:policy.version,serviceId:policy.serviceId,laneId:policy.laneId,priceUSD:policy.value.baseAmount,provenanceStatus:policy.value.provenanceStatus};save();
 console.log(JSON.stringify({configured:true,records:Object.keys(state.records).length,policy:state.policy,ordersCreated:0,bookingsCreated:0}));
}catch(error){save();console.error(error.message);process.exitCode=1;}

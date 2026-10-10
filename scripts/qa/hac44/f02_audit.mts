/** Directed native IncidentUpdate controls with scenario-emitted execution IDs. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {fixtureSession,localConfig} from './real_auth.mjs';
import {startCoverageTransport} from './coverage_transport.mts';
const out=process.env.HAC44_EVIDENCE!,bank=process.env.HAC44_BANK_DB!,sha=process.env.HAC44_SOURCE_SHA!;
localConfig();
const refs=JSON.parse(fs.readFileSync(out+'/dataset/complete-refs.json','utf8'));
const org='d4400000-0000-4000-8000-000000000001',member='d4420000-0000-4000-8000-000000000001';
const carrier=refs.incident.carrierId,incident=refs.incident.id,execution=refs.execution.id;
const results:any[]=[];
const save=(complete=false)=>{const text=JSON.stringify({sha,evidence:results,complete},null,2)+'\n';fs.writeFileSync(out+'/PROBES/CP1B_AUDIT.json',text);assert.equal(fs.readFileSync(out+'/PROBES/CP1B_AUDIT.json','utf8'),text);};
const q=(v:any)=>"'"+JSON.stringify(v).replaceAll("'","''")+"'::jsonb";
const literal=(s:string)=>"'"+s.replaceAll("'","''")+"'";
function sql(query:string){const r=spawnSync('docker',['exec','-i',bank,'psql','-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-v','local_only=1','-U','postgres','-d','postgres'],{input:query,encoding:'utf8',maxBuffer:32e6});assert.equal(r.status,0,'Owned SQL failed; SQL and claims omitted');return JSON.parse(r.stdout.trim());}
function counts(){return sql(`create temporary table c(n text,v bigint);do $$declare r record;v bigint;begin for r in select n.nspname,c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind in('r','p') and n.nspname not like 'pg_%' and n.nspname<>'information_schema' loop execute format('select count(*) from %I.%I',r.nspname,r.relname) into v;insert into c values(r.nspname||'.'||r.relname,v);end loop;end$$;select jsonb_object_agg(n,v) from c;`);}
const actor=await fixtureSession('d4410000-0000-4000-8000-000000000001');
const claims=`set local "request.jwt.claims"=${literal(JSON.stringify(actor.claims))};`;
const transport=await startCoverageTransport();
async function http(path:string,payload:any=null){const response=await fetch(transport.origin+'/api/v2'+path,{method:payload?'POST':'GET',headers:{Authorization:'Bearer '+actor.token,...(payload?{'Content-Type':'application/json','Idempotency-Key':randomUUID(),Origin:transport.origin}:{})},...(payload?{body:JSON.stringify(payload)}:{})});return {http:response.status,body:await response.json()};}
const record=(probe:string,rowId:string,status:string,observed:any,extra:any={})=>{results.push({sha,probe,rowIds:[rowId],status,observed,controlPositive:'Fresh native incident version from its scenario-emitted execution; Auth-issued/getUser-verified session',supersedes:{probe,source:'PROBES/CP2_RESULTADOS.json',reason:'Correct actual execution ID; DTO has no parentId field'},...extra});save();};
const helper=`create function pg_temp.attempt(q text) returns jsonb language plpgsql security invoker as $$declare v jsonb;accepted boolean:=false;s text;m text;begin begin execute q into v;set constraints all immediate;accepted:=true;raise exception using message='QA_ROLLBACK';exception when others then get stacked diagnostics s=returned_sqlstate,m=message_text;if m<>'QA_ROLLBACK' then accepted:=false;end if;end;return jsonb_build_object('accepted',accepted,'value',v,'error',case when accepted then null else m end,'role',current_user,'actualSession',current_setting('request.jwt.claims')::jsonb ? 'session_id');end;$$;grant execute on function pg_temp.attempt(text) to authenticated;`;
try{
 for(const field of ['action','note','evidence'])for(const operation of ['NULL','OMIT']){
  const row='IncidentUpdate.'+field,path=`/carriers/${carrier}/incidents/${incident}/updates`;
  const parent=await http(`/carriers/${carrier}/executions/${execution}/incidents/${incident}`);
  if(parent.http!==200){for(const prefix of ['DB_FIELD ','HTTP_FIELD '])record(prefix+row+' '+operation,row,'BLOQUEADO',{positiveHttp:parent.http,error:parent.body.error});continue;}
  const value:any={schemaVersion:'2.0',expectedVersion:parent.body.data.version,action:'NOTE',note:'Synthetic directed audit '+randomUUID(),evidence:{reference:'fixture:cp1b-directed-audit',provider:'Synthetic HAC-44',observedAt:new Date().toISOString(),validUntil:null,provenanceStatus:'SIMULATED'}};
  const negative={...value};if(operation==='NULL')negative[field]=null;else delete negative[field];
  const command=(v:any)=>`select public.command_v2_workflow('${org}','${member}','incidents.update',${q({carrierId:carrier,requestId:null,parentId:null,id:incident})},gen_random_uuid(),${q(v)})->'record'`;
  const before=counts(),pair=sql(`begin;${helper}set local role authenticated;${claims}select jsonb_build_object('positive',pg_temp.attempt(${literal(command(value))}),'negative',pg_temp.attempt(${literal(command(negative))}));set constraints all immediate;rollback;`),after=counts();assert.deepEqual(before,after);
  record('DB_FIELD '+row+' '+operation,row,!pair.positive.accepted?'BLOQUEADO':!pair.negative.accepted?'PASS':'DIFERENCIA',pair,{countsBefore:before,countsAfter:after,rollbackDelta:0,dbBoundary:'ALL IMMEDIATE under authenticated before rollback; no RESET ROLE'});
  const positive=await http(path,value),denial=await http(path,negative);
  record('HTTP_FIELD '+row+' '+operation,row,positive.http!==200?'BLOQUEADO':denial.http===400?'PASS':'DIFERENCIA',{positiveHttp:positive.http,negativeHttp:denial.http,error:denial.body.error??null});
  const list=await http(path);const found=list.body.data?.find((r:any)=>r.data.note===value.note);
  const query=`select r from jsonb_array_elements(public.read_v2_workflow('${org}','${member}','incident-updates',${q({carrierId:carrier,requestId:null,parentId:incident,id:null})},100,0)) r where r->'data'->>'note'=${literal(value.note)} limit 1`;
  const cb=counts(),stored=sql(`begin;set local role authenticated;${claims}${query};set constraints all immediate;rollback;`),ca=counts();assert.deepEqual(cb,ca);
  record('FIELD roundtrip '+row+' audit DB/HTTP '+operation,row,positive.http!==200?'BLOQUEADO':isDeepStrictEqual(found?.data?.[field],value[field])&&isDeepStrictEqual(stored?.data?.[field],value[field])?'PASS':'BLOQUEADO',{positiveHttp:positive.http,value:found?.data?.[field],dbValue:stored?.data?.[field],written:value[field]},{countsBefore:cb,countsAfter:ca,rollbackDelta:0,fieldContractCitation:'cargomesh/src/shared/schemas/v2/workflow.ts:101'});
 }
 save(true);
}finally{await actor.client.auth.signOut({scope:'local'});await transport.stop();}
console.log(JSON.stringify({cases:results.length,states:results.reduce((a:any,r:any)=>(a[r.status]=(a[r.status]??0)+1,a),{}),complete:true}));

// Test harness only. No runtime import, hidden fallback, permission grant or database business insert.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createClient} from '@supabase/supabase-js';
export function localRecipe(name){
 const sql=readFileSync(fileURLToPath(new URL(`../../supabase/scenarios/${name}/seed.sql`,import.meta.url)),'utf8');
 return JSON.parse(execFileSync('docker',['exec','-i','supabase_db_cargomesh-v2-local','psql','-U','postgres','-d','postgres','-X','-A','-t','-q','-v','ON_ERROR_STOP=1','-v','local_only=1'],{input:sql,encoding:'utf8'}).trim());
}
export async function localHarness(namespace,{setupAdmin=false}={}){
 const api=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL??''),app=new URL(process.env.HAC54_LOCAL_APP_URL??'http://localhost:3000');
 assert.equal(api.origin,'http://127.0.0.1:61321');assert.ok(['localhost','127.0.0.1'].includes(app.hostname)&&app.protocol==='http:'&&!app.username&&!app.password);
 const info=JSON.parse(execFileSync('docker',['inspect','supabase_kong_cargomesh-v2-local'],{encoding:'utf8'}))[0];
 assert.ok(info.State.Running&&info.NetworkSettings.Ports['8000/tcp'].some(p=>p.HostPort==='61321'));
 const saved=process.env.HAC54_LOCAL_ACCESS_FILE?readFileSync(process.env.HAC54_LOCAL_ACCESS_FILE,'utf8').split(/\r?\n/).filter(line=>/^Password:/i.test(line)).map(line=>line.slice(line.indexOf(':')+1).trim()):[];
 const passwords={client:process.env.HAC54_LOCAL_CLIENT_PASSWORD??saved[0],carrier:process.env.HAC54_LOCAL_CARRIER_PASSWORD??saved[1]};
 assert.ok(passwords.client&&passwords.carrier,'Existing local test access required. Never print credentials.');
 const opts={auth:{persistSession:false,autoRefreshToken:false}},tokens={},clients={};
 for(const [actor,email,password] of [['client','qa-v2-a@cargomesh.test',passwords.client],['foreign','qa-v2-b@cargomesh.test',passwords.client],['carrier','hac54.carrier.local@cargomesh.test',passwords.carrier]]){
  const db=createClient(api.origin,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,opts),login=await db.auth.signInWithPassword({email,password});assert.equal(login.error,null,`${actor} login`);
  tokens[actor]=login.data.session.access_token;clients[actor]=db;
 }
 if(setupAdmin){
  const email='fe1.carrier.local@example.invalid',admin=createClient(api.origin,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,opts);
  const sent=await admin.auth.signInWithOtp({email,options:{shouldCreateUser:false}});assert.equal(sent.error,null);
  const mailbox=await(await fetch('http://127.0.0.1:61324/api/v1/messages')).json();
  const row=mailbox.messages.find(message=>message.To.some(to=>to.Address===email));assert.ok(row);
  const message=await(await fetch('http://127.0.0.1:61324/api/v1/message/'+row.ID)).json();
  const link=[...message.HTML.matchAll(/https?:\/\/[^"\s<>]+/g)].map(match=>new URL(match[0].replaceAll('&amp;','&'))).find(url=>url.origin===api.origin&&url.pathname==='/auth/v1/verify'&&url.searchParams.get('type')==='magiclink');assert.ok(link);
  const login=await admin.auth.verifyOtp({token_hash:link.searchParams.get('token'),type:'magiclink'});assert.equal(login.error,null);
  tokens.setup=login.data.session.access_token;
 }
 const key=name=>{const h=createHash('sha256').update(namespace+':'+name).digest('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-8${h.slice(17,20)}-${h.slice(20,32)}`;};
 async function call(path,actor='client',body,name){
  const response=await fetch(new URL('/api/v2'+path,app),{method:body?'POST':'GET',signal:AbortSignal.timeout(45000),headers:{...(tokens[actor]?{Authorization:`Bearer ${tokens[actor]}`} :{}),...(body?{'Content-Type':'application/json','Idempotency-Key':key(name??path)}:{})},...(body?{body:JSON.stringify(body)}:{})});
  return {status:response.status,body:await response.json().catch(()=>null)};
 }
 async function get(path,actor='client'){const response=await call(path,actor);assert.equal(response.status,200,`${path}: ${JSON.stringify(response.body)}`);return response.body.data;}
 async function save(name,path,body,actor='client'){const r=await call(path,actor,body,name);assert.ok(r.status===200||r.status===201,`${name}: ${r.status} ${JSON.stringify(r.body)}`);return r.body.data;}
 const fetcher=(path,init)=>fetch(new URL(String(path),app),{...init,headers:{...init?.headers,Authorization:`Bearer ${tokens.client}`}});
 return {app,api,clients,tokens,key,call,get,save,fetcher};
}

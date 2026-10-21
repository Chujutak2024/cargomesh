import assert from 'node:assert/strict';

// Exercises real session cookies and native V2 reads. No service-role key, fixture
// header or business command is used. The server owns the two demo credentials.
const origin=process.env.DEMO_WORKSPACE_SMOKE_ORIGIN??'http://127.0.0.1:8080';
assert.ok(['http://127.0.0.1:8080','http://localhost:8080'].includes(origin),'Loopback demo origin required');
const jar=new Map();
let checks=0;
async function request(path,options={}){
 const response=await fetch(origin+path,{redirect:'manual',...options,headers:{
  cookie:[...jar].map(([name,value])=>`${name}=${value}`).join(';'),...options.headers,
 }});
 for(const row of response.headers.getSetCookie()){
  const pair=row.split(';')[0],index=pair.indexOf('='),name=pair.slice(0,index),value=pair.slice(index+1);
  if(value)jar.set(name,value);else jar.delete(name);
 }
 return response;
}
async function read(path,status=200){
 const response=await request(path);assert.equal(response.status,status,path);checks++;
 return response.json();
}
async function change(workspace){
 const response=await request('/api/auth/workspace-session',{method:'POST',headers:{origin,'content-type':'application/json','sec-fetch-site':'same-origin'},body:JSON.stringify({workspace})});
 assert.equal(response.status,200,`switch ${workspace}`);
 assert.match(response.headers.get('cache-control')??'',/no-store/);
 assert.deepEqual(await response.json(),{ok:true,destination:workspace==='client'?'/clients':'/carriers'});checks++;
}
function records(value){
 const data=value.data;
 const list=Array.isArray(data)?data:Array.isArray(data?.items)?data.items:Array.isArray(value.items)?value.items:null;
 assert.ok(list,'Native collection returned records');
 return JSON.stringify(list);
}
async function snapshot(){
 const result={};
 for(const path of ['/api/v2/freight/requests','/api/v2/bookings','/api/v2/executions'])result[path]=records(await read(path));
 return result;
}
const get=await request('/api/auth/workspace-session');assert.equal(get.status,405);checks++;
for(const [headers,body,status] of [
 [{origin:'https://untrusted.invalid'}, {workspace:'carrier'},403],
 [{origin,'sec-fetch-site':'cross-site'}, {workspace:'client'},403],
 [{origin}, {workspace:'client',returnTo:'/admin'},400],
 [{origin}, {workspace:'carrier',email:'injected@example.invalid'},400],
]){
 const response=await request('/api/auth/workspace-session',{method:'POST',headers:{'content-type':'application/json',...headers},body:JSON.stringify(body)});
 assert.equal(response.status,status);assert.equal(response.headers.getSetCookie().length,0);checks++;
}
await change('client');
const before=await snapshot();
const clientAccess=await read('/api/v2/carrier-portal/access');assert.deepEqual(clientAccess.data,[]);checks++;
await change('carrier');
const access=await read('/api/v2/carrier-portal/access');assert.ok(access.data.length>0);
const carrierId=access.data[0].carrierId;assert.match(carrierId,/^[0-9a-f-]{36}$/i);checks++;
await read(`/api/v2/carriers/${carrierId}/opportunities`);
await read('/api/v2/freight/requests',403);
const recovery=await request('/clients/freight-request/new');
assert.equal(recovery.status,200);const html=await recovery.text();
assert.ok(html.includes('data-workspace-entry="client"'));
assert.ok(html.includes('Opening')||html.includes('Abriendo'));
assert.ok(!html.includes('Two perspectives.')&&!html.includes('Dos perspectivas.'));
assert.ok(!html.includes('Switch demo workspace')&&!html.includes('Cambiar espacio de demo'));
assert.ok(!html.includes('No Client access'));checks++;
await change('client');
await read(`/api/v2/carriers/${carrierId}/opportunities`,403);
assert.deepEqual(await snapshot(),before,'Switching must not mutate requests, bookings or executions');checks++;
// Re-selecting the current workspace is safe and does not need another identity.
await change('client');
assert.deepEqual(await snapshot(),before);checks++;
const deniedLogout=await request('/api/auth/logout',{method:'POST',headers:{origin:'https://untrusted.invalid'}});
assert.equal(deniedLogout.status,403);assert.equal(deniedLogout.headers.getSetCookie().length,0);checks++;
await read('/api/v2/freight/requests');
const logout=await request('/api/auth/logout',{method:'POST',headers:{origin,'sec-fetch-site':'same-origin'}});
assert.equal(logout.status,303);assert.equal(logout.headers.get('location'),'/login');checks++;
await read('/api/v2/freight/requests',401);
await change('client');assert.deepEqual(await snapshot(),before);checks++;
console.log(JSON.stringify({ok:true,checks,flow:'Client -> Carrier -> Client',nativeV2:true,businessCommands:0,credentialsExposed:false}));

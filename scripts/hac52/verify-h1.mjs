import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const origin='http://127.0.0.1:59580';
const get=(route,init={})=>fetch(origin+route,{...init,redirect:'manual',signal:AbortSignal.timeout(120000)});
const checks=[];
function check(name,ok){assert.ok(ok,name);checks.push(name);}
try{
 const anonymous=await get('/api/v2/organizations/current');
 check('anonymous denied',anonymous.status===401);
 const denied=await get('/api/local/hac52/client-session',{method:'POST',headers:{Origin:'http://foreign.example.invalid'}});
 check('cross-origin local session denied',denied.status===403);
 const login=await get('/api/local/hac52/client-session',{method:'POST',headers:{Origin:origin}});
 check('same-origin local session established',login.status===303);
 const cookie=login.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ');
 check('isolated cookie issued',cookie.startsWith('sb-cargomesh-hac52-client-auth-token'));
 const organization=await get('/api/v2/organizations/current',{headers:{cookie}});
 const data=await organization.json();
 check('authenticated organization read',organization.status===200&&data.data.id==='52000000-0000-4000-8000-000000000001');
 const page=await get('/clients/organization',{headers:{cookie}});
 const html=await page.text();
 check('connected profile rendered',page.status===200&&html.includes('[SYNTHETIC] Pacific Produce')&&html.includes('Synthetic Client Peru')&&!html.includes('Alex Morgan'));
 const facilities=await get('/api/v2/facilities',{headers:{cookie}});
 check('empty facilities are real data',facilities.status===200&&Array.isArray((await facilities.json()).data));
 const report={profile:'hac52-client',checks,passed:checks.length,hostedAccess:false};
 if(process.argv[2])await fs.writeFile(process.argv[2],JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report,null,2));
}catch(error){console.error('H1 smoke failed: '+error.message);process.exitCode=1;}

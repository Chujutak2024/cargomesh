import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// A separate local profile of this checkout; never changes .env.local or hosted data.
if (process.env.NODE_ENV === 'production') throw new Error('Local scenario requires development');
const file = process.env.CARGOMESH_SCENARIO_CONFIG;
if (!file || !path.isAbsolute(file)) throw new Error('Private scenario configuration path required');
const c = JSON.parse(await fs.readFile(file, 'utf8'));
if (c.profile !== 'fleet80' || c.url !== 'http://127.0.0.1:59730'
  || c.database !== 'hac50_scenario_fleet80_global_v1'
  || !c.anonKey || !c.email || !c.password) throw new Error('Invalid local scenario configuration');
process.env.NODE_ENV = 'development';
process.env.CARGOMESH_LOCAL_PROFILE = 'fleet80';
process.env.NEXT_PUBLIC_SUPABASE_URL = c.url;
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = c.anonKey;
process.env.CARGOMESH_LOCAL_LOGIN_DEFAULTS_ENABLED = 'true';
process.env.CARGOMESH_LOCAL_LOGIN_EMAIL = c.email;
process.env.CARGOMESH_LOCAL_LOGIN_PASSWORD = c.password;
// Shared credentials and remote voice adapters are not part of this local scenario.
process.env.CARGOMESH_LOCAL_CLIENT_LOGIN_EMAIL = '';
process.env.CARGOMESH_LOCAL_CLIENT_LOGIN_PASSWORD = '';
const allowedOrigin = 'http://127.0.0.1:8083';
const gateway = http.createServer(async (req, res) => {
  const headers = {'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
  try {
    if (req.headers.host !== '127.0.0.1:59730') { res.writeHead(403,headers).end(); return; }
    const origin = req.headers.origin;
    if (origin && origin !== allowedOrigin) { res.writeHead(403,headers).end(); return; }
    if (origin) Object.assign(headers,{'Access-Control-Allow-Origin':origin,'Vary':'Origin'});
    if (req.method === 'OPTIONS') {
      Object.assign(headers,{'Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'GET,POST,PUT,PATCH,DELETE,OPTIONS'});
      res.writeHead(204,headers).end(); return;
    }
    if (req.headers.apikey !== c.anonKey) { res.writeHead(401,headers).end(); return; }
    const u = new URL(req.url, c.url);
    let base, suffix;
    if (u.pathname.startsWith('/auth/v1/')) { base='http://127.0.0.1:59731'; suffix=u.pathname.slice('/auth/v1'.length); }
    else if (u.pathname.startsWith('/rest/v1/')) { base='http://127.0.0.1:59732'; suffix=u.pathname.slice('/rest/v1'.length); }
    else { res.writeHead(404,headers).end(); return; }
    let length=0; const chunks=[];
    for await (const chunk of req) { length+=chunk.length; if(length>1048576){res.writeHead(413,headers).end();return;} chunks.push(chunk); }
    const forwarded={};
    for(const key of ['authorization','content-type','prefer','range','accept','accept-profile','content-profile','x-client-info']) if(req.headers[key]) forwarded[key]=req.headers[key];
    const response=await fetch(base+suffix+u.search,{method:req.method,headers:forwarded,
      body:['GET','HEAD'].includes(req.method)?undefined:Buffer.concat(chunks),redirect:'manual',signal:AbortSignal.timeout(15000)});
    for(const key of ['content-type','content-range','range-unit','preference-applied','location']) if(response.headers.has(key)) headers[key]=response.headers.get(key);
    res.writeHead(response.status,headers).end(Buffer.from(await response.arrayBuffer()));
  } catch { if(!res.headersSent)res.writeHead(503,headers);res.end(); }
});
await new Promise((resolve,reject)=>{gateway.once('error',reject);gateway.listen(59730,'127.0.0.1',resolve);});
const app=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
process.chdir(app);
const {default:next}=await import('next');
const serverApp=next({dev:true,dir:app,hostname:'127.0.0.1',port:8083});
await serverApp.prepare();
const handler=serverApp.getRequestHandler();
const server=http.createServer((req,res)=>handler(req,res));
server.on('upgrade',(req,socket,head)=>serverApp.getUpgradeHandler()(req,socket,head).catch(()=>socket.destroy()));
server.listen(8083,'127.0.0.1',()=>console.log('Fleet scenario profile: http://127.0.0.1:8083/carriers/fleet · local Supabase · SIMULATED data'));

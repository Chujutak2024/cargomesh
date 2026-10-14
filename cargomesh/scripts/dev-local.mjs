import path from 'node:path';
import {fileURLToPath} from 'node:url';
import http from 'node:http';
import net from 'node:net';
import next from 'next';

// One checkout and one origin for landing, Shipper, Carrier and the routing lab.
// Next reads the ignored .env.local in this app; no other checkout is a dependency.
const app=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const hostname='127.0.0.1',port=8080;
const occupied=await new Promise(resolve=>{
  const socket=net.connect({host:hostname,port});
  const finish=value=>{socket.destroy();resolve(value);};
  socket.once('connect',()=>finish(true));socket.once('error',()=>finish(false));socket.setTimeout(800,()=>finish(false));
});
if(occupied){console.log('Port 8080 is already in use. Reuse the running front; no second build started.');process.exit(0);}
process.chdir(app);
const serverApp=next({dev:true,dir:app,hostname,port});
await serverApp.prepare();
const handler=serverApp.getRequestHandler();
const server=http.createServer((req,res)=>handler(req,res));
server.on('upgrade',(req,socket,head)=>serverApp.getUpgradeHandler()(req,socket,head).catch(()=>socket.destroy()));
server.on('error',()=>{console.error('Local CargoMesh could not bind port 8080. Check the existing listener.');process.exit(1);});
server.listen(port,hostname,()=>console.log('CargoMesh unified front: http://127.0.0.1:8080/'));
// Old bookmarks only redirect. There is no second application or second build.
const legacy=http.createServer((req,res)=>{
  if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(410,{'Cache-Control':'no-store'});res.end();return;}
  const url=new URL(req.url,'http://127.0.0.1:3090');
  res.writeHead(303,{Location:'http://127.0.0.1:8080'+url.pathname+url.search,'Cache-Control':'no-store'});res.end();
});
legacy.on('error',()=>console.error('Legacy 3090 redirect unavailable; use http://127.0.0.1:8080/.'));
legacy.listen(3090,hostname);

/** Native Next request context around the unchanged product Hono router. */
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {localConfig} from './real_auth.mjs';

export async function startCoverageTransport() {
  const {cfg} = localConfig();
  process.env.NEXT_PUBLIC_SUPABASE_URL = cfg.API_URL;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = cfg.ANON_KEY;
  const root = process.env.HAC44_ROOT!;
  const require = createRequire(root + '/cargomesh/package.json');
  require('next/dist/server/node-environment');
  const {NextRequest} = require('next/server');
  const {workAsyncStorage} = require('next/dist/server/app-render/work-async-storage.external');
  const {workUnitAsyncStorage} = require('next/dist/server/app-render/work-unit-async-storage.external');
  const {createRequestStoreForAPI} = require('next/dist/server/async-storage/request-store');
  const {createHonoApp} = await import(pathToFileURL(root + '/cargomesh/src/server/hono/app.ts').href);
  const app = createHonoApp();
  const port = Number(process.env.HAC44_HTTP_PORT);
  assert.ok(Number.isInteger(port) && port >= 1024 && port <= 65535);
  const origin = 'http://127.0.0.1:' + port;
  const server = createServer(async(req,res) => {
    try {
      const chunks = []; for await(const chunk of req) chunks.push(chunk);
      const body = Buffer.concat(chunks);
      const request = new NextRequest(origin + req.url, {method:req.method,headers:req.headers,
        ...(body.length ? {body,duplex:'half'} : {})} as any);
      const url = new URL(request.url);
      const store = createRequestStoreForAPI(request,{pathname:url.pathname,search:url.search},
        {tags:[],expirationsByCacheHandler:new Map()},undefined,undefined);
      const response = await workAsyncStorage.run({route:url.pathname,isStaticGeneration:false},
        () => workUnitAsyncStorage.run(store,() => app.fetch(request)));
      res.writeHead(response.status,Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch { res.writeHead(500); res.end('{"error":{"code":"HARNESS_TRANSPORT_FAILURE"}}'); }
  });
  await new Promise<void>((resolve,reject) => {server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
  return {origin, stop:() => new Promise<void>(resolve => server.close(() => resolve()))};
}

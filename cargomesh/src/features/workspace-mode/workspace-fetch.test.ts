import assert from "node:assert/strict";
import {test} from "node:test";
import {workspaceFetch} from "./workspace-fetch";

async function withBrowser(pathname:string,run:(calls:Array<{input:RequestInfo|URL;init?:RequestInit}>)=>Promise<void>){
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,"window"),originalFetch=globalThis.fetch;
 const calls:Array<{input:RequestInfo|URL;init?:RequestInit}>=[];
 Object.defineProperty(globalThis,"window",{configurable:true,value:{location:{pathname,origin:"http://localhost"}}});
 globalThis.fetch=async(input,init)=>{calls.push({input,init});return Response.json({ok:true});};
 try{await run(calls);}finally{globalThis.fetch=originalFetch;if(descriptor)Object.defineProperty(globalThis,"window",descriptor);else Reflect.deleteProperty(globalThis,"window");}
}
test("demo writes never reach any backend transport",async()=>{
 await withBrowser("/demo/shipper/dashboard",async calls=>{
  for(const input of ["/api/v2/freight/requests",new URL("http://localhost/api/v2/freight/requests"),new Request("http://localhost/api/v2/freight/requests",{method:"POST"})]){
   const response=await workspaceFetch(input,{method:"POST",body:"{}"});assert.equal(response.status,409);assert.equal((await response.json()).error.code,"VISUAL_DEMO_READ_ONLY");
  }
  assert.equal(calls.length,0);
 });
});
test("demo reads from string, URL and Request resolve to the separate demo API",async()=>{
 await withBrowser("/demo/shipper/requests",async calls=>{
  for(const input of ["/api/v2/intake/options",new URL("http://localhost/api/v2/intake/options"),new Request("http://localhost/api/v2/intake/options")])await workspaceFetch(input);
  assert.equal(calls.length,3);
  for(const call of calls){const target=call.input instanceof Request?call.input.url:String(call.input);assert.match(target,/\/api\/demo\/v2\/intake\/options$/);}
 });
});
test("connected writes preserve the real API destination and request options",async()=>{
 await withBrowser("/requests/example",async calls=>{
  const init={method:"POST",body:"{}",credentials:"same-origin" as const};
  await workspaceFetch("/api/v2/freight/requests",init);
  assert.equal(calls.length,1);assert.equal(calls[0].input,"/api/v2/freight/requests");assert.strictEqual(calls[0].init,init);
 });
});

test('explicit local Client preview isolates reads and blocks writes',async()=>{
 const doc=Object.getOwnPropertyDescriptor(globalThis,'document');
 Object.defineProperty(globalThis,'document',{configurable:true,value:{querySelector:()=>({})}});
 try{await withBrowser('/clients/requests',async calls=>{
  Object.assign(window.location,{hostname:'127.0.0.1',port:'8080'});
  await workspaceFetch('/api/v2/intake/options');assert.equal(calls[0].input,'/api/demo/v2/intake/options');
  for(const method of ['POST','PATCH','DELETE'])assert.equal((await workspaceFetch('/api/v2/freight/requests',{method})).status,409);
  assert.equal(calls.length,1);
 });}finally{if(doc)Object.defineProperty(globalThis,'document',doc);else Reflect.deleteProperty(globalThis,'document');}
});

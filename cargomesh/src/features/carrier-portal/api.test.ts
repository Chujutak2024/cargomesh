import assert from "node:assert/strict";
import { test } from "node:test";
import { z } from "zod";
import { portalRequest, PortalApiError, mutationReceipt, portalErrorCopy } from "./api";
import { emptyInput, projectInput, localDateTime, utcDateTime } from "./form-model";
import { parseRecords, carrierCommandPath } from "./records";
import { carrierResources } from "./resources";
const carrier="d199a7a4-6de2-4565-879a-322725010001";
const other="d199a7a4-6de2-4565-879a-322725010002";
const depot=carrierResources.find(r=>r.key==="depots")!;
const record={id:other,organizationId:null,carrierId:carrier,serviceId:null,version:1,createdAt:"2026-10-07T12:00:00Z",updatedAt:"2026-10-07T12:00:00Z",
 value:{schemaVersion:"2.0",code:"D1",name:"Depot",location:{label:"Depot",city:"City",countryCode:"PE",region:null,lat:null,lng:null},active:true,handling:[]}};
const response=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json"}});
test("API keeps same-origin session, skips caches and propagates pagination",async()=>{
 const result=await portalRequest("/api/v2/carriers/"+carrier+"/depots",{},async(path,init)=>{
  assert.equal(path,"/api/v2/carriers/"+carrier+"/depots");assert.equal(init?.credentials,"same-origin");assert.equal(init?.cache,"no-store");
  return response({schemaVersion:"2.0",data:[],meta:{nextOffset:25}});
 });assert.equal(result.meta?.nextOffset,25);
});
test("401, 403 and stale 409 never become fixture success",async()=>{
 for(const status of [401,403,409])await assert.rejects(portalRequest("/api/v2/carriers",{},async()=>response({schemaVersion:"2.0",error:{code:"STALE_DRAFT"}},status)),e=>e instanceof PortalApiError&&e.status===status);
});
test("missing data, wrong schema and non JSON success fail closed",async()=>{
 for(const body of [{schemaVersion:"2.0"},{schemaVersion:"1.0",data:[]}])await assert.rejects(portalRequest("/api/v2/carriers",{},async()=>response(body)),e=>e instanceof PortalApiError&&e.code==="INVALID_RESPONSE");
 await assert.rejects(portalRequest("/api/v2/carriers",{},async()=>new Response("not JSON")),e=>e instanceof PortalApiError&&e.code==="INVALID_RESPONSE");
});
test("external and traversal API paths are rejected before fetch",async()=>{
 let calls=0;for(const path of ["https://example.com","/api/v2/../auth","/api/v1/carriers"])
  await assert.rejects(portalRequest(path,{},async()=>{calls++;return response({});}));assert.equal(calls,0);
});
test("abort stays cancellation; network failure has no fallback",async()=>{
 await assert.rejects(portalRequest("/api/v2/carriers",{},async()=>{throw new DOMException("Cancelled","AbortError");}),e=>e instanceof Error&&e.name==="AbortError");
 await assert.rejects(portalRequest("/api/v2/carriers",{},async()=>{throw new Error("Network");}),e=>e instanceof PortalApiError&&e.status===0);
});
test("retry preserves key only for the same command and payload",()=>{
 let n=0;const uuid=()=>"key-"+(++n);const first=mutationReceipt(null,"/api/v2/carriers",{x:1},uuid);
 assert.strictEqual(mutationReceipt(first,"/api/v2/carriers",{x:1},uuid),first);
 assert.notEqual(mutationReceipt(first,"/api/v2/carriers",{x:2},uuid).key,first.key);
 assert.notEqual(mutationReceipt(first,"/api/v2/carriers/other",{x:1},uuid).key,first.key);
});
test("catalog reads validate payload and reject a different carrier",()=>{
 assert.equal(parseRecords(depot,[record],carrier)[0].id,other);
 assert.throws(()=>parseRecords(depot,[{...record,carrierId:other}],carrier),PortalApiError);
 assert.throws(()=>parseRecords(depot,[{...record,value:{...record.value,active:"true"}}],carrier),PortalApiError);
});
test("incident update uses the native carrier incident endpoint",()=>{
 const incidents=carrierResources.find(r=>r.key==="incidents")!;
 assert.equal(carrierCommandPath(carrier,incidents,other,"execution","updates"),"/api/v2/carriers/"+carrier+"/incidents/"+other+"/updates");
});
test("optional absence stays undefined; derived output is excluded from revisions",()=>{
 const schema=z.object({schemaVersion:z.literal("2.0"),name:z.string(),extra:z.string().optional()}).strict();
 assert.deepEqual(emptyInput(schema),{schemaVersion:"2.0",name:"",extra:undefined});
 assert.deepEqual(projectInput(schema,{schemaVersion:"2.0",name:"Carrier",computed:400}),{schemaVersion:"2.0",name:"Carrier",extra:undefined});
});
test("error copy does not leak endpoint, database or secret detail",()=>{
 const error=new PortalApiError(500,"secret endpoint database");assert.doesNotMatch(portalErrorCopy(error,true),/secret|endpoint|database/);
 assert.match(portalErrorCopy(new PortalApiError(403,"FORBIDDEN"),false),/cannot access/);
 assert.match(portalErrorCopy(new PortalApiError(409,"STALE_DRAFT"),true),/Actualiza/);
});
test("nullable defaults and effect wrappers keep contract defaults",()=>{
 assert.equal(emptyInput(z.string().nullable().default(null)),null);
 assert.equal(emptyInput(z.string().nullable().refine(()=>true)),null);
 assert.equal(emptyInput(z.literal("MANUAL").default("MANUAL")),"MANUAL");
});
test("date control round trip preserves instant in the local timezone",()=>{
 const control=localDateTime("2026-10-07T15:20:00Z");
 assert.equal(utcDateTime(control),"2026-10-07T15:20:00.000Z");
 assert.equal(localDateTime(null),"");assert.equal(utcDateTime("not a date"),"");
});

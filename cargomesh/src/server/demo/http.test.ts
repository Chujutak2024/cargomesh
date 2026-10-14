import assert from "node:assert/strict";
import {test} from "node:test";
import {demoResponse} from "./http";

test("demo is disabled by default even for reads and writes",async()=>{
 const original=process.env.CM_ENABLE_DEMO;delete process.env.CM_ENABLE_DEMO;
 try{for(const method of ["GET","POST"]){const response=await demoResponse(new Request("http://localhost/api/demo/v2/intake/options",{method}));assert.equal(response.status,404);assert.equal((await response.json()).error.code,"DEMO_DISABLED");}}
 finally{if(original===undefined)delete process.env.CM_ENABLE_DEMO;else process.env.CM_ENABLE_DEMO=original;}
});
test("enabled demo never accepts a mutation",async()=>{
 const original=process.env.CM_ENABLE_DEMO;process.env.CM_ENABLE_DEMO="1";
 try{for(const method of ["POST","PATCH","PUT","DELETE"]){const response=await demoResponse(new Request("http://localhost/api/demo/v2/freight/requests",{method}));assert.equal(response.status,409);assert.equal((await response.json()).error.code,"VISUAL_DEMO_READ_ONLY");}}
 finally{if(original===undefined)delete process.env.CM_ENABLE_DEMO;else process.env.CM_ENABLE_DEMO=original;}
});
test("only declared fixture reads succeed, without forwarding unknown data",async()=>{
 const original=process.env.CM_ENABLE_DEMO;process.env.CM_ENABLE_DEMO="1";
 try{
  const fixture=await demoResponse(new Request("http://localhost/api/demo/v2/freight/requests/10000000-0000-4000-8000-000000000400"));assert.equal(fixture.status,200);assert.equal((await fixture.json()).data.referenceCode,"DEMO-0001");
  const absent=await demoResponse(new Request("http://localhost/api/demo/v2/carriers/secret"));assert.equal(absent.status,404);
 }finally{if(original===undefined)delete process.env.CM_ENABLE_DEMO;else process.env.CM_ENABLE_DEMO=original;}
});

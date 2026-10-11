import assert from "node:assert/strict";
import { test } from "node:test";
import { createLocalTruck3dHandler } from "./local-handler";
import { isPublicModelAddress } from "./download-model";

const photo=`data:image/jpeg;base64,${Buffer.from([255,216,...Array(150).fill(0)]).toString("base64")}`;
const key="d24de4f1-51aa-4a1c-9e5a-9cf73dc35a09";
function request(path="",method="GET",body?:unknown,id=key,host="127.0.0.1:8080") {
  return new Request(`http://${host}/api/local/truck-3d${path}`,{method,headers:{host,origin:`http://${host}`,"Content-Type":"application/json","Idempotency-Key":id},body:body?JSON.stringify(body):undefined});
}
test("unconfigured generation and hosted origins make no provider calls",async()=>{
  let calls=0;const handler=createLocalTruck3dHandler({enabled:false,apiKey:"secret",fetcher:async()=>{calls++;throw new Error("unused");}});
  assert.deepEqual(await(await handler(request())).json(),{available:false,provider:null});
  assert.equal((await handler(request("","POST",{photoDataUrl:photo,consent:true}))).status,503);
  assert.equal((await handler(request("","GET",undefined,key,"demo.vercel.app"))).status,404);
  assert.equal(calls,0);
});
test("only consented photo creation is billed once; signed task controls status/download",async()=>{
  let calls=0,downloads=0;
  const handler=createLocalTruck3dHandler({enabled:true,apiKey:"private-test-key",fetcher:async(input,init)=>{
    calls++;assert.equal(new Headers(init?.headers).get("Authorization"),"Bearer private-test-key");
    const path=String(input);const data=path.endsWith("/files")?{file_token:"file-123"}:path.endsWith("/image-to-model")?{task_id:"task-123"}:{status:"success",output:{model_url:"https://assets.tripo3d.ai/result.glb"}};
    return Response.json({code:0,data});
  },downloader:async url=>{downloads++;assert.equal(url,"https://assets.tripo3d.ai/result.glb");return new Blob(["MODEL"]);}});
  assert.equal((await handler(request("","POST",{photoDataUrl:photo,consent:false}))).status,400);
  assert.equal(calls,0);
  const result=await handler(request("","POST",{photoDataUrl:photo,consent:true}));assert.equal(result.status,202);
  const data=await result.json();const repeated=await handler(request("","POST",{photoDataUrl:photo,consent:true}));
  assert.deepEqual(await repeated.json(),data);assert.equal(calls,2,"Do not repeat billed generation");
  const ready=await(await handler(request(`?task=${encodeURIComponent(data.token)}`))).json();
  assert.deepEqual(ready,{state:"ready",progress:100});assert.ok(!JSON.stringify(ready).includes("model_url"));
  assert.equal((await handler(request(`?task=${encodeURIComponent(`${data.token}changed`)}`))).status,502);
  assert.equal((await handler(request(`?task=${encodeURIComponent(data.token)}&asset=1`))).status,200);assert.equal(downloads,1);
});
test("ambiguous generation failures are retained and not automatically submitted again",async()=>{
  let calls=0;const handler=createLocalTruck3dHandler({enabled:true,apiKey:"key",fetcher:async()=>{calls++;throw new Error("timeout with private provider details");}});
  const body={photoDataUrl:photo,consent:true};
  assert.deepEqual(await(await handler(request("","POST",body))).json(),{error:"SUBMISSION_UNKNOWN"});
  assert.deepEqual(await(await handler(request("","POST",body))).json(),{error:"SUBMISSION_UNKNOWN"});assert.equal(calls,1);
});
test("model downloads cannot resolve private, loopback, reserved or multicast addresses",()=>{
  for(const value of ["127.0.0.1","10.0.1.1","192.168.1.2","169.254.169.254","100.64.0.1","172.16.0.1","198.18.0.1","203.0.113.1","224.0.0.1","::1","bad"]){assert.equal(isPublicModelAddress(value),false);}
  assert.equal(isPublicModelAddress("8.8.8.8"),true);
});

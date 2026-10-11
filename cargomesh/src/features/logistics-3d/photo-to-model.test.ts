import assert from "node:assert/strict";
import { test } from "node:test";
import { hasPendingTruckGeneration, photoToTruckModel } from "./photo-to-model";

test("a interrupted generation resumes its saved task without creating another paid job",async()=>{
  const originalFetch=globalThis.fetch,originalStorage=globalThis.localStorage,records=new Map<string,string>();
  Object.defineProperty(globalThis,"localStorage",{configurable:true,value:{getItem:(key:string)=>records.get(key)??null,setItem:(key:string,value:string)=>records.set(key,value),removeItem:(key:string)=>records.delete(key)}});
  let posts=0,interrupt=true;
  globalThis.fetch=async(input,init)=>{
    if(init?.method==="POST"){posts++;return Response.json({token:"signed-task",state:"processing"},{status:202});}
    if(interrupt)throw new Error("connection lost");
    return String(input).includes("asset=1")?new Response("MODEL"):Response.json({state:"ready",progress:100});
  };
  try{
    await assert.rejects(()=>photoToTruckModel("photo-a","request-7",new AbortController().signal,()=>{}));
    assert.equal(await hasPendingTruckGeneration("photo-a","request-7"),true);
    assert.equal(await hasPendingTruckGeneration("photo-b","request-7"),false);
    assert.equal(await hasPendingTruckGeneration("photo-a","request-6"),false);
    interrupt=false;
    const model=await photoToTruckModel("photo-a","request-7",new AbortController().signal,()=>{});
    assert.equal(await model.text(),"MODEL");assert.equal(posts,1);
  }finally{globalThis.fetch=originalFetch;Object.defineProperty(globalThis,"localStorage",{configurable:true,value:originalStorage});}
});
test("an ambiguous submission cannot be replayed and no photo bytes are persisted",async()=>{
  const originalFetch=globalThis.fetch,originalStorage=globalThis.localStorage,records=new Map<string,string>();
  Object.defineProperty(globalThis,"localStorage",{configurable:true,value:{getItem:(key:string)=>records.get(key)??null,setItem:(key:string,value:string)=>records.set(key,value),removeItem:(key:string)=>records.delete(key)}});
  let posts=0;globalThis.fetch=async()=>{posts++;throw new Error("unknown submission");};
  try{
    await assert.rejects(()=>photoToTruckModel("private-photo-binary-data","request-7",new AbortController().signal,()=>{}));
    await assert.rejects(()=>photoToTruckModel("private-photo-binary-data","request-7",new AbortController().signal,()=>{}),/SUBMISSION_UNKNOWN/);
    assert.equal(posts,1);assert.ok(!JSON.stringify([...records.values()]).includes("private-photo-binary-data"));
  }finally{globalThis.fetch=originalFetch;Object.defineProperty(globalThis,"localStorage",{configurable:true,value:originalStorage});}
});

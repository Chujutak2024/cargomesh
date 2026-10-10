import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { Box3, Vector3 } from "three";
import { inspectTruckGlb, maxTruckModelBytes } from "./truck-glb";
import { disposeTruckAsset, loadTruckGlb } from "./load-truck-glb";
import { LocalDraftSchema } from "../carrier-portal/local-draft-model";
import { readTruckPreference } from "../carrier-portal/local-truck-preference";

function fixture(change: Record<string, unknown> = {}) {
  const json = new TextEncoder().encode(JSON.stringify({ asset: { version: "2.0" }, buffers: [{ byteLength: 36 }],
    accessors: [{ count: 3 }], meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }], ...change }));
  const length = Math.ceil(json.byteLength / 4) * 4, data = new ArrayBuffer(12 + 8 + length + 8 + 36), view = new DataView(data);
  view.setUint32(0,0x46546c67,true);view.setUint32(4,2,true);view.setUint32(8,data.byteLength,true);
  view.setUint32(12,length,true);view.setUint32(16,0x4e4f534a,true);
  new Uint8Array(data,20,length).fill(32);new Uint8Array(data,20,json.length).set(json);
  view.setUint32(20+length,36,true);view.setUint32(24+length,0x004e4942,true);
  return data;
}
test("GLB import rejects external files, SVG, excessive geometry and corrupt headers",()=>{
  assert.equal(inspectTruckGlb(fixture()).triangles,1);
  for(const change of [{buffers:[{byteLength:36,uri:"https://example.com/private.bin"}]},
    {images:[{uri:"textures/a.png"}]},{images:[{uri:"data:image/svg+xml;base64,AAAA"}]},
    {accessors:[{count:900000}]},{nodes:Array.from({length:65},()=>({mesh:0}))},{extensionsRequired:["KHR_draco_mesh_compression"]},
    {meshes:[{primitives:[{attributes:{POSITION:0},mode:1}]}]}]) assert.throws(()=>inspectTruckGlb(fixture(change)));
  const corrupt=fixture();new DataView(corrupt).setUint32(8,16,true);assert.throws(()=>inspectTruckGlb(corrupt));
  assert.throws(()=>inspectTruckGlb(new ArrayBuffer(maxTruckModelBytes+1)));
});
test("actual exported truck GLB loads, normalizes bounds and disposes GPU resources",async()=>{
  const bytes=await readFile("public/v2-workspace/cargomesh-truck.glb");
  const model=await loadTruckGlb(Uint8Array.from(bytes).buffer),bounds=new Box3().setFromObject(model),size=bounds.getSize(new Vector3());
  assert.ok(size.x<=7.201&&size.y<=2.701&&size.z<=2.701);assert.ok(Math.abs(bounds.min.y)<.001);
  assert.equal(model.userData.source,"custom-glb");let disposed=0;
  model.traverse(node=>{if("geometry" in node)(node.geometry as {addEventListener:(name:string,callback:()=>void)=>void}).addEventListener("dispose",()=>disposed++);});
  disposeTruckAsset(model);assert.ok(disposed>0);
});
test("old preferences stay compatible and a model reference survives a draft roundtrip",()=>{
  const old={type:"custom" as const,model:"Mi Volvo",photoDataUrl:null};assert.deepEqual(readTruckPreference(old),old);
  const modelAssetId="d24de4f1-51aa-4a1c-9e5a-9cf73dc35a09";
  const fields={originId:"callao",destinationId:"piura",cargoDescription:"Maquinaria",quantity:10,unitWeightKg:800,
    pickupDate:"2026-07-12",deliveryDate:"2026-09-12",completedStep:1,savedForReview:false,truckPreference:{...old,modelAssetId}};
  const parsed=LocalDraftSchema.parse(JSON.parse(JSON.stringify(fields)));assert.deepEqual(parsed,fields);
  assert.equal(readTruckPreference({...old,modelAssetId:"https://bad.test/model.glb"})?.modelAssetId,undefined);
});

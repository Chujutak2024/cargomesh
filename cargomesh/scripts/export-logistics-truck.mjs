// Reproducible original project asset. Run: node --import tsx scripts/export-logistics-truck.mjs
import fs from "node:fs/promises";
import path from "node:path";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { buildCargoMeshTruck, disposeCargoMeshTruck } from "../src/features/logistics-3d/truck-model.ts";

// Three's exporter uses the browser FileReader for buffers. No remote asset or texture is loaded.
globalThis.FileReader=class {
  readAsArrayBuffer(blob){blob.arrayBuffer().then(result=>{this.result=result;this.onloadend?.();});}
  readAsDataURL(blob){blob.arrayBuffer().then(result=>{this.result=`data:${blob.type};base64,${Buffer.from(result).toString("base64")}`;this.onloadend?.();});}
};
const truck=buildCargoMeshTruck();
let triangles=0,vertices=0,meshes=0;
truck.traverse(child=>{if(child.isMesh){meshes++;vertices+=child.geometry.attributes.position.count;triangles+=(child.geometry.index?.count??child.geometry.attributes.position.count)/3;}});
const buffer=await new GLTFExporter().parseAsync(truck,{binary:true});
const target=path.resolve("public/v2-workspace/cargomesh-truck.glb");
await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,Buffer.from(buffer));
const stats={author:"CargoMesh local project",source:"src/features/logistics-3d/truck-model.ts",license:"Original project asset; no external model",format:"glTF 2 binary",bytes:buffer.byteLength,triangles,vertices,materials:meshes,meshes,componentCount:truck.userData.componentCount,textures:0,animatedWheels:false};
await fs.writeFile(path.resolve("public/v2-workspace/cargomesh-truck.meta.json"),JSON.stringify(stats,null,2)+"\n");
disposeCargoMeshTruck(truck);console.log(JSON.stringify(stats));

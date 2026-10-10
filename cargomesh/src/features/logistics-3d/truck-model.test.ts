import assert from "node:assert/strict";
import {test} from "node:test";
import {Box3, MeshPhysicalMaterial, Raycaster, Vector3, type Mesh} from "three";
import {buildCargoMeshTruck,disposeCargoMeshTruck,setTruckCargoAccess} from "./truck-model";
import {truckVisualTypes} from "./truck-model";

test("original logistics model has finite 3D volume and fits its UI budget",()=>{
 const model=buildCargoMeshTruck();let triangles=0,meshes=0;
 model.traverse(node=>{const mesh=node as Mesh;if(!mesh.isMesh)return;meshes++;const geometry=mesh.geometry;
  triangles+=(geometry.index?.count??geometry.attributes.position.count)/3;
  for(const value of geometry.attributes.position.array)assert.ok(Number.isFinite(value));
 });
 const box=new Box3().setFromObject(model);
 assert.ok(box.max.x-box.min.x>6);assert.ok(box.max.y-box.min.y>2);assert.ok(box.max.z-box.min.z>1);
 assert.ok(triangles>1000&&triangles<50000);assert.ok(meshes<=12);
 assert.equal(model.userData.decorative,true);assert.equal(model.userData.animatedWheels,undefined);
 disposeCargoMeshTruck(model);
});
test("depot cargo access is opt-in and opens real hinged doors without altering catalog previews",()=>{
 const regular=buildCargoMeshTruck("rigid"),loading=buildCargoMeshTruck("rigid",{cargoAccess:true});
 assert.equal(regular.children.some(node=>node.name.startsWith("Cargo door")),false);
 const doors=loading.children.filter(node=>node.name.startsWith("Cargo door"));assert.equal(doors.length,2);
 setTruckCargoAccess(loading,1);assert.ok(doors[0].rotation.y>2);assert.ok(doors[1].rotation.y< -2);
 setTruckCargoAccess(loading,0);assert.ok(doors.every(door=>door.rotation.y===0));
 disposeCargoMeshTruck(regular);disposeCargoMeshTruck(loading);
});

test("owned geometry and material GPU resources are released on disposal",()=>{
 const model=buildCargoMeshTruck();let geometryDisposals=0,materialDisposals=0;
 model.traverse(node=>{const mesh=node as Mesh;if(!mesh.isMesh)return;mesh.geometry.addEventListener("dispose",()=>geometryDisposals++);
  const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];materials.forEach(material=>material.addEventListener("dispose",()=>materialDisposals++));
 });
 disposeCargoMeshTruck(model);assert.ok(geometryDisposals>0);assert.equal(materialDisposals,geometryDisposals);
});

test("catalog equipment has distinct finite geometry within the thumbnail render budget",()=>{
 const signatures=new Set<string>();
 for(const variant of truckVisualTypes){
  const model=buildCargoMeshTruck(variant);let triangles=0,meshes=0;
  model.traverse(node=>{const mesh=node as Mesh;if(!mesh.isMesh)return;meshes++;
   triangles+=(mesh.geometry.index?.count??mesh.geometry.attributes.position.count)/3;
   for(const value of mesh.geometry.attributes.position.array)assert.ok(Number.isFinite(value));
  });
  const bounds=new Box3().setFromObject(model);
  assert.ok(bounds.max.x>bounds.min.x&&bounds.max.y>bounds.min.y&&bounds.max.z>bounds.min.z);
  assert.ok(triangles>1000&&triangles<50000);assert.ok(meshes<=12);
  assert.equal(model.userData.variant,variant);assert.equal(model.userData.decorative,true);
  signatures.add(`${triangles}:${bounds.max.x-bounds.min.x}:${bounds.max.y-bounds.min.y}`);
  disposeCargoMeshTruck(model);
 }
 assert.equal(signatures.size,10,"The catalog must not show the same truck for different bodies");
});

test("every catalog chassis bridges the former gap behind the cab",()=>{
 for(const variant of truckVisualTypes){
  const model=buildCargoMeshTruck(variant);
  const frame=model.children.find(child=>child.name==="dark") as Mesh;
  const position=frame.geometry.attributes.position, index=frame.geometry.index!;
  for(const section of [-1.48,-1.3,-1.08]){
   let bridge=false;
   for(let i=0;i<index.count;i+=3){
    const vertices=[index.getX(i),index.getX(i+1),index.getX(i+2)];
    const xs=vertices.map(v=>position.getX(v)), ys=vertices.map(v=>position.getY(v));
    if(Math.min(...xs)<=section&&Math.max(...xs)>=section&&Math.min(...ys)>=.65&&Math.max(...ys)<=.87){bridge=true;break;}
   }
   assert.ok(bridge,`${variant}: chassis must remain joined at x=${section}`);
  }
  disposeCargoMeshTruck(model);
 }
});

test("catalog windows have symmetric apertures, visible cabin interiors and no paint covering the glass",()=>{
 for(const variant of truckVisualTypes){
  const model=buildCargoMeshTruck(variant);model.updateMatrixWorld(true);
  const glass=model.children.find(child=>child.name==="glass") as Mesh;
  const paint=model.children.find(child=>child.name==="paint") as Mesh;
  const interior=model.children.find(child=>child.name==="interior") as Mesh;
  const material=glass.material as MeshPhysicalMaterial;
  assert.ok(material.transparent&&material.opacity>.4&&material.opacity<.8);
  const bounds=new Box3().setFromObject(glass);
  assert.ok(Math.abs(bounds.min.z+bounds.max.z)<.001,`${variant}: window placement must match on both sides`);
  for(const side of [-1,1]){
   const ray=new Raycaster(new Vector3(-2.63+model.position.x,1.7,side*2),new Vector3(0,0,-side));
   const windowHits=ray.intersectObject(glass),cabHits=ray.intersectObject(interior),paintHits=ray.intersectObject(paint);
   assert.ok(windowHits.length&&cabHits.length,`${variant}: side glass must expose a seat inside the cab`);
   assert.ok(windowHits[0].distance<cabHits[0].distance);
   assert.ok(!paintHits.length||paintHits[0].distance>cabHits[0].distance,`${variant}: paint must not block the side aperture`);
  }
  const front=new Raycaster(new Vector3(-5+model.position.x,1.907,0),new Vector3(1,0,0));
  const windHits=front.intersectObject(glass),frontPaint=front.intersectObject(paint);
  assert.ok(windHits.length,`${variant}: front windshield must be visible`);
  assert.ok(!frontPaint.length||frontPaint[0].distance>windHits[0].distance+.4,`${variant}: solid cab must not hide the windshield`);
  for(const mesh of [glass,interior])assert.ok(Array.from(mesh.geometry.attributes.wheelMask.array).every(value=>value===0));
  disposeCargoMeshTruck(model);
 }
});

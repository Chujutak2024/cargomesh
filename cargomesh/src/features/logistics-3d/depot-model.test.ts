import { test } from "node:test";
import assert from "node:assert/strict";
import { Box3, Mesh, Raycaster, Vector3 } from "three";
import { buildDepot, disposeDepot } from "./depot-model";
import { DEPOT_CYCLE_SECONDS, depotCyclePose as arrivalPose, loadingVehiclePose } from "./depot-cycle";
import { buildDepotActors, animateDepotActors } from "./depot-actors";

test("complete cycle stops at access and dock, loads before release and leaves through the exit", () => {
  const checkA=arrivalPose(6.1),checkB=arrivalPose(8.8);
  assert.equal(checkA.phase,"check");assert.equal(checkA.position.distanceTo(checkB.position),0);
  assert.ok(checkA.position.x < -9);assert.ok(checkB.gate>.9);
  const before=arrivalPose(18),after=arrivalPose(25.9),docked=arrivalPose(26),finished=arrivalPose(DEPOT_CYCLE_SECONDS);
  assert.equal(before.yaw,after.yaw);assert.ok(after.position.z<before.position.z);
  assert.equal(finished.phase,"complete");assert.equal(finished.progress,1);assert.equal(finished.loaded,3);
  assert.deepEqual(finished,arrivalPose(999));assert.equal(finished.position.x,18);
  assert.ok(Math.abs(docked.position.z-3.7)<1e-6);assert.equal(arrivalPose(50).position.distanceTo(docked.position),0);
  assert.equal(arrivalPose(35).loaded,0);assert.equal(arrivalPose(57).loaded,3);assert.equal(arrivalPose(62).doors,0);
  assert.equal(arrivalPose(64).phase,"depart");assert.ok(arrivalPose(65).exitGate>.9);
  // The front of the longest catalog truck stays inside the paved road edge.
  for(let t=0;t<=72;t+=.1)assert.ok(arrivalPose(t).position.z<10);
  assert.ok(Math.abs(arrivalPose(26,true).position.z-2.77)<1e-6);
});

test("warehouse facade closes the spaces between dock openings",()=>{
  const depot=buildDepot();depot.root.updateMatrixWorld(true);
  for(const x of [-2.5,1,5,8.5]){
    const hits=new Raycaster(new Vector3(x,2.1,4),new Vector3(0,0,-1)).intersectObject(depot.root,true);
    assert.ok(hits.length);assert.ok(Math.abs(hits[0].point.z-1.12)<.05);
  }
  disposeDepot(depot.root);
});
test("logging departure retains full-length stacked timber throughout release and exit",()=>{
  const actors=buildDepotActors("logging");
  for(const time of [57,62,68,72]){animateDepotActors(actors,arrivalPose(time));assert.equal(actors.loaded.filter(item=>item.visible).length,3);}
  const size=new Box3().setFromObject(actors.payload).getSize(new Vector3());assert.ok(size.x>4.5&&size.x<4.8);assert.ok(size.z>1.2);assert.ok(size.y>.9);
  animateDepotActors(actors,arrivalPose(0));assert.equal(actors.loaded.filter(item=>item.visible).length,0);
  actors.root.add(actors.payload);disposeDepot(actors.root);
});
test("path is continuous, finite and independent of wall clock or frame rate", () => {
  let previous=arrivalPose(0);
  for(let t=.01;t<=DEPOT_CYCLE_SECONDS;t+=.01){const pose=arrivalPose(t);assert.ok([pose.position.x,pose.position.y,pose.position.z,pose.yaw,pose.wheelDistance,pose.gate].every(Number.isFinite));assert.ok(pose.position.distanceTo(previous.position)<.1);assert.ok(pose.progress>=previous.progress);assert.ok(pose.gate>=0&&pose.gate<=1);previous=pose;}
  assert.equal(arrivalPose(-9).progress,0);
});
test("depot has removable roof and animated parts, bounded geometry and disposable resources", () => {
  const depot=buildDepot("#ca5149");let triangles=0,meshes=0,disposed=0;
  depot.root.traverse(node=>{if(node instanceof Mesh){meshes++;const geometry=node.geometry;triangles+=(geometry.index?.count??geometry.attributes.position.count)/3;for(const n of geometry.attributes.position.array)assert.ok(Number.isFinite(n));geometry.addEventListener("dispose",()=>disposed++);}});
  assert.ok(depot.root.children.includes(depot.roof));assert.ok(depot.roof.children.length>0);assert.ok(depot.barrier.children.length>0);assert.ok(depot.exitBarrier.children.length>0);assert.equal(depot.shutters.length,3);
  assert.ok(meshes<30);assert.ok(triangles<25000);disposeDepot(depot.root);assert.equal(disposed,meshes);
});
test("loading equipment completes three deliveries and deterministic seeking restores crew and cargo",()=>{
  const actors=buildDepotActors("articulated");
  for(const t of [36.3,43.3,50.3]){const pose=arrivalPose(t);assert.equal(loadingVehiclePose(pose).carrying,true);animateDepotActors(actors,pose);assert.equal(actors.carried.visible,true);}
  animateDepotActors(actors,arrivalPose(57));assert.equal(actors.loaded.filter(load=>load.visible).length,3);assert.equal(actors.carried.visible,false);
  animateDepotActors(actors,arrivalPose(5));assert.equal(actors.loaded.filter(load=>load.visible).length,0);assert.equal(actors.crew.length,4);
  let triangles=0,meshes=0;actors.root.add(actors.payload);actors.root.traverse(node=>{if(node instanceof Mesh){meshes++;triangles+=(node.geometry.index?.count??node.geometry.attributes.position.count)/3;for(const v of node.geometry.attributes.position.array)assert.ok(Number.isFinite(v));}});assert.ok(meshes<160);assert.ok(triangles<35000);disposeDepot(actors.root);
  const mixer=buildDepotActors("mixer");animateDepotActors(mixer,arrivalPose(40,true));assert.equal(mixer.bulk.visible,true);assert.equal(mixer.grains.visible,true);assert.equal(mixer.loaded.filter(load=>load.visible).length,0);mixer.root.add(mixer.payload);disposeDepot(mixer.root);
});

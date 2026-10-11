"use client";
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { TruckEnvironment } from "./truck-environment";

const colors = { bark:"#705037", leaf:"#397e4b", lightLeaf:"#76a550", pine:"#296d59", grass:"#88ad56", flower:"#f7cf64",
  rock:"#acaa91", wall:"#eee0c2", roof:"#257f89", container:"#b6533f", metal:"#a9bac0", sign:"#087b75", window:"#294958" };
type MaterialName = keyof typeof colors;

/** Merged original scenery: two repeating sections, one draw call per material per section. */
function buildLandscape() {
  const parts = new Map<MaterialName, THREE.BufferGeometry[]>();
  const put=(geometry:THREE.BufferGeometry,color:MaterialName,position:number[],rotation:number[]=[0,0,0],scale:number[]=[1,1,1])=>{
    const matrix=new THREE.Matrix4().compose(new THREE.Vector3(...position),new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)),new THREE.Vector3(...scale));
    const plain=geometry.index?geometry.toNonIndexed():geometry; if(plain!==geometry)geometry.dispose(); plain.applyMatrix4(matrix);
    const bucket=parts.get(color)??[];bucket.push(plain);parts.set(color,bucket);
  };
  const box=(size:number[],at:number[],color:MaterialName,rotation:number[]=[0,0,0])=>put(new THREE.BoxGeometry(...size),color,at,rotation);
  for(let i=0;i<24;i++) {
    const x=2+i*3.25,z=i%2===0?-10-i%4*1.7:8+i%5*1.2,height=2.1+i%4*.36;
    put(new THREE.CylinderGeometry(.09,.16,height,7),"bark",[x,height/2,z]);
    if(i%3===0) {
      for(let tier=0;tier<3;tier++)put(new THREE.ConeGeometry(1.02-tier*.19,1.8,9),"pine",[x,height+.2+tier*.6,z]);
    } else {
      for(let crown=0;crown<4;crown++)put(new THREE.SphereGeometry(.8,12,9),crown===1?"lightLeaf":"leaf",[x+Math.cos(crown*2.3)*.48,height+.45+crown*.24,z+Math.sin(crown*2.3)*.42],[0,crown*.7,0],[1,1.13,1]);
    }
  }
  for(let i=0;i<90;i++) {
    const x=i*80/90,z=i%2===0?-7.4-i%6*.54:3.1+i%7*.47;
    put(new THREE.IcosahedronGeometry(.24+i%3*.07,1),i%3===0?"rock":i%2?"lightLeaf":"grass",[x,.10,z],[0,i,0],[1,.57,1.3]);
    for(let blade=0;blade<3;blade++)put(new THREE.ConeGeometry(.08,.4,3),"grass",[x+.15*blade,.18,z+.16*blade],[0,blade,Math.sin(i)*.1]);
    if(i%4===0)for(let petal=0;petal<3;petal++)put(new THREE.IcosahedronGeometry(.055,0),"flower",[x+petal*.12,.43,z+petal*.1]);
  }
  // Roadside direction sign and striped delineators.
  for(const x of [8,48]) {
    for(const side of [-.9,.9])box([.065,2.5,.065],[x+side,1.25,-7.7],"metal");
    box([2.4,.85,.09],[x,2.22,-7.7],"sign");
    box([1.05,.045,.018],[x-.27,2.37,-7.641],"wall");box([.66,.035,.018],[x-.46,2.14,-7.641],"wall");
    box([.33,.045,.022],[x+.79,2.28,-7.64],"wall",[0,0,.65]);box([.33,.045,.022],[x+.79,2.08,-7.64],"wall",[0,0,-.65]);
  }
  for(let i=0;i<32;i++) {
    const x=i*2.5;
    box([.13,.7,.15],[x,.35,2.56],"wall");box([.14,.17,.16],[x,.52,2.56],"container");
  }
  // Logistics center, loading docks, containers and warm-lit windows beyond the verge.
  box([13,3.8,5],[29,1.9,-24],"wall");box([13.5,.2,5.6],[29,3.9,-24],"roof");
  box([13,.48,.13],[29,3.15,-21.42],"roof");
  for(let dock=0;dock<5;dock++) {
    box([1.7,2.3,.12],[24+dock*2.5,1.15,-21.41],"window");
    box([1.94,.09,.23],[24+dock*2.5,2.4,-21.3],"metal");
    box([.95,.36,.06],[24+dock*2.5,2.77,-21.31],"window");
    box([.14,.55,.16],[23.05+dock*2.5,.27,-21.1],"flower");
  }
  for(let i=0;i<3;i++) {
    box([3.8,1.48,1.6],[39+i*4.2,.75,-21.8],i%2?"roof":"container");
    for(let rib=0;rib<12;rib++)box([.045,1.35,.035],[37.3+i*4.2+rib*.3,.78,-20.98],"metal");
  }
  box([4,2.4,3],[60,1.2,15],"wall");box([4.6,.23,3.6],[60,2.5,15],"roof");
  for(const x of [59,61])box([.7,.8,.05],[x,1.55,13.47],"window");
  const group=new THREE.Group();
  for(const [name,geometries] of parts) {
    const geometry=mergeGeometries(geometries);geometries.forEach(value=>value.dispose());
    if(!geometry)throw new Error("Landscape geometry could not be combined");
    const material=new THREE.MeshStandardMaterial({color:colors[name],roughness:name==="metal"?.5:.94,metalness:name==="metal"?.45:0});
    if(name==="window")material.emissive.set("#ffc476");
    const mesh=new THREE.Mesh(geometry,material);mesh.name=name;mesh.receiveShadow=true;group.add(mesh);
  }
  return group;
}

export function RoadLandscape({environment,moving}:{environment:TruckEnvironment;moving:boolean}) {
  const landscape=useMemo(buildLandscape,[]),copy=useMemo(()=>landscape.clone(),[landscape]);
  const distance=useRef(0);
  useEffect(()=>{landscape.traverse(child=>{if(child instanceof THREE.Mesh){
    child.material.color.set(colors[child.name as MaterialName]).multiplyScalar(1-environment.night*.48);
    if(child.name==="window")child.material.emissiveIntensity=environment.night*1.7;
  }});},[landscape,environment.night]);
  useEffect(()=>()=>{landscape.traverse(child=>{if(child instanceof THREE.Mesh){child.geometry.dispose();child.material.dispose();}});},[landscape]);
  useFrame((_,delta)=>{
    if(moving)distance.current+=Math.min(delta,.1)*1.1;
    const offset=distance.current%80;landscape.position.x=offset-80;copy.position.x=offset;
  });
  return <><primitive object={landscape}/><primitive object={copy}/></>;
}

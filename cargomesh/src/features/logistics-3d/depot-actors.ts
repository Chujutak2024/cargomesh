import { BoxGeometry, BufferGeometry, CanvasTexture, CapsuleGeometry, CylinderGeometry, Euler, Group, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, Object3D, Quaternion, SphereGeometry, SRGBColorSpace, TubeGeometry, CatmullRomCurve3, Vector3 } from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { TruckVisualType } from "./truck-model";
import { clamp01, ease, loadingVehiclePose, type DepotPose } from "./depot-cycle";

const palette = { navy:"#233f52", vest:"#efa82e", tape:"#ebf2dd", skin:"#bc8465", helmet:"#fff3c5", boots:"#24303a", steel:"#91a5b0", tyre:"#26323b", amber:"#e8ac35", timber:"#ac815b", carton:"#ceac7e", teal:"#138d88", red:"#c55143", glass:"#55a7bc", grain:"#d5b783" };
type Ink = keyof typeof palette;
/** Merge static pieces per articulated part; limbs remain independent for posing. */
class Builder {
  private pools = new Map<Group,Map<Ink,BufferGeometry[]>>();
  add(parent:Group, ink:Ink, geometry:BufferGeometry, position:number[], rotation:number[]=[0,0,0]) {
    const transformed=geometry.index?geometry.toNonIndexed():geometry.clone();geometry.dispose();
    transformed.applyMatrix4(new Matrix4().compose(new Vector3(...position),new Quaternion().setFromEuler(new Euler(...rotation)),new Vector3(1,1,1)));
    const pool=this.pools.get(parent)??new Map<Ink,BufferGeometry[]>(),pieces=pool.get(ink)??[];pieces.push(transformed);pool.set(ink,pieces);this.pools.set(parent,pool);
  }
  box(parent:Group,ink:Ink,size:number[],position:number[],rotation:number[]=[0,0,0]){this.add(parent,ink,new BoxGeometry(...size),position,rotation);}
  finish(){const materials=new Map<Ink,MeshStandardMaterial>();for(const [parent,pool] of this.pools)for(const [ink,pieces] of pool){const geometry=mergeGeometries(pieces);pieces.forEach(piece=>piece.dispose());if(!geometry)throw new Error("ACTOR_GEOMETRY");let material=materials.get(ink);if(!material){material=new MeshStandardMaterial({color:palette[ink],roughness:ink==="steel"?.32:.75,metalness:ink==="steel"?.65:0});materials.set(ink,material);}const mesh=new Mesh(geometry,material);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);}}
}
function worker(b:Builder, name:string, vest:Ink="vest") {
  const root=new Group(),body=new Group(),arms=[new Group(),new Group()],legs=[new Group(),new Group()];root.name=name;root.add(body,...legs);body.add(...arms);
  b.add(body,"navy",new CapsuleGeometry(.145,.27,3,8),[0,.9,0]);
  b.box(body,vest,[.33,.32,.23],[0,.92,0]);
  for(const x of [-.095,.095])b.box(body,"tape",[.04,.3,.014],[x,.93,-.123]);b.box(body,"tape",[.34,.035,.245],[0,.88,0]);
  b.add(body,"skin",new SphereGeometry(.115,10,8),[0,1.22,0]);b.box(body,"boots",[.16,.025,.018],[0,1.24,-.102]);
  b.add(body,"helmet",new SphereGeometry(.128,10,6,0,Math.PI*2,0,Math.PI/2),[0,1.27,0]);b.add(body,"helmet",new CylinderGeometry(.145,.145,.025,12),[0,1.275,0]);
  for(const [i,side] of [-1,1].entries()){
    arms[i].position.set(side*.205,1.03,0);b.add(arms[i],"navy",new CapsuleGeometry(.053,.23,2,6),[0,-.17,0]);b.add(arms[i],"vest",new SphereGeometry(.06,8,6),[0,-.35,0]);
    legs[i].position.set(side*.09,.6,0);b.add(legs[i],"navy",new CapsuleGeometry(.065,.31,2,6),[0,-.22,0]);b.box(legs[i],"boots",[.15,.1,.24],[0,-.47,-.04]);
  }
  return {root,body,arms,legs};
}
function pallet(b:Builder,parent:Group) {
  for(const z of [-.32,.32])b.box(parent,"timber",[.94,.12,.12],[0,.06,z]);
  for(let x=-.42;x<.5;x+=.21)b.box(parent,"timber",[.15,.045,.84],[x,.145,0]);
  for(const x of [-.23,.23])for(const z of [-.21,.21]){b.box(parent,"carton",[.42,.55,.38],[x,.44,z]);b.box(parent,"tape",[.035,.56,.39],[x,.44,z]);}
}
export function buildDepotActors(variant:TruckVisualType="articulated") {
  const b=new Builder(),root=new Group(),forklift=new Group(),lift=new Group(),carried=new Group(),wheels:Group[]=[],crew=[worker(b,"Responsable de acceso","teal"),worker(b,"Preparación del pedido"),worker(b,"Embalaje"),worker(b,"Control del muelle","teal")];
  root.add(forklift,...crew.map(person=>person.root));forklift.add(lift);lift.add(carried);
  if(variant==="logging")for(let i=0;i<3;i++)b.add(carried,"timber",new CylinderGeometry(.1,.11,.65,10),[0,.16+i*.18,(i-1)*.13],[0,0,Math.PI/2]);else pallet(b,carried);
  carried.position.set(0,0,-.95);
  b.box(forklift,"amber",[.83,.56,1.15],[0,.5,0]);b.box(forklift,"navy",[.66,.46,.4],[0,.69,.36]);b.box(forklift,"navy",[.42,.13,.36],[0,.91,0]);
  for(const x of [-.35,.35]){b.box(forklift,"navy",[.055,1.12,.06],[x,1.07,.23]);b.box(forklift,"steel",[.06,1.8,.1],[x,.99,-.63]);b.box(lift,"steel",[.11,.06,.8],[x,.05,-.9]);}
  b.box(forklift,"navy",[.9,.085,.85],[0,1.65,.14]);b.box(lift,"steel",[.75,.1,.11],[0,.15,-.6]);
  b.add(forklift,"amber",new CylinderGeometry(.065,.065,.1,10),[0,1.75,.14]);
  const operator=worker(b,"Operador del montacargas");forklift.add(operator.root);operator.root.scale.setScalar(.68);operator.root.position.set(0,.71,.07);operator.legs.forEach(leg=>leg.rotation.x=-1.15);operator.arms.forEach(arm=>arm.rotation.x=-.95);
  for(const x of [-.45,.45])for(const z of [-.32,.4]){const wheel=new Group();wheel.position.set(x,.24,z);b.add(wheel,"tyre",new CylinderGeometry(.23,.23,.13,12),[0,0,0],[0,0,Math.PI/2]);b.add(wheel,"steel",new CylinderGeometry(.13,.13,.145,10),[0,0,0],[0,0,Math.PI/2]);forklift.add(wheel);wheels.push(wheel);}
  const staged=[new Group(),new Group(),new Group()],payload=new Group(),loaded=[new Group(),new Group(),new Group()];
  staged.forEach((item,i)=>{root.add(item);pallet(b,item);item.position.set(4.15,.38,-4.65+i*1.2);});
  loaded.forEach((item,i)=>{payload.add(item);if(variant==="logging"){
    // Each trip installs a full-length layer, filling the usable bed instead of tiny isolated sticks.
    const count=i===2?3:4;for(let n=0;n<count;n++){const z=(n-(count-1)/2)*.32;
      b.add(item,"timber",new CylinderGeometry(.16,.18,4.58,12),[0,.19+i*.31,z],[0,0,Math.PI/2]);
      for(const end of [-1,1])b.add(item,"carton",new CylinderGeometry(.158,.158,.012,12),[end*2.295,.19+i*.31,z],[0,0,Math.PI/2]);
    }
  }else if(variant==="tipper")b.add(item,"grain",new SphereGeometry(.65,12,8),[0,.15,0]);else pallet(b,item);
    item.position.set(variant==="logging"?1.19:variant==="rigid"?.9-i*.78:2.6-i*1.12,variant==="logging"?1.25:variant==="lowloader"?1.02:1.28,0);item.scale.setScalar(variant==="logging"?1:.88);});
  const bulk=new Group(),hose=new Group();root.add(bulk,hose);
  b.box(bulk,"steel",[.12,2.65,.12],[5.1,1.53,2.7]);b.box(bulk,"steel",[2.2,.12,.12],[4.1,2.8,2.7]);
  b.add(bulk,"amber",new CylinderGeometry(.43,.18,.62,12),[5.1,2.35,2.7]);
  const target=new Vector3(3,variant==="mixer"?1.57:1.75,variant==="mixer"?1.68:2.61),start=new Vector3(5.1,2.05,2.7);
  const path=new CatmullRomCurve3([start,new Vector3(4.25,1.95,2.65),target]);b.add(bulk,"steel",new TubeGeometry(path,12,.1,8,false),[0,0,0]);
  const hosePath=new CatmullRomCurve3([new Vector3(5,.8,2),new Vector3(4.75,.5,2.5),new Vector3(4.3,.55,3.3),new Vector3(3.47,1.12,3.3)]);b.add(hose,"navy",new TubeGeometry(hosePath,20,.045,6,false),[0,0,0]);b.add(hose,"red",new CylinderGeometry(.12,.12,.6,12),[5,.68,2]);
  const grains=new InstancedMesh(new SphereGeometry(.045,6,4),new MeshStandardMaterial({color:palette.grain,roughness:.85}),32);grains.castShadow=true;root.add(grains);
  const held=new Group();crew[1].root.add(held);held.position.set(0,.8,-.33);b.box(held,"carton",[.4,.32,.35],[0,0,0]);b.box(held,"tape",[.035,.33,.36],[0,0,0]);
  const parcels=[new Group(),new Group(),new Group()];parcels.forEach(item=>{root.add(item);b.box(item,"carton",[.5,.36,.45],[0,.18,0]);b.box(item,"tape",[.035,.37,.46],[0,.18,0]);});
  b.finish();
  if(typeof document!=="undefined")for(const [text,x,y,z,width] of [["01",-1,3.04,1.19,1.2],["02",3,3.04,1.19,1.2],["03",7,3.04,1.19,1.2],["CARGOMESH",-5.5,2.28,-1.015,3.5]] as const){
    const canvas=document.createElement("canvas");canvas.width=512;canvas.height=128;const ctx=canvas.getContext("2d");if(!ctx)continue;ctx.fillStyle="#244c62";ctx.fillRect(0,0,512,128);ctx.fillStyle="#f2f7ec";ctx.font="600 70px sans-serif";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(text,256,70);
    const map=new CanvasTexture(canvas);map.colorSpace=SRGBColorSpace;const sign=new Mesh(new BoxGeometry(width,.32,.015),new MeshStandardMaterial({map,roughness:.8}));sign.position.set(x,y,z);root.add(sign);
  }
  return {root,forklift,lift,carried,wheels,crew,staged,payload,loaded,bulk,hose,grains,grainTarget:target,variant,held,parcels};
}
export type DepotActors=ReturnType<typeof buildDepotActors>;
const particle=new Object3D();
function poseWorker(person:DepotActors["crew"][number],x:number,z:number,yaw:number,time:number,walking:boolean,working=false){person.root.position.set(x,z<1?.29:.12,z);person.root.rotation.y=yaw;const gait=walking?Math.sin(time*6)*.4:0;person.legs[0].rotation.x=gait;person.legs[1].rotation.x=-gait;person.arms[0].rotation.x=working?-.8+Math.sin(time*3)*.15:-gait;person.arms[1].rotation.x=working?-.8-Math.sin(time*3)*.15:gait;person.body.rotation.z=walking?Math.sin(time*6)*.025:0;}
export function animateDepotActors(actors:DepotActors,pose:DepotPose,reduced=false) {
  const t=pose.time,prep=clamp01((t-26)/10),inDock=t>=26&&t<62,loading=pose.loading;
  const walk=ease(prep<.5?prep*2:2-prep*2);
  const supervisor=ease((t-18)/8);
  poseWorker(actors.crew[0],-8.1+13.95*supervisor,6.3-2.1*supervisor,supervisor>0&&supervisor<1?-1.42:t<18?-Math.PI/2:0,t,!reduced&&t>18&&t<26,pose.phase==="check"||t>=57&&t<62);
  poseWorker(actors.crew[1],6.8-1.3*walk,4.2-.7*walk,prep<.5?.9:-2.2,t,!reduced&&pose.phase==="prepare",inDock&&prep>.45);
  poseWorker(actors.crew[2],5.5,2.35,0,t,false,!reduced&&t>=26&&t<57);
  poseWorker(actors.crew[3],4.25,2.1,-Math.PI/2,t,false,!reduced&&inDock);
  const motion=loadingVehiclePose(pose),bulk=actors.variant==="mixer"||actors.variant==="tipper",tanker=actors.variant==="tanker";
  const feed=bulk||tanker?ease((motion.z+2.8)/3)*1.85:0;
  actors.forklift.position.set(motion.x+feed,.38,motion.z);actors.forklift.rotation.y=Math.PI; // reverses back down the aisle without turning through the rack
  actors.lift.position.y=loading?motion.lift:.12;actors.carried.visible=motion.carrying;
  actors.carried.position.z=-.95-(bulk||tanker?0:motion.transfer*.7);actors.wheels.forEach(wheel=>wheel.rotation.x=motion.z/.23);
  actors.staged.forEach((item,i)=>item.visible=t>=26+(i+1)*3&&i>=pose.loaded&&!(loading&&i===pose.trip));
  actors.held.visible=pose.phase==="prepare"&&prep>.2&&prep<.8;
  actors.parcels.forEach((item,i)=>{item.visible=t>=26&&t<57;item.position.set(6.7,.86,-5.55+((t-26)*.42+i*1.05)%3);});
  actors.loaded.forEach((item,i)=>{item.visible=i<pose.loaded&&!bulk&&!tanker;});
  actors.bulk.visible=bulk&&t>=32&&t<59;actors.hose.visible=tanker&&t>=32&&t<60;
  actors.grains.visible=bulk&&loading;
  for(let i=0;i<32;i++){const f=(t*2+i/32)%1;particle.position.copy(actors.grainTarget);particle.position.x+=Math.sin(i*12.3)*.085;particle.position.z+=Math.cos(i*7.1)*.07;particle.position.y-=f*.3;particle.scale.setScalar(.7+(i%3)*.15);particle.updateMatrix();actors.grains.setMatrixAt(i,particle.matrix);}actors.grains.instanceMatrix.needsUpdate=true;
  if(actors.variant==="tipper")actors.loaded.forEach((item,i)=>{item.visible=i<pose.loaded;item.scale.set(.88,.5,.88);});
}

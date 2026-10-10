import { BoxGeometry, CanvasTexture, CylinderGeometry, Group, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, Quaternion, Euler, RepeatWrapping, SphereGeometry, Vector3, type BufferGeometry } from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

/** Original procedural depot; all dimensions are visual, not facility survey data. */
export function buildDepot(color = "#0a9292") {
  const root = new Group(), roof = new Group(), barrier = new Group(), exitBarrier = new Group(), shutters = [new Group(),new Group(),new Group()];
  root.add(roof, barrier, exitBarrier, ...shutters);
  const colors = { pavement:"#465360",concrete:"#c9cec7",wall:"#d8d2c6",steel:"#718494",accent:color,glass:"#3788a6",roof:"#344c61",gold:"#eab35a",white:"#f1f2df",green:"#76a576",dark:"#1c3445",wood:"#b78352",box:"#d9b47a",red:"#d76053",water:"#5c9aaa" };
  type Key = keyof typeof colors;
  const material = new Map<Key,MeshStandardMaterial>();
  const pools = new Map<Group,Map<Key,BufferGeometry[]>>();
  const add = (geometry:BufferGeometry,key:Key,x:number,y:number,z:number,target=root,rotation:[number,number,number]=[0,0,0]) => {
    const matrix=new Matrix4().compose(new Vector3(x,y,z),new Quaternion().setFromEuler(new Euler(...rotation)),new Vector3(1,1,1));
    const piece=geometry.index?geometry.toNonIndexed():geometry.clone();piece.applyMatrix4(matrix);geometry.dispose();
    let pool=pools.get(target);if(!pool){pool=new Map();pools.set(target,pool);}const list=pool.get(key)??[];list.push(piece);pool.set(key,list);
  };
  const box=(key:Key,x:number,y:number,z:number,w:number,h:number,d:number,target=root)=>add(new BoxGeometry(w,h,d),key,x,y,z,target);
  const cylinder=(key:Key,x:number,y:number,z:number,r:number,h:number,target=root)=>add(new CylinderGeometry(r,r,h,10),key,x,y,z,target);
  // Raised site, road and separated landscaped verges.
  box("concrete",0,-.32,1,30,.6,24);box("green",0,.01,1,29.6,.05,23.6);
  box("pavement",0,.07,9,42,.13,6);box("concrete",2,.06,-1,24,.12,17);
  box("pavement",1,.14,4.5,23,.1,10);box("concrete",0,.19,6,25,.15,.28);
  for(let x=-20;x<21;x+=2.7)box("white",x,.15,9,.95,.02,.08);
  for(let z=-6;z<7;z+=1.3) { box("white",-9,.21,z,2.6,.02,.08);box("white",-10.3,.21,z,.08,.02,1.3); }
  // Continuous facade with three real dock apertures; no gaps between the bays.
  box("concrete",3,.27,-3,12,.2,8);box("wall",3,2.05,-7,12,3.6,.18);
  box("wall",-3,2.05,-3,.18,3.6,8);box("wall",9,2.05,-3,.18,3.6,8);
  for(const [x,w] of [[-2.49,1.02],[1,2.08],[5,2.08],[8.49,1.02]]){
    box("wall",x,2.05,1,w,3.6,.2);
    for(let dx=-w/2+.12;dx<w/2;dx+=.18)box("concrete",x+dx,2.05,1.115,.025,3.58,.035);
  }
  box("wall",3,3.24,1,12,1.22,.2);
  box("steel",3,3.83,1.16,12,.08,.12);
  box("steel",3,2.69,1.65,12,.09,1.05);
  for(const [index,x] of [-1,3,7].entries()){
    for(const side of [-1,1])box("wall",x+side*1.25,1.9,1,.42,3.3,.2);
    box("wall",x,3.5,1,2.6,.45,.2);
    shutters[index].position.set(x, .35, .94);
    box("steel",0,1.14,0,1.9,2.28,.08,shutters[index]);
    for(let h=.12;h<2.3;h+=.16)box("dark",0,h,.052,1.88,.016,.025,shutters[index]);
    box("steel",x,.52,1.55,2.2,.55,1.1);box("dark",x,.65,2.12,1.8,.13,.16);
    box("gold",x-.96,1.2,1.16,.16,1.8,.18);box("gold",x+.96,1.2,1.16,.16,1.8,.18);
    box("accent",x,2.7,1.15,1.9,.24,.12);cylinder("green",x+.72,2.7,1.23,.055,.06);
    for(const side of [-1,1])box("gold",x+side*1.1,.21,4.4,.07,.025,5.2);
    box("gold",x,.21,6.9,2.2,.025,.07);
  }
  // Office wing, entry glazing and shaded walkway.
  box("accent",-5.5,1.3,-4,4.6,2.5,5.8);box("roof",-5.5,2.67,-4,5,.18,6.2);
  for(let x=-7;x<-3.7;x+=.8){box("glass",x,1.75,-1.04,.62,.85,.06);box("white",x,1.3,-1.08,.69,.05,.08);}
  box("glass",-5.5,.9,-1.01,.75,1.5,.08);box("steel",-5.5,1.8,-.45,1.2,.1,1.4);
  for(let z=-6;z<0;z+=.85)box("glass",-7.83,1.6,z,.05,.95,.6);
  // Roof seam strips, skylights, ventilation and solar panels.
  box("roof",3,3.99,-3,12.5,.22,8.6,roof);
  for(let x=-2.6;x<9;x+=.55)box("steel",x,4.13,-3,.035,.05,8.5,roof);
  for(const x of [-.3,3.2,6.8])for(const z of [-5.2,-2.8]){box("dark",x,4.15,z,2.45,.1,1.5,roof);box("glass",x,4.21,z,2.3,.03,1.35,roof);for(let i=-.9;i<1.1;i+=.45)box("steel",x+i,4.24,z,.02,.025,1.4,roof);}
  for(const x of [-1,3,7]){box("concrete",x,4.29,-.1,.8,.4,.6,roof);box("dark",x,4.51,-.1,.65,.025,.45,roof);}
  // Shelf rows and pallet loads become visible in the roofless view.
  for(const x of [-1,.9,5.3,8])for(const z of [-5.8,-3.8]){
    for(const side of [-.65,.65])box("steel",x+side,1.7,z,.055,2.8,.8);
    for(const y of [.7,1.7,2.7]){box("accent",x,y,z,1.5,.07,.9);for(const dx of [-.38,.38]){box("wood",x+dx,y+.1,z,.66,.1,.65);box("box",x+dx,y+.42,z,.58,.54,.56);box("gold",x+dx,y+.7,z,.06,.02,.56);}}
  }
  // Exterior staging pallets and container with ribbed sides.
  for(const x of [7,8.2,9.4]){box("wood",x,.31,4.5,.85,.2,.85);box("box",x,.85,4.5,.7,.9,.7);box("white",x,.85,4.14,.045,.9,.025);}
  box("accent",11,1.35,-4,2.4,2.3,5.5);for(let z=-6.6;z<-1.3;z+=.22)box("steel",9.78,1.35,z,.035,2.2,.04);
  box("dark",11,1.4,-1.22,2.2,2.05,.09);box("steel",11,1.4,-1.15,.06,2,.05);
  // Gate cabin and barrier. Pivot at the lane edge, outside the truck envelope.
  box("accent",-7.6,.65,5.8,1.55,1.2,1.2);box("glass",-7.6,.91,6.42,1.2,.55,.05);box("roof",-7.6,1.31,5.8,1.8,.14,1.5);
  cylinder("gold",-7.5,.66,6.95,.15,1.1);barrier.position.set(-7.5,1.2,6.95);
  box("white",0,0,2.05,.12,.12,4.1,barrier);for(let z=.35;z<4;z+=.6)box("red",0,0,z,.13,.13,.28,barrier);
  cylinder("gold",12,.66,6.95,.15,1.1);exitBarrier.position.set(12,1.2,6.95);
  box("white",0,0,2.05,.12,.12,4.1,exitBarrier);for(let z=.35;z<4;z+=.6)box("red",0,0,z,.13,.13,.28,exitBarrier);
  // Perimeter fence leaves a wide gated entrance.
  for(let x=-13;x<=13;x+=2){cylinder("steel",x,.83,-9,.04,1.4);box("steel",x,.45,-9,2,.035,.035);box("steel",x,1.25,-9,2,.035,.035);}
  for(let z=-8;z<5;z+=2){cylinder("steel",13,.83,z,.04,1.4);box("steel",13,.45,z,.035,.035,2);box("steel",13,1.25,z,.035,.035,2);}
  // Planters, trees, lamps, loading bay bollards and crosswalk.
  for(const [x,z] of [[-12,-7],[-12,-3],[-12,2],[11,3],[11,6],[7,-9],[2,-9]]){
    box("concrete",x,.25,z,1,.3,1);cylinder("wood",x,.92,z,.095,1.3);add(new SphereGeometry(.72,10,8),"green",x,1.95,z);add(new SphereGeometry(.5,10,8),"green",x+.28,2.35,z);
  }
  for(const [x,z] of [[-6,3],[6,6],[11,-8]]){cylinder("steel",x,1.8,z,.045,3.3);box("steel",x+.25,3.4,z,.5,.05,.04);box("gold",x+.4,3.35,z,.2,.05,.2);}
  for(let x=-5;x<-1;x+=.6)box("white",x,.21,5.9,.28,.025,1.3);
  // Packing benches, roller line, office signage and marked pedestrian aisles.
  for(const [x,z] of [[-.6,-1.8],[5.7,3.25]]){box("steel",x,.92,z,1.8,.12,1);for(const dx of [-.7,.7])for(const dz of [-.38,.38])box("steel",x+dx,.56,z+dz,.065,.72,.065);box("box",x-.4,1.2,z,.5,.46,.45);box("dark",x+.6,1.12,z-.2,.24,.35,.06);}
  for(let z=-5.8;z<-2.5;z+=.25){add(new CylinderGeometry(.055,.055,1.2,10),"steel",6.7,.79,z,root,[0,0,Math.PI/2]);}
  for(const x of [6.06,7.34]){box("gold",x,.82,-4.2,.055,.08,3.8);for(const z of [-5.8,-2.5])box("steel",x,.56,z,.08,.5,.08);}
  for(let z=-5;z<4;z+=.65){box("green",5.55,.23,z,.045,.015,.3);box("green",6.15,.23,z,.045,.015,.3);}
  box("accent",-5.5,2.28,-1.1,3.7,.4,.08);box("white",-5.5,2.29,-1.15,2.8,.055,.025);
  for(const x of [-1,3,7]){for(let i=0;i<6;i++)box("gold",x-.7+i*.28,.81,1.92,.12,.02,.18);box("glass",x+.97,2.73,1.23,.05,.08,.025);}
  // Safety rails, hose reels, drains and fire equipment make the dock legible.
  for(const x of [-2,8.8]){box("red",x,.8,1.25,.16,.65,.12);box("white",x,.94,1.33,.12,.04,.025);cylinder("steel",x,1.32,1.25,.1,.07);}
  for(let x=-8;x<11;x+=.45)box("dark",x,.23,5.12,.18,.014,.025);
  box("gold",4.8,.32,2.65,1.2,.1,1.2);for(let i=0;i<6;i++)box("dark",4.3+i*.18,.39,2.65,.07,.02,1);
  const grain=typeof document!=="undefined"?surfaceGrain():null;
  for(const [target,pool] of pools)for(const [key,pieces] of pool){let mat=material.get(key);if(!mat){mat=new MeshStandardMaterial({color:colors[key],roughness:key==="glass"?.16:key==="pavement"?.94:.7,metalness:key==="steel"?.65:key==="roof"?.35:key==="glass"?.3:0});if(grain&&["pavement","concrete","wall"].includes(key)){mat.bumpMap=grain;mat.bumpScale=key==="pavement"?.05:.018;mat.roughnessMap=grain;}material.set(key,mat);}const merged=mergeGeometries(pieces,false);pieces.forEach(g=>g.dispose());if(merged){const mesh=new Mesh(merged,mat);mesh.castShadow=key!=="green";mesh.receiveShadow=true;target.add(mesh);}}
  root.userData.source="cargomesh-original-depot";
  return {root,roof,barrier,exitBarrier,shutters};
}
function surfaceGrain(){const canvas=document.createElement("canvas");canvas.width=128;canvas.height=128;const context=canvas.getContext("2d");if(context){const pixels=context.createImageData(128,128);let seed=7919;for(let i=0;i<pixels.data.length;i+=4){seed=(seed*1664525+1013904223)>>>0;const value=150+seed%70;pixels.data.set([value,value,value,255],i);}context.putImageData(pixels,0,0);}const texture=new CanvasTexture(canvas);texture.wrapS=texture.wrapT=RepeatWrapping;texture.repeat.set(12,12);return texture;}
export function disposeDepot(root:Group){const materials=new Set<MeshStandardMaterial>(),textures=new Set<CanvasTexture>();root.traverse(node=>{if(node instanceof Mesh){if(node instanceof InstancedMesh)node.dispose();node.geometry.dispose();for(const mat of Array.isArray(node.material)?node.material:[node.material])materials.add(mat as MeshStandardMaterial);}});materials.forEach(mat=>{for(const texture of [mat.map,mat.bumpMap,mat.roughnessMap])if(texture)textures.add(texture as CanvasTexture);mat.dispose();});textures.forEach(texture=>texture.dispose());}

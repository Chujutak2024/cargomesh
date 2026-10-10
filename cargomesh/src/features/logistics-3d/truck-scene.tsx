"use client";
import { useEffect, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ACESFilmicToneMapping, Group, Mesh, MeshStandardMaterial, PMREMGenerator, SRGBColorSpace, Vector3 } from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { buildCargoMeshTruck, disposeCargoMeshTruck, setTruckWheelAngle, type TruckVisualType } from "./truck-model";
import { disposeTruckAsset, loadTruckGlb } from "./load-truck-glb";
import { RoadEnvironment } from "./road-environment";
import type { TruckEnvironment } from "./truck-environment";

export type TruckViewControls = { rotate: (horizontal: number, vertical?: number) => void; reset: () => void; capture: () => Promise<Blob> };
type StudioProps = { active: boolean; reduced: boolean; onReady: () => void; variant: TruckVisualType;
  modelBlob?: Blob | null; onFailure: () => void; environment?: TruckEnvironment;
  interactive: boolean; autoRotate: boolean; moving: boolean; onControlsReady: (controls: TruckViewControls | null) => void; onInteraction: () => void; onInspect?: () => void };

function Studio({active, reduced, onReady, onFailure, variant, modelBlob, environment, interactive, autoRotate, moving, onControlsReady, onInteraction, onInspect}:StudioProps) {
  const [truck,setTruck]=useState<Group|null>(null),frames=useRef(0);
  const travel=useRef(0), suspension=useRef<Group>(null);
  const {invalidate,gl,scene,camera,size}=useThree();
  const orbit=useRef<OrbitControls|null>(null);
  useEffect(()=>{
    let cancelled=false,owned:Group|null=null;setTruck(null);
    const install=(model:Group)=>{owned=model;if(cancelled){disposeTruckAsset(model);return;}setTruck(model);invalidate();};
    if(modelBlob)modelBlob.arrayBuffer().then(loadTruckGlb).then(install).catch(()=>{if(!cancelled)onFailure();});
    else install(buildCargoMeshTruck(variant));
    return()=>{cancelled=true;if(owned){if(modelBlob)disposeTruckAsset(owned);else disposeCargoMeshTruck(owned);owned=null;}};
  },[variant,modelBlob,invalidate,onFailure]);
  useEffect(()=>{
    const generator=new PMREMGenerator(gl),room=new RoomEnvironment();
    const environment=generator.fromScene(room,.04,.1,100,{size:128});
    const previous=scene.environment;scene.environment=environment.texture;scene.environmentIntensity=.65;
    room.dispose();generator.dispose();invalidate();
    return()=>{scene.environment=previous;environment.dispose();};
  },[gl,scene,invalidate]);
  useEffect(()=>{
    scene.environmentIntensity=.65-.43*(environment?.night??0);
    // Only the original catalog declares which mesh contains its lamps.
    // Imported GLB materials remain exactly as uploaded.
    if(truck&&!modelBlob)truck.traverse(child=>{
      if(child instanceof Mesh&&child.material instanceof MeshStandardMaterial){
        const night=environment?.night??0;
        if(child.name==="lamp")child.material.emissiveIntensity=.2+night*2;
        if(child.name==="amber")child.material.emissiveIntensity=.15+night*.8;
        if(child.name==="red")child.material.emissiveIntensity=.12+night*.65;
      }
    });
    invalidate();
  },[environment,truck,modelBlob,scene,invalidate]);
  useEffect(()=>{if(active)invalidate();},[active,invalidate]);
  useEffect(()=>{
    if(!active||!moving||reduced)return;
    // Render the moving preview at 30 fps; demand rendering resumes when paused.
    invalidate();const timer=window.setInterval(invalidate,1000/30);
    return()=>window.clearInterval(timer);
  },[active,moving,reduced,invalidate]);
  useEffect(()=>{if(truck){gl.render(scene,camera);onReady();invalidate();}},[truck,gl,scene,camera,onReady,invalidate]);
  useEffect(()=>{
    if(!interactive)return;
    const controls=new OrbitControls(camera,gl.domElement);orbit.current=controls;
    controls.target.set(0,1.2,0);controls.enablePan=false;controls.enableZoom=false;
    controls.minPolarAngle=.35;controls.maxPolarAngle=Math.PI/2-.05;
    controls.rotateSpeed=.65;controls.dampingFactor=.12;controls.autoRotateSpeed=.8;controls.cursorStyle="grab";
    const change=()=>invalidate();
    const manual=()=>{controls.autoRotate=false;onInteraction();};
    controls.addEventListener("change",change);controls.addEventListener("start",manual);
    const act=(action:()=>void)=>{manual();const damping=controls.enableDamping;controls.enableDamping=false;
      controls.update(0);action();controls.enableDamping=damping;invalidate();};
    onControlsReady({rotate:(horizontal,vertical=0)=>act(()=>{controls.rotateLeft(horizontal);controls.rotateUp(vertical);}),
      reset:()=>act(()=>controls.reset()),capture:()=>{gl.render(scene,camera);return new Promise<Blob>((resolve,reject)=>gl.domElement.toBlob(blob=>blob?resolve(blob):reject(new Error("EXPORT_UNAVAILABLE")),"image/png"));}});
    controls.update(0);invalidate();
    return()=>{onControlsReady(null);controls.removeEventListener("change",change);controls.removeEventListener("start",manual);controls.dispose();orbit.current=null;};
  },[camera,gl,scene,invalidate,interactive,onControlsReady,onInteraction]);
  useEffect(()=>{
    // Frame every body from all azimuths, including narrow mobile viewports.
    const radius=Math.max(10.3,4/(Math.tan(31*Math.PI/360)*Math.max(size.width/size.height,.5)));
    camera.position.copy(new Vector3(-6.5,interactive?.6:2.4,7.6).normalize().multiplyScalar(radius).add(new Vector3(0,1.2,0)));
    camera.lookAt(0,1.2,0);
    const controls=orbit.current;
    if(controls){const damping=controls.enableDamping;controls.enableDamping=false;controls.autoRotate=false;controls.update(0);controls.saveState();controls.enableDamping=damping;onInteraction();}
    invalidate();
  },[variant,modelBlob,interactive,size.width,size.height,camera,invalidate,onInteraction]);
  useEffect(()=>{
    const controls=orbit.current;if(!controls)return;
    controls.enabled=active;controls.enableDamping=!reduced;controls.autoRotate=active&&autoRotate&&!reduced;
    if(active)invalidate();
  },[active,autoRotate,reduced,invalidate]);
  useFrame(({camera,gl},delta)=>{
    if(active){orbit.current?.update(Math.min(delta,.1));if(orbit.current?.autoRotate)invalidate();}
    if(moving&&active&&!reduced&&truck){
      travel.current+=Math.min(delta,.1)*1.1;
      if(!modelBlob)setTruckWheelAngle(truck,travel.current/.369);
      if(suspension.current){suspension.current.position.y=.007*Math.sin(travel.current*11);suspension.current.rotation.z=.001*Math.sin(travel.current*7);}
    }
    gl.domElement.dataset.frames=String(++frames.current);gl.domElement.dataset.cameraX=String(camera.position.x);gl.domElement.dataset.cameraY=String(camera.position.y);gl.domElement.dataset.cameraZ=String(camera.position.z);
    gl.domElement.dataset.truckVariant=modelBlob?"custom":variant;
    gl.domElement.dataset.truckDetail=truck?.userData.detailLevel??(modelBlob?"imported":"loading");
    gl.domElement.dataset.triangles=String(gl.info.render.triangles);
    gl.domElement.dataset.drawCalls=String(gl.info.render.calls);
    gl.domElement.dataset.dpr=String(gl.getPixelRatio());
  });
  return <>{environment?<RoadEnvironment environment={environment} moving={moving&&active&&!reduced}/>:<><ambientLight intensity={.45}/><hemisphereLight args={["#eaf7ff","#74818b",.8]}/>
    <directionalLight position={[-3,8,5]} intensity={2.4} castShadow shadow-mapSize={[1024,1024]} shadow-camera-left={-6} shadow-camera-right={6} shadow-camera-top={5} shadow-camera-bottom={-5} shadow-bias={-.0005} shadow-normalBias={.018}/>
    <directionalLight position={[5,5,-4]} intensity={1.4} color="#b5e3ed"/></>}
    <group ref={suspension}>{truck?<primitive object={truck} dispose={null} onClick={onInspect ? (event: { delta: number; stopPropagation: () => void }) => { if(event.delta <= 5){event.stopPropagation();onInspect();} } : undefined}/>:null}</group>
    {!environment?<mesh rotation={[-Math.PI/2,0,0]} position={[0,0,0]} receiveShadow><planeGeometry args={[200,200]}/><shadowMaterial opacity={.16}/></mesh>:null}
  </>;
}

type SceneProps = Omit<StudioProps,"variant"|"interactive"> & {onFailure:()=>void;variant?:TruckVisualType;thumbnail?:boolean};
export default function TruckScene({active,reduced,onReady,onFailure,variant="articulated",modelBlob,environment,thumbnail=false,autoRotate,moving,onControlsReady,onInteraction,onInspect}:SceneProps) {
  const removeContextListener=useRef<(()=>void)|null>(null);
  useEffect(()=>()=>{removeContextListener.current?.();removeContextListener.current=null;},[]);
  return <Canvas aria-hidden="true" tabIndex={-1} shadows={thumbnail?false:"percentage"} dpr={[1,thumbnail?1.25:1.5]} frameloop={active?"demand":"never"} camera={{position:[-6.5,3.6,7.6],fov:31,near:.1,far:100}}
    gl={{alpha:true,antialias:true,powerPreference:"low-power",preserveDrawingBuffer:false}}
    onCreated={({gl,camera})=>{gl.toneMapping=ACESFilmicToneMapping;gl.outputColorSpace=SRGBColorSpace;camera.lookAt(0,1.2,0);gl.domElement.addEventListener("webglcontextlost",onFailure,{once:true});removeContextListener.current=()=>gl.domElement.removeEventListener("webglcontextlost",onFailure);}}
    fallback={null}><Studio active={active} reduced={reduced} onReady={onReady} onFailure={onFailure} variant={variant} modelBlob={modelBlob} environment={thumbnail?undefined:environment} interactive={!thumbnail} autoRotate={autoRotate} moving={moving&&!thumbnail} onControlsReady={onControlsReady} onInteraction={onInteraction} onInspect={onInspect}/></Canvas>;
}

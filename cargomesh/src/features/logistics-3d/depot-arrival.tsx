"use client";
import { Component, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useScenePlayback } from "@/features/product-motion/use-motion-preference";
import { ACESFilmicToneMapping, Color, Group, OrthographicCamera, PMREMGenerator, SRGBColorSpace, Vector3, MathUtils } from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { Building2, PackageCheck, Pause, Play, RotateCcw, Warehouse, ZoomIn, ZoomOut } from "lucide-react";
import type { TruckInspectionContext } from "@/features/carrier-portal/truck-inspection-model";
import { buildDepot, disposeDepot } from "./depot-model";
import { depotCyclePose, depotPhases, DEPOT_CYCLE_SECONDS, ease, type DepotPhase } from "./depot-cycle";
import { buildDepotActors, animateDepotActors } from "./depot-actors";
import { buildCargoMeshTruck, disposeCargoMeshTruck, setTruckWheelAngle, setTruckCargoAccess } from "./truck-model";
import { disposeTruckAsset, loadTruckGlb } from "./load-truck-glb";
import { readTruckModel } from "./truck-model-assets";
import { getTruckEnvironment } from "./truck-environment";
import s from "./depot.module.css";

type FrameReport = { phase: DepotPhase; time: number; loadProgress: number };
type ViewControls = { zoom:(factor:number)=>void; center:()=>void };
type SceneProps = { context:TruckInspectionContext; reduced:boolean; night:number; hidden:boolean; interior:boolean; controlsReady:(controls:ViewControls|null)=>void; report:(value:FrameReport)=>void; failed:()=>void; ready:()=>void };
function DepotScene({context,reduced,night,hidden,interior,controlsReady,report,failed,ready}:SceneProps){
  const {camera,gl,scene,invalidate,size}=useThree();
  const [model,setModel]=useState<{depot:ReturnType<typeof buildDepot>;truck:Group;actors:ReturnType<typeof buildDepotActors>}|null>(null);
  const travel=useRef(0),lastReport=useRef(-1),frames=useRef(0),target=useRef(new Vector3()),position=useRef(new Vector3());
  const orbit=useRef<OrbitControls|null>(null),guided=useRef(true),resetView=useRef(false);
  useEffect(()=>{
    const controls=new OrbitControls(camera,gl.domElement);orbit.current=controls;
    controls.target.set(0,0,1);controls.enablePan=true;controls.enableZoom=true;
    controls.minZoom=2.5;controls.maxZoom=150;controls.minPolarAngle=.08;controls.maxPolarAngle=Math.PI/2-.03;
    controls.enableDamping=!reduced;controls.dampingFactor=.12;controls.rotateSpeed=.65;controls.zoomSpeed=.7;controls.panSpeed=.7;
    const manual=()=>{guided.current=false;invalidate();};
    const change=()=>invalidate();
    const zoom=(factor:number)=>{
      manual();if(camera instanceof OrthographicCamera){camera.zoom=MathUtils.clamp(camera.zoom*factor,controls.minZoom,controls.maxZoom);camera.updateProjectionMatrix();}controls.update(0);invalidate();
    };
    const center=()=>{resetView.current=true;invalidate();};
    const keys=(event:KeyboardEvent)=>{
      if(["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","+","=","-","Home"].includes(event.key))event.preventDefault();else return;
      if(event.key==="Home")center();else if(event.key==="+"||event.key==="=")zoom(1.2);else if(event.key==="-")zoom(1/1.2);else{manual();if(event.key==="ArrowLeft"||event.key==="ArrowRight")controls.rotateLeft(event.key==="ArrowLeft"?.12:-.12);else controls.rotateUp(event.key==="ArrowUp"?.1:-.1);controls.update(0);invalidate();}
    };
    gl.domElement.tabIndex=0;gl.domElement.setAttribute("aria-label","Vista interactiva de la sede: girar, desplazar y acercar");
    controls.addEventListener("start",manual);controls.addEventListener("change",change);gl.domElement.addEventListener("keydown",keys);
    controlsReady({zoom,center});controls.update(0);
    return()=>{controlsReady(null);controls.removeEventListener("start",manual);controls.removeEventListener("change",change);gl.domElement.removeEventListener("keydown",keys);controls.dispose();orbit.current=null;};
  },[camera,gl,invalidate,reduced,controlsReady]);
  useEffect(()=>{if(model){model.depot.roof.visible=!interior;invalidate();}},[model,interior,invalidate]);
  useEffect(()=>{resetView.current=true;invalidate();},[interior,invalidate]);
  useEffect(()=>{
    let cancelled=false,owned:NonNullable<typeof model>|null=null;
    const install=(truck:Group)=>{
      if(cancelled){disposeTruckAsset(truck);return;}
      owned={depot:buildDepot(context.depot.color),truck,actors:buildDepotActors(context.variant)};
      owned.depot.root.add(owned.actors.root);owned.actors.payload.visible=!context.modelAssetId;truck.add(owned.actors.payload);
      setModel(owned);invalidate();ready();
    };
    if(context.modelAssetId)readTruckModel(context.modelAssetId).then(asset=>{if(!asset)throw new Error("MODEL_MISSING");return asset.blob.arrayBuffer();}).then(loadTruckGlb).then(install).catch(()=>{if(!cancelled)failed();});
    else if(context.custom)failed();else install(buildCargoMeshTruck(context.variant,{cargoAccess:true}));
    return()=>{cancelled=true;if(owned){owned.truck.remove(owned.actors.payload);owned.depot.root.add(owned.actors.payload);disposeDepot(owned.depot.root);if(context.modelAssetId)disposeTruckAsset(owned.truck);else disposeCargoMeshTruck(owned.truck);}};
  },[context,invalidate,failed,ready]);
  useEffect(()=>{
    const generator=new PMREMGenerator(gl),room=new RoomEnvironment(),env=generator.fromScene(room,.05,.1,100,{size:128}),previous=scene.environment;
    scene.environment=env.texture;room.dispose();generator.dispose();return()=>{scene.environment=previous;env.dispose();};
  },[gl,scene]);
  useEffect(()=>{scene.environmentIntensity=.75-night*.45;scene.background=new Color("#dce9ed").lerp(new Color("#182b45"),night);invalidate();},[night,scene,invalidate]);
  useEffect(()=>{invalidate();},[reduced,invalidate]);
  useEffect(()=>{
    if(hidden||reduced){invalidate();return;}
    const timer=window.setInterval(()=>{if(!document.hidden)invalidate();},1000/30);return()=>window.clearInterval(timer);
  },[hidden,reduced,invalidate]);
  useFrame((_,delta)=>{
    if(!model)return;
    if(!reduced&&!hidden&&!document.hidden)travel.current=(travel.current+Math.min(delta,.05))%(DEPOT_CYCLE_SECONDS+7);
    const pose=depotCyclePose(travel.current,["rigid","tipper","mixer"].includes(context.variant??""));
    model.truck.position.copy(pose.position);model.truck.position.y=.21;model.truck.rotation.y=pose.yaw;model.truck.scale.setScalar(.58);
    if(!context.modelAssetId)setTruckWheelAngle(model.truck,pose.wheelDistance/(.369*.58));
    setTruckCargoAccess(model.truck,pose.doors);animateDepotActors(model.actors,pose,reduced);
    model.depot.barrier.rotation.x=-pose.gate*Math.PI/2;model.depot.exitBarrier.rotation.x=-pose.exitGate*Math.PI/2;
    model.depot.shutters.forEach((door,i)=>{const open=i===1?ease((pose.time-23)/3)*(1-ease((pose.time-61)/3)):0;door.scale.y=1-open*.96;door.position.y=.35+2.28*open*.96;});
    const close=ease((pose.time-18)/8)*(1-ease((pose.time-60)/6));
    const controls=orbit.current;
    if(resetView.current||guided.current){
      target.current.set(interior?3:3*close,interior?.7:.8*close,interior?-2.4:1+1.2*close);
      position.current.set(interior?-10:-24+14*close,interior?20:24-15*close,interior?13:30-15*close).add(target.current);
      const blend=resetView.current||reduced?1:1-Math.exp(-Math.min(delta,.05)*3.5);
      camera.position.lerp(position.current,blend);controls?.target.copy(target.current);camera.lookAt(target.current);
      if(camera instanceof OrthographicCamera){camera.zoom=MathUtils.lerp(camera.zoom,Math.max(3,Math.min(size.width/(interior?24:48-24*close),size.height/(interior?20:31-22*close))),blend);camera.updateProjectionMatrix();}
      if(resetView.current){guided.current=!interior;resetView.current=false;}
    }
    controls?.update(Math.min(delta,.05));
    const tick=Math.floor(pose.time*4);if(tick!==lastReport.current){lastReport.current=tick;report({phase:pose.phase,time:pose.time,loadProgress:pose.loadProgress});}
    const data=gl.domElement.dataset;data.arrivalPhase=pose.phase;data.arrivalProgress=pose.progress.toFixed(3);data.cycleTime=pose.time.toFixed(2);data.loadProgress=pose.loadProgress.toFixed(3);data.loadedBatches=String(pose.loaded);data.crewCount=String(model.actors.crew.length);data.frames=String(++frames.current);data.drawCalls=String(gl.info.render.calls);data.truckVariant=context.modelAssetId?"custom":context.variant??"articulated";data.arrivalX=pose.position.x.toFixed(3);data.arrivalZ=pose.position.z.toFixed(3);
    data.cameraMode=guided.current?"guided":"manual";data.cameraX=camera.position.x.toFixed(3);data.cameraY=camera.position.y.toFixed(3);data.cameraZ=camera.position.z.toFixed(3);data.cameraZoom=String(camera.zoom);data.targetX=String(controls?.target.x);data.targetZ=String(controls?.target.z);data.depotRoof=String(model.depot.roof.visible);
  });
  return <>
    <ambientLight intensity={.5-night*.22}/><hemisphereLight args={["#eaf6ff","#929a7e",1.45-night*.6]}/>
    <directionalLight position={[-12,22,10]} intensity={3-night*1.8} color={night>.5?"#c4d9ff":"#fff0d4"} castShadow shadow-mapSize={[2048,2048]} shadow-camera-left={-24} shadow-camera-right={24} shadow-camera-top={24} shadow-camera-bottom={-24} shadow-bias={-.0005} shadow-normalBias={.025}/>
    <pointLight position={[3,4,2]} color="#ffe2a4" intensity={night*115} distance={18} decay={2}/><pointLight position={[-6,4,1]} color="#97d5ef" intensity={night*60} distance={13} decay={2}/>
    {model?<><primitive object={model.depot.root} dispose={null}/><primitive object={model.truck} dispose={null}/></>:null}
  </>;
}
class DepotBoundary extends Component<{children:ReactNode;failed:()=>void},{error:boolean}>{state={error:false};static getDerivedStateFromError(){return{error:true};}componentDidCatch(){this.props.failed();}render(){return this.state.error?null:this.props.children;}}
export default function DepotArrival({context}:{context:TruckInspectionContext}){
  const {playing,toggle}=useScenePlayback(),reduced=!playing;
  const [frame,setFrame]=useState<FrameReport>({phase:"approach",time:0,loadProgress:0}),[error,setError]=useState(false),[loaded,setLoaded]=useState(false),[clock,setClock]=useState(new Date()),[hidden,setHidden]=useState(false);
  const [interior,setInterior]=useState(false),viewControls=useRef<ViewControls|null>(null);
  const controlsReady=useCallback((controls:ViewControls|null)=>{viewControls.current=controls;},[]);
  const report=useCallback((value:FrameReport)=>setFrame(value),[]),failed=useCallback(()=>setError(true),[]),ready=useCallback(()=>setLoaded(true),[]);
  useEffect(()=>{const update=()=>{setHidden(document.hidden);if(!document.hidden)setClock(new Date());};update();const timer=window.setInterval(update,30000);document.addEventListener("visibilitychange",update);return()=>{window.clearInterval(timer);document.removeEventListener("visibilitychange",update);};},[]);
  const environment=getTruckEnvironment(clock),phase=depotPhases.find(item=>item.id===frame.phase)!;
  return <section className={s.root} aria-label="Sede 3D y operación del camión">
    <div className={s.facility}><span className={s.brand} style={{background:context.depot.color}}><Building2 size={23}/></span><div><h3>{context.depot.name}<span> · {context.depot.city}</span></h3><p>{context.depot.carrier??"Centro logístico"}{context.depot.planned?" · Destino previsto":""}</p></div><span className={s.vehicle}>{context.title}</span></div>
    <div className={s.stage} data-depot-roof={!interior} data-depot-state={error?"failed":loaded?"ready":"loading"}>
      {!error?<DepotBoundary failed={failed}><Canvas orthographic shadows="soft" dpr={[1,1.5]} frameloop={hidden?"never":"demand"} camera={{position:[-24,24,30],zoom:16,near:.1,far:180}} gl={{antialias:true,powerPreference:"low-power"}} onCreated={({gl})=>{gl.toneMapping=ACESFilmicToneMapping;gl.outputColorSpace=SRGBColorSpace;}}><DepotScene context={context} reduced={reduced} night={environment.night} hidden={hidden} interior={interior} controlsReady={controlsReady} report={report} failed={failed} ready={ready}/></Canvas></DepotBoundary>:<div className={s.error} role="status"><Building2 size={38}/><strong>{context.custom?"El modelo 3D del camión no está disponible":"No se pudo abrir el visor 3D"}</strong><p>{context.custom?"Carga el archivo GLB del camión para ver su llegada a la sede.":"Tu navegador necesita WebGL para mostrar esta escena."}</p></div>}
      {!error?<div className={s.viewTools} role="group" aria-label="Controles de vista de la sede">
        <button type="button" disabled={!loaded} aria-pressed={playing} aria-label={playing?"Pausar operación de la sede":"Reproducir operación de la sede"} onClick={toggle}>{playing?<Pause size={18}/>:<Play size={18}/>}</button>
        <button aria-label="Acercar la sede" title="Acercar" disabled={!loaded} onClick={()=>viewControls.current?.zoom(1.2)}><ZoomIn size={18}/></button>
        <button aria-label="Alejar la sede" title="Alejar" disabled={!loaded} onClick={()=>viewControls.current?.zoom(1/1.2)}><ZoomOut size={18}/></button>
        <button aria-label="Centrar la sede" title="Centrar vista" disabled={!loaded} onClick={()=>viewControls.current?.center()}><RotateCcw size={18}/></button>
        <button className={s.interiorToggle} aria-pressed={interior} disabled={!loaded} onClick={()=>setInterior(value=>!value)}><Warehouse size={18}/>{interior?"Ver exterior":"Ver interior"}</button>
      </div>:null}
      {!loaded&&!error?<span className={s.preparing} role="status">Preparando la sede…</span>:null}
      {!error?<div className={s.sceneLegend}><i style={{background:context.depot.color}}/>Patio de maniobras<span>•</span>Muelle 02</div>:null}
      {!error&&frame.time>=26?<div className={s.loadBadge}><PackageCheck size={18}/><span>{frame.time<36?"Preparando pedido":frame.time<57?"Carga en curso":frame.time<62?"Revisando carga":"Camión cargado"}<strong>{Math.round(frame.loadProgress*100)}%</strong></span></div>:null}
    </div>
    <div className={s.caption}><span className={s.stateDot}/><strong>{error?"Vista no disponible":!loaded?"Cargando":phase.label}</strong><span>Preparación, carga y salida</span></div>
  </section>;
}

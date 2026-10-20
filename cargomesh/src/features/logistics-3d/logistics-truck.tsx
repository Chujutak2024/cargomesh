"use client";
import dynamic from "next/dynamic";
import { Component, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useReducedMotionPreference } from "@/features/product-motion/use-motion-preference";
import { Download, Info, MoonStar, Pause, Play, RotateCcw, RotateCw, Scan, Sun, Sunset } from "lucide-react";
import { useLocale } from "@/features/i18n/locale-provider";
import styles from "./truck.module.css";
import type { TruckVisualType } from "./truck-model";
import type { TruckViewControls } from "./truck-scene";
import { readTruckModel } from "./truck-model-assets";
import { truckDesign } from './visual-catalog';
import { getTruckEnvironment, nextEnvironmentPhase, previewTruckEnvironment, type TruckEnvironmentPhase } from "./truck-environment";

const TruckScene=dynamic(()=>import("./truck-scene"),{ssr:false,loading:()=>null});
class SceneBoundary extends Component<{children:ReactNode;onFailure:()=>void},{failed:boolean}> {
  state={failed:false};static getDerivedStateFromError(){return{failed:true};}
  componentDidCatch(){this.props.onFailure();}
  render(){return this.state.failed?null:this.props.children;}
}

/** No asset identity, capacity or position claims; independent of all API state. */
type Props = { compact?:boolean;minimalControls?:boolean;previewOnly?:boolean;variant?:TruckVisualType;designId?:string;thumbnail?:boolean;label?:string;photo?:string|null;caption?:string;modelAssetId?:string|null;custom?:boolean;onInspect?:()=>void;suspended?:boolean };
export function LogisticsTruck(props:Props) {
  return <TruckView key={`${props.designId??props.variant??"default"}:${props.modelAssetId??"catalog"}:${!!props.custom}`} {...props}/>;
}
function TruckView({compact=false,minimalControls=false,previewOnly=false,variant,designId,thumbnail=false,label,photo,caption,modelAssetId,custom=false,onInspect,suspended=false}:Props) {
  const design = truckDesign(designId);
  const validDesignId = design?.family === (variant ?? 'articulated') ? designId : undefined;
  const newBody = !!validDesignId && !!design?.appearance.bodyStyle;
  const {t}=useLocale();const preferred=useReducedMotionPreference();const [motionRequested,setMotionRequested]=useState(false);const reduced=preferred&&!motionRequested;const element=useRef<HTMLDivElement>(null);
  const [visible,setVisible]=useState(false),[eligible,setEligible]=useState(false),[hidden,setHidden]=useState(false),[ready,setReady]=useState(false),[failed,setFailed]=useState(false);
  const [autoRotate,setAutoRotate]=useState(false);const controls=useRef<TruckViewControls|null>(null);
  const [exportFailed,setExportFailed]=useState(false);
  const [clock,setClock]=useState<Date|null>(null),[drive,setDrive]=useState(true);
  const [preview,setPreview]=useState<TruckEnvironmentPhase|null>(null);
  const environment=useMemo(()=>preview?previewTruckEnvironment(preview):getTruckEnvironment(clock??new Date(2000,0,1,12)),[clock,preview]);
  useEffect(()=>{
    if(thumbnail)return;
    const update=()=>{if(!document.hidden)setClock(new Date());};
    update();const timer=window.setInterval(update,30000);
    window.addEventListener("focus",update);document.addEventListener("visibilitychange",update);
    return()=>{window.clearInterval(timer);window.removeEventListener("focus",update);document.removeEventListener("visibilitychange",update);};
  },[thumbnail]);
  const markReady=useCallback(()=>setReady(true),[]),markFailure=useCallback(()=>setFailed(true),[]);
  const receiveControls=useCallback((value:TruckViewControls|null)=>{controls.current=value;},[]);
  const stopRotation=useCallback(()=>setAutoRotate(false),[]);
  const [modelBlob,setModelBlob]=useState<Blob|null>(null),[assetState,setAssetState]=useState<"loading"|"ready"|"missing">("loading");
  useEffect(()=>{
    if(!modelAssetId)return;
    let cancelled=false;
    readTruckModel(modelAssetId).then(asset=>{if(cancelled)return;if(asset){setModelBlob(asset.blob);setAssetState("ready");}else setAssetState("missing");})
      .catch(()=>{if(!cancelled)setAssetState("missing");});
    return()=>{cancelled=true;};
  },[modelAssetId]);
  useEffect(()=>{const media=window.matchMedia("(min-width: 768px)");const update=()=>setEligible(!thumbnail||media.matches);update();media.addEventListener("change",update);return()=>media.removeEventListener("change",update);},[thumbnail]);
  useEffect(()=>{
    let frame:number|null=null;
    const measure=()=>{frame=null;const rect=element.current?.getBoundingClientRect();
      setVisible(!!rect&&rect.height>0&&rect.width>0&&rect.top<window.innerHeight+80&&rect.bottom>-80&&rect.left<window.innerWidth&&rect.right>0);};
    const schedule=()=>{if(frame===null)frame=window.requestAnimationFrame(measure);};
    const observer=new IntersectionObserver(schedule,{rootMargin:"80px"});if(element.current)observer.observe(element.current);
    const visibility=()=>{setHidden(document.hidden);if(!document.hidden)schedule();};
    // Re-measure after hash-navigation focus scrolling and responsive layout changes.
    // This also covers browsers that deliver a stale intersection after a frame capture.
    measure();visibility();window.addEventListener("scroll",schedule,{passive:true});window.addEventListener("resize",schedule);
    document.addEventListener("visibilitychange",visibility);
    return()=>{observer.disconnect();if(frame!==null)window.cancelAnimationFrame(frame);window.removeEventListener("scroll",schedule);window.removeEventListener("resize",schedule);document.removeEventListener("visibilitychange",visibility);};
  },[]);
  const canRender=modelBlob||(!custom&&!photo&&!modelAssetId);
  useEffect(()=>{if(!eligible||!visible||ready||failed||!canRender)return;const timeout=window.setTimeout(markFailure,12000);return()=>window.clearTimeout(timeout);},[eligible,visible,ready,failed,canRender,markFailure]);
  const interactive=!thumbnail&&!!canRender,available=interactive&&eligible&&ready&&!failed;
  const rotating=!minimalControls&&!previewOnly&&available&&autoRotate&&!reduced&&visible&&!hidden&&!suspended;
  const moving=!minimalControls&&!previewOnly&&available&&drive&&!reduced&&visible&&!hidden&&!suspended;
  const PhaseIcon=environment.phase==="day"?Sun:environment.phase==="afternoon"?Sunset:MoonStar;
  const phaseName=(phase:TruckEnvironmentPhase)=>phase==="day"?t("Día","Day"):phase==="afternoon"?t("Tarde","Afternoon"):t("Noche","Night");
  return <figure className={`${styles.figure} ${compact?styles.compact:""} ${thumbnail?styles.thumbnail:""} ${interactive?`${styles.interactive} ${styles.road}`:""}`}>
    {!thumbnail&&!minimalControls&&!previewOnly?<div className={styles.heading}>{label?<strong>{label}</strong>:null}<span>{canRender?"3D · 360°":photo?t("Tu foto","Your photo"):t("Tu camión","Your truck")}</span>{onInspect?<button type="button" className={styles.inspect} onClick={onInspect} aria-label={t("Ver resumen del camión","View truck summary")}><Info size={14}/>{t("Resumen","Summary")}</button>:null}</div>:null}
    <div ref={element} className={styles.stage} role={interactive||onInspect?"group":undefined} tabIndex={available||onInspect?0:undefined}
      aria-label={interactive||onInspect?`${t("Vista 3D del camión","3D truck view")}${label?`: ${label}`:""}`:undefined} aria-keyshortcuts={interactive?`ArrowLeft ArrowRight ArrowUp ArrowDown Home${onInspect?" Enter":""}`:onInspect?"Enter":undefined}
      onClick={e=>{if(!available&&onInspect&&e.target===e.currentTarget)onInspect();}}
      onKeyDown={e=>{if(e.target!==e.currentTarget)return;if(onInspect&&(e.key==="Enter"||e.key===" ")){e.preventDefault();onInspect();return;}if(!available)return;
        const action=({ArrowLeft:()=>controls.current?.rotate(Math.PI/12),ArrowRight:()=>controls.current?.rotate(-Math.PI/12),
          ArrowUp:()=>controls.current?.rotate(0,Math.PI/18),ArrowDown:()=>controls.current?.rotate(0,-Math.PI/18),Home:()=>controls.current?.reset()} as Record<string,()=>void>)[e.key];
        if(action){e.preventDefault();action();}}}
      data-truck-variant={custom||modelAssetId?"custom":variant??"articulated"} data-truck-reduced={!!reduced} data-truck-active={visible&&!hidden&&!suspended} data-truck-rotating={rotating} data-truck-state={failed?"fallback":eligible&&ready?"webgl":photo?"photo":"poster"}
      data-environment-phase={interactive?environment.phase:undefined} data-environment-mode={interactive?preview?"preview":"auto":undefined} data-environment-blend={interactive?environment.blend.toFixed(3):undefined} data-truck-moving={moving}>
      {/* Poster is rendered from this exact original 3D scene; no stock or assigned vehicle. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {photo||!custom&&!modelAssetId&&!newBody?<img className={styles.poster} src={photo??`/v2-workspace/trucks/${variant??"articulated"}-3d.png`} alt={photo?t("Foto de tu camión preferido","Preferred truck photo"):""} width={thumbnail?340:840} height={thumbnail?150:540} loading="lazy" style={{opacity:eligible&&ready&&!failed?0:1,zIndex:1}}/>:null}
      {newBody&&(!ready||failed)?<p className={styles.empty} role="status">{failed?t("Este diseño necesita un navegador con gráficos 3D disponibles.","This design requires a browser with 3D graphics available."):t("Preparando esta carrocería 3D…","Preparing this 3D body…")}</p>:null}
      {!canRender&&!photo||failed&&modelAssetId&&!photo?<p className={styles.empty} role="status">{modelAssetId&&assetState==="loading"?t("Cargando tu modelo 3D…","Loading your 3D model…"):modelAssetId?t("Modelo no disponible. Vuelve a cargar el archivo GLB.","Model unavailable. Import the GLB file again."):t("Sube una foto o un modelo 3D de tu camión.","Upload a photo or a 3D model of your truck.")}</p>:null}
      {/* Keep a ready scene mounted while offscreen; its demand loop pauses without losing the visual or controls. */}
      {eligible&&(visible||ready)&&!failed&&canRender?<SceneBoundary onFailure={markFailure}><TruckScene active={visible&&!hidden&&!suspended} reduced={!!reduced} moving={moving} onReady={markReady} onFailure={markFailure} variant={variant} designId={validDesignId} modelBlob={modelBlob} environment={interactive?environment:undefined} thumbnail={thumbnail} autoRotate={rotating} onControlsReady={receiveControls} onInteraction={stopRotation} onInspect={onInspect?()=>{element.current?.focus({preventScroll:true});onInspect();}:undefined}/></SceneBoundary>:null}
      {interactive&&previewOnly?<button type="button" className={styles.previewReset} disabled={!available} onPointerDown={event=>event.stopPropagation()} onClick={event=>{event.stopPropagation();controls.current?.reset();}} aria-label={t("Restablecer vista","Reset view")} title={t("Restablecer vista","Reset view")}><RotateCcw size={17} aria-hidden="true"/></button>:null}
      {interactive&&!previewOnly?<button type="button" className={styles.phaseButton} data-phase={environment.phase}
        aria-label={`${phaseName(environment.phase)} · ${t("Cambiar a","Switch to")} ${phaseName(nextEnvironmentPhase(environment.phase)).toLowerCase()}`}
        title={`${phaseName(environment.phase)} · ${t("Cambiar a","Switch to")} ${phaseName(nextEnvironmentPhase(environment.phase)).toLowerCase()}`}
        onPointerDown={event=>event.stopPropagation()} onClick={event=>{event.stopPropagation();setPreview(nextEnvironmentPhase(environment.phase));}}><PhaseIcon size={22} aria-hidden="true"/></button>:null}
    </div>
    {interactive&&!previewOnly?<>
      <div className={styles.controls} role="group" aria-label={t("Controles de vista 3D","3D view controls")}>
        {!minimalControls?<button type="button" disabled={!available} aria-pressed={moving} onClick={()=>{if(reduced){setMotionRequested(true);setDrive(true);}else setDrive(value=>!value);}} aria-label={moving?t("Pausar avance del camión","Pause truck motion"):t("Reanudar avance del camión","Resume truck motion")} title={reduced?t("Reproducir solo esta escena; el inicio automático respeta movimiento reducido","Play this scene only; autoplay respects reduced motion"):undefined}>{moving?<Pause size={15} aria-hidden="true"/>:<Play size={15} aria-hidden="true"/>}<span>{moving?t("Pausar avance","Pause motion"):t("Reanudar avance","Resume motion")}</span></button>:null}
        <button type="button" disabled={!available} onClick={()=>controls.current?.rotate(Math.PI/6)} aria-label={t("Girar camión a la izquierda","Rotate truck left")} title={t("Girar a la izquierda","Rotate left")}><RotateCcw size={17} aria-hidden="true"/></button>
        <button type="button" disabled={!available} onClick={()=>controls.current?.rotate(-Math.PI/6)} aria-label={t("Girar camión a la derecha","Rotate truck right")} title={t("Girar a la derecha","Rotate right")}><RotateCw size={17} aria-hidden="true"/></button>
        <button type="button" disabled={!available} onClick={()=>controls.current?.reset()} aria-label={t("Centrar vista del camión","Reset truck view")} title={t("Centrar vista","Reset view")}><Scan size={17} aria-hidden="true"/></button>
        {!minimalControls?<button type="button" disabled={!available||!!reduced} aria-pressed={rotating} onClick={()=>setAutoRotate(value=>!value)} aria-label={rotating?t("Pausar giro automático","Pause automatic rotation"):t("Iniciar giro automático","Start automatic rotation")} title={reduced?t("Giro automático desactivado por tu preferencia de movimiento reducido","Automatic rotation disabled by your reduced motion preference"):undefined}>{rotating?<Pause size={15} aria-hidden="true"/>:<Play size={15} aria-hidden="true"/>}<span>{t("Giro automático","Auto rotate")}</span></button>:null}
        <button type="button" disabled={!available} aria-label={t("Descargar vista del camión","Download truck view")} title={t("Descargar vista","Download view")} onClick={async()=>{
          if(!controls.current)return;setExportFailed(false);
          try{const blob=await controls.current.capture(),url=URL.createObjectURL(blob),anchor=document.createElement("a");
            anchor.href=url;anchor.download=`cargomesh-${custom||modelAssetId?"custom":variant??"articulated"}.png`;anchor.click();window.setTimeout(()=>URL.revokeObjectURL(url),1000);
          }catch{setExportFailed(true);}
        }}><Download size={16} aria-hidden="true"/></button>
      </div></>:null}
    {exportFailed?<p role="status" className={styles.hint}>{t("No se pudo descargar la vista. Inténtalo de nuevo.","The view could not be downloaded. Please try again.")}</p>:null}
    {!thumbnail&&caption?<figcaption>{caption}</figcaption>:null}
  </figure>;
}

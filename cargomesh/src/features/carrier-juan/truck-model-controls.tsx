"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Box, Sparkles } from "lucide-react";
import { LogisticsTruck } from "@/features/logistics-3d/logistics-truck";
import { maxTruckModelBytes } from "@/features/logistics-3d/truck-glb";
import { storeTruckModel } from "@/features/logistics-3d/truck-model-assets";
import { clearCompletedTruckGeneration, hasPendingTruckGeneration, photoToTruckModel } from "@/features/logistics-3d/photo-to-model";
import type { TruckPreference } from "./local-truck-preference";
import s from "./portal.module.css";

type Props = { preference: TruckPreference; requestId: string; onModel: (id: string, expectedPhoto: string | null) => boolean;
  t: (es: string, en: string) => string };
type Activity = { phase: "importing" | "starting" | "processing" | "saving"; progress: number | null } | null;
const endpoint = "/api/local/truck-3d";

export function TruckModelControls({ preference, requestId, onModel, t }: Props) {
  const [available,setAvailable]=useState(false),[consent,setConsent]=useState(false),[activity,setActivity]=useState<Activity>(null),[message,setMessage]=useState("");
  const abort=useRef<AbortController|null>(null), id=useId();
  const [resumable,setResumable]=useState(false);
  useEffect(()=>{const controller=new AbortController();
    fetch(endpoint,{signal:controller.signal,cache:"no-store"}).then(response=>response.json()).then(data=>setAvailable(data.available===true)).catch(()=>{});
    return()=>{controller.abort();abort.current?.abort();};
  },[]);
  useEffect(()=>{
    abort.current?.abort();setActivity(null);setMessage("");setConsent(false);setResumable(false);
    let cancelled=false;
    if(preference.photoDataUrl)hasPendingTruckGeneration(preference.photoDataUrl,requestId).then(value=>{if(!cancelled)setResumable(value);}).catch(()=>{});
    return()=>{cancelled=true;};
  },[preference.photoDataUrl,requestId]);
  const saveModel=async(blob:Blob,source:"imported"|"photo",controller:AbortController,photo:string|null)=>{
    // Decode before changing the preference so malformed assets leave the previous model intact.
    const {loadTruckGlb,disposeTruckAsset}=await import("@/features/logistics-3d/load-truck-glb");
    const decoded=await loadTruckGlb(await blob.arrayBuffer());disposeTruckAsset(decoded);
    if(controller.signal.aborted)return;
    const assetId=await storeTruckModel(blob,source);
    if(controller.signal.aborted)return;
    if(!onModel(assetId,photo))throw new Error("STORAGE");
    setMessage(t("Modelo 3D guardado. Puedes girarlo 360°.","3D model saved. You can rotate it 360°."));
  };
  const fail=(error:unknown,controller:AbortController)=>{
    if(controller.signal.aborted)return;
    const code=error instanceof Error?error.message:"";
    setMessage(code==="SUBMISSION_UNKNOWN"?t("La solicitud de generación no pudo confirmarse. Revisa tu cuenta de Tripo antes de volver a enviarla.","Generation could not be confirmed. Check your Tripo account before submitting again.")
      :code==="CREDITS"?t("No hay créditos disponibles para crear el modelo.","No credits are available to generate the model.")
      :code==="DEMO_LIMIT"?t("Se alcanzó el límite de generación de esta sesión.","This session's generation limit has been reached.")
      :code==="NOT_CONFIGURED"?t("La generación desde fotos aún no está activada.","Photo generation has not been enabled yet.")
      :["GENERATION_EXPIRED","GENERATION_PENDING"].includes(code)?t("El modelo sigue pendiente. Revisa el resultado en tu cuenta de Tripo; también puedes descargarlo y cargar aquí el GLB.","The model is still pending. Check your Tripo account; you can also download it and import the GLB here.")
      :t("No se pudo cargar el modelo. Tu foto y la selección anterior se conservan.","The model could not be loaded. Your photo and previous selection are preserved."));
  };
  return <div className={s.truckModelTools}>
    <div className={s.truckModelActions}>
      <label className={s.truckModelImport}><Box size={16} aria-hidden="true"/>{t("Cargar modelo 3D","Import 3D model")}
        <input type="file" className={s.truckFileInput} aria-label={t("Modelo 3D del camión (GLB)","Truck 3D model (GLB)")} accept=".glb,model/gltf-binary" disabled={!!activity} aria-describedby={id}
          onChange={async event=>{const file=event.target.files?.[0];event.target.value="";if(!file)return;
            if(!file.name.toLowerCase().endsWith(".glb")||file.size>maxTruckModelBytes){setMessage(t("Usa un archivo GLB con texturas incluidas, de hasta 12 MB.","Use a GLB file with embedded textures, up to 12 MB."));return;}
            abort.current?.abort();const controller=new AbortController();abort.current=controller;setMessage("");setActivity({phase:"importing",progress:null});
            try{await saveModel(file,"imported",controller,preference.photoDataUrl);}catch(error){fail(error,controller);}finally{if(!controller.signal.aborted)setActivity(null);}
          }}/>
      </label>
      <button type="button" disabled={!available||!consent||!preference.photoDataUrl||!!activity} onClick={async()=>{
        const photo=preference.photoDataUrl;if(!photo)return;
        abort.current?.abort();const controller=new AbortController();abort.current=controller;setMessage("");setActivity({phase:"starting",progress:null});
        try{
          const blob=await photoToTruckModel(photo,requestId,controller.signal,(phase,progress)=>setActivity({phase,progress}));
          await saveModel(blob,"photo",controller,photo);
          if(!controller.signal.aborted){clearCompletedTruckGeneration(requestId);setResumable(false);}
        }catch(error){fail(error,controller);}finally{if(!controller.signal.aborted)setActivity(null);}
      }}><Sparkles size={16} aria-hidden="true"/>{resumable?t("Continuar generación 3D","Resume 3D generation"):t("Crear 3D desde la foto","Create 3D from photo")}</button>
    </div>
    {available?<label className={s.truckGenerationConsent}><input type="checkbox" checked={consent} disabled={!!activity} onChange={event=>setConsent(event.target.checked)}/>
      {t("Enviar esta foto a Tripo para crear el modelo 3D. Se utilizan los créditos de la cuenta.","Send this photo to Tripo to create the 3D model. This uses account credits.")}</label>:null}
    <small id={id}>{available?t("La IA aproxima las partes que no aparecen en la foto.","AI approximates parts not visible in the photo."):t("Puedes cargar un GLB. Crear un modelo desde una foto requiere activar la conexión con Tripo.","You can import a GLB. Generating a model from a photo requires enabling the Tripo connection.")}</small>
    {activity?<div className={s.truckModelProgress} role="status"><span>{activity.phase==="importing"?t("Validando modelo…","Validating model…"):activity.phase==="starting"?t("Enviando foto…","Sending photo…"):activity.phase==="saving"?t("Preparando vista 3D…","Preparing 3D view…"):t("Creando tu modelo 3D…","Creating your 3D model…")}</span>
      <progress max={100} value={activity.progress??undefined} aria-label={t("Progreso de creación del modelo","Model creation progress")}/>{activity.progress!==null?<span>{Math.round(activity.progress)}%</span>:null}
    </div>:null}
    {message?<p className={s.truckModelMessage} role="status">{message}</p>:null}
    {preference.modelAssetId?<LogisticsTruck compact custom modelAssetId={preference.modelAssetId} photo={preference.photoDataUrl} label={preference.model||t("Mi camión","My truck")}/>:null}
  </div>;
}

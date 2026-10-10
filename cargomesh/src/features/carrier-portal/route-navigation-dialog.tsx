"use client";
import dynamic from "next/dynamic";
import { useEffect, useId, useRef } from "react";
import { Navigation, X } from "lucide-react";
import type { RouteNavigationProps } from "@/features/logistics-3d/route-navigation-3d";
import s from "./truck-inspection.module.css";
const RouteNavigation3D=dynamic(()=>import("@/features/logistics-3d/route-navigation-3d"),{ssr:false,loading:()=> <div className={s.loading} role="status">Preparando el recorrido 3D…</div>});
export function RouteNavigationDialog({onClose,...props}:RouteNavigationProps&{onClose:()=>void}){
  const dialog=useRef<HTMLDialogElement>(null),id=useId();
  useEffect(()=>{const previous=document.activeElement,overflow=document.body.style.overflow,node=dialog.current;document.body.style.overflow="hidden";node?.showModal();return()=>{node?.close();document.body.style.overflow=overflow;if(previous instanceof HTMLElement&&previous.isConnected)previous.focus({preventScroll:true});};},[]);
  return <dialog ref={dialog} className={`${s.dialog} ${s.wide}`} aria-labelledby={id} onCancel={event=>{event.preventDefault();onClose();}}>
    <header className={s.header}><div className={s.headerTitle}><span className={s.headerIcon}><Navigation size={22}/></span><div><small>Ruta del camión</small><h2 id={id}>Vista 3D</h2></div></div><button onClick={onClose} aria-label="Cerrar vista 3D"><X size={22}/></button></header>
    <RouteNavigation3D {...props}/>
  </dialog>;
}

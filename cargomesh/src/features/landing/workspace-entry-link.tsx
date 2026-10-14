"use client";
import {useEffect,useState,type ReactNode} from "react";

export function WorkspaceEntryLink({href,className,workspace,children}:{href:string;className:string;workspace:"Carrier"|"Shipper";children:ReactNode}) {
 const [opening,setOpening]=useState(false);
 useEffect(()=>{const reset=()=>setOpening(false);window.addEventListener("pageshow",reset);return()=>window.removeEventListener("pageshow",reset);},[]);
 return <a href={href} className={className} aria-busy={opening||undefined} style={{position:"relative"}}
  onClick={event=>{if(event.button===0&&!event.metaKey&&!event.ctrlKey&&!event.shiftKey&&!event.altKey)setOpening(true);}}>
  {children}
  {opening?<span role="status" aria-live="polite" style={{position:"absolute",bottom:9,right:16,fontSize:11,color:"#007780"}}>Opening {workspace} workspace…</span>:null}
 </a>;
}

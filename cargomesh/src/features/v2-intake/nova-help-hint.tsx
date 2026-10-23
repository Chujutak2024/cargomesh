"use client";
import {useEffect,useState} from "react";
import {X} from "lucide-react";
import styles from "./conversation-chat.module.css";

/** The next request question lives beside Nova, without duplicating the form's steps. */
export function NovaHelpHint({pathname,visible,language,question,onTalk,hintId='request'}:{pathname:string;visible:boolean;language:"es"|"en";question:string;onTalk:()=>void;hintId?:'transport'|'request'}){
 const [shown,setShown]=useState(false),[dismissed,setDismissed]=useState(false);
 const key="cargomesh-nova-request-question-v2:"+hintId;
 useEffect(()=>{
  if(!visible||!pathname.includes("/freight-request")||dismissed)return;
  try{if(sessionStorage.getItem(key))return;}catch{/* Help remains usable without storage. */}
  const timer=setTimeout(()=>setShown(true),700);
  return ()=>clearTimeout(timer);
 },[pathname,visible,dismissed]);
 function dismiss(){setShown(false);setDismissed(true);try{sessionStorage.setItem(key,"seen");}catch{/* Optional session preference. */}}
 if(!visible||!shown||dismissed)return null;
 return <aside className={styles.helpHint} aria-label={language==='es'?'Ayuda de Nova':'Nova help'}>
  <button type="button" className={styles.helpDismiss} aria-label={language==='es'?'Cerrar sugerencia de Nova':'Dismiss Nova suggestion'} onClick={dismiss}><X size={14} aria-hidden="true"/></button>
  <p role="status"><button type="button" className={styles.helpQuestion} onClick={()=>{dismiss();onTalk();}}>{question}</button></p>
 </aside>;
}

"use client";
import {useEffect,useRef,useState,type ReactNode,type RefObject} from 'react';
import {CarrierUpdating} from './carrier-loading';

/** Starts once near the viewport. No background canvas for offscreen regions. */
export function useVisibleWork(ref:RefObject<Element|null>,enabled=true){
 const [visible,setVisible]=useState(false);
 useEffect(()=>{
  if(!enabled||visible)return;
  const node=ref.current;if(!node)return;
  if(typeof IntersectionObserver==='undefined'){setVisible(true);return;}
  const observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){setVisible(true);observer.disconnect();}},{rootMargin:'120px'});
  observer.observe(node);return()=>observer.disconnect();
 },[enabled,visible,ref]);
 return visible;
}
export function DeferredRegion({children,minHeight=280}:{children:ReactNode;minHeight?:number}){
 const ref=useRef<HTMLDivElement>(null),visible=useVisibleWork(ref);
 return <div ref={ref} style={{minHeight,width:'100%'}}>{visible?children:<div role="status" style={{minHeight,display:'grid',placeItems:'center',background:'var(--cm-color-surface-subtle)',borderRadius:12}}><CarrierUpdating/></div>}</div>;
}

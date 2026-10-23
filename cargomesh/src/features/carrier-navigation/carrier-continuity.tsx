"use client";
import {createContext,useCallback,useContext,useEffect,useRef,useState,useSyncExternalStore,type Dispatch,type ReactNode,type SetStateAction} from 'react';
import {useLocale} from '@/features/i18n/locale-provider';
import {BackgroundRefreshProvider} from './background-refresh';
import {CarrierPageTransitions} from './carrier-page-transitions';
type Store={values:Map<string,unknown>;listeners:Set<()=>void>;clear:()=>void};
const Context=createContext<Store|null>(null);
/** Memory belongs to this mounted authorized workspace, never browser storage. */
export function CarrierContinuityProvider({children}:{children:ReactNode}){
 const {t}=useLocale(),[revoked,setRevoked]=useState(false);
 const [store]=useState<Store>(()=>{
  const values=new Map<string,unknown>(),listeners=new Set<()=>void>();
  return {values,listeners,clear:()=>{values.clear();listeners.forEach(listener=>listener());}};
 });
 useEffect(()=>{
  const clear=()=>{store.clear();setRevoked(true);};window.addEventListener('cm-carrier-access-revoked',clear);
  return()=>{window.removeEventListener('cm-carrier-access-revoked',clear);store.values.clear();};
 },[store]);
 return <Context.Provider value={store}><BackgroundRefreshProvider><CarrierPageTransitions/>{revoked?<section role="alert"><h2>{t('El acceso cambió','Access changed')}</h2><p>{t('Actualiza para consultar el espacio autorizado.','Refresh to read the authorized workspace.')}</p><button type="button" onClick={()=>window.location.reload()}>{t('Actualizar','Refresh')}</button></section>:children}</BackgroundRefreshProvider></Context.Provider>;
}
/** Last reads are presentation; a fresh read still gates commands. */
export function useCarrierMemoryState<T>(key:string,initial:T|(()=>T)):[T,Dispatch<SetStateAction<T>>]{
 const store=useContext(Context),fallback=useRef<{key:string;value:T}|null>(null);
 if(fallback.current?.key!==key)fallback.current={key,value:typeof initial==='function'?(initial as ()=>T)():initial};
 const defaultValue=fallback.current!.value;
 const subscribe=useCallback((listener:()=>void)=>{if(!store)return()=>{};store.listeners.add(listener);return()=>{store.listeners.delete(listener);};},[store]);
 const read=useCallback(()=>store?.values.has(key)?store.values.get(key) as T:fallback.current!.value,[store,key]);
 const value=useSyncExternalStore(subscribe,read,()=>defaultValue);
 const [,render]=useState(0);
 const set=useCallback<Dispatch<SetStateAction<T>>>(next=>{
  const previous=store?.values.has(key)?store.values.get(key) as T:fallback.current!.value;
  const updated=typeof next==='function'?(next as (value:T)=>T)(previous):next;
  if(store){store.values.set(key,updated);store.listeners.forEach(listener=>listener());}
  else{fallback.current={key,value:updated};render(revision=>revision+1);}
 },[key,store]);
 return [value,set];
}
export function useCarrierScrollMemory(route:string,scope:string){
 const store=useContext(Context);
 useEffect(()=>{
  const node=document.querySelector<HTMLElement>('[data-carrier-scroll]');if(!node)return;
  const key='scroll:'+scope+':'+route,previous=store?.values.get(key);
  const remember=()=>store?.values.set(key,node.scrollTop);
  node.addEventListener('scroll',remember,{passive:true});
  const frame=requestAnimationFrame(()=>node.scrollTo({top:typeof previous==='number'?previous:0,behavior:'instant'}));
  return()=>{cancelAnimationFrame(frame);node.removeEventListener('scroll',remember);};
 },[route,scope,store]);
}

'use client';
import {createContext,useCallback,useContext,useEffect,useRef,useState,useSyncExternalStore,type Dispatch,type ReactNode,type SetStateAction} from 'react';
import {usePathname,useSearchParams} from 'next/navigation';
import {useLocale} from '@/features/i18n/locale-provider';
import {WorkspaceSkeleton,WorkspaceUpdating,type WorkspaceShape} from '@/features/product-motion/workspace-skeleton';
import s from './client-continuity.module.css';

type Memory={pages:Map<string,ReactNode>;values:Map<string,unknown>;listeners:Set<()=>void>;revision:number;revoked:boolean;notify:()=>void};
const Context=createContext<Memory|null>(null);
const invalidateEvent='cm-client-access-revoked';

/** Mounted identity owns this memory; pages are keyed by locale. Nothing is stored on disk or shared across users. */
export function ClientContinuityProvider({children,enabled=true}:{children:ReactNode;enabled?:boolean}){
 const {t}=useLocale();
 const [memory]=useState<Memory>(()=>{
  const value:Memory={pages:new Map(),values:new Map(),listeners:new Set(),revision:0,revoked:false,notify:()=>{value.revision++;value.listeners.forEach(listener=>listener());}};
  return value;
 });
 useEffect(()=>{
  const revoke=()=>{memory.pages.clear();memory.values.clear();memory.revoked=true;memory.notify();};
  const leave=(event:SubmitEvent)=>{if(event.target instanceof HTMLFormElement&&/\/api\/(?:auth\/logout|local\/client-session)/.test(event.target.action)){memory.pages.clear();memory.values.clear();memory.notify();}};
  window.addEventListener(invalidateEvent,revoke);document.addEventListener('submit',leave,true);
  return()=>{window.removeEventListener(invalidateEvent,revoke);document.removeEventListener('submit',leave,true);memory.pages.clear();memory.values.clear();};
 },[memory]);
 const subscribe=useCallback((listener:()=>void)=>{memory.listeners.add(listener);return()=>{memory.listeners.delete(listener);};},[memory]);
 useSyncExternalStore(subscribe,()=>memory.revision,()=>0);
 return <Context.Provider value={enabled?memory:null}>{memory.revoked?<section role="alert"><p>{t('El acceso cambió. Actualiza para continuar.','Access changed. Refresh to continue.')}</p><button type="button" onClick={()=>window.location.reload()}>{t('Actualizar','Refresh')}</button></section>:children}</Context.Provider>;
}

function usePageMemory(){
 const memory=useContext(Context),path=usePathname(),params=useSearchParams(),{locale}=useLocale();
 const query=new URLSearchParams(params.toString());query.sort();
 const key=locale+':'+path+'?'+query.toString();
 const subscribe=useCallback((listener:()=>void)=>{memory?.listeners.add(listener);return()=>{memory?.listeners.delete(listener);};},[memory]);
 useSyncExternalStore(subscribe,()=>memory?.revision??0,()=>0);
 return {memory,key,path,offset:params.get('offset')??'0'};
}

/** Only a server-resolved page is registered, never its loading boundary. */
export function ClientRouteContent({children,route,offset='0'}:{children:ReactNode;route:string;offset?:string}){
 const {memory,key,path,offset:currentOffset}=usePageMemory();
 useEffect(()=>{
  // Next may retain the old tree during a transition. Never register it under the destination.
  if(!memory||memory.revoked||path!==route||Number(currentOffset)!==Number(offset)||memory.pages.get(key)===children)return;
  memory.pages.delete(key);memory.pages.set(key,children);
  if(memory.pages.size>20)memory.pages.delete(memory.pages.keys().next().value!);
  memory.notify();
 },[memory,key,path,route,offset,currentOffset,children]);
 return <>{children}</>;
}

/** Old reads remain visible but inert until the server completes the current authorization/read. */
export function ClientRouteLoading({shape='table',label}:{shape?:WorkspaceShape;label?:string}){
 const {memory,key}=usePageMemory(),{t}=useLocale(),cached=memory?.pages.get(key);
 return <section className={s.region} aria-busy="true" data-client-route-loading={cached?'refresh':'first-visit'}>
  {cached?<><div className={s.updating}><WorkspaceUpdating>{t('Actualizando…','Updating…')}</WorkspaceUpdating></div><div inert aria-hidden="true" className={s.previous}>{cached}</div></>:<WorkspaceSkeleton shape={shape} label={label??t('Cargando sección','Loading section')}/>}
 </section>;
}

/** Last successful reads and presentation state survive page unmounts, within this provider only. */
export function useClientMemoryState<T>(key:string,initial:T|(()=>T)):[T,Dispatch<SetStateAction<T>>]{
 const memory=useContext(Context),fallback=useRef<{key:string;value:T}|null>(null);
 if(fallback.current?.key!==key)fallback.current={key,value:typeof initial==='function'?(initial as ()=>T)():initial};
 const defaultValue=fallback.current!.value;
 const subscribe=useCallback((listener:()=>void)=>{memory?.listeners.add(listener);return()=>{memory?.listeners.delete(listener);};},[memory]);
 const read=useCallback(()=>memory?.values.has(key)?memory.values.get(key) as T:fallback.current!.value,[memory,key]);
 const value=useSyncExternalStore(subscribe,read,()=>defaultValue),[,render]=useState(0);
 const set=useCallback<Dispatch<SetStateAction<T>>>(next=>{
  if(memory?.revoked)return;
  const previous=memory?.values.has(key)?memory.values.get(key) as T:fallback.current!.value;
  const updated=typeof next==='function'?(next as (value:T)=>T)(previous):next;
  if(Object.is(previous,updated))return;
  if(memory){memory.values.set(key,updated);memory.notify();}else{fallback.current={key,value:updated};render(revision=>revision+1);}
 },[memory,key]);
 return [value,set];
}

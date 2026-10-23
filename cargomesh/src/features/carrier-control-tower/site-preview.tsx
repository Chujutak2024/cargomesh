'use client';
import dynamic from 'next/dynamic';
import {useEffect,useRef} from 'react';
import {X} from 'lucide-react';
import {Button} from '@/components/ui';
import {useLocale} from '@/features/i18n/locale-provider';
import {displayDemoText} from '@/shared/lib/demo-presentation';
import {createDepotCoordinator,createDepotScenario,type DepotCoordinator} from '@/features/logistics-3d/depot-coordinator';
import type {TowerSite} from './tower-model';
import s from './tower.module.css';
const DepotArrival=dynamic(()=>import('@/features/logistics-3d/depot-arrival'),{ssr:false,loading:()=> <p role="status">Preparing the 3D site…</p>});

/** A presentation-only yard: these vehicles never become recorded site assets. */
export function TowerSitePreview({site,onClose}:{site:TowerSite|null;onClose:()=>void}){
 const {t}=useLocale(),controllers=useRef(new Map<string,DepotCoordinator>()),host=useRef<HTMLElement>(null);
 if(site&&!controllers.current.has(site.id)){
  const scenario=createDepotScenario();
  const controller=createDepotCoordinator({...scenario,scenarioId:'tower-site-demo-'+site.id,siteId:site.id});
  controllers.current.set(site.id,controller);
 }
 const controller=site?controllers.current.get(site.id):undefined;
 useEffect(()=>{
  if(!site)return;
  const previous=document.activeElement instanceof HTMLElement?document.activeElement:null;
  host.current?.querySelector<HTMLButtonElement>('button')?.focus({preventScroll:true});
  return()=>{if(previous?.isConnected)previous.focus({preventScroll:true});};
 },[site?.id]);
 useEffect(()=>{
  if(!site)return;
  const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();onClose();}};
  document.addEventListener('keydown',escape);
  return()=>document.removeEventListener('keydown',escape);
 },[site?.id,onClose]);
 if(!site||!controller)return null;
 return <section ref={host} className={s.siteInline} role="region" aria-label={t('Vista animada de la sede','Animated site view')}>
  <header className={s.siteInlineHeader}><div><strong>{displayDemoText(site.name)}</strong><small>{site.location} · {t('Demo visual · sin datos en vivo','Visual demo · no live data')}</small></div><Button variant="secondary" size="compact" aria-label={t('Volver al mapa','Back to map')} onClick={onClose}><X size={18}/></Button></header>
  <DepotArrival key={site.id} compact coordinator={controller} context={{depot:{name:site.name,city:site.location,carrier:null,color:'#147d88',site:null,planned:false}}}/>
 </section>;
}

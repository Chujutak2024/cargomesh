'use client';
import dynamic from 'next/dynamic';
import {useEffect,useRef} from 'react';
import {Dialog} from '@/components/ui';
import {CarrierLink} from '@/features/carrier-navigation/carrier-link';
import {useLocale} from '@/features/i18n/locale-provider';
import {createDepotCoordinator,type DepotCoordinator} from '@/features/logistics-3d/depot-coordinator';
import {depotTemplates,type DepotTemplateId} from '@/features/logistics-3d/depot-templates';
import type {TowerSite} from './tower-model';
import s from './tower.module.css';

const DepotArrival=dynamic(()=>import('@/features/logistics-3d/depot-arrival'),{ssr:false,loading:()=> <p role="status">Preparing the 3D site…</p>});
const principalDesignIds:readonly DepotTemplateId[]=['distribution','urban-courtyard','cold-campus','service-yard','cross-dock'];
const principalDesigns=principalDesignIds.map(id=>depotTemplates.find(template=>template.id===id)!);

/** The selected catalog site labels an illustrative architecture, never a live yard. */
export function TowerSitePreview({site,onClose}:{site:TowerSite|null;onClose:()=>void}){
 const {t}=useLocale(),controllers=useRef(new Map<string,DepotCoordinator>());
 if(site&&!controllers.current.has(site.id)){
  const controller=createDepotCoordinator({scenarioId:'tower-site-reference-'+site.id,siteId:site.id,source:'SIMULATED',durationMs:90000,vehicles:[],events:[]});
  controller.setPlaying(false);controllers.current.set(site.id,controller);
 }
 const controller=site?controllers.current.get(site.id):undefined;
 useEffect(()=>{if(controller&&!principalDesignIds.includes(controller.getSnapshot().templateId))controller.setTemplate('distribution');},[controller]);
 return <Dialog open={!!site} animated title={site?.name??t('Sede 3D','3D site')} description={t('Referencia visual de la sede seleccionada.','Visual reference for the selected site.')} closeLabel={t('Cerrar','Close')} onClose={onClose} className={s.siteDialog}>
  {site&&controller?<>
   <div className={s.sitePreviewHeading}><span>{site.location||t('Ubicación sin registrar','Location not recorded')}</span><CarrierLink href="/carriers/sites">{t('Ver ficha de la sede','View site record')}</CarrierLink></div>
   <label className={s.siteDesign}>{t('Diseño ilustrativo','Illustrative design')} · {principalDesigns.length} {t('modelos principales','main designs')}<select aria-label={t('Diseño ilustrativo de la sede','Illustrative site design')} defaultValue={principalDesignIds.includes(controller.getSnapshot().templateId)?controller.getSnapshot().templateId:'distribution'} onChange={event=>controller.setTemplate(event.target.value as DepotTemplateId)}>{principalDesigns.map(template=><option value={template.id} key={template.id}>{template.name}</option>)}</select></label>
   <DepotArrival referenceOnly coordinator={controller} context={{depot:{name:site.name,city:site.location,carrier:null,color:'#147d88',site:null,planned:false}}}/>
  </>:null}
 </Dialog>;
}

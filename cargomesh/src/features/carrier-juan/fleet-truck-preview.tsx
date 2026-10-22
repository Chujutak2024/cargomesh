"use client";

import dynamic from 'next/dynamic';
import {useEffect,useRef,useState} from 'react';
import {useLocale} from '@/features/i18n/locale-provider';
import {fleetReferencePhoto} from './fleet-photos';
import type {FleetVehicle} from './fleet-model';
import s from './fleet.module.css';

const TruckPreview=dynamic(()=>import('@/features/logistics-3d/logistics-truck').then(module=>module.LogisticsTruck),{ssr:false});

/** References vary only within the recorded equipment/body family; photos take precedence. */
export function FleetTruckPreview({vehicle}:{vehicle:FleetVehicle}){
  const {t}=useLocale(),element=useRef<HTMLDivElement>(null);
  const [visible,setVisible]=useState(false);
  const photo=fleetReferencePhoto(vehicle);
  useEffect(()=>{
    if(!vehicle.visual||vehicle.photoDataUrl)return;
    const media=window.matchMedia('(min-width: 768px)');
    let intersects=false;
    const update=()=>setVisible(intersects&&media.matches&&!document.hidden);
    const observer=new IntersectionObserver(entries=>{intersects=entries.some(entry=>entry.isIntersecting);update();});
    if(element.current)observer.observe(element.current);
    media.addEventListener('change',update);document.addEventListener('visibilitychange',update);
    return()=>{observer.disconnect();media.removeEventListener('change',update);document.removeEventListener('visibilitychange',update);};
  },[vehicle.visual?.designId,vehicle.photoDataUrl]);
  return <>
    <div ref={element} className={s.directoryPreview}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photo.src} width={1200} height={800} loading="lazy" decoding="async" style={{objectPosition:photo.position}} alt={t(photo.es,photo.en)}/>
      {visible&&vehicle.visual&&!vehicle.photoDataUrl?<div className={s.directoryModel} aria-hidden="true"><TruckPreview thumbnail variant={vehicle.visual.family} designId={vehicle.visual.designId}/></div>:null}
    </div>
    <span className={s.imageCaption}>{vehicle.photoDataUrl?t('Foto del camión','Truck photo'):vehicle.visual?t('Modelo de referencia','Model reference'):t('Referencia del tipo','Type reference')}</span>
  </>;
}

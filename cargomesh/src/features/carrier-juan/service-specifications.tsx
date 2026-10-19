"use client";
import {useEffect,useId,useRef} from 'react';
import {ClipboardList,X} from 'lucide-react';
import {recordData,type PortalRecord} from '@/features/carrier-portal/records';
import s from './fleet.module.css';

/** Read-only service limits, separate from the data-source disclosure. */
export function ServiceSpecifications({service}:{service:PortalRecord}){
 const ref=useRef<HTMLDetailsElement>(null),id=useId();
 const data=recordData(service),temperature=data.temperatureRange as {minCelsius:number;maxCelsius:number}|null;
 const weight=typeof data.maxWeightKg==='number'?data.maxWeightKg>=1000?`Up to ${new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(data.maxWeightKg/1000)} t`:`Up to ${data.maxWeightKg.toLocaleString('en-US')} kg`:'Not specified';
 const close=()=>{if(ref.current){ref.current.open=false;ref.current.querySelector('summary')?.focus({preventScroll:true});}};
 useEffect(()=>{
  const outside=(event:PointerEvent)=>{if(ref.current?.open&&event.target instanceof Node&&!ref.current.contains(event.target))ref.current.open=false;};
  document.addEventListener('pointerdown',outside);
  return()=>document.removeEventListener('pointerdown',outside);
 },[]);
 return <details ref={ref} className={s.serviceSpecifications} onKeyDown={event=>{if(event.key==='Escape'&&ref.current?.open){event.preventDefault();event.stopPropagation();close();}}} onBlur={event=>{if(event.relatedTarget instanceof Node&&!event.currentTarget.contains(event.relatedTarget))event.currentTarget.open=false;}}>
  <summary aria-label="Service specifications" title="Service specifications" aria-controls={id}><ClipboardList size={17} aria-hidden="true"/></summary>
  <section id={id} className={s.specificationsPanel} role="region" aria-labelledby={id+'-title'}>
   <div className={s.specificationsHeading}><h3 id={id+'-title'}>Service specifications</h3><button type="button" aria-label="Close service specifications" onClick={close}><X size={15} aria-hidden="true"/></button></div>
   <dl><div><dt>Declared capacity</dt><dd>{weight}</dd></div><div><dt>Temperature</dt><dd>{temperature?`${temperature.minCelsius} to ${temperature.maxCelsius} °C`:'Not specified'}</dd></div>{data.status!=='ACTIVE'?<div><dt>Status</dt><dd>{({INACTIVE:'Inactive',SUSPENDED:'Suspended'} as Record<string,string>)[String(data.status)]??String(data.status)}</dd></div>:null}</dl>
  </section>
 </details>;
}

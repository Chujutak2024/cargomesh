"use client";
import {useLocale} from '@/features/i18n/locale-provider';
import s from './carrier-loading.module.css';
type Shape='cards'|'table'|'detail'|'dashboard'|'agenda';
export function CarrierSkeleton({shape='cards',label}:{shape?:Shape;label?:string}){
 const {t}=useLocale();
 return <section className={s.skeleton} data-shape={shape} aria-busy="true" role="status" aria-label={label??t('Cargando información','Loading information')}>
  <span className={s.srOnly}>{label??t('Cargando información','Loading information')}</span>
  <div aria-hidden="true" className={s.header}><i/><i/></div>
  {(shape==='dashboard'||shape==='cards')?<div aria-hidden="true" className={s.metrics}>{[0,1,2,3].map(id=><div key={id}><i/><b/></div>)}</div>:null}
  <div aria-hidden="true" className={s.body}>{Array.from({length:shape==='table'||shape==='agenda'?5:shape==='detail'?2:3},(_,id)=><div className={s.block} key={id}>{shape==='cards'||shape==='dashboard'?<div className={s.picture}/>:null}<i/><i/><i/></div>)}</div>
 </section>;
}
export function CarrierUpdating({children}:{children?:string}){
 const {t}=useLocale();return <span className={s.updating} role="status"><i aria-hidden="true"/>{children??t('Actualizando…','Updating…')}</span>;
}

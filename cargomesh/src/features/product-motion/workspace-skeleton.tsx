import s from './workspace-skeleton.module.css';

export type WorkspaceShape='table'|'detail'|'sites'|'dashboard'|'form';
/** Presentation only: skeletons never stand in for records or business state. */
export function WorkspaceSkeleton({shape='table',variant='default',label='Cargando información / Loading information'}:{shape?:WorkspaceShape;variant?:'default'|'carrier-sites';label?:string}){
 const cards=shape==='sites'||shape==='dashboard';
 const carrierSites=shape==='sites'&&variant==='carrier-sites';
 return <section className={s.skeleton} data-shape={shape} data-variant={variant} aria-busy="true" role="status" aria-label={label}>
  <span className={s.srOnly}>{label}</span>
  {!carrierSites?<div aria-hidden="true" className={s.heading}><i/><i/></div>:null}
  {shape==='dashboard'?<div className={s.metrics} aria-hidden="true">{[0,1,2,3].map(n=><div key={n}><i/><b/></div>)}</div>:null}
  <div aria-hidden="true" className={s.body}>{Array.from({length:cards?3:shape==='table'?5:2},(_,n)=><div className={s.block} key={n}>
   {cards&&!carrierSites?<div className={s.image}/>:null}<i/><i/><i/>
  </div>)}</div>
 </section>;
}
export function WorkspaceUpdating({children='Actualizando… / Updating…'}:{children?:string}){
 return <span className={s.updating} role="status"><i aria-hidden="true"/>{children}</span>;
}

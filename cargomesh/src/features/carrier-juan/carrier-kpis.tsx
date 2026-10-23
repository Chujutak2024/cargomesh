import s from './carrier-kpis.module.css';

type Kpi={id:string;label:string;value:number|null;tone:'blue'|'teal'|'violet'|'indigo';art:'opportunities'|'response-window'|'accepted'|'fleet-truck'|'fleet-shield'|'fleet-wrench'|'fleet-calendar'|'fleet-incidents';format?:'percent';description?:string};
const numbers=new Intl.NumberFormat('en-US');
const percentages=new Intl.NumberFormat('en-US',{maximumFractionDigits:1});

/** Read-only metric presentation. Counts and scope belong to the connected reader. */
export function CarrierKpis({metrics,partial=false,label='Commercial overview, loaded records'}:{metrics:Kpi[];partial?:boolean;label?:string}){
 return <div className={s.overview}>
  <dl className={s.grid} data-carrier-motion-group data-columns={metrics.length===4?4:3} aria-label={label}>
   {metrics.map(metric=><div className={s.card} data-tone={metric.tone} key={metric.id} title={metric.description}>
    <dt>{metric.label}</dt>
    <dd><span className={s.value} aria-label={metric.value===null?'Not available':undefined}>{metric.value===null?'—':(metric.format==='percent'?percentages.format(metric.value)+'%':numbers.format(metric.value))+(partial?'+':'')}</span>
     {/* Static isometric artwork keeps the figures readable while content loads. */}
     {/* eslint-disable-next-line @next/next/no-img-element */}
     <img className={s.artwork} src={'/carrier-kpis/'+metric.art+'.svg'} width={240} height={200} alt="" aria-hidden="true" draggable={false}/>
     {metric.description?<span className={s.srOnly}>{metric.description}</span>:null}
    </dd>
   </div>)}
  </dl>
 </div>;
}

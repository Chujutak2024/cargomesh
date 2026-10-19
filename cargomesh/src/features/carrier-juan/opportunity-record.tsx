"use client";
import {useState,type ReactNode,type Ref} from 'react';
import {motion} from 'motion/react';
import {ArrowLeftRight,ArrowRight,CalendarDays,ChevronDown,Clock3,FileText,Info,MapPin,Package,RefreshCw,ShieldAlert,Tag,Truck,Weight} from 'lucide-react';
import type {Opportunity} from '@/features/carrier-portal/commercial-model';
import {CargoSpecificationV2Schema} from '@/shared/schemas/v2/freight-request';
import {LogisticsTruck} from '@/features/logistics-3d/logistics-truck';
import {PRODUCT_MOTION} from '@/features/product-motion/content-motion';
import {useReducedMotionPreference} from '@/features/product-motion/use-motion-preference';
import {opportunityFacts,opportunityLabel} from './opportunity-model';
import s from './opportunity-record.module.css';

/** Display alias only. Canonical references and links remain unchanged. */
export function shortRequestReference(row:Opportunity){
 const code=opportunityFacts(row).reference;
 return /^V2-[0-9a-f]{32}$/i.test(code)?'REQ · '+code.slice(3,11).toUpperCase():code;
}
const words=(code:string)=>code.replace(/[_-]/g,' ').toLowerCase().replace(/^./,c=>c.toUpperCase());
const labels:Record<string,string>={
 ROUTE_PAYLOAD_LIMIT_UNKNOWN:'Confirm the road payload limit',
 ROUTE_MANUFACTURER_LIMITS_UNKNOWN:'Confirm vehicle manufacturer limits',
 CORRIDOR_LIMITS_UNKNOWN:'Confirm restrictions along the route',
 'REQUIREMENT_UNVERIFIED:KEEP_DRY':'Confirm protection from moisture',
 KEEP_DRY:'Keep dry',HAC50_SCENARIO_GENERAL:'General cargo (test scenario)',GENERAL:'General cargo',GENERAL_CARGO:'General cargo',BOX:'Box',PALLET:'Pallet',
};
const friendly=(code:string)=>labels[code]??words(code);
const checkLabel=(code:string)=>labels[code]??(code.startsWith('REQUIREMENT_UNVERIFIED:')?'Confirm: '+friendly(code.slice(23)):'Additional operational check required');
const amount=(value:number|null,unit:string)=>value===null?'Not provided':value.toLocaleString('en-US')+' '+unit;
const day=(value:string)=>new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(value));
const time=(value:string)=>new Intl.DateTimeFormat('en-GB',{hour:'2-digit',minute:'2-digit',hourCycle:'h23',timeZone:'UTC'}).format(new Date(value));
function WindowValue({value}:{value:{startsAt:string;endsAt:string}|null}){
 if(!value)return <>Not provided</>;
 const same=day(value.startsAt)===day(value.endsAt);
 return <>{day(value.startsAt)}<span>{time(value.startsAt)} – {same?'':day(value.endsAt)+' '}{time(value.endsAt)} UTC</span></>;
}
function Field({label,children,icon:Icon}:{label:string;children:ReactNode;icon?:typeof FileText}){return <div>{Icon?<Icon className={s.factIcon} size={20} aria-hidden="true"/>:null}<dt>{label}</dt><dd>{children}</dd></div>;}
function Disclosure({title,children,icon:Icon=FileText}:{title:string;children:ReactNode;icon?:typeof FileText}){
 const [open,setOpen]=useState(false),reduced=useReducedMotionPreference();
 return <section className={s.disclosure}>
  <motion.button type="button" aria-expanded={open} onClick={()=>setOpen(!open)} whileTap={reduced?undefined:{scale:.995}} transition={{duration:PRODUCT_MOTION.fast}}>
   <span><Icon size={16} aria-hidden="true"/>{title}</span><ChevronDown size={16} aria-hidden="true" style={{transform:open?'rotate(180deg)':undefined}}/>
  </motion.button>
  {open?<motion.div className={s.disclosed} initial={reduced?false:{opacity:0,height:0}} animate={{opacity:1,height:'auto'}} transition={{duration:reduced?0:PRODUCT_MOTION.panel,ease:PRODUCT_MOTION.ease}}>{children}</motion.div>:null}
 </section>;
}

export function OpportunityRecord({row,headingRef,busy,onRefresh}:{row:Opportunity;headingRef:Ref<HTMLHeadingElement>;busy:boolean;onRefresh:()=>void}){
 const f=opportunityFacts(row),brief=f.brief,cargo=CargoSpecificationV2Schema.safeParse(row.data.cargoSpecification);
 const c=cargo.success?cargo.data:null;
 // This local seed label is not a cargo description. Preserve actual descriptions.
 const description=/^\[SIMULATED\]\s*Inbox(?:\s|$)/.test(f.description)?null:f.description;
 return <article className={s.record} data-opportunity-record aria-label="Read-only customer request">
  <header className={s.header}>
   <div className={s.identity}><div><h2 ref={headingRef} tabIndex={-1}>{shortRequestReference(row)}</h2><p className={s.received}>Received {day(row.data.sentAt)} · {time(row.data.sentAt)} UTC · revision {row.version}</p></div><span className={s.status}><Clock3 size={14} aria-hidden="true"/>{opportunityLabel(row.status)}</span></div>
   <div className={s.route} aria-label="Requested route"><div className={s.stop}><span className={s.pin}><MapPin size={22} aria-hidden="true"/></span><div><small>Pickup city</small><strong>{f.origin}</strong></div></div><div className={s.routeLine}><ArrowRight size={18} aria-hidden="true"/></div><div className={s.stop}><span className={s.pin}><MapPin size={22} aria-hidden="true"/></span><div><small>Delivery city</small><strong>{f.destination}</strong></div></div></div>
  </header>
  <div className={s.body}>
   {f.projectionInvalid?<p role="alert" className={s.alert}>Request details could not be verified. Refresh before responding.</p>:null}
   {brief&&!brief.isCurrent?<p role="alert" className={s.alert}>This is an earlier request version. A refreshed opportunity is needed before accepting.</p>:brief&&!brief.canReview?<p className={s.alert}>The customer request is no longer open for review.</p>:null}
   <div className={s.groups}>
    <section className={`${s.group} ${s.schedule}`}><h3><CalendarDays size={19} aria-hidden="true"/>Schedule</h3><dl className={s.fields}>
     <Field label="Pickup"><WindowValue value={f.pickup}/></Field><Field label="Delivery"><WindowValue value={f.delivery}/></Field>
    </dl><p className={s.hint}><Info size={13} aria-hidden="true"/>All times shown in UTC.</p></section>
    <section className={s.group}><h3><FileText size={19} aria-hidden="true"/>Request context</h3><dl className={`${s.fields} ${s.contextFields}`}>
     <Field label="Customer">Name not shared at this stage</Field><Field label="Request version">{brief?.requestVersion??'Not recorded'}</Field>
     <Field label="Required equipment">{brief?.requiredEquipment?friendly(brief.requiredEquipment):'No specific equipment requested'}</Field>
     <Field label="Preferred equipment">{brief?.preferredEquipment?friendly(brief.preferredEquipment):'No preference recorded'}</Field>
    </dl></section>
   </div>
   <section className={`${s.group} ${s.cargoSummary}`}><h3><Package size={19} aria-hidden="true"/>Cargo summary</h3>{description?<p className={s.description}>{description}</p>:null}
    <dl className={`${s.fields} ${s.cargoTotals}`}><Field label="Total weight" icon={Weight}>{amount(f.weightKg,'kg')}</Field><Field label="Total volume" icon={Package}>{amount(f.volumeM3,'m³')}</Field><Field label="Category" icon={Tag}>{friendly(row.data.cargoSpecification.categoryCode)}</Field><Field label="Can be split" icon={ArrowLeftRight}>{c?(c.divisible?'Yes':'No'):'Not provided'}</Field></dl>
   </section>
   <section className={`${s.group} ${s.packagePanel}`}><h3><Package size={19} aria-hidden="true"/>Packages and handling</h3>
    {c?<><div className={s.tableWrap}><table><caption className={s.srOnly}>Packages and handling</caption><thead><tr><th>Package</th><th>Qty</th><th>Weight / unit</th><th>Volume / unit</th><th>Size (cm)</th><th>Handling</th></tr></thead><tbody>{c.units.map((unit,i)=><tr key={i}><td>{friendly(unit.packageType)}</td><td>{unit.quantity}</td><td>{amount(unit.weightPerUnitKg,'kg')}</td><td>{amount(unit.volumePerUnitM3,'m³')}</td><td>{unit.dimensionsCm.length} × {unit.dimensionsCm.width} × {unit.dimensionsCm.height}</td><td>{unit.stackable?'Stackable':'Do not stack'}{unit.indivisible?' · Keep whole':''}</td></tr>)}</tbody></table></div>
    <p className={`${s.hint} ${s.requirements}`}><ShieldAlert size={15} aria-hidden="true"/><span><strong>Requirements: </strong>{c.requirements.length?c.requirements.map(friendly).join(' · '):'None recorded'}{c.temperatureRange?' · '+c.temperatureRange.minCelsius+' to '+c.temperatureRange.maxCelsius+' °C':''}</span></p></>:<p className={s.hint}>Package details need review before preparing an offer.</p>}
   <p className={s.locationNote}><Info size={12} aria-hidden="true"/>City-level locations · exact addresses and contacts not shared</p>
  <footer className={s.footer}><small>Updated {day(row.updatedAt)} · {time(row.updatedAt)} UTC · revision {row.version}</small><details className={s.references}><summary>Record IDs</summary><dl><Field label="Request ID"><code>{row.requestId}</code></Field><Field label="Opportunity ID"><code>{row.id}</code></Field></dl></details><button disabled={busy} onClick={onRefresh}><RefreshCw size={14} aria-hidden="true"/>Refresh</button></footer>
   </section>
  </div>
 </article>;
}

/** Operational uncertainty stays visible; the supporting checks are secondary. */
export function OpportunityChecks({row}:{row:Opportunity}){
 const brief=opportunityFacts(row).brief;
 if(!brief||brief.planEligibility==='eligible')return null;
 const checks=[...new Set([...brief.pendingRequirements,...brief.exclusionReasons])];
 return <div className={s.checkSummary}>
  <p className={s.checkNote} role={brief.planEligibility==='ineligible'?'alert':undefined}><ShieldAlert size={14} aria-hidden="true"/>{brief.planEligibility==='ineligible'?'Transport plan not eligible':'Coverage and capacity not confirmed'}</p>
  {checks.length?<Disclosure title={checks.length+' checks to review'} icon={ShieldAlert}><ul className={s.checkList}>{checks.map(code=><li key={code}>{checkLabel(code)}</li>)}</ul></Disclosure>:null}
 </div>;
}

export function OpportunityTruck(){
 return <section className={s.illustration} aria-label="Reference truck illustration"><h3><Truck size={17} aria-hidden="true"/>Truck illustration</h3><LogisticsTruck compact caption="Reference model · no vehicle assigned"/></section>;
}

"use client";
import type {ReactNode,Ref} from 'react';
import {opportunityAllocations} from './opportunity-allocation';
import {ArrowLeftRight,ArrowRight,CalendarDays,Clock3,FileText,Info,MapPin,MoreVertical,Package,Paperclip,ShieldAlert,Tag,Truck,Umbrella,Weight} from 'lucide-react';
import {Badge} from '@/components/ui';
import type {Opportunity} from '@/features/carrier-portal/commercial-model';
import {CargoSpecificationV2Schema} from '@/shared/schemas/v2/freight-request';
import {LogisticsTruck} from '@/features/logistics-3d/logistics-truck';
import {opportunityFacts,opportunityLabel} from './opportunity-model';
import s from './opportunity-record.module.css';

type Cargo=ReturnType<typeof CargoSpecificationV2Schema.parse>;
type SheetIcon=typeof FileText;
const labels:Record<string,string>={KEEP_DRY:'Keep dry',HAC50_SCENARIO_GENERAL:'General cargo (test scenario)',GENERAL:'General cargo',GENERAL_CARGO:'General cargo',BOX:'Box',PALLET:'Pallet'};
const friendly=(code:string)=>labels[code]??code.replace(/[_-]/g,' ').toLowerCase().replace(/^./,c=>c.toUpperCase());
const amount=(value:number|null,unit:string)=>value===null?'Not provided':value.toLocaleString('en-US')+' '+unit;
const day=(value:string)=>new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(value));
const time=(value:string)=>new Intl.DateTimeFormat('en-GB',{hour:'2-digit',minute:'2-digit',hourCycle:'h23',timeZone:'UTC'}).format(new Date(value));
const peruDeadline=new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23',timeZone:'America/Lima'});

/** Display alias; canonical identifiers remain unchanged. */
export function shortRequestReference(row:Opportunity){
 const code=opportunityFacts(row).reference;
 return /^V2-[0-9a-f]{32}$/i.test(code)?'REQ · '+code.slice(3,11).toUpperCase():code;
}
function SheetSection({title,icon:Icon,children,className=''}:{title:string;icon:SheetIcon;children:ReactNode;className?:string}){
 return <section className={`${s.group} ${className}`}><h3><Icon size={22} aria-hidden="true"/>{title}</h3>{children}</section>;
}
function Field({label,children,icon:Icon}:{label:string;children:ReactNode;icon?:SheetIcon}){
 return <div>{Icon?<Icon className={s.factIcon} size={26} aria-hidden="true"/>:null}<dt>{label}</dt><dd>{children}</dd></div>;
}
function WindowValue({value}:{value:{startsAt:string;endsAt:string}|null}){
 if(!value)return <>Not provided</>;
 const same=day(value.startsAt)===day(value.endsAt);
 return <><strong>{day(value.startsAt)}</strong><span><Clock3 size={18} aria-hidden="true"/>{time(value.startsAt)} – {same?'':day(value.endsAt)+' '}{time(value.endsAt)} UTC</span></>;
}
function HandlingRequirements({cargo}:{cargo:Cargo}){
 const tags:Array<{key:string;label:string;icon:SheetIcon;tone:'dry'|'care'|'whole'}>=[...new Set(cargo.requirements)].map(code=>({key:code,label:friendly(code),icon:code==='KEEP_DRY'?Umbrella:ShieldAlert,tone:'dry'}));
 const unstackable=cargo.units.filter(unit=>!unit.stackable).length,whole=cargo.units.filter(unit=>unit.indivisible).length;
 if(unstackable)tags.push({key:'stacking',label:unstackable===cargo.units.length?'Do not stack':'Some packages: do not stack',icon:Package,tone:'care'});
 if(whole)tags.push({key:'whole',label:whole===cargo.units.length?'Keep whole':'Some packages: keep whole',icon:Paperclip,tone:'whole'});
 if(cargo.temperatureRange)tags.push({key:'temperature',label:`${cargo.temperatureRange.minCelsius} to ${cargo.temperatureRange.maxCelsius} °C`,icon:ShieldAlert,tone:'dry'});
 if(!tags.length)return null;
 return <div className={s.handling}><span className={s.handlingLabel}><ShieldAlert size={21} aria-hidden="true"/>Handling requirements</span><div className={s.handlingTags}>{tags.map(({key,label,icon:Icon,tone})=><Badge key={key} tone="neutral" className={s.handlingTag} data-handling-tone={tone}><Icon size={18} aria-hidden="true"/>{label}</Badge>)}</div></div>;
}
function RecordInformation({row}:{row:Opportunity}){
 const brief=opportunityFacts(row).brief;
 return <details className={s.recordMenu} onKeyDown={event=>{if(event.key==='Escape'){event.currentTarget.open=false;event.currentTarget.querySelector('summary')?.focus();}}} onBlur={event=>{if(event.relatedTarget&&!event.currentTarget.contains(event.relatedTarget as Node))event.currentTarget.open=false;}}>
  <summary aria-label="Record information" title="Record information"><MoreVertical size={20} aria-hidden="true"/></summary>
  <div className={s.menuPanel}><strong>Record information</strong><dl><Field label="Request ID"><code>{row.requestId}</code></Field><Field label="Opportunity ID"><code>{row.id}</code></Field><Field label="Request version">{brief?.requestVersion??'Not recorded'}</Field><Field label="Opportunity version">{row.version}</Field></dl></div>
 </details>;
}

export function OpportunityRecord({row,headingRef}:{row:Opportunity;headingRef:Ref<HTMLHeadingElement>}){
 const f=opportunityFacts(row),brief=f.brief,cargo=CargoSpecificationV2Schema.safeParse(row.data.cargoSpecification),c=cargo.success?cargo.data:null;
 const allocations=opportunityAllocations(row);
 const description=/^\[SIMULATED\]\s*Inbox(?:\s|$)/.test(f.description)?null:f.description;
 return <article className={s.record} data-opportunity-record aria-label="Read-only customer request">
  <header className={s.header}>
   <div className={s.identity}><div><h2 ref={headingRef} tabIndex={-1}>{shortRequestReference(row)}</h2><p className={s.received}>Received {day(row.data.sentAt)} · {time(row.data.sentAt)} UTC</p></div><div className={s.headerTools}><Badge tone="neutral" className={s.status}><Clock3 size={17} aria-hidden="true"/>{opportunityLabel(row.status)}</Badge><RecordInformation row={row}/></div></div>
   <div className={s.route} aria-label="Requested route"><div className={s.stop}><span className={s.pin}><MapPin size={28} aria-hidden="true"/></span><div><small>Pickup city</small><strong>{f.origin}</strong></div></div><div className={s.routeLine}><ArrowRight size={21} aria-hidden="true"/></div><div className={s.stop}><span className={s.pin}><MapPin size={28} aria-hidden="true"/></span><div><small>Delivery city</small><strong>{f.destination}</strong></div></div><p className={s.locationNote}><Info size={15} aria-hidden="true"/>City-level locations only — exact addresses and contacts not shared.</p></div>
  </header>
  <div className={s.body}>
   {allocations.length ? <SheetSection title="Cargo allocation" icon={Truck}>
    <details><summary>{allocations.filter(assignment=>assignment.allocationSummary.role==='LOAD_BEARING').length} carrying resource(s) · view allocation</summary>
    {allocations.map((assignment,index)=><div key={assignment.id}><strong>{assignment.allocationSummary.role==='AUXILIARY'?'Support':'Vehicle'} {index+1} · {friendly(assignment.allocationSummary.equipment)}</strong>
     <p>{day(assignment.window.startsAt)} · {time(assignment.window.startsAt)} – {time(assignment.window.endsAt)} UTC</p>
     <ul>{assignment.allocationSummary.units.map(unit=><li key={unit.unitIndex}>Group {unit.unitIndex+1}: {unit.quantity} units · {amount(unit.weightKg,'kg')} · {amount(unit.volumeM3,'m³')}</li>)}</ul>
    </div>)}</details>
   </SheetSection>:null}
   {f.projectionInvalid?<p role="alert" className={s.alert}>Request details could not be verified. Refresh before responding.</p>:null}
   {brief&&!brief.isCurrent?<p role="alert" className={s.alert}>This is an earlier request version. A refreshed opportunity is needed before accepting.</p>:brief&&!brief.canReview?<p className={s.alert}>The customer request is no longer open for review.</p>:null}
   <div className={s.groups}>
    <SheetSection title="Schedule" icon={CalendarDays} className={s.schedule}><dl className={s.fields}><Field label="Pickup"><WindowValue value={f.pickup}/></Field><Field label="Delivery"><WindowValue value={f.delivery}/></Field></dl><p className={s.hint}><Info size={15} aria-hidden="true"/>All times shown in UTC.</p></SheetSection>
    <SheetSection title="Request context" icon={FileText}><dl className={`${s.fields} ${s.contextFields}`}><Field label="Customer">Name not shared at this stage</Field><Field label="Required equipment">{brief?.requiredEquipment?friendly(brief.requiredEquipment):'No specific equipment requested'}</Field><Field label="Preferred equipment">{brief?.preferredEquipment?friendly(brief.preferredEquipment):'No preference recorded'}</Field></dl></SheetSection>
   </div>
   <SheetSection title="Cargo summary" icon={Package} className={s.cargoSummary}>
    {description?<p className={s.description}>{description}</p>:null}
    <dl className={`${s.fields} ${s.cargoTotals}`}><Field label="Total weight" icon={Weight}>{amount(f.weightKg,'kg')}</Field><Field label="Total volume" icon={Package}>{amount(f.volumeM3,'m³')}</Field><Field label="Category" icon={Tag}>{friendly(row.data.cargoSpecification.categoryCode)}</Field><Field label="Split shipment" icon={ArrowLeftRight}>{c?(c.divisible?'Yes':'No'):'Not provided'}</Field></dl>
    {c?<HandlingRequirements cargo={c}/>:null}
   </SheetSection>
   <SheetSection title="Packages and handling" icon={Package} className={s.packagePanel}>
    {c?<div className={s.tableWrap}><table><caption className={s.srOnly}>Packages and handling</caption><thead><tr><th scope="col">Package</th><th scope="col">Qty</th><th scope="col">Weight / unit</th><th scope="col">Volume / unit</th><th scope="col">Size (cm)</th><th scope="col">Handling</th></tr></thead><tbody>{c.units.map((unit,i)=><tr key={i}><td>{friendly(unit.packageType)}</td><td>{unit.quantity}</td><td>{amount(unit.weightPerUnitKg,'kg')}</td><td>{amount(unit.volumePerUnitM3,'m³')}</td><td>{unit.dimensionsCm.length} × {unit.dimensionsCm.width} × {unit.dimensionsCm.height}</td><td>{unit.stackable?'Stackable':'Do not stack'}{unit.indivisible?' · Keep whole':''}</td></tr>)}</tbody></table></div>:<p className={s.hint}>Package details need review before preparing an offer.</p>}
    <footer className={s.footer}><small>Updated {day(row.updatedAt)} · {time(row.updatedAt)} UTC</small></footer>
   </SheetSection>
  </div>
 </article>;
}

export function OpportunityDeadline({value}:{value:string}){
 return <div className={s.deadline}><Clock3 size={25} aria-hidden="true"/><div><span>Respond before</span><strong><time dateTime={value}>{peruDeadline.format(new Date(value))} — Peru</time></strong><small>({day(value)}, {time(value)} UTC)</small></div></div>;
}
export function OpportunityChecks({row}:{row:Opportunity}){
 const brief=opportunityFacts(row).brief;
 if(!brief||brief.planEligibility==='eligible')return null;
 return <div className={s.checkSummary}><ShieldAlert size={20} aria-hidden="true"/><div><p className={s.checkNote} role={brief.planEligibility==='ineligible'?'alert':undefined}>{brief.planEligibility==='ineligible'?'Transport plan not eligible':'Coverage and capacity not confirmed'}</p><small>Accepting does not guarantee coverage.</small></div></div>;
}
export function OpportunityTruck(){
 return <section className={s.illustration} aria-label="Reference truck preview"><h3><Truck size={22} aria-hidden="true"/>Truck preview</h3><LogisticsTruck compact minimalControls previewOnly/></section>;
}

"use client";
import {useLocale} from '@/features/i18n/locale-provider';
import {driverLicenseLabel} from '@/shared/lib/display-identity';
import {useState} from 'react';
import {ArrowUpRight,CalendarDays,Search,SlidersHorizontal,UsersRound} from 'lucide-react';
import {recordData,recordName,type PortalRecord} from '@/features/carrier-portal/records';
import {connectedDriver} from '@/features/carrier-portal/connected-fleet-presentation';
import {DriverPortrait} from './driver-profile';
import {driverActivity,driverFacts} from './driver-analytics';
import s from './drivers-workspace.module.css';

const states:Record<string,string>={AVAILABLE:'Available (recorded)',ON_DUTY:'On duty',OFF_DUTY:'Off duty',SUSPENDED:'Suspended',UNKNOWN:'Unknown'};
const hours=new Intl.NumberFormat('en-US',{maximumFractionDigits:1});
const number=(value:number|null)=>value===null?'—':hours.format(value);
const dateLabel=(value:string)=>new Date(value+'T12:00:00Z').toLocaleDateString('en-US',{month:'short',day:'numeric',timeZone:'UTC'});

export function DriversWorkspace({drivers,assignments,carrierId,serviceId,readAt,assignmentsUnavailable,onOpen,onManage}:{
 drivers:PortalRecord[];assignments:PortalRecord[];carrierId:string;serviceId:string;readAt:string;assignmentsUnavailable:boolean;onOpen:(id:string)=>void;onManage:()=>void;
}){
 const {t}=useLocale();
 const [query,setQuery]=useState(''),[state,setState]=useState('all'),[selected,setSelected]=useState(''),[period,setPeriod]=useState(14),[activeDate,setActiveDate]=useState('');
 const scoped=drivers.filter(row=>row.carrierId===carrierId&&(!serviceId||recordData(row).serviceId===serviceId));
 const selectedDriver=scoped.find(row=>row.id===selected)??scoped[0];
 const activity=driverActivity(assignments,{carrierId,serviceId:selectedDriver?String(recordData(selectedDriver).serviceId):'',driverId:selectedDriver?.id??''},readAt,period,assignmentsUnavailable);
 const facts=selectedDriver?driverFacts(selectedDriver,readAt):null;
 const selectedDay=activity.series.find(day=>day.date===activeDate)??activity.series.at(-1);
 const total=activity.series.some(day=>day.hours===null)?null:activity.series.reduce((sum,day)=>sum+(day.hours??0),0);
 const max=Math.max(1,...activity.series.map(day=>day.hours??0));
 const visible=scoped.filter(row=>{const d=recordData(row);return (state==='all'||driverFacts(row,readAt).state===state)&&[recordName(row),d.licenseClass,...(Array.isArray(d.qualifications)?d.qualifications:[])].join(' ').toLowerCase().includes(query.trim().toLowerCase());});
 return <div className={s.workspace}>
  <section className={s.panel} aria-labelledby="driver-activity-title">
   <div className={s.heading}><div><h2 id="driver-activity-title">Driver activity</h2><p>Confirmed assignment windows · UTC · not measured driving time</p></div><div className={s.controls}>
    <label><span className={s.srOnly}>Driver for activity chart</span><select value={selectedDriver?.id??''} disabled={!scoped.length} onChange={e=>{setSelected(e.target.value);setActiveDate('');}}>{!scoped.length?<option value="">No drivers</option>:scoped.map(row=><option key={row.id} value={row.id}>{recordName(row)}</option>)}</select></label>
    <label><span className={s.srOnly}>Activity period</span><select value={period} onChange={e=>{setPeriod(Number(e.target.value));setActiveDate('');}}>{[7,14,30].map(days=><option key={days} value={days}>Last {days} days</option>)}</select></label>
   </div></div>
   {selectedDriver&&facts?<>
    <div className={s.driverStrip}><div className={s.person}><DriverPortrait driver={connectedDriver(selectedDriver)}/><div><strong>{recordName(selectedDriver)}</strong><span>{states[facts.state]}</span></div></div><div className={s.metric}><span>Assigned hours</span><strong>{number(total)}<small> h</small></strong></div><div className={s.metric}><span>On-time arrival</span><strong>—</strong><small>Not measured</small></div><button type="button" className={s.textAction} onClick={()=>onOpen(selectedDriver.id)}>View profile <ArrowUpRight size={16} aria-hidden="true"/></button></div>
    <div className={s.chartHeading}><span><CalendarDays size={15} aria-hidden="true"/>{activity.series[0]?dateLabel(activity.series[0].date):'—'} – {activity.series.at(-1)?dateLabel(activity.series.at(-1)!.date):'—'}</span><output aria-live="polite">{selectedDay?dateLabel(selectedDay.date):'—'} <strong>{number(selectedDay?.hours??null)} h</strong></output></div>
    {total===null?<div className={s.empty}>Assignment history is incomplete or unavailable for this read.</div>:total===0?<div className={s.empty}><CalendarDays size={28} aria-hidden="true"/><strong>No confirmed assignments in this period</strong><span>No driving performance is inferred from an empty schedule.</span></div>:<div className={s.chartScroll}><div className={s.chart} style={{gridTemplateColumns:`repeat(${period},minmax(24px,1fr))`}} role="group" aria-label="Daily confirmed assignment hours in UTC">
     {activity.series.map(day=><button type="button" key={day.date} className={s.day} aria-pressed={day.date===selectedDay?.date} aria-label={`${day.date}: ${number(day.hours)} assigned hours`} title={`${dateLabel(day.date)} · ${number(day.hours)} assigned hours`} onMouseEnter={()=>setActiveDate(day.date)} onFocus={()=>setActiveDate(day.date)} onClick={()=>setActiveDate(day.date)}><span className={s.barTrack}><span style={{height:`${(day.hours??0)/max*100}%`}} data-empty={day.hours===0}/></span><small>{Number(day.date.slice(-2))}</small></button>)}
    </div></div>}
   </>:<div className={s.empty}><UsersRound size={28} aria-hidden="true"/>No drivers in this Carrier.</div>}
  </section>
  <section className={s.panel} aria-labelledby="driver-table-title">
   <div className={s.heading}><h2 id="driver-table-title">Drivers</h2><div className={s.controls}><label className={s.search}><Search size={16} aria-hidden="true"/><span className={s.srOnly}>Search drivers, license or qualifications</span><input type="search" placeholder="Search drivers…" value={query} onChange={e=>setQuery(e.target.value)}/></label><label><span className={s.srOnly}>Recorded duty state</span><select value={state} onChange={e=>setState(e.target.value)}><option value="all">All states</option>{Object.entries(states).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label><button type="button" onClick={onManage}><SlidersHorizontal size={16} aria-hidden="true"/>Manage drivers</button></div></div>
   <div className={s.tableScroll} role="region" aria-label="Driver records" tabIndex={0}><table className={s.table}><thead><tr><th scope="col">Driver</th><th scope="col">Recorded state</th><th scope="col">License</th><th scope="col">Recorded duty usage</th><th scope="col">Assignments · {period}d</th><th scope="col"><span className={s.srOnly}>Profile</span></th></tr></thead><tbody>{visible.map(row=>{
    const data=recordData(row),f=driverFacts(row,readAt),a=driverActivity(assignments,{carrierId,serviceId:String(data.serviceId),driverId:row.id},readAt,period,assignmentsUnavailable);
    return <tr key={row.id} data-selected={row.id===selectedDriver?.id}><th scope="row"><button type="button" className={s.selectDriver} aria-pressed={row.id===selectedDriver?.id} onClick={()=>{setSelected(row.id);setActiveDate('');}}><DriverPortrait driver={connectedDriver(row)}/><span><strong>{recordName(row)}</strong><small>{Array.isArray(data.qualifications)&&data.qualifications.length?data.qualifications.join(' · '):'Qualifications not recorded'}</small></span></button></th><td><span className={s.status} data-state={f.state}><i aria-hidden="true"/>{states[f.state]}</span></td><td><strong>{driverLicenseLabel(typeof data.licenseClass==='string'?data.licenseClass:null,t)}</strong><small data-expired={f.license==='expired'}>{f.expires?`${f.license==='expired'?'Expired':'Recorded through'} ${f.expires}`:'Expiry unknown'}</small></td><td><div className={s.duty}><span>{number(f.usedHours)} / {number(f.limitHours)} h</span>{f.percent!==null?<meter min={0} max={100} value={f.percent} aria-label={`${recordName(row)} recorded duty used`}/>:null}<small title={f.window?`${f.window.startsAt} – ${f.window.endsAt}`:undefined}>{f.window?(f.current?'Recorded window':'Outside recorded window'):'Duty policy not recorded'}</small></div></td><td><strong>{a.count??'—'}</strong><small>Confirmed · loaded records</small></td><td><button type="button" className={s.profileButton} aria-label={`View profile for ${recordName(row)}`} title="View profile" onClick={()=>onOpen(row.id)}><ArrowUpRight size={18} aria-hidden="true"/></button></td></tr>;
   })}</tbody></table></div>
   {!visible.length?<p className={s.noResults} role="status">{scoped.length?'No drivers match these filters.':'No drivers in this Carrier.'}</p>:null}
  </section>
 </div>;
}

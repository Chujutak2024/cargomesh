'use client';
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {Button,Checkbox,Input,Select} from '@/components/ui';
import {FacilityInputV2Schema,FacilityV2Schema,type FacilityInputV2,type FacilityV2} from '@/shared/schemas/v2/facilities';
import {ClientSettingsError,collectionSchema,recordSchema,settingsRequest,settingsCommand,sendSettingsCommand,settingsError,type SettingsCommand} from './client-settings-api';
import styles from './client-settings.module.css';
import dynamic from 'next/dynamic';
import type {FacilityVisualControllers} from './client-facility-visual';
import {ContentMotion} from '@/features/product-motion/content-motion';
import {WorkspaceSkeleton,WorkspaceUpdating} from '@/features/product-motion/workspace-skeleton';
import {DeferredRegion} from '@/features/carrier-navigation/deferred-region';
import {useLocale} from '@/features/i18n/locale-provider';
const ClientFacilityVisual=dynamic(()=>import('./client-facility-visual').then(module=>module.ClientFacilityVisual),{ssr:false,loading:()=> <WorkspaceSkeleton shape="detail"/>});

const blank:FacilityInputV2={schemaVersion:'2.0',code:'',name:'',facilityType:'SHIPPER_SITE',active:true,
  location:{label:'',city:'',region:null,countryCode:'PE',lat:null,lng:null},accessRestrictions:[],operatingHours:null};
const days=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const single=recordSchema(FacilityV2Schema),list=collectionSchema(FacilityV2Schema);
type Role='OWNER'|'SUPERVISOR'|'REQUESTER';
export function ClientFacilities({role,initialId}:{role:Role;initialId?:string}){
  const {t}=useLocale();
  const [items,setItems]=useState<FacilityV2[]>([]),[offset,setOffset]=useState(0),[next,setNext]=useState<number|null>(null);
  const [selected,setSelected]=useState<FacilityV2|null>(null),[creating,setCreating]=useState(false);
  const [loading,setLoading]=useState(true),[loaded,setLoaded]=useState(false),[openingId,setOpeningId]=useState('');
  const [error,setError]=useState(''),[message,setMessage]=useState('');
  const selection=useRef(0),pageRead=useRef(0);
  const visualControllers=useRef<FacilityVisualControllers>(new Map());
  const editable=role==='OWNER'||role==='SUPERVISOR';
  function failed(e:unknown){
    setError(settingsError(e));
    if(e instanceof ClientSettingsError&&[401,403].includes(e.status)){
      selection.current++;pageRead.current++;setItems([]);setSelected(null);setCreating(false);setOpeningId('');setLoading(false);setLoaded(false);visualControllers.current.clear();
    }
  }
  async function loadPage(at=offset){
    const ticket=++pageRead.current;setLoading(true);setError('');
    try{const page=await settingsRequest('/facilities?limit=25&offset='+at,list);if(ticket!==pageRead.current)return;setItems(page.data);setOffset(at);setNext(page.meta.nextOffset);setLoaded(true);}
    catch(e){if(ticket===pageRead.current)failed(e);}finally{if(ticket===pageRead.current)setLoading(false);}
  }
  async function open(id:string){
    const ticket=++selection.current;setError('');setCreating(false);setOpeningId(id);
    try{const result=await settingsRequest('/facilities/'+id,single);if(ticket!==selection.current)return;
      if(result.data.id!==id)throw new Error('FACILITY_IDENTITY_MISMATCH');
      setSelected(result.data);window.history.replaceState(null,'','?facility='+result.data.id);
    }catch(e){if(ticket===selection.current)failed(e);}finally{if(ticket===selection.current)setOpeningId('');}
  }
  useEffect(()=>{void loadPage(0);if(initialId)void open(initialId);return()=>{selection.current++;pageRead.current++;};},[]);
  async function saved(record:FacilityV2){setSelected(record);setCreating(false);setMessage(t('Sede guardada.','Facility saved.'));await loadPage(offset);}
  return <div className={styles.page}><header className={styles.header}><div><h1>{t('Sedes','Facilities')}</h1><p>{t('Direcciones de recojo y entrega.','Pickup and delivery addresses.')}</p></div>
    {editable&&<Button type="button" onClick={()=>{selection.current++;setOpeningId('');setSelected(null);setCreating(true);setMessage('');window.history.replaceState(null,'','?new=1');}}>{t('Nueva sede','New facility')}</Button>}</header>
    {error&&<div className={styles.error} role="alert">{error} <Button variant="secondary" onClick={()=>{void loadPage();if(selected)void open(selected.id);else if(initialId)void open(initialId);}}>{t('Reintentar','Retry')}</Button></div>}
    {message&&<p className={styles.success} role="status">{message}</p>}
    <div className={styles.columns}><section className={styles.panel} aria-label={t('Directorio de sedes','Facility list')}><h2>{t('Tus sedes','Your facilities')}</h2>
      {loading&&loaded?<WorkspaceUpdating>{t('Actualizando sedes…','Updating facilities…')}</WorkspaceUpdating>:null}
      {loading&&!loaded?<WorkspaceSkeleton shape="table" label={t('Cargando sedes','Loading facilities')}/>:items.length?<div className={styles.list} data-client-motion-group>{items.map(item=><button key={item.id} className={styles.item} type="button" aria-pressed={selected?.id===item.id} aria-busy={openingId===item.id} onClick={()=>void open(item.id)}><strong>{item.value.name}</strong><span className={styles.muted}>{item.value.code} · {item.value.location.city}, {item.value.location.countryCode}</span><span className={styles.muted}>{item.value.active?t('Activa','Active'):t('Inactiva','Inactive')}</span></button>)}</div>:!error?<p className={styles.empty}>{t('No hay sedes registradas.','No facilities recorded.')}</p>:null}
      <div className={styles.actions}><Button variant="secondary" disabled={loading||offset===0} onClick={()=>void loadPage(Math.max(0,offset-25))}>{t('Anterior','Previous')}</Button><Button variant="secondary" disabled={loading||next===null} onClick={()=>void loadPage(next!)}>{t('Siguiente','Next')}</Button></div>
      {selected?<DeferredRegion minHeight={240}><ClientFacilityVisual key={selected.organizationId+':'+selected.id} facility={selected} editable={editable&&!openingId} controllers={visualControllers.current}/></DeferredRegion>:null}
    </section><ContentMotion identity={creating?'new':selected?.id??'empty'} className={styles.panel}>
      {openingId?<WorkspaceUpdating>{t('Abriendo sede…','Opening facility…')}</WorkspaceUpdating>:null}
      {selected||creating?<FacilityEditor key={selected?selected.id+':'+selected.version:'new'} record={selected} editable={editable} blocked={!!openingId} onSaved={saved} onReload={()=>selected&&void open(selected.id)}/>:openingId?<WorkspaceSkeleton shape="form" label={t('Cargando sede','Loading facility')}/>:<div className={styles.empty}>{t('Selecciona una sede para ver sus datos.','Select a facility to view its details.')}</div>}
    </ContentMotion></div>
  </div>;
}
function FacilityEditor({record,editable,blocked=false,onSaved,onReload}:{record:FacilityV2|null;editable:boolean;blocked?:boolean;onSaved:(record:FacilityV2)=>Promise<void>;onReload:()=>void}){
  const initial=record?.value??blank;
  const [hours,setHours]=useState(initial.operatingHours??{timezone:'America/Lima',weekly:[] as NonNullable<FacilityInputV2['operatingHours']>['weekly']});
  const [known,setKnown]=useState(initial.operatingHours!==null),[rules,setRules]=useState(initial.accessRestrictions);
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[conflict,setConflict]=useState(false);
  const pending=useRef<SettingsCommand|null>(null);
  async function save(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(!editable||blocked||busy||conflict)return;
    const form=new FormData(event.currentTarget),text=(key:string)=>String(form.get(key)??'').trim();
    const optional=(key:string)=>text(key)||null,coordinate=(key:string)=>text(key)===''?null:Number(text(key));
    setError('');
    try{
      const value=FacilityInputV2Schema.parse({schemaVersion:'2.0',code:text('code'),name:text('name'),facilityType:text('facilityType'),active:form.has('active'),
        location:{label:text('address'),city:text('city'),region:optional('region'),countryCode:text('countryCode').toUpperCase(),lat:coordinate('lat'),lng:coordinate('lng')},
        accessRestrictions:rules,operatingHours:known?hours:null});
      const route=record?'/facilities/'+record.id+'/revisions':'/facilities';
      pending.current=settingsCommand(route,record?{expectedVersion:record.version,value}:value,pending.current);
      setBusy(true);const response=await sendSettingsCommand(pending.current,single);
      const readback=await settingsRequest('/facilities/'+response.data.id,single);
      pending.current=null;await onSaved(readback.data);
    }catch(e){setError(settingsError(e));setConflict(e instanceof ClientSettingsError&&e.code==='STALE_DRAFT');}finally{setBusy(false);}
  }
  return <form className={styles.form} onSubmit={save}><div><h2>{record?'Facility details':'New facility'}</h2>{record&&<p className={styles.muted}>{record.id} · version {record.version}</p>}</div>
    {!editable&&<p className={styles.notice}>Your role can view facilities. An owner or supervisor can edit them.</p>}
    <fieldset disabled={!editable||blocked||busy||conflict}><div className={styles.grid}>
      <Input label="Facility name" name="name" defaultValue={initial.name} maxLength={200} required/>
      <Input label="Facility code" name="code" defaultValue={initial.code} maxLength={100} required/>
      <Select label="Facility type" name="facilityType" defaultValue={initial.facilityType}>{['SHIPPER_SITE','WAREHOUSE','DISTRIBUTION_CENTER','OTHER'].map(value=><option key={value} value={value}>{value.replaceAll('_',' ')}</option>)}</Select>
      <Checkbox label="Active facility" name="active" defaultChecked={initial.active}/>
      <Input label="Street address" name="address" defaultValue={initial.location.label} required fieldClassName={styles.wide}/>
      <Input label="City" name="city" defaultValue={initial.location.city} required/>
      <Input label="Region" name="region" defaultValue={initial.location.region??''}/>
      <Input label="Country code" hint="Two-letter country code, for example PE, BO or CL." name="countryCode" defaultValue={initial.location.countryCode} required pattern="[A-Za-z]{2}" maxLength={2}/>
      <div className={styles.grid}><Input label="Latitude" name="lat" type="number" min={-90} max={90} step="any" defaultValue={initial.location.lat??''}/><Input label="Longitude" name="lng" type="number" min={-180} max={180} step="any" defaultValue={initial.location.lng??''}/></div>
    </div><p className={styles.muted}>Enter both coordinates or leave both blank when the location is unknown.</p>
    <div className={styles.divider}><h3>Operating hours</h3><Checkbox label="Operating hours are known" checked={known} onChange={e=>setKnown(e.target.checked)}/>
      {!known?<p className={styles.notice}>Schedule unknown. This facility is not assumed to be open.</p>:<div className={styles.form}><Input label="IANA timezone" value={hours.timezone} onChange={e=>setHours({...hours,timezone:e.target.value})} placeholder="America/Lima" required/>
        <p className={styles.muted}>Times use this facility’s local timezone. Split overnight hours into two days; 24:00 is allowed as a closing time.</p>
        {!hours.weekly.length&&<p className={styles.notice}>No open intervals are recorded. This means closed, rather than unknown.</p>}
        {hours.weekly.map((slot,index)=><div className={styles.row} key={index}><Select label="Day" value={slot.dayOfWeek} onChange={e=>setHours({...hours,weekly:hours.weekly.map((s,i)=>i===index?{...s,dayOfWeek:Number(e.target.value)}:s)})}>{days.map((d,i)=><option value={i+1} key={d}>{d}</option>)}</Select>
          <Input label="Opens at" value={slot.opensAt} pattern="([01][0-9]|2[0-3]):[0-5][0-9]" placeholder="08:00" onChange={e=>setHours({...hours,weekly:hours.weekly.map((s,i)=>i===index?{...s,opensAt:e.target.value}:s)})} required/>
          <Input label="Closes at" value={slot.closesAt} pattern="(([01][0-9]|2[0-3]):[0-5][0-9]|24:00)" placeholder="17:00" onChange={e=>setHours({...hours,weekly:hours.weekly.map((s,i)=>i===index?{...s,closesAt:e.target.value}:s)})} required/>
          <Button variant="ghost" type="button" aria-label={'Remove hours '+(index+1)} onClick={()=>setHours({...hours,weekly:hours.weekly.filter((_,i)=>i!==index)})}>Remove</Button></div>)}
        <Button type="button" variant="secondary" disabled={hours.weekly.length>=28} onClick={()=>setHours({...hours,weekly:[...hours.weekly,{dayOfWeek:1,opensAt:'08:00',closesAt:'17:00'}]})}>Add opening interval</Button>
      </div>}</div>
    <div className={styles.divider}><h3>Access restrictions</h3>{!rules.length&&<p className={styles.muted}>No access restrictions recorded.</p>}
      {rules.map((rule,index)=><div key={index} className={styles.rule}><Input label="Restriction code" value={rule.code} required maxLength={100} onChange={e=>setRules(rules.map((r,i)=>i===index?{...r,code:e.target.value}:r))}/><Input label="Description" value={rule.description} required maxLength={1000} onChange={e=>setRules(rules.map((r,i)=>i===index?{...r,description:e.target.value}:r))}/>
        <Input label="Evidence reference (optional)" value={rule.evidenceReference??''} maxLength={500} onChange={e=>setRules(rules.map((r,i)=>i===index?{...r,evidenceReference:e.target.value||null}:r))}/><Button type="button" variant="ghost" onClick={()=>setRules(rules.filter((_,i)=>i!==index))}>Remove restriction</Button></div>)}
      <Button type="button" variant="secondary" disabled={rules.length>=100} onClick={()=>setRules([...rules,{code:'',description:'',evidenceReference:null}])}>Add restriction</Button></div>
    </fieldset>{error&&<p className={styles.error} role="alert">{error}</p>}
    <div className={styles.actions}>{editable&&<Button type="submit" disabled={conflict||blocked} isLoading={busy} loadingLabel="Saving…">{error&&!conflict?'Retry save':record?'Save changes':'Create facility'}</Button>}
      {record&&<Button type="button" variant="secondary" disabled={busy} onClick={onReload}>Reload latest (discard edits)</Button>}</div>
  </form>;
}

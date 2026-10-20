'use client';
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {Button,Input,Select} from '@/components/ui';
import {OrganizationRecordV2Schema,OrganizationValueV2Schema,type OrganizationV2} from '@/shared/schemas/v2/organization';
import {ClientSettingsError,recordSchema,settingsRequest,settingsCommand,sendSettingsCommand,settingsError,type SettingsCommand} from './client-settings-api';
import {ClientCatalogSettings} from './client-profile-settings';
import styles from './client-settings.module.css';
const schema=recordSchema(OrganizationRecordV2Schema);
export function ClientOrganization({role}:{role:'OWNER'|'SUPERVISOR'|'REQUESTER'}){
 const [record,setRecord]=useState<OrganizationV2|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true),[notice,setNotice]=useState('');
 async function load(){setLoading(true);setError('');try{setRecord((await settingsRequest('/organizations/current',schema)).data);}catch(e){setError(settingsError(e));}finally{setLoading(false);}}
 useEffect(()=>{void load();},[]);
 return <div className={styles.page}><header className={styles.header}><div><span className={styles.label}>Connected Client · persisted data</span><h1>Your organization</h1><p>Manage organization details, reusable cargo profiles and transport preferences.</p></div><span className={styles.notice}>Your role: {role}</span></header>
  {notice&&<p className={styles.success} role="status">{notice}</p>}<section className={styles.panel}><h2>Organization details</h2>{loading?<p role="status">Loading organization…</p>:error?<div className={styles.error} role="alert">{error} <Button onClick={()=>void load()}>Retry</Button></div>:record&&<OrganizationEditor key={record.version} record={record} editable={role==='OWNER'} onSaved={value=>{setRecord(value);setNotice('Organization saved and read back from the database.');}} onReload={()=>void load()}/>}</section>
  <ClientCatalogSettings kind="cargo-profiles" editable={role!=='REQUESTER'}/><ClientCatalogSettings kind="preferences" editable={role==='OWNER'}/>
 </div>;
}
function OrganizationEditor({record,editable,onSaved,onReload}:{record:OrganizationV2;editable:boolean;onSaved:(value:OrganizationV2)=>void;onReload:()=>void}){
 const value=record.value,pending=useRef<SettingsCommand|null>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[conflict,setConflict]=useState(false);
 async function save(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(busy||conflict)return;
  const form=new FormData(event.currentTarget),text=(key:string)=>String(form.get(key)??'').trim(),optional=(key:string)=>text(key)||null;
  try{
   const revised=OrganizationValueV2Schema.parse({schemaVersion:'2.0',code:text('code'),commercialName:text('commercialName'),legalName:optional('legalName'),taxIdType:optional('taxIdType'),taxIdValue:optional('taxIdValue'),countryCode:optional('countryCode')?.toUpperCase()??null,corporateEmail:optional('corporateEmail'),corporatePhone:optional('corporatePhone'),defaultCurrency:'USD',status:text('status')});
   pending.current=settingsCommand('/organizations/current/revisions',{expectedVersion:record.version,value:revised},pending.current);setBusy(true);setError('');
   await sendSettingsCommand(pending.current,schema);const current=await settingsRequest('/organizations/current',schema);pending.current=null;onSaved(current.data);
  }catch(e){setError(settingsError(e));setConflict(e instanceof ClientSettingsError&&e.code==='STALE_DRAFT');}finally{setBusy(false);}
 }
 return <form className={styles.form} onSubmit={save}><p className={styles.muted}>{record.id} · version {record.version}</p>{!editable&&<p className={styles.notice}>Only an organization owner can edit these details.</p>}
  <fieldset disabled={!editable||busy||conflict}><div className={styles.grid}>
   <Input label="Commercial name" name="commercialName" defaultValue={value.commercialName} required maxLength={200}/><Input label="Organization code" name="code" defaultValue={value.code} required maxLength={100}/>
   <Input label="Legal name" name="legalName" defaultValue={value.legalName??''} maxLength={200}/><Input label="Country code" name="countryCode" defaultValue={value.countryCode??''} pattern="[A-Za-z]{2}" maxLength={2}/>
   <Input label="Tax identifier type" name="taxIdType" defaultValue={value.taxIdType??''} maxLength={50}/><Input label="Tax identifier" name="taxIdValue" defaultValue={value.taxIdValue??''} maxLength={100}/>
   <Input label="Corporate email" name="corporateEmail" type="email" defaultValue={value.corporateEmail??''}/><Input label="Corporate phone" name="corporatePhone" defaultValue={value.corporatePhone??''} placeholder="+5115550100"/>
   <Input label="Default currency" value="USD" readOnly/><Select label="Status" name="status" defaultValue={value.status}><option>ACTIVE</option><option>INACTIVE</option></Select>
  </div><p className={styles.muted}>Tax type and identifier must be entered together. Inactive organizations cannot open the connected workspace.</p></fieldset>
  {error&&<p className={styles.error} role="alert">{error}</p>}<div className={styles.actions}>{editable&&<Button type="submit" disabled={conflict} isLoading={busy} loadingLabel="Saving…">{error&&!conflict?'Retry save':'Save organization'}</Button>}<Button type="button" variant="secondary" disabled={busy} onClick={onReload}>Reload latest (discard edits)</Button></div>
 </form>;
}

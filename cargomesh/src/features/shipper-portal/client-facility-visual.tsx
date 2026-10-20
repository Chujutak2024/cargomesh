'use client';
import {useEffect,useRef,useState} from 'react';
import {Button,Select} from '@/components/ui';
import type {FacilityV2} from '@/shared/schemas/v2/facilities';
import {depotTemplates,type DepotTemplateId} from '@/shared/facility-visual-catalog';
import {FacilityVisualResponseSchema,type FacilityVisualRecord} from '@/shared/schemas/v2/facility-visual';
import {FacilityReference} from '@/features/logistics-3d/facility-reference';
import {facilityVisualController,resolveFacilityVisual} from '@/features/logistics-3d/facility-visual';
import type {DepotCoordinator} from '@/features/logistics-3d/depot-coordinator';
import {ClientSettingsError,settingsRequest,settingsCommand,sendSettingsCommand,settingsError,type SettingsCommand} from './client-settings-api';
import styles from './client-settings.module.css';

export type FacilityVisualControllers=Map<string,DepotCoordinator>;
/** Camera state is owned by the directory, independent of editor revisions. */
export function ClientFacilityVisual({facility,editable,controllers}:{facility:FacilityV2;editable:boolean;controllers:FacilityVisualControllers}){
 const [saved,setSaved]=useState<FacilityVisualRecord|null>(null),[template,setTemplate]=useState<DepotTemplateId|''>('');
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[conflict,setConflict]=useState(false);
 const pending=useRef<SettingsCommand|null>(null);
 const route='/facilities/'+facility.id+'/visual-reference';
 async function read(signal?:AbortSignal){
  setLoading(true);setError('');
  try{
   const result=await settingsRequest(route,FacilityVisualResponseSchema,{signal});
   if(signal?.aborted)return;
   if(result.data.facilityId!==facility.id||result.data.organizationId!==facility.organizationId)throw new Error('REFERENCE_SCOPE_MISMATCH');
   setSaved(result.data);setTemplate(result.data.templateId??'');setConflict(false);pending.current=null;
  }catch(e){if(!signal?.aborted)setError(settingsError(e));}
  finally{if(!signal?.aborted)setLoading(false);}
 }
 useEffect(()=>{const abort=new AbortController();void read(abort.signal);return()=>abort.abort();},[facility.id,facility.organizationId]);
 async function save(){
  if(!saved||busy||conflict)return;
  setBusy(true);setError('');setNotice('');
  try{
   pending.current=settingsCommand(route,{expectedVersion:saved.version,templateId:template||null},pending.current);
   const result=await sendSettingsCommand(pending.current,FacilityVisualResponseSchema);
   if(result.data.facilityId!==facility.id||result.data.organizationId!==facility.organizationId)throw new Error('REFERENCE_SCOPE_MISMATCH');
   const latest=await settingsRequest(route,FacilityVisualResponseSchema);
   if(latest.data.facilityId!==facility.id||latest.data.organizationId!==facility.organizationId)throw new Error('REFERENCE_SCOPE_MISMATCH');
   pending.current=null;setSaved(latest.data);setTemplate(latest.data.templateId??'');setNotice('Visual reference saved.');
  }catch(e){setError(settingsError(e));setConflict(e instanceof ClientSettingsError&&e.code==='STALE_DRAFT');}
  finally{setBusy(false);}
 }
 const reference=template?resolveFacilityVisual({organizationId:facility.organizationId,facilities:[facility],
  location:{...facility.value.location,facilityId:facility.id},usage:null,
  references:[{organizationId:facility.organizationId,facilityId:facility.id,templateId:template}]}):null;
 const scene=reference?facilityVisualController(controllers,reference):null;
 return <section className={styles.visual} aria-label="Facility visual reference">
  <div className={styles.visualHeading}><h3>3D reference</h3>{saved&&template!==(saved.templateId??'')&&<span className={styles.muted}>Unsaved preview</span>}</div>
  <p className={styles.muted}>Choose an illustration for this facility. Its recorded location and operations stay unchanged.</p>
  {loading?<p role="status">Loading reference…</p>:<div className={styles.visualActions}>
   <Select label="Facility model" value={template} disabled={!editable||!saved||busy||conflict} onChange={e=>{setTemplate(e.target.value as DepotTemplateId|'');setNotice('');}}>
    <option value="">No model selected</option>{depotTemplates.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}
   </Select>
   {editable&&<Button type="button" variant="secondary" disabled={!saved||conflict||template===(saved.templateId??'')} isLoading={busy} loadingLabel="Saving…" onClick={()=>void save()}>Save model</Button>}
  </div>}
  {error&&<div className={styles.error} role="alert">{error} <Button type="button" variant="ghost" disabled={busy} onClick={()=>void read()}>Reload reference</Button></div>}
  {notice&&<p role="status" className={styles.muted}>{notice}</p>}
  {reference&&scene?<FacilityReference key={scene.key} reference={reference} controller={scene.controller}/>:!loading&&!error?<p className={styles.muted}>No visual reference assigned.</p>:null}
 </section>;
}

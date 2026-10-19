"use client";
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {useLocale} from '@/features/i18n/locale-provider';
import styles from './password-login.module.css';
/** The current entry automatically assigns its demo profile; no credential form. */
export function AssignedDemoEntry({workspace}:{workspace:'client'|'carrier'}){
 const {t}=useLocale();const [failed,setFailed]=useState(false),[attempt,setAttempt]=useState(0);
 useEffect(()=>{
  let active=true;setFailed(false);
  void fetch('/api/auth/demo-session',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',cache:'no-store',body:JSON.stringify({workspace})})
   .then(async response=>{const value=await response.json();if(!active)return;
    const expected=workspace==='client'?'/clients':'/carriers';
    if(!response.ok||value.destination!==expected)throw new Error('Demo entry unavailable');
    const here=window.location.pathname,within=here===expected||here.startsWith(expected+'/');
    window.location.replace(within?here+window.location.search+window.location.hash:expected);
   }).catch(()=>{if(active)setFailed(true);});
  return()=>{active=false;};
 },[workspace,attempt]);
 return <section className={styles.card} aria-live="polite" aria-busy={!failed}>
  <h1>{t('Abriendo tu espacio de prueba','Opening your demo workspace')}</h1>
  <p>{t('Tu usuario de prueba se asigna automáticamente.','Your demo user is assigned automatically.')}</p>
  {failed?<><p role="alert">{t('No pudimos abrir la demo. Puedes reintentar.','We could not open the demo. Please retry.')}</p>
   <button className={styles.primaryAction} onClick={()=>setAttempt(n=>n+1)}>{t('Reintentar','Retry')}</button>
   <Link href={'/login?connected=1&returnTo='+encodeURIComponent(workspace==='client'?'/clients':'/carriers')}>{t('Usar otra cuenta','Use another account')}</Link></>:<p role="status">{t('Preparando sesión…','Preparing session…')}</p>}
 </section>;
}

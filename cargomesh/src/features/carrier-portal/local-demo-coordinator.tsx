"use client";
import {useEffect,useState} from 'react';
import {CarrierNavigation,CarrierMenuButton,CarrierBreadcrumb} from '@/features/carrier-navigation/carrier-navigation';
import {LanguageSwitcher} from '@/components/language-switcher';
import {useLocale} from '@/features/i18n/locale-provider';
import {LocalDraftWorkspace,LocalDraftRecovery} from './local-draft-workspace';
import {useLocalDraft} from './use-local-draft';
import {useLocalRequestExamples} from './use-local-request-examples';
import {FleetWorkspace} from './fleet-workspace';
import s from './portal.module.css';
import nav from '@/features/carrier-navigation/carrier-navigation.module.css';

type DemoView='dashboard'|'shipments'|'request'|'desk'|'tracking'|'fleet'|'help';
const titles:Record<DemoView,string>={dashboard:'Demo dashboard',shipments:'Demo requests',request:'Edit demo request',desk:'Demo review',tracking:'Demo route',fleet:'Demo fleet & drivers',help:'Demo help'};
/** Local-only examples: this tree contains no customer intake or connected request reader. */
export function LocalDemoCoordinator() {
  const {locale}=useLocale(),local=useLocalDraft(),requests=useLocalRequestExamples(local.record,local.enabled,local.save);
  const [view,setView]=useState<DemoView>('fleet');
  useEffect(()=>{const sync=()=>{const part=window.location.hash.replace(/^#\/?/,'').split('/')[0];setView(part in titles?part as DemoView:'fleet');};sync();window.addEventListener('hashchange',sync);return()=>window.removeEventListener('hashchange',sync);},[]);
  return <CarrierNavigation current={view} locale={locale} workspaceHref="/v2-workspace?demo=1" towerHref="/v2-workspace#/tower" editRequest demoMode previewEnabled={false} sourceLabel="Local demo · not connected">
    <div className={nav.workspaceSurface}><header className={s.topbar}><div><CarrierMenuButton/><CarrierBreadcrumb currentLabel={titles[view]} locale={locale} workspaceHref="/v2-workspace?demo=1"/></div><div><LanguageSwitcher compact/><a href="/v2-workspace#/fleet">Return to connected Carrier</a></div></header>
    <main className={s.content} id="coordinator-content"><div className={s.heading}><div><span className={s.eyebrow}>Local demo</span><h1 tabIndex={-1}>{titles[view]}</h1></div></div>
    <p className={s.notice}>Simulated examples stored on this device. Editing, truck replacement and 3D scenes do not create connected requests, offers or bookings.</p>
    {view==='fleet'?<FleetWorkspace demoOnly/>:view==='help'?<section className={s.card}><h2>Demo only</h2><p>These examples demonstrate request editing and truck scenes. Customer requests belong to the Shipper portal; authorized Carrier data is available in Connected mode.</p></section>:local.phase!=='ready'||!requests.selected?<LocalDraftRecovery phase={local.phase} retry={local.retry} save={local.save}/>:<LocalDraftWorkspace record={requests.selected.record} view={view} save={requests.save} entries={requests.entries} activeId={requests.selected.id} select={requests.select}/>}
    {requests.storageError?<p role="alert">Local examples could not be read. Connected data is not used as a fallback.</p>:null}
    </main></div>
  </CarrierNavigation>;
}

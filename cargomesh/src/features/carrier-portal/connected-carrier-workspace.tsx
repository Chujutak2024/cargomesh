"use client";
import {useEffect,useState} from 'react';
import {Button,Select} from '@/components/ui';
import {LanguageSwitcher} from '@/components/language-switcher';
import {CarrierNavigation,CarrierMenuButton,CarrierBreadcrumb} from '@/features/carrier-navigation/carrier-navigation';
import {carrierPreviewFromHash,CARRIER_TOWER,type CarrierPreview} from '@/features/carrier-navigation/workspace-route';
import {ControlTower} from '@/features/carrier-control-tower/control-tower';
import {RouteLab} from '@/features/road-route-lab/route-lab';
import type {CarrierPortalAccessV2} from '@/shared/schemas/v2/carrier-portal';
import {useLocale} from '@/features/i18n/locale-provider';
import {readFleetAccess} from './connected-fleet-client';
import {portalErrorCopy} from './api';
import {FleetWorkspace} from './fleet-workspace';
import {ConnectedCommercialWorkspace} from './connected-commercial-workspace';
import {ConnectedCarrierNetwork} from './connected-carrier-network';
import {carrierWorkspaceView,type CarrierWorkspaceView} from './carrier-workspace-model';
import s from './portal.module.css';
import nav from '@/features/carrier-navigation/carrier-navigation.module.css';

const titles:Record<CarrierWorkspaceView,string>={dashboard:'Dashboard',shipments:'Requests',desk:'Offers',tracking:'Orders',orders:'Orders',pipeline:'Pipeline',fleet:'Fleet & drivers',sites:'Sites & coverage',help:'Help'};
export function ConnectedCarrierWorkspace({previewEnabled}:{previewEnabled:boolean}) {
  const {locale}=useLocale();
  const [view,setView]=useState<CarrierWorkspaceView>('fleet'),[preview,setPreview]=useState<CarrierPreview|null>(null);
  const [access,setAccess]=useState<CarrierPortalAccessV2[]|null>(null),[carrierId,setCarrierId]=useState(''),[error,setError]=useState(''),[refresh,setRefresh]=useState(0);
  useEffect(()=>{
    const sync=()=>{const hash=window.location.hash;
      if(previewEnabled&&hash.startsWith('#/fleet/demo')){window.location.replace('/v2-workspace?demo=1'+hash);return;}
      setPreview(carrierPreviewFromHash(hash,previewEnabled));setView(carrierWorkspaceView(hash));
    };sync();window.addEventListener('hashchange',sync);return()=>window.removeEventListener('hashchange',sync);
  },[previewEnabled]);
  useEffect(()=>{
    const controller=new AbortController();setAccess(null);setCarrierId('');setError('');
    void readFleetAccess(controller.signal).then(rows=>{if(!controller.signal.aborted){setAccess(rows);setCarrierId(rows.length===1?rows[0].carrierId:'');}})
      .catch(e=>{if(!controller.signal.aborted)setError(portalErrorCopy(e,false));});
    return()=>controller.abort();
  },[refresh]);
  useEffect(()=>{const pane=document.querySelector<HTMLElement>('[data-carrier-scroll]');pane?.scrollTo({top:0});},[view,preview]);
  const active=access?.find(row=>row.carrierId===carrierId);
  const title=preview==='route-lab'?'Road routing lab':preview==='tower'?'Control tower':titles[view];
  return <CarrierNavigation current={preview??(view==='sites'?'sites':view)} locale={locale} towerHref={CARRIER_TOWER} previewEnabled={previewEnabled} sourceLabel={preview?'Visual preview · not live':'Connected carrier records'}>
    {preview==='tower'?<ControlTower embedded/>:<div className={nav.workspaceSurface}><header className={s.topbar}><div><CarrierMenuButton/><CarrierBreadcrumb currentLabel={title} locale={locale}/></div><div><LanguageSwitcher compact/><form action="/api/auth/logout" method="post"><Button type="submit" variant="secondary">Sign out</Button></form></div></header>
    {preview==='route-lab'?<RouteLab/>:<main className={s.content} id="coordinator-content"><div className={s.heading}><div><span className={s.eyebrow}>Carrier workspace</span><h1 tabIndex={-1}>{title}</h1><p>Authorized carrier records. Customer requests and local demo data remain separate.</p></div></div>
      {error?<section className={s.card}><p role="alert">{error}</p><Button onClick={()=>setRefresh(n=>n+1)}>Retry access</Button></section>:!access?<p role="status">Checking carrier access…</p>:!access.length?<section className={s.card}><h2>No carrier access</h2><p>Your account has no authorized carrier membership. Customer membership does not grant carrier access.</p></section>:<>
      <div className={s.toolbar}><Select label="Authorized carrier" value={carrierId} onChange={e=>setCarrierId(e.target.value)}><option value="">Select carrier</option>{access.map(row=><option key={row.carrierId} value={row.carrierId}>{row.carrierName} · {row.role}</option>)}</Select></div>
      {active?view==='fleet'?<FleetWorkspace key={active.carrierId} carrierContext={active} demoAvailable={previewEnabled}/>:view==='sites'?<ConnectedCarrierNetwork key={active.carrierId} carrierId={active.carrierId} role={active.role}/>:view==='help'?<section className={s.card}><h2>Responsibilities</h2><p>Customers create and authorize their freight requests. Carriers review opportunities, issue their own offers and organize confirmed operations.</p><p>Use Sites & coverage to inspect bases, pickup/delivery areas and directed lanes. Coverage does not confirm equipment or availability.</p><p>Use Demo to inspect local examples and 3D scenes. Demo changes do not update connected records.</p></section>:<ConnectedCommercialWorkspace key={active.carrierId+view} carrier={active} view={view}/>:<p>Select an authorized carrier to continue.</p>}
      </>}
    </main>}</div>}
  </CarrierNavigation>;
}

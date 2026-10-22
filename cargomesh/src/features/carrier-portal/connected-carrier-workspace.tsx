"use client";
import {carrierDisplayName} from '@/shared/lib/display-identity';
import dynamic from 'next/dynamic';
import {GuidanceImage} from './guidance-image';
import {usePathname} from 'next/navigation';
import {carrierHashFromPath,carrierHref} from '@/shared/navigation/workspaces';
import {navigateCarrier} from '@/features/carrier-navigation/carrier-link';
import {useEffect,useState} from 'react';
import {Button,Select} from '@/components/ui';
import {LanguageSwitcher} from '@/components/language-switcher';
import {CarrierNavigation,CarrierMenuButton,CarrierBreadcrumb} from '@/features/carrier-navigation/carrier-navigation';
import {carrierPreviewFromHash,CARRIER_TOWER,type CarrierPreview} from '@/features/carrier-navigation/workspace-route';
const ControlTower=dynamic(()=>import('@/features/carrier-control-tower/control-tower').then(m=>m.ControlTower),{loading:()=> <p role="status">Loading Control tower…</p>});
const RouteLab=dynamic(()=>import('@/features/road-route-lab/route-lab').then(m=>m.RouteLab),{loading:()=> <p role="status">Loading road routes…</p>});
import type {CarrierPortalAccessV2} from '@/shared/schemas/v2/carrier-portal';
import {useLocale} from '@/features/i18n/locale-provider';
import {readFleetAccess} from './connected-fleet-client';
import {portalErrorCopy} from './api';
const ConnectedFleet=dynamic(()=>import('./connected-fleet').then(m=>m.ConnectedFleet),{loading:()=> <p role="status">Loading fleet…</p>});
import {ConnectedCommercialWorkspace} from './connected-commercial-workspace';
import {ConnectedCarrierNetwork} from './connected-carrier-network';
import {carrierWorkspaceView,type CarrierWorkspaceView} from './carrier-workspace-model';
import s from './portal.module.css';
import nav from '@/features/carrier-navigation/carrier-navigation.module.css';

const titles:Record<CarrierWorkspaceView,string>={dashboard:'Dashboard',shipments:'Requests',desk:'Offers',tracking:'Orders',orders:'Orders',pipeline:'Pipeline',fleet:'Fleet',sites:'Sites & coverage',help:'Help'};
export function ConnectedCarrierWorkspace({previewEnabled,initialAccess}:{previewEnabled:boolean;initialAccess?:CarrierPortalAccessV2[]}) {
  const {locale}=useLocale();const pathname=usePathname();
  const [fleetSection,setFleetSection]=useState('vehicles');
  const [view,setView]=useState<CarrierWorkspaceView>(pathname.startsWith('/carriers')?carrierWorkspaceView(carrierHashFromPath(pathname)):'fleet'),[preview,setPreview]=useState<CarrierPreview|null>(null);
  const [access,setAccess]=useState<CarrierPortalAccessV2[]|null>(initialAccess??null),[carrierId,setCarrierId]=useState(initialAccess?.length===1?initialAccess[0].carrierId:''),[error,setError]=useState(''),[refresh,setRefresh]=useState(0);
  useEffect(()=>{
    const sync=()=>{
      if(window.location.pathname.startsWith('/carriers')&&window.location.hash.startsWith('#/')){navigateCarrier(carrierHref(window.location.hash),true);return;}
      const hash=window.location.pathname.startsWith('/carriers')?carrierHashFromPath(window.location.pathname):window.location.hash;
      if(previewEnabled&&hash.startsWith('#/fleet/demo')){window.location.replace('/v2-workspace?demo=1'+hash);return;}
      setPreview(carrierPreviewFromHash(hash,previewEnabled));setView(carrierWorkspaceView(hash));
    };sync();window.addEventListener('hashchange',sync);window.addEventListener('cm-carrier-route',sync);window.addEventListener('popstate',sync);return()=>{window.removeEventListener('hashchange',sync);window.removeEventListener('cm-carrier-route',sync);window.removeEventListener('popstate',sync);};
  },[previewEnabled,pathname]);
  useEffect(()=>{
    if(refresh===0&&initialAccess)return;
    const controller=new AbortController();setAccess(null);setCarrierId('');setError('');
    void readFleetAccess(controller.signal).then(rows=>{if(!controller.signal.aborted){setAccess(rows);setCarrierId(rows.length===1?rows[0].carrierId:'');}})
      .catch(e=>{if(!controller.signal.aborted)setError(portalErrorCopy(e,false));});
    return()=>controller.abort();
  },[refresh,initialAccess]);
  useEffect(()=>{const pane=document.querySelector<HTMLElement>('[data-carrier-scroll]');pane?.scrollTo({top:0});},[view,preview]);
  const active=access?.find(row=>row.carrierId===carrierId);
  const title=preview==='route-lab'?'Road routing lab':preview==='tower'?'Control tower':titles[view];
  return <CarrierNavigation current={preview??(view==='sites'?'sites':view)} locale={locale} towerHref={CARRIER_TOWER} previewEnabled={previewEnabled} sourceLabel={preview?'Visual preview · not live':(active?carrierDisplayName(active.carrierName,active.carrierId):undefined)??'Carrier workspace'}>
    {preview==='tower'?<ControlTower embedded/>:<div className={nav.workspaceSurface}><header className={s.topbar}><div><CarrierMenuButton/><CarrierBreadcrumb currentLabel={title} locale={locale}/></div><div>{!preview&&access&&access.length>1?<Select fieldClassName={s.carrierContextPicker} label="Carrier" value={carrierId} onChange={e=>setCarrierId(e.target.value)}><option value="">Select carrier</option>{access.map(row=><option key={row.carrierId} value={row.carrierId}>{carrierDisplayName(row.carrierName,row.carrierId)}</option>)}</Select>:null}<LanguageSwitcher compact/><form action="/api/auth/logout" method="post"><Button type="submit" variant="secondary">Sign out</Button></form></div></header>
    {preview==='route-lab'?<RouteLab/>:<main className={s.content} id="coordinator-content"><div className={s.heading}><div><span className={s.eyebrow}>{view==='fleet'?'Fleet coordination':'Carrier workspace'}</span><h1 tabIndex={-1}>{title}</h1>{view==='fleet'?<p>View truck conditions and organize their assignments.</p>:null}</div></div>
      {error?<section className={s.card}><p role="alert">{error}</p><Button onClick={()=>setRefresh(n=>n+1)}>Retry access</Button></section>:!access?<p role="status">Checking carrier access…</p>:!access.length?<section className={s.card}><h2>No carrier access</h2><p>Your account has no authorized carrier membership. Customer membership does not grant carrier access.</p></section>:<>

      {active?view==='fleet'?<ConnectedFleet key={active.carrierId} carrierContext={active} demoAvailable={false} section={fleetSection} register={fleetSection==='register'} onNavigate={setFleetSection}/>:view==='sites'?<ConnectedCarrierNetwork key={active.carrierId} carrierId={active.carrierId} role={active.role}/>:view==='help'?<div className={s.grid}><section className={s.card}><GuidanceImage/><h2>Continue from the opportunity</h2><p>Review the customer request, its assigned legs and the current record revision before responding. Issue your own Carrier offer and organize operations after customer authorization.</p></section><section className={s.card}><h2>Sources and responsibilities</h2><p>Sites & coverage shows physical depots separately from pickup/delivery areas and directed service lanes. Resource availability is checked for a window.</p><p>3D scenes are illustrative. Unknown GPS, capacity, timing and permissions remain pending. Customer selection and booking consent belong to the Client.</p></section></div>:<ConnectedCommercialWorkspace key={active.carrierId} carrier={active} view={view}/>:<p>Choose a carrier from the header to continue.</p>}
      </>}
    </main>}</div>}
  </CarrierNavigation>;
}

"use client";

import { createContext, useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Activity, Building2, ClipboardCheck, CircleHelp, ChevronRight, LayoutDashboard, Menu, Package, PanelLeftClose, PanelLeftOpen, Plus, Route, Truck, UserRound, X } from 'lucide-react';
import { carrierActiveItem, carrierNavigation, type CarrierNavIcon } from './navigation-model';
import s from './carrier-navigation.module.css';
import { lockDocumentScroll } from "@/shared/browser/scroll-lock";

const icons: Record<CarrierNavIcon, typeof Truck> = { dashboard: LayoutDashboard, activity: Activity, package: Package, route: Route, truck: Truck, review: ClipboardCheck, building: Building2, register: Plus, request: Package, help: CircleHelp };
const NavigationContext = createContext<{ toggle: () => void; expanded: boolean; mobile: boolean; sidebarId: string; locale: 'es' | 'en' } | null>(null);

export function CarrierMenuButton() {
  const nav = useContext(NavigationContext);
  if (!nav) throw new Error('CarrierMenuButton requires CarrierNavigation');
  const label = nav.mobile ? (nav.locale === 'es' ? 'Abrir menú carrier' : 'Open carrier menu') : (nav.expanded ? (nav.locale === 'es' ? 'Contraer menú carrier' : 'Collapse carrier menu') : (nav.locale === 'es' ? 'Expandir menú carrier' : 'Expand carrier menu'));
  const Icon = nav.mobile ? Menu : nav.expanded ? PanelLeftClose : PanelLeftOpen;
  return <button className={s.menuButton} type="button" aria-label={label} aria-controls={nav.sidebarId} aria-expanded={nav.expanded} onClick={nav.toggle}><Icon size={18} aria-hidden="true" /></button>;
}

export function CarrierBreadcrumb({ currentLabel, locale = 'en', workspaceHref = '/v2-workspace', className }: {
  currentLabel: string; locale?: 'es' | 'en'; workspaceHref?: string; className?: string;
}) {
  return <nav className={[s.breadcrumb, className].filter(Boolean).join(' ')} aria-label={locale === 'es' ? 'Ruta de navegación' : 'Breadcrumb'}>
    <ol><li className={s.breadcrumbRoot}><a href={workspaceHref + '#/dashboard'}>Carrier</a><ChevronRight size={13} aria-hidden="true" /></li><li aria-current="page">{currentLabel}</li></ol>
  </nav>;
}

export function CarrierNavigation({ children, current, locale, workspaceHref = '/v2-workspace', towerHref, editRequest = false, previewEnabled = true, demoMode = false, sourceLabel }: {
  children: ReactNode; current: string; locale: 'es' | 'en'; workspaceHref?: string; towerHref: string; editRequest?: boolean; previewEnabled?: boolean; demoMode?: boolean; sourceLabel: string;
}) {
  const [collapsed, setCollapsed] = useState(false), [open, setOpen] = useState(false), [mobile, setMobile] = useState(false), [hash, setHash] = useState('');
  const sidebarId = useId(), titleId = useId();
  const sidebar = useRef<HTMLElement>(null), closeButton = useRef<HTMLButtonElement>(null), trigger = useRef<HTMLElement | null>(null);
  const wasOpen = useRef(false);
  const t = (es: string, en: string) => locale === 'es' ? es : en;
  const close = () => setOpen(false);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)');
    const resize = () => { setMobile(media.matches); if (!media.matches) setOpen(false); };
    const syncHash = () => { setHash(window.location.hash); setOpen(false); };
    resize(); syncHash(); media.addEventListener('change', resize); window.addEventListener('hashchange', syncHash);
    return () => { media.removeEventListener('change', resize); window.removeEventListener('hashchange', syncHash); };
  }, []);
  useEffect(() => {
    if (!open || !mobile) {
      if (wasOpen.current) trigger.current?.focus();
      wasOpen.current = false;
      return;
    }
    wasOpen.current = true;
    closeButton.current?.focus();
    const releaseScroll = lockDocumentScroll(document);
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); close(); }
      if (event.key !== 'Tab') return;
      const controls = sidebar.current?.querySelectorAll<HTMLElement>('a[href],button:not([disabled])');
      if (!controls?.length) return;
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', keydown);
    return () => { releaseScroll(); document.removeEventListener('keydown', keydown); };
  }, [open, mobile]);
  const groups = carrierNavigation({ locale, workspaceHref, towerHref, editRequest, previewEnabled, demoMode });
  const rawActive = carrierActiveItem(current === 'route-lab' ? 'tower' : current, hash);
  const active = !demoMode && rawActive === 'register' ? 'fleet' : rawActive;
  const expanded = mobile ? open : !collapsed;
  return <NavigationContext.Provider value={{ expanded, mobile, sidebarId, locale, toggle: () => {
    if (mobile) { trigger.current = document.activeElement as HTMLElement; setOpen(value => !value); }
    else setCollapsed(value => !value);
  } }}>
    <div className={s.frame} data-cm-select-scope data-collapsed={collapsed} data-open={open}>
      <a className={s.skip} href={current === 'tower' ? '#tower-main' : '#coordinator-content'}>{t('Saltar al contenido', 'Skip to content')}</a>
      <aside ref={sidebar} id={sidebarId} className={s.sidebar} role={mobile && open ? 'dialog' : undefined} aria-modal={mobile && open ? true : undefined} aria-labelledby={titleId} inert={mobile && !open}>
        <div className={s.brandRow}>
          <a className={s.brand} href={`${workspaceHref}#/dashboard`} aria-label="CargoMesh" onClick={close}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/v2-workspace/cargomesh-icon.png" width={30} height={30} alt="" /><span>CargoMesh</span>
          </a>
          <span id={titleId} className={s.srOnly}>{t('Navegación carrier', 'Carrier navigation')}</span>
          <button ref={closeButton} className={s.closeButton} type="button" onClick={close} aria-label={t('Cerrar menú carrier', 'Close carrier menu')}><X size={19} aria-hidden="true" /></button>
        </div>
        <nav className={s.nav} aria-label={t('Menú carrier', 'Carrier menu')}>
          {groups.map(group => <section className={s.group} key={group.id} aria-labelledby={`${sidebarId}-${group.id}`}>
            <h2 id={`${sidebarId}-${group.id}`} className={s.groupLabel}>{group.label}</h2>
            {group.items.map(item => { const Icon = icons[item.icon]; return <a key={item.id} href={item.href} className={s.item} aria-label={`${item.label}${item.preview ? ' · Preview' : ''}`} aria-current={active === item.id ? 'page' : undefined} title={!expanded ? item.label : undefined} onClick={close}>
              <Icon size={18} strokeWidth={1.5} aria-hidden="true" /><span className={s.itemLabel}>{item.label}</span>{item.preview ? <small className={s.preview}>Preview</small> : null}
            </a>; })}
          </section>)}
        </nav>
        <div className={s.identity}><span className={s.avatar}><UserRound size={19} aria-hidden="true" /></span><div><strong>{t('Espacio carrier', 'Carrier workspace')}</strong><span>{sourceLabel}</span></div></div>
      </aside>
      {mobile && open ? <button className={s.backdrop} type="button" aria-label={t('Cerrar menú carrier', 'Close carrier menu')} onClick={close} tabIndex={-1} /> : null}
      <div className={s.content} data-carrier-scroll tabIndex={-1} inert={mobile && open}>{children}</div>
    </div>
  </NavigationContext.Provider>;
}

export type CarrierNavId = 'dashboard' | 'tower' | 'shipments' | 'tracking' | 'fleet' | 'desk' | 'sites' | 'register' | 'request' | 'help' | 'demo' | 'orders' | 'pipeline';
export type CarrierNavIcon = 'dashboard' | 'activity' | 'package' | 'route' | 'truck' | 'review' | 'building' | 'register' | 'request' | 'help';
export type CarrierNavItem = { id: CarrierNavId; label: string; href: string; icon: CarrierNavIcon; preview?: boolean };
export type CarrierNavGroup = { id: string; label: string; items: CarrierNavItem[] };

/** Presentation destinations only. Authentication and role guards stay at the destination. */
export function carrierNavigation({ locale, workspaceHref, towerHref, editRequest = false, previewEnabled = true, demoMode = false }: {
  locale: 'es' | 'en'; workspaceHref: string; towerHref: string; editRequest?: boolean; previewEnabled?: boolean; demoMode?: boolean;
}): CarrierNavGroup[] {
  const t = (es: string, en: string) => locale === 'es' ? es : en;
  const page = (hash: string) => `${workspaceHref}#/${hash}`;
  return [
    { id: 'overview', label: t('Resumen', 'Overview'), items: [
      { id: 'dashboard', label: 'Dashboard', href: page('dashboard'), icon: 'dashboard' },
      ...(previewEnabled ? [{ id: 'tower' as const, label: 'Control tower', href: towerHref, icon: 'activity' as const, preview: true }] : []),
    ] },
    { id: 'operations', label: t('Operaciones de transporte', 'Transport operations'), items: [
      { id: 'shipments', label: t('Solicitudes', 'Requests'), href: page('shipments'), icon: 'package' },
      ...(demoMode ? [{id:'tracking' as const,label:t('Planificación de rutas','Route planning'),href:page('tracking'),icon:'route' as const}] : [{id:'orders' as const,label:'Orders',href:page('orders'),icon:'package' as const},{id:'pipeline' as const,label:'Pipeline',href:page('pipeline'),icon:'activity' as const}]),
      { id: 'fleet', label: t('Flota y conductores', 'Fleet & drivers'), href: page('fleet'), icon: 'truck' },
      { id: 'desk', label: demoMode ? t('Revisión de solicitudes', 'Request review') : t('Ofertas', 'Offers'), href: page(demoMode && editRequest ? 'desk/review' : 'desk'), icon: 'review' },
    ] },
    { id: 'management', label: t('Administración', 'Administration'), items: [
      { id: 'sites', label: t('Sedes y cobertura', 'Sites & coverage'), href: page('fleet/carriers'), icon: 'building' },
      ...(demoMode ? [{ id: 'register' as const, label: t('Registrar vehículo', 'Register vehicle'), href: page('fleet/demo/register'), icon: 'register' as const },
      { id: 'request' as const, label: editRequest ? t('Editar solicitud', 'Edit request') : t('Nueva solicitud', 'New request'), href: page('request'), icon: 'request' as const }] : []),
      { id: 'help', label: t('Ayuda', 'Help'), href: page('help'), icon: 'help' },
    ] },
    ...(previewEnabled || demoMode ? [{id:'workspace-mode',label:t('Modo de trabajo','Workspace mode'),items:[{id:'demo' as const,label:demoMode?'Connected Carrier':'Demo',href:demoMode?'/v2-workspace#/fleet':'/v2-workspace?demo=1#/dashboard',icon:'help' as const}]}] : []),
  ];
}

export function carrierActiveItem(current: string, hash: string): CarrierNavId {
  if (current === 'fleet') {
    const part = hash.replace(/^#\//, '').split('/').filter(value => value !== 'service');
    if (part[1] === 'carriers') return 'sites';
    if (part[1] === 'register') return 'register';
  }
  return current as CarrierNavId;
}

export type CarrierNavId = 'dashboard' | 'tower' | 'shipments' | 'tracking' | 'fleet' | 'desk' | 'sites' | 'register' | 'request' | 'help';
export type CarrierNavIcon = 'dashboard' | 'activity' | 'package' | 'route' | 'truck' | 'review' | 'building' | 'register' | 'request' | 'help';
export type CarrierNavItem = { id: CarrierNavId; label: string; href: string; icon: CarrierNavIcon; preview?: boolean };
export type CarrierNavGroup = { id: string; label: string; items: CarrierNavItem[] };

/** Presentation destinations only. Authentication and role guards stay at the destination. */
export function carrierNavigation({ locale, workspaceHref, towerHref, editRequest = false, previewEnabled = true }: {
  locale: 'es' | 'en'; workspaceHref: string; towerHref: string; editRequest?: boolean; previewEnabled?: boolean;
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
      { id: 'tracking', label: t('Planificación de rutas', 'Route planning'), href: page('tracking'), icon: 'route' },
      { id: 'fleet', label: t('Flota y conductores', 'Fleet & drivers'), href: page('fleet'), icon: 'truck' },
      { id: 'desk', label: t('Revisión de solicitudes', 'Request review'), href: page(editRequest ? 'desk/review' : 'desk'), icon: 'review' },
    ] },
    { id: 'management', label: t('Administración', 'Administration'), items: [
      { id: 'sites', label: t('Sedes y cobertura', 'Sites & coverage'), href: page('fleet/carriers'), icon: 'building' },
      { id: 'register', label: t('Registrar vehículo', 'Register vehicle'), href: page('fleet/register'), icon: 'register' },
      { id: 'request', label: editRequest ? t('Editar solicitud', 'Edit request') : t('Nueva solicitud', 'New request'), href: page('request'), icon: 'request' },
      { id: 'help', label: t('Ayuda', 'Help'), href: page('help'), icon: 'help' },
    ] },
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

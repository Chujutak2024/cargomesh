export const CLIENTS_ROOT = '/clients';
export const CARRIERS_ROOT = '/carriers';
export const CLIENT_SECTIONS = ['dashboard', 'requests', 'freight-request', 'facilities', 'bookings', 'tracking', 'history', 'organization', 'support', 'help'] as const;

export function clientHref(href: string) {
  if (!href.startsWith('/') || href.startsWith('//')) return href;
  const path = href.split(/[?#]/)[0];
  if (!CLIENT_SECTIONS.some(section => path === '/' + section || path.startsWith('/' + section + '/'))) return href;
  return path === '/dashboard' ? CLIENTS_ROOT + href.slice(path.length) : CLIENTS_ROOT + href;
}
export function clientSectionPath(path: string) {
  return path === CLIENTS_ROOT || path === CLIENTS_ROOT + '/' ? '/dashboard'
    : path.startsWith(CLIENTS_ROOT + '/') ? path.slice(CLIENTS_ROOT.length) : path;
}
export function carrierHref(hash: string) {
  const clean = hash.replace(/^#\/?/, '').replace(/^\//, '');
  const [section, ...rest] = clean.split('/');
  const tail = rest.filter(Boolean).join('/');
  if (section === 'fleet' && rest.filter(v => v !== 'service')[0] === 'carriers') return '/carriers/sites';
  const names: Record<string, string> = { dashboard: '', shipments: 'requests', desk: 'offers', tracking: 'orders',
    orders: 'orders', pipeline: 'pipeline', fleet: 'fleet', help: 'help', tower: 'control-tower', 'route-lab': 'route-lab', request: 'requests' };
  if (!(section in names)) return CARRIERS_ROOT;
  return CARRIERS_ROOT + (names[section] ? '/' + names[section] : '')
    + (tail && section !== 'request' && !tail.includes('demo') ? '/' + tail : '');
}
export function carrierHashFromPath(path: string) {
  const clean = path.replace(/^\/carriers\/?/, '');
  const [section, ...rest] = clean.split('/');
  const names: Record<string, string> = { '': 'dashboard', requests: 'shipments', offers: 'desk', sites: 'fleet/carriers', 'control-tower': 'tower' };
  return '#/' + (names[section] ?? section) + (rest.length ? '/' + rest.join('/') : '');
}

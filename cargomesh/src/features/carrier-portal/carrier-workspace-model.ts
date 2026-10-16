export type CarrierWorkspaceView = 'dashboard' | 'shipments' | 'desk' | 'tracking' | 'fleet' | 'sites' | 'help' | 'orders' | 'pipeline';
export function carrierWorkspaceView(hash: string): CarrierWorkspaceView {
  const parts = hash.replace(/^#\/?/, '').split('/');
  if (parts[0] === 'fleet' && parts.filter(p => p !== 'service')[1] === 'carriers') return 'sites';
  if (parts[0] === 'tracking') return 'orders';
  if (parts[0] === 'request') return 'shipments'; // Old edit links open the inbox, never a shipper editor.
  return ['dashboard', 'shipments', 'desk', 'tracking', 'fleet', 'help', 'orders', 'pipeline'].includes(parts[0])
    ? parts[0] as CarrierWorkspaceView : 'fleet';
}
export function carrierDemoMode(requested: unknown, enabled: boolean) {
  return enabled && requested === '1';
}
export function carrierResourceKeys(view: CarrierWorkspaceView): string[] {
  return view === 'dashboard' ? ['opportunities', 'offers', 'executions']
    : view === 'shipments' ? ['opportunities'] : view === 'desk' ? ['offers'] : view === 'tracking' ? ['executions'] : [];
}

/** One browser document owns Carrier views, including explicitly enabled previews. */
export const CARRIER_WORKSPACE = '/carriers';
export const CARRIER_TOWER = CARRIER_WORKSPACE + '/control-tower';
export const CARRIER_ROUTE_LAB = CARRIER_WORKSPACE + '/route-lab';
export type CarrierPreview = 'tower' | 'route-lab';
export function carrierPreviewFromHash(hash: string, enabled: boolean): CarrierPreview | null {
  const section = hash.replace(/^#\/?/, '').split('/')[0];
  return enabled && (section === 'tower' || section === 'route-lab') ? section : null;
}

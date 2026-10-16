/** One browser document owns Carrier views, including explicitly enabled previews. */
export const CARRIER_WORKSPACE = '/v2-workspace';
export const CARRIER_TOWER = CARRIER_WORKSPACE + '#/tower';
export const CARRIER_ROUTE_LAB = CARRIER_WORKSPACE + '#/route-lab';
export type CarrierPreview = 'tower' | 'route-lab';
export function carrierPreviewFromHash(hash: string, enabled: boolean): CarrierPreview | null {
  const section = hash.replace(/^#\/?/, '').split('/')[0];
  return enabled && (section === 'tower' || section === 'route-lab') ? section : null;
}

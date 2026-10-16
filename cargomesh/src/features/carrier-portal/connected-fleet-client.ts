import { CarrierPortalAccessListV2Schema } from '@/shared/schemas/v2/carrier-portal';
import { FleetInputsV2 } from '@/shared/schemas/v2/fleet';
import { parseCatalogRecordV2 } from '@/shared/schemas/v2/catalog';
import { portalRequest, PortalApiError } from './api';
import { readFleetResource } from './fleet-client';
import { recordData, validCarrierId, type PortalRecord } from './records';

export async function readFleetAccess(signal: AbortSignal, fetcher: typeof fetch = fetch) {
  const response = await portalRequest('/api/v2/carrier-portal/access', { signal }, fetcher);
  try { return CarrierPortalAccessListV2Schema.parse(response.data); }
  catch { throw new PortalApiError(502, 'INVALID_RESPONSE'); }
}
export async function readConnectedFleet(carrierId: string, signal: AbortSignal, fetcher: typeof fetch = fetch) {
  const keys = ['assets', 'services', 'depots', 'drivers', 'partners'] as const;
  const rows = await Promise.all(keys.map(key => readFleetResource(carrierId, key, signal, fetcher)));
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
  return { carrierId, assets: rows[0].records, services: rows[1].records, depots: rows[2].records,
    drivers: rows[3].records, partners: rows[4].records, partial: rows.some(row => row.truncated), readAt: new Date().toISOString() };
}
export function roadAssets(records: PortalRecord[], serviceId: string) {
  return records.filter(record => recordData(record).mode === 'ROAD' && recordData(record).serviceId === serviceId);
}
export async function saveConnectedVehicle(options: {
  carrierId: string; serviceId: string; value: unknown; key: string; signal: AbortSignal; record?: PortalRecord;
}, fetcher: typeof fetch = fetch) {
  if (!validCarrierId(options.carrierId) || !validCarrierId(options.serviceId) || !validCarrierId(options.key)) throw new PortalApiError(400, 'INVALID_REFERENCE');
  const value = FleetInputsV2.assets.parse(options.value);
  if (value.mode !== 'ROAD' || value.serviceId !== options.serviceId) throw new PortalApiError(400, 'INVALID_CONTEXT');
  if (options.record && (options.record.carrierId !== options.carrierId || recordData(options.record).serviceId !== options.serviceId || !validCarrierId(options.record.id))) throw new PortalApiError(400, 'INVALID_CONTEXT');
  const path = '/api/v2/carrier-portal/carriers/' + options.carrierId + '/assets' + (options.record ? '/' + options.record.id + '/revisions' : '');
  const response = await portalRequest(path, { method: 'POST', signal: options.signal,
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': options.key },
    body: JSON.stringify(options.record ? { expectedVersion: options.record.version, value } : value) }, fetcher);
  try {
    const saved = parseCatalogRecordV2('assets', response.data);
    if (saved.carrierId !== options.carrierId || recordData(saved).serviceId !== options.serviceId || options.record && saved.id !== options.record.id) throw new Error('Scope mismatch');
    return saved;
  } catch { throw new PortalApiError(502, 'INVALID_RESPONSE'); }
}

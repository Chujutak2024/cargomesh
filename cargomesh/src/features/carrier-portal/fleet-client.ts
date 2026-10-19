import { parseCatalogRecordV2 } from "@/shared/schemas/v2/catalog";
import { portalRequest, PortalApiError } from "./api";
import { parseRecords, validCarrierId, type PortalRecord } from "./records";
import { carrierResources, resourcePath } from "./resources";
import { serviceFleet } from "./fleet-model";

/** Read-only bounded pagination; partial reads are identified, never reported as total fleet. */
export async function readFleetResource(carrierId: string, key: string, signal: AbortSignal, fetcher: typeof fetch = fetch, parentId = "") {
  const resource = carrierResources.find(value => value.key === key);
  if (!validCarrierId(carrierId) || !resource || resource.parent && (resource.parent !== "service" || !validCarrierId(parentId))) throw new PortalApiError(400, "INVALID_API_PATH");
  const records: PortalRecord[] = [], offsets = new Set<number>();
  let offset: number | null = 0; let partial = false;
  for (let page = 0; page < 10 && offset !== null; page++) {
    if (offsets.has(offset)) throw new PortalApiError(502, "INVALID_RESPONSE");
    offsets.add(offset);
    const result = await portalRequest(resourcePath(carrierId, resource, parentId) + `?limit=100&offset=${offset}`, { signal }, fetcher);
    const parsed = parseRecords(resource, result.data, carrierId);
    if (resource.parent === "service" && parsed.some(record => record.serviceId !== parentId)) throw new PortalApiError(502, "INVALID_RESPONSE");
    if (parsed.length > 100 || new Set(parsed.map(record => record.id)).size !== parsed.length
      || parsed.some(record => records.some(previous => previous.id === record.id))) throw new PortalApiError(502, "INVALID_RESPONSE");
    records.push(...parsed); partial ||= result.meta?.partial === true; offset = result.meta?.nextOffset ?? null;
  }
  return { records, truncated: partial || offset !== null };
}
export async function loadFleet(carrierId: string, signal: AbortSignal, fetcher: typeof fetch = fetch) {
  if (!validCarrierId(carrierId)) throw new PortalApiError(400, "INVALID_API_PATH");
  const response = await portalRequest(`/api/v2/carrier-portal/carriers/${encodeURIComponent(carrierId)}`, { signal }, fetcher);
  let profile;
  try { profile = parseCatalogRecordV2("carriers", response.data); }
  catch { throw new PortalApiError(502, "INVALID_RESPONSE"); }
  if (profile.id !== carrierId) throw new PortalApiError(502, "INVALID_RESPONSE");
  const assets = await readFleetResource(carrierId, "assets", signal, fetcher);
  const keys = ["drivers", "vehicle-assignments", "driver-assignments", "executions", "depots", "maintenances"] as const;
  const associated = await Promise.allSettled(keys.map(key => readFleetResource(carrierId, key, signal, fetcher)));
  // A revoked session/grant invalidates the entire view. Other dependent read failures remain explicit gaps.
  const authorizationFailure = associated.find(result => result.status === "rejected"
    && result.reason instanceof PortalApiError && [401, 403].includes(result.reason.status));
  if (authorizationFailure?.status === "rejected") throw authorizationFailure.reason;
  if (signal.aborted) throw new DOMException("Aborted", "AbortError");
  const records = associated.map(result => result.status === "fulfilled" ? result.value.records : []);
  return { vehicles: serviceFleet({ assets: assets.records, drivers: records[0], vehicleAssignments: records[1],
    driverAssignments: records[2], executions: records[3], depots: records[4], maintenances: records[5] }, Date.now()),
    gaps: associated.filter(result => result.status === "rejected").length,
    truncated: assets.truncated || associated.some(result => result.status === "fulfilled" && result.value.truncated),
    readAt: new Date().toISOString() };
}

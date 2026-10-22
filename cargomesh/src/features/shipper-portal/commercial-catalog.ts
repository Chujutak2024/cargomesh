import {carrierDisplayName,displayReference} from '@/shared/lib/display-identity';
import { z } from "zod";
import { CatalogInputsV2, parseCatalogRecordV2 } from "@/shared/schemas/v2/catalog";

type ReadState = "AVAILABLE" | "NOT_FOUND" | "DENIED" | "INCOMPLETE" | "UNAVAILABLE";
export type CarrierIdentity = { id: string; state: ReadState; name: string | null; version: number | null };
export type ServiceIdentity = { id: string; carrierId: string; state: ReadState; mode: string | null; serviceClass: string | null;
  responseChannels: ("MANUAL" | "API" | "MCP")[]; active: boolean; version: number | null };
export type CommercialCatalog = { carriers: Record<string, CarrierIdentity>; services: Record<string, ServiceIdentity> };
export const emptyCommercialCatalog = (): CommercialCatalog => ({ carriers: {}, services: {} });
export type CatalogReference = { kind: "carriers" | "services"; id: string; carrierId: string | null };
export type CatalogRead = (reference: CatalogReference) => Promise<unknown>;
export const COMMERCIAL_CATALOG_READ_LIMIT = 128;

/** Narrow authorized catalog projection. A quote reference never becomes a Carrier name. */
export async function readCommercialCatalog(carrierIds: string[], serviceRefs: { id: string; carrierId: string }[], read: CatalogRead): Promise<CommercialCatalog> {
  const result = emptyCommercialCatalog();
  const services = new Map<string, string>();
  for (const ref of serviceRefs) {
    if (services.has(ref.id) && services.get(ref.id) !== ref.carrierId) throw new Error("CATALOG_SERVICE_SCOPE_MISMATCH");
    services.set(ref.id, ref.carrierId);
  }
  const refs: CatalogReference[] = [...new Set(carrierIds)].map(id => ({ kind: "carriers", id, carrierId: null }));
  refs.push(...[...services].map(([id, carrierId]) => ({ kind: "services" as const, id, carrierId })));
  // Bound enrichment of large historical collections. An unread identity is never guessed.
  for (const ref of refs.splice(COMMERCIAL_CATALOG_READ_LIMIT)) {
    if (ref.kind === "carriers") result.carriers[ref.id] = { id: ref.id, state: "INCOMPLETE", name: null, version: null };
    else result.services[ref.id] = { id: ref.id, carrierId: ref.carrierId!, state: "INCOMPLETE", mode: null, serviceClass: null, responseChannels: [], active: false, version: null };
  }
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(4, refs.length) }, async () => {
    while (cursor < refs.length) {
      const ref = refs[cursor++];
      z.string().uuid().parse(ref.id);
      let record;
      try { record = parseCatalogRecordV2(ref.kind, await read(ref)); }
      catch (error) {
        const status = error && typeof error === "object" ? "httpStatus" in error ? error.httpStatus : "status" in error ? error.status : null : null;
        if (status === 401 || (error instanceof Error && error.name === "AbortError")) throw error;
        if (error instanceof z.ZodError) throw error;
        const state: ReadState = status === 404 ? "NOT_FOUND" : status === 403 ? "DENIED" : status === 409 ? "INCOMPLETE" : "UNAVAILABLE";
        if (ref.kind === "carriers") result.carriers[ref.id] = { id: ref.id, state, name: null, version: null };
        else result.services[ref.id] = { id: ref.id, carrierId: ref.carrierId!, state, mode: null, serviceClass: null, responseChannels: [], active: false, version: null };
        continue;
      }
      if (record.id !== ref.id || (ref.kind === "services" && record.carrierId !== ref.carrierId)
        || (ref.kind === "carriers" && record.carrierId !== null && record.carrierId !== ref.id)) throw new Error("CATALOG_IDENTITY_SCOPE_MISMATCH");
      if (ref.kind === "carriers") {
        const value = CatalogInputsV2.carriers.parse(record.value);
        result.carriers[ref.id] = { id: ref.id, state: "AVAILABLE", name: value.commercialName, version: record.version };
      } else {
        const value = CatalogInputsV2.services.parse(record.value);
        result.services[ref.id] = { id: ref.id, carrierId: ref.carrierId!, state: "AVAILABLE", mode: value.mode,
          serviceClass: value.serviceClass, responseChannels: value.responseChannels, active: value.status === "ACTIVE", version: record.version };
      }
    }
  }));
  return result;
}

export function commercialCatalogReferences(workflow: Record<string, { kind: string; carrierId?: string | null; data: unknown }[]>) {
  const carrierIds: string[] = [], serviceRefs: { id: string; carrierId: string }[] = [];
  for (const row of [...(workflow.offers ?? []), ...(workflow.opportunities ?? [])]) if (row.carrierId) carrierIds.push(row.carrierId);
  for (const row of workflow.plans ?? []) if (row.kind === "plans") {
    const data = row.data as { legAssignments: { carrierId: string; serviceId: string }[] };
    for (const leg of data.legAssignments) { carrierIds.push(leg.carrierId); serviceRefs.push({ id: leg.serviceId, carrierId: leg.carrierId }); }
  }
  return { carrierIds, serviceRefs };
}

export function commonResponseChannels(serviceIds: string[], carrierId: string, catalog: CommercialCatalog) {
  const services = serviceIds.map(id => catalog.services[id]);
  if (!services.length || services.some(row => !row || row.state !== "AVAILABLE" || !row.active || row.carrierId !== carrierId)) return [];
  return (["MANUAL", "API", "MCP"] as const).filter(channel => services.every(row => row.responseChannels.includes(channel)));
}
export function carrierLabel(id: string | null, catalog: CommercialCatalog, t: (es: string, en: string) => string) {
  return id && catalog.carriers[id]?.state === "AVAILABLE" ? carrierDisplayName(catalog.carriers[id].name!,id)
    : id ? displayReference(id,'TRA') : t("Transportista sin identificar", "Unidentified carrier");
}

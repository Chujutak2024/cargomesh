import { z } from "zod";
import { CURRENT_ORIGIN, importLocalDraft, LocalDraftEnvelopeSchema, type LocalDraft, type LocalDraftEnvelope } from "./local-draft-model";

export const USER_REQUEST_ID = "CM-LOCAL-01";
export const DEMO_REQUESTS_KEY = "cargomesh-v2-local-request-examples-v1";
export const ACTIVE_LOCAL_REQUEST_KEY = "cargomesh-v2-active-local-request-v1";
export type LocalRequestEntry = { id: string; example: boolean; record: LocalDraftEnvelope };
const timestamp = "2026-10-08T15:00:00.000Z";
const scenarios: Array<Partial<LocalDraft> & { originId: string; destinationId: string }> = [
  { originId: "lima", destinationId: "arequipa", cargoDescription: "Alimentos refrigerados", quantity: 18, unitWeightKg: 600, pickupDate: "2026-10-09", deliveryDate: "2026-10-11", completedStep: 2, truckPreference: { type: "refrigerated", model: "", photoDataUrl: null } },
  { originId: "cl-santiago", destinationId: "buenos-aires", cargoDescription: "Repuestos industriales", quantity: 12, unitWeightKg: 450, pickupDate: "2026-10-10", deliveryDate: "2026-10-13", completedStep: 3, truckPreference: { type: "articulated", model: "", photoDataUrl: null } },
  { originId: "mexico-city", destinationId: "monterrey", cargoDescription: "Materiales de construcción", quantity: 24, unitWeightKg: 750, pickupDate: "2026-10-12", deliveryDate: "2026-10-14", completedStep: 4, truckPreference: { type: "flatbed", model: "", photoDataUrl: null } },
  { originId: "madrid", destinationId: "barcelona", cargoDescription: "Mobiliario y equipamiento", quantity: 32, unitWeightKg: 125, pickupDate: "2026-10-13", deliveryDate: "2026-10-14", completedStep: 5, savedForReview: true, truckPreference: { type: "rigid", model: "", photoDataUrl: null } },
  { originId: "johannesburg", destinationId: "durban", cargoDescription: "Áridos para construcción", quantity: 20, unitWeightKg: 1000, pickupDate: "2026-10-15", deliveryDate: "2026-10-16", completedStep: 1, truckPreference: { type: "tipper", model: "", photoDataUrl: null } },
  { originId: "sydney", destinationId: "melbourne", cargoDescription: "Productos de consumo", quantity: 28, unitWeightKg: 300, pickupDate: "2026-10-16", deliveryDate: "2026-10-18", completedStep: 0, truckPreference: { type: "articulated", model: "", photoDataUrl: null } },
];

/** Local UI examples only: no commercial identity, carrier, route geometry or API writes. */
export function initialDemoRequests(): LocalRequestEntry[] {
  return scenarios.map((fields, index) => ({ id: `CM-DEMO-${String(index + 2).padStart(2, "0")}`, example: true,
    record: importLocalDraft(JSON.stringify({ savedForReview: false, ...fields }), CURRENT_ORIGIN, timestamp) }));
}
const StoredExamples = z.object({ version: z.literal(1), records: z.record(LocalDraftEnvelopeSchema) });
export function readDemoRequests(raw: string | null): LocalRequestEntry[] {
  const defaults = initialDemoRequests();
  if (!raw) return defaults;
  const stored = StoredExamples.parse(JSON.parse(raw));
  if (Object.keys(stored.records).length !== defaults.length || defaults.some(entry => !stored.records[entry.id])) throw new Error("INVALID_LOCAL_EXAMPLES");
  return defaults.map(entry => ({ ...entry, record: stored.records[entry.id] }));
}
export function serializeDemoRequests(entries: LocalRequestEntry[]): string {
  return JSON.stringify({ version: 1, records: Object.fromEntries(entries.map(entry => [entry.id, entry.record])) });
}
export function updateDemoRequest(entries: LocalRequestEntry[], id: string,
  update: LocalDraftEnvelope | ((current: LocalDraftEnvelope) => LocalDraftEnvelope)): LocalRequestEntry[] {
  if (id === USER_REQUEST_ID || !entries.some(entry => entry.id === id && entry.example)) throw new Error("UNKNOWN_LOCAL_EXAMPLE");
  return entries.map(entry => {
    if (entry.id !== id) return entry;
    const edited = typeof update === "function" ? update(entry.record) : update;
    const record = LocalDraftEnvelopeSchema.parse({ ...entry.record, updatedAt: edited.updatedAt, draft: edited.draft });
    return { ...entry, record };
  });
}

import { z } from "zod";
import { findRoadLocation, landRoutePolicy } from "@/features/v2-workspace/road-locations";
import type { MapPresentation } from "@/features/v2-road-map/road-map-model";
import type { RoadRoutePreviewDto } from "@/features/v2-road-map/road-map-contract";

export const LEGACY_DRAFT_KEY = "cargomesh-v2-react-workspace-draft";
export const LOCAL_DRAFT_KEY = "cargomesh-v2-coordinator-local-draft-v1";
export const ORIGINAL_DRAFT_KEY = "cargomesh-v2-coordinator-import-original-v1";
export const LEGACY_ORIGIN = "http://127.0.0.1:8080";
export const CURRENT_ORIGIN = "http://127.0.0.1:8080";
export const PREVIOUS_CURRENT_ORIGIN = "http://127.0.0.1:8083";
export const TRANSFER_CHANNEL = "cargomesh-local-draft-transfer-v1";
const date = z.string().refine(value => value === "" || (/^\d{4}-\d{2}-\d{2}$/.test(value)
  && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
  && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value));
const cityId = z.string().max(80).refine(value => !!findRoadLocation(value));
const truck = z.object({
  type: z.enum(["rigid", "articulated", "refrigerated", "flatbed", "tipper", "tanker", "mixer", "curtainsider", "lowloader", "logging", "custom"]),
  model: z.string().max(80),
  photoDataUrl: z.string().max(400_000).regex(/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/).nullable(),
  modelAssetId: z.string().uuid().nullable().optional(),
});
/** Pre-registration local data. This is deliberately NOT an API FreightRequestV2. */
export const LocalDraftSchema = z.object({
  originId: cityId, destinationId: cityId, cargoDescription: z.string().max(120),
  quantity: z.number().finite().min(0).max(1_000_000),
  unitWeightKg: z.number().finite().min(0).max(1_000_000),
  pickupDate: date, deliveryDate: date,
  completedStep: z.number().int().min(0).max(5), savedForReview: z.boolean(),
  truckPreference: truck.nullable().optional().transform(value => value ?? null),
});
export type LocalDraft = z.infer<typeof LocalDraftSchema>;
export const LocalDraftEnvelopeSchema = z.object({
  version: z.literal(1), sourceOrigin: z.enum([LEGACY_ORIGIN, "http://127.0.0.1:8083"]),
  importedAt: z.string().datetime(), updatedAt: z.string().datetime(),
  originalRaw: z.string().max(420_000), draft: LocalDraftSchema,
});
export type LocalDraftEnvelope = z.infer<typeof LocalDraftEnvelopeSchema>;

export function importLocalDraft(raw: string, sourceOrigin: typeof LEGACY_ORIGIN | typeof CURRENT_ORIGIN, now: string): LocalDraftEnvelope {
  if (raw.length > 420_000) throw new Error("INVALID_LOCAL_DRAFT");
  return LocalDraftEnvelopeSchema.parse({ version: 1, sourceOrigin, importedAt: now, updatedAt: now,
    originalRaw: raw, draft: LocalDraftSchema.parse(JSON.parse(raw)) });
}
export function readLocalDraft(raw: string | null): LocalDraftEnvelope | null {
  if (!raw) return null;
  return LocalDraftEnvelopeSchema.parse(JSON.parse(raw));
}
export function changeLocalDraft(record: LocalDraftEnvelope, change: Partial<LocalDraft>, now: string): LocalDraftEnvelope {
  const invalidate = "originId" in change || "destinationId" in change ? 0 : "truckPreference" in change ? 1
    : "cargoDescription" in change || "quantity" in change || "unitWeightKg" in change ? 2
      : "pickupDate" in change || "deliveryDate" in change ? 3 : record.draft.completedStep;
  return { ...record, updatedAt: now, draft: LocalDraftSchema.parse({ ...record.draft, ...change,
    completedStep: Math.min(record.draft.completedStep, invalidate), savedForReview: false }) };
}
export function localSections(draft: LocalDraft): boolean[] {
  return [landRoutePolicy(draft.originId, draft.destinationId) === "previewable",
    !!draft.cargoDescription.trim() && Number.isInteger(draft.quantity) && draft.quantity > 0 && draft.unitWeightKg > 0,
    !!draft.pickupDate && !!draft.deliveryDate && draft.pickupDate <= draft.deliveryDate];
}
export function canCompleteLocalStep(draft: LocalDraft, index: number): boolean {
  const sections = localSections(draft);
  return index === 0 ? sections[0] : index === 1 ? sections[0]
    && (draft.truckPreference?.type !== "custom" || draft.truckPreference.model.trim().length >= 2)
    : index === 2 ? sections[1] : index === 3 ? sections[2]
      : sections.every(Boolean) && canCompleteLocalStep(draft, 1);
}
/** No fake carrier or synthetic candidate is needed to draw this city preview. */
export function localMapPresentation(draft: LocalDraft, preview: RoadRoutePreviewDto | null): MapPresentation {
  const origin = findRoadLocation(draft.originId), destination = findRoadLocation(draft.destinationId);
  const usable = origin && destination && landRoutePolicy(draft.originId, draft.destinationId) === "previewable"
    && preview?.provenanceStatus === "ESTIMATED" && preview.geometrySource === "GOOGLE_ROUTES_API"
    && preview.legs.length > 0 && preview.legs.every(leg => leg.waypoints.length >= 2
      && leg.waypoints.every(p => Number.isFinite(p.lat) && Math.abs(p.lat) <= 90 && Number.isFinite(p.lng) && Math.abs(p.lng) <= 180));
  return { selectedCandidate: null, markers: [
    ...(origin ? [{ kind: "origin" as const, point: { lat: origin.lat, lng: origin.lng }, label: origin.city }] : []),
    ...(destination ? [{ kind: "destination" as const, point: { lat: destination.lat, lng: destination.lng }, label: destination.city }] : []),
  ], paths: usable ? preview.legs.map(leg => leg.waypoints.map(({ lat, lng }) => ({ lat, lng }))) : [],
    provenanceStatus: usable ? "ESTIMATED" : "UNKNOWN", geometrySource: usable ? preview.geometrySource : null,
    distanceKm: usable && Number.isFinite(preview.distanceKm) ? preview.distanceKm : null,
    estimatedTransitHours: usable && Number.isFinite(preview.estimatedTransitHours) ? preview.estimatedTransitHours : null };
}
export function isLocalTransfer(event: { origin: string; source: unknown; data: unknown }, expectedWindow: unknown, nonce: string, expectedOrigin = LEGACY_ORIGIN) {
  if (!expectedWindow || event.source !== expectedWindow || event.origin !== expectedOrigin || !nonce) return false;
  const data = event.data as Record<string, unknown> | null;
  return !!data && data.channel === TRANSFER_CHANNEL && data.nonce === nonce
    && (data.raw === null || typeof data.raw === "string" && data.raw.length <= 420_000)
    && (data.recordRaw === undefined || data.recordRaw === null || typeof data.recordRaw === "string" && data.recordRaw.length <= 900_000);
}

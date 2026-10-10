import { z } from "zod";
import { CanonicalLocationV2Schema } from "./freight-request";
import { CommercialEvidenceV2Schema } from "./commercial";
export const LocationQueryV2Schema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("TEXT"), text: z.string().trim().min(2).max(200) }).strict(),
  z.object({ kind: z.literal("COORDINATES"), lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180), radiusMeters: z.number().min(1).max(5000).default(50) }).strict(),
]);
export const LocationCandidateV2Schema = z.object({
  id: z.string().uuid(), kind: z.enum(["FACILITY", "NODE"]), version: z.number().int().positive(),
  location: CanonicalLocationV2Schema, source: CommercialEvidenceV2Schema,
}).strict();
export const LocationResolutionInputV2Schema = z.object({ query: LocationQueryV2Schema }).strict();
export const LocationConfirmationInputV2Schema = z.object({ query: LocationQueryV2Schema,
  candidateId: z.string().uuid(), candidateKind: z.enum(["FACILITY", "NODE"]),
  expectedVersion: z.number().int().positive(), confirmed: z.literal(true),
}).strict();
export const LocationResolutionV2Schema = z.object({ status: z.enum(["NO_MATCH", "CONFIRMATION_REQUIRED", "AMBIGUOUS"]),
  candidates: z.array(LocationCandidateV2Schema).max(50), truncated: z.boolean(), confirmationRequired: z.literal(true),
  source: z.literal("PERSISTED_CARGOMESH_LOCATIONS"), externalGeocoderUsed: z.literal(false),
}).strict();

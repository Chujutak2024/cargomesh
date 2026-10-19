import { z } from 'zod';
import { TimeWindowV2Schema } from './freight-request';

const Id = z.string().uuid();
const Text = z.string().trim().min(1).max(500);
const Instant = z.string().datetime({ offset: true });
const Code = z.string().regex(/^[A-Z][A-Z0-9_]{0,49}$/);
export const BorderReviewStatusSchema = z.enum(['PENDING', 'IN_REVIEW', 'NEEDS_DOCUMENTS', 'APPROVED', 'REJECTED']);
export const BorderPassageStatusSchema = z.enum(['NOT_STARTED', 'APPROACHING', 'WAITING', 'INSPECTION', 'HELD', 'RELEASED', 'CROSSED']);

/** Country pair and lane are declarations checked against the persisted Carrier catalog. */
export const BorderContextV2Schema = z.object({
  schemaVersion: z.literal('2.0'), serviceId: Id, laneId: Id,
  executionId: Id.nullable(), operationReference: Text,
  routeFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  fromCountry: z.string().regex(/^[A-Z]{2}$/), toCountry: z.string().regex(/^[A-Z]{2}$/),
  checkpointReference: Text, window: TimeWindowV2Schema,
  requiredDocuments: z.array(Code).min(1).max(30).refine(v => new Set(v).size === v.length),
  provenance: z.enum(['SIMULATED', 'CARRIER_REPORTED']),
}).strict().refine(v => v.fromCountry !== v.toCountry, 'A directed international country pair is required.');

export const BorderDocumentV2Schema = z.object({
  code: Code, reference: Text, checkedAt: Instant, validUntil: Instant,
}).strict().refine(v => Date.parse(v.validUntil) > Date.parse(v.checkedAt), 'Invalid document validity.');
export const BorderReviewCommandV2Schema = z.object({
  status: BorderReviewStatusSchema.exclude(['PENDING']),
  documents: z.array(BorderDocumentV2Schema).max(30).refine(v => new Set(v.map(d => d.code)).size === v.length),
  note: Text,
}).strict();
export const BorderPassageCommandV2Schema = z.object({
  status: BorderPassageStatusSchema.exclude(['NOT_STARTED']), occurredAt: Instant, reference: Text,
}).strict();
export const BorderRecordV2Schema = z.object({
  id: Id, carrierId: Id, version: z.number().int().positive(),
  laneVersion: z.number().int().positive(), context: BorderContextV2Schema,
  catalogFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  reviewStatus: BorderReviewStatusSchema, documents: z.array(BorderDocumentV2Schema).max(30),
  reviewNote: Text.nullable(), passageStatus: BorderPassageStatusSchema,
  lastEventAt: Instant.nullable(), releaseReference: Text.nullable(), updatedAt: Instant,
}).strict();
export const BorderEventV2Schema = z.object({
  id: z.string().regex(/^\d+$/), crossingId: Id, carrierId: Id, operatorId: Id,
  version: z.number().int().positive(), action: z.enum(['create', 'review', 'passage']),
  value: z.unknown(), recordedAt: Instant,
}).strict();
export type BorderRecordV2 = z.infer<typeof BorderRecordV2Schema>;

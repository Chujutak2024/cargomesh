import { z } from 'zod';
import { BorderContextV2Schema, BorderReviewCommandV2Schema, BorderPassageCommandV2Schema,
  BorderRecordV2Schema, BorderEventV2Schema } from '@/shared/schemas/v2/border-operations';
import { V2DraftError } from '../../freight-requests/application/draft-service';
import { assessBorderDocuments } from '../domain/border-policy';

export type BorderActor = { operatorId: string; carrierId: string };
export type BorderAction = 'create' | 'review' | 'passage' | 'read' | 'list' | 'history' | 'assessment';
export type BorderInput = { id: string | null; expectedVersion: number | null; key: string | null; value: unknown };
export interface BorderRepository { run(actor: BorderActor, action: BorderAction, input: BorderInput): Promise<unknown> }
const Id = z.string().uuid();
const Revision = z.object({ expectedVersion: z.number().int().nonnegative(), value: z.unknown() }).strict();
const CatalogCheck = z.object({ status: z.enum(['eligible', 'ineligible', 'unknown']), reasons: z.array(z.string()).max(30) }).strict();

export class BorderOperationsService {
  constructor(private readonly repository: BorderRepository, private readonly clock = () => new Date().toISOString()) {}
  async execute(actor: BorderActor, action: BorderAction, body: unknown, key?: string, id?: string) {
    Id.parse(actor.operatorId); Id.parse(actor.carrierId);
    const input: BorderInput = { id: id ? Id.parse(id) : null, expectedVersion: null, key: null, value: null };
    if ((action === 'create' || action === 'list') && id || !['create', 'list'].includes(action) && !id) {
      throw new V2DraftError('VALIDATION_ERROR', 'Crossing identifier does not match the action.', 400);
    }
    if (['create', 'review', 'passage'].includes(action)) {
      const revision = Revision.parse(body);
      if ((action === 'create') !== (revision.expectedVersion === 0)) {
        throw new V2DraftError('VALIDATION_ERROR', 'Crossing version does not match the action.', 400);
      }
      input.expectedVersion = revision.expectedVersion; input.key = Id.parse(key);
      input.value = (action === 'create' ? BorderContextV2Schema
        : action === 'review' ? BorderReviewCommandV2Schema : BorderPassageCommandV2Schema).parse(revision.value);
    }
    const raw = z.object({ data: z.unknown(), replay: z.boolean().optional(), catalogCheck: CatalogCheck.optional() }).strict()
      .parse(await this.repository.run(actor, action, input));
    const record = (v: unknown) => {
      const r = BorderRecordV2Schema.parse(v);
      if (r.carrierId !== actor.carrierId || input.id && r.id !== input.id) {
        throw new V2DraftError('FORBIDDEN_BORDER_SCOPE', 'Crossing scope mismatch.', 403);
      }
      return r;
    };
    let data: unknown; let partial = false;
    if (action === 'list') {
      const rows = z.array(z.unknown()).max(101).parse(raw.data);
      partial = rows.length > 100; data = rows.slice(0, 100).map(record);
    } else if (action === 'history') {
      const rows = z.array(BorderEventV2Schema).max(1001).parse(raw.data);
      if (rows.some(r => r.carrierId !== actor.carrierId || r.crossingId !== input.id)) {
        throw new V2DraftError('FORBIDDEN_BORDER_SCOPE', 'Crossing history scope mismatch.', 403);
      }
      partial = rows.length > 1000; data = rows.slice(0, 1000);
    } else if (action === 'assessment') {
      const r = record(raw.data), assessment = assessBorderDocuments(r, this.clock());
      if (!raw.catalogCheck) throw new Error('BORDER_CATALOG_CHECK_MISSING');
      data = { ...assessment, catalogCheck: raw.catalogCheck,
        simulatedJourneyReady: assessment.simulatedJourneyReady && raw.catalogCheck.status === 'eligible' };
    } else data = record(raw.data);
    return { schemaVersion: '2.0' as const, data, meta: { idempotentReplay: raw.replay ?? false, partial } };
  }
}

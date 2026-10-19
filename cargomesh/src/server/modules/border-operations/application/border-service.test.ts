import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { BorderOperationsService } from './border-service';
import { BorderRecordV2Schema } from '@/shared/schemas/v2/border-operations';

const id = 'a5500000-0000-4000-8000-000000000001';
const other = 'a5500000-0000-4000-8000-000000000002';
const actor = { operatorId: id, carrierId: id };
const now = '2026-10-18T12:00:00Z';
const context = { schemaVersion: '2.0', serviceId: id, laneId: id, executionId: null,
  operationReference: 'SIMULATED operation', routeFingerprint: 'a'.repeat(64),
  fromCountry: 'GT', toCountry: 'SV', checkpointReference: 'SIMULATED checkpoint',
  window: { startsAt: '2026-10-18T11:00:00Z', endsAt: '2026-10-19T12:00:00Z' },
  requiredDocuments: ['MANIFEST'], provenance: 'SIMULATED' };
const row = BorderRecordV2Schema.parse({ id, carrierId: id, version: 1, laneVersion: 1,
  catalogFingerprint: 'b'.repeat(64), context, reviewStatus: 'PENDING', documents: [], reviewNote: null,
  passageStatus: 'NOT_STARTED', lastEventAt: null, releaseReference: null, updatedAt: now });

describe('Border application boundary', () => {
  it('validates creation before any repository call', async () => {
    let calls = 0; const service = new BorderOperationsService({ run: async () => { calls++; return { data: row }; } });
    await assert.rejects(service.execute(actor, 'create', { expectedVersion: 0, value: context }, 'bad'));
    await assert.rejects(service.execute(actor, 'create', { expectedVersion: 1, value: context }, id));
    await assert.rejects(service.execute(actor, 'create', { expectedVersion: 0, value: context }, id, id));
    await assert.rejects(service.execute(actor, 'read', null));
    assert.equal(calls, 0);
  });
  it('preserves actor, idempotency and replay', async () => {
    const service = new BorderOperationsService({ run: async (a, action, input) => {
      assert.deepEqual(a, actor); assert.equal(action, 'create'); assert.equal(input.expectedVersion, 0);
      assert.equal(input.key, id); assert.deepEqual(input.value, context); return { data: row, replay: true };
    } });
    assert.equal((await service.execute(actor, 'create', { expectedVersion: 0, value: context }, id)).meta.idempotentReplay, true);
  });
  it('rejects another Carrier or crossing in the response', async () => {
    for (const data of [{ ...row, carrierId: other }, { ...row, id: other }]) {
      await assert.rejects(new BorderOperationsService({ run: async () => ({ data }) }).execute(actor, 'read', null, undefined, id),
        { code: 'FORBIDDEN_BORDER_SCOPE' });
    }
  });
  it('rejects a catalog result missing from assessment', async () => {
    await assert.rejects(new BorderOperationsService({ run: async () => ({ data: row }) })
      .execute(actor, 'assessment', null, undefined, id), /BORDER_CATALOG_CHECK_MISSING/);
  });
  it('prevents stale catalog evidence from enabling simulated travel', async () => {
    const data = { ...row, reviewStatus: 'APPROVED', documents: [{ code: 'MANIFEST', reference: 'SIMULATED',
      checkedAt: '2026-10-17T12:00:00Z', validUntil: '2026-10-20T12:00:00Z' }] };
    const service = new BorderOperationsService({ run: async () => ({ data,
      catalogCheck: { status: 'unknown', reasons: ['BORDER_CATALOG_CHANGED'] } }) }, () => now);
    const result = await service.execute(actor, 'assessment', null, undefined, id);
    assert.equal((result.data as { simulatedJourneyReady: boolean }).simulatedJourneyReady, false);
  });
  it('bounds list reads and marks partial results', async () => {
    const result = await new BorderOperationsService({ run: async () => ({ data: Array.from({ length: 101 }, () => row) }) })
      .execute(actor, 'list', null);
    assert.equal((result.data as unknown[]).length, 100); assert.equal(result.meta.partial, true);
  });
  it('validates history scope and actor output', async () => {
    await assert.rejects(new BorderOperationsService({ run: async () => ({ data: [{ id: '1', crossingId: other,
      carrierId: id, operatorId: id, version: 1, action: 'create', value: context, recordedAt: now }] }) })
      .execute(actor, 'history', null, undefined, id), { code: 'FORBIDDEN_BORDER_SCOPE' });
  });
  it('requires a revision for review and cannot rewrite the immutable context', async () => {
    const service = new BorderOperationsService({ run: async () => { throw new Error('must not persist'); } });
    await assert.rejects(service.execute(actor, 'review', { expectedVersion: 0, value: { status: 'IN_REVIEW', documents: [], note: 'test' } }, id, id), { code: 'VALIDATION_ERROR' });
    await assert.rejects(service.execute(actor, 'review', { expectedVersion: 1, value: { status: 'IN_REVIEW', documents: [], note: 'test', context } }, id, id));
  });
});

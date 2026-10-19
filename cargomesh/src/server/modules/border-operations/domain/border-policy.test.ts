import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { BorderContextV2Schema, BorderRecordV2Schema, BorderReviewCommandV2Schema } from '@/shared/schemas/v2/border-operations';
import { assessBorderDocuments } from './border-policy';

const id = 'a5500000-0000-4000-8000-000000000001';
const now = '2026-10-18T12:00:00Z';
export const context = { schemaVersion: '2.0', serviceId: id, laneId: id, executionId: null,
  operationReference: 'SIMULATED operation', routeFingerprint: 'a'.repeat(64),
  fromCountry: 'GT', toCountry: 'SV', checkpointReference: 'SIMULATED checkpoint',
  window: { startsAt: '2026-10-18T11:00:00Z', endsAt: '2026-10-19T12:00:00Z' },
  requiredDocuments: ['MANIFEST', 'CARRIER_PERMIT'], provenance: 'SIMULATED' };
export const documents = ['MANIFEST', 'CARRIER_PERMIT'].map(code => ({ code, reference: `SIMULATED ${code}`,
  checkedAt: '2026-10-17T12:00:00Z', validUntil: '2026-10-20T12:00:00Z' }));
export const row = BorderRecordV2Schema.parse({ id, carrierId: id, version: 3, laneVersion: 1,
  catalogFingerprint: 'b'.repeat(64), context, reviewStatus: 'APPROVED', documents,
  reviewNote: 'SIMULATED internal document review', passageStatus: 'NOT_STARTED', lastEventAt: null,
  releaseReference: null, updatedAt: now });

describe('Border document policy and contract', () => {
  it('requires a directed international pair and a bounded, unique checklist', () => {
    assert.equal(BorderContextV2Schema.safeParse({ ...context, toCountry: 'GT' }).success, false);
    assert.equal(BorderContextV2Schema.safeParse({ ...context, requiredDocuments: [] }).success, false);
    assert.equal(BorderContextV2Schema.safeParse({ ...context, requiredDocuments: ['A', 'A'] }).success, false);
    assert.equal(BorderContextV2Schema.safeParse({ ...context, requiredDocuments: Array.from({ length: 31 }, (_, n) => `D${n}`) }).success, false);
  });
  it('does not accept client-invented verification or duplicate evidence', () => {
    assert.equal(BorderReviewCommandV2Schema.safeParse({ status: 'APPROVED', note: 'test', documents,
      governmentVerified: true }).success, false);
    assert.equal(BorderReviewCommandV2Schema.safeParse({ status: 'APPROVED', note: 'test', documents: [documents[0], documents[0]] }).success, false);
    assert.equal(BorderContextV2Schema.safeParse({ ...context, provenance: 'VERIFIED' }).success, false);
  });
  it('allows simulation readiness without granting a travel authorization', () => {
    const result = assessBorderDocuments(row, now);
    assert.equal(result.documentStatus, 'eligible'); assert.equal(result.simulatedJourneyReady, true);
    assert.equal(result.travelAuthorization, 'UNKNOWN');
    assert.equal(result.authorizationReason, 'SIMULATED_EVIDENCE_NOT_AUTHORIZATION');
  });
  it('retains authority uncertainty for a Carrier report, including a reported crossing', () => {
    const result = assessBorderDocuments({ ...row, context: { ...row.context, provenance: 'CARRIER_REPORTED' },
      passageStatus: 'CROSSED', lastEventAt: now, releaseReference: 'Operator reported release' }, now);
    assert.equal(result.documentStatus, 'eligible'); assert.equal(result.simulatedJourneyReady, false);
    assert.equal(result.travelAuthorization, 'UNKNOWN');
  });
  it('does not promote complete documents before internal approval', () => {
    assert.equal(assessBorderDocuments({ ...row, reviewStatus: 'IN_REVIEW' }, now).documentStatus, 'unknown');
  });
  it('reports each missing requirement', () => {
    assert.deepEqual(assessBorderDocuments({ ...row, documents: [] }, now).reasons,
      ['BORDER_DOCUMENT_MISSING:MANIFEST', 'BORDER_DOCUMENT_MISSING:CARRIER_PERMIT']);
  });
  it('requires validity throughout the declared window', () => {
    const r = { ...row, documents: [{ ...documents[0], validUntil: '2026-10-18T13:00:00Z' }, documents[1]] };
    assert.equal(assessBorderDocuments(r, now).documentStatus, 'unknown');
  });
  it('rejects evidence checked after the activity started', () => {
    const r = { ...row, documents: [{ ...documents[0], checkedAt: now }, documents[1]] };
    assert.equal(assessBorderDocuments(r, now).documentStatus, 'unknown');
  });
  it('expires evidence at its exact deadline', () => {
    assert.equal(assessBorderDocuments(row, documents[0].validUntil).documentStatus, 'unknown');
  });
  it('keeps held and rejected operations blocked', () => {
    assert.equal(assessBorderDocuments({ ...row, reviewStatus: 'REJECTED' }, now).documentStatus, 'ineligible');
    assert.equal(assessBorderDocuments({ ...row, passageStatus: 'HELD' }, now).simulatedJourneyReady, false);
  });
  it('uses an explicit clock and rejects invalid input', () => {
    assert.throws(() => assessBorderDocuments(row, 'bad'), /INVALID_BORDER_CLOCK/);
  });
});

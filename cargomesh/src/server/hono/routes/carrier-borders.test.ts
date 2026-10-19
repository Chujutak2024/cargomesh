import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Hono } from 'hono';
import { createCarrierBordersRouter } from './carrier-borders';
import { BorderOperationsService } from '@/server/modules/border-operations/application/border-service';
import { V2DraftError } from '@/server/modules/freight-requests/application/draft-service';

const id = 'a5500000-0000-4000-8000-000000000001';
const context = { schemaVersion: '2.0', serviceId: id, laneId: id, executionId: null,
  operationReference: 'SIMULATED HTTP test', routeFingerprint: 'a'.repeat(64), fromCountry: 'GT', toCountry: 'SV',
  checkpointReference: 'SIMULATED checkpoint', requiredDocuments: ['MANIFEST'], provenance: 'SIMULATED',
  window: { startsAt: '2026-10-18T11:00:00Z', endsAt: '2026-10-19T12:00:00Z' } };
const row = { id, carrierId: id, version: 1, laneVersion: 1, catalogFingerprint: 'b'.repeat(64), context,
  reviewStatus: 'PENDING', documents: [], reviewNote: null, passageStatus: 'NOT_STARTED', lastEventAt: null,
  releaseReference: null, updatedAt: '2026-10-18T12:00:00Z' };
const base = `/api/v2/carrier-portal/carriers/${id}/border-crossings`;

// Transport/validation tests inject identity and persistence. Real tenant enforcement is tested in pgTAP.
function setup(replay = false, failure?: V2DraftError) {
  let calls = 0;
  const service = new BorderOperationsService({ run: async (_a, action) => {
    calls++; if (failure) throw failure;
    return { data: action === 'list' ? [row] : action === 'history' ? [] : row, replay };
  } });
  const app = new Hono().basePath('/api/v2');
  app.route('/', createCarrierBordersRouter({ authenticate: async () => ({ operatorId: id, carrierId: id }), service: async () => service }));
  const request = (suffix = '', method = 'GET', body?: unknown, headers: Record<string, string> = { Authorization: 'Bearer transport-test' }) =>
    app.request(`http://localhost:8080${base}${suffix}`, { method, headers: { 'Content-Type': 'application/json', ...headers },
      body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body) });
  return { request, calls: () => calls };
}

describe('Carrier border HTTP transport', () => {
  it('requires authentication before repository access', async () => {
    const s = setup(); assert.equal((await s.request('', 'GET', undefined, {})).status, 401); assert.equal(s.calls(), 0);
  });
  it('rejects malformed authorization', async () => {
    const s = setup(); assert.equal((await s.request('', 'GET', undefined, { Authorization: 'broken' })).status, 401);
  });
  it('rejects cross-origin cookie mutations', async () => {
    const s = setup(); assert.equal((await s.request('', 'POST', {}, { Cookie: 'session=test', Origin: 'https://other.invalid' })).status, 403);
    assert.equal(s.calls(), 0);
  });
  it('marks private responses as non-cacheable', async () => {
    const r = await setup().request(); assert.equal(r.status, 200);
    assert.equal(r.headers.get('Cache-Control'), 'no-store, private');
    assert.match(r.headers.get('Vary')!, /Authorization/);
  });
  it('creates and replays with distinct HTTP status codes', async () => {
    const headers = { Authorization: 'Bearer transport-test', 'Idempotency-Key': id };
    assert.equal((await setup().request('', 'POST', { expectedVersion: 0, value: context }, headers)).status, 201);
    assert.equal((await setup(true).request('', 'POST', { expectedVersion: 0, value: context }, headers)).status, 200);
  });
  it('rejects invalid JSON, missing idempotency and unknown claims', async () => {
    const s = setup();
    assert.equal((await s.request('', 'POST', '{')).status, 400);
    assert.equal((await s.request('', 'POST', { expectedVersion: 0, value: context })).status, 400);
    assert.equal((await s.request('', 'POST', { expectedVersion: 0, value: { ...context, customsCleared: true } },
      { Authorization: 'Bearer transport-test', 'Idempotency-Key': id })).status, 400);
    assert.equal(s.calls(), 0);
  });
  it('preserves database conflict and installation error codes', async () => {
    for (const [code, status] of [['STALE_DRAFT', 409], ['BORDER_OPERATIONS_NOT_INSTALLED', 503]] as const) {
      const r = await setup(false, new V2DraftError(code, code, status)).request(`/${id}`);
      assert.equal(r.status, status); assert.match(await r.text(), new RegExp(code));
    }
  });
  it('serves the separately scoped history route', async () => {
    const r = await setup().request(`/${id}/history`); assert.equal(r.status, 200);
    assert.deepEqual((await r.json()).data, []);
  });
});

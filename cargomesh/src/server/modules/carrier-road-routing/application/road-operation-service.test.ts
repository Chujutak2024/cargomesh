import test from 'node:test';
import assert from 'node:assert/strict';
import { CatalogServiceV2, type CatalogRepositoryV2 } from '../../catalog/application/catalog-service';
import { CarrierOperationalAssessmentService } from '../../fleet/application/operational-assessment-service';
import { CarrierRoadAssessmentV2Schema } from '@/shared/schemas/v2/carrier-road-routing';
import { RoadOperationInputV2Schema, type RoadOperationInputV2 } from '@/shared/schemas/v2/road-operation';
import { RoadOperationService } from './road-operation-service';
import type { RoadActor } from './carrier-road-service';
import { buildOperationTimeline, evaluateOperationCargo } from '../domain/operation-policy';
import { FleetOutputsV2 } from '@/shared/schemas/v2/fleet';
import { CatalogInputsV2 } from '@/shared/schemas/v2/catalog';
import { createCarrierRoadOperationRouter } from '@/server/hono/routes/carrier-road-operation';
import { Hono } from 'hono';

const id = (n: number) => `e7000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const now = '2026-10-17T12:00:00Z', serviceId = id(2), assetId = id(3), driverId = id(4), categoryId = id(5);
const actor: RoadActor = { kind: 'carrier', carrierId: id(1), operatorId: id(8), organizationId: null };
const date = (hour: number) => `2026-10-18T${String(hour).padStart(2, '0')}:00:00Z`;
const window = (a: number, b: number) => ({ startsAt: date(a), endsAt: date(b) });
const evidence = { reference: 'SIMULATED test', verifiedAt: now, validUntil: '2026-10-30T00:00:00Z', provenanceStatus: 'SIMULATED' };
function input(): RoadOperationInputV2 {
  return { schemaVersion: '2.0', assetId, driverId, road: { schemaVersion: '2.0', serviceId,
    originReferenceId: 'chiclayo', destinationReferenceId: 'lima', pickupWindow: window(8, 10), deliveryWindow: window(12, 15),
    objective: 'FASTEST', traffic: 'TRAFFIC_UNAWARE' },
  cargo: { categoryId, weightKg: 2000, volumeM3: 5, largestPieceCm: { length: 50, width: 50, height: 50 },
    requiredEquipment: 'BOX_TRUCK', temperatureRange: null, certifications: [], hazardous: false, fragile: false, oversized: false },
  planning: { reference: 'SIMULATED test assumptions', provenanceStatus: 'SIMULATED', loadingSeconds: 1800,
    unloadingSeconds: 1800, restSeconds: 1800, borderSeconds: 0, repositionBeforeSeconds: 3600, repositionAfterSeconds: 1800 }, depots: [] };
}
function fixture() {
  const base = { schemaVersion: '2.0', serviceId };
  const asset = { ...base, code: 'NEW_BRAND_VARIANT', mode: 'ROAD', equipmentType: 'BOX_TRUCK', role: 'LOAD_BEARING',
    usefulCapacityKg: 10000, usableVolumeM3: 30, operatingStatus: 'AVAILABLE', homeDepotId: id(99), provenance: 'OWN', partnerId: null,
    evidence: 'SIMULATED vehicle document', roadVehicle: { plate: 'SYN-001', registrationCode: null, registeredAt: null,
      brand: 'Unseen brand', model: 'New model', variant: 'New variant', bodyType: 'Custom unknown visual',
      usableDimensions: { length: 1000, width: 250, height: 250 }, grossWeightLimitKg: 18000, odometerKm: null, conditionReason: null, axleConfig: null } };
  const driver = { ...base, fullName: 'SIMULATED driver', portalAccountId: null, licenseClass: 'RECORDED_CLASS',
    licenseValidUntil: '2026-12-31', licenseTimezone: 'America/Lima', qualifications: [], experienceYears: null,
    dutyStatus: 'AVAILABLE', evidence, availableWindows: [window(0, 23)], dutyWindow: window(0, 23), maximumDutySeconds: 16 * 3600, usedDutySeconds: 0 };
  const service = { schemaVersion: '2.0', mode: 'ROAD', serviceClass: 'FTL', maxWeightKg: 10000, maxVolumeM3: 30,
    responseChannels: ['MANUAL'], status: 'ACTIVE', admittedCargoTypes: [categoryId], temperatureRange: null,
    requiredCertifications: [], supportsHazardous: false, supportsFragile: false, supportsOversized: false };
  const def = { ...base, categoryId, requirements: [], maxWeightKg: 10000, temperatureRange: null, certifications: [],
    evidence: evidence.reference, verifiedAt: evidence.verifiedAt, validUntil: evidence.validUntil, active: true };
  const cap = { ...base, assetId, definitionId: id(6), categoryId, temperatureRange: null, certifications: [],
    evidence: evidence.reference, verifiedAt: evidence.verifiedAt, validUntil: evidence.validUntil, active: true };
  const wrap = (n: number, value: unknown) => ({ id: id(n), carrierId: actor.carrierId, organizationId: null,
    serviceId: n === 2 ? null : serviceId, version: 1, createdAt: now, updatedAt: now, value });
  const rows: Record<string, ReturnType<typeof wrap>[]> = { services: [wrap(2, service)], assets: [wrap(3, asset)],
    drivers: [wrap(4, driver)], 'capability-definitions': [wrap(6, def)], 'asset-capabilities': [wrap(7, cap)] };
  return { rows, asset, driver, service, def, cap };
}
function roadData(q = input().road, durations = [7200, 18000]) {
  return CarrierRoadAssessmentV2Schema.parse({ schemaVersion: '2.0', carrierId: actor.carrierId, serviceId,
    checkedAt: now, scope: 'COVERAGE_AND_ROAD_ESTIMATE_ONLY', evidenceScope: 'PUBLISHED_CARRIER_CATALOG',
    origin: { id: q.originReferenceId, city: 'Chiclayo', countryCode: 'PE', lat: -6.77, lng: -79.84 },
    destination: { id: q.destinationReferenceId, city: 'Lima', countryCode: 'PE', lat: -12.04, lng: -77.03 },
    pickupWindow: q.pickupWindow, deliveryWindow: q.deliveryWindow, catalogFingerprint: 'a'.repeat(64),
    coverage: { status: 'eligible', reasons: [], pickup: { status: 'eligible', reasons: [], recordIds: [] },
      delivery: { status: 'eligible', reasons: [], recordIds: [] }, lane: { status: 'eligible', reasons: [], recordIds: [] },
      selectedLaneId: id(20), borderReviewRequired: false, references: [], policyVersion: 'carrier-city-coverage/v1', scope: 'PUBLISHED_CITY_REFERENCE_COVERAGE_ONLY' },
    routing: { status: 'estimated', source: 'GOOGLE_ROUTES_API', calculatedAt: now, policyVersion: 'returned-road-alternatives/v1',
      scope: 'RETURNED_ALTERNATIVES_ONLY', truckAccess: 'UNVERIFIED', objective: q.objective, traffic: q.traffic, selectedId: 'google-0',
      alternatives: durations.map((durationSeconds, i) => ({ id: `google-${i}`, providerIndex: i, durationSeconds,
        distanceMeters: 100000 - i * 10000, points: [{ lat: -6.77, lng: -79.84 }, { lat: -12.04, lng: -77.03 }], warnings: [] })), rejected: [] },
    notCalculatedReason: null, requestedDepartureTime: null, timeBasis: 'TRAFFIC_UNAWARE_BASELINE',
    consistency: 'NON_ATOMIC_READ_RECHECKED_AFTER_PROVIDER', fullEligibilityEvaluated: false,
    availabilityEvaluated: false, cargoCompatibilityEvaluated: false, transitCountriesEvaluated: false,
    capacityReserved: false, travelAuthorization: 'UNKNOWN', requiresCommitRevalidation: true });
}
function setup() {
  const f = fixture(); let calls = 0;
  const hooks = { resourceStatus: 'eligible' as 'eligible' | 'ineligible' | 'unknown', provenance: 'SIMULATED',
    onRoad: () => {}, onResources: () => {}, durations: [7200, 18000] };
  const windows: { startsAt: string; endsAt: string }[] = [];
  const repository: CatalogRepositoryV2 = { command: async () => { throw Error('No writes'); },
    read: async (_actor, kind, scope, page, ref) => {
      assert.equal(scope.serviceId, null, 'Native Carrier RPC requires carrier-wide fleet reads');
      return (f.rows[kind] ?? []).filter(r => !ref || r.id === ref).slice(page.offset, page.offset + page.limit);
    } };
  const catalog = new CatalogServiceV2(repository);
  const operations = new CarrierOperationalAssessmentService({ evaluateMany: async (_actor, raw) => {
    const queries = raw as { resourceId: string; serviceId: string; window: ReturnType<typeof window> }[];
    windows.push(...queries.map(q => q.window)); hooks.onResources();
    return { schemaVersion: '2.0', data: queries.map(q => ({ status: hooks.resourceStatus,
      reasons: hooks.resourceStatus === 'ineligible' ? ['RESOURCE_OCCUPIED'] : [], scope: 'RESOURCE_WINDOW_ONLY',
      provenanceStatus: hooks.provenance, resourceId: q.resourceId, serviceId: q.serviceId, resourceVersion: 1, checkedAt: now, window: q.window })) };
  } }, { execute: async () => { throw Error('No implicit depot checks'); } }, () => now);
  const service = new RoadOperationService(catalog, { assess: async (_actor, raw) => {
    calls++; hooks.onRoad(); return { schemaVersion: '2.0', data: roadData(RoadOperationInputV2Schema.parse({ ...input(), road: raw }).road, hooks.durations) };
  } }, operations, () => now);
  return { f, service, hooks, windows, calls: () => calls };
}

test('timeline counts handling, rest, waiting and both repositioning periods', () => {
  const t = buildOperationTimeline(input(), 7200);
  assert.equal(t.departureAt, '2026-10-18T08:30:00.000Z');
  assert.equal(t.arrivalAt, '2026-10-18T11:00:00.000Z');
  assert.deepEqual(t.workWindow, { startsAt: '2026-10-18T07:00:00.000Z', endsAt: '2026-10-18T13:00:00.000Z' });
  assert.equal(t.waitingSeconds, 3600); assert.equal(t.totalOccupiedSeconds, 21600);
});
test('missing durations are explicit lower bounds, never implicit confirmed zero', () => {
  const q = input(); q.planning.restSeconds = null;
  const t = buildOperationTimeline(q, 7200);
  assert.equal(t.basis, 'LOWER_BOUND_WITH_MISSING_DURATIONS'); assert.equal(t.decision.status, 'unknown');
});
test('loading overflow and delivery overflow are hard failures', () => {
  const q = input(); q.planning.loadingSeconds = 3 * 3600;
  assert.ok(buildOperationTimeline(q, 7200).decision.reasons.includes('LOADING_EXCEEDS_PICKUP_WINDOW'));
  assert.ok(buildOperationTimeline(input(), 7 * 3600).decision.reasons.includes('DELIVERY_WINDOW_MISSED'));
});
test('new brand/body variant uses persisted operational attributes independently of its visual', async () => {
  const s = setup(), result = (await s.service.assess(actor, input())).data;
  assert.equal(result.compatibility.status, 'eligible'); assert.equal(s.calls(), 1);
  assert.equal(result.status, 'unknown'); assert.equal(result.physicalReadiness, 'UNKNOWN');
  assert.equal(result.legalDrivingPolicy, 'UNKNOWN'); assert.equal(result.capacityReserved, false);
  assert.equal(result.clientRequestValidated, false); assert.equal(result.selectedForReviewId, 'google-0');
  assert.equal(s.windows[0].startsAt, '2026-10-18T07:00:00.000Z');
});
test('overweight/equipment/mode/maintenance failures prevent provider charges', async () => {
  for (const change of [(s: ReturnType<typeof setup>) => { s.f.asset.usefulCapacityKg = 100; },
    (s: ReturnType<typeof setup>) => { s.f.asset.equipmentType = 'FLATBED'; },
    (s: ReturnType<typeof setup>) => { s.f.asset.operatingStatus = 'MAINTENANCE'; }]) {
    const s = setup(); change(s);
    const r = (await s.service.assess(actor, input())).data;
    assert.equal(r.status, 'ineligible'); assert.equal(r.road, null); assert.equal(s.calls(), 0);
  }
});
test('shortest objective cannot pick a route that misses the delivery window', async () => {
  const s = setup(), q = input(); q.road.objective = 'SHORTEST_RETURNED'; s.hooks.durations = [7200, 26000];
  const r = (await s.service.assess(actor, q)).data;
  assert.equal(r.alternatives[1].modeledDecision.status, 'ineligible'); assert.equal(r.selectedForReviewId, 'google-0');
});
test('joint resource conflict rejects all otherwise fitting road alternatives', async () => {
  const s = setup(); s.hooks.resourceStatus = 'ineligible';
  const r = (await s.service.assess(actor, input())).data;
  assert.equal(r.status, 'ineligible'); assert.equal(r.selectedForReviewId, null);
  assert.ok(r.alternatives[0].modeledDecision.reasons.includes('RESOURCE_OCCUPIED'));
});
test('missing capability evidence cannot become compatible; stale evidence cannot prove cold chain', async () => {
  const s = setup(); s.f.cap.evidence = ''; // Catalog rejects malformed persisted data rather than laundering it.
  await assert.rejects(s.service.assess(actor, input()), { code: 'CATALOG_DATA_INCOMPLETE' });
  const other = setup(); other.f.cap.validUntil = '2026-10-17T13:00:00Z';
  assert.equal((await other.service.assess(actor, input())).data.compatibility.status, 'unknown');
});
test('uncertain availability provenance is not eligible modeled evidence', async () => {
  const s = setup(); s.hooks.provenance = 'UNKNOWN';
  const r = (await s.service.assess(actor, input())).data;
  assert.equal(r.alternatives[0].modeledDecision.status, 'unknown');
});
test('cross-service and foreign-carrier resources are rejected before Google', async () => {
  for (const field of ['serviceId', 'carrierId'] as const) {
    const s = setup(); s.f.rows.assets[0][field] = id(100);
    await assert.rejects(s.service.assess(actor, input()), { code: 'FORBIDDEN_CATALOG' }); assert.equal(s.calls(), 0);
  }
});
test('expected versions and edits during resource evaluation discard estimates', async () => {
  const s = setup(); await assert.rejects(s.service.assess(actor, { ...input(), expectedAssetVersion: 3 }), { code: 'STALE_OPERATION' });
  assert.equal(s.calls(), 0);
  s.hooks.onResources = () => { s.f.rows.assets[0].version++; };
  await assert.rejects(s.service.assess(actor, input()), { code: 'STALE_OPERATION' });
});
test('new semantic equipment codes and arbitrary polylines are rejected by the contract', () => {
  const q = input();
  assert.equal(RoadOperationInputV2Schema.safeParse({ ...q, cargo: { ...q.cargo, requiredEquipment: 'FLYING_TRUCK' } }).success, false);
  assert.equal(RoadOperationInputV2Schema.safeParse({ ...q, road: { ...q.road, points: [] } }).success, false);
});
test('a known incapable service cannot be rescued by changing the Three.js body label', () => {
  const f = fixture(), q = input(); q.cargo.hazardous = true;
  const r = evaluateOperationCargo(q, CatalogInputsV2.services.parse(f.service), FleetOutputsV2.assets.parse(f.asset), [], [], true, now);
  assert.equal(r.status, 'ineligible'); assert.ok(r.reasons.includes('HAZARDOUS_NOT_SUPPORTED'));
});

test('cold chain requires compatible, current service and asset evidence', () => {
  const f = fixture(), q = input(); q.cargo.temperatureRange = { minCelsius: 2, maxCelsius: 8 };
  const check = () => evaluateOperationCargo(q, CatalogInputsV2.services.parse(f.service), FleetOutputsV2.assets.parse(f.asset),
    [FleetOutputsV2['asset-capabilities'].parse(f.cap)], [{ id: id(6), value: FleetOutputsV2['capability-definitions'].parse(f.def) }], true, now);
  assert.equal(check().status, 'unknown');
  Object.assign(f.service, { temperatureRange: { minCelsius: 2, maxCelsius: 8 } });
  Object.assign(f.cap, { temperatureRange: { minCelsius: 2, maxCelsius: 8 } });
  Object.assign(f.def, { temperatureRange: { minCelsius: 2, maxCelsius: 8 } });
  assert.equal(check().status, 'eligible');
  q.cargo.temperatureRange = { minCelsius: -20, maxCelsius: -10 };
  assert.equal(check().status, 'ineligible');
});
test('piece rotation is not silently authorized, and impossible dimensions block', () => {
  const f = fixture(), q = input();
  const check = () => evaluateOperationCargo(q, CatalogInputsV2.services.parse(f.service), FleetOutputsV2.assets.parse(f.asset),
    [FleetOutputsV2['asset-capabilities'].parse(f.cap)], [{ id: id(6), value: FleetOutputsV2['capability-definitions'].parse(f.def) }], true, now);
  q.cargo.largestPieceCm = { length: 50, width: 900, height: 50 };
  assert.ok(check().reasons.includes('PIECE_ROTATION_PERMISSION_UNKNOWN'));
  q.cargo.largestPieceCm.width = 2000; assert.ok(check().reasons.includes('PIECE_DOES_NOT_FIT'));
});
test('capability pages from other services cannot authorize this asset or leak into references', async () => {
  const s = setup(), foreign = structuredClone(s.f.rows['asset-capabilities'][0]);
  foreign.id = id(88); foreign.serviceId = id(99);
  foreign.value = { ...s.f.cap, serviceId: id(99) }; s.f.rows['asset-capabilities'].push(foreign);
  const result = (await s.service.assess(actor, input())).data;
  assert.ok(!result.references.some(r => r.id === id(88))); assert.equal(result.compatibility.status, 'eligible');
});
test('operation HTTP gate and cross-carrier scope fail before composition', async () => {
  for (const enabled of [false, true]) {
    const app = new Hono(); let calls = 0;
    app.route('/', createCarrierRoadOperationRouter({ enabled, authenticate: async () => enabled ? { ...actor, carrierId: id(90) } : actor,
      service: async () => { calls++; throw Error('Must not compose'); } }));
    const r = await app.request(`http://localhost/carrier-portal/carriers/${actor.carrierId}/road-operation-assessments`,
      { method: 'POST', headers: { Authorization: 'Bearer controlled-test', 'Content-Type': 'application/json' }, body: JSON.stringify(input()) });
    assert.equal(r.status, enabled ? 403 : 503); assert.equal(calls, 0);
  }
});

test('HTTP endpoint requires identity, bounds bodies and shares private response policy', async () => {
  const s = setup(), app = new Hono();
  app.route('/', createCarrierRoadOperationRouter({ enabled: true, authenticate: async () => actor, service: async () => s.service }));
  const url = `http://localhost/carrier-portal/carriers/${actor.carrierId}/road-operation-assessments`;
  const request = (body: string, token = true, origin?: string) => app.request(url, { method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer controlled-test' } : {}), ...(origin ? { Origin: origin } : {}) }, body });
  assert.equal((await request(JSON.stringify(input()), false)).status, 401);
  assert.equal((await request(' '.repeat(17000))).status, 413);
  assert.equal((await request('{')).status, 400);
  assert.equal((await request(JSON.stringify({ ...input(), visualType: 'reefer' }))).status, 400);
  const response = await request(JSON.stringify(input()));
  assert.equal(response.status, 200); assert.match(response.headers.get('Cache-Control')!, /no-store/);
  assert.equal((await response.json()).data.status, 'unknown');
});

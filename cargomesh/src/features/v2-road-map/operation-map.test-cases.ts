/** Synthetic native-runner test cases and fixtures; no database reads. */
import assert from "node:assert/strict";
import { WorkflowRecordV2Schema } from "@/shared/schemas/v2/workflow";
import { commercialFixture, id, org, at } from "@/features/shipper-portal/commercial-context.test-fixtures";
import { booking, execution, ev } from "@/features/carrier-portal/commercial-test-fixtures";
import { collectTrackingDetail, TrackingScopeError, type TrackingSource } from "@/features/shipper-portal/tracking-data";
import { routeRecordToPresentation } from "@/features/shipper-portal/tracking-model";
import { buildTrackingJourney } from "@/features/shipper-portal/tracking-journey";
import type { WorkflowRecordV2 } from "@/features/shipper-portal/shipper-model";
import { operationRouteFacts } from "./operation-route-model";
import { operationMapPoints, schematicMapModel, mapFailureCategory } from "./schematic-map-model";

type Row<K extends WorkflowRecordV2["kind"]> = Extract<WorkflowRecordV2, { kind: K }>;
function record<K extends WorkflowRecordV2["kind"]>(raw: unknown, kind: K): Row<K> {
  const row = WorkflowRecordV2Schema.parse(raw);
  assert.equal(row.kind, kind);
  return row as Row<K>;
}

export function operationFixture() {
  const context = commercialFixture(), b = booking(), ex = execution();
  b.data.carrierConfirmationStatus = "CONFIRMED";
  const origin = { label: "Facility C01_SIM_A", city: "C01_SIM_A", region: null, countryCode: "PE", lat: -12, lng: -77 };
  const destination = { ...origin, label: "Facility C01_SIM_B", city: "C01_SIM_B", lat: -12.5 };
  context.request.origin = { ...origin, facilityId: null };
  context.request.destination = { ...destination, facilityId: null };
  const metadata = { organizationId: org, carrierId: null, requestId: ex.requestId, version: 1, createdAt: at, updatedAt: at };
  const evidence = { ...ev, reference: "C01-shaped synthetic unit fixture", validUntil: "2026-11-04T00:00:00Z", provenanceStatus: "SIMULATED" as const };
  const corridor = record({ ...metadata, id: id(61), kind: "corridors", status: "ACTIVE", data: {
    schemaVersion: "2.0", active: true, originNodeId: id(62), destinationNodeId: id(63), mode: "ROAD", estimatedDistanceKm: 100,
    estimatedDurationSeconds: 3600, restrictions: [], source: evidence, version: "C01-shaped-v1", validUntil: evidence.validUntil,
    grossWeightLimitKg: null, payloadLimitKg: null, usableDimensions: null, limitsEvidence: null, waypoints: [],
    operatingProfile: { version: "ROAD_COST_INPUT_V1", drivingSeconds: 3600, tollAmount: 987654, stops: [], source: evidence },
  } }, "corridors");
  const route = record({ ...metadata, id: context.plans[0].data.routeId, kind: "routes", status: "SIMULATED", data: {
    origin, destination, corridorIds: [corridor.id], policyId: id(90), policyVersion: 1, estimatedDistanceKm: 100, estimatedDurationSeconds: 3600,
    geographicSource: { kind: "PUBLISHED_CORRIDORS", references: [corridor.id] },
    planner: { algorithmVersion: "PUBLISHED_ITINERARY_VALIDATOR_V1", graphVersion: "a".repeat(64), source: { kind: "PUBLISHED_CORRIDORS", scope: "SELECTED_ITINERARY_SNAPSHOT", references: [corridor.id] } },
    confidence: "SIMULATED", estimatedTolls: null, borderCostEstimate: null, reasons: [],
    legs: [{ id: id(64), corridorId: corridor.id, sequence: 1, mode: "ROAD", origin, destination, borderRequirements: [],
      estimatedDistanceKm: 100, estimatedDurationSeconds: 3600, source: evidence, corridorVersion: 1, originNodeVersion: 1, destinationNodeVersion: 1,
      waypoints: [{ sequence: 1, kind: "REST", location: { ...origin, lat: -12.2, lng: -76.8, label: "C01_SIM_REST" }, source: evidence, verifiedAt: null }], conditions: [] }],
  } }, "routes");
  const decision = record({ ...metadata, id: b.data.decisionId, kind: "decisions", status: "SELECTED", data: {
    planId: context.plans[0].id, selectedPlanId: context.plans[0].id, selectedOfferIds: [context.offers[0].id], consideredOfferIds: [context.offers[0].id],
    rationale: "Explicit operation fixture", policyId: null, policyVersion: null, evidence: [], selectedAt: at, selectedBy: id(99), status: "SELECTED",
  } }, "decisions");
  ex.data.plannedWindow = { startsAt: "2026-11-02T08:00:00-05:00", endsAt: "2026-11-02T14:30:00-05:00" };
  context.offers[0].data.transitDurationSeconds = 7200;
  context.offers[0].data.offerVersion = 2;
  context.offers[0].data.estimatedDeliveryAt = "2026-11-02T19:00:00Z";
  context.offers[0].data.source.evidence = evidence;
  const records: WorkflowRecordV2[] = [ex, b, decision, ...context.plans, ...context.offers, route, corridor];
  const calls: string[] = [];
  const source: TrackingSource = {
    record: async (kind, recordId) => { calls.push(`${kind}:${recordId}`); return records.find(row => row.kind === kind && row.id === recordId); },
    request: async () => context.request,
    children: async () => ({ data: [], offset: 0, batchSize: 500, nextOffset: null, complete: true, error: null }),
  };
  return { context, b, ex, decision, route, corridor, records, source, calls };
}

export const operationMapCases: Array<[string, () => void | Promise<void>]> = [
  ["C01-shaped full legs retain SIMULATED provenance and fit all operation points", () => {
    const f = operationFixture(), view = routeRecordToPresentation(f.route), schematic = schematicMapModel(view)!;
    assert.equal(view.paths.length, 1);
    assert.equal(view.paths[0].length, 3);
    assert.equal(schematic.paths[0].provenance, "SIMULATED");
    assert.equal(schematic.connection, null);
    assert.equal(operationMapPoints(view).length, 5);
    assert.match(schematic.paths[0].points, /730,/); // Interior waypoint outside endpoint longitude range.
    assert.deepEqual(view.markers.map(marker => marker.point), [{ lat: -12, lng: -77 }, { lat: -12.5, lng: -77 }]);
    f.route.data.legs = [];
    const endpoints = routeRecordToPresentation(f.route), model = schematicMapModel(endpoints)!;
    assert.equal(endpoints.markers.length, 2);
    assert.deepEqual(endpoints.paths, []);
    assert.equal(model.paths.length, 0);
    assert.ok(model.connection);
  }],
  ["route endpoint mismatch and missing route fail closed with a positive route control", () => {
    const f = operationFixture();
    assert.equal(routeRecordToPresentation(f.route).paths.length, 1);
    f.route.data.legs[0].origin.lat = -15;
    assert.deepEqual(routeRecordToPresentation(f.route).markers, []);
    assert.deepEqual(routeRecordToPresentation(f.route).paths, []);
    assert.equal(schematicMapModel(routeRecordToPresentation(null)), null);
  }],
  ["independent legs preserve their own provenance and are never bridged", () => {
    const f = operationFixture(), first = f.route.data.legs[0];
    f.route.data.legs = [{ ...first, destination: { ...first.destination, lat: -12.1 }, waypoints: [] },
      { ...first, id: id(65), sequence: 2, origin: { ...first.origin, lat: -12.4 }, waypoints: [], source: { ...first.source, provenanceStatus: "ESTIMATED" } }];
    const view = routeRecordToPresentation(f.route), model = schematicMapModel(view)!;
    assert.equal(model.paths.length, 2);
    assert.deepEqual(model.paths.map(path => path.provenance), ["SIMULATED", "ESTIMATED"]);
    assert.notDeepEqual(view.paths[0].at(-1), view.paths[1][0]);
    assert.equal(model.connection, null);
    f.route.data.legs[1].destination.lat = 99;
    assert.deepEqual(routeRecordToPresentation(f.route).paths, []);
  }],
  ["every operation chain mismatch rejects geometry after a matching positive read", async () => {
    const mutations: Array<(f: ReturnType<typeof operationFixture>) => void> = [
      f => { f.route.requestId = id(999); }, f => { f.route.organizationId = id(999); }, f => { f.route.carrierId = id(999); },
      f => { f.b.carrierId = id(999); }, f => { f.decision.data.selectedPlanId = id(999); },
      f => { f.context.plans[0].data.routeId = id(999); f.source.record = async (kind, requested) => kind === "routes" ? f.route : f.records.find(row => row.kind === kind && row.id === requested); },
      f => { f.context.offers[0].data.planCandidateId = id(999); }, f => { f.context.offers[0].data.coveredServiceIds = [id(999)]; },
    ];
    for (const mutate of mutations) {
      const f = operationFixture();
      assert.equal((await collectTrackingDetail(f.ex.id, org, f.source)).presentation.paths.length, 1);
      mutate(f);
      await assert.rejects(collectTrackingDetail(f.ex.id, org, f.source), TrackingScopeError);
    }
  }],
  ["mismatched request endpoints remove route, markers and facts while preserving events and milestones", async () => {
    for (const endpoint of ["origin", "destination"] as const) {
      const f = operationFixture();
      withReportedEvent(f);
      const positive = await collectTrackingDetail(f.ex.id, org, f.source);
      assert.equal(positive.presentation.paths.length, 1);
      assert.equal(positive.item.events.length, 1);
      f.context.request[endpoint].lat = -16;
      const detail = await collectTrackingDetail(f.ex.id, org, f.source);
      assert.deepEqual(detail.presentation.paths, []);
      assert.deepEqual(detail.presentation.markers, []);
      assert.equal(detail.presentation.operation, undefined);
      assert.equal(detail.route, null);
      assert.equal(detail.canView3D, false);
      assert.deepEqual(detail.issues, [{ resource: "route", reason: "partial" }]);
      assertOperationalEvidenceUnchanged(detail, positive);
    }
  }],
  ["unavailable or foreign corridors omit only their driving facts and preserve route, events and milestones", async () => {
    const mutations: Array<(f: ReturnType<typeof operationFixture>) => void> = [
      f => { const read = f.source.record; f.source.record = async (kind, requested) => {
        if (kind === "corridors" && requested === f.corridor.id) throw new Error("CORRIDOR_READ_FAILED");
        return read(kind, requested);
      }; },
      f => { f.corridor.organizationId = id(999); }, f => { f.corridor.carrierId = id(999); },
      f => { f.corridor.requestId = id(999); }, f => { f.corridor.id = id(999); },
      f => { const read = f.source.record; f.source.record = async (kind, requested) =>
        kind === "corridors" && requested === f.corridor.id ? {} : read(kind, requested); },
    ];
    for (const mutate of mutations) {
      const f = operationFixture(), other = structuredClone(f.corridor), leg = f.route.data.legs[0];
      other.id = id(66);
      other.data.operatingProfile!.drivingSeconds = 1800;
      f.records.push(other);
      f.route.data.corridorIds.push(other.id);
      f.route.data.legs.push({ ...structuredClone(leg), id: id(67), sequence: 2, corridorId: other.id,
        origin: { ...leg.origin, lat: -12.3 }, waypoints: [], estimatedDistanceKm: 50, estimatedDurationSeconds: 1800 });
      leg.destination = { ...leg.destination, lat: -12.2 };
      leg.estimatedDistanceKm = 50; leg.estimatedDurationSeconds = 1800;
      withReportedEvent(f);
      const positive = await collectTrackingDetail(f.ex.id, org, f.source);
      assert.equal(positive.presentation.operation!.commercial.corridors[0].drivingSeconds, 3600);
      assert.equal(positive.presentation.operation!.commercial.corridors[1].drivingSeconds, 1800);
      mutate(f);
      f.corridor.data.operatingProfile!.source.provider = "FOREIGN_CORRIDOR_CANARY";
      const detail = await collectTrackingDetail(f.ex.id, org, f.source), facts = detail.presentation.operation!;
      assert.deepEqual(detail.presentation.paths, positive.presentation.paths);
      assert.deepEqual(detail.presentation.markers, positive.presentation.markers);
      assert.equal(facts.commercial.corridors[0].drivingSeconds, null);
      assert.equal(facts.commercial.corridors[0].drivingSource, null);
      assert.equal(facts.commercial.corridors[1].drivingSeconds, 1800);
      assert.deepEqual(facts.geometry, positive.presentation.operation!.geometry);
      assert.deepEqual(facts.eta, positive.presentation.operation!.eta);
      assert.doesNotMatch(JSON.stringify(facts), /FOREIGN_CORRIDOR_CANARY/);
      assert.deepEqual(detail.issues, [{ resource: "corridors", reason: "unavailable" }]);
      assertOperationalEvidenceUnchanged(detail, positive);
    }
  }],
  ["tracking facts distinguish geometry, commercial transit, driving and quote ETA without private fields", async () => {
    const f = operationFixture(), detail = await collectTrackingDetail(f.ex.id, org, f.source), facts = detail.presentation.operation!;
    assert.ok(f.calls.includes(`corridors:${f.corridor.id}`));
    assert.equal(facts.geometry.routeId, f.route.id);
    assert.equal(facts.geometry.durationSeconds, 3600);
    assert.equal(facts.commercial.transitSeconds, 7200);
    assert.equal(facts.commercial.windowSeconds, 23400);
    assert.equal(facts.commercial.corridors[0].drivingSeconds, 3600);
    assert.equal(facts.commercial.corridors[0].distanceKm, 100);
    assert.equal(facts.eta.offerVersion, 2);
    assert.equal(facts.eta.offerId, f.context.offers[0].id);
    assert.equal(facts.eta.at, "2026-11-02T19:00:00Z");
    assert.equal(facts.geometry.evidence[0].validUntil, "2026-11-04T00:00:00Z");
    assert.doesNotMatch(JSON.stringify(facts), /987654|tollAmount|paidDriver|driverHourly|markup|margin|price|breakdown/);
    f.corridor.version = 2;
    const drift = operationRouteFacts(f.route, f.context.offers[0], f.context.plans[0], f.ex, [f.corridor]);
    assert.equal(drift.commercial.corridors[0].drivingSeconds, null);
    assert.equal(drift.commercial.corridors[0].drivingSource, null);
    assert.equal(drift.commercial.corridors[0].version, 1);
  }],
  ["provider errors become safe categories without copying provider URLs or key-like text", () => {
    assert.equal(mapFailureCategory(new Error("MAP_PROVIDER_AUTH_FAILED")), "not-authorized");
    assert.equal(mapFailureCategory("MAP_PROVIDER_TIMEOUT"), "timed-out");
    assert.equal(mapFailureCategory("MAP_PROVIDER_NOT_CONFIGURED"), "not-configured");
    assert.equal(mapFailureCategory(new Error("https://provider.invalid?key=REDACTION_TEST_CANARY")), "unavailable");
  }],
];

function withReportedEvent(f: ReturnType<typeof operationFixture>) {
  const event = record({ ...f.ex, id: id(68), kind: "execution-events", status: "REPORTED", data: {
    schemaVersion: "2.0", expectedVersion: 1, action: "executions.start", at: f.ex.data.plannedWindow.startsAt,
    actorId: id(99), evidence: f.context.offers[0].data.source.evidence, note: "Synthetic unit-test event, never persisted.",
  } }, "execution-events");
  f.source.children = async kind => ({ data: kind === "execution-events" ? [event] : [], offset: 0, batchSize: 500,
    nextOffset: null, complete: true, error: null });
}
function assertOperationalEvidenceUnchanged(detail: Awaited<ReturnType<typeof collectTrackingDetail>>, positive: Awaited<ReturnType<typeof collectTrackingDetail>>) {
  assert.deepEqual(detail.item, positive.item);
  assert.equal(detail.item.events.length, 1);
  const journey = (value: typeof detail) => buildTrackingJourney(value.item.execution, value.item.booking, value.item.events, value.item.incidents);
  assert.deepEqual(journey(detail), journey(positive));
  assert.equal(journey(detail).lastReportedStage, "departure");
}

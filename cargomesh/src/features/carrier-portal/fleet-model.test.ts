import assert from "node:assert/strict";
import { test } from "node:test";
import { exampleFleet, EXAMPLE_AS_OF, filterFleet, maintenanceDue, serviceFleet } from "./fleet-model";
import { loadFleet, readFleetResource } from "./fleet-client";
import type { PortalRecord } from "./records";
import { mergeLocalFleet } from './fleet-local-additions';
import { applyDemoCommand, createFleetDemo, decodeFleetDemo } from './fleet-demo';

const carrierId = "00000000-0000-4000-8000-000000000001", serviceId = "00000000-0000-4000-8000-000000000002";
const assetId = "00000000-0000-4000-8000-000000000003", now = Date.parse(EXAMPLE_AS_OF);
const nativeAsset = { id: assetId, carrierId, organizationId: null, serviceId, version: 1, createdAt: EXAMPLE_AS_OF, updatedAt: EXAMPLE_AS_OF,
  value: { schemaVersion: "2.0", serviceId, code: "REAL_TEST", mode: "ROAD", equipmentType: "BOX_TRUCK", role: "LOAD_BEARING",
    usefulCapacityKg: 8000, usableVolumeM3: null, operatingStatus: "IN_SERVICE", homeDepotId: null, provenance: "OWN", partnerId: null, evidence: null,
    roadVehicle: { plate: "TEST", registrationCode: null, registeredAt: null, brand: null, model: null, variant: null, bodyType: "box",
      usableDimensions: null, grossWeightLimitKg: null, odometerKm: null, conditionReason: null, axleConfig: null } } };
const emptyRecords = () => ({ assets: [nativeAsset], drivers: [] as PortalRecord[], vehicleAssignments: [] as PortalRecord[],
  driverAssignments: [] as PortalRecord[], executions: [] as PortalRecord[], depots: [] as PortalRecord[], maintenances: [] as PortalRecord[] });
const envelope = (data: unknown, nextOffset: number | null = null) => new Response(JSON.stringify({ schemaVersion: "2.0", data, meta: { nextOffset } }), { status: 200 });
const profile = { ...nativeAsset, id: carrierId, carrierId: null, serviceId: null, value: { schemaVersion: "2.0", code: "TEST_CARRIER",
  commercialName: "Test carrier", legalName: null, businessIdType: null, businessIdValue: null, registeredCountry: null,
  providerType: "CARRIER", status: "ACTIVE", operationalPhone: null } };

test("local examples are explicit, distinct, finite and never native ids", () => {
  const examples = exampleFleet();
  assert.equal(new Set(examples.map(value => value.id)).size, 18);
  assert.equal(new Set(examples.map(value => value.variant)).size, 10);
  for (const vehicle of examples) {
    assert.equal(vehicle.source, "EXAMPLE"); assert.ok(vehicle.id.startsWith("example-"));
    assert.ok(vehicle.engineDays.every(day => day.driving >= 0 && day.idle >= 0 && day.driving + day.idle <= 12));
  }
});
test('six additional local units preserve saved identities, records and twelve existing assignments', () => {
  const defaults = exampleFleet(), original = defaults.slice(0,12);
  const changed = applyDemoCommand(createFleetDemo(original), {type:'assign',tripId:'trip-CM-204',driverId:'dc'}, '2026-10-17T20:00:00Z').state;
  const registered = {...defaults[12], id:'user-created-401', model:'My edited model', capacityKg:12345, status:'MAINTENANCE' as const};
  const before = JSON.stringify(registered), inventory = mergeLocalFleet(defaults,[registered]);
  assert.equal(inventory.length,18); assert.equal(inventory.find(v=>v.code==='CM-401'),registered);
  assert.equal(JSON.stringify(registered),before);
  const restored = decodeFleetDemo(JSON.stringify(changed),inventory)!;
  assert.deepEqual(restored.trips.slice(0,12),changed.trips);
  assert.equal(restored.trips.length,18);
  assert.equal(restored.trips.find(t=>t.id==='trip-CM-401')?.vehicleId,registered.id);
  assert.equal(restored.trips.find(t=>t.id==='trip-CM-401')?.stage,'UNASSIGNED');
  assert.deepEqual(decodeFleetDemo(JSON.stringify(restored),inventory),restored);
  assert.deepEqual(mergeLocalFleet(defaults,[registered]),inventory);
});
test('a saved plate conflict suppresses only the new default and preserves the user record unchanged', () => {
  const defaults = exampleFleet(), saved = {...defaults[12], id:'my-existing-truck',code:'MY-UNIT',plate:'sim 013',model:'My own truck'};
  const inventory = mergeLocalFleet(defaults,[saved]);
  assert.equal(inventory.length,18); assert.equal(inventory.at(-1),saved);
  assert.ok(!inventory.some(vehicle=>vehicle.id==='example-CM-401'));
  assert.ok(inventory.some(vehicle=>vehicle.code==='CM-406'));
  for(const unit of defaults.slice(12)){assert.equal(unit.driver,null);assert.equal(unit.journey,null);assert.equal(unit.coordinates,null);assert.equal(unit.speedKmh,null);}
});
test("fuel, maintenance, body and search filters compose with deterministic attention ordering", () => {
  const examples = exampleFleet();
  assert.equal(filterFleet(examples, "fuel", "", "attention", now)[0].code, "CM-231");
  assert.equal(filterFleet(examples, "reefer", "Trujillo", "code", now).length, 1);
  assert.equal(filterFleet(examples, "service", "Callao", "code", now).length, 0);
  assert.equal(filterFleet(examples, "all", "", "attention", now)[0].code, "CM-311");
});
test("unknown telemetry remains null; in-service status does not establish circulation or availability", () => {
  const vehicle = serviceFleet(emptyRecords(), now)[0];
  assert.equal(vehicle.status, "IN_SERVICE"); assert.equal(vehicle.speedKmh, null); assert.equal(vehicle.odometerKm, null);
  assert.equal(vehicle.fuelPercent, null); assert.equal(vehicle.conditionScore, null); assert.equal(vehicle.costPerKm, null);
  assert.equal(vehicle.driver, null); assert.equal(vehicle.coordinates, null); assert.deepEqual(vehicle.engineDays, []);
  assert.equal(filterFleet([vehicle], "fuel", "", "fuel", now).length, 0);
  assert.equal(vehicle.createdAt, EXAMPLE_AS_OF); assert.equal(vehicle.registeredAt, null);
  for (const key of ["description", "statusChangedAt", "tankLiters", "consumptionLitersPer100Km", "workingZones", "journey", "maintenanceHistory"] as const) assert.equal(vehicle[key], null);
});

test("native registration and condition reason come from the canonical road vehicle", () => {
  const records: Parameters<typeof serviceFleet>[0] = emptyRecords();
  records.assets[0] = { ...nativeAsset, value: { ...nativeAsset.value, roadVehicle: { ...nativeAsset.value.roadVehicle,
    registeredAt: "2024-05-15", conditionReason: "Registered condition note" } } };
  const vehicle = serviceFleet(records, now)[0];
  assert.equal(vehicle.registeredAt, "2024-05-15"); assert.equal(vehicle.statusReason, "Registered condition note");
  assert.equal(vehicle.statusChangedAt, null);
});
test("unknown fuel sorts after an observed zero without treating null as zero", () => {
  const known = { ...exampleFleet()[0], fuelPercent: 0 }, unknown = serviceFleet(emptyRecords(), now)[0];
  assert.equal(filterFleet([unknown, known], "all", "", "fuel", now)[0].id, known.id);
});
test("completed, cancelled and past maintenance windows do not become future due service", () => {
  const vehicle = exampleFleet()[0]; assert.equal(maintenanceDue(vehicle, now), true);
  for (const status of ["COMPLETED", "CANCELLED"]) assert.equal(maintenanceDue({ ...vehicle, maintenance: { ...vehicle.maintenance!, status } }, now), false);
  assert.equal(maintenanceDue(vehicle, now + 86400000), false);
});
test("only a unique confirmed current assignment links a running operation and its driver", () => {
  const records = emptyRecords(), window = { startsAt: "2026-10-08T00:00:00Z", endsAt: "2026-10-09T00:00:00Z" };
  records.vehicleAssignments.push({ ...nativeAsset, id: "va", value: { assetId, serviceId, executionId: "ex", status: "CONFIRMED", window } });
  records.executions.push({ ...nativeAsset, id: "ex", status: "IN_PROGRESS", value: { serviceId, lastKnownPosition: { city: "Null Island", countryCode: "GH", lat: 0, lng: 0 } } });
  records.driverAssignments.push({ ...nativeAsset, id: "da", value: { driverId: "dr", executionId: "ex", serviceId, role: "PRIMARY", status: "CONFIRMED", window } });
  records.drivers.push({ ...nativeAsset, id: "dr", value: { serviceId, fullName: "Test Driver" } });
  const linked = serviceFleet(records, now)[0]; assert.equal(linked.driver, "Test Driver"); assert.deepEqual(linked.coordinates, { lat: 0, lng: 0 }); assert.equal(linked.speedKmh, null);
  records.vehicleAssignments.push({ ...records.vehicleAssignments[0], id: "ambiguous" });
  assert.equal(serviceFleet(records, now)[0].driver, null); assert.equal(serviceFleet(records, now)[0].location, null);
});
test("expired/proposed assignments and missing coordinate pairs do not create a trace", () => {
  const records = emptyRecords();
  records.vehicleAssignments.push({ ...nativeAsset, id: "va", value: { assetId, serviceId, executionId: "ex", status: "PROPOSED", window: { startsAt: EXAMPLE_AS_OF, endsAt: "2026-10-09T00:00:00Z" } } });
  records.executions.push({ ...nativeAsset, id: "ex", status: "IN_PROGRESS", value: { serviceId, lastKnownPosition: { city: "Test", lat: null, lng: null } } });
  assert.equal(serviceFleet(records, now)[0].location, null);
  records.vehicleAssignments[0].value = { assetId, serviceId, executionId: "ex", status: "CONFIRMED", window: { startsAt: "2026-10-07T00:00:00Z", endsAt: EXAMPLE_AS_OF } };
  assert.equal(serviceFleet(records, now)[0].location, null);
  records.vehicleAssignments[0].value = { assetId, serviceId, executionId: "ex", status: "CONFIRMED", window: { startsAt: "2026-10-07T00:00:00Z", endsAt: "2026-10-09T00:00:00Z" } };
  assert.equal(serviceFleet(records, now)[0].location, "Test");
  assert.equal(serviceFleet(records, now)[0].coordinates, null);
  records.executions[0].value = { serviceId, lastKnownPosition: { city: "Test", lat: 0, lng: null } };
  assert.equal(serviceFleet(records, now)[0].coordinates, null);
});
test("read boundary rejects carrier scope mismatches and incomplete canonical assets", async () => {
  for (const data of [[{ ...nativeAsset, carrierId: serviceId }], [{ ...nativeAsset, value: {} }]]) {
    const fetcher: typeof fetch = async () => envelope(data);
    await assert.rejects(readFleetResource(carrierId, "assets", new AbortController().signal, fetcher), /INVALID_RESPONSE/);
  }
});
test("pagination is read-only, preserves empty results and rejects repeated offsets", async () => {
  let calls = 0;
  const fetcher: typeof fetch = async (url, init) => { assert.equal(init?.method, undefined); assert.equal(init?.cache, "no-store");
    assert.equal(init?.credentials, "same-origin"); calls++; assert.ok(String(url).includes("offset=")); return calls === 1 ? envelope([nativeAsset], 100) : envelope([]); };
  assert.equal((await readFleetResource(carrierId, "assets", new AbortController().signal, fetcher)).records.length, 1);
  assert.equal(calls, 2);
  const looping: typeof fetch = async () => envelope([], 0);
  await assert.rejects(readFleetResource(carrierId, "assets", new AbortController().signal, looping), /INVALID_RESPONSE/);
});
test("zero native vehicles stays empty without substituting local examples", async () => {
  const fetcher: typeof fetch = async url => String(url).endsWith(carrierId) ? envelope(profile) : envelope([]);
  const result = await loadFleet(carrierId, new AbortController().signal, fetcher);
  assert.deepEqual(result.vehicles, []); assert.equal(result.gaps, 0);
});
test("duplicate assets within a page cannot inflate counters", async () => {
  const fetcher: typeof fetch = async () => envelope([nativeAsset, nativeAsset]);
  await assert.rejects(readFleetResource(carrierId, "assets", new AbortController().signal, fetcher), /INVALID_RESPONSE/);
});
test("revoked permission on a dependent read invalidates the whole fleet", async () => {
  const fetcher: typeof fetch = async url => String(url).endsWith(carrierId) ? envelope(profile)
    : String(url).includes("/assets?") ? envelope([nativeAsset])
    : new Response(JSON.stringify({ error: { code: "FORBIDDEN" } }), { status: 403 });
  await assert.rejects(loadFleet(carrierId, new AbortController().signal, fetcher), /FORBIDDEN/);
});
test("invalid carrier reference is rejected before fetching", async () => {
  const fetcher: typeof fetch = async () => { assert.fail("must not fetch"); };
  await assert.rejects(loadFleet("not-a-reference", new AbortController().signal, fetcher), /INVALID_API_PATH/);
});

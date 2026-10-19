import assert from "node:assert/strict";
import { test } from "node:test";
import { applyDemoCommand, createFleetDemo, decodeFleetDemo, demoFleetVehicles, driverBusy } from "./fleet-demo";
import { exampleFleet, EXAMPLE_AS_OF, fleetSummary, remainingRangeKm } from "./fleet-model";
import { fleetDrivers } from "./fleet-drivers";

const now = Date.parse(EXAMPLE_AS_OF), changeAt = "2026-10-08T16:00:00.000Z";
test("legacy six-truck storage migrates without losing assignments or dates",()=>{
  const legacy={...createFleetDemo(),trips:createFleetDemo().trips.slice(0,6)};
  const saved=applyDemoCommand(legacy,{type:"assign",tripId:"trip-CM-204",driverId:"eq"},changeAt).state;
  const restored=decodeFleetDemo(JSON.stringify(saved))!;
  assert.equal(restored.trips.length,18);
  assert.deepEqual(restored.trips.slice(0,6),saved.trips);
  assert.equal(restored.trips.find(trip=>trip.id==="trip-CM-245")?.driverId,null,"The new tanker must not take an already assigned driver");
  assert.deepEqual(decodeFleetDemo(JSON.stringify(restored)),restored,"Migration is idempotent");
  assert.equal(decodeFleetDemo(JSON.stringify({...legacy,trips:legacy.trips.slice(1)})),null);
});
test("known regular drivers stay linked and new units do not invent a driver",()=>{
  const vehicles=demoFleetVehicles(createFleetDemo());
  assert.equal(new Set(fleetDrivers.map(driver=>driver.vehicleCode)).size,12);
  const known = vehicles.filter(vehicle=>vehicle.driverProfile);
  assert.equal(new Set(known.map(vehicle=>vehicle.driverProfile!.id)).size,12);
  for(const vehicle of known)assert.equal(vehicle.driverProfile?.vehicleCode,vehicle.code);
  assert.equal(vehicles.filter(vehicle=>!vehicle.driverProfile).length,6);
  const next=applyDemoCommand(createFleetDemo(),{type:"assign",tripId:"trip-CM-204",driverId:"av"},changeAt).state;
  const assigned=demoFleetVehicles(next).find(vehicle=>vehicle.code==="CM-204")!;
  assert.equal(assigned.driverProfile?.id,"av");assert.equal(assigned.driverProfileRole,"assigned");
  const released=applyDemoCommand(next,{type:"release",tripId:"trip-CM-204"},changeAt).state;
  const regular=demoFleetVehicles(released).find(vehicle=>vehicle.code==="CM-204")!;
  assert.equal(regular.driverProfile?.id,"dc");assert.equal(regular.driverProfileRole,"regular");
});
test("demo cards and pipeline share eighteen vehicles without inventing activity for additions", () => {
  const state = createFleetDemo(), vehicles = demoFleetVehicles(state), summary = fleetSummary(vehicles, now);
  assert.deepEqual([summary.total, summary.normal, summary.maintenance, summary.maintained], [18, 16, 2, 4]);
  assert.equal(summary.annualPercent, null, 'Unknown history of new units cannot imply no maintenance');
  assert.equal(state.trips.filter(trip => trip.stage === "UNASSIGNED").length, 11);
  assert.equal(state.trips.filter(trip => trip.stage === "ASSIGNED").length, 1);
  assert.equal(state.trips.filter(trip => trip.stage === "EN_ROUTE").length, 6);
  assert.equal(vehicles.find(vehicle => vehicle.code === "CM-204")?.driver, null);
});
test("assignment updates the card, timestamp and driver without mutating the previous state", () => {
  const seed = createFleetDemo();
  const next = applyDemoCommand(seed, { type: "assign", tripId: "trip-CM-204", driverId: "dc" }, changeAt);
  assert.equal(next.error, null); assert.equal(driverBusy(next.state, "dc"), true);
  const card = demoFleetVehicles(next.state).find(vehicle => vehicle.code === "CM-204")!;
  assert.equal(card.driver, "Diego Castro"); assert.equal(card.status, "IN_SERVICE");
  assert.equal(card.updatedAt, changeAt); assert.equal(card.statusChangedAt, changeAt);
  assert.equal(seed.trips.find(trip => trip.id === "trip-CM-204")?.stage, "UNASSIGNED");
});
test("blocked truck, busy driver, disabled driver and native ids cannot be assigned", () => {
  const state = createFleetDemo();
  const cases = [
    [{ type: "assign", tripId: "trip-CM-311", driverId: "dc" }, "VEHICLE_BLOCKED"],
    [{ type: "assign", tripId: "trip-CM-204", driverId: "lm" }, "DRIVER_BUSY"],
    [{ type: "assign", tripId: "trip-CM-204", driverId: "mt" }, "INVALID_DRIVER"],
    [{ type: "assign", tripId: "00000000-0000-4000-8000-000000000001", driverId: "dc" }, "INVALID_TRIP"],
  ] as const;
  for (const [command, error] of cases) { const result = applyDemoCommand(state, command); assert.equal(result.error, error); assert.equal(result.state, state); }
});
test("journey stages cannot be skipped; completion releases the driver but retains journey history", () => {
  const seed = createFleetDemo(), id = "trip-CM-204";
  for (const type of ["start", "finish", "release"] as const) assert.equal(applyDemoCommand(seed, { type, tripId: id }).error, "INVALID_TRANSITION");
  const assigned = applyDemoCommand(seed, { type: "assign", tripId: id, driverId: "dc" }, changeAt).state;
  assert.equal(applyDemoCommand(assigned, { type: "finish", tripId: id }).error, "INVALID_TRANSITION");
  const started = applyDemoCommand(assigned, { type: "start", tripId: id }, "2026-10-08T17:00:00.000Z").state;
  assert.equal(started.trips.find(trip => trip.id === id)?.statusChangedAt, changeAt);
  const finished = applyDemoCommand(started, { type: "finish", tripId: id }, "2026-10-08T18:00:00.000Z").state;
  assert.equal(driverBusy(finished, "dc"), false);
  const trip = finished.trips.find(trip => trip.id === id)!;
  assert.equal(trip.stage, "COMPLETED"); assert.equal(trip.driverId, "dc");
  const vehicle = demoFleetVehicles(finished).find(vehicle => vehicle.code === "CM-204")!;
  assert.equal(vehicle.status, "AVAILABLE"); assert.equal(vehicle.driver, null); assert.equal(vehicle.speedKmh, 0);
  assert.equal(vehicle.statusChangedAt, "2026-10-08T18:00:00.000Z");
  assert.equal(applyDemoCommand(finished, { type: "start", tripId: id }).error, "INVALID_TRANSITION");
});
test("releasing an assigned driver returns the journey to pending and clears the current card", () => {
  const seed = createFleetDemo(), next = applyDemoCommand(seed, { type: "release", tripId: "trip-CM-212" }, changeAt);
  assert.equal(next.error, null); assert.equal(driverBusy(next.state, "cl"), false);
  assert.equal(next.state.trips.find(trip => trip.id === "trip-CM-212")?.driverId, null);
  assert.equal(demoFleetVehicles(next.state).find(vehicle => vehicle.code === "CM-212")?.status, "AVAILABLE");
});
test("persisted demo restores valid state and rejects corrupt, foreign or conflicting assignments", () => {
  const valid = applyDemoCommand(createFleetDemo(), { type: "assign", tripId: "trip-CM-204", driverId: "dc" }, changeAt).state;
  assert.deepEqual(decodeFleetDemo(JSON.stringify(valid)), valid);
  for (const bad of [null, "{broken", JSON.stringify({ ...valid, version: 2 }), JSON.stringify({ ...valid, source: "SERVICE" })]) assert.equal(decodeFleetDemo(bad), null);
  const mutate = (fn: (state: typeof valid) => void) => { const copy = structuredClone(valid); fn(copy); assert.equal(decodeFleetDemo(JSON.stringify(copy)), null); };
  mutate(state => { state.trips[0].vehicleId = "native-id"; });
  mutate(state => { state.trips[0].driverId = null; });
  mutate(state => { state.trips[0].driverId = "mt"; });
  mutate(state => { state.trips[1].driverId = state.trips[0].driverId; });
  mutate(state => { state.trips[2].stage = "ASSIGNED"; state.trips[2].driverId = "eq"; });
  mutate(state => { state.trips[1] = state.trips[0]; });
  mutate(state => { state.trips[0].updatedAt = "bad-date"; });
});
test("demo derivation never changes service records even if an example id collides", () => {
  const vehicle = { ...exampleFleet()[0], source: "SERVICE" as const, driver: "Real driver" };
  assert.equal(demoFleetVehicles(createFleetDemo(), [vehicle])[0], vehicle);
});
test("range distinguishes unknown readings from zero fuel and rejects invalid estimates", () => {
  const vehicle = exampleFleet()[0]; assert.equal(remainingRangeKm(vehicle), 769);
  assert.equal(remainingRangeKm({ ...vehicle, fuelPercent: 0 }), 0);
  for (const patch of [{ fuelPercent: null }, { fuelPercent: NaN }, { fuelPercent: -1 }, { fuelPercent: 101 }, { tankLiters: null }, { tankLiters: 0 }, { consumptionLitersPer100Km: Infinity }, { consumptionLitersPer100Km: 0 }]) assert.equal(remainingRangeKm({ ...vehicle, ...patch }), null);
});
test("annual KPI counts trucks once, includes interval boundaries and excludes future or incomplete work", () => {
  const vehicle = exampleFleet()[0], event = vehicle.maintenanceHistory![0];
  const truck = { ...vehicle, maintenanceHistory: [
    { ...event, endsAt: "2025-10-08T15:00:00Z" }, { ...event, id: "same-truck", endsAt: EXAMPLE_AS_OF },
  ] };
  assert.equal(fleetSummary([truck], now).annualPercent, 100);
  for (const patch of [{ endsAt: "2025-10-08T14:59:59Z" }, { endsAt: "2026-10-08T15:00:01Z" }, { status: "CANCELLED" }, { status: "SCHEDULED" }]) {
    assert.equal(fleetSummary([{ ...vehicle, maintenanceHistory: [{ ...event, ...patch }] }], now).annualPercent, 0);
  }
  assert.equal(fleetSummary([], now).annualPercent, null);
  assert.equal(fleetSummary([truck, { ...vehicle, maintenanceHistory: null }], now).annualPercent, null);
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDepotCoordinator, createDepotScenario } from './depot-coordinator';
import { depotYardPose } from './depot-yard-pose';
import { depotTemplates } from './depot-templates';

test('camera retention does not publish frame snapshots or change clock, selection and pause', () => {
  const controller = createDepotCoordinator(); controller.advance(1234); controller.select('visual-truck-c'); controller.setPlaying(false);
  let published = 0; const unsubscribe = controller.subscribe(() => published++);
  const pose = { position: [-12, 24, 30] as [number, number, number], target: [1, .5, 2] as [number, number, number], zoom: 18, guided: false, focusKey: 'visual-truck-c:false:1000:600' };
  controller.rememberCamera(pose); assert.equal(published, 0);
  pose.position[0] = 99; assert.equal(controller.getCamera()!.position[0], -12);
  const returned = controller.getCamera()!; returned.target[0] = 999; assert.equal(controller.getCamera()!.target[0], 1);
  const before = controller.getSnapshot(), camera = controller.getCamera();
  for (const template of depotTemplates) {
    controller.setTemplate(template.id); const after = controller.getSnapshot();
    assert.deepEqual(controller.getCamera(), camera); assert.equal(after.elapsedMs, before.elapsedMs);
    assert.equal(after.selectedAssetId, before.selectedAssetId); assert.equal(after.requestedPlay, false);
    assert.deepEqual(after.vehicles, before.vehicles); assert.deepEqual(after.eventIds, before.eventIds);
  }
  assert.throws(() => controller.rememberCamera({ ...pose, zoom: NaN }), /INVALID_DEPOT_CAMERA/);
  assert.throws(() => controller.rememberCamera({ ...pose, zoom: 0 }), /INVALID_DEPOT_CAMERA/);
  assert.deepEqual(controller.getCamera(), camera); unsubscribe();
});

test('five trucks start with separate loading, waiting, reserved parking, departure and maintenance', () => {
  const state = createDepotCoordinator().getSnapshot();
  assert.deepEqual(state.vehicles.map(v => v.phase), ['loading', 'waiting', 'parked', 'departing', 'maintenance']);
  assert.equal(state.vehicles[2].reserved, true);
  assert.equal(state.source, 'SIMULATED');
});
test('A clears before B docks; reserved and maintenance trucks remain fixed throughout', () => {
  const controller = createDepotCoordinator();
  const initial = controller.getSnapshot().vehicles;
  const c = depotYardPose(initial[2], 0), e = depotYardPose(initial[4], 0);
  for (let i = 0; i < 360; i++) {
    controller.advance(250);
    const state = controller.getSnapshot();
    const occupied = state.vehicles.map(v => v.resourceCode).filter(Boolean);
    assert.equal(new Set(occupied).size, occupied.length);
    assert.deepEqual(depotYardPose(state.vehicles[2], state.elapsedMs).position, c.position);
    assert.deepEqual(depotYardPose(state.vehicles[4], state.elapsedMs).position, e.position);
    if (state.elapsedMs < 40000) assert.notEqual(state.vehicles[1].resourceCode, 'BAY_02');
  }
  assert.equal(controller.getSnapshot().vehicles[0].phase, 'departed');
  assert.equal(controller.getSnapshot().vehicles[1].phase, 'ready');
  assert.equal(controller.getSnapshot().vehicles[4].phase, 'maintenance');
  assert.equal(controller.getSnapshot().completed, true);
});
test('selection, subscription remounts and pause preserve elapsed clock, events and identities', () => {
  const controller = createDepotCoordinator();
  controller.advance(18350);
  const before = controller.getSnapshot();
  const unsubscribe = controller.subscribe(() => {}); unsubscribe();
  controller.select('visual-truck-c'); controller.setInterior(true); controller.setPlaying(false);
  controller.advance(10000);
  assert.equal(controller.getElapsedMs(), 18350);
  assert.equal(controller.getSnapshot().vehicles[2].reserved, true);
  assert.deepEqual(controller.getSnapshot().eventIds, before.eventIds);
  controller.setPlaying(true); controller.advance(1000);
  assert.equal(controller.getElapsedMs(), 19350);
  assert.equal(controller.getSnapshot().selectedAssetId, 'visual-truck-c');
  assert.equal(controller.getSnapshot().interior, true);
});
test('duplicate events are deduplicated and invalid occupancy, visitors and maintenance moves are rejected', () => {
  const scenario = createDepotScenario();
  scenario.events.push({ ...scenario.events[0] });
  const controller = createDepotCoordinator(scenario); controller.advance(90000);
  assert.equal(controller.getSnapshot().eventIds.length, 8);
  const occupied = createDepotScenario(); occupied.events[0] = { ...occupied.events[0], resourceCode: 'BAY_02' };
  assert.throws(() => createDepotCoordinator(occupied), /VISUAL_BAY_OCCUPIED/);
  const maintenance = createDepotScenario(); maintenance.events[0] = { ...maintenance.events[0], assetId: 'visual-truck-e' };
  assert.throws(() => createDepotCoordinator(maintenance), /MAINTENANCE_IS_BLOCKED/);
  const visitor = createDepotScenario(); visitor.vehicles[0].visitor = { visitId: 'visitor-1', authorized: false as unknown as true };
  assert.throws(() => createDepotCoordinator(visitor), /UNAUTHORIZED_VISITOR/);
});
test('empty depot and unknown location do not invent present vehicles; final frame never restarts', () => {
  const scenario = createDepotScenario(); scenario.vehicles = []; scenario.events = [];
  assert.equal(createDepotCoordinator(scenario).getSnapshot().vehicles.length, 0);
  const unknown = createDepotScenario(); unknown.vehicles[2].phase = 'unknown';
  const controller = createDepotCoordinator(unknown);
  assert.equal(depotYardPose(controller.getSnapshot().vehicles[2], 0).visible, false);
  controller.advance(90000); controller.advance(100000);
  assert.equal(controller.getElapsedMs(), 90000);
});
test('yard paths stay continuous and exiting trucks retain explicit cargo', () => {
  const vehicles = createDepotScenario().vehicles;
  for (const vehicle of vehicles) {
    let previous = depotYardPose(vehicle, 0);
    for (let time = 50; time <= 90000; time += 50) {
      const next = depotYardPose(vehicle, time);
      assert.ok(next.position.distanceTo(previous.position) < .4, vehicle.assetId);
      assert.ok(Number.isFinite(next.yaw)); previous = next;
    }
  }
  assert.equal(depotYardPose(vehicles[0], 35000).loaded, 3);
  assert.equal(depotYardPose(vehicles[3], 5000).loaded, 3);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Box3, Mesh, type MeshStandardMaterial } from 'three';
import { truckDesigns } from './visual-catalog';
import { buildCargoMeshTruck, disposeCargoMeshTruck, truckVisualTypes } from './truck-model';
import { buildDepot, disposeDepot } from './depot-model';
import { depotTemplates } from './depot-templates';
import { createDepotCoordinator } from './depot-coordinator';
import { visualTripCircuit, visualTripPose } from './visual-trip-model';

test('18 visual assemblies reuse all ten families with finite distinct geometry and bounded material batches', () => {
  assert.equal(truckDesigns.length, 18); assert.equal(new Set(truckDesigns.map(design => design.id)).size, 18);
  assert.deepEqual(new Set(truckDesigns.map(design => design.family)), new Set(truckVisualTypes));
  const signatures = new Set<string>();
  for (const design of truckDesigns) {
    const model = buildCargoMeshTruck(design.family, { appearance: design.appearance, designId: design.id });
    let triangles = 0, batches = 0;
    model.traverse(node => { if (node instanceof Mesh) { batches++; triangles += (node.geometry.index?.count ?? node.geometry.attributes.position.count) / 3; for (const n of node.geometry.attributes.position.array) assert.ok(Number.isFinite(n), design.id); } });
    assert.ok(triangles < 50000 && batches <= 12, design.id);
    const bounds = new Box3().setFromObject(model);
    signatures.add(`${design.family}:${triangles}:${bounds.max.y}`);
    const paint = model.children.find(part => part.name === 'paint') as Mesh;
    assert.equal('#' + (paint.material as MeshStandardMaterial).color.getHexString(), design.appearance.cab);
    assert.equal(model.userData.designId, design.id); assert.equal(model.userData.decorative, true);
    disposeCargoMeshTruck(model);
  }
  assert.equal(signatures.size, 18, 'A paint change alone must not stand in for a new assembly');
});
test('five depot templates have different physical layouts, bounded geometry and disposable ownership', () => {
  const signatures = new Set<string>();
  for (const template of depotTemplates) {
    const depot = buildDepot('#147d88', template.id); let triangles = 0, meshes = 0, disposed = 0;
    depot.root.traverse(node => { if (node instanceof Mesh) { meshes++; triangles += (node.geometry.index?.count ?? node.geometry.attributes.position.count) / 3; for (const n of node.geometry.attributes.position.array) assert.ok(Number.isFinite(n)); node.geometry.addEventListener('dispose', () => disposed++); } });
    const bounds = new Box3().setFromObject(depot.root);
    signatures.add(`${triangles}:${bounds.max.y}:${template.depth}`);
    assert.equal(depot.shutters.length, template.bays); assert.equal(depot.root.userData.templateId, template.id);
    assert.ok(meshes < 36 && triangles < 35000, template.id); assert.ok(depot.roof.children.length);
    disposeDepot(depot.root); assert.equal(disposed, meshes);
  }
  assert.equal(signatures.size, 5);
});
test('changing visual layout or same-family assembly preserves events, positions, identity, reservation and clock', () => {
  const controller = createDepotCoordinator(); controller.advance(18000); controller.select('visual-truck-a'); controller.setInterior(true); controller.setPlaying(false);
  const before = controller.getSnapshot();
  controller.setTemplate('cold'); controller.setDesign('visual-truck-a', 'articulated-aero');
  const after = controller.getSnapshot();
  assert.equal(after.elapsedMs, before.elapsedMs); assert.deepEqual(after.eventIds, before.eventIds);
  assert.deepEqual(after.vehicles.map(v => [v.assetId,v.phase,v.resourceCode,v.tripId,v.reserved,v.slot]), before.vehicles.map(v => [v.assetId,v.phase,v.resourceCode,v.tripId,v.reserved,v.slot]));
  assert.equal(after.selectedAssetId, before.selectedAssetId); assert.equal(after.interior, true); assert.equal(after.requestedPlay, false);
  assert.equal(after.vehicles[0].designId, 'articulated-aero');
  assert.throws(() => controller.setDesign('visual-truck-a', 'tipper-site'), /INVALID_VISUAL_DESIGN/);
  assert.throws(() => controller.setDesign('foreign-asset', 'articulated-box'), /INVALID_VISUAL_DESIGN/);
  controller.setPlaying(true); controller.advance(30000);
  assert.equal(controller.getSnapshot().vehicles[0].designId, 'articulated-aero');
});
test('original scenic circuit has a continuous seam, finite lane poses and repeatable travel without geographic inputs', () => {
  const curve = visualTripCircuit(), length = curve.getLength();
  const before = visualTripPose(curve, length - .001), after = visualTripPose(curve, length + .001);
  assert.ok(before.point.distanceTo(after.point) < .01);
  assert.ok(before.tangent.dot(after.tangent) > .999);
  for (let distance = 0; distance < length * 2; distance += .5) { const pose = visualTripPose(curve, distance); assert.ok([pose.point.x, pose.point.y, pose.point.z, pose.angle].every(Number.isFinite)); assert.ok(pose.point.distanceTo(pose.center) > 2.49); }
  assert.ok(visualTripPose(curve, 42).point.distanceTo(visualTripPose(curve, length + 42).point) < 1e-7);
});

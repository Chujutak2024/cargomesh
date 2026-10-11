import assert from "node:assert/strict";
import test from "node:test";
import { InstancedMesh, Vector3 } from "three";
import { createEntranceRoad } from "./entrance-road";
import { scenicChunkIndices, SCENIC_CHUNK_LENGTH } from "../logistics-3d/scenic-route-model";
import { disposeScenicWorld, scenicRoadRibbon } from "../logistics-3d/scenic-route-world";
import { buildEntranceWoodland } from "./entrance-woodland";

test("streamed entrance road has matching edge vertices and tangents after coordinate rebasing", () => {
  const road = createEntranceRoad();
  for (const boundary of [0, 320, 640, 32000, 320000]) {
    const leftOrigin = road.centerAt(boundary - 320), rightOrigin = road.centerAt(boundary);
    const left = road.section(boundary - 320, boundary, leftOrigin), right = road.section(boundary, boundary + 320, rightOrigin);
    assert.ok(left.getTangentAt(1).distanceTo(right.getTangentAt(0)) < 1e-10);
    const a = scenicRoadRibbon(left, 11), b = scenicRoadRibbon(right, 11);
    for (let side = 0; side < 2; side++) {
      const end = new Vector3().fromBufferAttribute(a.getAttribute("position"), a.getAttribute("position").count - 2 + side).add(leftOrigin);
      const start = new Vector3().fromBufferAttribute(b.getAttribute("position"), side).add(rightOrigin);
      assert.ok(end.distanceTo(start) < .0001);
    }
    a.dispose(); b.dispose();
  }
});
test("truck remains in its lane and terrain offsets stay consistent across distant sections", () => {
  const road = createEntranceRoad();
  for (const distance of [-320, 0, 100, 1000, 1000000]) {
    const pose = road.poseAt(distance);
    assert.ok(Math.abs(road.offsetAt(pose.point.x, pose.point.z) - 2.5) < .00001);
    assert.ok(Math.abs(pose.normal.dot(pose.tangent)) < 1e-10);
    assert.ok(road.poseAt(distance + .1).point.distanceTo(pose.point) < .103);
  }
});
test("continuous travel keeps four sections and never resets its distance", () => {
  for (const distance of [100, 319.99, 320, 10000, 1000000]) {
    const chunks = scenicChunkIndices(distance);
    assert.equal(chunks.length, 4); assert.ok(chunks.includes(Math.floor(distance / SCENIC_CHUNK_LENGTH)));
    assert.ok(createEntranceRoad().centerAt(distance).distanceTo(createEntranceRoad().centerAt(distance + 1)) >= 1);
  }
});
test("recycling woodland also releases instance buffers and its leaf texture", () => {
  const woodland = buildEntranceWoodland(createEntranceRoad(), 0, 320, new Vector3(), () => -.13);
  let buffers = 0, textures = 0;
  woodland.root.traverse(mesh => {
    if (!(mesh instanceof InstancedMesh)) return;
    mesh.addEventListener("dispose", () => { buffers++; });
    const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    if ("map" in material && material.map) material.map.addEventListener("dispose", () => { textures++; });
  });
  disposeScenicWorld(woodland.root);
  assert.equal(buffers, 2); assert.equal(textures, 1); assert.equal(woodland.root.children.length, 0);
});

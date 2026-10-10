import { test } from "node:test";
import assert from "node:assert/strict";
import { buildRouteTrack } from "./route-track";
import { continuousScenicRoad, routeLandscape, scenicChunkIndices, scenicRoadPose, scenicRouteCurve, SCENIC_CHUNK_LENGTH } from "./scenic-route-model";
import { Vector3 } from "three";
import { buildScenicRouteTerrain, disposeScenicWorld, scenicRoadRibbon, scenicTerrainElevation, scenicTerrainGeometry } from "./scenic-route-world";
test("road triangles face upward so the asphalt and route guide are visible", () => {
  const track = buildRouteTrack([[{lat:-12,lng:-77},{lat:-11.8,lng:-77},{lat:-11.8,lng:-76.8}]])!;
  const geometry = scenicRoadRibbon(scenicRouteCurve(track), 11);
  const normals = geometry.getAttribute("normal");
  for (let i = 0; i < normals.count; i += 31) assert.ok(normals.getY(i) > .9);
  geometry.dispose();
});

test("visual continuation joins the provider-driven road without moving or reversing the truck", () => {
  const track = buildRouteTrack([[{lat:-12,lng:-77},{lat:-11.8,lng:-77},{lat:-11.6,lng:-76.9}]])!;
  const curve = scenicRouteCurve(track), road = continuousScenicRoad(curve, "coast");
  assert.ok(road.centerAt(road.length * .87).distanceTo(curve.getPointAt(.87)) < 1e-6);
  const before = road.poseAt(road.length - .001), after = road.poseAt(road.length + .001);
  assert.ok(before.point.distanceTo(after.point) < .005);
  assert.ok(before.tangent.dot(after.tangent) > .9999);
  assert.ok(road.poseAt(road.length + 100000).point.distanceTo(after.point) > 99000);
  assert.ok(road.poseAt(road.length + 100000).tangent.dot(after.tangent) > .9);
});

test("streamed asphalt shares lane edges and UV phase at chunk boundaries, including the extension", () => {
  const track = buildRouteTrack([[{lat:-12,lng:-77},{lat:-11.8,lng:-77},{lat:-11.6,lng:-76.9}]])!;
  const road = continuousScenicRoad(scenicRouteCurve(track), "mountains");
  for (const index of [0, 4, 8, 100]) {
    const from = index * SCENIC_CHUNK_LENGTH, join = from + SCENIC_CHUNK_LENGTH, originA = road.centerAt(from), originB = road.centerAt(join);
    const a = scenicRoadRibbon(road.section(from, join, originA), 11, 0, .03, from);
    const b = scenicRoadRibbon(road.section(join, join + SCENIC_CHUNK_LENGTH, originB), 11, 0, .03, join);
    const positionsA = a.getAttribute("position"), positionsB = b.getAttribute("position"), uvA = a.getAttribute("uv"), uvB = b.getAttribute("uv");
    for (let side = 0; side < 2; side++) {
      const p = new Vector3().fromBufferAttribute(positionsA, positionsA.count - 2 + side).add(originA);
      const q = new Vector3().fromBufferAttribute(positionsB, side).add(originB);
      assert.ok(p.distanceTo(q) < .0001);
      assert.ok(Math.abs(uvA.getY(uvA.count - 2 + side) - uvB.getY(side)) < 1e-5);
    }
    a.dispose(); b.dispose();
  }
});

test("endless streaming keeps four sections and replaces only the far scenery each boundary", () => {
  let previous = scenicChunkIndices(0);
  for (let index = 1; index <= 1000; index++) {
    const cursor = index * SCENIC_CHUNK_LENGTH + .01, wanted = scenicChunkIndices(cursor);
    assert.equal(new Set(wanted).size, 4);
    assert.equal(wanted.filter(value => !previous.includes(value)).length, 1);
    assert.ok((wanted.at(-1)! * SCENIC_CHUNK_LENGTH) - cursor > 600);
    previous = wanted;
  }
});

test("world terrain stays upward and below the road through tight bends and the endless extension", () => {
  const track = buildRouteTrack([[{lat:-12,lng:-77},{lat:-11.99,lng:-77},{lat:-11.99,lng:-76.999},{lat:-12,lng:-76.999}]])!;
  const road = continuousScenicRoad(scenicRouteCurve(track), "mountains");
  const geometry = scenicTerrainGeometry(road, road.centerAt(road.length * .7), "mountains"), normals = geometry.getAttribute("normal");
  for (let index = 0; index < normals.count; index++) assert.ok(normals.getY(index) > 0);
  for (const cursor of [0, 100, road.length * .7, road.length, road.length + 10000]) {
    const point = road.poseAt(cursor).point;
    assert.ok(scenicTerrainElevation(road, "mountains", point.x, point.z) < .01);
  }
  geometry.dispose();
});

test("recycling coast terrain releases shared geometry and each texture exactly once", () => {
  const track = buildRouteTrack([[{lat:-12,lng:-77},{lat:-11.8,lng:-77}]])!, road = continuousScenicRoad(scenicRouteCurve(track), "coast");
  const terrain = buildScenicRouteTerrain(road, "coast", road.length + 300);
  const ground = terrain.root.children[0] as import("three").Mesh<import("three").BufferGeometry, import("three").MeshStandardMaterial>;
  let geometryDisposals = 0, textureDisposals = 0;
  ground.geometry.addEventListener("dispose", () => geometryDisposals++); ground.material.map!.addEventListener("dispose", () => textureDisposals++);
  disposeScenicWorld(terrain.root);
  assert.equal(geometryDisposals, 1); assert.equal(textureDisposals, 1); assert.equal(terrain.root.children.length, 0);
});
test("scenic truck lane remains a fixed offset from curved route and faces its tangent", () => {
  const track = buildRouteTrack([[{lat:-12,lng:-77},{lat:-11.8,lng:-77},{lat:-11.8,lng:-76.8},{lat:-11.5,lng:-76.8}]])!;
  const curve = scenicRouteCurve(track);
  for (const progress of [0,.2,.5,.7,1]) {
    const pose = scenicRoadPose(curve, progress);
    assert.ok(Math.abs(pose.point.distanceTo(pose.center) - 2.5) < 1e-6);
    assert.ok(Math.abs(-Math.cos(pose.angle) - pose.tangent.x) < 1e-6);
    assert.ok(Math.abs(Math.sin(pose.angle) - pose.tangent.z) < 1e-6);
  }
  assert.ok(Math.abs(scenicRoadPose(curve,.1).angle - scenicRoadPose(curve,.5).angle) > .2);
});
test("route environment varies and date-line coordinates stay continuous", () => {
  assert.equal(routeLandscape("Callao", "Piura"), "coast");
  assert.equal(routeLandscape("Lima", "Arequipa"), "mountains");
  assert.equal(routeLandscape("Madrid", "Barcelona"), "city");
  assert.equal(routeLandscape("Sydney", "Melbourne"), "countryside");
  const track = buildRouteTrack([[{lat:1,lng:179.99},{lat:1,lng:-179.99}]])!;
  const curve = scenicRouteCurve(track);
  assert.ok(curve.getLength() < 2300);
  assert.ok(scenicRoadPose(curve,1).point.x > 2000);
});

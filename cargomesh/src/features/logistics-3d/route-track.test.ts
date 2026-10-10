import {test} from "node:test";
import assert from "node:assert/strict";
import {buildRouteTrack,routePointAt,routePose,routeDistance} from "./route-track";

test("3D route follows distance along declared geometry, including bends and duplicate points",()=>{
  const points=[{lat:-12,lng:-77},{lat:-12,lng:-77},{lat:-11.99,lng:-77},{lat:-11.99,lng:-76.99}];
  const track=buildRouteTrack([points])!;assert.equal(track.points.length,3);assert.ok(track.total>2000&&track.total<2300);
  const bend=routePointAt(track,track.distances[1]);assert.ok(routeDistance(bend,points[2])<.001);
  assert.ok(routeDistance(routePointAt(track,-5),points[0])<.001);assert.ok(routeDistance(routePointAt(track,1e9),points.at(-1)!)<.001);
  assert.ok(routePose(track,50).heading<1);assert.ok(Math.abs(routePose(track,track.total-10).heading-90)<1);
  for(let d=0;d<track.total;d+=13){const pose=routePose(track,d);assert.ok([pose.point.lat,pose.point.lng,pose.heading,pose.progress].every(Number.isFinite));}
  assert.equal(points.length,4);assert.notEqual(track.points[0],points[0]);
});
test("no fabricated route for missing, invalid or disconnected geometry",()=>{
  assert.equal(buildRouteTrack([]),null);assert.equal(buildRouteTrack([[{lat:0,lng:0}]]),null);
  assert.equal(buildRouteTrack([[{lat:0,lng:0},{lat:Infinity,lng:1}]]),null);
  assert.equal(buildRouteTrack([[{lat:0,lng:0},{lat:0,lng:1}],[{lat:2,lng:2},{lat:2,lng:3}]]),null);
  assert.ok(buildRouteTrack([[{lat:0,lng:0},{lat:0,lng:1}],[{lat:0,lng:1},{lat:0,lng:2}]]));
});
test("longitude wraps across the date line without a long detour",()=>{
  const track=buildRouteTrack([[{lat:0,lng:179.99},{lat:0,lng:-179.99}]])!;
  assert.ok(track.total<2300);assert.ok(Math.abs(routePointAt(track,track.total/2).lng)>179.999);assert.ok(Math.abs(routePose(track,50).heading-90)<.001);
});

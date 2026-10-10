import assert from "node:assert/strict";
import test from "node:test";
import { environmentBlendAt, getTruckEnvironment } from "./truck-environment";

const at = (hour: number, minute = 0) => new Date(2026,9,9,hour,minute,0);

test("automatic lighting follows the device's local day, afternoon and night boundaries", () => {
  assert.equal(getTruckEnvironment(at(5,59)).phase,"night");
  assert.equal(getTruckEnvironment(at(6)).phase,"day");
  assert.equal(getTruckEnvironment(at(15,59)).phase,"day");
  assert.equal(getTruckEnvironment(at(16)).phase,"afternoon");
  assert.equal(getTruckEnvironment(at(18,59)).phase,"afternoon");
  assert.equal(getTruckEnvironment(at(19)).phase,"night");
  assert.deepEqual(getTruckEnvironment(at(23,59)),getTruckEnvironment(at(0)));
});

test("sunrise and sunset blend continuously rather than snapping lighting at an hour", () => {
  for(const boundary of [5,7,16,18,20]) {
    assert.ok(Math.abs(environmentBlendAt(boundary-.001)-environmentBlendAt(boundary+.001))<.003);
  }
  assert.equal(environmentBlendAt(17),.5);
  assert.equal(environmentBlendAt(19),1.5);
  const before=getTruckEnvironment(at(17,30)), after=getTruckEnvironment(at(17,31));
  assert.notEqual(before.skyHorizon,after.skyHorizon);
  assert.ok(after.blend>before.blend);
  assert.ok(after.key<before.key);
});

test("all lighting states always come from the local clock and stay bounded", () => {
  assert.equal(getTruckEnvironment(at(10)).night,0);
  assert.equal(getTruckEnvironment(at(22)).night,1);
  for(let minute=0;minute<24*60;minute++) {
    const state=getTruckEnvironment(at(Math.floor(minute/60),minute%60));
    assert.ok(state.blend>=0&&state.blend<=2&&state.night>=0&&state.night<=1);
    assert.match(state.skyTop,/^#[0-9a-f]{6}$/);
  }
});

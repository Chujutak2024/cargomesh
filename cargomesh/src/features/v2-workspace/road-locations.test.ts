import assert from "node:assert/strict";
import test from "node:test";
import { cityLabel, countryLabel, facilities, landRoutePolicy, locationRegions } from "./road-locations";

test("catalog references are unique, bounded city coordinates covering six geographic regions", () => {
  assert.equal(new Set(facilities.map(location => location.id)).size, facilities.length);
  assert.equal(facilities.length, 34);
  for (const region of locationRegions) assert.ok(facilities.some(location => location.region === region.id));
  for (const location of facilities) {
    assert.ok(Number.isFinite(location.lat) && Math.abs(location.lat) <= 90);
    assert.ok(Number.isFinite(location.lng) && Math.abs(location.lng) <= 180);
    assert.match(location.countryCode, /^[A-Z]{2}$/);
  }
});

test("land policy allows reverse routes and does not equate continents with land networks", () => {
  assert.equal(landRoutePolicy("piura", "callao"), "previewable");
  assert.equal(landRoutePolicy("paris", "bangkok"), "previewable");
  assert.equal(landRoutePolicy("madrid", "nairobi"), "previewable");
  assert.equal(landRoutePolicy("callao", "madrid"), "disconnected_networks");
  assert.equal(landRoutePolicy("bogota", "mexico-city"), "disconnected_networks");
  assert.equal(landRoutePolicy("melbourne", "singapore"), "disconnected_networks");
  assert.equal(landRoutePolicy("madrid", "madrid"), "same_location");
  assert.equal(landRoutePolicy("nonexistent", "callao"), "invalid_location");
});

test("city and country labels follow Spanish and English, not a hardcoded Peru label", () => {
  assert.equal(countryLabel("ES", "es"), "España");
  assert.equal(countryLabel("ES", "en"), "Spain");
  assert.equal(cityLabel(facilities.find(location => location.id === "mexico-city")!, "en"), "Mexico City");
  assert.equal(cityLabel(facilities.find(location => location.id === "paris")!, "es"), "París");
});

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FleetInputsV2 } from "./fleet";
import { CatalogServiceV2, type CatalogRepositoryV2 } from "@/server/modules/catalog/application/catalog-service";
const fixtures = JSON.parse(readFileSync("../supabase/scenarios/v2-road-baseline/fixtures/hac40-fleet.json", "utf8"));
const assetId = "d1000000-0000-4000-8000-000000000001";
const calendarId = "d1000000-0000-4000-8000-000000000002";
function value(kind: keyof typeof FleetInputsV2) {
  const raw = JSON.stringify(fixtures[kind]).replaceAll("ASSET", assetId).replaceAll("CALENDAR", calendarId).replaceAll("DEFINITION", assetId);
  return JSON.parse(raw);
}
describe("HAC-40 fleet contracts", () => {
  it("validates all fleet publications and rejects injected identity fields", () => {
    for (const kind of Object.keys(FleetInputsV2) as (keyof typeof FleetInputsV2)[]) {
      assert.ok(FleetInputsV2[kind].safeParse(value(kind)).success, kind);
      assert.equal(FleetInputsV2[kind].safeParse({ ...value(kind), carrierId: assetId }).success, false);
    }
  });
  it("rejects auxiliary carrying capacity, inconsistent partner and overweight vehicle", () => {
    const asset = value("assets");
    for (const raw of [{ ...asset, role: "AUXILIARY" }, { ...asset, provenance: "PARTNER" },
      { ...asset, usefulCapacityKg: 20000 }, { ...asset, mode: "AIR" }]) {
      assert.equal(FleetInputsV2.assets.safeParse(raw).success, false);
    }
  });
  it("rejects false horizons, overlapping slots and invalid timezone", () => {
    const calendar = value("calendars");
    for (const raw of [{ ...calendar, timezone: "Mars/Olympus" }, { ...calendar, capacityPoolId: assetId },
      { ...calendar, availableWindows: [...calendar.availableWindows, ...calendar.availableWindows] },
      { ...calendar, horizon: { ...calendar.horizon, endsAt: "2027-01-15T00:00:00Z" } },
      { ...calendar, lastVerifiedAt: null }]) assert.equal(FleetInputsV2.calendars.safeParse(raw).success, false);
  });
  it("passes the authenticated scope and version to the atomic repository", async () => {
    const actor = { memberId: assetId, organizationId: calendarId };
    const scope = { carrierId: "c2340000-0000-4000-8000-000000000001", serviceId: null };
    const payload = value("assets"); let called = false;
    const repo: CatalogRepositoryV2 = { async read() { return []; }, async command(received, kind, receivedScope, input) {
      called = true; assert.deepEqual(received, actor); assert.deepEqual(receivedScope, scope);
      assert.equal(kind, "assets"); assert.equal(input.expectedVersion, 2);
      return { record: { id: assetId, organizationId: null, carrierId: scope.carrierId, serviceId: payload.serviceId,
        version: 3, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z", value: payload }, replay: false };
    } };
    const result = await new CatalogServiceV2(repo).command(actor, "assets", scope, assetId,
      { expectedVersion: 2, value: payload }, calendarId);
    assert.ok(called); assert.equal(result.data.version, 3);
  });
});

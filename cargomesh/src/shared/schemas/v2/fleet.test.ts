import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FleetInputsV2, FleetOutputsV2 } from "./fleet";
import { CatalogServiceV2, type CatalogRepositoryV2 } from "@/server/modules/catalog/application/catalog-service";
const fixtures = JSON.parse(readFileSync("../supabase/scenarios/v2-road-baseline/fixtures/hac40-fleet.json", "utf8"));
const assetId = "d1000000-0000-4000-8000-000000000001";
const calendarId = "d1000000-0000-4000-8000-000000000002";
function value(kind: keyof typeof FleetInputsV2) {
  const raw = JSON.stringify(fixtures[kind]).replaceAll("ASSET", assetId).replaceAll("CALENDAR", calendarId).replaceAll("DEFINITION", assetId);
  return JSON.parse(raw);
}
describe("HAC-40 fleet contracts", () => {
  it("reads invalidated calendars as UNKNOWN without fabricating evidence", async () => {
    const valid = value("calendars");
    assert.equal(FleetOutputsV2.calendars.safeParse(valid).success, true);
    const invalidated = { ...valid, complete: false, validUntil: null };
    assert.equal(FleetOutputsV2.calendars.safeParse(invalidated).success, false);
    const unknown = { ...invalidated, freshness: "UNKNOWN" };
    assert.equal(FleetOutputsV2.calendars.safeParse(unknown).success, true);
    const actor = { organizationId: assetId, memberId: calendarId };
    const scope = { carrierId: assetId, serviceId: valid.serviceId };
    const record = { id: calendarId, organizationId: null, carrierId: assetId, serviceId: valid.serviceId,
      version: 1, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z", value: unknown };
    const repo: CatalogRepositoryV2 = { async read() { return [record]; }, async command() { throw new Error("READ_ONLY_TEST"); } };
    const service = new CatalogServiceV2(repo);
    const detail = await service.get(actor, "calendars", scope, calendarId);
    const list = await service.list(actor, "calendars", scope, {});
    assert.deepEqual(detail.data.value, unknown);
    assert.deepEqual(list.data[0].value, unknown);
  });
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
  it("rejects missing mandatory vehicle fields and distinguishes auxiliary capacity from unknown", () => {
    const asset = value("assets");
    for (const field of ["plate", "bodyType"]) {
      assert.equal(FleetInputsV2.assets.safeParse({ ...asset, roadVehicle: { ...asset.roadVehicle, [field]: null } }).success, false);
    }
    assert.ok(FleetInputsV2.assets.safeParse({ ...asset, role: "AUXILIARY", usefulCapacityKg: 0, usableVolumeM3: null }).success);
    assert.equal(FleetInputsV2.assets.safeParse({ ...asset, role: "LOAD_BEARING", usefulCapacityKg: 0 }).success, false);
    assert.equal(FleetInputsV2.assets.safeParse({ ...asset, usefulCapacityKg: null }).success, false);
  });
  it("returns an actionable conflict for an incomplete persisted row without blocking a valid revision", async () => {
    const payload = value("assets");
    const actor = { memberId: assetId, organizationId: calendarId };
    const scope = { carrierId: "c2340000-0000-4000-8000-000000000001", serviceId: null };
    const record = { id: assetId, organizationId: null, carrierId: scope.carrierId, serviceId: payload.serviceId,
      version: 1, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z", value: payload };
    const repo: CatalogRepositoryV2 = {
      async read() { return [{ ...record, value: { ...payload, roadVehicle: { ...payload.roadVehicle, bodyType: null } } }]; },
      async command() { return { record: { ...record, version: 2 }, replay: false }; },
    };
    const service = new CatalogServiceV2(repo);
    await assert.rejects(service.get(actor, "assets", scope, assetId), { code: "CATALOG_DATA_INCOMPLETE", httpStatus: 409 });
    assert.equal((await service.command(actor, "assets", scope, assetId, { expectedVersion: 1, value: payload }, calendarId)).data.version, 2);
  });
  it("does not relax mandatory fields when reading imported fleet records", () => {
    const fields = {
      "capacity-pools": ["mode", "serviceWindow", "provenance", "evidence"],
      calendars: ["timezone", "horizon", "source", "freshness"],
      maintenances: ["kind", "source"],
      "repositioning-blocks": ["origin", "nextPickup", "source"],
    } as const;
    for (const kind of Object.keys(fields) as (keyof typeof fields)[]) {
      const valid = value(kind);
      assert.ok(FleetOutputsV2[kind].safeParse(valid).success, kind);
      for (const field of fields[kind]) {
        assert.equal(FleetOutputsV2[kind].safeParse({ ...valid, [field]: null }).success, false, `${kind}.${field}`);
      }
    }
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

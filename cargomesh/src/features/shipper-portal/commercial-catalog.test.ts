import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import { COMMERCIAL_CATALOG_READ_LIMIT, commercialCatalogReferences, commonResponseChannels, readCommercialCatalog } from "./commercial-catalog";
import { catalogRecord, commercialFixture, carrier, service, id } from "./commercial-context.test-fixtures";

test("projects native names and services with deduplication and bounded concurrency", async () => {
  const carrierIds = Array.from({ length: 12 }, (_, n) => id(100 + n));
  const seen: string[] = []; let active = 0, peak = 0;
  const catalog = await readCommercialCatalog([...carrierIds, carrierIds[0]], [{ id: service, carrierId: carrierIds[0] }, { id: service, carrierId: carrierIds[0] }], async ref => {
    seen.push(ref.id); active++; peak = Math.max(peak, active); await Promise.resolve(); active--;
    const row = catalogRecord(ref.kind, ref.id); if (ref.kind === "services") row.carrierId = carrierIds[0]; return row;
  });
  assert.equal(seen.length, 13); assert.ok(peak <= 4);
  assert.equal(catalog.carriers[carrierIds[0]].name, "Contract-test logistics");
  assert.equal(catalog.carriers[carrierIds[0]].version, 2);
  assert.equal(catalog.services[service].serviceClass, "FTL");
  assert.deepEqual(commonResponseChannels([service], carrierIds[0], catalog), ["MANUAL", "API"]);
});
for (const [status, expected] of [[404, "NOT_FOUND"], [403, "DENIED"], [409, "INCOMPLETE"], [503, "UNAVAILABLE"]] as const) {
  test(`catalog ${status} is explicit and cannot provide a guessed Carrier name or channel`, async () => {
    const catalog = await readCommercialCatalog([carrier], [{ id: service, carrierId: carrier }], async () => { throw { httpStatus: status }; });
    assert.equal(catalog.carriers[carrier].state, expected); assert.equal(catalog.carriers[carrier].name, null);
    assert.deepEqual(commonResponseChannels([service], carrier, catalog), []);
  });
}
test("expired authentication, cancellation and malformed contracts fail closed", async () => {
  for (const error of [{ status: 401 }, new DOMException("Cancelled", "AbortError")]) {
    await assert.rejects(readCommercialCatalog([carrier], [], async () => { throw error; }), caught => caught === error);
  }
  await assert.rejects(readCommercialCatalog([carrier], [], async () => ({ id: carrier })), z.ZodError);
});
test("catalog IDs and service ownership must match their authorized references", async () => {
  await assert.rejects(readCommercialCatalog([carrier], [], async () => catalogRecord("carriers", id(90))), /CATALOG_IDENTITY_SCOPE_MISMATCH/);
  await assert.rejects(readCommercialCatalog([], [{ id: service, carrierId: id(90) }], async () => catalogRecord("services")), /CATALOG_IDENTITY_SCOPE_MISMATCH/);
  await assert.rejects(readCommercialCatalog([], [{ id: service, carrierId: carrier }, { id: service, carrierId: id(90) }], async () => catalogRecord("services")), /CATALOG_SERVICE_SCOPE_MISMATCH/);
});
test("response channels are the intersection of active, loaded services, not a default", async () => {
  const catalog = await readCommercialCatalog([], [{ id: service, carrierId: carrier }], async () => catalogRecord("services"));
  catalog.services[id(90)] = { ...catalog.services[service], id: id(90), responseChannels: ["API", "MCP"] };
  assert.deepEqual(commonResponseChannels([service, id(90)], carrier, catalog), ["API"]);
  catalog.services[id(90)].active = false;
  assert.deepEqual(commonResponseChannels([service, id(90)], carrier, catalog), []);
  assert.deepEqual(commonResponseChannels([], carrier, catalog), []);
});
test("references are derived from persisted plans/opportunities/offers, never a fixed Carrier list", () => {
  const context = commercialFixture(), refs = commercialCatalogReferences({ plans: context.plans, opportunities: context.opportunities, offers: context.offers });
  assert.ok(refs.carrierIds.every(value => value === carrier));
  assert.deepEqual(refs.serviceRefs, [{ id: service, carrierId: carrier }]);
});
test("large historical catalogs use a finite enrichment budget and label unread identities incomplete", async () => {
  const ids = Array.from({ length: COMMERCIAL_CATALOG_READ_LIMIT + 1 }, (_, n) => id(100 + n)); let calls = 0;
  const catalog = await readCommercialCatalog(ids, [], async ref => { calls++; return catalogRecord("carriers", ref.id); });
  assert.equal(calls, COMMERCIAL_CATALOG_READ_LIMIT);
  assert.equal(catalog.carriers[ids.at(-1)!].state, "INCOMPLETE"); assert.equal(catalog.carriers[ids.at(-1)!].name, null);
});

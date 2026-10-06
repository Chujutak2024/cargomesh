import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CatalogServiceV2, type CatalogRepositoryV2 } from "./catalog-service";
import { parseCatalogRecordV2 } from "@/shared/schemas/v2/catalog";

const actor = { memberId: "c2320000-0000-4000-8000-000000000001", organizationId: "c2300000-0000-4000-8000-000000000001" };
const id = "d0900000-0000-4000-8000-000000000001";
const scope = { carrierId: null, serviceId: null };
const value = { schemaVersion: "2.0", objective: "WEIGHTED", maximumWaitMinutes: 90,
  preferredMode: "ROAD", preferredEquipment: null, usualBudget: { amount: 300, currency: "USD" }, validUntil: null };
const record = { id, organizationId: actor.organizationId, ...scope, version: 2, value,
  createdAt: "2026-10-04T00:00:00Z", updatedAt: "2026-10-04T01:00:00Z" };
function repository(): CatalogRepositoryV2 {
  return { async read() { return [record]; }, async command() { return { record, replay: false }; } };
}
describe("HAC-40 catalog application boundary", () => {
  it("projects category domain revisions as strings while preserving numeric concurrency and old receipts", () => {
    const category = { schemaVersion: "2.0", code: "QA", name: "Synthetic",
      guidance: { recommendedEntryMethods: ["MANUAL"], intakeSpecificationSchema: {},
        suggestedRequirements: {}, recommendedVehicleClasses: [] }, suggestedEquipment: null, active: true };
    for (const version of [1, 2]) {
      const stored = { ...record, organizationId: null, version, value: { ...category, version: String(version) } };
      const parsed = parseCatalogRecordV2("cargo-categories", stored);
      assert.equal(parsed.version, version);
      assert.equal((parsed.value as { version: string }).version, String(version));
      assert.deepEqual(parseCatalogRecordV2("cargo-categories", { ...stored, value: category }), parsed);
    }
    assert.throws(() => parseCatalogRecordV2("cargo-categories", { ...record, value: { ...category, version: 2 } }));
  });
  it("passes expected version, identity, scope and key to one atomic command", async () => {
    const repo = repository();
    let called = false;
    repo.command = async (received, kind, receivedScope, input) => {
      called = true;
      assert.deepEqual(received, actor); assert.equal(kind, "preferences"); assert.deepEqual(receivedScope, scope);
      assert.equal(input.expectedVersion, 1); assert.equal(input.id, id); assert.equal(input.key, id);
      return { record, replay: true };
    };
    const result = await new CatalogServiceV2(repo).command(actor, "preferences", scope, id,
      { expectedVersion: 1, value }, id);
    assert.ok(called); assert.equal(result.meta.idempotentReplay, true); assert.equal(result.data.version, 2);
  });
  it("rejects spoofed fields and bad versions before database access", async () => {
    const repo = repository();
    repo.command = async () => { throw new Error("DATABASE_WAS_CALLED"); };
    const service = new CatalogServiceV2(repo);
    for (const body of [{ expectedVersion: 0, value }, { expectedVersion: 1, value: { ...value, organizationId: id } },
      { expectedVersion: 1, value: { ...value, usualBudget: { amount: 10, currency: "PEN" } } }]) {
      await assert.rejects(service.command(actor, "preferences", scope, id, body, id), error =>
        error instanceof Error && error.name === "ZodError");
    }
  });
  it("rejects inverted agreement validity and secret/configuration injection", async () => {
    const service = new CatalogServiceV2(repository());
    await assert.rejects(service.command(actor, "partners", { carrierId: id, serviceId: null }, null,
      { schemaVersion: "2.0", registeredName: "Partner", partnerCarrierRef: null,
        agreementValidFrom: "2026-10-05T00:00:00Z", agreementValidUntil: "2026-10-04T00:00:00Z",
        status: "ACTIVE", coverageEvidence: "contract:1" }, id));
    await assert.rejects(service.command(actor, "services", { carrierId: id, serviceId: null }, null,
      { apiKey: "not-a-real-secret" }, id));
  });
  it("fails closed on malformed persisted data rather than returning a partial DTO", async () => {
    const repo = repository(); repo.read = async () => [{ ...record, value: { ...value, preferredMode: "SPACE" } }];
    await assert.rejects(new CatalogServiceV2(repo).list(actor, "preferences", scope, {}));
  });
  it("returns not-found and paginates without inventing default records", async () => {
    const repo = repository(); repo.read = async () => [];
    const service = new CatalogServiceV2(repo);
    assert.deepEqual((await service.list(actor, "preferences", scope, {})).data, []);
    await assert.rejects(service.get(actor, "preferences", scope, id), /Catalog entry not found/);
    await assert.rejects(service.list(actor, "preferences", scope, { limit: 101 }));
  });
});

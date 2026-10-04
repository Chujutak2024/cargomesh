import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CrewInputsV2 } from "./crew";
import { CatalogServiceV2, type CatalogRepositoryV2 } from "@/server/modules/catalog/application/catalog-service";
const id = "d0520000-0000-4000-8000-000000000001";
const fixture = JSON.parse(readFileSync("../supabase/scenarios/v2-road-baseline/fixtures/hac40-crew.json", "utf8")
  .replaceAll("ASSET", id).replaceAll("DRIVER", id).replaceAll("EXECUTION", id).replaceAll("RESERVATION", id));
describe("HAC-40 persisted crew contracts", () => {
  it("accepts complete DTOs and rejects forged identity and duplicate members", () => {
    for (const kind of Object.keys(CrewInputsV2) as (keyof typeof CrewInputsV2)[]) {
      assert.equal(CrewInputsV2[kind].safeParse(fixture[kind]).success, true, kind);
      assert.equal(CrewInputsV2[kind].safeParse({ ...fixture[kind], carrierId: id }).success, false, kind);
    }
    assert.equal(CrewInputsV2["vehicle-combinations"].safeParse({ ...fixture["vehicle-combinations"], assetIds: [id, id] }).success, false);
  });
  it("rejects invalid driver dates/timezones and incomplete duty limits", () => {
    for (const change of [{ licenseValidUntil: "2027-02-30" }, { licenseTimezone: "Mars/Olympus" },
      { dutyWindow: null }, { maximumDutySeconds: null }, { usedDutySeconds: 999999 }]) {
      assert.equal(CrewInputsV2.drivers.safeParse({ ...fixture.drivers, ...change }).success, false);
    }
  });
  it("does not accept confirmed vehicles without a reservation or combinations without a coupling period", () => {
    assert.equal(CrewInputsV2["vehicle-assignments"].safeParse({ ...fixture["vehicle-assignments"], status: "CONFIRMED", reservationId: null }).success, false);
    assert.equal(CrewInputsV2["vehicle-combinations"].safeParse({ ...fixture["vehicle-combinations"], status: "COUPLED", coupledWindow: null }).success, false);
  });
  it("passes actor, scope and optimistic version through the shared service for every resource", async () => {
    for (const kind of Object.keys(CrewInputsV2) as (keyof typeof CrewInputsV2)[]) {
      const actor = { memberId: id, organizationId: id }; const scope = { carrierId: id, serviceId: null };
      const repository: CatalogRepositoryV2 = { async read() { return []; }, async command(receivedActor, receivedKind, receivedScope, input) {
        assert.deepEqual(receivedActor, actor); assert.deepEqual(receivedScope, scope); assert.equal(receivedKind, kind);
        assert.equal(input.expectedVersion, 2);
        return { replay: false, record: { id, carrierId: id, organizationId: null, serviceId: fixture[kind].serviceId,
          version: 3, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z", value: fixture[kind] } };
      } };
      const result = await new CatalogServiceV2(repository).command(actor, kind, scope, id, { expectedVersion: 2, value: fixture[kind] }, id);
      assert.equal(result.data.version, 3);
    }
  });
});

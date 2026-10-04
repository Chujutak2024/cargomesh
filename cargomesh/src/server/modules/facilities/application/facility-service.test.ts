import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { FacilityInputV2Schema, OperatingHoursV2Schema, type FacilityV2 } from "@/shared/schemas/v2/facilities";
import { FacilityServiceV2, type FacilityRepositoryV2 } from "./facility-service";
const actor = { memberId: "c2320000-0000-4000-8000-000000000001", organizationId: "c2300000-0000-4000-8000-000000000001" };
const id = "d0400000-0000-4000-8000-000000000001";
const value = FacilityInputV2Schema.parse({ schemaVersion: "2.0", code: "WAREHOUSE", name: "Almacén",
  facilityType: "WAREHOUSE", location: { label: "Av. 1", countryCode: "PE", region: "Lima",
    city: "Lima", lat: -12, lng: -77 }, active: true, accessRestrictions: [],
  operatingHours: { timezone: "America/Lima", weekly: [{ dayOfWeek: 1, opensAt: "08:00", closesAt: "18:00" }] } });
const row: FacilityV2 = { id, organizationId: actor.organizationId, version: 1, value,
  createdAt: "2026-10-04T00:00:00Z", updatedAt: "2026-10-04T00:00:00Z" };
describe("Facility complete contract and application boundary", () => {
  it("rejects an unpaired pin, unknown fields and invalid timezone", () => {
    assert.equal(FacilityInputV2Schema.safeParse({ ...value, location: { ...value.location, lng: null } }).success, false);
    assert.equal(FacilityInputV2Schema.safeParse({ ...value, organizationId: actor.organizationId }).success, false);
    assert.equal(OperatingHoursV2Schema.safeParse({ timezone: "Fake/Lima", weekly: [] }).success, false);
  });
  it("rejects overlapping and overnight openings, allows adjacent intervals", () => {
    const schedule = (weekly: unknown) => OperatingHoursV2Schema.safeParse({ timezone: "America/Lima", weekly }).success;
    assert.equal(schedule([{ dayOfWeek: 1, opensAt: "22:00", closesAt: "06:00" }]), false);
    assert.equal(schedule([{ dayOfWeek: 1, opensAt: "08:00", closesAt: "12:00" },
      { dayOfWeek: 1, opensAt: "11:00", closesAt: "14:00" }]), false);
    assert.equal(schedule([{ dayOfWeek: 1, opensAt: "08:00", closesAt: "12:00" },
      { dayOfWeek: 1, opensAt: "12:00", closesAt: "14:00" }]), true);
  });
  it("never calls persistence on invalid commands and enforces bounded pages", async () => {
    let writes = 0;
    const repository: FacilityRepositoryV2 = { list: async () => [], get: async () => null,
      command: async () => { writes++; return { record: row, replay: false }; } };
    const service = new FacilityServiceV2(repository);
    await assert.rejects(service.create(actor, value, "bad-key"));
    await assert.rejects(service.revise(actor, id, { expectedVersion: 0, value }, id));
    await assert.rejects(service.list(actor, { limit: 101 }));
    assert.equal(writes, 0);
    await assert.rejects(service.get(actor, id), { code: "FACILITY_NOT_FOUND" });
  });
  it("passes the server actor and version, and preserves original replay output", async () => {
    const repository: FacilityRepositoryV2 = { list: async () => [], get: async () => row,
      command: async (actualActor, input) => {
        assert.deepEqual(actualActor, actor); assert.equal(input.id, id);
        assert.equal(input.expectedVersion, 1); assert.deepEqual(input.value, value);
        return { record: row, replay: true };
      } };
    const result = await new FacilityServiceV2(repository).revise(actor, id, { expectedVersion: 1, value }, id);
    assert.equal(result.meta.idempotentReplay, true); assert.equal(result.data.version, 1);
  });
});

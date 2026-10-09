import assert from "node:assert/strict";
import test from "node:test";
import { LocationServiceV2 } from "./location-service";
import { V2DraftError } from "../../freight-requests/application/draft-service";
const actor = { memberId: "c2320000-0000-4000-8000-000000000001", organizationId: "c2300000-0000-4000-8000-000000000001" };
const id = "c2330000-0000-4000-8000-000000000001";
const candidate = { id, kind: "FACILITY", version: 1, location: { facilityId: id, label: "Lima depot",
  countryCode: "PE", region: "Lima", city: "Lima", lat: -12.1, lng: -77.1 },
  source: { reference: `facilities/${id}`, provider: "CARGOMESH_PERSISTED_FACILITY", observedAt: "2026-10-08T00:00:00Z",
    validUntil: null, provenanceStatus: "UNKNOWN" } };
test("location resolution preserves ambiguity and never invents geocoder confidence", async () => {
  for (const [rows, status] of [[[], "NO_MATCH"], [[candidate], "CONFIRMATION_REQUIRED"], [[candidate, candidate], "AMBIGUOUS"]] as const) {
    const service = new LocationServiceV2({ candidates: async () => [...rows] });
    const result = await service.resolve(actor, { query: { kind: "TEXT", text: " Lima " } });
    assert.equal(result.data.status, status); assert.equal(result.data.externalGeocoderUsed, false);
    assert.equal(result.data.confirmationRequired, true);
  }
});
test("location confirmation rechecks authorization, version and explicit consent", async () => {
  let rows = [candidate];
  const service = new LocationServiceV2({ candidates: async () => rows });
  const input = { query: { kind: "TEXT", text: "Lima" }, candidateId: id, candidateKind: "FACILITY", expectedVersion: 1, confirmed: true };
  assert.equal((await service.confirm(actor, input)).data.confirmedByMemberId, actor.memberId);
  await assert.rejects(service.confirm(actor, { ...input, confirmed: false }));
  rows = [{ ...candidate, version: 2 }];
  await assert.rejects(service.confirm(actor, input), e => e instanceof V2DraftError && e.code === "STALE_DRAFT");
  rows = [];
  await assert.rejects(service.confirm(actor, input), e => e instanceof V2DraftError && e.code === "LOCATION_NOT_FOUND");
});
test("coordinate bounds are checked before any repository query", async () => {
  let called = false;
  const service = new LocationServiceV2({ candidates: async () => { called = true; return []; } });
  await assert.rejects(service.resolve(actor, { query: { kind: "COORDINATES", lat: 91, lng: 0 } }));
  assert.equal(called, false);
});

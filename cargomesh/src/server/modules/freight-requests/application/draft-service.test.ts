import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createV2Draft, getV2Draft, hashV2Draft,
  V2DraftError, type DraftInsert, type PersistedV2Draft, type V2DraftRepository,
} from "./draft-service";
import { CreateFreightRequestV2InputSchema } from "@/shared/schemas/v2/freight-request";

const actor = {
  memberId: "b0000000-0000-4000-8000-000000000001",
  organizationId: "a0000000-0000-4000-8000-000000000001",
};
const facilityId = "f0000000-0000-4000-8000-000000000001";
const destinationId = "f0000000-0000-4000-8000-000000000002";
const foreignFacilityId = "f0000000-0000-4000-8000-000000000003";
const key = "10000000-0000-4000-8000-000000000001";
const input = {
  schemaVersion: "2.0", origin: { facilityId, label: "browser assertion", lat: 0, lng: 0 },
  destination: { facilityId: destinationId },
  pickupWindow: { startsAt: "2026-10-05T08:00:00Z", endsAt: "2026-10-05T18:00:00Z" },
  deliveryWindow: { startsAt: "2026-10-07T08:00:00Z", endsAt: "2026-10-07T20:00:00Z" },
  acceptedModes: ["ROAD"], requiredEquipment: "REEFER_TRUCK",
  cargoSpecification: {
    categoryCode: "PHARMA", description: "Vacunas", packaging: "PALLET",
    totalWeightKg: 4800, totalVolumeM3: 19.2, divisible: false,
    requirements: ["TEMP_CONTROLLED"], temperatureRange: { minCelsius: 2, maxCelsius: 8 },
    units: [{ packageType: "PALLET", quantity: 8, weightPerUnitKg: 600, volumePerUnitM3: 2.4,
      dimensionsCm: { length: 120, width: 100, height: 200 }, indivisible: true, stackable: false }],
  },
  contacts: {
    pickup: { name: "Elena", phoneE164: "+51987654321" },
    recipient: { name: "Carlos", phoneE164: "+51912345678" },
  },
  budget: { amount: 3200, currency: "USD" },
};

function fakeRepository(): V2DraftRepository & { writes: DraftInsert[] } {
  const receipts = new Map<string, PersistedV2Draft>();
  const writes: DraftInsert[] = [];
  return {
    writes,
    findCreation: async (_, receiptKey) => receipts.get(receiptKey) ?? null,
    insertAtomically: async (draft) => {
      if (draft.input.origin.facilityId === foreignFacilityId) {
        throw new V2DraftError("FORBIDDEN_TENANT", "Facility belongs to another organization.", 403);
      }
      const existing = receipts.get(draft.idempotencyKey);
      if (existing) return { record: existing, replay: true };
      writes.push(draft);
      const record: PersistedV2Draft = {
        payloadHash: draft.payloadHash,
        data: {
          id: "e0000000-0000-4000-8000-000000000001",
          referenceCode: "CM-V2-e0000000", organizationId: draft.actor.organizationId,
          status: "DRAFT", draftVersion: 1,
          origin: draft.input.origin.facilityId ? {
            facilityId: draft.input.origin.facilityId, label: "Planta Lima",
            countryCode: "PE", region: "Lima", city: "Lima", lat: -12.05, lng: -77.04,
          } : {
            facilityId: null, label: draft.input.origin.label!,
            countryCode: draft.input.origin.countryCode!, region: draft.input.origin.region ?? null,
            city: draft.input.origin.city!, lat: draft.input.origin.lat ?? null, lng: draft.input.origin.lng ?? null,
          },
          destination: {
            facilityId: destinationId, label: "Centro Arequipa",
            countryCode: "PE", region: "Arequipa", city: "Arequipa", lat: -16.4, lng: -71.53,
          },
          pickupWindow: draft.input.pickupWindow, deliveryWindow: draft.input.deliveryWindow,
          acceptedModes: draft.input.acceptedModes,
          requiredEquipment: draft.input.requiredEquipment ?? null,
          cargoSpecification: draft.input.cargoSpecification,
          contacts: draft.input.contacts, budget: draft.input.budget ?? null,
          createdAt: "2026-09-27T00:00:00Z", updatedAt: "2026-09-27T00:00:00Z",
        },
      };
      receipts.set(draft.idempotencyKey, record);
      return { record, replay: false };
    },
    findById: async (_, id) => [...receipts.values()].find((item) => item.data.id === id) ?? null,
  };
}

describe("HAC-12 V2 draft application service", () => {
  it("uses server-side facility coordinates and preserves POST→GET fields", async () => {
    const repo = fakeRepository();
    const created = await createV2Draft(input, key, actor, repo);
    assert.equal(created.meta.idempotentReplay, false);
    assert.equal(created.data.origin.label, "Planta Lima");
    assert.equal(created.data.origin.lat, -12.05);
    assert.equal(created.data.cargoSpecification.units.length, 1);
    assert.equal(created.data.contacts.recipient.name, "Carlos");
    assert.equal(repo.writes[0]?.actor.organizationId, actor.organizationId);
    const read = await getV2Draft(created.data.id, actor, repo);
    assert.deepEqual(read.data, created.data);
  });

  it("replays the same key and rejects a changed payload", async () => {
    const repo = fakeRepository();
    await createV2Draft(input, key, actor, repo);
    const replay = await createV2Draft(input, key, actor, repo);
    assert.equal(replay.meta.idempotentReplay, true);
    assert.equal(repo.writes.length, 1);
    await assert.rejects(() => createV2Draft({ ...input, budget: { amount: 3300, currency: "USD" } }, key, actor, repo),
      { code: "IDEMPOTENCY_CONFLICT", httpStatus: 409 });
  });

  it("rejects a forged tenant before writing and propagates the transactional foreign-facility error", async () => {
    const repo = fakeRepository();
    await assert.rejects(() => createV2Draft({ ...input, organizationId: "a0000000-0000-4000-8000-000000000002" }, key, actor, repo),
      { code: "FORBIDDEN_TENANT", httpStatus: 403 });
    await assert.rejects(() => createV2Draft({ ...input, origin: { facilityId: foreignFacilityId } }, key, actor, repo),
      { code: "FORBIDDEN_TENANT", httpStatus: 403 });
    assert.equal(repo.writes.length, 0);
  });

  it("round-trips manual pins as user assertions without creating a facility", async () => {
    const repo = fakeRepository();
    const created = await createV2Draft({
      ...input, origin: { label: "Punto manual", countryCode: "PE", city: "Piura", lat: -5.2, lng: -80.6 },
    }, key, actor, repo);
    assert.equal(created.data.origin.facilityId, null);
    assert.equal(created.data.origin.lat, -5.2);
    assert.equal(created.data.origin.lng, -80.6);
  });

  it("hashes parsed DTOs independently of JSON object key order", () => {
    const parsed = CreateFreightRequestV2InputSchema.parse(input);
    assert.equal(hashV2Draft(parsed), hashV2Draft({ ...parsed, destination: parsed.destination, origin: parsed.origin }));
  });
});

import assert from "node:assert/strict";
import test from "node:test";
import { bookingStatusPresentation, executionActionLabel, requestStatusLabel, requestToRevisionInput } from "./shipper-model";
import type { FreightRequestV2Data } from "@/features/v2-intake/contracts";

const request = {
  id: "10000000-0000-4000-8000-000000000001", referenceCode: "FR-V2-1",
  organizationId: "10000000-0000-4000-8000-000000000002", status: "DRAFT", draftVersion: 3,
  origin: { facilityId: null, label: "Lima", countryCode: "PE", region: "Lima", city: "Lima", lat: -12, lng: -77 },
  destination: { facilityId: null, label: "Arequipa", countryCode: "PE", region: "Arequipa", city: "Arequipa", lat: -16, lng: -71 },
  pickupWindow: { startsAt: "2026-10-12T10:00:00.000Z", endsAt: "2026-10-12T12:00:00.000Z" },
  deliveryWindow: { startsAt: "2026-10-13T10:00:00.000Z", endsAt: "2026-10-13T12:00:00.000Z" },
  acceptedModes: ["ROAD"], serviceType: "FTL", selectionObjective: "WEIGHTED",
  preferredEquipment: null, requiredEquipment: "TRACTOR_SEMITRAILER", budget: null,
  cargoSpecification: { categoryCode: "GENERAL", description: "Carga", packaging: "PALLET", totalWeightKg: 1000,
    totalVolumeM3: 2, divisible: true, requirements: [], availableDocuments: [], units: [{ packageType: "PALLET", quantity: 1,
      weightPerUnitKg: 1000, volumePerUnitM3: 2, dimensionsCm: { length: 120, width: 100, height: 160 }, indivisible: false, stackable: true }] },
  contacts: { pickup: { name: "Ana", phoneE164: "+51999999999" }, recipient: { name: "Luis", phoneE164: "+51988888888" } },
  createdAt: "2026-10-10T00:00:00.000Z", updatedAt: "2026-10-10T00:00:00.000Z",
} satisfies FreightRequestV2Data;

test("revision input preserves business fields and removes persisted metadata", () => {
  const value = requestToRevisionInput(request);
  assert.equal(value.schemaVersion, "2.0");
  assert.equal(value.origin.label, "Lima");
  assert.equal(value.requiredEquipment, null, "a legacy or unknown code must not be re-submitted as a valid DTO code");
  assert.equal("id" in value, false);
  assert.equal("draftVersion" in value, false);
});

test("status labels are localized", () => {
  assert.equal(requestStatusLabel("AWAITING_SELECTION", "es"), "Esperando selección");
  assert.equal(requestStatusLabel("BOOKED", "en"), "Booked");
});

test("booking outcomes distinguish pending, confirmed, rejected and cancelled without auto-rebooking", () => {
  assert.equal(bookingStatusPresentation("PENDING", "es").tone, "pending");
  assert.equal(bookingStatusPresentation("CONFIRMED", "en").label, "Carrier confirmed");
  assert.equal(bookingStatusPresentation("REJECTED", "es").label, "Rechazada por carrier");
  assert.match(bookingStatusPresentation("REJECTED", "en").consequence, /new decision and authorization/);
  assert.match(bookingStatusPresentation("CANCELLED", "en").consequence, /No replacement booking/);
});

test("physical event action has a comprehensible bilingual label", () => {
  assert.equal(executionActionLabel("executions.position", "es"), "Posición reportada");
  assert.equal(executionActionLabel("executions.cancel", "en"), "Execution cancelled");
});

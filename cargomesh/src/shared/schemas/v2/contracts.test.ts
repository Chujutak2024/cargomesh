import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CreateFreightRequestV2InputSchema, FreightRequestV2ResponseSchema } from "./freight-request";
import { RoadRoutePreviewV2Schema, RoadServiceabilityEvaluationV2ResponseSchema } from "./serviceability";

const facilityId = "11111111-2222-4333-8444-555555555555";
const request = {
  schemaVersion: "2.0",
  origin: { facilityId },
  destination: { facilityId: "66666666-7777-4888-8999-000000000000" },
  pickupWindow: { startsAt: "2026-10-05T08:00:00Z", endsAt: "2026-10-05T18:00:00Z" },
  deliveryWindow: { startsAt: "2026-10-07T08:00:00Z", endsAt: "2026-10-07T20:00:00Z" },
  acceptedModes: ["ROAD"],
  requiredEquipment: "REEFER_TRUCK",
  cargoSpecification: {
    categoryCode: "PHARMA", description: "Vacunas", packaging: "PALLET",
    totalWeightKg: 4800, totalVolumeM3: 19.2, divisible: false,
    requirements: ["TEMP_CONTROLLED"], temperatureRange: { minCelsius: 2, maxCelsius: 8 },
    units: [{
      packageType: "PALLET", quantity: 8, weightPerUnitKg: 600, volumePerUnitM3: 2.4,
      dimensionsCm: { length: 120, width: 100, height: 200 }, indivisible: true, stackable: false,
    }],
  },
  contacts: {
    pickup: { name: "Elena", phoneE164: "+51987654321" },
    recipient: { name: "Carlos", phoneE164: "+51912345678" },
  },
  budget: { amount: 3200, currency: "USD" },
};

describe("HAC-12 V2 DTOs", () => {
  it("normalizes absent documents on reads without changing legacy creation fingerprints", () => {
    const input = CreateFreightRequestV2InputSchema.parse(request);
    assert.equal(Object.hasOwn(input.cargoSpecification, "availableDocuments"), false);
    const output = FreightRequestV2ResponseSchema.shape.data.shape.cargoSpecification.parse(input.cargoSpecification);
    assert.deepEqual(output.availableDocuments, []);
    assert.equal(Object.hasOwn(input.cargoSpecification, "availableDocuments"), false);
  });
  it("accepts a minimal facility-based ROAD draft without trusting browser coordinates", () => {
    const result = CreateFreightRequestV2InputSchema.parse(request);
    assert.deepEqual(result.origin, { facilityId });
  });

  it("rejects quantity, weight and volume totals that contradict the units", () => {
    for (const patch of [
      { units: [{ ...request.cargoSpecification.units[0]!, quantity: 100 }] },
      { totalWeightKg: 4799 }, { totalVolumeM3: 19.1 },
    ]) {
      assert.equal(CreateFreightRequestV2InputSchema.safeParse({ ...request,
        cargoSpecification: { ...request.cargoSpecification, ...patch } }).success, false);
    }
  });

  it("rejects malformed embedded units, contacts and windows before transport", () => {
    for (const mutate of [
      (value: Record<string, any>) => delete value.cargoSpecification.units[0].dimensionsCm,
      (value: Record<string, any>) => delete value.cargoSpecification.units[0].indivisible,
      (value: Record<string, any>) => { value.cargoSpecification.units[0].stackable = "true"; },
      (value: Record<string, any>) => { value.contacts.pickup.phoneE164 = "123"; },
      (value: Record<string, any>) => { value.contacts.recipient.email = "invalid"; },
      (value: Record<string, any>) => delete value.pickupWindow.startsAt,
    ]) {
      const malformed = structuredClone(request);
      mutate(malformed);
      assert.equal(CreateFreightRequestV2InputSchema.safeParse(malformed).success, false);
    }
    assert.equal(CreateFreightRequestV2InputSchema.safeParse(request).success, true);
  });

  it("sums multiple unit groups and accepts only numeric rounding tolerance", () => {
    const cargo = { ...request.cargoSpecification,
      units: [{ ...request.cargoSpecification.units[0]!, quantity: 3 },
        { ...request.cargoSpecification.units[0]!, quantity: 5 }] };
    assert.equal(CreateFreightRequestV2InputSchema.safeParse({ ...request,
      cargoSpecification: cargo }).success, true);
    cargo.totalWeightKg -= 5e-7;
    assert.equal(CreateFreightRequestV2InputSchema.safeParse({ ...request,
      cargoSpecification: cargo }).success, true);
    cargo.totalWeightKg -= 1e-4;
    assert.equal(CreateFreightRequestV2InputSchema.safeParse({ ...request,
      cargoSpecification: cargo }).success, false);
  });

  it("preserves complete manual coordinate pairs and rejects partial pairs", () => {
    const manual = { label: "Manual Lima", countryCode: "PE", city: "Lima", lat: -12.0464, lng: -77.1181 };
    const parsed = CreateFreightRequestV2InputSchema.parse({ ...request, origin: manual });
    assert.equal(parsed.origin.lat, manual.lat);
    assert.equal(CreateFreightRequestV2InputSchema.safeParse({ ...request,
      origin: { ...manual, lng: undefined } }).success, false);
  });

  it("does not accept PEN, unknown modes or contradictory coordinate shape", () => {
    assert.equal(CreateFreightRequestV2InputSchema.safeParse({ ...request, budget: { amount: 100, currency: "PEN" } }).success, false);
    assert.equal(CreateFreightRequestV2InputSchema.safeParse({ ...request, acceptedModes: ["SPACE"] }).success, false);
    assert.equal(CreateFreightRequestV2InputSchema.safeParse({ ...request, origin: { facilityId, lat: -12 } }).success, false);
  });

  it("accepts declared modes and LTL with full cargo/contact attributes, without multiplying package content twice", () => {
    const value = CreateFreightRequestV2InputSchema.parse({ ...request, acceptedModes: ["ROAD", "SEA"],
      serviceType: "LTL", selectionObjective: "LOWEST_COST", preferredEquipment: "ISO_CONTAINER",
      cargoSpecification: { ...request.cargoSpecification,
        units: request.cargoSpecification.units.map((unit) => ({ ...unit, unitsPerPackage: 12 })),
        availableDocuments: [{ code: "MSDS", reference: "document:1", issuedAt: null, validUntil: null }] },
      contacts: { ...request.contacts, recipient: { ...request.contacts.recipient,
        company: "Consignee", addressDetail: "Gate 2", handlingInstructions: "Call before delivery" } } });
    assert.equal(value.serviceType, "LTL");
    assert.equal(value.cargoSpecification.totalWeightKg, 4800);
    assert.equal(value.contacts.recipient.company, "Consignee");
    assert.equal(CreateFreightRequestV2InputSchema.safeParse({ ...request, acceptedModes: ["ROAD", "ROAD"] }).success, false);
    assert.equal(CreateFreightRequestV2InputSchema.safeParse({ ...request, serviceType: "PARCEL" }).success, false);
  });

  it("rejects invalid package contents and document validity", () => {
    assert.equal(CreateFreightRequestV2InputSchema.safeParse({ ...request, cargoSpecification: {
      ...request.cargoSpecification, units: [{ ...request.cargoSpecification.units[0], unitsPerPackage: 0 }] } }).success, false);
    assert.equal(CreateFreightRequestV2InputSchema.safeParse({ ...request, cargoSpecification: {
      ...request.cargoSpecification, availableDocuments: [{ code: "MSDS", reference: "doc",
        issuedAt: "2026-10-05T00:00:00Z", validUntil: "2026-10-04T00:00:00Z" }] } }).success, false);
  });

  it("rejects incomplete manual locations and inverted windows", () => {
    assert.equal(CreateFreightRequestV2InputSchema.safeParse({ ...request, origin: { city: "Lima" } }).success, false);
    assert.equal(CreateFreightRequestV2InputSchema.safeParse({
      ...request, pickupWindow: { startsAt: "2026-10-05T18:00:00Z", endsAt: "2026-10-05T08:00:00Z" },
    }).success, false);
  });

  it("accepts zero candidates as a successful ineligible evaluation", () => {
    const result = RoadServiceabilityEvaluationV2ResponseSchema.parse({
      schemaVersion: "2.0",
      data: {
        freightRequestId: facilityId, evaluatedDraftVersion: 1,
        evaluatedAt: "2026-10-05T08:00:00Z", overallStatus: "ineligible",
        summaryCounts: { totalEvaluated: 0, eligibleCount: 0, unknownCount: 0, ineligibleCount: 0 },
        commercialNotice: "EVALUATION_ONLY_NO_OFFER_OR_BOOKING", candidates: [],
      },
    });
    assert.deepEqual(result.data.candidates, []);
  });

  it("does not accept invented geometry when provenance is UNKNOWN", () => {
    const result = RoadRoutePreviewV2Schema.safeParse({
      corridorCode: null, distanceKm: null, estimatedTransitHours: null,
      geometrySource: "NONE_UNVERIFIED", provenanceStatus: "UNKNOWN",
      legs: [{
        sequence: 1, mode: "ROAD", originLabel: "Lima", destinationLabel: "Arequipa",
        waypoints: [{ lat: -12, lng: -77 }], conditions: [],
      }],
    });
    assert.equal(result.success, false);
  });
});

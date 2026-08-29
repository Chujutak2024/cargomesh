import assert from "node:assert/strict";
import test from "node:test";

import {
  selectCandidateProviders,
  type CarrierForMatching,
  type FreightRequestForMatching,
} from "./candidate-matcher";

const freightRequest: FreightRequestForMatching = {
  cargoCategoryId: "food",
  originCountry: "PE",
  destinationCountry: "CL",
  cargoWeightKg: 1000,
  cargoVolumeM3: 5,
  crossBorder: true,
};

function carrier(overrides: Partial<CarrierForMatching> = {}): CarrierForMatching {
  return {
    id: "carrier-1",
    code: "TEST_CARRIER",
    displayName: "Test Carrier",
    providerUrl: "http://localhost:3000/providers/test-carrier",
    active: true,
    supportsWebMcp: true,
    services: [{
      id: "service-1",
      originCountry: "PE",
      destinationCountry: "CL",
      maxCapacityKg: 2000,
      maxVolumeM3: 10,
      supportsCrossBorder: true,
      active: true,
      cargoCategoryIds: ["food"],
    }],
    ...overrides,
  };
}

test("returns zero candidates when every carrier is incompatible or unavailable", () => {
  const candidates = selectCandidateProviders(freightRequest, [
    carrier({ active: false }),
    carrier({ id: "carrier-2", supportsWebMcp: false }),
    carrier({ id: "carrier-3", services: [{ ...carrier().services[0], id: "service-3", cargoCategoryIds: ["fragile"] }] }),
  ]);

  assert.deepEqual(candidates, []);
});

test("returns one candidate without commercial quote fields", () => {
  const candidates = selectCandidateProviders(freightRequest, [carrier()]);

  assert.equal(candidates.length, 1);
  assert.deepEqual(candidates[0], {
    carrierId: "carrier-1",
    carrierCode: "TEST_CARRIER",
    displayName: "Test Carrier",
    providerUrl: "http://localhost:3000/providers/test-carrier",
    matchingServiceId: "service-1",
  });
  assert.equal("price" in candidates[0], false);
  assert.equal("transitHours" in candidates[0], false);
});

test("returns multiple compatible carriers and excludes insufficient volume capacity", () => {
  const candidates = selectCandidateProviders(freightRequest, [
    carrier(),
    carrier({ id: "carrier-2", code: "SECOND", displayName: "Second Carrier" }),
    carrier({ id: "carrier-3", services: [{ ...carrier().services[0], id: "service-3", maxVolumeM3: 4 }] }),
  ]);

  assert.deepEqual(candidates.map((candidate) => candidate.carrierId), ["carrier-1", "carrier-2"]);
});

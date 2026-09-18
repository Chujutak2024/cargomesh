import assert from "node:assert/strict";
import test from "node:test";

import {
  isNavigableProviderUrl,
  selectCandidateProviders,
  type CarrierForMatching,
  type FreightRequestForMatching,
} from "./candidate-matcher";
import { buildProviderNavigationUrl } from "./provider-navigation";

const freightRequest: FreightRequestForMatching = {
  cargoCategoryId: "food",
  originCountry: "PE",
  originRegion: "Callao",
  destinationCountry: "CL",
  destinationRegion: "Santiago",
  cargoWeightKg: 1000,
  cargoVolumeM3: 5,
  crossBorder: true,
  transportMode: "ROAD",
  serviceType: "FTL",
  requiresRefrigeration: false,
  temperatureMinC: null,
  temperatureMaxC: null,
  isHazardous: false,
  isFragile: false,
  isOversized: false,
};

function service(overrides: Partial<CarrierForMatching["services"][number]> = {}) {
  return {
    id: "service-1",
    originCountry: "PE",
    originRegion: null,
    destinationCountry: "CL",
    destinationRegion: null,
    transportMode: "ROAD",
    serviceType: "FTL",
    maxCapacityKg: 2000,
    maxVolumeM3: 10,
    supportsCrossBorder: true,
    supportsRefrigerated: true,
    temperatureMinC: -20,
    temperatureMaxC: 20,
    supportsHazardous: true,
    supportsFragile: true,
    supportsOversized: true,
    active: true,
    cargoCategoryIds: ["food"],
    ...overrides,
  };
}

function carrier(overrides: Partial<CarrierForMatching> = {}): CarrierForMatching {
  return {
    id: "carrier-1",
    code: "TEST_CARRIER",
    displayName: "Test Carrier",
    providerUrl: "https://carrier.example/providers/test-carrier",
    active: true,
    supportsWebMcp: true,
    services: [service()],
    ...overrides,
  };
}

function discover(
  requestOverrides: Partial<FreightRequestForMatching> = {},
  carriers: CarrierForMatching[] = [carrier()],
) {
  return selectCandidateProviders({ ...freightRequest, ...requestOverrides }, carriers);
}

test("returns zero candidates when every carrier is incompatible or unavailable", () => {
  const candidates = discover({}, [
    carrier({ active: false }),
    carrier({ id: "carrier-2", supportsWebMcp: false }),
    carrier({ id: "carrier-3", services: [service({ cargoCategoryIds: ["fragile"] })] }),
  ]);

  assert.deepEqual(candidates, []);
});

test("returns one candidate without commercial quote fields", () => {
  const candidates = discover();

  assert.equal(candidates.length, 1);
  assert.deepEqual(candidates[0], {
    carrierId: "carrier-1",
    carrierCode: "TEST_CARRIER",
    displayName: "Test Carrier",
    providerUrl: "https://carrier.example/providers/test-carrier",
    matchingServiceId: "service-1",
  });

  for (const commercialField of ["price", "transitHours", "availability", "quote", "estimatedDelivery"]) {
    assert.equal(commercialField in candidates[0], false);
  }
});

test("returns N compatible candidates", () => {
  const candidates = discover({}, [
    carrier(),
    carrier({ id: "carrier-2", code: "SECOND", displayName: "Second Carrier" }),
    carrier({ id: "carrier-3", code: "THIRD", displayName: "Third Carrier" }),
  ]);

  assert.deepEqual(candidates.map((candidate) => candidate.carrierId), ["carrier-1", "carrier-2", "carrier-3"]);
});

test("rejects incompatible transport mode and service type", () => {
  assert.deepEqual(discover({}, [carrier({ services: [service({ transportMode: "AIR" })] })]), []);
  assert.deepEqual(discover({}, [carrier({ services: [service({ serviceType: "LTL" })] })]), []);
});

test("rejects unsupported refrigeration and temperatures outside service range", () => {
  const refrigerated = { requiresRefrigeration: true, temperatureMinC: 2, temperatureMaxC: 8 };

  assert.deepEqual(discover(refrigerated, [carrier({ services: [service({ supportsRefrigerated: false })] })]), []);
  assert.deepEqual(discover(refrigerated, [carrier({ services: [service({ temperatureMinC: 4, temperatureMaxC: 6 })] })]), []);
});

test("rejects dangerous, fragile and oversized cargo when the service lacks support", () => {
  assert.deepEqual(discover({ isHazardous: true }, [carrier({ services: [service({ supportsHazardous: false })] })]), []);
  assert.deepEqual(discover({ isFragile: true }, [carrier({ services: [service({ supportsFragile: false })] })]), []);
  assert.deepEqual(discover({ isOversized: true }, [carrier({ services: [service({ supportsOversized: false })] })]), []);
});

test("treats null service regions as wildcards and rejects a defined incompatible region", () => {
  assert.equal(discover({}, [carrier({ services: [service({ originRegion: null, destinationRegion: null })] })]).length, 1);
  assert.deepEqual(discover({}, [carrier({ services: [service({ originRegion: "Lima" })] })]), []);
});

test("accepts only safe internal provider routes or absolute HTTP(S) URLs", () => {
  for (const providerUrl of [
    "",
    "  ",
    "providers/carrier",
    "/requests/new",
    "/providers/",
    "//evil.example/providers/carrier",
    "javascript:alert(1)",
    "data:text/plain,nope",
  ]) {
    assert.equal(isNavigableProviderUrl(providerUrl), false);
    assert.deepEqual(discover({}, [carrier({ providerUrl })]), []);
  }

  assert.equal(isNavigableProviderUrl("/providers/registered-carrier"), true);
  assert.equal(isNavigableProviderUrl("https://carrier.example/providers/registered-carrier"), true);
});

test("accepts every Golden Flow provider path as data, without carrier-specific matching", () => {
  const goldenFlowProviderUrls = ["/providers/andes", "/providers/inca", "/providers/pacific"];
  const candidates = discover({}, goldenFlowProviderUrls.map((providerUrl, index) => carrier({
    id: `carrier-${index + 1}`,
    code: `GOLDEN_${index + 1}`,
    displayName: `Golden provider ${index + 1}`,
    providerUrl,
    services: [service({ id: `service-${index + 1}` })],
  })));

  assert.deepEqual(candidates.map((candidate) => candidate.providerUrl), goldenFlowProviderUrls);
  assert.deepEqual(
    candidates.map((candidate) =>
      buildProviderNavigationUrl(candidate, "https://cargomesh.example"),
    ),
    [
      "https://cargomesh.example/providers/andes?serviceId=service-1",
      "https://cargomesh.example/providers/inca?serviceId=service-2",
      "https://cargomesh.example/providers/pacific?serviceId=service-3",
    ],
  );
});

test("selects the actually compatible service and preserves matchingServiceId for navigation", () => {
  const candidates = discover({}, [carrier({
    services: [
      service({ id: "service-a", transportMode: "AIR" }),
      service({ id: "service-b", originRegion: "Callao", destinationRegion: "Santiago" }),
    ],
  })]);

  assert.equal(candidates[0]?.matchingServiceId, "service-b");
  const navigationUrl = new URL(
    buildProviderNavigationUrl(candidates[0]!, "https://cargomesh.example"),
  );
  assert.equal(navigationUrl.searchParams.get("serviceId"), "service-b");
});

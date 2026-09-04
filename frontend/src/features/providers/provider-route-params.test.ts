import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { buildProviderNavigationUrl } from "@/features/discovery/provider-navigation";

import {
  buildCanonicalDemoProviderHref,
  CANONICAL_DEMO_PROVIDER_SERVICE_IDS,
  getProviderServiceId,
  isProviderServiceId,
} from "./provider-route-params";

const seededServiceId = "d0000000-0000-0000-0000-000000000001";

test("accepts the PostgreSQL UUID format used by seeded carrier services", () => {
  assert.equal(isProviderServiceId(seededServiceId), true);
  assert.equal(getProviderServiceId({ serviceId: seededServiceId }), seededServiceId);
});

test("rejects missing, repeated, empty and malformed serviceId values", () => {
  for (const serviceId of [
    undefined,
    "",
    "not-a-uuid",
    `${seededServiceId} `,
    [seededServiceId],
    [seededServiceId, "d0000000-0000-0000-0000-000000000002"],
  ]) {
    assert.equal(getProviderServiceId({ serviceId }), null);
  }
});

test("accepts the matchingServiceId attached by provider discovery navigation", () => {
  const navigationUrl = new URL(buildProviderNavigationUrl({
    carrierId: "b0000000-0000-0000-0000-000000000001",
    carrierCode: "REGISTERED_CARRIER",
    displayName: "Registered carrier",
    providerUrl: "/providers/registered-carrier",
    matchingServiceId: seededServiceId,
  }, "https://cargomesh.example"));

  assert.equal(
    getProviderServiceId({
      serviceId: navigationUrl.searchParams.get("serviceId") ?? undefined,
    }),
    seededServiceId,
  );
});

test("builds canonical same-origin demo links without weakening dynamic discovery", () => {
  const cases = [
    ["andes", "/providers/andes?serviceId=40000000-0000-0000-0000-000000000001"],
    ["inca", "/providers/inca?serviceId=40000000-0000-0000-0000-000000000002"],
    ["pacific", "/providers/pacific?serviceId=40000000-0000-0000-0000-000000000003"],
  ] as const;

  for (const [slug, expectedHref] of cases) {
    assert.equal(buildCanonicalDemoProviderHref(slug), expectedHref);
    assert.equal(
      new URL(expectedHref, "https://cargomesh.vercel.app").searchParams.get("serviceId"),
      CANONICAL_DEMO_PROVIDER_SERVICE_IDS[slug],
    );
  }
});

test("provider config requires one exact service and has no first-service fallback", () => {
  const source = readFileSync(new URL("./get-provider-page-config.ts", import.meta.url), "utf8");

  assert.match(source, /!isProviderServiceId\(serviceId\)/);
  assert.match(source, /\.eq\("id", serviceId\)/);
  assert.match(source, /\.eq\("carrier_id", carrier\.id\)/);
  assert.doesNotMatch(source, /CANONICAL_PROVIDER_CONFIGS/);
  assert.doesNotMatch(source, /\.order\("created_at"/);
  assert.doesNotMatch(source, /\.limit\(1\)/);
});

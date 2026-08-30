import assert from "node:assert/strict";
import test from "node:test";

import { buildProviderNavigationUrl } from "@/features/discovery/provider-navigation";

import {
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

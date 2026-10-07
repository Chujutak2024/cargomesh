import assert from "node:assert/strict";
import test from "node:test";
import { MCP_CAPABILITY_CATALOG, capabilityReport, implementedCapabilities, parseMcpCapabilityProfile } from "./capabilities";

test("V1 regression profile preserves all four historical tools with explicit legacy metadata", () => {
  assert.deepEqual(
    implementedCapabilities("V1_REGRESSION").map((item) => item.toolName),
    ["create_freight_request", "submit_freight_request", "find_freight_options", "get_freight_options"],
  );
  assert.equal(
    MCP_CAPABILITY_CATALOG.find((item) => item.toolName === "find_freight_options" && item.profile === "V1_REGRESSION")?.legacyDependency,
    "V1_WEBMCP",
  );
});

test("V2 profile exposes only shared-service draft and ROAD tools, never V1 offers or booking", () => {
  assert.deepEqual(implementedCapabilities("V2").map((item) => item.toolName), [
    "get_cargomesh_capabilities", "get_v2_intake_options", "create_v2_freight_request", "get_v2_freight_request", "evaluate_v2_road",
  ]);
  const listed = MCP_CAPABILITY_CATALOG.filter((item) => item.profile === "V2");
  assert.ok(listed.every((item) => item.status === "IMPLEMENTED" && item.legacyDependency === "NONE"));
  assert.deepEqual(capabilityReport("V2").blockedBy, [
    "V2_OFFER_SERVICE", "V2_BOOKING_SERVICE", "HAC33_LOCATION_RESOLUTION",
  ]);
  assert.equal(parseMcpCapabilityProfile("V2"), "V2");
  assert.equal(parseMcpCapabilityProfile("v2"), null);
});

import assert from "node:assert/strict";
import test from "node:test";
import { MCP_CAPABILITY_CATALOG, implementedCapabilities, parseMcpCapabilityProfile } from "./capabilities";

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

test("V2 profile exposes no business tool before the HAC-21 contracts exist", () => {
  assert.deepEqual(implementedCapabilities("V2").map((item) => item.toolName), ["get_cargomesh_capabilities"]);
  const blocked = MCP_CAPABILITY_CATALOG.filter((item) => item.profile === "V2");
  assert.deepEqual(blocked.map((item) => item.status), ["IMPLEMENTED", "BLOCKED", "BLOCKED"]);
  assert.deepEqual(blocked.map((item) => item.blockedBy), ["NONE", "HAC-21", "HAC-21"]);
  assert.equal(parseMcpCapabilityProfile("V2"), "V2");
  assert.equal(parseMcpCapabilityProfile("v2"), null);
});

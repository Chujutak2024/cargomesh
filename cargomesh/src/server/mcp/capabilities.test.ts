import assert from "node:assert/strict";
import test from "node:test";
import { capabilityReport, parseMcpCapabilityProfile, implementedCapabilities } from "./capabilities";
test("only V2 is selectable as runtime profile", () => {
  assert.equal(parseMcpCapabilityProfile("V2"), "V2");
  assert.equal(parseMcpCapabilityProfile("V1_REGRESSION"), null);
});
test("V2 capabilities are truthful and lack legacy dependencies", () => {
  const report = capabilityReport("V2");
  assert.equal(report.status, "PARTIAL");
  assert.ok(report.blockedBy.includes("V2_COMMERCIAL_MCP_TOOLS"));
  assert.ok(implementedCapabilities("V2").every(tool => tool.profile === "V2" && tool.legacyDependency === "NONE"));
});

import test from "node:test";
import assert from "node:assert/strict";
import { CARRIER_WORKSPACE_ENTRY, CARRIER_LOGIN_PATH, loginDestination, safeLoginReturnTo } from "./carrier-portal";
const access = [{ carrierId:"00000000-0000-4000-8000-000000000001",operatorId:"00000000-0000-4000-8000-000000000002",role:"ADMIN" as const,carrierName:"Synthetic",displayName:"Admin" }];
test("legacy and explicit carrier entries resolve directly to the full fleet workspace", () => {
  for (const preferred of ["/carrier-portal", CARRIER_WORKSPACE_ENTRY, "/v2-workspace", undefined]) {
    assert.equal(loginDestination(preferred, false, access), CARRIER_WORKSPACE_ENTRY);
  }
  assert.equal(new URL(CARRIER_LOGIN_PATH, "https://app.example").searchParams.get("returnTo"), CARRIER_WORKSPACE_ENTRY);
});
test("explicit carrier entry always requires a carrier grant, even for a shipper member", () => {
  for (const preferred of ["/carrier-portal", CARRIER_WORKSPACE_ENTRY]) assert.equal(loginDestination(preferred, true, []), null);
  assert.equal(loginDestination("/dashboard", true, []), "/dashboard");
  assert.equal(loginDestination(undefined, false, []), null);
});
test("closed return-path whitelist rejects external origins and arbitrary fragments", () => {
  assert.equal(safeLoginReturnTo(CARRIER_WORKSPACE_ENTRY), CARRIER_WORKSPACE_ENTRY);
  for (const path of ["https://evil.example", "//evil.example", "/v2-workspace#https://evil.example", "/v2-workspace#/unknown", "/login", "/api/auth/logout"]) assert.equal(safeLoginReturnTo(path), undefined);
});

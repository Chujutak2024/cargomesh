import assert from "node:assert/strict";
import test from "node:test";
import { displayDemoText, isHiddenClientFacility, retainOriginalDisplayText } from "./demo-presentation";
import { dashboardRequests } from "@/features/shipper-portal/client-dashboard-model";
import type { FreightRequestV2Data } from "@/features/v2-intake/contracts";

test("presentation removes repeated fixture markers without losing the actual cargo or address", () => {
  assert.equal(displayDemoText("[SYNTHETIC] Pacific Produce"), "Pacific Produce");
  assert.equal(displayDemoText("[SIMULATED] boxed goods [SYNTHETIC] fragile"), "boxed goods fragile");
  assert.equal(displayDemoText("[synthetic] Lima pickup warehouse"), "Lima pickup warehouse");
  assert.equal(displayDemoText("Synthetic resin, keep dry [HAZARDOUS]"), "Synthetic resin, keep dry [HAZARDOUS]");
});

test("only the two C01 fixtures are hidden, while other synthetic and real facilities remain discoverable", () => {
  const fixtures = ["C01_SIM_V1_A", "C01_SIM_V1_B", "PE_LIMA", "HAC52_CL_SANTIAGO", "C02_SITE"];
  assert.deepEqual(fixtures.filter(code => !isHiddenClientFacility(code)), fixtures.slice(2));
  assert.equal(isHiddenClientFacility("renamed", "ec63f447-95ab-46ca-85c1-e9b8953ed475"), true);
  assert.equal(isHiddenClientFacility("C01_SIM_V1_A_NEW"), false);
});

test("an unrelated edit preserves the original name and address, while an explicit rename is retained", () => {
  const original = "[SYNTHETIC] Lima pickup warehouse";
  assert.equal(retainOriginalDisplayText(displayDemoText(original), original), original);
  assert.equal(retainOriginalDisplayText("New warehouse", original), "New warehouse");
});

test("dashboard display cleans labels while preserving persisted identity, status, dates and the source payload", () => {
  const request = {id:"test-request",referenceCode:"PED-6084",status:"PENDING",updatedAt:"2026-10-23T12:00:00Z",
    origin:{city:"Lima",label:"[SYNTHETIC] Lima pickup warehouse"},destination:{city:"Arequipa",label:"[SYNTHETIC] Arequipa distribution center"},
    cargoSpecification:{description:"[SIMULATED] Packaged household goods",totalWeightKg:1200,totalVolumeM3:10}} as FreightRequestV2Data;
  const before = JSON.stringify(request), result = dashboardRequests([request], "en").recent[0];
  assert.equal(result.id, request.id); assert.equal(result.status,request.status);
  assert.equal(result.description,"Packaged household goods");
  assert.equal(result.facilities,"Lima pickup warehouse → Arequipa distribution center");
  assert.equal(JSON.stringify(request), before);
});

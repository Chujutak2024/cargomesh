import assert from "node:assert/strict";
import { test } from "node:test";
import { contract } from "./http_contract.ts";

async function category(version: any, envelope: any = 7, http = 200) {
  const outputs: Record<string, any> = {};
  await contract({
    CARRIER: "carrier", SERVICE: "service", clone: structuredClone, roundtrips: [], records: {},
    refs: { asset: { value: { roadVehicle: {} } }, request: { id: "request" }, route: { id: "route" },
      calendar: { id: "calendar" }, execution: { data: { plannedWindow: {} } } },
    fixture: { depots: {} }, output: (name: string, value: any) => { outputs[name] = value; },
    call: async (label: string, _path: string, _body: any, _key: any, _actor: any, expected: number) => {
      if (label === "category-version-read-control") return { http, response: { data: [{
        version: envelope, value: { code: "HAC44_API_CATEGORY", version },
      }] } };
      return { http: expected, response: { data: { id: label } } };
    },
  });
  return outputs["category-version-result.json"];
}

async function positive() {
  const result = await category("7");
  assert.equal(result.status, "PASS");
  assert.equal(result.actualVersion, "7");
  assert.equal(result.actualVersionType, "string");
  assert.equal(result.envelopeVersion, 7);
}

test("numeric technical revision with string domain version passes", positive);

test("string envelope cannot hide a numeric domain version", async () => {
  await positive();
  assert.equal((await category(7, "7")).status, "FAIL");
});

test("missing or invalid domain version is never PASS", async () => {
  await positive();
  for (const value of [undefined, null, "", "0", "1.5", "invalid"])
    assert.equal((await category(value)).status, "FAIL");
});

test("domain projection must match the technical revision", async () => {
  await positive();
  assert.equal((await category("8", 7)).status, "FAIL");
});

test("failed authenticated read blocks version certification", async () => {
  await positive();
  assert.equal((await category("7", 7, 500)).status, "BLOQUEADO");
});

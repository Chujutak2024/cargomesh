import assert from "node:assert/strict";
import { test } from "node:test";
import { contract, planCardinality, arrayReadProjection } from "./http_contract.ts";

async function category(version: any, envelope: any = 7, http = 200) {
  const outputs: Record<string, any> = {};
  await contract({
    CARRIER: "carrier", SERVICE: "service", clone: structuredClone, roundtrips: [], records: {},
    refs: { asset: { value: { roadVehicle: {} } }, request: { id: "request" }, route: { id: "route" },
      calendar: { id: "calendar" }, execution: { data: { plannedWindow: { startsAt: "2026-01-01T00:00:00Z", endsAt: "2026-01-02T00:00:00Z" } } } },
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

function plans() {
  const first = { http: 201, response: { data: { id: "plan-a", data: { routeId: "route-a" } } } };
  const second = { http: 201, response: { data: { id: "plan-b", data: { routeId: "route-b" } } } };
  const replay = { ...structuredClone(first), http: 200 };
  const conflict = { http: 409 };
  assert.equal(planCardinality(first, second, replay, conflict).status, "PASS");
  return { first, second, replay, conflict };
}

test("second valid plan owns a different route snapshot", () => { plans(); });
test("a shared snapshot or plan ID remains FAIL", () => {
  const { first, second, replay, conflict } = plans();
  second.response.data.data.routeId = "route-a";
  assert.equal(planCardinality(first, second, replay, conflict).status, "FAIL");
  second.response.data.data.routeId = "route-b";
  second.response.data.id = "plan-a";
  assert.equal(planCardinality(first, second, replay, conflict).status, "FAIL");
});
test("missing IDs and replay drift never pass", () => {
  const { first, second, replay, conflict } = plans();
  delete (second.response.data.data as any).routeId;
  assert.equal(planCardinality(first, second, replay, conflict).status, "FAIL");
  second.response.data.data.routeId = "route-b";
  replay.response.data.id = "another-plan";
  assert.equal(planCardinality(first, second, replay, conflict).status, "FAIL");
});
test("unchanged key with changed payload must conflict", () => {
  const { first, second, replay, conflict } = plans();
  conflict.http = 201;
  assert.equal(planCardinality(first, second, replay, conflict).status, "FAIL");
});
test("a failed plan positive blocks its cardinality certification", () => {
  const { first, second, replay, conflict } = plans();
  first.http = 500;
  assert.equal(planCardinality(first, second, replay, conflict).status, "BLOQUEADO");
});
test("HTTP contract uses the same key/payload for replay and changes payload for conflict", async () => {
  plans();
  const calls: any[] = [];
  await contract({ CARRIER: "carrier", SERVICE: "service", clone: structuredClone, records: {}, roundtrips: [],
    output: () => {}, refs: { asset: { value: { roadVehicle: {} } }, request: { id: "request" }, route: { id: "route" },
      calendar: { id: "calendar" }, execution: { data: { plannedWindow: { endsAt: "2026-01-02T00:00:00Z" } } } }, fixture: { depots: {} },
    call: async (label: string, path: string, body: any, key: any, _actor: any, expected: number) => {
      calls.push({ label, path, body, key });
      return { http: expected, response: { data: label === "category-version-read-control" ? [] : { id: label } } };
    },
  });
  const [first, second, replay, conflict] = calls.filter(c => c.label.startsWith("route-plan-"));
  assert.ok(first.key); assert.equal(first.key, replay.key); assert.equal(first.key, conflict.key);
  assert.deepEqual(first.body, second.body); assert.deepEqual(first.body, replay.body);
  assert.notDeepEqual(first.body, conflict.body);
});

function normalization(normalize = true, acceptNull = false) {
  const schema = { safeParse: (raw: any) => {
    if (!raw?.data) return { success: false };
    const value = raw.data.documents;
    if (value === null && !acceptNull || value !== undefined && value !== null && !Array.isArray(value)) return { success: false };
    return { success: true, data: { data: { documents: normalize && value === undefined ? [] : value } } };
  } };
  return arrayReadProjection(schema, { data: { documents: [] } }, "data.documents");
}
test("measured read normalization certifies a required array", () => { assert.equal(normalization().status, "PASS"); });
test("an optional pass-through output does not certify normalization", () => {
  assert.equal(normalization().status, "PASS"); assert.equal(normalization(false).status, "FAIL");
});
test("null acceptance prevents normalization certification", () => {
  assert.equal(normalization().status, "PASS"); assert.equal(normalization(true, true).status, "FAIL");
});

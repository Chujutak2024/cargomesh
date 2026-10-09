import assert from "node:assert/strict";
import { test } from "node:test";
import { hasRuntimeRoute, manualOfferStatus, pairedStatus } from "./http_oracles.ts";

test("route absence follows the selected runtime cut and cannot count as functional coverage", () => {
  const path = "/carriers/real-carrier/operators";
  const routes = [{ method: "GET", path: "/api/v2/carriers/:carrierId/operators" }];
  assert.equal(hasRuntimeRoute(routes, "GET", path), true);
  assert.equal(hasRuntimeRoute([], "GET", path), false);
  assert.equal(hasRuntimeRoute(routes, "POST", path), false);
  assert.equal(hasRuntimeRoute(routes, "GET", path + "/other"), false);
  assert.equal(hasRuntimeRoute(routes, "GET", "/carriers//operators"), false);
});

const positive = () => [{ http: 201, response: { data: { id: "offer" }, meta: { idempotentReplay: false } } },
  { http: 200, response: { data: { id: "offer" }, meta: { idempotentReplay: true } } },
  { count: 0, ids: [] }, { count: 1, ids: ["offer"] }, { count: 1, ids: ["offer"] }];
test("a new MANUAL offer requires 201 and an unchanged replay ID/count", () => {
  assert.equal(manualOfferStatus(...positive() as [any, any, any, any, any]), "PASS");
  for (const mutation of [
    (x: any[]) => { x[0].http = 200; },
    (x: any[]) => { x[0].response.meta.idempotentReplay = true; },
    (x: any[]) => { x[1].http = 201; },
    (x: any[]) => { x[1].response.meta.idempotentReplay = false; },
    (x: any[]) => { x[1].response.data.id = "another"; },
    (x: any[]) => { x[4] = { count: 2, ids: ["offer", "another"] }; },
  ]) {
    const values = positive(); mutation(values);
    assert.equal(manualOfferStatus(...values as [any, any, any, any, any]), "FAIL");
  }
});
test("cookie/Bearer negatives never pass when their same-session positive fails", () => {
  assert.equal(pairedStatus({ status: "PASS" }, { status: "PASS" }), "PASS");
  assert.equal(pairedStatus({ status: "PASS" }, { status: "FAIL" }), "FAIL");
  assert.equal(pairedStatus({ status: "FAIL" }, { status: "PASS" }), "BLOQUEADO");
  assert.equal(pairedStatus({ status: "BLOQUEADO" }, { status: "PASS" }), "BLOQUEADO");
});

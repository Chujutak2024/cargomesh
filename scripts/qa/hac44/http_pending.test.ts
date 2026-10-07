import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { pending } from "./http_pending.ts";

const record = (id: string) => ({ id, version: 1, value: {}, data: {
  source: { reference: "fixture:pending-unit" }, plannedWindow: { start: "2026-10-06", end: "2026-10-07" },
} });
const refs = () => ({
  ...Object.fromEntries(["booking", "assignment", "execution", "limits", "asset", "request", "offer", "route", "plan", "decision"]
    .map((name) => [name, record(name)])),
  second: Object.fromEntries(["booking", "assignment", "execution", "asset"].map((name) => [name, record("second-" + name)])),
  ltl: Object.fromEntries(["booking", "assignment", "batch"].map((name) => [name, record("ltl-" + name)])),
});
const extended = () => Object.fromEntries(["executions", "incidents", "conditions", "corridors", "route-policies", "scoring-policies", "limits", "metrics"]
  .map((name) => [name, record("extended-" + name)]));

async function run(r: any, e: any, failed = "", failedControl = "") {
  const folder = mkdtempSync(join(tmpdir(), "hac44-pending-unit-"));
  const previous = process.env.HAC44_OUT;
  const calls: any[] = [];
  let cases: any[] = [];
  try {
    for (const directory of ["dataset", "logs"]) mkdirSync(join(folder, directory));
    if (r !== null) writeFileSync(join(folder, "dataset/pending-refs.json"), JSON.stringify(r));
    if (e !== null) writeFileSync(join(folder, "logs/extended-extended-records.json"), JSON.stringify(e));
    process.env.HAC44_OUT = folder;
    await pending({
      CARRIER: "carrier", clone: (v: any) => structuredClone(v),
      fixture: { drivers: {}, "driver-assignments": {}, "vehicle-assignments": {} },
      modules: { "workflow.ts": { WorkflowInputsV2: {} }, "catalog.ts": { CatalogInputsV2: {} } },
      output: (name: string, value: any) => { if (name === "cases.json") cases = structuredClone(value); },
      call: async (label: string, path: string, body: any, _key: any, actor: number, expected: number) => {
        assert(!path.includes("undefined"), "Missing dependencies must never reach HTTP");
        const fail = label === failed || (label === failedControl && actor === 3);
        const http = fail ? 500 : expected;
        const data = label === "pending-events-fixture" || label === "pending-updates-fixture"
          ? [record(label)] : record(label);
        const row = { label, path, request: body, actor, http, status: fail ? "FAIL" : "PASS", response: { data } };
        calls.push(row);
        return row;
      },
    });
  } finally {
    if (previous === undefined) delete process.env.HAC44_OUT;
    else process.env.HAC44_OUT = previous;
    rmSync(folder, { recursive: true });
  }
  return { cases, calls };
}

async function positive() {
  const result = await run(refs(), extended());
  assert.equal(result.cases.length, 43);
  assert.equal(new Set(result.cases.map((c) => c.method + " " + c.template)).size, 43);
  assert(result.cases.every((c) => c.status === "PASS" && c.validPositive));
  return result;
}

test("all pending routes retain functional and authorization controls", positive);

test("missing extended execution blocks dependents and continues independent cases", async () => {
  await positive();
  const result = await run(refs(), {});
  assert.equal(result.cases.length, 43);
  const blocked = result.cases.filter((c) => c.status === "BLOQUEADO");
  assert.equal(blocked.length, 15);
  assert(blocked.every((c) => c.dependency && !c.validPositive));
  assert(result.cases.filter((c) => c.template.includes("/events") && !c.template.includes("/assets/"))
    .every((c) => c.status === "BLOQUEADO" && c.dependency.includes("extended.executions.id")));
  assert(result.cases.some((c) => c.template.endsWith("/consolidations/:id/cancellations") && c.status === "PASS"));
});

test("missing fixture files register every dependent route without aborting", async () => {
  await positive();
  const result = await run(null, null);
  assert.equal(result.cases.length, 43);
  assert.equal(result.cases.filter((c) => c.status === "BLOQUEADO").length, 42);
  assert(result.cases.filter((c) => c.status === "BLOQUEADO").every((c) => c.dependency && !c.validPositive));
  assert.equal(result.cases.find((c) => c.template === "/api/v2/intake/options").status, "PASS");
});

test("failed fixture positives block their dependent cases and preserve product FAIL", async () => {
  await positive();
  for (const label of ["pending-hold-create", "pending-driver-control", "pending-crew-control", "pending-asset-event-create",
    "pending-events-fixture", "pending-updates-fixture", "pending-current-version-control", "pending-second-hold-control",
    "pending-booking-version-control", "pending-batch-member-control"]) {
    const result = await run(refs(), extended(), label);
    assert.equal(result.cases.length, 43, label);
    assert(result.calls.some((c) => c.label === label && c.status === "FAIL"), label);
    assert(result.cases.some((c) => c.status === "BLOQUEADO" && c.dependency), label);
    assert(result.cases.some((c) => c.status === "PASS"), label);
  }
});

test("failed functional positive blocks its controls; real control failures keep the gate red", async () => {
  await positive();
  const result = await run(refs(), extended(), "pending-functional-positive");
  assert.equal(result.cases.length, 43);
  assert(result.cases.every((c) => c.status === "BLOQUEADO" && !c.validPositive && c.dependency));
  await assert.rejects(run(refs(), extended(), "", "pending-anonymous-or-revoked"), /Pending route controls failed/);
});

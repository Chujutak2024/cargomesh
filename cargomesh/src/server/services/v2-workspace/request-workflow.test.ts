import assert from "node:assert/strict";
import test from "node:test";
import { readRequestChildren } from "./request-workflow";
import type { WorkflowRecordV2 } from "@/features/shipper-portal/shipper-model";
const parent = { id: "booking", kind: "bookings", organizationId: "org", requestId: "request", carrierId: "carrier" } as WorkflowRecordV2;
const child = { id: "execution", kind: "executions", organizationId: "org", requestId: "request", carrierId: "carrier", data: { bookingId: "booking" } } as WorkflowRecordV2;
const page = (data: WorkflowRecordV2[], complete = true) => ({ data, complete, error: null, offset: 0, batchSize: 500, nextOffset: null });
test("request execution reads follow the exact booking instead of native ignored request filter", async () => {
  const calls: string[] = [];
  const result = await readRequestChildren("executions", [parent], "org", "request", async (kind, id) => {
    calls.push(`${kind}:${id}`); return page([child]);
  });
  assert.deepEqual(calls, ["executions:booking"]); assert.deepEqual(result.data, [child]); assert.equal(result.complete, true);
  assert.deepEqual((await readRequestChildren("executions", [], "org", "request", async () => { throw Error("must not read tenant-wide"); })).data, []);
});
test("request children reject cross tenant, request, Carrier and parent instead of dropping scope guards", async () => {
  for (const patch of [{ organizationId: "foreign" }, { requestId: "foreign" }, { carrierId: "foreign" }, { data: { bookingId: "foreign" } }]) {
    await assert.rejects(readRequestChildren("executions", [parent], "org", "request", async () => page([{ ...child, ...patch } as WorkflowRecordV2])));
  }
});
test("unavailable and bounded child reads remain explicitly incomplete", async () => {
  const result = await readRequestChildren("executions", [parent], "org", "request", async () => ({ ...page([], false), error: { code: "OPERATIONS_READ_UNAVAILABLE" } }));
  assert.equal(result.complete, false); assert.ok(result.error);
  let calls = 0;
  const limited = await readRequestChildren("executions", Array.from({length: 26}, (_, i) => ({...parent, id: String(i)})), "org", "request", async () => {calls++; return page([]);});
  assert.equal(calls, 25); assert.equal(limited.complete, false);
});

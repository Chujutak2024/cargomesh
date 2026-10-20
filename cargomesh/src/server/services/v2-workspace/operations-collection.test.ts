import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import { V2DraftError } from "@/server/modules/freight-requests/application/draft-service";
import { RequestLifecycleServiceV2 } from "@/server/modules/freight-requests/application/request-lifecycle-service";
import { demoRequests } from "@/features/shipper-demo-preview/demo-data";
import { collectOperationsPages, operationsCount, operationsReadIssues, OperationsReadContractError, type OperationsPage } from "./operations-collection";

const rows = (offset: number, length: number) => Array.from({ length }, (_, index) => ({ id: `row-${offset + index}` }));
const validate = () => {};

test("reads beyond the old SSR first page and retains native pagination", async () => {
  const offsets: number[] = [];
  const result = await collectOperationsPages(async page => {
    offsets.push(page.offset);
    return { data: rows(page.offset, page.offset === 0 ? 100 : 17), meta: { ...page, nextOffset: page.offset === 0 ? 100 : null } };
  }, validate);
  assert.deepEqual(offsets, [0, 100]);
  assert.equal(result.data.length, 117);
  assert.equal(result.complete, true);
  assert.equal(operationsCount(result), "117");
  assert.deepEqual(operationsReadIssues({ requests: result }), []);
});

test("a bounded read is explicit and provides the next batch offset", async () => {
  let reads = 0;
  const result = await collectOperationsPages(async page => {
    reads++;
    return { data: rows(page.offset, 100), meta: { ...page, nextOffset: page.offset + 100 } };
  }, validate);
  assert.equal(reads, 5);
  assert.equal(result.data.length, 500);
  assert.equal(result.nextOffset, 500);
  assert.equal(operationsCount(result), "500+");
  assert.deepEqual(operationsReadIssues({ bookings: result }), [{ resource: "bookings", reason: "partial" }]);
});

test("a later range is never represented as an organization total", async () => {
  const result = await collectOperationsPages(async page => ({ data: rows(page.offset, 2), meta: { ...page, nextOffset: null } }), validate, 500);
  assert.equal(result.offset, 500);
  assert.equal(result.complete, false);
  assert.equal(result.nextOffset, null);
  assert.equal(operationsCount(result), "2+");
});

test("an empty successful read is different from an unavailable service", async () => {
  const empty = await collectOperationsPages(async page => ({ data: [], meta: { ...page, nextOffset: null } }), validate);
  const unavailable = await collectOperationsPages<{ id: string }>(async () => { throw new Error("database unavailable"); }, validate);
  assert.equal(empty.complete, true);
  assert.equal(operationsCount(empty), "0");
  assert.equal(unavailable.complete, false);
  assert.equal(operationsCount(unavailable), "—");
  assert.deepEqual(operationsReadIssues({ offers: unavailable }), [{ resource: "offers", reason: "unavailable" }]);
});

test("a failed later page retains only observed rows and blocks complete-read decisions", async () => {
  const result = await collectOperationsPages(async page => {
    if (page.offset) throw new V2DraftError("INTERNAL_ERROR", "unavailable", 503);
    return { data: rows(0, 100), meta: { ...page, nextOffset: 100 } };
  }, validate);
  assert.equal(result.data.length, 100);
  assert.equal(result.nextOffset, 100);
  assert.equal(result.complete, false);
  assert.equal(operationsCount(result), "—");
  assert.equal(result.error?.code, "OPERATIONS_READ_UNAVAILABLE");
});

for (const status of [400, 401, 403, 404, 409]) test(`HTTP ${status} propagates; it cannot become an empty fallback`, async () => {
  const error = new V2DraftError("DENIED_OR_CONFLICT", "denied", status);
  await assert.rejects(collectOperationsPages(async () => { throw error; }, validate), error);
});

test("schema failures and malformed pagination fail closed", async () => {
  const schemaError = z.string().safeParse(7);
  assert.equal(schemaError.success, false);
  await assert.rejects(collectOperationsPages(async () => { throw schemaError.error; }, validate), { name: "ZodError" });
  for (const meta of [undefined, { limit: 100, offset: 0, nextOffset: 0 }, { limit: 100, offset: 1, nextOffset: null },
    { limit: 100, offset: 0, nextOffset: 100 }]) {
    await assert.rejects(collectOperationsPages(async () => ({ data: [], meta }), validate), OperationsReadContractError);
  }
});

test("duplicate records across pages cannot be counted twice", async () => {
  await assert.rejects(collectOperationsPages(async page => ({ data: rows(0, 100), meta: { ...page, nextOffset: page.offset + 100 } }), validate), OperationsReadContractError);
});

test("out-of-bounds offsets never call the service", async () => {
  for (const offset of [-1, 0.5, 100001, Number.NaN]) {
    let calls = 0;
    await assert.rejects(collectOperationsPages(async () => { calls++; return {} as OperationsPage<{ id: string }>; }, validate, offset), OperationsReadContractError);
    assert.equal(calls, 0);
  }
});

test("native request tenant rejection is retained by the operations adapter", async () => {
  const record = demoRequests[0]; // Explicit unit-test data; never a runtime fallback.
  const service = new RequestLifecycleServiceV2({ list: async () => [{ data: record, payloadHash: "test-only" }], command: async () => { throw new Error("No writes expected"); } });
  await assert.rejects(collectOperationsPages(page => service.list({ organizationId: "another-organization", memberId: "test-member" }, page), validate), { code: "FORBIDDEN_TENANT", httpStatus: 403 });
});

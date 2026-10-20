import assert from "node:assert/strict";
import test from "node:test";
import { requestCarrierOffer, ShipperApiError } from "./shipper-api";
import { commercialFixture, id } from "./commercial-context.test-fixtures";

const fixture = () => {
  const context = commercialFixture(), opportunity = context.opportunities[0], data = opportunity.data;
  const input = { schemaVersion: "2.0" as const, planId: data.planId, carrierId: data.carrierId,
    assignmentIds: data.assignmentIds, responseDeadline: data.responseDeadline, responseChannel: data.responseChannel };
  return { context, opportunity, input };
};
test("explicit opportunity creation reuses the native endpoint, payload and retry key; never emits an offer or booking", async () => {
  const { context, opportunity, input } = fixture(), keys: string[] = [], payloads: string[] = [];
  const fetcher: typeof fetch = async (url, init) => {
    assert.equal(url, `/api/v2/freight/requests/${context.request.id}/opportunities`);
    assert.equal(init?.method, "POST"); assert.equal(init.credentials, "same-origin");
    keys.push((init.headers as Record<string, string>)["Idempotency-Key"]); payloads.push(String(init.body));
    return Response.json({ schemaVersion: "2.0", data: opportunity, meta: { environmentProfile: "v2-clean", idempotentReplay: keys.length > 1 } });
  };
  assert.equal((await requestCarrierOffer(context.request.id, input, id(99), fetcher)).id, opportunity.id);
  assert.equal((await requestCarrierOffer(context.request.id, input, id(99), fetcher)).id, opportunity.id);
  assert.deepEqual(keys, [id(99), id(99)]); assert.equal(payloads[0], payloads[1]); assert.deepEqual(JSON.parse(payloads[0]), input);
});
for (const field of ["requestId", "carrierId", "planId", "assignmentIds", "responseChannel", "responseDeadline"] as const) {
  test(`a successful HTTP response with a different ${field} cannot become a sent opportunity`, async () => {
    const { context, opportunity, input } = fixture();
    if (field === "requestId" || field === "carrierId") opportunity[field] = id(90);
    if (field === "planId") opportunity.data.planId = id(90);
    if (field === "assignmentIds") opportunity.data.assignmentIds = [id(90)];
    if (field === "responseChannel") opportunity.data.responseChannel = "MCP";
    if (field === "responseDeadline") opportunity.data.responseDeadline = "2026-10-15T18:00:00Z";
    await assert.rejects(requestCarrierOffer(context.request.id, input, id(99), async () => Response.json({ schemaVersion: "2.0", data: opportunity,
      meta: { environmentProfile: "v2-clean", idempotentReplay: false } })), { code: "INVALID_SCOPE" });
  });
}
test("permission, conflict, server and network failures never create a local success", async () => {
  const { context, input } = fixture();
  for (const status of [401, 403, 409, 503]) await assert.rejects(requestCarrierOffer(context.request.id, input, id(99), async () =>
    Response.json({ error: { code: status === 409 ? "STALE_DRAFT" : "NATIVE_ERROR", message: "No mutation confirmed.", retryable: false } }, { status })),
    caught => caught instanceof ShipperApiError && caught.status === status);
  await assert.rejects(requestCarrierOffer(context.request.id, input, id(99), async () => { throw new TypeError("offline"); }), { code: "NETWORK_ERROR" });
});

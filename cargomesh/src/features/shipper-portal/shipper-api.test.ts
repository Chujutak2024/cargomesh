import assert from "node:assert/strict";
import test from "node:test";
import { selectCommercialOption, ShipperApiError } from "./shipper-api";

test("commercial selection sends explicit evidence and a unique idempotency key", async () => {
  let captured: RequestInit | undefined;
  const fetcher = async (_input: RequestInfo | URL, init?: RequestInit) => {
    captured = init;
    return new Response(JSON.stringify({ schemaVersion: "2.0", error: {
      code: "VALIDATION_ERROR", message: "Fixture stops before persistence.", retryable: false,
    } }), { status: 400, headers: { "Content-Type": "application/json" } });
  };
  await assert.rejects(selectCommercialOption({
    requestId: "10000000-0000-4000-8000-000000000001", planId: "10000000-0000-4000-8000-000000000002",
    offerIds: ["10000000-0000-4000-8000-000000000003"],
    consideredOfferIds: ["10000000-0000-4000-8000-000000000003"], policyId: null, rationale: "Selected by shipper.",
  }, fetcher), (error: unknown) => error instanceof ShipperApiError && error.code === "VALIDATION_ERROR");
  const headers = captured?.headers as Record<string, string>;
  assert.match(headers["Idempotency-Key"], /^[0-9a-f-]{36}$/i);
  assert.equal(JSON.parse(String(captured?.body)).evidence[0].reference, "SHIPPER_WEB_EXPLICIT_SELECTION");
});

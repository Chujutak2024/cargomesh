import assert from "node:assert/strict";
import test from "node:test";

import { fetchFreightRequestExecutionIntent } from "./execution-intent-client";
import { parseFreightRequestExecutionIntent } from "./execution-intent-contracts";

const validIntent = {
  schemaVersion: "1.0",
  freightRequestId: "f2000000-0000-0000-0000-000000000001",
  requestCode: "FR-1042",
  status: "PENDING",
  pickupMode: "SCHEDULED",
  requiredPickup: "2026-08-31T13:00:00+00:00",
  pickupWindowStart: "2026-08-31T13:00:00+00:00",
  pickupWindowEnd: "2026-08-31T17:00:00+00:00",
  deliveryDeadline: "2026-09-03T13:00:00+00:00",
  updatedAt: "2026-08-30T20:00:00+00:00",
};

test("normalizes the persisted FR-1042 schedule without using the browser clock", () => {
  const result = parseFreightRequestExecutionIntent(validIntent);

  assert.equal(result.pickupWindowStart, "2026-08-31T13:00:00.000Z");
  assert.equal(result.pickupWindowEnd, "2026-08-31T17:00:00.000Z");
  assert.equal(result.deliveryDeadline, "2026-09-03T13:00:00.000Z");
});
test("rejects a SCHEDULED intent without a complete pickup window", () => {
  assert.throws(
    () => parseFreightRequestExecutionIntent({ ...validIntent, pickupWindowEnd: null }),
    /SCHEDULED requires pickupWindowStart and pickupWindowEnd/,
  );
});

test("rejects an inverted pickup window or delivery deadline", () => {
  assert.throws(
    () =>
      parseFreightRequestExecutionIntent({
        ...validIntent,
        pickupWindowEnd: validIntent.pickupWindowStart,
      }),
    /pickupWindowEnd must be after/,
  );
  assert.throws(
    () =>
      parseFreightRequestExecutionIntent({
        ...validIntent,
        deliveryDeadline: validIntent.pickupWindowStart,
      }),
    /deliveryDeadline must be after/,
  );
});

test("the client fetches the authenticated same-origin endpoint without caching", async () => {
  let requestedUrl = "";
  let requestedInit: RequestInit | undefined;
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    requestedUrl = String(input);
    requestedInit = init;
    return new Response(JSON.stringify({ ok: true, data: validIntent }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;

  const result = await fetchFreightRequestExecutionIntent(
    validIntent.freightRequestId,
    fetcher,
  );

  assert.equal(
    requestedUrl,
    `/api/freight-requests/${validIntent.freightRequestId}/execution-intent`,
  );
  assert.equal(requestedInit?.cache, "no-store");
  assert.equal(result.requestCode, "FR-1042");
});

test("the client preserves a server error code", async () => {
  const fetcher = (async () =>
    new Response(
      JSON.stringify({
        ok: false,
        error: { code: "FORBIDDEN", message: "Membership is not active." },
      }),
      { status: 403, headers: { "content-type": "application/json" } },
    )) as typeof fetch;

  await assert.rejects(
    fetchFreightRequestExecutionIntent(validIntent.freightRequestId, fetcher),
    /FORBIDDEN: Membership is not active/,
  );
});

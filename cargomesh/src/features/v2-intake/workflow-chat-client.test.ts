import assert from "node:assert/strict";
import { test } from "node:test";
import { readRequestWorkflow } from "./workflow-chat-client";

const requestId = "11111111-1111-4111-8111-111111111111";

test("workflow reads use same-origin credentials and follow every page", async () => {
  const calls: string[] = [];
  const fetcher = async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push(String(input));
    assert.equal(init?.credentials, "same-origin");
    return Response.json({ schemaVersion: "2.0", data: [], meta: { nextOffset: calls.length === 1 ? 100 : null } });
  };
  assert.deepEqual(await readRequestWorkflow(requestId, "offers", fetcher as typeof fetch), []);
  assert.deepEqual(calls, [`/api/v2/freight/requests/${requestId}/offers?limit=100&offset=0`,
    `/api/v2/freight/requests/${requestId}/offers?limit=100&offset=100`]);
});

test("workflow authorization failure is surfaced rather than replaced with fixture data", async () => {
  const fetcher = async () => new Response(null, { status: 403 });
  await assert.rejects(readRequestWorkflow(requestId, "bookings", fetcher as typeof fetch), /not authorized/);
});

test("invalid or incomplete workflow pagination fails visibly", async () => {
  const fetcher = async () => Response.json({ schemaVersion: "2.0", data: [], meta: { nextOffset: 0 } });
  await assert.rejects(readRequestWorkflow(requestId, "executions", fetcher as typeof fetch), /did not advance/);
});

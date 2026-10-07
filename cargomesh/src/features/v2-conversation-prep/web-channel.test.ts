import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import { ConversationWebError, createPreparatoryWebChannel } from "./web-channel";

const id = "123e4567-e89b-42d3-a456-426614174000";
const draft = z.object({ schemaVersion: z.literal("2.0"), data: z.object({ id: z.string().uuid() }) });
const road = z.object({ schemaVersion: z.literal("2.0"), data: z.object({
  overallStatus: z.enum(["eligible", "ineligible", "unknown"]),
  evaluatedAt: z.string(), source: z.string(),
}) });

test("Web channel sends a complete draft to HAC-12 with same-origin cookies and retry key", async () => {
  let called = 0;
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    called++;
    assert.equal(input, "/api/v2/freight/requests");
    assert.equal(init?.method, "POST");
    assert.equal(init?.credentials, "same-origin");
    assert.equal((init?.headers as Record<string, string>)["Idempotency-Key"], id);
    assert.deepEqual(JSON.parse(String(init?.body)), { complete: true });
    return Response.json({ schemaVersion: "2.0", data: { id } }, { status: 201 });
  }) as typeof fetch;
  const channel = createPreparatoryWebChannel({ fetcher,
    createInput: z.object({ complete: z.literal(true) }).strict(), draftResponse: draft, roadResponse: road });
  await assert.rejects(channel.createDraft({ complete: false }, id), z.ZodError);
  assert.equal(called, 0);
  assert.equal((await channel.createDraft({ complete: true }, id)).data.id, id);
});

test("Web channel preserves the ROAD status, source and date from server response", async () => {
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    assert.equal(input, `/api/v2/freight/requests/${id}/serviceability?expectedDraftVersion=3`);
    assert.equal(init?.credentials, "same-origin");
    return Response.json({ schemaVersion: "2.0", data: {
      overallStatus: "unknown", source: "HAC-12", evaluatedAt: "2026-10-03T10:00:00-05:00",
    } });
  }) as typeof fetch;
  const channel = createPreparatoryWebChannel({ fetcher,
    createInput: z.unknown(), draftResponse: draft, roadResponse: road });
  assert.deepEqual((await channel.evaluateRoad(id, 3)).data, {
    overallStatus: "unknown", source: "HAC-12", evaluatedAt: "2026-10-03T10:00:00-05:00",
  });
});

test("Web channel does not add a client organization authority and fails closed on errors", async () => {
  const fetcher = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    assert.equal(init?.credentials, "same-origin");
    assert.equal(init?.headers, undefined);
    return Response.json({ schemaVersion: "2.0", error: {
      code: "TENANT_DENIED", message: "Unavailable", retryable: false,
    } }, { status: 403 });
  }) as typeof fetch;
  const channel = createPreparatoryWebChannel({ fetcher,
    createInput: z.unknown(), draftResponse: draft, roadResponse: road });
  await assert.rejects(channel.readDraft(id), (error) => error instanceof ConversationWebError
    && error.status === 403 && error.code === "TENANT_DENIED");
  await assert.rejects(channel.readDraft("../other"), (error) => error instanceof ConversationWebError
    && error.code === "INVALID_REQUEST_ID");
});

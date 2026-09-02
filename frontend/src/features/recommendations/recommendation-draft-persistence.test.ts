import assert from "node:assert/strict";
import test from "node:test";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { RecommendationDraftError } from "./recommendation-draft-contracts";
import { persistEditableFreightRequest } from "./recommendation-draft-persistence";

const identity = {
  id: "f2000000-0000-0000-0000-000000000001",
  organization_id: "a0000000-0000-0000-0000-000000000001",
  draft_version: 3,
};
const patch = { budget_max: 900, draft_version: 4 };
const selection = "id,organization_id,draft_version,status,budget_max";

// Exercise the real Supabase/PostgREST request builder against an in-memory
// transport. The row represents DB state at write time, after the caller read
// an eligible version. No external endpoint or credentials are used.
function harness(status: string, version = 3, fail = false) {
  let row = { ...identity, draft_version: version, status, budget_max: 1000 };
  let writes = 0;
  const requests: URL[] = [];
  const client = createClient<Database>("http://127.0.0.1:54321", "test-key", {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      fetch: async (input, init) => {
        const url = new URL(String(input));
        requests.push(url);
        assert.equal(init?.method, "PATCH");
        assert.equal(url.pathname, "/rest/v1/freight_requests");
        const singular = new Headers(init?.headers).get("Accept")?.includes("vnd.pgrst.object");
        if (fail) return Response.json({ code: "42501", message: "denied" }, { status: 403 });
        const matches = [...url.searchParams].every(([key, value]) => {
          if (key === "select") return true;
          const actual = String(row[key as keyof typeof row]);
          if (value.startsWith("eq.")) return actual === value.slice(3);
          if (value.startsWith("in.(")) return value.slice(4, -1).split(",").includes(actual);
          throw new Error(`Unexpected filter: ${key}`);
        });
        if (!matches) {
          if (!singular) return Response.json([]);
          return Response.json({
            code: "PGRST116", details: "The result contains 0 rows",
            message: "Cannot coerce the result to a single JSON object",
          }, { status: 406 });
        }
        writes++;
        row = { ...row, ...JSON.parse(String(init?.body)) };
        return Response.json(singular ? row : [row]);
      },
    },
  });
  return {
    mutation: () => client.from("freight_requests").update(patch as never),
    requests,
    state: () => ({ row, writes }),
  };
}

function stale(error: unknown) {
  return error instanceof RecommendationDraftError &&
    error.code === "STALE_DRAFT" && error.httpStatus === 409;
}

test("a run starting after the draft read prevents a write at the same version", async () => {
  const h = harness("ORCHESTRATING");
  await assert.rejects(persistEditableFreightRequest(h.mutation(), identity, selection), stale);
  assert.equal(h.state().writes, 0);
  assert.deepEqual(h.state().row, { ...identity, status: "ORCHESTRATING", budget_max: 1000 });
  assert.equal(h.requests.length, 1);
});

test("all post-draft states reject mutation even when draftVersion is unchanged", async () => {
  for (const status of ["AWAITING_SELECTION", "BOOKING", "BOOKED", "FAILED", "CANCELLED"]) {
    const h = harness(status);
    await assert.rejects(persistEditableFreightRequest(h.mutation(), identity, selection), stale);
    assert.equal(h.state().writes, 0, status);
  }
});

test("DRAFT and PENDING persist one new version without altering workflow status", async () => {
  for (const status of ["DRAFT", "PENDING"]) {
    const h = harness(status);
    const result = await persistEditableFreightRequest(h.mutation(), identity, selection);
    assert.equal(result.draft_version, 4);
    assert.equal(result.budget_max, 900);
    assert.equal(result.status, status);
    assert.equal(h.state().writes, 1);
  }
});

test("a concurrent draft update still rejects the older version", async () => {
  const h = harness("PENDING", 4);
  await assert.rejects(persistEditableFreightRequest(h.mutation(), identity, selection), stale);
  assert.equal(h.state().writes, 0);
});

test("request and organization guards remain on the atomic write", async () => {
  for (const changed of [{ id: "other-request" }, { organization_id: "other-organization" }]) {
    const h = harness("PENDING");
    await assert.rejects(
      persistEditableFreightRequest(h.mutation(), { ...identity, ...changed }, selection),
      stale,
    );
    assert.equal(h.state().writes, 0);
  }
});

test("database errors remain distinct from an optimistic conflict", async () => {
  const h = harness("PENDING", 3, true);
  await assert.rejects(persistEditableFreightRequest(h.mutation(), identity, selection),
    (error: unknown) => error instanceof RecommendationDraftError &&
      error.code === "DRAFT_UNAVAILABLE" && error.httpStatus === 500);
  assert.equal(h.state().writes, 0);
});

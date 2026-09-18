import assert from "node:assert/strict";
import test from "node:test";
import { createIdempotentFreightRequestDraft, type IdempotentDraftDependencies } from "./idempotent-draft-creation";
import type { FreightRequestIntakeViewModel } from "../../../features/freight-requests/intake-contracts";
import type { AuthenticatedMemberContext } from "@/server/auth/member";
import { creationInput } from "@/server/mcp/creation-test-fixture";

const now = new Date("2026-09-18T00:00:00Z");
function harness() {
  const rows: Record<string, unknown>[] = [];
  let sequence = 0;
  const member: AuthenticatedMemberContext = {
    userId: crypto.randomUUID(), userEmail: "test@example.test", memberId: crypto.randomUUID(),
    organizationId: crypto.randomUUID(), role: "SUPERVISOR", status: "ACTIVE",
  };
  const deps: IdempotentDraftDependencies = {
    resolveMember: async (options) => { assert.equal(options?.requiredRole, "SUPERVISOR"); return { ...member }; },
    resolveCargoCategoryId: async () => crypto.randomUUID(),
    generateRequestCode: async () => `FR-${++sequence + 5000}`,
    findCreation: async (org, actor, key) => {
      const row = rows.find((r) => r.organization_id === org && r.requested_by_member_id === actor && r.creation_idempotency_key === key);
      return row ? { id: String(row.id), code: String(row.code), creation_payload_hash: String(row.creation_payload_hash) } : null;
    },
    // Simulates the database's atomic unique constraint, not an actual RLS test.
    insertFreightRequest: async (row) => {
      if (rows.some((r) => r.organization_id === row.organization_id && r.requested_by_member_id === row.requested_by_member_id && r.creation_idempotency_key === row.creation_idempotency_key)) {
        throw Object.assign(new Error("unique"), { code: "23505" });
      }
      rows.push(row);
      return { id: String(row.id), code: String(row.code) };
    },
    loadIntake: async (code) => {
      const row = rows.find((r) => r.code === code);
      assert.ok(row);
      // Only the service projection is exercised; full intake builder has its own tests.
      return { freightRequestId: row.id, requestCode: row.code, status: row.status, draftVersion: row.draft_version } as FreightRequestIntakeViewModel;
    },
  };
  return { rows, deps, member };
}

test("uses existing normalizer and creates an attributed DRAFT with canonical totals", async () => {
  const h = harness();
  const result = await createIdempotentFreightRequestDraft(creationInput(), h.deps, now);
  assert.equal(result.status, "DRAFT"); assert.equal(result.replayed, false);
  assert.equal(h.rows.length, 1);
  assert.equal(h.rows[0].cargo_weight_kg, 1600);
  assert.equal(h.rows[0].cargo_volume_m3, 3.6);
  assert.equal(h.rows[0].requested_by_member_id, h.member.memberId);
  assert.equal(h.rows[0].optimization_strategy, "BALANCED");
});
test("same input in another key order replays current state even after pickup date", async () => {
  const h = harness(); const input = creationInput();
  const first = await createIdempotentFreightRequestDraft(input, h.deps, now);
  h.rows[0].status = "BOOKED"; h.rows[0].draft_version = 5;
  const reordered = { ...input, fields: Object.fromEntries(Object.entries(input.fields).reverse()) };
  const next = await createIdempotentFreightRequestDraft(reordered, h.deps, new Date("2030-01-01"));
  assert.equal(next.freightRequestId, first.freightRequestId);
  assert.equal(next.status, "BOOKED"); assert.equal(next.draftVersion, 5); assert.equal(next.replayed, true);
  assert.equal(h.rows.length, 1);
});
test("concurrent identical calls return the winner's code and create one row", async () => {
  const h = harness();
  const results = await Promise.all(Array.from({ length: 8 }, () => createIdempotentFreightRequestDraft(creationInput(), h.deps, now)));
  assert.equal(h.rows.length, 1);
  assert.equal(new Set(results.map((r) => r.freightRequestId)).size, 1);
  assert.equal(results.filter((r) => !r.replayed).length, 1);
});
test("same key with different fields conflicts sequentially and concurrently", async () => {
  for (const concurrent of [false, true]) {
    const h = harness(); const input = creationInput();
    const changed = { ...input, fields: { ...input.fields, entryQuantity: 3 } };
    const first = createIdempotentFreightRequestDraft(input, h.deps, now);
    if (!concurrent) await first;
    const results = await Promise.allSettled([first, createIdempotentFreightRequestDraft(changed, h.deps, now)]);
    assert.equal(results[1].status, "rejected");
    if (results[1].status === "rejected") assert.equal(results[1].reason.code, "IDEMPOTENCY_CONFLICT");
    assert.equal(h.rows.length, 1);
  }
});
test("lost insert response and failed read after commit are safe to retry", async () => {
  for (const failure of ["insert", "read"]) {
    const h = harness();
    if (failure === "insert") {
      const insert = h.deps.insertFreightRequest;
      h.deps.insertFreightRequest = async (row) => { await insert(row); throw new Error("network lost"); };
    } else {
      const read = h.deps.loadIntake; let failed = false;
      h.deps.loadIntake = async (code) => { if (!failed) { failed = true; throw new Error("read failed"); } return read(code); };
    }
    await createIdempotentFreightRequestDraft(creationInput(), h.deps, now).catch(() => undefined);
    const retry = await createIdempotentFreightRequestDraft(creationInput(), h.deps, now);
    assert.equal(retry.replayed, true); assert.equal(h.rows.length, 1);
  }
});
test("key scope includes organization and member; replay still requires manager permission", async () => {
  const h = harness();
  await createIdempotentFreightRequestDraft(creationInput(), h.deps, now);
  h.member.memberId = crypto.randomUUID();
  await createIdempotentFreightRequestDraft(creationInput(), h.deps, now);
  h.member.organizationId = crypto.randomUUID();
  await createIdempotentFreightRequestDraft(creationInput(), h.deps, now);
  assert.equal(h.rows.length, 3);
  h.member.role = "REQUESTER";
  await assert.rejects(createIdempotentFreightRequestDraft(creationInput(), h.deps, now), { code: "FORBIDDEN" });
});
test("invalid time windows and inactive members do not insert", async () => {
  const h = harness(); const input = creationInput();
  input.fields.pickupWindowEnd = "2026-09-19T01:00:00Z";
  await assert.rejects(createIdempotentFreightRequestDraft(input, h.deps, now));
  h.member.status = "INACTIVE";
  await assert.rejects(createIdempotentFreightRequestDraft(creationInput(), h.deps, now), { code: "FORBIDDEN" });
  assert.equal(h.rows.length, 0);
});
test("unrelated unique collisions retry codes and database errors do not become success", async () => {
  const h = harness(); const insert = h.deps.insertFreightRequest; let attempts = 0;
  h.deps.insertFreightRequest = async (row) => {
    if (++attempts === 1) throw Object.assign(new Error("code collision"), { code: "23505" });
    return insert(row);
  };
  await createIdempotentFreightRequestDraft(creationInput(), h.deps, now);
  assert.equal(attempts, 2); assert.equal(h.rows.length, 1);
  const broken = harness();
  broken.deps.insertFreightRequest = async () => { throw new Error("database unavailable"); };
  await assert.rejects(createIdempotentFreightRequestDraft(creationInput(), broken.deps, now), /database unavailable/);
});

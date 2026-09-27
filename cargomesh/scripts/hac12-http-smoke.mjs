// Run only against the local HAC-29 V2 scenario; never against a hosted project.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

const apiUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const appUrl = process.env.HAC12_APP_URL ?? "http://127.0.0.1:3172";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.HAC12_LOCAL_QA_PASSWORD;
const localHosts = new Set(["127.0.0.1", "localhost", "[::1]"]);
if (!apiUrl || !anonKey || !serviceKey || !password
  || !localHosts.has(new URL(apiUrl).hostname)
  || !localHosts.has(new URL(appUrl).hostname)) {
  throw new Error("HAC-12 smoke requires local URLs and explicit local-only credentials.");
}

const fixtureRoot = process.env.HAC12_FIXTURE_ROOT
  ?? resolve(import.meta.dirname, "../../supabase/scenarios/v2-road-baseline/fixtures");
const positive = JSON.parse(await readFile(resolve(fixtureRoot, "positive.json"), "utf8"));
const createdIds = [];
const admin = createClient(apiUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function sessionFor(email) {
  const jar = new Map();
  const client = createServerClient(apiUrl, anonKey, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (entries) => entries.forEach(({ name, value }) => jar.set(name, value)),
    },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return () => [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
}

async function call(path, cookie, options = {}) {
  const response = await fetch(new URL(path, appUrl), {
    ...options,
    headers: {
      ...(cookie ? { Cookie: cookie() } : {}),
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  const body = await response.json();
  return { status: response.status, body };
}

async function post(body, cookie, key = crypto.randomUUID()) {
  return call("/api/v2/freight/requests", cookie, {
    method: "POST", headers: { "Idempotency-Key": key }, body: JSON.stringify(body),
  });
}

try {
  const tenantA = await sessionFor("qa-v2-a@cargomesh.test");
  const tenantB = await sessionFor("qa-v2-b@cargomesh.test");
  const unauthorized = await call("/api/v2/intake/options");
  assert.equal(unauthorized.status, 401);
  const options = await call("/api/v2/intake/options", tenantA);
  assert.equal(options.status, 200, JSON.stringify(options.body));
  assert.equal(options.body.data.cargoCategories.length, 8);
  assert.equal(options.body.data.facilities.length, 3);

  const key = crypto.randomUUID();
  const created = await post(positive.requestBody, tenantA, key);
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const requestId = created.body.data.id;
  createdIds.push(requestId);
  assert.equal(created.body.data.origin.label, "[SYNTHETIC] A pickup on covered lane");
  assert.equal(created.body.data.contacts.recipient.name, "Carlos Medina");
  const replay = await post(positive.requestBody, tenantA, key);
  assert.equal(replay.status, 200, JSON.stringify(replay.body));
  assert.equal(replay.body.data.id, requestId);
  const changed = await post({ ...positive.requestBody, budget: { amount: 3300, currency: "USD" } }, tenantA, key);
  assert.equal(changed.status, 409, JSON.stringify(changed.body));
  const read = await call(`/api/v2/freight/requests/${requestId}`, tenantA);
  assert.equal(read.status, 200, JSON.stringify(read.body));
  assert.deepEqual(read.body.data, created.body.data);
  const crossTenantRead = await call(`/api/v2/freight/requests/${requestId}`, tenantB);
  assert.equal(crossTenantRead.status, 404, JSON.stringify(crossTenantRead.body));

  const evaluation = await call(`/api/v2/freight/requests/${requestId}/serviceability?expectedDraftVersion=1`, tenantA);
  assert.equal(evaluation.status, 200, JSON.stringify(evaluation.body));
  assert.equal(evaluation.body.data.freightRequestId, requestId);
  assert.equal(evaluation.body.data.summaryCounts.totalEvaluated, 2);
  assert.equal(evaluation.body.data.summaryCounts.eligibleCount, 1, JSON.stringify(evaluation.body));
  assert.equal(evaluation.body.data.summaryCounts.unknownCount, 1, JSON.stringify(evaluation.body));
  assert.ok(evaluation.body.data.candidates.every((candidate) => candidate.routePreview === null));
  const stale = await call(`/api/v2/freight/requests/${requestId}/serviceability?expectedDraftVersion=2`, tenantA);
  assert.equal(stale.status, 409, JSON.stringify(stale.body));

  const foreign = await post({ ...positive.requestBody,
    origin: { facilityId: "c2330000-0000-4000-8000-000000000004" } }, tenantA);
  assert.equal(foreign.status, 403, JSON.stringify(foreign.body));
  const absent = await post({ ...positive.requestBody,
    origin: { facilityId: "ffffffff-ffff-4fff-8fff-ffffffffffff" } }, tenantA);
  assert.equal(absent.status, 400, JSON.stringify(absent.body));
  const piura = await post({ ...positive.requestBody,
    origin: { facilityId: "c2330000-0000-4000-8000-000000000003" } }, tenantA);
  assert.equal(piura.status, 201, JSON.stringify(piura.body));
  createdIds.push(piura.body.data.id);
  const zero = await call(`/api/v2/freight/requests/${piura.body.data.id}/serviceability`, tenantA);
  assert.equal(zero.status, 200, JSON.stringify(zero.body));
  assert.equal(zero.body.data.candidates.length, 0);
  console.log("HAC-12 HTTP smoke PASS: auth, options, POST→GET, replay/conflict, tenant, ROAD, stale, zero.");
} finally {
  if (createdIds.length) {
    const { error } = await admin.from("freight_requests").delete().in("id", createdIds);
    if (error) throw new Error(`Local smoke cleanup failed: ${error.message}`);
  }
}

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
const changedServices = new Map();
const changedMemberships = new Map();
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
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session) throw new Error("Local QA sign-in failed.");
  const cookie = () => [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
  cookie.accessToken = data.session.access_token;
  return cookie;
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

  const bearerHeaders = { Authorization: `Bearer ${tenantA.accessToken}` };
  const bearerOptions = await call("/api/v2/intake/options", undefined, { headers: bearerHeaders });
  assert.equal(bearerOptions.status, 200);
  assert.deepEqual(bearerOptions.body, options.body);
  for (const authorization of ["Bearer invalid-token", "Basic invalid", "Bearer "]) {
    assert.equal((await call("/api/v2/intake/options", tenantA,
      { headers: { Authorization: authorization } })).status, 401);
  }

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

  // R-04: all canonical operations work with Bearer without cookies.
  const bearerCreated = await call("/api/v2/freight/requests", undefined, {
    method: "POST", headers: { ...bearerHeaders, "Idempotency-Key": crypto.randomUUID() },
    body: JSON.stringify(positive.requestBody),
  });
  assert.equal(bearerCreated.status, 201, JSON.stringify(bearerCreated.body));
  createdIds.push(bearerCreated.body.data.id);
  assert.equal((await call(`/api/v2/freight/requests/${bearerCreated.body.data.id}`, undefined,
    { headers: bearerHeaders })).status, 200);
  const bearerEvaluation = await call(`/api/v2/freight/requests/${bearerCreated.body.data.id}/serviceability`,
    undefined, { headers: bearerHeaders });
  assert.equal(bearerEvaluation.status, 200);
  assert.equal(bearerEvaluation.body.data.summaryCounts.eligibleCount, 1);
  assert.equal((await call(`/api/v2/freight/requests/${requestId}`, tenantA,
    { headers: { Authorization: `Bearer ${tenantB.accessToken}` } })).status, 404,
    "Bearer must take priority over another tenant's cookie");

  const memberRead = await admin.from("organization_members").select("id,status")
    .eq("auth_user_id", "c2310000-0000-4000-8000-000000000001").single();
  assert.equal(memberRead.error, null);
  changedMemberships.set(memberRead.data.id, memberRead.data.status);
  const disabledMember = await admin.from("organization_members").update({ status: "INACTIVE" })
    .eq("id", memberRead.data.id);
  assert.equal(disabledMember.error, null);
  for (const path of ["/api/v2/intake/options", `/api/v2/freight/requests/${requestId}`,
    `/api/v2/freight/requests/${requestId}/serviceability`]) {
    assert.equal((await call(path, undefined, { headers: bearerHeaders })).status, 403);
  }
  assert.equal((await call("/api/v2/freight/requests", undefined, {
    method: "POST", headers: { ...bearerHeaders, "Idempotency-Key": crypto.randomUUID() },
    body: JSON.stringify(positive.requestBody),
  })).status, 403);
  const activeMember = await admin.from("organization_members").update({ status: memberRead.data.status })
    .eq("id", memberRead.data.id);
  assert.equal(activeMember.error, null);
  changedMemberships.delete(memberRead.data.id);
  assert.equal((await call("/api/v2/intake/options", undefined, { headers: bearerHeaders })).status, 200);

  // R-01: the real authenticated Data API role cannot forge the snapshot.
  const userClient = createClient(apiUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false }, global: { headers: bearerHeaders },
  });
  const forgedSnapshot = structuredClone(positive.requestBody);
  forgedSnapshot.origin = { ...created.body.data.origin, city: "Piura" };
  const tampered = await userClient.from("freight_requests")
    .update({ v2_snapshot: forgedSnapshot }).eq("id", requestId);
  assert.equal(tampered.error?.code, "PT409");
  const unchanged = await call(`/api/v2/freight/requests/${requestId}`, tenantA);
  assert.deepEqual(unchanged.body.data, created.body.data);
  const afterTamper = await call(`/api/v2/freight/requests/${requestId}/serviceability?expectedDraftVersion=1`, tenantA);
  assert.equal(afterTamper.status, 200);
  assert.equal(afterTamper.body.data.summaryCounts.eligibleCount, 1);

  // R-06: copying a readable row cannot introduce a forged V2 location.
  const source = await userClient.from("freight_requests").select("*").eq("id", requestId).single();
  assert.equal(source.error, null);
  const copyId = crypto.randomUUID();
  const copyKey = crypto.randomUUID();
  const forgedCopy = { ...source.data, id: copyId, code: `V2-${copyId.replaceAll("-", "")}`,
    creation_idempotency_key: copyKey,
    v2_snapshot: { ...source.data.v2_snapshot,
      origin: { ...source.data.v2_snapshot.origin, city: "Piura" } },
  };
  const forgedInsert = await userClient.from("freight_requests").insert(forgedCopy);
  assert.equal(forgedInsert.error?.code, "PT400", JSON.stringify(forgedInsert.error));
  const absentCopy = await admin.from("freight_requests").select("id").eq("id", copyId);
  assert.equal(absentCopy.error, null);
  assert.equal(absentCopy.data.length, 0);
  assert.equal((await call(`/api/v2/freight/requests/${requestId}/serviceability`, tenantA))
    .body.data.summaryCounts.totalEvaluated, 2);
  const canonicalCopy = await userClient.from("freight_requests").insert({ ...forgedCopy,
    v2_snapshot: source.data.v2_snapshot });
  assert.equal(canonicalCopy.error, null, JSON.stringify(canonicalCopy.error));
  createdIds.push(copyId);
  const copiedRead = await call(`/api/v2/freight/requests/${copyId}`, tenantA);
  assert.equal(copiedRead.status, 200);
  assert.deepEqual(copiedRead.body.data.origin, created.body.data.origin);

  // R-07: direct authenticated RPC enforces embedded types before persistence.
  const malformed = structuredClone(source.data.v2_creation_payload);
  delete malformed.cargoSpecification.units[0].dimensionsCm;
  delete malformed.cargoSpecification.units[0].indivisible;
  const rpcKey = crypto.randomUUID();
  const rpcArgs = { p_organization_id: source.data.organization_id,
    p_member_id: source.data.requested_by_member_id, p_idempotency_key: rpcKey,
    p_payload_hash: source.data.creation_payload_hash };
  const invalidRpc = await userClient.rpc("create_v2_freight_request", { ...rpcArgs, p_payload: malformed });
  assert.equal(invalidRpc.error?.code, "PT400", JSON.stringify(invalidRpc.error));
  const absentReceipt = await admin.from("freight_requests").select("id")
    .eq("creation_idempotency_key", rpcKey);
  assert.equal(absentReceipt.error, null);
  assert.equal(absentReceipt.data.length, 0);
  const validRpc = await userClient.rpc("create_v2_freight_request", { ...rpcArgs,
    p_payload: source.data.v2_creation_payload });
  assert.equal(validRpc.error, null, JSON.stringify(validRpc.error));
  createdIds.push(validRpc.data.id);
  assert.equal((await call(`/api/v2/freight/requests/${validRpc.data.id}`, tenantA)).status, 200);

  // R-03: every unit quantity contributes to weight and volume totals.
  for (const measurement of ["quantity", "weightPerUnitKg", "volumePerUnitM3"]) {
    const contradictory = structuredClone(positive.requestBody);
    contradictory.cargoSpecification.units[0][measurement] *= 10;
    const rejected = await post(contradictory, tenantA);
    assert.equal(rejected.status, 400);
    assert.equal(rejected.body.error.code, "VALIDATION_ERROR");
  }

  // R-05: manual pins survive both endpoints without fabricated geometry.
  const manual = { ...positive.requestBody,
    origin: { label: "Manual Lima", countryCode: "PE", region: "LIM", city: "Lima", lat: -12.0464, lng: -77.1181 },
    destination: { label: "Manual Arequipa", countryCode: "PE", region: "ARE", city: "Arequipa", lat: -16.4, lng: -71.53 },
  };
  for (const withCoordinates of [true, false]) {
    const payload = structuredClone(manual);
    if (!withCoordinates) {
      delete payload.origin.lat; delete payload.origin.lng;
      delete payload.destination.lat; delete payload.destination.lng;
    }
    const saved = await post(payload, tenantA);
    assert.equal(saved.status, 201, JSON.stringify(saved.body));
    createdIds.push(saved.body.data.id);
    const retrieved = await call(`/api/v2/freight/requests/${saved.body.data.id}`, tenantA);
    assert.equal(retrieved.status, 200);
    for (const side of ["origin", "destination"]) {
      assert.equal(retrieved.body.data[side].facilityId, null);
      assert.equal(retrieved.body.data[side].lat, withCoordinates ? manual[side].lat : null);
      assert.equal(retrieved.body.data[side].lng, withCoordinates ? manual[side].lng : null);
    }
    const manualEvaluation = await call(`/api/v2/freight/requests/${saved.body.data.id}/serviceability`, tenantA);
    assert.equal(manualEvaluation.status, 200);
    assert.ok(manualEvaluation.body.data.candidates.every((item) => item.routePreview === null));
  }
  assert.equal((await post({ ...manual, origin: { ...manual.origin, lng: undefined } }, tenantA)).status, 400);
  const canonical = await post({ ...positive.requestBody,
    origin: { ...positive.requestBody.origin, lat: 0, lng: 0 } }, tenantA);
  assert.equal(canonical.status, 201);
  createdIds.push(canonical.body.data.id);
  assert.equal(canonical.body.data.origin.lat, created.body.data.origin.lat);
  assert.equal(canonical.body.data.origin.lng, created.body.data.origin.lng);

  // R-02: only the local synthetic service changes; finally always restores it.
  const eligibleServiceId = evaluation.body.data.candidates.find((item) => item.status === "eligible").service.id;
  const serviceRead = await admin.from("carrier_services").select("service_type").eq("id", eligibleServiceId).single();
  assert.equal(serviceRead.error, null);
  changedServices.set(eligibleServiceId, serviceRead.data.service_type);
  const ltlUpdate = await admin.from("carrier_services").update({ service_type: "LTL" }).eq("id", eligibleServiceId);
  assert.equal(ltlUpdate.error, null);
  const ltl = await call(`/api/v2/freight/requests/${requestId}/serviceability`, tenantA);
  assert.equal(ltl.status, 200);
  const ltlCandidate = ltl.body.data.candidates.find((item) => item.service.id === eligibleServiceId);
  assert.equal(ltlCandidate.service.serviceClass, "LTL");
  assert.equal(ltlCandidate.status, "unknown");
  assert.ok(ltlCandidate.reasons.includes("LTL_CAPACITY_AND_CONSOLIDATION_UNVERIFIED"));
  const restored = await admin.from("carrier_services").update({ service_type: serviceRead.data.service_type }).eq("id", eligibleServiceId);
  assert.equal(restored.error, null);
  changedServices.delete(eligibleServiceId);
  assert.equal((await call(`/api/v2/freight/requests/${requestId}/serviceability`, tenantA))
    .body.data.summaryCounts.eligibleCount, 1);

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
  console.log("HAC-12 HTTP smoke PASS: cookie/Bearer, tenant, immutable snapshot, forged INSERT, full RPC DTO, totals, manual pins, LTL guard, creation/read, replay/conflict, ROAD, stale, zero.");
} finally {
  for (const [id, status] of changedMemberships) {
    const { error } = await admin.from("organization_members").update({ status }).eq("id", id);
    if (error) throw new Error("Local smoke membership restoration failed.");
  }
  for (const [id, serviceType] of changedServices) {
    const { error } = await admin.from("carrier_services").update({ service_type: serviceType }).eq("id", id);
    if (error) throw new Error("Local smoke service restoration failed.");
  }
  if (createdIds.length) {
    const { error } = await admin.from("freight_requests").delete().in("id", createdIds);
    if (error) throw new Error(`Local smoke cleanup failed: ${error.message}`);
  }
}

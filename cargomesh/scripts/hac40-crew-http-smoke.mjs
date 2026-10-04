// Explicit local synthetic scenario. Does not access hosted Supabase or provision production users.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
const appUrl = process.env.HAC40_APP_URL ?? "http://127.0.0.1:3172";
const apiUrl = process.env.NEXT_PUBLIC_SUPABASE_URL, anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const password = process.env.HAC12_LOCAL_QA_PASSWORD;
if (!apiUrl || !anonKey || !password || [appUrl, apiUrl].some(url => !["localhost", "127.0.0.1"].includes(new URL(url).hostname))) {
  throw new Error("Explicit dedicated local stack required.");
}
const root = resolve(import.meta.dirname, "../..");
const crew = JSON.parse(await readFile(resolve(root, "supabase/scenarios/v2-road-baseline/fixtures/hac40-crew.json"), "utf8"));
const fleet = JSON.parse(await readFile(resolve(root, "supabase/scenarios/v2-road-baseline/fixtures/hac40-fleet.json"), "utf8"));
const org = "c2300000-0000-4000-8000-000000000001", user = "c2310000-0000-4000-8000-000000000001";
const carrier = "c2340000-0000-4000-8000-000000000001", service = "c2360000-0000-4000-8000-000000000001";
function sql(query) { return execFileSync("docker", ["exec", "-i", "supabase_db_cargomesh-v2-local", "psql", "-X", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"], { input: query, encoding: "utf8" }).trim(); }
assert.equal(sql(`select count(*) from private.v2_catalog_grants where auth_user_id='${user}' and carrier_id='${carrier}';`), "0");
const client = createClient(apiUrl, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
const login = await client.auth.signInWithPassword({ email: "qa-v2-a@cargomesh.test", password });
assert.equal(login.error, null);
const token = login.data.session.access_token;
const ids = new Map(); let requestId = null, executionId = null;
async function call(path, body, key, accessToken = token) {
  const response = await fetch(new URL("/api/v2" + path, appUrl), { method: body ? "POST" : "GET",
    headers: { ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(body ? { "Content-Type": "application/json", "Idempotency-Key": key } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, body: await response.json() };
}
const base = kind => `/carriers/${carrier}/${kind}`;
try {
  assert.equal((await call(base("drivers"), undefined, undefined, null)).status, 401);
  assert.equal((await call(base("drivers"))).status, 403);
  sql(`insert into private.v2_catalog_grants(auth_user_id,carrier_id,permission) values('${user}','${carrier}','CARRIER_EDITOR');`);
  const positive = JSON.parse(await readFile(resolve(root, "supabase/scenarios/v2-road-baseline/fixtures/positive.json"), "utf8"));
  const request = await call("/freight/requests", positive.requestBody, crypto.randomUUID());
  assert.equal(request.status, 201, JSON.stringify(request.body)); requestId = request.body.data.id;
  executionId = crypto.randomUUID();
  sql(`insert into public.transport_executions(id,organization_id,freight_request_id,carrier_id,carrier_service_id,status,planned_starts_at,planned_ends_at)
    values('${executionId}','${org}','${requestId}','${carrier}','${service}','PLANNED','2027-01-15T00:00:00Z','2027-01-16T00:00:00Z');`);
  const assetValue = structuredClone(fleet.assets); assetValue.code = "CREW_HTTP"; assetValue.roadVehicle.plate = "QA-CREW-HTTP";
  const asset = await call(base("assets"), assetValue, crypto.randomUUID());
  assert.equal(asset.status, 201, JSON.stringify(asset.body)); ids.set("assets", asset.body.data.id);
  for (const kind of Object.keys(crew)) {
    const value = structuredClone(crew[kind]);
    if (kind === "vehicle-combinations") value.assetIds = [ids.get("assets")];
    if (kind === "driver-assignments") { value.driverId = ids.get("drivers"); value.executionId = executionId; }
    if (kind === "vehicle-assignments") { value.assetId = ids.get("assets"); value.executionId = executionId; value.reservationId = null; }
    const key = crypto.randomUUID();
    const created = await call(base(kind), value, key);
    assert.equal(created.status, 201, `${kind}: ${JSON.stringify(created.body)}`); ids.set(kind, created.body.data.id);
    const replay = await call(base(kind), value, key);
    assert.equal(replay.status, 200); assert.equal(replay.body.meta.idempotentReplay, true);
    assert.deepEqual(replay.body.data, created.body.data);
    const listed = await call(base(kind)); assert.equal(listed.status, 200);
    assert.ok(listed.body.data.some(row => row.id === ids.get(kind)));
    const read = await call(base(kind) + "/" + ids.get(kind));
    assert.equal(read.status, 200); assert.deepEqual(read.body.data, created.body.data);
    const revised = await call(base(kind) + "/" + ids.get(kind) + "/revisions", { expectedVersion: 1, value }, crypto.randomUUID());
    assert.equal(revised.status, 200, `${kind}: ${JSON.stringify(revised.body)}`); assert.equal(revised.body.data.version, 2);
    const stale = await call(base(kind) + "/" + ids.get(kind) + "/revisions", { expectedVersion: 1, value }, crypto.randomUUID());
    assert.equal(stale.status, 409); assert.equal(stale.body.error.code, "STALE_DRAFT");
    const bad = await call(base(kind), { ...value, carrierId: carrier }, crypto.randomUUID()); assert.equal(bad.status, 400);
  }
  const badConfirm = await call(base("vehicle-assignments") + "/" + ids.get("vehicle-assignments") + "/revisions",
    { expectedVersion: 2, value: { ...crew["vehicle-assignments"], executionId, assetId: ids.get("assets"), status: "CONFIRMED", reservationId: null } }, crypto.randomUUID());
  assert.equal(badConfirm.status, 400);
  sql(`update private.v2_catalog_grants set revoked_at=now() where auth_user_id='${user}' and carrier_id='${carrier}';`);
  assert.equal((await call(base("drivers"))).status, 403);
  console.log("PASS: four crew resources over Bearer HTTP: POST/list/detail/revision/replay/stale; strict inputs, auth/revocation and confirmation without reservation blocked.");
} finally {
  let cleanup = "begin;";
  for (const table of ["driver_assignments", "vehicle_assignments", "drivers", "vehicle_combinations"]) cleanup += `alter table public.${table} disable trigger crew_command_guard;`;
  for (const [kind, table] of [["driver-assignments", "driver_assignments"], ["vehicle-assignments", "vehicle_assignments"], ["drivers", "drivers"]]) {
    if (ids.has(kind)) cleanup += `delete from public.${table} where id='${ids.get(kind)}';`;
  }
  if (ids.has("vehicle-combinations")) cleanup += `delete from public.vehicle_combination_assets where combination_id='${ids.get("vehicle-combinations")}';delete from public.vehicle_combinations where id='${ids.get("vehicle-combinations")}';`;
  for (const table of ["driver_assignments", "vehicle_assignments", "drivers", "vehicle_combinations"]) cleanup += `alter table public.${table} enable trigger crew_command_guard;`;
  if (ids.has("assets")) cleanup += `delete from public.transport_assets where id='${ids.get("assets")}';`;
  if (executionId) cleanup += `delete from public.transport_executions where id='${executionId}';`;
  if (requestId) cleanup += `delete from public.freight_requests where id='${requestId}';`;
  if (ids.size) cleanup += `delete from private.v2_catalog_receipts where result->>'id' in (${[...ids.values()].map(id => `'${id}'`).join(",")});`;
  cleanup += `delete from private.v2_catalog_grants where auth_user_id='${user}' and carrier_id='${carrier}' and permission='CARRIER_EDITOR';commit;`;
  sql(cleanup);
  const restored = await client.auth.setSession({ access_token: login.data.session.access_token, refresh_token: login.data.session.refresh_token });
  assert.equal(restored.error, null); assert.equal((await client.auth.signOut({ scope: "global" })).error, null);
}

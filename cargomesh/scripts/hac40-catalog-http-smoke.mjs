// Explicit synthetic scenario against the dedicated LOCAL V2 stack only.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const appUrl = process.env.HAC40_APP_URL ?? "http://127.0.0.1:3172";
const apiUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const password = process.env.HAC12_LOCAL_QA_PASSWORD;
if (!apiUrl || !anonKey || !password || !["localhost", "127.0.0.1"].includes(new URL(apiUrl).hostname)
  || !["localhost", "127.0.0.1"].includes(new URL(appUrl).hostname)) throw new Error("Explicit local stack required.");
const root = resolve(import.meta.dirname, "../..");
const fixtures = JSON.parse(await readFile(resolve(root, "supabase/scenarios/v2-road-baseline/fixtures/hac40-catalog.json"), "utf8"));
const org = "c2300000-0000-4000-8000-000000000001";
const member = "c2320000-0000-4000-8000-000000000001";
const user = "c2310000-0000-4000-8000-000000000001";
function sql(query) {
  return execFileSync("docker", ["exec", "-i", "supabase_db_cargomesh-v2-local", "psql", "-X", "-A", "-t",
    "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"], { input: query, encoding: "utf8" }).trim();
}
const originalRole = sql(`select role from public.organization_members where id='${member}';`);
assert.ok(["OWNER", "SUPERVISOR", "REQUESTER"].includes(originalRole));
assert.equal(sql(`select count(*) from private.v2_catalog_grants where auth_user_id='${user}' and carrier_id is null;`), "0");
const client = createClient(apiUrl, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
const login = await client.auth.signInWithPassword({ email: "qa-v2-a@cargomesh.test", password });
assert.equal(login.error, null);
const token = login.data.session.access_token;
const foreign = await client.auth.signInWithPassword({ email: "qa-v2-b@cargomesh.test", password });
assert.equal(foreign.error, null);
const foreignToken = foreign.data.session.access_token;
const ids = new Map(); const keys = []; const createdRequests = [];
async function call(path, body, key, accessToken = token) {
  const response = await fetch(new URL("/api/v2" + path, appUrl), { method: body ? "POST" : "GET",
    headers: { ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(body ? { "Content-Type": "application/json", "Idempotency-Key": key } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, body: await response.json() };
}
function path(kind) {
  if (kind === "preferences") return "/organizations/current/preferences";
  if (["carriers", "cargo-categories", "cargo-profiles"].includes(kind)) return "/" + kind;
  const prefix = `/carriers/${ids.get("carriers")}`;
  return ["areas", "lanes"].includes(kind) ? `${prefix}/services/${ids.get("services")}/${kind}` : `${prefix}/${kind}`;
}
try {
  assert.equal((await call("/carriers", undefined, undefined, null)).status, 401);
  assert.equal((await call("/carriers", { schemaVersion: "2.0", ...fixtures.carriers }, crypto.randomUUID())).status, 403);
  sql(`begin; update public.organization_members set role='OWNER' where id='${member}';
    insert into private.v2_catalog_grants(auth_user_id,permission) values('${user}','CATALOG_ADMIN');commit;`);
  for (const kind of ["preferences", "cargo-categories", "cargo-profiles", "carriers", "depots", "services", "partners", "areas", "lanes"]) {
    const value = { schemaVersion: "2.0", ...structuredClone(fixtures[kind]) };
    if (kind === "cargo-profiles") value.categoryId = ids.get("cargo-categories");
    if (kind === "services") value.admittedCargoTypes = [ids.get("cargo-categories")];
    if (kind === "lanes") { value.pickupAreaId = ids.get("areas"); value.deliveryAreaId = ids.get("delivery"); }
    const key = crypto.randomUUID(); keys.push(key);
    const created = await call(path(kind), value, key);
    assert.equal(created.status, 201, `${kind}: ${JSON.stringify(created.body)}`);
    ids.set(kind, created.body.data.id);
    const replay = await call(path(kind), value, key);
    assert.equal(replay.status, 200); assert.equal(replay.body.meta.idempotentReplay, true);
    assert.deepEqual(replay.body.data, created.body.data);
    const read = await call(path(kind) + "/" + ids.get(kind));
    assert.equal(read.status, 200); assert.equal(read.body.data.id, ids.get(kind));
    const revised = await call(path(kind) + "/" + ids.get(kind) + "/revisions", { expectedVersion: 1, value }, crypto.randomUUID());
    assert.equal(revised.status, 200, `${kind}: ${JSON.stringify(revised.body)}`);
    assert.equal(revised.body.data.version, 2);
    const stale = await call(path(kind) + "/" + ids.get(kind) + "/revisions", { expectedVersion: 1, value }, crypto.randomUUID());
    assert.equal(stale.status, 409); assert.equal(stale.body.error.code, "STALE_DRAFT");
    if (kind === "areas") {
      const delivery = structuredClone(value); delivery.role = "DELIVERY"; delivery.geography.city = "Arequipa";
      const response = await call(path(kind), delivery, crypto.randomUUID());
      assert.equal(response.status, 201); ids.set("delivery", response.body.data.id);
    }
  }
  const otherTenant = await call("/cargo-profiles/" + ids.get("cargo-profiles"), undefined, undefined, foreignToken);
  assert.equal(otherTenant.status, 404);
  assert.equal((await call("/intake/options")).body.data.cargoCategories.some(x => x.code === "MINERALS"), true);
  const positive = JSON.parse(await readFile(resolve(root, "supabase/scenarios/v2-road-baseline/fixtures/positive.json"), "utf8"));
  const payload = structuredClone(positive.requestBody); payload.cargoSpecification.categoryCode = "MINERALS";
  const created = await call("/freight/requests", payload, crypto.randomUUID());
  assert.equal(created.status, 201, JSON.stringify(created.body)); createdRequests.push(created.body.data.id);
  assert.equal((await call("/freight/requests/" + created.body.data.id)).body.data.cargoSpecification.categoryCode, "MINERALS");
  const evaluation = await call("/freight/requests/" + created.body.data.id + "/serviceability");
  assert.equal(evaluation.status, 200, JSON.stringify(evaluation.body));
  assert.equal(evaluation.body.data.candidates.some(x => x.service.id === ids.get("services") && x.status === "eligible"), false);
  console.log("PASS: nine catalog aggregates POST/GET/revision/replay/stale over authenticated HTTP; cross-tenant 404; dynamic category intake and request; no invented capacity.");
} finally {
  // Cleanup only identifiers created by this test, using the privileged local SQL connection.
  const literal = entries => entries.map(x => `'${x}'`).join(",");
  const mappings = [["lanes", "service_lanes"], ["areas", "service_areas"], ["delivery", "service_areas"],
    ["services", "carrier_services"], ["depots", "carrier_depots"], ["partners", "fulfilment_partners"],
    ["cargo-profiles", "organization_cargo_profiles"], ["preferences", "organization_preferences"],
    ["carriers", "carriers"], ["cargo-categories", "cargo_categories"]];
  const createdIds = [...ids.values()];
  let cleanup = `begin;delete from private.v2_catalog_grants where auth_user_id='${user}' and carrier_id is null;`;
  if (createdRequests.length) cleanup += `delete from public.freight_requests where id in (${literal(createdRequests)});`;
  if (createdIds.length) cleanup += `delete from private.v2_catalog_receipts where result->>'id' in (${literal(createdIds)});`;
  if (ids.has("services")) cleanup += `delete from public.carrier_service_cargo_categories where carrier_service_id='${ids.get("services")}';`;
  for (const [kind, table] of mappings) if (ids.has(kind)) cleanup += `delete from public.${table} where id='${ids.get(kind)}';`;
  cleanup += `update public.organization_members set role='${originalRole}' where id='${member}';commit;`;
  sql(cleanup);
  for (const session of [login.data.session, foreign.data.session]) {
    const sessionClient = createClient(apiUrl, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const restored = await sessionClient.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token });
    assert.equal(restored.error, null);
    const revoked = await sessionClient.auth.signOut({ scope: "global" });
    assert.equal(revoked.error, null);
  }
}

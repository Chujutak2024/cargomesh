import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { createServerClient } from "@supabase/ssr";
import { CreateFreightRequestInputSchema, CreatedFreightRequestSchema } from "@/shared/schemas/freight-creation";

// This optional suite calls the running Next route and local Supabase, without
// substituting the MCP handler, auth or persistence service.
const base = process.env.MCP_LOCAL_BASE_URL ?? "http://127.0.0.1:3100";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const password = process.env.CARGOMESH_MCP_TEST_PASSWORD ?? "";
const supervisorEmail = process.env.CARGOMESH_MCP_TEST_SUPERVISOR_EMAIL ?? "demo.operator@cargomesh.test";
const requesterEmail = "mcp.requester@cargomesh.test";
const organizationId = "a0000000-0000-0000-0000-000000000001";
const supervisorMemberId = "e0000000-0000-0000-0000-000000000001";

function localOnly(value: string) {
  const url = new URL(value);
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(url.hostname), "integration targets must be local");
  assert.ok(["http:", "https:"].includes(url.protocol));
}

function clientWithCookies() {
  const jar = new Map<string, string>();
  const client = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (items: { name: string; value: string }[]) => {
        for (const { name, value } of items) {
          if (value) jar.set(name, value);
          else jar.delete(name);
        }
      },
    },
  });
  return { client, cookie: () => [...jar].map(([name, value]) => `${name}=${encodeURIComponent(value)}`).join("; ") };
}

function input() {
  const day = 24 * 60 * 60 * 1000;
  const tomorrow = Date.now() + day;
  return CreateFreightRequestInputSchema.parse({
    idempotencyKey: randomUUID(),
    fields: {
      cargoCategoryCode: "MACHINERY",
      originCountry: "PE", originRegion: "Callao", originCity: "Callao",
      destinationCountry: "CL", destinationRegion: "Región Metropolitana", destinationCity: "Santiago",
      cargoEntryMethod: "PALLETS", entryQuantity: 2, entryUnitWeightKg: 800, unitsPerEntry: 1,
      entryLengthCm: 120, entryWidthCm: 100, entryHeightCm: 150,
      pickupMode: "SCHEDULED", pickupWindowStart: new Date(tomorrow).toISOString(),
      pickupWindowEnd: new Date(tomorrow + day).toISOString(),
      deliveryDeadline: new Date(tomorrow + 4 * day).toISOString(),
      budgetMax: null, availableDocuments: [],
    },
  });
}

let rpcId = 0;
async function rpc(method: string, params: unknown, cookie = "") {
  const response = await fetch(`${base}/mcp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json", Accept: "application/json, text/event-stream",
      "MCP-Protocol-Version": "2025-11-25", ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++rpcId, method, params }),
  });
  return { status: response.status, body: await response.json() };
}

function toolResult(body: any) {
  assert.ok(body.result, JSON.stringify(body));
  const result = body.result;
  assert.deepEqual(JSON.parse(result.content[0].text), result.structuredContent);
  return result;
}

test("real /mcp creates and reads a local Supabase draft; failures stay safe", { timeout: 120_000 }, async (t) => {
  assert.ok(supabaseUrl && anonKey && password, "set local Supabase URL, anon key and test password");
  localOnly(base);
  localOnly(supabaseUrl);

  const anonymous = await rpc("tools/call", { name: "create_freight_request", arguments: input() });
  assert.equal(anonymous.status, 401);
  assert.doesNotMatch(JSON.stringify(anonymous.body), /postgres|password|secret|SQL/i);

  const supervisor = clientWithCookies();
  const signedIn = await supervisor.client.auth.signInWithPassword({ email: supervisorEmail, password });
  assert.ifError(signedIn.error);
  assert.ok(supervisor.cookie(), "Supabase SSR sign-in should set a session cookie");

  const listed = await rpc("tools/list", {}, supervisor.cookie());
  assert.equal(listed.status, 200, JSON.stringify(listed.body));
  const createTool = listed.body.result.tools.find((item: { name: string }) => item.name === "create_freight_request");
  assert.ok(createTool);
  assert.deepEqual(createTool.inputSchema.required, ["idempotencyKey", "fields"]);
  assert.equal(createTool.inputSchema.additionalProperties, false);
  assert.equal(createTool.inputSchema.properties.fields.additionalProperties, false);

  const args = input();
  const createdResponse = await rpc("tools/call", { name: "create_freight_request", arguments: args }, supervisor.cookie());
  assert.equal(createdResponse.status, 200, JSON.stringify(createdResponse.body));
  const created = toolResult(createdResponse.body);
  assert.equal(created.isError, undefined);
  assert.equal(created.structuredContent.ok, true);
  const receipt = CreatedFreightRequestSchema.parse(created.structuredContent.data);
  t.after(() => {
    // pgTAP's Golden Flow fixture expects exactly FR-1042. Remove only this
    // test's receipt through the local Docker database, never app credentials.
    const sql = `delete from public.freight_requests where id = '${receipt.freightRequestId}' and organization_id = '${organizationId}' and requested_by_member_id = '${supervisorMemberId}' and creation_idempotency_key = '${args.idempotencyKey}' and status = 'DRAFT'`;
    const result = execFileSync("docker", ["exec", "supabase_db_cargomesh", "psql", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres", "-c", sql], { encoding: "utf8" });
    assert.match(result, /DELETE 1/);
  });
  assert.equal(receipt.status, "DRAFT");
  assert.equal(receipt.draftVersion, 1);
  assert.equal(receipt.replayed, false);

  const { data: row, error: rowError } = await supervisor.client.from("freight_requests")
    .select("id, code, organization_id, requested_by_member_id, status, draft_version, origin_country, origin_region, origin_city, destination_country, destination_region, destination_city, cargo_entry_method, entry_quantity, entry_unit_weight_kg, cargo_weight_kg, service_type, transport_mode, optimization_strategy, creation_idempotency_key")
    .eq("id", receipt.freightRequestId).single();
  assert.ifError(rowError);
  assert.ok(row);
  assert.equal(row.id, receipt.freightRequestId);
  assert.equal(row.code, receipt.requestCode);
  assert.equal(row.organization_id, organizationId);
  assert.equal(row.requested_by_member_id, supervisorMemberId);
  assert.equal(row.status, "DRAFT");
  assert.equal(row.draft_version, 1);
  assert.equal(row.origin_country, "PE");
  assert.equal(row.origin_region, "Callao");
  assert.equal(row.origin_city, "Callao");
  assert.equal(row.destination_country, "CL");
  assert.equal(row.destination_city, "Santiago");
  assert.equal(row.cargo_entry_method, "PALLETS");
  assert.equal(row.entry_quantity, 2);
  assert.equal(Number(row.entry_unit_weight_kg), 800);
  assert.equal(Number(row.cargo_weight_kg), 1600);
  assert.equal(row.service_type, "FTL");
  assert.equal(row.transport_mode, "ROAD");
  assert.equal(row.optimization_strategy, "BALANCED");
  assert.equal(row.creation_idempotency_key, args.idempotencyKey);

  const replay = toolResult((await rpc("tools/call", { name: "create_freight_request", arguments: args }, supervisor.cookie())).body);
  assert.equal(replay.structuredContent.data.freightRequestId, receipt.freightRequestId);
  assert.equal(replay.structuredContent.data.replayed, true);

  const conflict = toolResult((await rpc("tools/call", { name: "create_freight_request", arguments: {
    ...args, fields: { ...args.fields, entryQuantity: 3 },
  } }, supervisor.cookie())).body);
  assert.equal(conflict.isError, true);
  assert.equal(conflict.structuredContent.error.code, "IDEMPOTENCY_CONFLICT");

  const requester = clientWithCookies();
  const requesterSignIn = await requester.client.auth.signInWithPassword({ email: requesterEmail, password });
  assert.ifError(requesterSignIn.error);
  const forbidden = toolResult((await rpc("tools/call", { name: "create_freight_request", arguments: input() }, requester.cookie())).body);
  assert.equal(forbidden.isError, true);
  assert.equal(forbidden.structuredContent.error.code, "FORBIDDEN");

  const invalid = (await rpc("tools/call", { name: "create_freight_request", arguments: {
    ...input(), fields: { ...args.fields, cargoEntryMethod: "TOTAL_WEIGHT" },
  } }, supervisor.cookie())).body.result;
  assert.equal(invalid.isError, true);
  assert.doesNotMatch(JSON.stringify(invalid), /password|secret|postgres|SQL/i);

  // Valid MCP input but outside PostgreSQL numeric(14,2): a real INSERT failure.
  const failedInput = { ...input(), fields: { ...args.fields, budgetMax: 10_000_000_000_000 } };
  const failed = toolResult((await rpc("tools/call", { name: "create_freight_request", arguments: failedInput }, supervisor.cookie())).body);
  assert.equal(failed.isError, true);
  assert.equal(failed.structuredContent.error.code, "DRAFT_CREATION_UNAVAILABLE");
  assert.doesNotMatch(JSON.stringify(failed), /numeric field overflow|postgres|SQL|budget_max|password|secret/i);
  const { data: failedRows, error: failedRowsError } = await supervisor.client.from("freight_requests")
    .select("id").eq("creation_idempotency_key", failedInput.idempotencyKey);
  assert.ifError(failedRowsError);
  assert.deepEqual(failedRows, []);
});

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { createServerClient } from "@supabase/ssr";
import { CreateFreightRequestInputSchema, CreatedFreightRequestSchema } from "@/shared/schemas/freight-creation";
import { createUserAccessSupabaseClient } from "@/server/db/supabase/user-access";

// This optional suite calls the running Next route and local Supabase, without
// substituting the MCP handler, auth or persistence service.
const base = process.env.MCP_LOCAL_BASE_URL ?? "http://127.0.0.1:3100";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const password = process.env.CARGOMESH_MCP_TEST_PASSWORD ?? "";
const supervisorEmail = process.env.CARGOMESH_MCP_TEST_SUPERVISOR_EMAIL ?? "demo.operator@cargomesh.test";
const requesterEmail = "mcp.requester@cargomesh.test";
const isolatedEmail = "mcp.isolated@cargomesh.test";
const organizationId = "a0000000-0000-0000-0000-000000000001";
const supervisorMemberId = "e0000000-0000-0000-0000-000000000001";

type WorkerAttemptEvidence = {
  carrierCode: string;
  status: string;
  completedTools: string[];
};

type FinalOfferEvidence = {
  carrierCode: string;
  providerOfferReference: string;
  totalPrice: number;
  score: number;
  rank: number;
  recommended: boolean;
};

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

function autonomousWorkerInput() {
  const baseline = input();
  return CreateFreightRequestInputSchema.parse({
    ...baseline,
    fields: {
      ...baseline.fields,
      originRegion: "Callao",
      originCity: "Lima",
      destinationRegion: "Santiago",
      destinationCity: "Valparaiso",
      entryQuantity: 3,
      entryUnitWeightKg: 950,
      budgetMax: 3_500,
      availableDocuments: [
        "COMMERCIAL_INVOICE",
        "PACKING_LIST",
        "CERTIFICATE_OF_ORIGIN",
      ],
    },
  });
}

let rpcId = 0;
async function rpc(method: string, params: unknown, cookie = "") {
  const response = await fetch(`${base}/mcp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json", Accept: "application/json, text/event-stream",
      "MCP-Protocol-Version": "2025-11-25", Connection: "close",
      ...(cookie ? { Cookie: cookie } : {}),
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

function localSql(sql: string) {
  return execFileSync("docker", ["exec", "supabase_db_cargomesh", "psql", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres", "-c", sql], { encoding: "utf8" });
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

test("real MCP flow reaches provider WebMCP through the autonomous browser worker", { timeout: 240_000 }, async (t) => {
  assert.ok(supabaseUrl && anonKey && password);
  localOnly(base);
  localOnly(supabaseUrl);

  const supervisor = clientWithCookies();
  assert.ifError((await supervisor.client.auth.signInWithPassword({ email: supervisorEmail, password })).error);
  const args = autonomousWorkerInput();
  const created = toolResult((await rpc("tools/call", {
    name: "create_freight_request", arguments: args,
  }, supervisor.cookie())).body);
  assert.equal(created.structuredContent.ok, true);
  const receipt = CreatedFreightRequestSchema.parse(created.structuredContent.data);
  t.after(() => {
    const result = localSql(`delete from public.freight_requests where id = '${receipt.freightRequestId}' and organization_id = '${organizationId}' and requested_by_member_id = '${supervisorMemberId}' and creation_idempotency_key = '${args.idempotencyKey}'`);
    assert.match(result, /DELETE 1/);
  });
  const { data: dynamicRequest, error: dynamicRequestError } = await supervisor.client
    .from("freight_requests")
    .select("origin_city,destination_city,cargo_weight_kg,budget_max")
    .eq("id", receipt.freightRequestId)
    .single();
  assert.ifError(dynamicRequestError);
  assert.equal(dynamicRequest?.origin_city, "Lima");
  assert.equal(dynamicRequest?.destination_city, "Valparaiso");
  assert.equal(Number(dynamicRequest?.cargo_weight_kg), 2_850);
  assert.equal(Number(dynamicRequest?.budget_max), 3_500);

  const key = `mcp-find-${randomUUID()}`;
  const findArgs = { freightRequestId: receipt.freightRequestId, idempotencyKey: key };
  const draftFind = toolResult((await rpc("tools/call", {
    name: "find_freight_options", arguments: findArgs,
  }, supervisor.cookie())).body);
  assert.equal(draftFind.isError, true);
  assert.equal(draftFind.structuredContent.error.code, "FREIGHT_REQUEST_NOT_READY");

  const submissionArgs = { freightRequestId: receipt.freightRequestId, draftVersion: receipt.draftVersion };
  const requester = clientWithCookies();
  assert.ifError((await requester.client.auth.signInWithPassword({ email: requesterEmail, password })).error);
  const deniedSubmit = toolResult((await rpc("tools/call", {
    name: "submit_freight_request", arguments: submissionArgs,
  }, requester.cookie())).body);
  assert.equal(deniedSubmit.structuredContent.error.code, "FORBIDDEN");
  const submitted = toolResult((await rpc("tools/call", {
    name: "submit_freight_request", arguments: submissionArgs,
  }, supervisor.cookie())).body);
  assert.equal(submitted.structuredContent.ok, true, JSON.stringify(submitted.structuredContent));
  assert.equal(submitted.structuredContent.data.status, "PENDING");
  assert.equal(submitted.structuredContent.data.draftVersion, receipt.draftVersion + 1);
  assert.equal(submitted.structuredContent.data.replayed, false);
  const { data: confirmedRow, error: confirmedError } = await supervisor.client.from("freight_requests")
    .select("status,draft_version,confirmed_at,confirmed_by_member_id")
    .eq("id", receipt.freightRequestId).single();
  assert.ifError(confirmedError);
  assert.equal(confirmedRow?.status, "PENDING");
  assert.equal(confirmedRow?.draft_version, receipt.draftVersion + 1);
  assert.equal(confirmedRow?.confirmed_by_member_id, supervisorMemberId);
  assert.ok(confirmedRow?.confirmed_at);
  const submissionReplay = toolResult((await rpc("tools/call", {
    name: "submit_freight_request", arguments: submissionArgs,
  }, supervisor.cookie())).body);
  assert.equal(submissionReplay.structuredContent.data.replayed, true);

  const find = toolResult((await rpc("tools/call", {
    name: "find_freight_options", arguments: findArgs,
  }, supervisor.cookie())).body);
  assert.equal(find.structuredContent.ok, true);
  const started = find.structuredContent.data;
  assert.equal(started.freightRequestId, receipt.freightRequestId);
  assert.equal(started.status, "RUNNING");
  assert.equal(started.deduplicated, false);
  assert.ok(started.candidates.length > 0);

  const { data: run, error: runError } = await supervisor.client.from("orchestration_runs")
    .select("id,freight_request_id,status,idempotency_key,candidate_snapshot")
    .eq("id", started.runId).single();
  assert.ifError(runError);
  assert.equal(run?.freight_request_id, receipt.freightRequestId);
  assert.equal(run?.status, "RUNNING");
  assert.equal(run?.idempotency_key, key);
  assert.deepEqual(run?.candidate_snapshot, started.candidates);

  const replay = toolResult((await rpc("tools/call", {
    name: "find_freight_options", arguments: findArgs,
  }, supervisor.cookie())).body);
  assert.equal(replay.structuredContent.data.runId, started.runId);
  assert.equal(replay.structuredContent.data.deduplicated, true);

  const getArgs = { runId: started.runId };
  const loading = toolResult((await rpc("tools/call", {
    name: "get_freight_options", arguments: getArgs,
  }, supervisor.cookie())).body);
  assert.equal(loading.structuredContent.data.status, "loading");
  assert.equal(loading.structuredContent.data.candidateCount, started.candidates.length);
  assert.deepEqual(loading.structuredContent.data.offers, []);

  const anonymousFind = await rpc("tools/call", { name: "find_freight_options", arguments: findArgs });
  const anonymousGet = await rpc("tools/call", { name: "get_freight_options", arguments: getArgs });
  assert.equal(anonymousFind.status, 401);
  assert.equal(anonymousGet.status, 401);
  const isolated = clientWithCookies();
  const isolatedSignIn = await isolated.client.auth.signInWithPassword({ email: isolatedEmail, password });
  assert.ifError(isolatedSignIn.error);
  assert.ok(isolatedSignIn.data.session?.access_token);
  const isolatedBearerClient = createUserAccessSupabaseClient(isolatedSignIn.data.session!.access_token);
  const { data: bearerVisible, error: bearerReadError } = await isolatedBearerClient
    .from("freight_requests").select("id").eq("id", receipt.freightRequestId);
  assert.ifError(bearerReadError);
  assert.deepEqual(bearerVisible, [], "Supabase Bearer + RLS must hide another organization's request");
  const { data: bearerMutated, error: bearerMutationError } = await isolatedBearerClient
    .from("freight_requests").update({ cargo_description: "cross-tenant mutation" })
    .eq("id", receipt.freightRequestId).select("id");
  assert.ifError(bearerMutationError);
  assert.deepEqual(bearerMutated, [], "Supabase Bearer + RLS must prevent another organization's mutation");
  const crossOrgFind = toolResult((await rpc("tools/call", {
    name: "find_freight_options", arguments: findArgs,
  }, isolated.cookie())).body);
  const crossOrgGet = toolResult((await rpc("tools/call", {
    name: "get_freight_options", arguments: getArgs,
  }, isolated.cookie())).body);
  assert.equal(crossOrgFind.structuredContent.error.code, "NOT_FOUND");
  assert.equal(crossOrgGet.structuredContent.error.code, "NOT_FOUND");
  const crossOrgSubmit = toolResult((await rpc("tools/call", {
    name: "submit_freight_request", arguments: submissionArgs,
  }, isolated.cookie())).body);
  assert.equal(crossOrgSubmit.structuredContent.error.code, "NOT_FOUND");
  const secondKey = toolResult((await rpc("tools/call", {
    name: "find_freight_options", arguments: { ...findArgs, idempotencyKey: randomUUID() },
  }, supervisor.cookie())).body);
  assert.equal(secondKey.structuredContent.error.code, "FREIGHT_REQUEST_NOT_READY");

  const workerOutput = execFileSync(
    process.execPath,
    ["scripts/autonomous-webmcp-worker.mjs", started.runId],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      timeout: 200_000,
      env: {
        ...process.env,
        CARGOMESH_WEBMCP_WORKER_BASE_URL: base,
        CARGOMESH_WEBMCP_WORKER_AUTH: "cookie",
        CARGOMESH_WEBMCP_WORKER_COOKIE: supervisor.cookie(),
      },
    },
  );
  const workerEvidence = JSON.parse(workerOutput);
  assert.equal(workerEvidence.worker, "AUTONOMOUS_PROVIDER_EXECUTION_V1");
  assert.equal(workerEvidence.providerKind, "DEMO_AUTO_OFFER_CARRIERS");
  assert.equal(workerEvidence.runId, started.runId);
  assert.equal(workerEvidence.status, "success", JSON.stringify(workerEvidence));
  const workerView = workerEvidence.viewModel as {
    candidateCount: number;
    attempts: WorkerAttemptEvidence[];
  };
  assert.equal(workerView.candidateCount, 3);
  assert.deepEqual(
    workerView.attempts.map((attempt) => ({
      carrierCode: attempt.carrierCode,
      status: attempt.status,
      completedTools: attempt.completedTools,
    })),
    ["ANDES", "INCA", "PACIFIC"].map((carrierCode) => ({
      carrierCode,
      status: "QUOTED",
      completedTools: ["check_service_coverage", "check_capacity", "quote_freight"],
    })),
  );

  const { data: events, error: eventsError } = await supervisor.client
    .from("orchestration_events")
    .select("carrier_id,tool_name,input_payload,output_payload,status,execution_status,persisted_entity_type,persisted_entity_id")
    .eq("orchestration_run_id", started.runId);
  assert.ifError(eventsError);
  assert.equal(events?.length, 9);
  for (const event of events ?? []) {
    const toolInput = event.input_payload as Record<string, unknown>;
    assert.equal(toolInput.origin, "Lima, PE");
    assert.equal(toolInput.destination, "Valparaiso, CL");
    assert.equal(event.status, "SUCCEEDED");
    assert.equal(event.execution_status, "COMPLETED");
    assert.equal((event.output_payload as { ok?: unknown })?.ok, true);
    if (event.tool_name === "quote_freight") {
      assert.equal(event.persisted_entity_type, "CARRIER_OFFER");
      assert.ok(event.persisted_entity_id);
    }
  }

  const complete = toolResult((await rpc("tools/call", {
    name: "get_freight_options", arguments: getArgs,
  }, supervisor.cookie())).body);
  assert.equal(complete.structuredContent.ok, true);
  assert.equal(complete.structuredContent.data.status, "success");
  assert.ok(complete.structuredContent.data.offers.length > 0);
  const finalOffers = complete.structuredContent.data.offers as FinalOfferEvidence[];
  const { data: offers, error: offersError } = await supervisor.client.from("carrier_offers")
    .select("id,carrier_id,price").eq("orchestration_run_id", started.runId);
  assert.ifError(offersError);
  assert.equal(offers?.length, complete.structuredContent.data.offers.length);
  assert.ok(offers?.some((offer) => offer.id === complete.structuredContent.data.ranking.recommendedOfferId));

  const [{ data: finalRequest, error: finalRequestError }, { data: finalRun, error: finalRunError }, { data: decision, error: decisionError }] =
    await Promise.all([
      supervisor.client.from("freight_requests").select("status").eq("id", receipt.freightRequestId).single(),
      supervisor.client.from("orchestration_runs").select("status").eq("id", started.runId).single(),
      supervisor.client.from("freight_decisions")
        .select("optimization_strategy,recommended_offer_id,confidence_score,ranking_snapshot")
        .eq("orchestration_run_id", started.runId)
        .single(),
    ]);
  assert.ifError(finalRequestError);
  assert.ifError(finalRunError);
  assert.ifError(decisionError);
  assert.equal(finalRequest?.status, "AWAITING_SELECTION");
  assert.equal(finalRun?.status, "OPTIONS_READY");
  assert.equal(decision?.optimization_strategy, "BALANCED");
  assert.equal(decision?.recommended_offer_id, complete.structuredContent.data.ranking.recommendedOfferId);

  console.log("AUTONOMOUS_MCP_GOLDEN_FLOW_EVIDENCE", JSON.stringify({
    request: {
      id: receipt.freightRequestId,
      code: receipt.requestCode,
      origin: "Lima, PE",
      destination: "Valparaiso, CL",
      cargoWeightKg: 2_850,
      budgetMax: 3_500,
      status: finalRequest?.status,
    },
    run: { id: started.runId, status: finalRun?.status },
    providers: workerView.attempts.map((attempt) => ({
      carrierCode: attempt.carrierCode,
      completedTools: attempt.completedTools,
    })),
    offers: finalOffers.map((offer) => ({
      carrierCode: offer.carrierCode,
      providerOfferReference: offer.providerOfferReference,
      totalPrice: offer.totalPrice,
      score: offer.score,
      rank: offer.rank,
      recommended: offer.recommended,
    })),
    decision: {
      strategy: decision?.optimization_strategy,
      confidence: Number(decision?.confidence_score),
      recommendedOfferId: decision?.recommended_offer_id,
    },
    resultBridgeEventCount: events?.length,
    getFreightOptionsStatus: complete.structuredContent.data.status,
  }));
});

test("V2 QA tenants: valid A session operates; valid B token and MCP session cannot use A request", { timeout: 120_000 }, async (t) => {
  assert.ok(supabaseUrl && anonKey, "set local Supabase URL and anon key");
  localOnly(base);
  localOnly(supabaseUrl);
  const qaPassword = process.env.CARGOMESH_MCP_QA_TEST_PASSWORD ?? "";
  assert.ok(qaPassword, "set the local-only V2 QA scenario password");

  const tenantA = clientWithCookies();
  const tenantB = clientWithCookies();
  const signedA = await tenantA.client.auth.signInWithPassword({ email: "qa-v2-a@cargomesh.test", password: qaPassword });
  const signedB = await tenantB.client.auth.signInWithPassword({ email: "qa-v2-b@cargomesh.test", password: qaPassword });
  assert.ifError(signedA.error);
  assert.ifError(signedB.error);
  assert.ok(signedA.data.session?.access_token, "tenant A has a valid Supabase access token");
  assert.ok(signedB.data.session?.access_token, "tenant B has a valid Supabase access token");

  const userBearerResponse = await fetch(`${base}/mcp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json", Accept: "application/json, text/event-stream",
      "MCP-Protocol-Version": "2025-11-25",
      Authorization: `Bearer ${signedA.data.session!.access_token}`,
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++rpcId, method: "tools/list", params: {} }),
  });
  assert.equal(userBearerResponse.status, 401,
    "valid local user Bearer must fail closed while user OAuth/linking is unavailable");

  const listed = await rpc("tools/list", {}, tenantA.cookie());
  assert.equal(listed.status, 200, "positive control: tenant A authenticates to MCP");
  const args = input();
  const created = toolResult((await rpc("tools/call", {
    name: "create_freight_request", arguments: args,
  }, tenantA.cookie())).body);
  assert.equal(created.structuredContent.ok, true, "positive control: tenant A business tool operates");
  const receipt = CreatedFreightRequestSchema.parse(created.structuredContent.data);
  t.after(() => {
    const result = localSql(`delete from public.freight_requests where id = '${receipt.freightRequestId}' and organization_id = 'c2300000-0000-4000-8000-000000000001' and requested_by_member_id = 'c2320000-0000-4000-8000-000000000001' and creation_idempotency_key = '${args.idempotencyKey}'`);
    assert.match(result, /DELETE 1/);
  });

  const { data: ownRows, error: ownReadError } = await tenantA.client.from("freight_requests")
    .select("id").eq("id", receipt.freightRequestId);
  assert.ifError(ownReadError);
  assert.deepEqual(ownRows?.map((row) => row.id), [receipt.freightRequestId],
    "positive control: tenant A can read the request it created");

  const tenantBBearerClient = createUserAccessSupabaseClient(signedB.data.session!.access_token);
  const { data: foreignRows, error: foreignReadError } = await tenantBBearerClient
    .from("freight_requests").select("id").eq("id", receipt.freightRequestId);
  assert.ifError(foreignReadError);
  assert.deepEqual(foreignRows, [], "valid tenant B Bearer cannot read tenant A request through RLS");

  const submitArgs = { freightRequestId: receipt.freightRequestId, draftVersion: receipt.draftVersion };
  const rejected = toolResult((await rpc("tools/call", {
    name: "submit_freight_request", arguments: submitArgs,
  }, tenantB.cookie())).body);
  assert.equal(rejected.structuredContent.error.code, "NOT_FOUND",
    "valid tenant B MCP session cannot operate on tenant A request");
  const submitted = toolResult((await rpc("tools/call", {
    name: "submit_freight_request", arguments: submitArgs,
  }, tenantA.cookie())).body);
  assert.equal(submitted.structuredContent.ok, true, "positive control: tenant A can submit its request");
  assert.equal(submitted.structuredContent.data.status, "PENDING");
});

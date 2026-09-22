import assert from "node:assert/strict";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { OrchestrationError, type OrchestrationViewModel } from "@/features/orchestration/contracts";
import { buildOrchestrationViewModel, type ViewModelSource } from "@/features/orchestration/view-model";
import { createMcpHttpHandler } from "./http";
import { testMcpUserPrincipal } from "./auth/test-principal";
import type { McpPrincipal } from "./auth/principal";
import { authenticateMcpRequest } from "./auth/context";
import { issueMcpServiceToken, verifyMcpServiceToken } from "./auth/service-token";
import { TEST_SERVICE_AUTH } from "./auth/test-configuration";

const RUN = "90000000-0000-0000-0000-000000000001";
const REQUEST = "f2000000-0000-0000-0000-000000000001";
const OFFER = "a0000000-0000-0000-0000-000000000001";
const CARRIER = "b0000000-0000-0000-0000-000000000001";
const SERVICE = "d0000000-0000-0000-0000-000000000001";
const URL = "http://localhost:3000/mcp";
const REMOTE_ORIGIN = "https://mcp.cargomesh.test";
const REMOTE_URL = `${REMOTE_ORIGIN}/mcp`;
const headers = { Accept: "application/json, text/event-stream", "Content-Type": "application/json" };

function view(status = "RUNNING"): OrchestrationViewModel {
  const source: ViewModelSource = {
    run: {
      id: RUN, freight_request_id: REQUEST, status,
      started_at: "2026-09-18T12:00:00Z", completed_at: status === "RUNNING" ? null : "2026-09-18T12:01:00Z",
      error_code: null, error_message: null,
      candidate_snapshot: [{ carrierId: CARRIER, carrierCode: "ANDES", displayName: "Andes",
        providerUrl: "/providers/andes", matchingServiceId: SERVICE }],
      result_snapshot: status === "OPTIONS_READY" || status === "NO_MATCH" ? {
        orchestrationRunId: RUN, strategy: "BALANCED", recommendedOfferId: status === "NO_MATCH" ? null : OFFER,
        decisionConfidence: 88, options: status === "NO_MATCH" ? [] : [{
          offerId: OFFER, rank: 1, rawScore: 89, roundedScore: 89, eligible: true, reasons: ["Balanced option"],
        }],
      } : null,
    },
    freightRequest: { id: REQUEST, code: "FR-1042", organization_id: "org-a" },
    events: [],
    offers: status === "OPTIONS_READY" ? [{
      id: OFFER, carrier_id: CARRIER, carrier_service_id: SERVICE,
      provider_offer_reference: "AND-QUOTE-1", price: 1760, currency: "USD", transit_hours: 31,
    }] : [],
  };
  return buildOrchestrationViewModel(source);
}

type Options = {
  enabled?: boolean; environment?: string; mode?: "local" | "remote"; authError?: Error;
  canonicalOrigin?: string; allowedOrigins?: string;
  principal?: McpPrincipal;
  read?: (id: string) => Promise<OrchestrationViewModel>;
};
function harness(options: Options = {}) {
  const calls: string[] = [];
  let authCalls = 0;
  const handle = createMcpHttpHandler({
    configuration: () => ({
      mode: options.mode ?? "local",
      environment: options.environment ?? "test",
      localEnabled: options.mode === "remote" ? false : options.enabled ?? true,
      remoteEnabled: options.mode === "remote" ? options.enabled ?? true : false,
      canonicalOrigin: options.canonicalOrigin,
      allowedOrigins: options.allowedOrigins,
    }),
    authenticate: async () => { authCalls++; if (options.authError) throw options.authError; return options.principal ?? testMcpUserPrincipal(); },
    read: async (id) => { calls.push(id); return options.read ? options.read(id) : view(); },
  });
  return { handle, calls, authCalls: () => authCalls };
}
function rpc(method: string, params: unknown = {}, overrides: RequestInit = {}, url = URL) {
  return new Request(url, {
    method: "POST", headers, body: JSON.stringify({ jsonrpc: "2.0", id: 7, method, params }), ...overrides,
  });
}
const call = (args: unknown = { runId: RUN }) => rpc("tools/call", { name: "get_freight_options", arguments: args });

test("official MCP client initializes, lists and calls the actual HTTP/SDK stack", async () => {
  const h = harness();
  const transport = new StreamableHTTPClientTransport(new globalThis.URL(URL), {
    fetch: async (input, init) => h.handle(new Request(input, init)),
  });
  const client = new Client({ name: "cargomesh-test", version: "1.0.0" });
  try {
    await client.connect(transport);
    assert.equal(client.getServerVersion()?.name, "cargomesh");
    const { tools } = await client.listTools();
    assert.deepEqual(tools.map((tool) => tool.name), ["get_freight_options", "create_freight_request", "submit_freight_request", "find_freight_options"]);
    assert.equal(tools[0].annotations?.readOnlyHint, true);
    assert.equal(tools[0].annotations?.destructiveHint, false);
    assert.equal(tools[0].inputSchema.additionalProperties, false);
    assert.ok(tools[0].outputSchema);
    const result = await client.callTool({ name: "get_freight_options", arguments: { runId: RUN } });
    assert.deepEqual(result.structuredContent, { ok: true, data: view() });
    assert.deepEqual(h.calls, [RUN]);
    assert.ok(h.authCalls() >= 4); // initialize, initialized, list, call
  } finally { await client.close(); }
});

test("initialize negotiates 2025-11-25 without an MCP session or caching", async () => {
  const h = harness();
  const response = await h.handle(rpc("initialize", {
    protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "test", version: "1" },
  }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("mcp-session-id"), null);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const body = await response.json();
  assert.equal(body.id, 7);
  assert.equal(body.result.protocolVersion, "2025-11-25");
  assert.deepEqual(h.calls, []);
});

test("initialized notification is acknowledged with 202 and no body", async () => {
  const h = harness();
  const response = await h.handle(new Request(URL, {
    method: "POST", headers,
    body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
  }));
  assert.equal(response.status, 202);
  assert.equal(await response.text(), "");
  assert.deepEqual(h.calls, []);
});

for (const status of ["RUNNING", "OPTIONS_READY", "NO_MATCH", "FAILED", "CANCELLED"]) {
  test(`serializes real view builder output for ${status} without changing ranking`, async () => {
    const original = view(status);
    const h = harness({ read: async () => original });
    const body = await (await h.handle(call())).json();
    assert.equal(body.result.isError, undefined);
    const data = body.result.structuredContent.data;
    assert.equal(data.status, original.status);
    assert.deepEqual(data.ranking, original.ranking);
    assert.deepEqual(data.offers, original.offers);
    assert.deepEqual(JSON.parse(body.result.content[0].text), body.result.structuredContent);
  });
}

test("invalid UUID, missing arguments and unknown keys never reach the service", async () => {
  const h = harness();
  for (const args of [{ runId: "not-a-uuid" }, {}, { runId: RUN, organizationId: "other" }]) {
    const body = await (await h.handle(call(args))).json();
    assert.equal(body.result.isError, true);
  }
  assert.deepEqual(h.calls, []);
});

test("unregistered mutation tools and unknown protocol methods do not reach domain code", async () => {
  const h = harness();
  for (const name of ["authorize_and_book", "get_booking_status", "recover_booking"]) {
    const body = await (await h.handle(rpc("tools/call", { name, arguments: {} }))).json();
    assert.ok(body.error || body.result?.isError);
  }
  const unknown = await (await h.handle(rpc("not/a/method"))).json();
  assert.equal(unknown.error.code, -32601);
  assert.deepEqual(h.calls, []);
});

test("disabled and production local endpoints fail closed before authentication", async () => {
  for (const options of [{ enabled: false }, { environment: "production" }]) {
    const h = harness(options);
    assert.equal((await h.handle(call())).status, 404);
    assert.equal(h.authCalls(), 0);
    assert.deepEqual(h.calls, []);
  }
});

test("Next.js route exports the local handler and is disabled without opt-in", async () => {
  const previous = process.env.CARGOMESH_MCP_LOCAL_ENABLED;
  delete process.env.CARGOMESH_MCP_LOCAL_ENABLED;
  try {
    const route = await import("@/app/mcp/route");
    assert.equal(route.runtime, "nodejs");
    assert.equal(route.dynamic, "force-dynamic");
    for (const handler of [route.POST, route.GET, route.DELETE]) {
      assert.equal((await handler(call())).status, 404);
    }
  } finally {
    if (previous === undefined) delete process.env.CARGOMESH_MCP_LOCAL_ENABLED;
    else process.env.CARGOMESH_MCP_LOCAL_ENABLED = previous;
  }
});

test("non-loopback URLs, forged Hosts and foreign/null Origins are rejected before auth", async () => {
  const h = harness();
  const requests = [
    rpc("tools/list", {}, {}, "https://cargomesh.example/mcp"),
    rpc("tools/list", {}, { headers: { ...headers, Host: "evil.example" } }),
    rpc("tools/list", {}, { headers: { ...headers, Origin: "https://evil.example" } }),
    rpc("tools/list", {}, { headers: { ...headers, Origin: "null" } }),
    rpc("tools/list", {}, { headers: { ...headers, "Sec-Fetch-Site": "cross-site" } }),
  ];
  for (const request of requests) assert.equal((await h.handle(request)).status, 403);
  assert.equal(h.authCalls(), 0);
});

test("local browser Origin is accepted; protocol access still requires authentication", async () => {
  const h = harness();
  assert.equal((await h.handle(rpc("tools/list", {}, {
    headers: { ...headers, Origin: "http://localhost:3000", Host: "localhost:3000" },
  }))).status, 200);
  assert.equal(h.authCalls(), 1);
});

test("configured remote HTTPS canonical origin initializes and lists tools in production", async () => {
  const h = harness({
    mode: "remote",
    environment: "production",
    canonicalOrigin: REMOTE_ORIGIN,
    allowedOrigins: REMOTE_ORIGIN,
  });
  const initialized = await h.handle(rpc("initialize", {
    protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "remote-test", version: "1" },
  }, {}, REMOTE_URL));
  assert.equal(initialized.status, 200);
  assert.equal((await initialized.json()).result.protocolVersion, "2025-11-25");

  const listed = await h.handle(rpc("tools/list", {}, {
    headers: { ...headers, Origin: REMOTE_ORIGIN },
  }, REMOTE_URL));
  assert.equal(listed.status, 200);
  assert.deepEqual(
    (await listed.json()).result.tools.map((tool: { name: string }) => tool.name),
    ["get_freight_options", "create_freight_request", "submit_freight_request", "find_freight_options"],
  );
  assert.equal(h.authCalls(), 2);
});

test("remote production transport keeps initialize, list and call behind authentication", async () => {
  const h = harness({
    mode: "remote",
    environment: "production",
    canonicalOrigin: REMOTE_ORIGIN,
    allowedOrigins: REMOTE_ORIGIN,
    authError: new Error("UNAUTHENTICATED: no remote session"),
  });
  for (const [method, params] of [
    ["initialize", {
      protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "remote-test", version: "1" },
    }],
    ["tools/list", {}],
    ["tools/call", { name: "get_freight_options", arguments: { runId: RUN } }],
  ] as const) {
    const response = await h.handle(rpc(method, params, {}, REMOTE_URL));
    assert.equal(response.status, 401);
    assert.doesNotMatch(await response.text(), /remote session/);
  }
  assert.equal(h.authCalls(), 3);
  assert.deepEqual(h.calls, []);
});

test("service principal initializes and lists tools but cannot call business tools", async () => {
  const h = harness({
    mode: "remote",
    environment: "production",
    canonicalOrigin: REMOTE_ORIGIN,
    allowedOrigins: REMOTE_ORIGIN,
    principal: {
      kind: "service", clientId: "alexa-service-test", scopes: ["mcp:service"],
      tokenId: "token-id", issuedAt: 1, expiresAt: 901,
    },
  });
  const initialized = await h.handle(rpc("initialize", {
    protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "service-test", version: "1" },
  }, {}, REMOTE_URL));
  assert.equal(initialized.status, 200);
  const listed = await h.handle(rpc("tools/list", {}, {}, REMOTE_URL));
  assert.equal(listed.status, 200);
  assert.equal((await listed.json()).result.tools.length, 4);
  const notification = await h.handle(new Request(REMOTE_URL, {
    method: "POST", headers,
    body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
  }));
  assert.equal(notification.status, 202);

  const called = await h.handle(rpc("tools/call", {
    name: "get_freight_options", arguments: { runId: RUN },
  }, {}, REMOTE_URL));
  const result = (await called.json()).result;
  assert.equal(result.isError, true);
  assert.equal(result.structuredContent.error.code, "FORBIDDEN");
  assert.deepEqual(h.calls, []);
});

test("signed service bearer authenticates initialize/list and is denied before business dispatch", async () => {
  const { accessToken } = await issueMcpServiceToken(TEST_SERVICE_AUTH);
  const calls: string[] = [];
  const handle = createMcpHttpHandler({
    configuration: () => ({
      mode: "remote", environment: "production", localEnabled: false, remoteEnabled: true,
      canonicalOrigin: REMOTE_ORIGIN, allowedOrigins: REMOTE_ORIGIN,
    }),
    authenticate: (request) => authenticateMcpRequest(request, {
      resolveCookieMember: async () => { throw new Error("cookie fallback"); },
      configuration: () => TEST_SERVICE_AUTH,
      verifyServiceToken: verifyMcpServiceToken,
    }),
    read: async (id) => { calls.push(id); return view(); },
  });
  const bearer = { ...headers, Authorization: `Bearer ${accessToken}` };
  const initialized = await handle(rpc("initialize", {
    protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "bearer-test", version: "1" },
  }, { headers: bearer }, REMOTE_URL));
  assert.equal(initialized.status, 200);
  const listed = await handle(rpc("tools/list", {}, { headers: bearer }, REMOTE_URL));
  assert.equal(listed.status, 200);
  const called = await handle(rpc("tools/call", {
    name: "get_freight_options", arguments: { runId: RUN },
  }, { headers: bearer }, REMOTE_URL));
  assert.equal((await called.json()).result.structuredContent.error.code, "FORBIDDEN");
  assert.deepEqual(calls, []);
});

test("invalid, expired and wrong-audience bearer tokens are rejected by /mcp", async () => {
  const expired = await issueMcpServiceToken(
    { ...TEST_SERVICE_AUTH, tokenTtlSeconds: 60 },
    new Date(Date.now() - 120_000),
  );
  const wrongAudience = await issueMcpServiceToken({
    ...TEST_SERVICE_AUTH, canonicalResource: "https://other.example/mcp",
  });
  const tokens = ["invalid", expired.accessToken, wrongAudience.accessToken];
  let cookieCalls = 0;
  const handle = createMcpHttpHandler({
    configuration: () => ({
      mode: "remote", environment: "production", localEnabled: false, remoteEnabled: true,
      canonicalOrigin: REMOTE_ORIGIN, allowedOrigins: REMOTE_ORIGIN,
    }),
    authenticate: (request) => authenticateMcpRequest(request, {
      resolveCookieMember: async () => { cookieCalls++; throw new Error("cookie fallback"); },
      configuration: () => TEST_SERVICE_AUTH,
      verifyServiceToken: verifyMcpServiceToken,
    }),
    read: async () => view(),
  });
  for (const token of tokens) {
    const response = await handle(rpc("tools/list", {}, {
      headers: { ...headers, Authorization: `Bearer ${token}` },
    }, REMOTE_URL));
    assert.equal(response.status, 401);
    assert.equal(response.headers.get("www-authenticate"), null);
  }
  assert.equal(cookieCalls, 0);
});

test("remote mode rejects unrelated URL authorities, Hosts and Origins before authentication", async () => {
  const h = harness({
    mode: "remote",
    environment: "production",
    canonicalOrigin: REMOTE_ORIGIN,
    allowedOrigins: `${REMOTE_ORIGIN},https://console.cargomesh.test`,
  });
  const requests = [
    rpc("tools/list", {}, {}, "https://unrelated.example/mcp"),
    rpc("tools/list", {}, { headers: { ...headers, Host: "unrelated.example" } }, REMOTE_URL),
    rpc("tools/list", {}, { headers: { ...headers, Origin: "https://unrelated.example" } }, REMOTE_URL),
    rpc("tools/list", {}, { headers: { ...headers, Origin: "null" } }, REMOTE_URL),
    rpc("tools/list", {}, {
      headers: { ...headers, Origin: "https://console.cargomesh.test", "Sec-Fetch-Site": "cross-site" },
    }, REMOTE_URL),
  ];
  for (const request of requests) assert.equal((await h.handle(request)).status, 403);
  assert.equal(h.authCalls(), 0);
});

test("remote mode fails closed without explicit enablement or valid HTTPS origin configuration", async () => {
  const configurations: Options[] = [
    { mode: "remote", enabled: false, canonicalOrigin: REMOTE_ORIGIN, allowedOrigins: REMOTE_ORIGIN },
    { mode: "remote", canonicalOrigin: "http://mcp.cargomesh.test", allowedOrigins: "http://mcp.cargomesh.test" },
    { mode: "remote", canonicalOrigin: REMOTE_ORIGIN, allowedOrigins: "https://other.example" },
    { mode: "remote", canonicalOrigin: `${REMOTE_ORIGIN}/mcp`, allowedOrigins: REMOTE_ORIGIN },
  ];
  for (const [index, options] of configurations.entries()) {
    const h = harness(options);
    assert.equal((await h.handle(rpc("tools/list", {}, {}, REMOTE_URL))).status, index === 0 ? 404 : 503);
    assert.equal(h.authCalls(), 0);
  }
});

test("Next localhost URL normalization accepts a 127.0.0.1 Host on the same port", async () => {
  const h = harness();
  const response = await h.handle(rpc("tools/list", {}, {
    headers: { ...headers, Host: "127.0.0.1:3000", Origin: "http://127.0.0.1:3000" },
  }));
  assert.equal(response.status, 200);
  assert.equal(h.authCalls(), 1);
});

for (const [message, status] of [["UNAUTHENTICATED: secret", 401], ["FORBIDDEN: secret", 403], ["database secret", 500]] as const) {
  test(`authentication failure ${status} gates initialize/list/call without leaking details`, async () => {
    const h = harness({ authError: new Error(message) });
    for (const method of ["initialize", "tools/list", "tools/call"]) {
      const response = await h.handle(rpc(method, {}, { headers: { ...headers, Authorization: "Bearer not-a-cookie" } }));
      assert.equal(response.status, status);
      assert.doesNotMatch(await response.text(), /secret/);
    }
    assert.deepEqual(h.calls, []);
  });
}

test("service authorization/not-found errors remain errors after the transport auth gate", async () => {
  for (const error of [new Error("FORBIDDEN: private tenant"), new OrchestrationError("NOT_FOUND", "private tenant", 404)]) {
    const h = harness({ read: async () => { throw error; } });
    const response = await h.handle(call());
    const text = await response.text();
    const result = JSON.parse(text).result;
    assert.equal(result.isError, true);
    assert.equal(result.structuredContent.ok, false);
    assert.doesNotMatch(text, /private tenant/);
    assert.deepEqual(h.calls, [RUN]);
  }
});

test("unexpected errors, invalid service output and wrong run correlation fail safely", async () => {
  const reads = [
    async () => { throw new Error("SUPABASE_SERVICE_ROLE_KEY=secret"); },
    async () => ({ ...view(), runId: REQUEST }),
    async () => ({ ...view(), candidateCount: NaN }),
  ];
  for (const read of reads) {
    const result = await (await harness({ read }).handle(call())).json();
    assert.equal(result.result.isError, true);
    assert.equal(result.result.structuredContent.error.code, "ORCHESTRATION_VIEW_MODEL_FAILED");
    assert.doesNotMatch(JSON.stringify(result), /secret|NaN/);
  }
});

test("technical diagnostics and unknown output fields are not exposed or mutated in place", async () => {
  const original = { ...view("FAILED"), secret: "private key" };
  original.warnings = [{ code: "secret-code", message: "private key", retryable: true,
    carrierId: CARRIER, matchingServiceId: SERVICE, toolName: "quote_freight" }];
  if (original.status === "error") original.error.message = "private key";
  const body = await (await harness({ read: async () => original }).handle(call())).json();
  assert.doesNotMatch(JSON.stringify(body), /private key|secret-code/);
  assert.equal(original.warnings[0].message, "private key");
});

test("GET and DELETE return 405 without creating SSE sessions or reading domain data", async () => {
  const h = harness();
  for (const method of ["GET", "DELETE"]) {
    const response = await h.handle(new Request(URL, { method }));
    assert.equal(response.status, 405);
    assert.equal(response.headers.get("allow"), "POST");
  }
  assert.deepEqual(h.calls, []);
});

test("SDK rejects malformed JSON, missing Accept and unsupported protocol versions", async () => {
  const h = harness();
  for (const [request, status] of [
    [rpc("tools/list", {}, { body: "{" }), 400],
    [rpc("tools/list", {}, { headers: { "Content-Type": "application/json" } }), 406],
    [rpc("tools/list", {}, { headers: { ...headers, "MCP-Protocol-Version": "invalid" } }), 400],
  ] as const) assert.equal((await h.handle(request)).status, status);
  assert.deepEqual(h.calls, []);
});

test("oversized bodies are rejected before SDK dispatch", async () => {
  const h = harness();
  assert.equal((await h.handle(rpc("tools/list", {}, { body: "x".repeat(65537) }))).status, 413);
  assert.deepEqual(h.calls, []);
});

test("concurrent request-scoped servers keep their results separate", async () => {
  const h = harness({ read: async (id) => ({ ...view(), runId: id }) });
  const ids = [RUN, "90000000-0000-0000-0000-000000000002"];
  const responses = await Promise.all(ids.map(async (id) => (await h.handle(call({ runId: id }))).json()));
  assert.deepEqual(responses.map((r) => r.result.structuredContent.data.runId), ids);
  assert.equal(h.authCalls(), 2);
});

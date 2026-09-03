import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { startDemoSession } from "./demo-login-client";

function response(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

test("starts the server-managed demo session without sending credentials", async () => {
  const calls: Array<{ input: string; init?: RequestInit }> = [];
  const result = await startDemoSession(async (input, init) => {
    calls.push({ input: String(input), init });
    return response(200, { ok: true });
  });

  assert.deepEqual(result, { ok: true });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].input, "/api/auth/demo-login");
  assert.equal(calls[0].init?.method, "POST");
  assert.equal(calls[0].init?.body, undefined);
});

test("maps missing server configuration and inactive membership safely", async () => {
  assert.deepEqual(
    await startDemoSession(async () => response(503, { ok: false })),
    { ok: false, kind: "unavailable", message: "DEMO_LOGIN_UNAVAILABLE" },
  );
  assert.deepEqual(
    await startDemoSession(async () => response(403, { ok: false })),
    { ok: false, kind: "unauthorized", message: "DEMO_MEMBERSHIP_REQUIRED" },
  );
});

test("keeps transport failures recoverable", async () => {
  const result = await startDemoSession(async () => {
    throw new Error("offline");
  });
  assert.deepEqual(result, { ok: false, kind: "recoverable", message: "DEMO_LOGIN_FAILED" });
});

test("the Route Handler authenticates server-side and requires an ACTIVE membership", () => {
  const route = readFileSync(
    new URL("../../app/api/auth/demo-login/route.ts", import.meta.url),
    "utf8",
  );
  const component = readFileSync(
    new URL("../../components/demo-login.tsx", import.meta.url),
    "utf8",
  );

  assert.match(route, /process\.env\.CARGOMESH_DEMO_LOGIN_EMAIL/);
  assert.match(route, /process\.env\.CARGOMESH_DEMO_LOGIN_PASSWORD/);
  assert.match(route, /\.eq\("auth_user_id", data\.user\.id\)/);
  assert.match(route, /\.eq\("status", "ACTIVE"\)/);
  assert.match(route, /supabase\.auth\.signOut\(\)/);
  assert.doesNotMatch(component, /CARGOMESH_DEMO_LOGIN_(EMAIL|PASSWORD)/);
});

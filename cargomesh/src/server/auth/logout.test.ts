import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { hasSessionOrigin } from "./session-origin";

type Handler = (request: Request) => Promise<Response>;
function loadRoute(path: string, dependencies: Record<string, unknown>): Handler {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const exports: { POST?: Handler } = {};
  vm.runInNewContext(code, { exports, Request, Response, URL, require: (name: string) => {
    assert.ok(name in dependencies, `Unexpected route dependency: ${name}`);
    return dependencies[name];
  } });
  return exports.POST!;
}
function logoutRoute({ assigned = false, workspace = false, fail = false } = {}) {
  const calls: unknown[] = [];
  const handler = loadRoute("../../app/api/auth/logout/route.ts", {
    "@/server/auth/assigned-demo": { assignedDemoEnabled: async () => assigned },
    "@/server/auth/workspace-demo": { workspaceDemoEnabled: async () => workspace },
    "@/server/auth/session-origin": { hasSessionOrigin },
    "@/server/db/supabase/v2": { createV2ServerSupabaseClient: async () => ({ auth: {
      signOut: async (scope: unknown) => { calls.push(scope); return { error: fail ? new Error("Unavailable") : null }; },
    } }) },
  });
  return { handler, calls };
}
function request(path: string, origin = "http://127.0.0.1:8080", body?: string) {
  return new Request(`http://127.0.0.1:8080${path}`, { method: "POST", headers: {
    origin, host: "127.0.0.1:8080", "content-type": "application/x-www-form-urlencoded",
  }, body });
}

test("Client and Carrier sign out before returning to the public home page", async () => {
  for (const config of [{}, { assigned: true }, { workspace: true }]) {
    const route = logoutRoute(config);
    const response = await route.handler(request("/api/auth/logout?returnTo=https://evil.test"));
    assert.equal(route.calls.length, 1);
    assert.deepEqual(JSON.parse(JSON.stringify(route.calls)), config.assigned || config.workspace ? [{ scope: "local" }] : [null]);
    assert.equal(response.status, 303);
    assert.equal(response.headers.get("location"), "/");
    assert.equal(response.headers.get("cache-control"), "no-store, private");
  }
});

test("failed or cross-origin sign out cannot claim success or redirect", async () => {
  const denied = logoutRoute();
  const response = await denied.handler(request("/api/auth/logout", "https://evil.test"));
  assert.equal(response.status, 403);
  assert.equal(response.headers.get("location"), null);
  assert.equal(denied.calls.length, 0);
  const failed = await logoutRoute({ fail: true }).handler(request("/api/auth/logout"));
  assert.equal(failed.status, 503);
  assert.equal(failed.headers.get("location"), null);
});

test("local and hosted preview exits clear their grant and return home; entry still opens Client", async () => {
  for (const hosted of [false, true]) {
    const writes: unknown[][] = [];
    const origin = hosted ? "https://demo.cargomesh.test" : "http://127.0.0.1:8080";
    const handler = loadRoute("../../app/api/local/client-session/route.ts", {
      "@/server/auth/assigned-demo": { assignedDemoConfig: () => ({ origin }) },
      "@/server/auth/assigned-demo-policy": { assignedDemoAllowed: () => hosted },
      "next/headers": { cookies: async () => ({ set: (...args: unknown[]) => writes.push(args) }) },
      "@/server/auth/session-origin": { hasSessionOrigin },
      "@/server/auth/local-client-preview": { clientPreviewConfig: () => ({ secret: "test" }) },
      "@/server/auth/local-client-preview-policy": { CLIENT_PREVIEW_COOKIE: "cm-client-preview", CLIENT_PREVIEW_TTL: 7200,
        localClientPreviewAllowed: () => !hosted, signClientPreview: () => "signed-test-grant" },
    });
    const send = (action: string, requestOrigin = origin) => handler(new Request(`${origin}/api/local/client-session`, {
      method: "POST", headers: { origin: requestOrigin, host: new URL(origin).host, "content-type": "application/x-www-form-urlencoded" }, body: `action=${action}`,
    }));
    const denied = await send("exit", "https://evil.test");
    assert.equal(denied.status, hosted ? 404 : 403);
    assert.equal(writes.length, 0);
    const exit = await send("exit");
    assert.equal(exit.status, 303);
    assert.equal(exit.headers.get("location"), "/");
    assert.equal(exit.headers.get("cache-control"), "no-store, private");
    assert.deepEqual(JSON.parse(JSON.stringify(writes[0])), ["cm-client-preview", "", {
      httpOnly: true, sameSite: "strict", secure: hosted, path: "/", maxAge: 0,
    }]);
    const entry = await send("enter");
    assert.equal(entry.headers.get("location"), "/clients");
    assert.equal(writes[1][1], "signed-test-grant");
  }
});

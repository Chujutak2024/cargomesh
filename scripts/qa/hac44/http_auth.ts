import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { pairedStatus } from "./http_oracles.ts";

/** Actual local Auth session in memory, through Next's native request cookie store. */
export async function authentication({ call, client, TOKENS, output, refs, CARRIER, httpOrigin, require }: any) {
  const owner = require("node:fs").existsSync(process.env.HAC44_ROOT + "/cargomesh/src/server/auth/carrier.ts") ? "HAC-41 / Axel" : "HAC-40 / Cristhian";
  const { createClient } = require("@supabase/supabase-js");
  const { createServerClient } = require("@supabase/ssr");
  const options = { auth: { persistSession: false, autoRefreshToken: false } };
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.HAC44_AUTH_ADMIN_KEY!, options);
  const userClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, options);
  const email = "local-only-hac44-1@cargomesh.test";
  const link = await admin.auth.admin.generateLink({ type: "magiclink", email });
  assert.equal(link.error, null, "Owned local magic-link generation failed");
  const signed = await userClient.auth.verifyOtp({ token_hash: link.data.properties.hashed_token, type: "magiclink" });
  assert.equal(signed.error, null, "Owned local session verification failed");
  const session = signed.data.session;
  const verified = await userClient.auth.getUser(session.access_token);
  assert.equal(verified.error, null, "Local issuer did not verify the cookie session");
  assert.equal(verified.data.user.id, "d4410000-0000-4000-8000-000000000001");
  const claims = JSON.parse(Buffer.from(session.access_token.split(".")[1], "base64url").toString());
  assert.ok(claims.session_id, "An actual Auth session ID is required");
  const jar = new Map<string, string>();
  const ssr = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (rows: any[]) => rows.forEach(row => jar.set(row.name, row.value)) },
  });
  const stored = await ssr.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token });
  assert.equal(stored.error, null, "In-memory SSR session cookie construction failed");
  const cookie = [...jar].map(([name, value]) => name + "=" + value).join("; ");
  assert.ok(cookie, "Actual session cookie required");
  output("authentication-fixture.json", { authUserId: verified.data.user.id, sessionId: claims.session_id,
    issuerVerified: true, storage: "Memory only", transport: "Native Next request stores around unmodified Hono router" });

  const path = `/carriers/${CARRIER}/metrics`;
  const body = { schemaVersion: "2.0", period: { startsAt: "2020-01-01T00:00:00Z", endsAt: "2026-01-01T00:00:00Z" },
    corridorId: refs.corridor.id, mode: "ROAD", sampleSize: 10, onTimeRate: 0.9,
    successfulDeliveryRate: 0.9, source: refs.limits.data.source };
  const cases: any[] = [];
  async function pair(label: string, headers: any, expected: number) {
    const positive = await call(label + "-positive", path, body, randomUUID(), 0, 201,
      { Cookie: cookie, Origin: httpOrigin });
    const negative = await call(label + "-negative", path, body, randomUUID(), 0, expected, headers);
    negative.status = pairedStatus(positive, negative);
    negative.controlPositive = positive.label;
    if (negative.status === "BLOQUEADO") negative.reason = "Same-session functional positive failed";
    const expectedCode = expected === 403 ? "FORBIDDEN_ORIGIN" : "UNAUTHORIZED";
    if (negative.status === "PASS" && negative.response.error?.code !== expectedCode) negative.status = "FAIL";
    cases.push({ case: label, status: negative.status, positive, negative, expectedCode,
      owner, realCookieSession: true });
    output("authentication-cases.json", cases);
  }
  await pair("cookie-valid-forbidden-origin", { Cookie: cookie, Origin: "https://outside.cargomesh.test" }, 403);
  await pair("invalid-bearer-no-cookie-fallback", { Cookie: cookie, Origin: httpOrigin,
    Authorization: "Bearer invalid.hac44.credential" }, 401);
  // The valid actor and payload stay paired with the credential-order defect.
  await pair("anonymous-credential-before-origin", {}, 401);
  const validBearer = await call("invalid-bearer-issuer-positive", path, body, randomUUID(), 1, 201);
  const invalidBearer = await call("invalid-bearer-alone-negative", path, body, randomUUID(), 0, 401,
    { Authorization: "Bearer invalid.hac44.credential" });
  invalidBearer.status = pairedStatus(validBearer, invalidBearer);
  if (invalidBearer.status === "PASS" && invalidBearer.response.error?.code !== "UNAUTHORIZED") invalidBearer.status = "FAIL";
  cases.push({ case: "invalid-bearer-alone", status: invalidBearer.status, positive: validBearer, negative: invalidBearer });
  output("authentication-cases.json", cases);
}

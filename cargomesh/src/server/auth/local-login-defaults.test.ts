import test from "node:test";
import assert from "node:assert/strict";
import { createLocalLoginDefaultsHandler } from "./local-login-defaults";
const request = (headers: Record<string, string> = {}, url = "http://localhost:8080/api/local/login-defaults") => new Request(url, {
  headers: { Host: "127.0.0.1:8080", Referer: "http://127.0.0.1:8080/login?returnTo=test", "Sec-Fetch-Site": "same-origin", ...headers },
});
const config = { enabled: true, production: false, email: "synthetic-admin@example.invalid", password: "test-fixture-password" };
test("defaults are disabled unless opted in and never available in production", async () => {
  for (const patch of [{ enabled: false }, { production: true }]) {
    const response = await createLocalLoginDefaultsHandler({ ...config, ...patch })(request());
    assert.equal(response.status, 404); assert.doesNotMatch(await response.text(), /test-fixture-password/);
  }
});
test("only the same-origin login on the unified loopback port can read defaults", async () => {
  const handler = createLocalLoginDefaultsHandler(config);
  const allowed = await handler(request()); assert.equal(allowed.status, 200);
  assert.deepEqual(await allowed.json(), { email: config.email, password: config.password });
  assert.match(allowed.headers.get("cache-control")!, /no-store/);
  assert.equal(allowed.headers.get("x-content-type-options"), "nosniff");
  for (const [headers, expected] of [
    [{ Host: "app.example:8080" }, 404], [{ Host: "127.0.0.1:3907" }, 404],
    [{ Origin: "https://foreign.example" }, 403], [{ Referer: "https://foreign.example/login" }, 403],
    [{ Referer: "http://127.0.0.1:8080/" }, 403], [{ "Sec-Fetch-Site": "cross-site" }, 403], [{ Referer: "" }, 403],
  ] as const) {
    const response = await handler(request(headers)); assert.equal(response.status, expected);
    assert.doesNotMatch(await response.text(), /test-fixture-password/);
  }
  assert.equal((await handler(request({}, "https://localhost:8080/api/local/login-defaults"))).status, 404);
});
test("missing private configuration does not fabricate demo credentials", async () => {
  const response = await createLocalLoginDefaultsHandler({ enabled: true, production: false })(request());
  assert.equal(response.status, 503); assert.deepEqual(await response.json(), { ok: false });
});

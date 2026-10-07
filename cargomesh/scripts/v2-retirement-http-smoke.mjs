import assert from "node:assert/strict";

const base = process.env.CARGOMESH_LOCAL_APP_URL ?? "http://127.0.0.1:3172";
const url = new URL(base);
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(url.hostname), "Local environment only");
const credentials = { email: process.env.HAC12_LOCAL_QA_EMAIL, password: process.env.HAC12_LOCAL_QA_PASSWORD };
assert.ok(credentials.email && credentials.password, "Provide disposable local QA credentials");
const headers = { Origin: url.origin, "Content-Type": "application/json" };
const post = (path, body, extra = {}) => fetch(`${base}${path}`, {
  method: "POST", headers: { ...headers, ...extra }, body: JSON.stringify(body), redirect: "manual",
});
assert.equal((await post("/api/auth/login", credentials, { Origin: "https://external.invalid" })).status, 403);
assert.equal((await post("/api/auth/login", { ...credentials, password: "invalid-local-password" })).status, 401);
const login = await post("/api/auth/login", credentials);
assert.equal(login.status, 200);
const cookie = login.headers.getSetCookie().map(value => value.split(";")[0]).join("; ");
assert.ok(cookie, "Login must issue the authenticated cookie");
assert.equal((await fetch(`${base}/api/v2/intake/options`, { headers: { Cookie: cookie } })).status, 200);
const legacy = ["/api/auth/demo-login", "/api/bookings/reset-demo", "/api/bookings/prepare", "/api/orchestration/runs", "/api/freight-requests/drafts"];
for (const path of legacy) assert.equal((await post(path, {}, { Cookie: cookie })).status, 404, path);
const logout = await post("/api/auth/logout", {}, { Cookie: cookie });
assert.equal(logout.status, 303);
assert.equal(logout.headers.get("location"), "/login");
assert.equal((await post("/api/auth/logout", {}, { Cookie: cookie, Origin: "https://external.invalid" })).status, 403);
console.log("V2 retirement HTTP: 11/11 PASS (login, origin, V2 control, five retired POST routes, logout)");

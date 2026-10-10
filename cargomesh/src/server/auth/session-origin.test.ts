import assert from "node:assert/strict";
import test from "node:test";
import { hasSessionOrigin } from "./session-origin";

test("cookie session mutations accept same origin and Next loopback normalization", () => {
  assert.equal(hasSessionOrigin(new Request("https://cargomesh.test/api/auth/login", {headers: {origin:"https://cargomesh.test", host:"cargomesh.test"}})), true);
  assert.equal(hasSessionOrigin(new Request("http://localhost:3172/api/auth/login", {headers: {origin:"http://127.0.0.1:3172", host:"127.0.0.1:3172"}})), true);
});
test("cookie session mutations reject missing/external origins and mismatched authorities", () => {
  for (const headers of [{}, {origin:"https://evil.test"}, {origin:"http://127.0.0.1:3173",host:"127.0.0.1:3173"}, {origin:"http://evil.test:3172",host:"evil.test:3172"}, {origin:"http://localhost:3172","sec-fetch-site":"cross-site"}]) {
    assert.equal(hasSessionOrigin(new Request("http://localhost:3172/api/auth/login", {headers: headers as Record<string,string>})), false);
  }
});

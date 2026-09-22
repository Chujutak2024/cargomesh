import assert from "node:assert/strict";
import test from "node:test";
import { decodeJwt, SignJWT } from "jose";
import { issueMcpServiceToken, verifyMcpServiceToken } from "./service-token";
import { TEST_SERVICE_AUTH } from "./test-configuration";

const NOW = new Date("2026-09-21T12:00:00Z");

test("service JWT contains the required short-lived claims and verifies", async () => {
  const issued = await issueMcpServiceToken(TEST_SERVICE_AUTH, NOW);
  const claims = decodeJwt(issued.accessToken);
  assert.equal(issued.expiresIn, 900);
  assert.equal(claims.iss, TEST_SERVICE_AUTH.issuer);
  assert.equal(claims.sub, TEST_SERVICE_AUTH.clientId);
  assert.equal(claims.aud, TEST_SERVICE_AUTH.canonicalResource);
  assert.equal(claims.scope, "mcp:service");
  assert.equal(claims.exp! - claims.iat!, 900);
  assert.match(claims.jti!, /^[0-9a-f-]{36}$/);
  const principal = await verifyMcpServiceToken(issued.accessToken, TEST_SERVICE_AUTH, NOW);
  assert.equal(principal.kind, "service");
  assert.equal(principal.clientId, TEST_SERVICE_AUTH.clientId);
});

test("service JWT rejects a modified signature, expiration and wrong audience", async () => {
  const { accessToken } = await issueMcpServiceToken(TEST_SERVICE_AUTH, NOW);
  const last = accessToken.at(-1)!;
  const tampered = `${accessToken.slice(0, -1)}${last === "a" ? "b" : "a"}`;
  await assert.rejects(verifyMcpServiceToken(tampered, TEST_SERVICE_AUTH, NOW));
  await assert.rejects(verifyMcpServiceToken(accessToken, TEST_SERVICE_AUTH, new Date(NOW.getTime() + 901_000)));

  const wrongAudience = await new SignJWT({ scope: "mcp:service" })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(TEST_SERVICE_AUTH.issuer)
    .setSubject(TEST_SERVICE_AUTH.clientId)
    .setAudience("https://other.example/mcp")
    .setIssuedAt(Math.floor(NOW.getTime() / 1000))
    .setExpirationTime(Math.floor(NOW.getTime() / 1000) + 900)
    .setJti(crypto.randomUUID())
    .sign(new TextEncoder().encode(TEST_SERVICE_AUTH.signingSecret));
  await assert.rejects(verifyMcpServiceToken(wrongAudience, TEST_SERVICE_AUTH, NOW));
});

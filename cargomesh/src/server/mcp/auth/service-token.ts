import { randomUUID } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import type { McpPrincipal } from "./principal";
import type { McpServiceAuthConfiguration } from "./configuration";

const algorithm = "HS256";
const key = (secret: string) => new TextEncoder().encode(secret);

export async function issueMcpServiceToken(
  config: McpServiceAuthConfiguration,
  now = new Date(),
): Promise<{ accessToken: string; expiresIn: number }> {
  const issuedAt = Math.floor(now.getTime() / 1000);
  const accessToken = await new SignJWT({ scope: "mcp:service" })
    .setProtectedHeader({ alg: algorithm, typ: "JWT" })
    .setIssuer(config.issuer)
    .setSubject(config.clientId)
    .setAudience(config.canonicalResource)
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + config.tokenTtlSeconds)
    .setJti(randomUUID())
    .sign(key(config.signingSecret));
  return { accessToken, expiresIn: config.tokenTtlSeconds };
}

export async function verifyMcpServiceToken(
  token: string,
  config: McpServiceAuthConfiguration,
  now = new Date(),
): Promise<McpPrincipal> {
  const { payload } = await jwtVerify(token, key(config.signingSecret), {
    algorithms: [algorithm],
    issuer: config.issuer,
    audience: config.canonicalResource,
    currentDate: now,
  });
  const currentTime = Math.floor(now.getTime() / 1000);
  if (
    payload.sub !== config.clientId || payload.scope !== "mcp:service" ||
    typeof payload.iat !== "number" || typeof payload.exp !== "number" ||
    typeof payload.jti !== "string" || payload.jti.length === 0 ||
    payload.iat > currentTime + 5 || payload.exp <= payload.iat || payload.exp - payload.iat > 3600
  ) throw new Error("Invalid MCP service token claims.");
  return {
    kind: "service",
    clientId: payload.sub,
    scopes: ["mcp:service"],
    tokenId: payload.jti,
    issuedAt: payload.iat,
    expiresAt: payload.exp,
  };
}

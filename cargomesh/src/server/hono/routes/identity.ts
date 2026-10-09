import { Hono } from "hono";
import { runWithMcpRequestIdentity } from "@/server/mcp/auth/request-context";
import { V2DraftError } from "@/server/modules/freight-requests/application/draft-service";
import { IdentityServiceV2 } from "@/server/modules/identity/application/identity-service";
import { v2Error } from "../middleware/v2-error";
import { hasSessionOrigin } from "@/server/auth/session-origin";

export const identityRouter = new Hono();
async function jsonBody(c: Parameters<typeof v2Error>[0]): Promise<unknown> {
  try { return await c.req.json(); }
  catch { throw new V2DraftError("VALIDATION_ERROR", "JSON body required.", 400); }
}
async function service() {
  const { identityRepositoryV2 } = await import("@/server/modules/identity/infrastructure/supabase-identity-repository");
  return new IdentityServiceV2(await identityRepositoryV2());
}
// Route-local authentication: a carrier need not be a shipper OrganizationMember.
identityRouter.use("/identity/*", identityToken);
identityRouter.use("/organizations/current/members", identityToken);
identityRouter.use("/carriers/:carrierId/integrations", identityToken);
identityRouter.use("/carriers/:carrierId/integrations/*", identityToken);
identityRouter.use("/carriers/:carrierId/operators", identityToken);
identityRouter.use("/carriers/:carrierId/operators/*", identityToken);
identityRouter.use("/organizations/current/members/*", identityToken);
async function identityToken(c: Parameters<typeof v2Error>[0], next: () => Promise<void>) {
  const header = c.req.header("Authorization");
  const token = header?.match(/^Bearer ([^\s]+)$/i)?.[1];
  if (header !== undefined && !token) return v2Error(c, new V2DraftError("UNAUTHORIZED", "Authentication required.", 401));
  if (!token && !["GET", "HEAD", "OPTIONS"].includes(c.req.method) && !hasSessionOrigin(c.req.raw)) {
    return v2Error(c, new V2DraftError("FORBIDDEN_ORIGIN", "Same-origin session request required.", 403));
  }
  if (!token && !c.req.header("Cookie")) return v2Error(c, new V2DraftError("UNAUTHORIZED", "Authentication required.", 401));
  const run = async () => {
    try {
      const { createV2ServerSupabaseClient } = await import("@/server/db/supabase/v2");
      const db = await createV2ServerSupabaseClient();
      const { data: { user }, error } = await db.auth.getUser();
      if (error || !user) throw new V2DraftError("UNAUTHORIZED", "Authentication required.", 401);
      await next();
    } catch (error) { return v2Error(c, error); }
  };
  return token ? runWithMcpRequestIdentity({ supabaseAccessToken: token }, run) : run();
}
async function currentOrganization() {
  try {
    const { requireAuthenticatedMember } = await import("@/server/auth/member");
    return (await requireAuthenticatedMember()).organizationId;
  } catch (error) {
    const forbidden = error instanceof Error && error.message.startsWith("FORBIDDEN");
    throw new V2DraftError(forbidden ? "FORBIDDEN_TENANT" : "UNAUTHORIZED", "Active organization identity required.", forbidden ? 403 : 401);
  }
}
identityRouter.get("/organizations/current/members", async c => {
  try {
    return c.json(await (await service()).read("members", { organizationId: await currentOrganization(), carrierId: null }, c.req.query()));
  } catch (error) { return v2Error(c, error); }
});
for (const kind of ["operators", "integrations"] as const) identityRouter.get(`/carriers/:carrierId/${kind}`, async c => {
  try { return c.json(await (await service()).read(kind,
    { organizationId: null, carrierId: c.req.param("carrierId") }, c.req.query())); }
  catch (error) { return v2Error(c, error); }
});
identityRouter.get("/identity/mcp/links", async c => {
  try { return c.json(await (await service()).read("links", { organizationId: null, carrierId: null }, c.req.query())); }
  catch (error) { return v2Error(c, error); }
});
for (const action of ["consent", "revoke"] as const) identityRouter.post(
  action === "consent" ? "/identity/mcp/links" : "/identity/mcp/links/:id/revocations", async c => {
    try {
      let body: unknown;
      try { body = await c.req.json(); } catch { throw new V2DraftError("VALIDATION_ERROR", "JSON body required.", 400); }
      const organizationId = action === "consent" ? await currentOrganization() : null;
      const result = await (await service()).link(action, organizationId, c.req.param("id") ?? null,
        body, c.req.header("Idempotency-Key"));
      return c.json(result, action === "consent" && !result.meta.idempotentReplay ? 201 : 200);
    } catch (error) { return v2Error(c, error); }
  });
identityRouter.post("/carriers/:carrierId/integrations", async c => {
  try { return c.json(await (await service()).configure(c.req.param("carrierId"), await jsonBody(c), c.req.header("Idempotency-Key"))); }
  catch (error) { return v2Error(c, error); }
});
identityRouter.get("/carriers/:carrierId/integrations/:id/diagnostics", async c => {
  try { return c.json(await (await service()).diagnose(c.req.param("carrierId"), c.req.param("id"))); }
  catch (error) { return v2Error(c, error); }
});
for (const kind of ["members", "operators"] as const) for (const action of ["invite", "revise", "accept"] as const) {
  const prefix = kind === "members" ? action === "accept"
    ? "/identity/organizations/:organizationId/members" : "/organizations/current/members" : "/carriers/:carrierId/operators";
  const path = prefix + (action === "invite" ? "/invitations" : action === "revise" ? "/:id/revisions" : "/:id/acceptance");
  identityRouter.post(path, async c => {
    try {
      const scope = { organizationId: kind === "members" ? action === "accept" ? c.req.param("organizationId") ?? null : await currentOrganization() : null,
        carrierId: kind === "operators" ? c.req.param("carrierId") ?? null : null };
      return c.json(await (await service()).directory(kind, action, scope, c.req.param("id") ?? null,
        await jsonBody(c), c.req.header("Idempotency-Key")));
    } catch (error) { return v2Error(c, error); }
  });
}

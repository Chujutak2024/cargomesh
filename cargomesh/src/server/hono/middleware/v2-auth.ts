import { createMiddleware } from "hono/factory";
import type { AuthVariables } from "./auth";
import { V2DraftError } from "@/server/modules/freight-requests/application/draft-service";
import { runWithMcpRequestIdentity } from "@/server/mcp/auth/request-context";
import { v2Error } from "./v2-error";

/** Bearer overrides cookies; the request identity also scopes every repository call. */
export const v2AuthMiddleware = createMiddleware<{ Variables: AuthVariables }>(
  async (c, next) => {
    const authorization = c.req.header("Authorization");
    const bearer = authorization?.match(/^Bearer ([^\s]+)$/i)?.[1];
    if (authorization !== undefined && !bearer) {
      return v2Error(c, new V2DraftError("UNAUTHORIZED", "Authentication required.", 401));
    }
    const authenticatedOperation = async () => {
      let member;
      try {
        const { requireAuthenticatedMember } = await import("@/server/auth/member");
        member = await requireAuthenticatedMember();
      } catch (error) {
        const forbidden = error instanceof Error && error.message.startsWith("FORBIDDEN");
        return v2Error(c, new V2DraftError(
          forbidden ? "FORBIDDEN_TENANT" : "UNAUTHORIZED",
          forbidden ? "Active organization membership required." : "Authentication required.",
          forbidden ? 403 : 401,
        ));
      }
      c.set("member", member);
      await next();
    };
    return bearer
      ? runWithMcpRequestIdentity({ supabaseAccessToken: bearer }, authenticatedOperation)
      : authenticatedOperation();
  },
);

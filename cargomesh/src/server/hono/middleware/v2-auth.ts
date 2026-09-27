import { createMiddleware } from "hono/factory";
import type { AuthVariables } from "./auth";
import { V2DraftError } from "@/server/modules/freight-requests/application/draft-service";
import { v2Error } from "./v2-error";

/** V2 envelope; effective tenant always comes from the authenticated session. */
export const v2AuthMiddleware = createMiddleware<{ Variables: AuthVariables }>(
  async (c, next) => {
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
  },
);

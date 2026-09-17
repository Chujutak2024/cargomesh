import { createMiddleware } from "hono/factory";
import type { AuthenticatedMemberContext } from "@/lib/supabase/auth";
import { errorResponse } from "@/shared/schemas/api-envelope";

// ---------------------------------------------------------------------------
// Hono auth middleware.
//
// Calls the existing requireAuthenticatedMember() from lib/supabase/auth.ts
// (unchanged) and injects the result into the Hono context under 'member'.
//
// Route handlers access it via:
//   const member = c.get("member")
// ---------------------------------------------------------------------------

export type AuthVariables = {
  member: AuthenticatedMemberContext;
};

export const authMiddleware = createMiddleware<{ Variables: AuthVariables }>(
  async (c, next) => {
    // Dynamically import to avoid pulling server-only code into the module
    // graph at import time (Hono's module system is not Next.js server-only
    // aware). The import is safe because this middleware only runs server-side.
    const { requireAuthenticatedMember } = await import(
      "@/lib/supabase/auth"
    );

    try {
      const member = await requireAuthenticatedMember();
      c.set("member", member);
      await next();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unauthenticated";
      if (message.startsWith("FORBIDDEN")) {
        return c.json(errorResponse("FORBIDDEN", message), 403);
      }
      return c.json(
        errorResponse("UNAUTHENTICATED", "Authentication required."),
        401,
      );
    }
  },
);

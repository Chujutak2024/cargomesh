import { Hono } from "hono";
import type { AuthVariables } from "@/server/hono/middleware/auth";
import { v2AuthMiddleware } from "@/server/hono/middleware/v2-auth";
import { v2Error } from "@/server/hono/middleware/v2-error";
import { V2DraftError } from "@/server/modules/freight-requests/application/draft-service";
import { getIntakeOptions } from "@/server/modules/intake/application/get-intake-options";

const intakeOptionsRouter = new Hono<{ Variables: AuthVariables }>();
intakeOptionsRouter.get("/", v2AuthMiddleware, async (c) => {
  try {
    const { v2IntakeOptionsRepository } = await import(
      "@/server/modules/intake/infrastructure/supabase-intake-options-repository"
    );
    const member = c.get("member");
    return c.json(await getIntakeOptions(
      { memberId: member.memberId, organizationId: member.organizationId },
      await v2IntakeOptionsRepository(),
    ));
  } catch (error) {
    if (error instanceof Error && error.message === "CATALOG_NOT_READY") {
      return v2Error(c, new V2DraftError("CATALOG_NOT_READY", "V2 category guide is incomplete.", 503));
    }
    return v2Error(c, error);
  }
});

export { intakeOptionsRouter };

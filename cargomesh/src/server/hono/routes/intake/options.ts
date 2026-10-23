import { Hono } from "hono";
import type { AuthVariables } from "@/server/hono/middleware/auth";
import { v2AuthMiddleware } from "@/server/hono/middleware/v2-auth";
import { v2Error } from "@/server/hono/middleware/v2-error";
import { V2DraftError } from "@/server/modules/freight-requests/application/draft-service";
import { getIntakeOptions } from "@/server/modules/intake/application/get-intake-options";
import {createFacilityRoadPreview} from '@/server/modules/intake/application/facility-road-preview';

const intakeOptionsRouter = new Hono<{ Variables: AuthVariables }>();
const previewRoad=createFacilityRoadPreview({apiKey:process.env.GOOGLE_ROUTES_API_KEY});
intakeOptionsRouter.get('/road-preview',v2AuthMiddleware,async c=>{
 c.header('Cache-Control','no-store, private');c.header('Vary','Cookie, Authorization');
 if(c.req.header('sec-fetch-site')==='cross-site')return v2Error(c,new V2DraftError('FORBIDDEN_ORIGIN','Same-site preview required.',403));
 try{
  const {v2IntakeOptionsRepository}=await import('@/server/modules/intake/infrastructure/supabase-intake-options-repository');
  const member=c.get('member');
  return c.json(await previewRoad(member,await v2IntakeOptionsRepository(),c.req.query()));
 }catch(error){return v2Error(c,error);}
});
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

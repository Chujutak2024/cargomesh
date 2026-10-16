import {Hono,type Context} from "hono";
import {runWithMcpRequestIdentity} from "@/server/mcp/auth/request-context";
import {hasSessionOrigin} from "@/server/auth/session-origin";
import {V2DraftError} from "@/server/modules/freight-requests/application/draft-service";
import {CatalogServiceV2} from "@/server/modules/catalog/application/catalog-service";
import type {CatalogKindV2} from "@/shared/schemas/v2/catalog";
import {v2Error} from "../middleware/v2-error";
export const carrierPortalRouter=new Hono();
async function identity(c:Context,operation:()=>Promise<Response>){
 c.header("Cache-Control","no-store, private");c.header("Vary","Cookie, Authorization");
 const header=c.req.header("Authorization"),token=header?.match(/^Bearer ([^\s]+)$/i)?.[1];
 if(header!==undefined&&!token||!token&&!c.req.header("Cookie"))return v2Error(c,new V2DraftError("UNAUTHORIZED","Authentication required.",401));
 if(!token&&c.req.method==="POST"&&!hasSessionOrigin(c.req.raw))return v2Error(c,new V2DraftError("FORBIDDEN_ORIGIN","Same-origin session request required.",403));
 const run=async()=>{try{return await operation();}catch(error){return v2Error(c,error);}};
 return token?runWithMcpRequestIdentity({supabaseAccessToken:token},run):run();
}
carrierPortalRouter.get("/carrier-portal/access",c=>identity(c,async()=>{
 const {readCarrierPortalAccess}=await import("@/server/auth/carrier-portal");
 return c.json({schemaVersion:"2.0",data:await readCarrierPortalAccess()});
}));
const resources:[CatalogKindV2,string][]=[
 ["carriers",""],["depots","/depots"],["services","/services"],["partners","/partners"],
 ["areas","/services/:serviceId/areas"],["lanes","/services/:serviceId/lanes"],
 ...(["assets","capacity-pools","calendars","maintenances","repositioning-blocks","asset-capabilities","capability-definitions","drivers","vehicle-combinations","driver-assignments","vehicle-assignments"] as const).map(k=>[k,"/"+k] as [CatalogKindV2,string]),
];
for(const [kind,suffix] of resources){
 const path="/carrier-portal/carriers/:carrierId"+suffix;
 for(const detail of kind==="carriers"?[true]:[false,true])carrierPortalRouter.get(path+(detail&&kind!=="carriers"?"/:id":""),c=>identity(c,async()=>{
  const {requireAuthenticatedCarrier}=await import("@/server/auth/carrier");
  const {catalogRepositoryV2}=await import("@/server/modules/catalog/infrastructure/supabase-catalog-repository");
  const actor=await requireAuthenticatedCarrier(c.req.param("carrierId")!),service=new CatalogServiceV2(await catalogRepositoryV2());
  const scope={carrierId:actor.carrierId,serviceId:c.req.param("serviceId")??null};
  return c.json(detail?await service.get(actor,kind,scope,kind==="carriers"?actor.carrierId:c.req.param("id")!):await service.list(actor,kind,scope,c.req.query()));
 }));
 for(const revise of kind==="carriers"?[true]:[false,true])carrierPortalRouter.post(path+(revise?(kind==="carriers"?"/revisions":"/:id/revisions"):""),c=>identity(c,async()=>{
  const {requireAuthenticatedCarrier}=await import("@/server/auth/carrier");
  const {catalogRepositoryV2}=await import("@/server/modules/catalog/infrastructure/supabase-catalog-repository");
  const actor=await requireAuthenticatedCarrier(c.req.param("carrierId")!),service=new CatalogServiceV2(await catalogRepositoryV2());
  const body=await c.req.json().catch(()=>{throw new V2DraftError("VALIDATION_ERROR","JSON body required.",400);});
  const result=await service.command(actor,kind,{carrierId:actor.carrierId,serviceId:c.req.param("serviceId")??null},revise?(kind==="carriers"?actor.carrierId:c.req.param("id")!):null,body,c.req.header("Idempotency-Key"));
  return c.json(result,revise||result.meta.idempotentReplay?200:201);
 }));
}
carrierPortalRouter.get("/carrier-portal/carriers/:carrierId/routing/:kind",c=>identity(c,async()=>{
 const {requireAuthenticatedCarrier}=await import("@/server/auth/carrier");
 const {WorkflowServiceV2}=await import("@/server/modules/workflow/application/workflow-service");
 const {workflowRepositoryV2}=await import("@/server/modules/workflow/infrastructure/supabase-workflow-repository");
 const actor=await requireAuthenticatedCarrier(c.req.param("carrierId")!);
 return c.json(await new WorkflowServiceV2(await workflowRepositoryV2()).readCarrierRouting(actor,c.req.param("kind"),c.req.query()));
}));

export {identity as carrierPortalIdentity};

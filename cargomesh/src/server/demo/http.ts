import {INTAKE_OPTIONS_FIXTURE} from "../../features/v2-intake/fixtures/intake-options.fixture";
import {demoRequests} from "../../features/shipper-demo-preview/demo-data";
function error(status:number,code:string,message:string) { return Response.json({schemaVersion:"2.0",error:{code,message,retryable:false}},{status,headers:{"Cache-Control":"no-store"}}); }
/** An independent demo transport. Never forwards a request to Hono or Supabase. */
export async function demoResponse(request:Request) {
 if(process.env.CM_ENABLE_DEMO!=="1")return error(404,"DEMO_DISABLED","Demo is disabled.");
 if(request.method!=="GET")return error(409,"VISUAL_DEMO_READ_ONLY","This demo is read only. No changes were submitted.");
 const pathname=new URL(request.url).pathname;
 if(pathname==="/api/demo/v2/intake/options")return Response.json(structuredClone(INTAKE_OPTIONS_FIXTURE),{headers:{"Cache-Control":"no-store","X-CargoMesh-Data-Source":"fixture"}});
 const id=pathname.match(/^\/api\/demo\/v2\/freight\/requests\/([^/]+)$/)?.[1];
 const data=demoRequests.find(item=>item.id===id);
 if(data)return Response.json({schemaVersion:"2.0",data,meta:{environmentProfile:"v2-clean",idempotentReplay:false}},{headers:{"Cache-Control":"no-store"}});
 return error(404,"DEMO_DATA_UNAVAILABLE","No sample data is available for this action.");
}

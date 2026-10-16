import {NextResponse} from "next/server";
import {demoEnabled} from "@/server/demo/access";
import {authenticatedLoginDestination} from "@/server/auth/carrier-portal";
import {CARRIER_WORKSPACE_ENTRY,CARRIER_LOGIN_PATH} from "@/shared/schemas/v2/carrier-portal";
import {LOCALE_COOKIE} from "@/features/i18n/config";
export async function GET(request:Request){
 const source=new URL(request.url),portal=source.searchParams.get("portal");
 if(portal!=="shipper"&&portal!=="carrier")return new NextResponse("Unknown workspace",{status:400});
 const destination=portal==="carrier"
  ? await authenticatedLoginDestination(CARRIER_WORKSPACE_ENTRY).catch(()=>null) ?? CARRIER_LOGIN_PATH
  : demoEnabled()?"/demo/shipper/dashboard":"/dashboard";
 const response=new NextResponse(null,{status:303,headers:{Location:destination,"Cache-Control":"no-store"}});
 response.cookies.set(LOCALE_COOKIE,"en",{path:"/",sameSite:"lax",maxAge:31536000});
 return response;
}

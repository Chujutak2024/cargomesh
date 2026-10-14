import {NextResponse} from "next/server";
import {demoEnabled} from "@/server/demo/access";
import {LOCALE_COOKIE} from "@/features/i18n/config";
export async function GET(request:Request){
 const source=new URL(request.url),portal=source.searchParams.get("portal");
 if(portal!=="shipper"&&portal!=="carrier")return new NextResponse("Unknown workspace",{status:400});
 const destination=portal==="carrier"?"/v2-workspace#/fleet":demoEnabled()?"/demo/shipper/dashboard":"/dashboard";
 const response=new NextResponse(null,{status:303,headers:{Location:destination,"Cache-Control":"no-store"}});
 response.cookies.set(LOCALE_COOKIE,"en",{path:"/",sameSite:"lax",maxAge:31536000});
 return response;
}

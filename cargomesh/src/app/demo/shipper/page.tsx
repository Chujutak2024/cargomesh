import {redirect} from "next/navigation";
import {requireDemoPageAccess} from "@/server/demo/access";
export default async function Page(){await requireDemoPageAccess();redirect("/demo/shipper/dashboard");}

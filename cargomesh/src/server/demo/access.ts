import "server-only";
import {notFound} from "next/navigation";
export function demoEnabled() { return process.env.CM_ENABLE_DEMO === "1"; }
export async function requireDemoPageAccess() {
 if(!demoEnabled())notFound();
 return {role:"DEMO" as const};
}

import type {ReactNode} from "react";
import {AppShell} from "@/components/app-shell";
import {requireDemoPageAccess} from "@/server/demo/access";
export const dynamic="force-dynamic";
export default async function DemoLayout({children}:{children:ReactNode}) {
 await requireDemoPageAccess();
 return <AppShell identity={{organizationName:"CargoMesh Demo",displayName:"Visual demo",role:"DEMO"}}><aside role="note" style={{padding:12,background:"#e5f5f7",color:"#075d68",marginBottom:16}}>VISUAL DEMO · Simulated data · Read only · No account required</aside>{children}</AppShell>;
}

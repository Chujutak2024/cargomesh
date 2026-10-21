"use client";
import {DemoWorkspaceEntry,DemoWorkspaceProvider} from '@/features/workspace-demo/workspace-demo-controls';
/** Compatibility entry for the explicitly enabled assigned demo login route. */
export function AssignedDemoEntry({workspace,automatic=false}:{workspace:'client'|'carrier';automatic?:boolean}){
 return <DemoWorkspaceProvider enabled><DemoWorkspaceEntry workspace={workspace} automatic={automatic}/></DemoWorkspaceProvider>;
}

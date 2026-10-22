"use client";
import Link from 'next/link';
import type {ReactNode} from "react";
import {useWorkspaceNavigation} from "./workspace-navigation";

export function WorkspaceEntryLink({href,className,workspace,children}:{href:string;className:string;workspace:"Carrier"|"Shipper";children:ReactNode}) {
 const begin=useWorkspaceNavigation();
 return <Link href={href} className={className} onNavigate={()=>begin(workspace==="Carrier"?"carrier":"client")}>
  {children}
 </Link>;
}

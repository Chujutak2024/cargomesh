"use client";
import NextLink from "next/link";
import {usePathname} from "next/navigation";
import type {ComponentProps} from "react";
import {workspaceHref} from "./paths";
/** Shared presentation keeps demo navigation inside its own route namespace. */
export function WorkspaceLink(props:ComponentProps<typeof NextLink>) {
 const pathname=usePathname();
 return <NextLink {...props} href={typeof props.href==="string"?workspaceHref(props.href,pathname):props.href}/>;
}

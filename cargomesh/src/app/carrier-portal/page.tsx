import type { Metadata } from "next";
import { CarrierPortal } from "@/features/carrier-portal/portal";
export const metadata: Metadata = {title:"CargoMesh V2 | Carrier portal",description:"Carrier catalog, commercial responses and operations using the V2 API."};
export default function Page(){return <CarrierPortal/>;}

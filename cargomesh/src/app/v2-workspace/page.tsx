import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ConnectedCoordinator } from "@/features/carrier-portal/coordinator";

export const metadata: Metadata = {
  title: "CargoMesh V2 | ROAD workspace",
  description: "Connected V2 request coordination with shared request and candidate state.",
};

export default async function V2WorkspacePage() {
  // Both local accesses point to the current application. The 8080 origin keeps
  // the user's saved browser data and the existing Maps referrer restriction.
  if ((await headers()).get("host") === "127.0.0.1:8083") {
    redirect("http://127.0.0.1:8080/v2-workspace");
  }
  return <ConnectedCoordinator />;
}

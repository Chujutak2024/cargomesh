import type { Metadata } from "next";
import { ConnectedCoordinator } from "@/features/carrier-portal/coordinator";
import { authenticatedLoginDestination } from "@/server/auth/carrier-portal";
import { WorkspaceAccessRequired } from "@/components/workspace-access-required";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "CargoMesh V2 | ROAD workspace",
  description: "Connected V2 request coordination with shared request and candidate state.",
};

export default async function V2WorkspacePage() {
  // Validate the cookie with Supabase before rendering even the local presentation.
  // Carrier grants still do not authorize shipper APIs or change domain permissions.
  const destination = await authenticatedLoginDestination('/v2-workspace');
  if (!destination) return <WorkspaceAccessRequired />;
  return <ConnectedCoordinator />;
}

import { carrierDemoMode } from '@/features/carrier-portal/carrier-workspace-model';
import { demoEnabled } from "@/server/demo/access";
import type { Metadata } from "next";
import { ConnectedCoordinator } from "@/features/carrier-portal/coordinator";
import { authenticatedLoginDestination } from "@/server/auth/carrier-portal";
import { WorkspaceAccessRequired } from "@/components/workspace-access-required";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "CargoMesh V2 | ROAD workspace",
  description: "Authorized carrier operations, network and fleet with an explicit local demo.",
};

export default async function V2WorkspacePage({searchParams}:{searchParams:Promise<{demo?:string|string[]}>}) {
  const params=await searchParams;
  const previews=demoEnabled();
  // Validate the cookie with Supabase before rendering even the local presentation.
  // Carrier grants still do not authorize shipper APIs or change domain permissions.
  const destination = await authenticatedLoginDestination('/v2-workspace');
  if (!destination) return <WorkspaceAccessRequired />;
  return <ConnectedCoordinator previewEnabled={previews} demoMode={carrierDemoMode(params.demo,previews)} />;
}

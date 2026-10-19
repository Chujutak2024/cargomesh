import { notFound } from "next/navigation";
import { z } from "zod";
import { RequestWorkspace } from "@/features/shipper-portal/request-workspace";
import type { WorkflowRecordV2 } from "@/features/shipper-portal/shipper-model";
import { V2DraftError } from "@/server/modules/freight-requests/application/draft-service";
import { readWorkspaceRequestFlow } from "@/server/demo/workspace-demo-server";

export const dynamic = "force-dynamic";
export default async function RequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const flow = await readWorkspaceRequestFlow(id).catch((error) => {
    if (error instanceof V2DraftError && error.httpStatus === 404) notFound();
    throw error;
  });
  return <RequestWorkspace commercialRefreshEnabled={false} initialRequest={flow.request} initialWorkflow={flow.workflow as Record<string, WorkflowRecordV2[]>}/>;
}

import { notFound } from "next/navigation";
import { z } from "zod";
import { RequestWorkspace } from "@/features/shipper-portal/request-workspace";
import type { WorkflowRecordV2 } from "@/features/shipper-portal/shipper-model";
import { V2DraftError } from "@/server/modules/freight-requests/application/draft-service";
import { readOperationsRequestFlow } from "@/server/services/v2-workspace/operations-server";
import { OperationsNavigation, OperationsReadNotice } from "@/features/shipper-portal/operations-navigation";
import styles from "@/features/shipper-portal/shipper-portal.module.css";

export const dynamic = "force-dynamic";
export default async function RequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const flow = await readOperationsRequestFlow(id).catch((error) => {
    if (error instanceof V2DraftError && error.httpStatus === 404) notFound();
    throw error;
  });
  return <div className={styles.page}><OperationsNavigation detail/><OperationsReadNotice issues={flow.issues}/>
    <RequestWorkspace key={`${flow.request.id}-${Date.now()}`} initialRequest={flow.request}
      initialWorkflow={flow.workflow as Record<string, WorkflowRecordV2[]>} initialCatalog={flow.catalog} readIncomplete={flow.issues.length > 0}/></div>;
}

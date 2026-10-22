import {displayReference,locationDisplayLabel} from '@/shared/lib/display-identity';
import type { FreightRequestV2Data } from "@/features/v2-intake/contracts";
import type { WorkflowRecordV2 } from "./shipper-model";
import type { Booking, Execution, ExecutionEvent, Incident } from "./tracking-journey";
import type { TrackingListItem } from "./tracking-presentation";

type ChildReader = (kind: "execution-events" | "incidents", options: { parentId: string }) => Promise<WorkflowRecordV2[]>;
/** Reads are authorized by the injected server service. Errors propagate, never become empty evidence. */
export async function loadTrackingItems(executions: Execution[], bookings: Booking[], requests: FreightRequestV2Data[], read: ChildReader): Promise<TrackingListItem[]> {
  const requestById = new Map(requests.map((request) => [request.id, request]));
  const items: TrackingListItem[] = [];
  for (let index = 0; index < executions.length; index += 5) {
    items.push(...await Promise.all(executions.slice(index, index + 5).map(async (execution) => {
      const [events, incidents] = await Promise.all([
        read("execution-events", { parentId: execution.id }), read("incidents", { parentId: execution.id }),
      ]);
      const request = execution.requestId ? requestById.get(execution.requestId) : null;
      return {
        execution,
        booking: bookings.find((item) => item.id === execution.data.bookingId && item.requestId === execution.requestId) ?? null,
        events: events.filter((item): item is ExecutionEvent => item.kind === "execution-events" && item.requestId === execution.requestId),
        incidents: incidents.filter((item): item is Incident => item.kind === "incidents" && item.requestId === execution.requestId),
        reference: request?displayReference(request.referenceCode,'PED',request.id):displayReference(execution.id,'OP'),
        corridor: request ? `${locationDisplayLabel(request.origin.city)} → ${locationDisplayLabel(request.destination.city)}` : "—",
      };
    })));
  }
  return items;
}

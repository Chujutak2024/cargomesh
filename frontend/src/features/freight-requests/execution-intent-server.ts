import "server-only";

import { requireAuthenticatedMember } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

import {
  FREIGHT_REQUEST_EXECUTION_INTENT_SCHEMA_VERSION,
  parseFreightRequestExecutionIntent,
  type FreightRequestExecutionIntent,
} from "./execution-intent-contracts";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type FreightRequestExecutionIntentRow = {
  id: string;
  code: string;
  organization_id: string;
  status: string;
  pickup_mode: string;
  required_pickup: string;
  pickup_window_start: string | null;
  pickup_window_end: string | null;
  delivery_deadline: string | null;
  updated_at: string;
};

export class FreightRequestExecutionIntentError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly httpStatus: number,
  ) {
    super(message);
    this.name = "FreightRequestExecutionIntentError";
  }
}
export async function getFreightRequestExecutionIntent(
  freightRequestId: string,
): Promise<FreightRequestExecutionIntent> {
  if (!UUID_PATTERN.test(freightRequestId)) {
    throw new FreightRequestExecutionIntentError(
      "INVALID_ARGUMENT",
      "freightRequestId must be a UUID.",
      400,
    );
  }

  const member = await requireAuthenticatedMember();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("freight_requests")
    .select(
      "id,code,organization_id,status,pickup_mode,required_pickup,pickup_window_start,pickup_window_end,delivery_deadline,updated_at",
    )
    .eq("id", freightRequestId)
    .eq("organization_id", member.organizationId)
    .maybeSingle();

  if (error) {
    throw new FreightRequestExecutionIntentError(
      "FREIGHT_REQUEST_INTENT_UNAVAILABLE",
      "Unable to load the FreightRequest execution intent.",
      500,
    );
  }
  if (!data) {
    throw new FreightRequestExecutionIntentError(
      "NOT_FOUND",
      "FreightRequest not found.",
      404,
    );
  }

  const row = data as unknown as FreightRequestExecutionIntentRow;
  try {
    return parseFreightRequestExecutionIntent({
      schemaVersion: FREIGHT_REQUEST_EXECUTION_INTENT_SCHEMA_VERSION,
      freightRequestId: row.id,
      requestCode: row.code,
      status: row.status,
      pickupMode: row.pickup_mode,
      requiredPickup: row.required_pickup,
      pickupWindowStart: row.pickup_window_start,
      pickupWindowEnd: row.pickup_window_end,
      deliveryDeadline: row.delivery_deadline,
      updatedAt: row.updated_at,
    });
  } catch {
    throw new FreightRequestExecutionIntentError(
      "INVALID_FREIGHT_REQUEST_INTENT",
      "The persisted FreightRequest execution intent is invalid.",
      500,
    );
  }
}

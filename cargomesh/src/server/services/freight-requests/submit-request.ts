import "server-only";

import { requireAuthenticatedMember } from "@/server/auth/member";
import { createServerSupabaseClient } from "@/server/db/supabase/server";
import { assertSubmittableFreightRequest, FreightSubmissionError, type SubmissionRow } from "./submission-policy";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type SubmitFreightRequestInput = { freightRequestId: string; draftVersion: number };
export type SubmittedFreightRequest = {
  freightRequestId: string; requestCode: string; status: "PENDING";
  draftVersion: number; replayed: boolean;
};

export async function submitFreightRequest(raw: SubmitFreightRequestInput): Promise<SubmittedFreightRequest> {
  if (!UUID.test(raw.freightRequestId) || !Number.isSafeInteger(raw.draftVersion) || raw.draftVersion < 1) {
    throw new FreightSubmissionError("INVALID_ARGUMENT", "A request UUID and positive draftVersion are required.");
  }
  const actor = await requireAuthenticatedMember();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from("freight_requests")
    .select("id,organization_id,code,status,draft_version,cargo_category_id,origin_country,origin_city,destination_country,destination_city,cargo_weight_kg,cargo_volume_m3,cargo_entry_method,entry_quantity,entry_unit_weight_kg,units_per_entry,transport_mode,service_type,optimization_strategy,pickup_mode,pickup_window_start,pickup_window_end,required_pickup,delivery_deadline")
    .eq("id", raw.freightRequestId).maybeSingle();
  if (error) throw new FreightSubmissionError("SUBMISSION_UNAVAILABLE", "Unable to read the request.");
  if (!data) throw new FreightSubmissionError("NOT_FOUND", "FreightRequest not found.");
  const row = data as unknown as SubmissionRow;
  await requireAuthenticatedMember({ organizationId: row.organization_id, requiredRole: "SUPERVISOR" });
  if (row.status === "PENDING" && row.draft_version === raw.draftVersion + 1) {
    return { freightRequestId: row.id, requestCode: row.code, status: "PENDING", draftVersion: row.draft_version, replayed: true };
  }
  if (row.status !== "DRAFT" || row.draft_version !== raw.draftVersion) {
    throw new FreightSubmissionError("STALE_DRAFT", "The draft version or request status changed. Reload before submitting.");
  }
  assertSubmittableFreightRequest(row);
  const { data: updated, error: updateError } = await supabase.from("freight_requests")
    .update({ status: "PENDING", draft_version: raw.draftVersion + 1,
      confirmed_by_member_id: actor.memberId,
      confirmed_at: new Date().toISOString(), updated_at: new Date().toISOString() } as never)
    .eq("id", row.id).eq("organization_id", row.organization_id)
    .eq("draft_version", raw.draftVersion).eq("status", "DRAFT")
    .select("id,code,draft_version").maybeSingle();
  if (updateError) throw new FreightSubmissionError("SUBMISSION_UNAVAILABLE", "Unable to submit the request.");
  if (!updated) {
    const { data: current, error: replayError } = await supabase.from("freight_requests")
      .select("id,code,status,draft_version").eq("id", row.id).maybeSingle();
    if (replayError) throw new FreightSubmissionError("SUBMISSION_UNAVAILABLE", "Unable to verify the submission.");
    const replay = current as { id: string; code: string; status: string; draft_version: number } | null;
    if (replay?.status === "PENDING" && replay.draft_version === raw.draftVersion + 1) {
      return { freightRequestId: replay.id, requestCode: replay.code, status: "PENDING",
        draftVersion: replay.draft_version, replayed: true };
    }
    throw new FreightSubmissionError("STALE_DRAFT", "The request changed during submission. Retry with the same version or reload.");
  }
  const submitted = updated as { id: string; code: string; draft_version: number };
  return {
    freightRequestId: submitted.id, requestCode: submitted.code, status: "PENDING",
    draftVersion: submitted.draft_version, replayed: false,
  };
}

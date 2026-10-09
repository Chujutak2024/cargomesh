import "server-only";
import { createV2ServerSupabaseClient } from "@/server/db/supabase/v2";
import { z } from "zod";
import { V2DraftError } from "@/server/modules/freight-requests/application/draft-service";

export type AuthenticatedCarrierContext = {
  kind: "carrier"; userId: string; operatorId: string; carrierId: string; organizationId: null;
};
/** The database checks verified operator AND an unexpired server-owned carrier grant. */
export async function requireAuthenticatedCarrier(carrierId: string): Promise<AuthenticatedCarrierContext> {
  const db = await createV2ServerSupabaseClient();
  const { data: { user }, error } = await db.auth.getUser();
  if (error || !user) throw new V2DraftError("UNAUTHORIZED", "Authentication required.", 401);
  const { data, error: readError } = await db.rpc("get_v2_carrier_identity", { p_carrier_id: z.string().uuid().parse(carrierId) });
  if (readError) throw new V2DraftError("FORBIDDEN_CARRIER_IDENTITY", "Authorized carrier identity required.", 403);
  const identity = z.object({ operatorId: z.string().uuid(), carrierId: z.literal(carrierId) }).strict().parse(data);
  return { kind: "carrier", userId: user.id, ...identity, organizationId: null };
}

import { z } from "zod";
import { createV2ServerSupabaseClient } from "@/server/db/supabase/v2";
import { identityDatabaseError } from "../../identity/infrastructure/supabase-identity-repository";
import type { LocationRepositoryV2 } from "../application/location-service";
export async function locationRepositoryV2(): Promise<LocationRepositoryV2> {
  const db = await createV2ServerSupabaseClient();
  return { async candidates(actor, query) {
    const { data, error } = await db.rpc("read_v2_location_candidates", { p_organization_id: actor.organizationId,
      p_member_id: actor.memberId, p_query: query });
    if (error) identityDatabaseError(error);
    return z.array(z.unknown()).parse(data);
  } };
}

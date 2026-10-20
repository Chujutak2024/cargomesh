import { RoadEquipmentOptionsV2 } from "@/shared/schemas/v2/intake-options";
import { createV2ServerSupabaseClient } from "@/server/db/supabase/v2";
import type {
  IntakeOptionsRepository, RoadEquipmentOption,
} from "../application/get-intake-options";

type Client = Awaited<ReturnType<typeof createV2ServerSupabaseClient>>;

export class SupabaseIntakeOptionsRepository implements IntakeOptionsRepository {
  constructor(private readonly db: Client) {}

  async listActiveFacilities(organizationId: string) {
    const { data, error } = await this.db.from("facilities")
      .select("id,organization_id,code,name,country_code,region_code,city,latitude,longitude,active")
      .eq("organization_id", organizationId).eq("active", true).order("code");
    if (error) throw new Error(`V2_OPTIONS_DB_ERROR: ${error.code}`);
    return data;
  }

  async listActiveCargoCategories() {
    const { data, error } = await this.db.from("cargo_categories")
      .select("id,code,name,active,recommended_entry_methods,intake_specification_schema,suggested_requirements,recommended_vehicle_classes")
      .eq("active", true).order("code");
    if (error) throw new Error(`V2_OPTIONS_DB_ERROR: ${error.code}`);
    return data;
  }

  async listSupportedRoadEquipment(): Promise<RoadEquipmentOption[]> {
    return RoadEquipmentOptionsV2.map((item) => ({ ...item }));
  }
}

export async function v2IntakeOptionsRepository() {
  return new SupabaseIntakeOptionsRepository(await createV2ServerSupabaseClient());
}

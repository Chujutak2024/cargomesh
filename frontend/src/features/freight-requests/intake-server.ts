import "server-only";

import { requireAuthenticatedMember } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

import {
  FreightRequestIntakeError,
  getFreightRequestIntake as getFreightRequestIntakeWithDependencies,
  type FreightRequestIntakeDependencies,
  type PersistedIntakeRecord,
} from "./intake-server-policy";

export {
  FreightRequestIntakeError,
  type FreightRequestIntakeDependencies,
  type FreightRequestIntakeSource,
  type PersistedIntakeRecord,
} from "./intake-server-policy";

function formatPlace(address: string | null, city: string, country: string) {
  return address ? `${address}, ${city}, ${country}` : `${city}, ${country}`;
}

type FreightRequestRow = Database["public"]["Tables"]["freight_requests"]["Row"];
type OrganizationRow = { name: string; default_currency: string };
type MemberRow = { display_name: string };
type CargoCategoryRow = { name: string; code: string };
type CargoProfileRow = { profile_name: string };

async function findPersistedIntakeRecord(
  organizationId: string,
  memberId: string,
  requestCode: string,
): Promise<PersistedIntakeRecord | null> {
  const supabase = await createServerSupabaseClient();
  const { data: freightRequest, error: freightRequestError } = await supabase
    .from("freight_requests")
    .select(
      "id,code,organization_id,status,cargo_category_id,cargo_profile_id,cargo_entry_method,entry_quantity,units_per_entry,cargo_weight_kg,cargo_volume_m3,entry_unit_weight_kg,entry_length_cm,entry_width_cm,entry_height_cm,origin_address,origin_city,origin_country,destination_address,destination_city,destination_country,pickup_contact_name,pickup_contact_phone,receiver_name,receiver_company,receiver_phone,special_instructions,transport_mode,service_type,pickup_mode,required_pickup,pickup_window_start,pickup_window_end,delivery_deadline,budget_max,optimization_strategy,available_documents,updated_at",
    )
    .eq("organization_id", organizationId)
    .eq("code", requestCode)
    .maybeSingle();

  if (freightRequestError) {
    throw new FreightRequestIntakeError(
      "FREIGHT_REQUEST_INTAKE_UNAVAILABLE",
      "Unable to load the FreightRequest intake.",
      500,
    );
  }
  const request = freightRequest as unknown as FreightRequestRow | null;
  if (!request) return null;

  const [organizationResult, requesterResult, categoryResult, profileResult] = await Promise.all([
    supabase.from("organizations").select("name,default_currency").eq("id", organizationId).maybeSingle(),
    supabase
      .from("organization_members")
      .select("display_name")
      .eq("id", memberId)
      .eq("organization_id", organizationId)
      .eq("status", "ACTIVE")
      .maybeSingle(),
    supabase
      .from("cargo_categories")
      .select("name,code")
      .eq("id", request.cargo_category_id)
      .maybeSingle(),
    request.cargo_profile_id
      ? supabase
        .from("organization_cargo_profiles")
        .select("profile_name")
        .eq("id", request.cargo_profile_id)
        .eq("organization_id", organizationId)
        .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (
    organizationResult.error ||
    requesterResult.error ||
    categoryResult.error ||
    profileResult.error ||
    !organizationResult.data ||
    !requesterResult.data ||
    !categoryResult.data
  ) {
    throw new FreightRequestIntakeError(
      "FREIGHT_REQUEST_INTAKE_UNAVAILABLE",
      "Unable to resolve the FreightRequest intake context.",
      500,
    );
  }

  const organization = organizationResult.data as unknown as OrganizationRow;
  const requester = requesterResult.data as unknown as MemberRow;
  const category = categoryResult.data as unknown as CargoCategoryRow;
  const profile = profileResult.data as unknown as CargoProfileRow | null;

  return {
    id: request.id,
    code: request.code,
    organizationId: request.organization_id,
    organizationName: organization.name,
    defaultCurrency: organization.default_currency,
    requesterMemberId: memberId,
    requesterDisplayName: requester.display_name,
    status: request.status,
    cargoProfileName: profile?.profile_name ?? null,
    cargoCategoryName: category.name,
    cargoCategoryCode: category.code,
    entryMethod: request.cargo_entry_method,
    quantity: request.entry_quantity,
    unitsPerEntry: request.units_per_entry,
    totalWeightKg: request.cargo_weight_kg,
    totalVolumeM3: request.cargo_volume_m3,
    unitWeightKg: request.entry_unit_weight_kg,
    lengthCm: request.entry_length_cm,
    widthCm: request.entry_width_cm,
    heightCm: request.entry_height_cm,
    origin: formatPlace(request.origin_address, request.origin_city, request.origin_country),
    destination: formatPlace(request.destination_address, request.destination_city, request.destination_country),
    pickupContactName: request.pickup_contact_name,
    pickupContactPhone: request.pickup_contact_phone,
    deliveryContactName: request.receiver_name,
    deliveryContactCompany: request.receiver_company,
    deliveryContactPhone: request.receiver_phone,
    operationalNotes: request.special_instructions,
    transportMode: request.transport_mode,
    serviceType: request.service_type,
    pickupMode: request.pickup_mode,
    requiredPickup: request.required_pickup,
    pickupWindowStart: request.pickup_window_start,
    pickupWindowEnd: request.pickup_window_end,
    deliveryDeadline: request.delivery_deadline,
    budgetMax: request.budget_max,
    strategy: request.optimization_strategy,
    availableDocuments: request.available_documents,
    updatedAt: request.updated_at,
  };
}

const defaultDependencies: FreightRequestIntakeDependencies = {
  resolveMember: requireAuthenticatedMember,
  source: { findByCode: findPersistedIntakeRecord },
};

export async function getFreightRequestIntake(requestCode: string) {
  return getFreightRequestIntakeWithDependencies(requestCode, defaultDependencies);
}

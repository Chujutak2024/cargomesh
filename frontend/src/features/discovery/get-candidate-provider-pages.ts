import "server-only";

import type { CandidateProvider } from "@/features/providers/contracts";
import { requireAuthenticatedMember } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  selectCandidateProviders,
  type CarrierForMatching,
} from "./candidate-matcher";

export type { CandidateProvider };

export type CandidateDiscoveryOutput = {
  freight_request_id: string;
  freight_request_code: string;
  corridor: {
    origin_country: string;
    origin_city: string;
    destination_country: string;
    destination_city: string;
    cross_border: boolean;
  };
  cargo: {
    weight_kg: number;
    volume_m3: number | null;
    package_count: number;
    entry_method: string;
  };
  candidates: CandidateProvider[];
};

type FreightRequestRow = {
  id: string;
  code: string;
  organization_id: string;
  cargo_category_id: string;
  origin_country: string;
  origin_city: string;
  destination_country: string;
  destination_city: string;
  cargo_weight_kg: number;
  cargo_volume_m3: number | null;
  package_count: number | null;
  cargo_entry_method: string | null;
  cross_border: boolean;
};

type CarrierWithServicesRow = {
  id: string;
  name: string;
  code: string;
  provider_url: string | null;
  carrier_services: {
    id: string;
    origin_country: string;
    destination_country: string;
    max_capacity_kg: number;
    max_volume_m3: number | null;
    supports_cross_border: boolean;
    active: boolean;
    carrier_service_cargo_categories: { cargo_category_id: string }[];
  }[];
};

/**
 * Resolves compatible provider pages for a FreightRequest. The user-session
 * client is intentional: RLS scopes the request to the active organization.
 */
export async function get_candidate_provider_pages(
  freight_request_id: string,
): Promise<CandidateDiscoveryOutput | null> {
  const identifier = freight_request_id.trim();
  if (!identifier) {
    throw new Error("INVALID_ARGUMENT: freight_request_id is required.");
  }

  await requireAuthenticatedMember();
  const supabase = await createServerSupabaseClient();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
  const requestQuery = supabase
    .from("freight_requests")
    .select("id,code,organization_id,cargo_category_id,origin_country,origin_city,destination_country,destination_city,cargo_weight_kg,cargo_volume_m3,package_count,cargo_entry_method,cross_border");

  const { data: requestData, error: requestError } = isUuid
    ? await requestQuery.eq("id", identifier).maybeSingle()
    : await requestQuery.eq("code", identifier.toUpperCase()).maybeSingle();

  if (requestError) {
    throw new Error("DISCOVERY_UNAVAILABLE: Unable to load freight request.");
  }
  if (!requestData) return null;

  const freightRequest = requestData as FreightRequestRow;
  await requireAuthenticatedMember({ organizationId: freightRequest.organization_id });

  const { data: carriersData, error: carriersError } = await supabase
    .from("carriers")
    .select(`
      id, name, code, provider_url,
      carrier_services (
        id, origin_country, destination_country, max_capacity_kg, max_volume_m3,
        supports_cross_border, active,
        carrier_service_cargo_categories ( cargo_category_id )
      )
    `)
    .eq("status", "ACTIVE")
    .eq("supports_webmcp", true)
    .not("provider_url", "is", null);

  if (carriersError) {
    throw new Error("DISCOVERY_UNAVAILABLE: Unable to load carrier registry.");
  }

  const carriers: CarrierForMatching[] = ((carriersData ?? []) as unknown as CarrierWithServicesRow[]).map(
    (carrier) => ({
      id: carrier.id,
      code: carrier.code,
      displayName: carrier.name,
      providerUrl: carrier.provider_url,
      active: true,
      supportsWebMcp: true,
      services: (carrier.carrier_services ?? []).map((service) => ({
        id: service.id,
        originCountry: service.origin_country,
        destinationCountry: service.destination_country,
        maxCapacityKg: service.max_capacity_kg,
        maxVolumeM3: service.max_volume_m3,
        supportsCrossBorder: service.supports_cross_border,
        active: service.active,
        cargoCategoryIds: (service.carrier_service_cargo_categories ?? []).map(
          (category) => category.cargo_category_id,
        ),
      })),
    }),
  );

  return {
    freight_request_id: freightRequest.id,
    freight_request_code: freightRequest.code,
    corridor: {
      origin_country: freightRequest.origin_country,
      origin_city: freightRequest.origin_city,
      destination_country: freightRequest.destination_country,
      destination_city: freightRequest.destination_city,
      cross_border: freightRequest.cross_border,
    },
    cargo: {
      weight_kg: freightRequest.cargo_weight_kg,
      volume_m3: freightRequest.cargo_volume_m3,
      package_count: freightRequest.package_count ?? 1,
      entry_method: freightRequest.cargo_entry_method ?? "TOTAL_WEIGHT",
    },
    candidates: selectCandidateProviders(
      {
        cargoCategoryId: freightRequest.cargo_category_id,
        originCountry: freightRequest.origin_country,
        destinationCountry: freightRequest.destination_country,
        cargoWeightKg: freightRequest.cargo_weight_kg,
        cargoVolumeM3: freightRequest.cargo_volume_m3,
        crossBorder: freightRequest.cross_border,
      },
      carriers,
    ),
  };
}

export const getCandidateProviderPages = get_candidate_provider_pages;
export const discoverCandidateProviders = get_candidate_provider_pages;

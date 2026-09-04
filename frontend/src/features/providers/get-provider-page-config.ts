import "server-only";

import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";

import type { ProviderPageConfig } from "./contracts";
import { isProviderServiceId } from "./provider-route-params";

type CarrierRow = {
  id: string;
  name: string;
  code: string;
  provider_url: string | null;
};

type CarrierServiceRow = {
  id: string;
  provider_service_code: string | null;
  transport_mode: string;
  service_type: string;
  max_capacity_kg: number;
  max_volume_m3: number | null;
  supports_cross_border: boolean;
};

const CANONICAL_PROVIDER_CONFIGS: Record<string, Omit<ProviderPageConfig, "providerUrl">> = {
  ANDES: {
    carrierId: "20000000-0000-0000-0000-000000000001",
    carrierCode: "ANDES",
    displayName: "Andes Express",
    matchingServiceId: "40000000-0000-0000-0000-000000000001",
    service: {
      providerServiceCode: "ANDES-PECL-FTL",
      transportMode: "ROAD",
      serviceType: "FTL",
      maxCapacityKg: 24000,
      maxVolumeM3: 70,
      supportsCrossBorder: true,
    },
  },
  INCA: {
    carrierId: "20000000-0000-0000-0000-000000000002",
    carrierCode: "INCA",
    displayName: "Transportes Inca",
    matchingServiceId: "40000000-0000-0000-0000-000000000002",
    service: {
      providerServiceCode: "INCA-PECL-FTL",
      transportMode: "ROAD",
      serviceType: "FTL",
      maxCapacityKg: 22000,
      maxVolumeM3: 65,
      supportsCrossBorder: true,
    },
  },
  PACIFIC: {
    carrierId: "20000000-0000-0000-0000-000000000003",
    carrierCode: "PACIFIC",
    displayName: "Pacific Cargo",
    matchingServiceId: "40000000-0000-0000-0000-000000000003",
    service: {
      providerServiceCode: "PACIFIC-PECL-FTL",
      transportMode: "ROAD",
      serviceType: "FTL",
      maxCapacityKg: 20000,
      maxVolumeM3: 60,
      supportsCrossBorder: true,
    },
  },
};

function carrierSlugToCode(carrierSlug: string): string | null {
  const normalizedSlug = decodeURIComponent(carrierSlug).trim().toLowerCase().replace(/[\s_]+/g, "-");

  if (normalizedSlug === "andes" || normalizedSlug === "andes-express") return "ANDES";
  if (normalizedSlug === "inca" || normalizedSlug === "transportes-inca") return "INCA";
  if (normalizedSlug === "pacific" || normalizedSlug === "pacific-cargo") return "PACIFIC";

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalizedSlug)) {
    return null;
  }

  return normalizedSlug.replaceAll("-", "_").toUpperCase();
}

export const getProviderPageConfig = cache(async function getProviderPageConfig(
  carrierSlug: string,
  serviceId?: string | null,
): Promise<ProviderPageConfig | null> {
  const carrierCode = carrierSlugToCode(carrierSlug);

  if (!carrierCode) {
    return null;
  }

  const canonicalFallback = CANONICAL_PROVIDER_CONFIGS[carrierCode];

  let supabase;
  try {
    supabase = createAdminClient();
  } catch {
    if (canonicalFallback) {
      return {
        ...canonicalFallback,
        providerUrl: `/providers/${carrierSlug.toLowerCase().replace(/[\s_]+/g, "-")}`,
      };
    }
    return null;
  }

  const { data: carrierData, error: carrierError } = await supabase
    .from("carriers")
    .select("id,name,code,provider_url")
    .eq("code", carrierCode)
    .eq("status", "ACTIVE")
    .eq("supports_webmcp", true)
    .not("provider_url", "is", null)
    .maybeSingle();

  if (carrierError || !carrierData) {
    if (canonicalFallback) {
      return {
        ...canonicalFallback,
        providerUrl: `/providers/${carrierSlug.toLowerCase().replace(/[\s_]+/g, "-")}`,
      };
    }
    return null;
  }

  const carrier = carrierData as CarrierRow;
  let serviceQuery = supabase
    .from("carrier_services")
    .select(
      "id,provider_service_code,transport_mode,service_type,max_capacity_kg,max_volume_m3,supports_cross_border",
    )
    .eq("carrier_id", carrier.id)
    .eq("active", true)
    .not("provider_service_code", "is", null);

  if (serviceId && isProviderServiceId(serviceId)) {
    serviceQuery = serviceQuery.eq("id", serviceId);
  }

  const { data: serviceData, error: serviceError } = await serviceQuery
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (serviceError || !serviceData || !carrier.provider_url) {
    if (canonicalFallback) {
      return {
        ...canonicalFallback,
        displayName: carrier.name,
        carrierId: carrier.id,
        providerUrl: carrier.provider_url ?? `/providers/${carrierSlug.toLowerCase().replace(/[\s_]+/g, "-")}`,
      };
    }
    return null;
  }

  const service = serviceData as CarrierServiceRow;

  if (!service.provider_service_code) {
    return null;
  }

  return {
    carrierId: carrier.id,
    carrierCode: carrier.code,
    displayName: carrier.name,
    providerUrl: carrier.provider_url,
    matchingServiceId: service.id,
    service: {
      providerServiceCode: service.provider_service_code,
      transportMode: service.transport_mode,
      serviceType: service.service_type,
      maxCapacityKg: service.max_capacity_kg,
      maxVolumeM3: service.max_volume_m3,
      supportsCrossBorder: service.supports_cross_border,
    },
  };
});

import "server-only";

import { createClient } from "@supabase/supabase-js";
import { cache } from "react";

import type { ProviderPageConfig } from "./contracts";

type CarrierRow = {
  id: string;
  name: string;
  code: string;
  provider_url: string | null;
};

type CarrierServiceRow = {
  id: string;
  transport_mode: string;
  service_type: string;
  max_capacity_kg: number;
  max_volume_m3: number | null;
  supports_cross_border: boolean;
};

function carrierSlugToCode(carrierSlug: string): string | null {
  const normalizedSlug = carrierSlug.trim().toLowerCase();

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalizedSlug)) {
    return null;
  }

  return normalizedSlug.replaceAll("-", "_").toUpperCase();
}

function getServerSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export const getProviderPageConfig = cache(async function getProviderPageConfig(
  carrierSlug: string,
): Promise<ProviderPageConfig | null> {
  const carrierCode = carrierSlugToCode(carrierSlug);
  const supabase = getServerSupabaseClient();

  if (!carrierCode || !supabase) {
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
    return null;
  }

  const carrier = carrierData as CarrierRow;
  const { data: serviceData, error: serviceError } = await supabase
    .from("carrier_services")
    .select(
      "id,transport_mode,service_type,max_capacity_kg,max_volume_m3,supports_cross_border",
    )
    .eq("carrier_id", carrier.id)
    .eq("active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (serviceError || !serviceData || !carrier.provider_url) {
    return null;
  }

  const service = serviceData as CarrierServiceRow;

  return {
    carrierId: carrier.id,
    carrierCode: carrier.code,
    displayName: carrier.name,
    providerUrl: carrier.provider_url,
    matchingServiceId: service.id,
    service: {
      transportMode: service.transport_mode,
      serviceType: service.service_type,
      maxCapacityKg: service.max_capacity_kg,
      maxVolumeM3: service.max_volume_m3,
      supportsCrossBorder: service.supports_cross_border,
    },
  };
});

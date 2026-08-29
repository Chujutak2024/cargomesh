import type { CandidateProvider } from "@/features/providers/contracts";

export type FreightRequestForMatching = {
  cargoCategoryId: string;
  originCountry: string;
  originRegion: string | null;
  destinationCountry: string;
  destinationRegion: string | null;
  cargoWeightKg: number;
  cargoVolumeM3: number | null;
  crossBorder: boolean;
  transportMode: string;
  serviceType: string;
  requiresRefrigeration: boolean;
  temperatureMinC: number | null;
  temperatureMaxC: number | null;
  isHazardous: boolean;
  isFragile: boolean;
  isOversized: boolean;
};

export type CarrierServiceForMatching = {
  id: string;
  originCountry: string;
  originRegion: string | null;
  destinationCountry: string;
  destinationRegion: string | null;
  transportMode: string;
  serviceType: string;
  maxCapacityKg: number;
  maxVolumeM3: number | null;
  supportsCrossBorder: boolean;
  supportsRefrigerated: boolean;
  temperatureMinC: number | null;
  temperatureMaxC: number | null;
  supportsHazardous: boolean;
  supportsFragile: boolean;
  supportsOversized: boolean;
  active: boolean;
  cargoCategoryIds: string[];
};

export type CarrierForMatching = {
  id: string;
  code: string;
  displayName: string;
  providerUrl: string | null;
  active: boolean;
  supportsWebMcp: boolean;
  services: CarrierServiceForMatching[];
};

function matchesFreightRequest(
  service: CarrierServiceForMatching,
  freightRequest: FreightRequestForMatching,
): boolean {
  if (!service.active) return false;
  if (service.originCountry !== freightRequest.originCountry) return false;
  if (service.destinationCountry !== freightRequest.destinationCountry) return false;
  if (service.transportMode !== freightRequest.transportMode) return false;
  if (service.serviceType !== freightRequest.serviceType) return false;
  if (service.originRegion !== null && service.originRegion !== freightRequest.originRegion) return false;
  if (service.destinationRegion !== null && service.destinationRegion !== freightRequest.destinationRegion) return false;
  if (freightRequest.crossBorder && !service.supportsCrossBorder) return false;
  if (service.maxCapacityKg < freightRequest.cargoWeightKg) return false;

  if (
    freightRequest.cargoVolumeM3 !== null &&
    (service.maxVolumeM3 === null || service.maxVolumeM3 < freightRequest.cargoVolumeM3)
  ) {
    return false;
  }

  if (freightRequest.requiresRefrigeration) {
    if (!service.supportsRefrigerated) return false;
    if (
      freightRequest.temperatureMinC !== null &&
      (service.temperatureMinC === null || service.temperatureMinC > freightRequest.temperatureMinC)
    ) {
      return false;
    }
    if (
      freightRequest.temperatureMaxC !== null &&
      (service.temperatureMaxC === null || service.temperatureMaxC < freightRequest.temperatureMaxC)
    ) {
      return false;
    }
  }

  if (freightRequest.isHazardous && !service.supportsHazardous) return false;
  if (freightRequest.isFragile && !service.supportsFragile) return false;
  if (freightRequest.isOversized && !service.supportsOversized) return false;

  return service.cargoCategoryIds.includes(freightRequest.cargoCategoryId);
}

/** Accepts only absolute, browser-navigable HTTP(S) provider endpoints. */
export function isNavigableProviderUrl(providerUrl: string | null): providerUrl is string {
  if (!providerUrl || !providerUrl.trim()) return false;

  try {
    const url = new URL(providerUrl);
    return (url.protocol === "http:" || url.protocol === "https:") && Boolean(url.hostname);
  } catch {
    return false;
  }
}

/** Returns one compatible service per carrier, without commercial quote data. */
export function selectCandidateProviders(
  freightRequest: FreightRequestForMatching,
  carriers: CarrierForMatching[],
): CandidateProvider[] {
  return carriers.flatMap((carrier) => {
    if (!carrier.active || !carrier.supportsWebMcp || !isNavigableProviderUrl(carrier.providerUrl)) {
      return [];
    }

    const matchingService = carrier.services.find((service) =>
      matchesFreightRequest(service, freightRequest),
    );

    if (!matchingService) return [];

    return [{
      carrierId: carrier.id,
      carrierCode: carrier.code,
      displayName: carrier.displayName,
      providerUrl: carrier.providerUrl,
      matchingServiceId: matchingService.id,
    }];
  });
}

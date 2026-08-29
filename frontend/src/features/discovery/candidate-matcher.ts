import type { CandidateProvider } from "@/features/providers/contracts";

export type FreightRequestForMatching = {
  cargoCategoryId: string;
  originCountry: string;
  destinationCountry: string;
  cargoWeightKg: number;
  cargoVolumeM3: number | null;
  crossBorder: boolean;
};

export type CarrierServiceForMatching = {
  id: string;
  originCountry: string;
  destinationCountry: string;
  maxCapacityKg: number;
  maxVolumeM3: number | null;
  supportsCrossBorder: boolean;
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
  if (freightRequest.crossBorder && !service.supportsCrossBorder) return false;
  if (service.maxCapacityKg < freightRequest.cargoWeightKg) return false;

  if (
    freightRequest.cargoVolumeM3 !== null &&
    (service.maxVolumeM3 === null || service.maxVolumeM3 < freightRequest.cargoVolumeM3)
  ) {
    return false;
  }

  return service.cargoCategoryIds.includes(freightRequest.cargoCategoryId);
}

/** Returns one compatible service per carrier, without commercial quote data. */
export function selectCandidateProviders(
  freightRequest: FreightRequestForMatching,
  carriers: CarrierForMatching[],
): CandidateProvider[] {
  return carriers.flatMap((carrier) => {
    if (!carrier.active || !carrier.supportsWebMcp || !carrier.providerUrl) return [];

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

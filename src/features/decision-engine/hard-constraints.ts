import { Carrier, CarrierService, FreightRequest } from "../freight/types";

export interface ConstraintValidationResult {
  eligible: boolean;
  carrier_id: string;
  carrier_name: string;
  violations: string[];
}

export function validateHardConstraints(
  request: FreightRequest,
  carrier: Carrier,
  services: CarrierService[]
): ConstraintValidationResult {
  const violations: string[] = [];

  // 1. Carrier status check
  if (carrier.status !== "ACTIVE") {
    violations.push("Carrier is currently inactive or suspended.");
  }

  // 2. Find matching service for route and mode
  const matchingService = services.find(
    (s) =>
      s.carrier_id === carrier.id &&
      s.active &&
      s.transport_mode === request.transport_mode &&
      s.origin_country.toLowerCase() === request.origin_country.toLowerCase() &&
      s.origin_region.toLowerCase() === request.origin_city.toLowerCase() &&
      s.destination_country.toLowerCase() === request.destination_country.toLowerCase() &&
      s.destination_region.toLowerCase() === request.destination_city.toLowerCase()
  );

  if (!matchingService) {
    violations.push(
      `No direct service coverage for corridor ${request.origin_city}, ${request.origin_country} -> ${request.destination_city}, ${request.destination_country} (${request.transport_mode}).`
    );
    return {
      eligible: false,
      carrier_id: carrier.id,
      carrier_name: carrier.name,
      violations,
    };
  }

  // 3. Weight capacity check
  if (request.cargo_weight_kg > matchingService.max_capacity_kg) {
    violations.push(
      `Cargo weight (${request.cargo_weight_kg.toLocaleString()} kg) exceeds carrier max service capacity (${matchingService.max_capacity_kg.toLocaleString()} kg).`
    );
  }

  // 4. Volume capacity check
  if (request.cargo_volume_m3 && request.cargo_volume_m3 > matchingService.max_volume_m3) {
    violations.push(
      `Cargo volume (${request.cargo_volume_m3} m³) exceeds service max volume (${matchingService.max_volume_m3} m³).`
    );
  }

  // 5. Refrigeration requirement
  if (request.requires_refrigeration && !matchingService.supports_refrigerated) {
    violations.push("Cargo requires temperature-controlled refrigeration which is not supported by carrier service.");
  }

  // 6. Hazardous goods check
  if (request.is_hazardous && !matchingService.supports_hazardous) {
    violations.push("Cargo contains hazardous materials (HAZMAT) not certified for this carrier corridor.");
  }

  // 7. Fragile goods handling check
  if (request.is_fragile && !matchingService.supports_fragile) {
    violations.push("Cargo requires specialized fragile cargo shock absorption handling.");
  }

  // 8. Oversized goods check
  if (request.is_oversized && !matchingService.supports_oversized) {
    violations.push("Cargo dimensions exceed standard envelope and carrier lacks oversized clearance permit.");
  }

  return {
    eligible: violations.length === 0,
    carrier_id: carrier.id,
    carrier_name: carrier.name,
    violations,
  };
}

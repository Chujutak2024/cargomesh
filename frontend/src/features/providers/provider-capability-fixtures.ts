import type { AvailabilityClass } from "./contracts";

export type ProviderCapabilityFixture = {
  originAliases: string[];
  destinationAliases: string[];
  cargoCategories: string[];
  supportedRequirements: string[];
  reportedVehicleType: string;
  earliestPickup: string;
  transitHours: number;
  availabilityClass: Exclude<AvailabilityClass, "UNAVAILABLE">;
};

// Golden Flow provider fixtures. The lookup key is the registered service code,
// never a carrier name, slug, or fixed provider position. Unknown registered
// services receive a conservative response instead of fabricated capabilities.
const providerCapabilityFixtures: Record<string, ProviderCapabilityFixture> = {
  "ANDES-PECL-FTL": {
    originAliases: ["callao", "lima", "peru", "pe"],
    destinationAliases: ["santiago", "chile", "cl"],
    cargoCategories: ["machinery", "mining spare parts", "maquinaria", "repuestos mineros"],
    supportedRequirements: ["customs coordination", "coordinacion aduanera"],
    reportedVehicleType: "Scania R450",
    earliestPickup: "2026-08-30T13:00:00.000Z",
    transitHours: 31,
    availabilityClass: "AVAILABLE_IN_WINDOW",
  },
  "INCA-PECL-FTL": {
    originAliases: ["callao", "lima", "peru", "pe"],
    destinationAliases: ["santiago", "chile", "cl"],
    cargoCategories: ["machinery", "mining spare parts", "maquinaria", "repuestos mineros"],
    supportedRequirements: ["customs coordination", "coordinacion aduanera"],
    reportedVehicleType: "Volvo FH",
    earliestPickup: "2026-08-30T14:00:00.000Z",
    transitHours: 29,
    availabilityClass: "AVAILABLE_IN_WINDOW",
  },
  "PACIFIC-PECL-FTL": {
    originAliases: ["callao", "lima", "peru", "pe"],
    destinationAliases: ["santiago", "chile", "cl"],
    cargoCategories: ["machinery", "mining spare parts", "maquinaria", "repuestos mineros"],
    supportedRequirements: ["customs coordination", "coordinacion aduanera"],
    reportedVehicleType: "Freightliner",
    earliestPickup: "2026-08-30T19:00:00.000Z",
    transitHours: 60,
    availabilityClass: "LIMITED_WINDOW",
  },
};

export function normalizeCapabilityValue(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

export function matchesCapabilityAlias(value: string, aliases: string[]): boolean {
  const normalizedValue = normalizeCapabilityValue(value);
  const valueTokens = normalizedValue.split(/[^a-z0-9]+/).filter(Boolean);

  return aliases.some((alias) => {
    const normalizedAlias = normalizeCapabilityValue(alias);

    return normalizedAlias.length <= 2
      ? valueTokens.includes(normalizedAlias)
      : normalizedValue.includes(normalizedAlias);
  });
}

export function getProviderCapabilityFixture(
  providerServiceCode: string,
): ProviderCapabilityFixture | null {
  return providerCapabilityFixtures[providerServiceCode] ?? null;
}

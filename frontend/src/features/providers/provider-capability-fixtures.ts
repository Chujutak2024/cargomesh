import type { AvailabilityClass } from "./contracts";

export type ProviderCapabilityFixture = {
  origin: ProviderFixtureLocation;
  destination: ProviderFixtureLocation;
  cargoCategories: string[];
  supportedRequirements: string[];
  reportedVehicleType: string;
  earliestPickup: string;
  transitHours: number;
  availabilityClass: Exclude<AvailabilityClass, "UNAVAILABLE">;
  requiresCrossBorder: boolean;
};

type ProviderFixtureLocation = {
  regionAliases: string[];
  countryAliases: string[];
};

// Golden Flow provider fixtures. The lookup key is the registered service code,
// never a carrier name, slug, or fixed provider position. Unknown registered
// services receive a conservative response instead of fabricated capabilities.
const providerCapabilityFixtures: Record<string, ProviderCapabilityFixture> = {
  "ANDES-PECL-FTL": {
    origin: {
      regionAliases: ["callao", "lima"],
      countryAliases: ["peru", "pe"],
    },
    destination: {
      regionAliases: ["santiago"],
      countryAliases: ["chile", "cl"],
    },
    cargoCategories: ["machinery", "mining spare parts", "maquinaria", "repuestos mineros"],
    supportedRequirements: ["customs coordination", "coordinacion aduanera"],
    reportedVehicleType: "Scania R450",
    earliestPickup: "2026-08-30T13:00:00.000Z",
    transitHours: 31,
    availabilityClass: "AVAILABLE_IN_WINDOW",
    requiresCrossBorder: true,
  },
  "INCA-PECL-FTL": {
    origin: {
      regionAliases: ["callao", "lima"],
      countryAliases: ["peru", "pe"],
    },
    destination: {
      regionAliases: ["santiago"],
      countryAliases: ["chile", "cl"],
    },
    cargoCategories: ["machinery", "mining spare parts", "maquinaria", "repuestos mineros"],
    supportedRequirements: ["customs coordination", "coordinacion aduanera"],
    reportedVehicleType: "Volvo FH",
    earliestPickup: "2026-08-30T14:00:00.000Z",
    transitHours: 29,
    availabilityClass: "AVAILABLE_IN_WINDOW",
    requiresCrossBorder: true,
  },
  "PACIFIC-PECL-FTL": {
    origin: {
      regionAliases: ["callao", "lima"],
      countryAliases: ["peru", "pe"],
    },
    destination: {
      regionAliases: ["santiago"],
      countryAliases: ["chile", "cl"],
    },
    cargoCategories: ["machinery", "mining spare parts", "maquinaria", "repuestos mineros"],
    supportedRequirements: ["customs coordination", "coordinacion aduanera"],
    reportedVehicleType: "Freightliner",
    earliestPickup: "2026-08-30T19:00:00.000Z",
    transitHours: 60,
    availabilityClass: "LIMITED_WINDOW",
    requiresCrossBorder: true,
  },
  "NEXO-DEMO-PE-DOM-FTL": {
    origin: {
      regionAliases: ["lima"],
      countryAliases: ["peru", "pe"],
    },
    destination: {
      regionAliases: ["arequipa"],
      countryAliases: ["peru", "pe"],
    },
    cargoCategories: ["general", "general cargo", "carga general"],
    supportedRequirements: ["fragile handling", "manejo fragil"],
    reportedVehicleType: "Rigid truck 12T (synthetic fixture)",
    earliestPickup: "2026-09-10T13:00:00.000Z",
    transitHours: 24,
    availabilityClass: "EXACT_CONFIRMED_SLOT",
    requiresCrossBorder: false,
  },
  "NEXO-DEMO-PECL-AGR-FTL": {
    origin: {
      regionAliases: ["callao"],
      countryAliases: ["peru", "pe"],
    },
    destination: {
      regionAliases: ["santiago"],
      countryAliases: ["chile", "cl"],
    },
    cargoCategories: ["agricultural", "agricultural products", "agricola"],
    supportedRequirements: [
      "customs coordination",
      "coordinacion aduanera",
      "commercial invoice",
      "packing list",
      "certificate of origin",
    ],
    reportedVehicleType: "Tractor trailer 16T (synthetic fixture)",
    earliestPickup: "2026-09-10T13:00:00.000Z",
    transitHours: 48,
    availabilityClass: "AVAILABLE_IN_WINDOW",
    requiresCrossBorder: true,
  },
  "POLARIS-PECL-REEFER-FTL": {
    origin: {
      regionAliases: ["ica"],
      countryAliases: ["peru", "pe"],
    },
    destination: {
      regionAliases: ["santiago"],
      countryAliases: ["chile", "cl"],
    },
    cargoCategories: ["agricultural", "fresh produce", "grapes", "uva", "agricola"],
    supportedRequirements: [
      "temperature controlled",
      "refrigerated",
      "cold chain",
      "customs coordination",
      "coordinacion aduanera",
    ],
    reportedVehicleType: "Volvo FM 460 Cryo-Reefer (synthetic fixture)",
    earliestPickup: "2026-09-10T13:00:00.000Z",
    transitHours: 30,
    availabilityClass: "AVAILABLE_IN_WINDOW",
    requiresCrossBorder: true,
  },
  "APEX-PECL-HAZMAT-FTL": {
    origin: {
      regionAliases: ["callao", "lima"],
      countryAliases: ["peru", "pe"],
    },
    destination: {
      regionAliases: ["santiago"],
      countryAliases: ["chile", "cl"],
    },
    cargoCategories: ["machinery", "construction", "hazmat", "hazardous", "chemical"],
    supportedRequirements: [
      "hazardous",
      "hazmat",
      "dangerous goods",
      "customs coordination",
      "coordinacion aduanera",
    ],
    reportedVehicleType: "Kenworth T680 Hazmat (synthetic fixture)",
    earliestPickup: "2026-09-10T14:00:00.000Z",
    transitHours: 36,
    availabilityClass: "AVAILABLE_IN_WINDOW",
    requiresCrossBorder: true,
  },
  "VELOCITY-PE-EXPRESS-FTL": {
    origin: {
      regionAliases: ["lima"],
      countryAliases: ["peru", "pe"],
    },
    destination: {
      regionAliases: ["arequipa"],
      countryAliases: ["peru", "pe"],
    },
    cargoCategories: ["general", "construction", "general cargo", "carga general"],
    supportedRequirements: ["fragile handling", "manejo fragil"],
    reportedVehicleType: "Freightliner Cascadia 116 Express (synthetic fixture)",
    earliestPickup: "2026-09-10T13:00:00.000Z",
    transitHours: 24,
    availabilityClass: "EXACT_CONFIRMED_SLOT",
    requiresCrossBorder: false,
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

export function matchesCapabilityLocation(
  value: string,
  location: ProviderFixtureLocation,
): boolean {
  return (
    matchesCapabilityAlias(value, location.regionAliases) &&
    matchesCapabilityAlias(value, location.countryAliases)
  );
}

export function getProviderCapabilityFixture(
  providerServiceCode: string,
): ProviderCapabilityFixture | null {
  return providerCapabilityFixtures[providerServiceCode] ?? null;
}

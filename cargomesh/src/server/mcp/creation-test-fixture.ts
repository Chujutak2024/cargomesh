import type { CreateFreightRequestInput } from "@/shared/schemas/freight-creation";

export function creationInput(): CreateFreightRequestInput {
  return {
    idempotencyKey: "94000000-0000-4000-8000-000000000001",
    fields: {
      cargoCategoryCode: "MACHINERY", originCountry: "PE", originRegion: "Callao", originCity: "Callao",
      destinationCountry: "CL", destinationRegion: "Región Metropolitana", destinationCity: "Santiago",
      cargoEntryMethod: "PALLETS", entryQuantity: 2, entryUnitWeightKg: 800, unitsPerEntry: 1,
      entryLengthCm: 120, entryWidthCm: 100, entryHeightCm: 150,
      pickupMode: "SCHEDULED", pickupWindowStart: "2026-09-19T12:00:00Z", pickupWindowEnd: "2026-09-20T12:00:00Z",
      deliveryDeadline: "2026-09-23T12:00:00Z", budgetMax: null, availableDocuments: [],
    },
  };
}

import type { IntakeOptionsResponse } from "../contracts";

/**
 * Explicit development-only fixture for the HAC-27 intake-options contract.
 *
 * Production/API mode never falls back to this object. It can only be selected
 * with NEXT_PUBLIC_V2_INTAKE_OPTIONS_SOURCE=fixture while NODE_ENV is not
 * production. Persistence and serviceability still require the real API.
 * The eight cargo guidance objects mirror the HAC-12/HAC-29 reference catalog.
 */
export const INTAKE_OPTIONS_FIXTURE: IntakeOptionsResponse = {
  schemaVersion: "2.0",
  data: {
    facilities: [
      {
        id: "c2330000-0000-4000-8000-000000000001",
        code: "QA-A-LIMA",
        label: "[SYNTHETIC] Lima pickup site",
        countryCode: "PE",
        region: "Lima",
        city: "Lima",
        lat: -12.0464,
        lng: -77.0428,
      },
      {
        id: "c2330000-0000-4000-8000-000000000002",
        code: "QA-A-AREQUIPA",
        label: "[SYNTHETIC] Arequipa distribution site",
        countryCode: "PE",
        region: "Arequipa",
        city: "Arequipa",
        lat: -16.409,
        lng: -71.5375,
      },
      {
        id: "c2330000-0000-4000-8000-000000000003",
        code: "QA-A-PIURA",
        label: "[SYNTHETIC] Piura site without declared coverage",
        countryCode: "PE",
        region: "Piura",
        city: "Piura",
        lat: -5.1945,
        lng: -80.6328,
      },
    ],
    cargoCategories: [
      {
        id: "c0000000-0000-0000-0000-000000000001",
        code: "GENERAL",
        name: "General Cargo",
        guidance: {
          recommendedEntryMethods: ["UNITS", "PACKAGES", "PALLETS", "TOTAL_WEIGHT"],
          intakeSpecificationSchema: { fields: ["dimensions", "is_fragile", "is_stackable", "declared_value"] },
          suggestedRequirements: { ask_fragility: true, ask_stackability: true },
          recommendedVehicleClasses: ["BOX_TRUCK", "TRACTOR_TRAILER"],
        },
      },
      {
        id: "c0000000-0000-0000-0000-000000000002",
        code: "FOOD",
        name: "Food & Perishables",
        guidance: {
          recommendedEntryMethods: ["PACKAGES", "PALLETS", "SACKS", "LOTS"],
          intakeSpecificationSchema: { fields: ["product_type", "temperature_min_c", "temperature_max_c", "expiration_date", "lot_number"] },
          suggestedRequirements: { ask_refrigeration: true, ask_expiration: true, ask_food_grade: true },
          recommendedVehicleClasses: ["REFRIGERATED_TRUCK", "BOX_TRUCK", "TRACTOR_TRAILER"],
        },
      },
      {
        id: "c0000000-0000-0000-0000-000000000003",
        code: "PHARMA",
        name: "Pharmaceuticals",
        guidance: {
          recommendedEntryMethods: ["PACKAGES", "PALLETS", "LOTS"],
          intakeSpecificationSchema: { fields: ["temperature_min_c", "temperature_max_c", "lot_number", "expiration_date", "handling_protocol"] },
          suggestedRequirements: { requires_temperature_validation: true, suggest_fragile: true, suggest_high_value: true },
          recommendedVehicleClasses: ["REFRIGERATED_TRUCK", "SECURE_BOX_TRUCK"],
        },
      },
      {
        id: "c0000000-0000-0000-0000-000000000004",
        code: "CHEMICAL",
        name: "Chemicals & Hazmat",
        guidance: {
          recommendedEntryMethods: ["PACKAGES", "LOTS", "TOTAL_WEIGHT"],
          intakeSpecificationSchema: { fields: ["un_number", "hazard_class", "safety_data_sheet", "container_type"] },
          suggestedRequirements: { requires_hazardous_classification: true, requires_safety_data_sheet: true },
          recommendedVehicleClasses: ["HAZMAT_TRUCK", "TRACTOR_TRAILER"],
        },
      },
      {
        id: "c0000000-0000-0000-0000-000000000005",
        code: "MACHINERY",
        name: "Machinery & Heavy Industrial",
        guidance: {
          recommendedEntryMethods: ["UNITS", "PALLETS", "LOTS"],
          intakeSpecificationSchema: { fields: ["dimensions", "declared_value", "center_of_gravity_notes", "lifting_requirements"] },
          suggestedRequirements: { ask_oversized: true, suggest_high_value: true, ask_stackability: true },
          recommendedVehicleClasses: ["TRACTOR_TRAILER", "FLATBED"],
        },
      },
      {
        id: "c0000000-0000-0000-0000-000000000006",
        code: "CONSTRUCTION",
        name: "Construction Materials",
        guidance: {
          recommendedEntryMethods: ["LOTS", "PALLETS", "SACKS", "TOTAL_WEIGHT"],
          intakeSpecificationSchema: { fields: ["material_type", "dimensions", "unloading_method", "weather_protection"] },
          suggestedRequirements: { ask_oversized: true, ask_unloading_method: true },
          recommendedVehicleClasses: ["FLATBED", "DUMP_TRUCK", "TRACTOR_TRAILER"],
        },
      },
      {
        id: "c0000000-0000-0000-0000-000000000007",
        code: "AGRICULTURAL",
        name: "Agricultural Products",
        guidance: {
          recommendedEntryMethods: ["SACKS", "LOTS", "PALLETS", "TOTAL_WEIGHT"],
          intakeSpecificationSchema: { fields: ["product_type", "moisture_limit_pct", "temperature_range", "harvest_or_lot_reference"] },
          suggestedRequirements: { ask_refrigeration: true, ask_moisture_limit: true },
          recommendedVehicleClasses: ["BOX_TRUCK", "REFRIGERATED_TRUCK", "TRACTOR_TRAILER"],
        },
      },
      {
        id: "c0000000-0000-0000-0000-000000000008",
        code: "LIQUID",
        name: "Liquids & Bulk",
        guidance: {
          recommendedEntryMethods: ["TOTAL_WEIGHT", "LOTS"],
          intakeSpecificationSchema: { fields: ["liters", "density_kg_l", "food_grade", "un_number", "tank_requirements"] },
          suggestedRequirements: { ask_hazardous: true, ask_food_grade: true, requires_tank_compatibility: true },
          recommendedVehicleClasses: ["TANKER_TRUCK"],
        },
      },
    ],
    equipmentOptions: [
      { code: "REEFER_TRUCK", label: "Camión refrigerado", mode: "ROAD" },
    ],
    packagingOptions: [
      { code: "PALLET", labelEs: "Pallet", labelEn: "Pallet", verification: "CAPTURE_ONLY" },
      { code: "BOX", labelEs: "Caja", labelEn: "Box", verification: "CAPTURE_ONLY" },
      { code: "CRATE", labelEs: "Cajón", labelEn: "Crate", verification: "CAPTURE_ONLY" },
      { code: "DRUM", labelEs: "Tambor", labelEn: "Drum", verification: "CAPTURE_ONLY" },
      { code: "BULK", labelEs: "Granel", labelEn: "Bulk", verification: "CAPTURE_ONLY" },
    ],
    requirementOptions: [
      { code: "TEMP_CONTROLLED", labelEs: "Temperatura controlada", labelEn: "Temperature controlled", verification: "RESOURCE_EVIDENCE" },
      { code: "SECURITY_SEAL", labelEs: "Sello de seguridad", labelEn: "Security seal", verification: "RESOURCE_EVIDENCE" },
      { code: "FRAGILE", labelEs: "Carga frágil", labelEn: "Fragile cargo", verification: "REQUIRES_REVIEW" },
      { code: "HAZARDOUS", labelEs: "Material peligroso", labelEn: "Hazardous material", verification: "REQUIRES_REVIEW" },
    ],
  },
  meta: {
    source: "HAC-27_EXPLICIT_DEVELOPMENT_FIXTURE",
    provenanceStatus: "SIMULATED",
  },
};

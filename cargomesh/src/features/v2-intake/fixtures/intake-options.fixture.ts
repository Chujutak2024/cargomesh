import type { IntakeOptionsResponse } from "../contracts";

/**
 * Temporary HAC-27 contract fixture.
 *
 * It is deliberately labelled SIMULATED and is only used while the team-owned
 * GET /api/v2/intake/options route is not present in the shared branch. It does
 * not grant serviceability, availability, price, persistence, or tenant access.
 */
export const INTAKE_OPTIONS_FIXTURE: IntakeOptionsResponse = {
  schemaVersion: "2.0",
  data: {
    facilities: [
      {
        facilityId: "c2330000-0000-4000-8000-000000000001",
        code: "QA-A-LIMA",
        label: "[SYNTHETIC] Lima pickup site",
        countryCode: "PE",
        region: "Lima",
        city: "Lima",
        lat: -12.0464,
        lng: -77.0428,
      },
      {
        facilityId: "c2330000-0000-4000-8000-000000000002",
        code: "QA-A-AREQUIPA",
        label: "[SYNTHETIC] Arequipa distribution site",
        countryCode: "PE",
        region: "Arequipa",
        city: "Arequipa",
        lat: -16.409,
        lng: -71.5375,
      },
      {
        facilityId: "c2330000-0000-4000-8000-000000000003",
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
      { value: "GENERAL", labelEs: "Carga general", labelEn: "General cargo" },
      { value: "FOOD", labelEs: "Alimentos y perecibles", labelEn: "Food & perishables" },
      { value: "PHARMA", labelEs: "Farmacéutica", labelEn: "Pharmaceuticals" },
      { value: "CHEMICAL", labelEs: "Químicos y peligrosos", labelEn: "Chemicals & hazmat" },
      { value: "MACHINERY", labelEs: "Maquinaria e industria", labelEn: "Machinery & industrial" },
      { value: "CONSTRUCTION", labelEs: "Materiales de construcción", labelEn: "Construction materials" },
      { value: "AGRICULTURAL", labelEs: "Productos agrícolas", labelEn: "Agricultural products" },
      { value: "LIQUID", labelEs: "Líquidos y granel", labelEn: "Liquids & bulk" },
    ],
    packagingTypes: [
      { value: "PALLET", labelEs: "Pallet", labelEn: "Pallet" },
      { value: "BOX", labelEs: "Caja", labelEn: "Box" },
      { value: "CRATE", labelEs: "Cajón", labelEn: "Crate" },
      { value: "DRUM", labelEs: "Tambor", labelEn: "Drum" },
      { value: "BULK", labelEs: "Granel", labelEn: "Bulk" },
    ],
    equipmentTypes: [
      { value: "DRY_VAN", labelEs: "Furgón seco", labelEn: "Dry van" },
      { value: "REEFER_TRUCK", labelEs: "Camión refrigerado", labelEn: "Reefer truck" },
      { value: "FLATBED", labelEs: "Plataforma", labelEn: "Flatbed" },
      { value: "LOWBOY", labelEs: "Cama baja", labelEn: "Lowboy" },
    ],
    requirementTypes: [
      { value: "TEMP_CONTROLLED", labelEs: "Temperatura controlada", labelEn: "Temperature controlled" },
      { value: "SECURITY_SEAL", labelEs: "Sello de seguridad", labelEn: "Security seal" },
      { value: "FRAGILE", labelEs: "Carga frágil", labelEn: "Fragile cargo" },
      { value: "HAZARDOUS", labelEs: "Material peligroso", labelEn: "Hazardous material" },
    ],
  },
  meta: {
    source: "HAC-27_LOCAL_CONTRACT_FIXTURE",
    provenanceStatus: "SIMULATED",
  },
};

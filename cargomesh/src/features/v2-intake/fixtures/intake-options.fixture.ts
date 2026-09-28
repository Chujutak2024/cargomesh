import type { IntakeOptionsResponse } from "../contracts";

/**
 * Explicit development-only fixture for the HAC-27 intake-options contract.
 *
 * Production/API mode never falls back to this object. It can only be selected
 * with NEXT_PUBLIC_V2_INTAKE_OPTIONS_SOURCE=fixture while NODE_ENV is not
 * production. Persistence and serviceability still require the real API.
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
      { id: "cargo-general", code: "GENERAL", name: "Carga general", guidance: "Carga no especializada; las reglas del recurso siguen siendo autoritativas." },
      { id: "cargo-food", code: "FOOD", name: "Alimentos y perecibles", guidance: "Confirmar temperatura y ventana cuando corresponda." },
      { id: "cargo-pharma", code: "PHARMA", name: "Farmacéutica", guidance: "La cadena de frío requiere evidencia del mismo recurso portador." },
      { id: "cargo-chemical", code: "CHEMICAL", name: "Químicos y peligrosos", guidance: "Requiere revisión documental y operativa." },
      { id: "cargo-machinery", code: "MACHINERY", name: "Maquinaria e industria", guidance: "Validar dimensiones, indivisibilidad y equipo requerido." },
      { id: "cargo-construction", code: "CONSTRUCTION", name: "Materiales de construcción", guidance: "Validar peso, volumen y método de manipulación." },
      { id: "cargo-agricultural", code: "AGRICULTURAL", name: "Productos agrícolas", guidance: "Confirmar condiciones y ventanas de conservación." },
      { id: "cargo-liquid", code: "LIQUID", name: "Líquidos y granel", guidance: "Validar contención y requisitos aplicables." },
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

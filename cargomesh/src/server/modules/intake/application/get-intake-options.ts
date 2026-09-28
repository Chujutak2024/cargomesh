import {
  CargoCategoryCodeV2Schema,
  IntakeOptionsV2ResponseSchema,
  ResourceEvidenceRequirementCodesV2,
  type IntakeOptionsV2Response,
} from "@/shared/schemas/v2/intake-options";

/** No client-supplied organizationId is accepted at this boundary. */
export type IntakeActor = { memberId: string; organizationId: string };

export type FacilityRecord = {
  id: string;
  organization_id: string;
  code: string;
  name: string;
  country_code: string;
  region_code: string | null;
  city: string;
  latitude: number | null;
  longitude: number | null;
  active: boolean;
};

export type CargoCategoryRecord = {
  id: string;
  code: string;
  name: string;
  active: boolean;
  recommended_entry_methods: unknown;
  intake_specification_schema: unknown;
  suggested_requirements: unknown;
  recommended_vehicle_classes: unknown;
};

export type RoadEquipmentOption = { code: string; label: string; mode: "ROAD" };

export interface IntakeOptionsRepository {
  /** Must apply organization_id and active filters in the database as well. */
  listActiveFacilities(organizationId: string): Promise<FacilityRecord[]>;
  listActiveCargoCategories(): Promise<CargoCategoryRecord[]>;
  /** Supported vocabulary, not asset availability for a date. */
  listSupportedRoadEquipment(): Promise<RoadEquipmentOption[]>;
}

const CATEGORY_CODES = CargoCategoryCodeV2Schema.options;
const RESOURCE_EVIDENCE_CODES = new Set<string>(ResourceEvidenceRequirementCodesV2);

/** Versioned capture choices. They do not assert carrier support or availability. */
const PACKAGING_OPTIONS = [
  { code: "PALLET", labelEs: "Pallet", labelEn: "Pallet" },
  { code: "BOX", labelEs: "Caja", labelEn: "Box" },
  { code: "CRATE", labelEs: "Cajón", labelEn: "Crate" },
  { code: "DRUM", labelEs: "Tambor", labelEn: "Drum" },
  { code: "BULK", labelEs: "Granel", labelEn: "Bulk" },
] as const;

const REQUIREMENT_OPTIONS = [
  { code: "TEMP_CONTROLLED", labelEs: "Temperatura controlada", labelEn: "Temperature controlled" },
  { code: "SECURITY_SEAL", labelEs: "Sello de seguridad", labelEn: "Security seal" },
  { code: "FRAGILE", labelEs: "Carga frágil", labelEn: "Fragile cargo" },
  { code: "HAZARDOUS", labelEs: "Material peligroso", labelEn: "Hazardous material" },
] as const;

export async function getIntakeOptions(
  actor: IntakeActor,
  repository: IntakeOptionsRepository,
): Promise<IntakeOptionsV2Response> {
  if (!actor.memberId || !actor.organizationId) throw new Error("FORBIDDEN_TENANT");
  const [facilities, categories, equipmentOptions] = await Promise.all([
    repository.listActiveFacilities(actor.organizationId),
    repository.listActiveCargoCategories(),
    repository.listSupportedRoadEquipment(),
  ]);
  if (facilities.some((facility) => facility.organization_id !== actor.organizationId)) {
    throw new Error("FORBIDDEN_TENANT");
  }
  const activeCategories = categories.filter((category) => category.active);
  const codes = activeCategories.map((category) => category.code);
  if (codes.length !== CATEGORY_CODES.length
    || new Set(codes).size !== CATEGORY_CODES.length
    || CATEGORY_CODES.some((code) => !codes.includes(code))) {
    throw new Error("CATALOG_NOT_READY");
  }
  const response = {
    schemaVersion: "2.0" as const,
    data: {
      facilities: facilities.filter((facility) => facility.active).map((facility) => ({
        id: facility.id,
        code: facility.code,
        label: facility.name,
        countryCode: facility.country_code,
        region: facility.region_code,
        city: facility.city,
        lat: facility.latitude,
        lng: facility.longitude,
      })).sort((a, b) => a.code.localeCompare(b.code)),
      cargoCategories: activeCategories.map((category) => ({
        id: category.id,
        code: CargoCategoryCodeV2Schema.parse(category.code),
        name: category.name,
        guidance: {
          recommendedEntryMethods: category.recommended_entry_methods,
          intakeSpecificationSchema: category.intake_specification_schema,
          suggestedRequirements: category.suggested_requirements,
          recommendedVehicleClasses: category.recommended_vehicle_classes,
        },
      })).sort((a, b) => CATEGORY_CODES.indexOf(a.code) - CATEGORY_CODES.indexOf(b.code)),
      equipmentOptions: equipmentOptions.sort((a, b) => a.code.localeCompare(b.code)),
      packagingOptions: PACKAGING_OPTIONS.map((option) => ({
        ...option, verification: "CAPTURE_ONLY" as const,
      })),
      requirementOptions: REQUIREMENT_OPTIONS.map((option) => ({
        ...option,
        verification: RESOURCE_EVIDENCE_CODES.has(option.code)
          ? "RESOURCE_EVIDENCE" as const : "REQUIRES_REVIEW" as const,
      })),
    },
  };
  const parsed = IntakeOptionsV2ResponseSchema.safeParse(response);
  if (!parsed.success) throw new Error("CATALOG_NOT_READY");
  return parsed.data;
}

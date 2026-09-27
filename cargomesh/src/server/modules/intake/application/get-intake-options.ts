import {
  CargoCategoryCodeV2Schema,
  IntakeOptionsV2ResponseSchema,
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
    },
  };
  const parsed = IntakeOptionsV2ResponseSchema.safeParse(response);
  if (!parsed.success) throw new Error("CATALOG_NOT_READY");
  return parsed.data;
}

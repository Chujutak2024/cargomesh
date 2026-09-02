import type { AuthenticatedMemberContext } from "@/lib/supabase/auth";

import {
  FREIGHT_REQUEST_INTAKE_SCHEMA_VERSION,
  parseFreightRequestIntakeViewModel,
  type FreightRequestIntakeViewModel,
} from "./intake-contracts";

const REQUEST_CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

export type PersistedIntakeRecord = {
  id: string;
  code: string;
  draftVersion: number;
  organizationId: string;
  organizationName: string;
  defaultCurrency: string;
  requesterMemberId: string;
  requesterDisplayName: string;
  status: string;
  cargoProfileName: string | null;
  cargoCategoryName: string;
  cargoCategoryCode: string;
  entryMethod: string;
  quantity: number | null;
  unitsPerEntry: number | null;
  totalWeightKg: number;
  totalVolumeM3: number | null;
  unitWeightKg: number | null;
  lengthCm: number | null;
  widthCm: number | null;
  heightCm: number | null;
  origin: string;
  destination: string;
  originCountry: string;
  originRegion: string | null;
  originCity: string;
  originAddress: string | null;
  destinationCountry: string;
  destinationRegion: string | null;
  destinationCity: string;
  destinationAddress: string | null;
  pickupContactName: string | null;
  pickupContactPhone: string | null;
  deliveryContactName: string | null;
  deliveryContactCompany: string | null;
  deliveryContactPhone: string | null;
  operationalNotes: string | null;
  transportMode: string;
  serviceType: string;
  pickupMode: string;
  requiredPickup: string;
  pickupWindowStart: string | null;
  pickupWindowEnd: string | null;
  deliveryDeadline: string | null;
  budgetMax: number | null;
  strategy: string;
  availableDocuments: unknown;
  updatedAt: string;
};

export type FreightRequestIntakeSource = {
  findByCode: (
    organizationId: string,
    memberId: string,
    requestCode: string,
  ) => Promise<PersistedIntakeRecord | null>;
};

export type FreightRequestIntakeDependencies = {
  resolveMember: () => Promise<AuthenticatedMemberContext>;
  source: FreightRequestIntakeSource;
};

export class FreightRequestIntakeError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly httpStatus: number,
  ) {
    super(message);
    this.name = "FreightRequestIntakeError";
  }
}

function asDocuments(value: unknown): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new FreightRequestIntakeError(
      "INVALID_FREIGHT_REQUEST_INTAKE",
      "FreightRequest has invalid available documents.",
      500,
    );
  }
  return value;
}

export async function getFreightRequestIntake(
  requestCode: string,
  dependencies: FreightRequestIntakeDependencies,
): Promise<FreightRequestIntakeViewModel> {
  const normalizedCode = requestCode.trim();
  if (!REQUEST_CODE_PATTERN.test(normalizedCode)) {
    throw new FreightRequestIntakeError(
      "INVALID_ARGUMENT",
      "requestCode has an unsupported format.",
      400,
    );
  }

  const member = await dependencies.resolveMember();
  if (member.status !== "ACTIVE") {
    throw new FreightRequestIntakeError("FORBIDDEN", "Active membership is required.", 403);
  }
  const record = await dependencies.source.findByCode(
    member.organizationId,
    member.memberId,
    normalizedCode,
  );
  if (!record) {
    throw new FreightRequestIntakeError(
      "NOT_FOUND",
      "FreightRequest not found.",
      404,
    );
  }
  if (record.organizationId !== member.organizationId || record.requesterMemberId !== member.memberId) {
    throw new FreightRequestIntakeError(
      "FORBIDDEN",
      "FreightRequest is outside the active organization context.",
      403,
    );
  }
  if (record.code !== normalizedCode) {
    throw new FreightRequestIntakeError("INVALID_FREIGHT_REQUEST_INTAKE", "Request code correlation failed.", 500);
  }

  try {
    return parseFreightRequestIntakeViewModel({
      schemaVersion: FREIGHT_REQUEST_INTAKE_SCHEMA_VERSION,
      freightRequestId: record.id,
      requestCode: record.code,
      draftVersion: record.draftVersion,
      organization: { id: record.organizationId, name: record.organizationName, defaultCurrency: record.defaultCurrency },
      currentOperator: { memberId: record.requesterMemberId, displayName: record.requesterDisplayName },
      status: record.status,
      cargo: {
        profileName: record.cargoProfileName,
        categoryName: record.cargoCategoryName,
        categoryCode: record.cargoCategoryCode,
        entryMethod: record.entryMethod,
        quantity: record.quantity,
        unitsPerEntry: record.unitsPerEntry,
        unitWeightKg: record.unitWeightKg,
        lengthCm: record.lengthCm,
        widthCm: record.widthCm,
        heightCm: record.heightCm,
        totalWeightKg: record.totalWeightKg,
        totalVolumeM3: record.totalVolumeM3,
      },
      route: {
        origin: record.origin,
        destination: record.destination,
        originCountry: record.originCountry,
        originRegion: record.originRegion,
        originCity: record.originCity,
        originAddress: record.originAddress,
        destinationCountry: record.destinationCountry,
        destinationRegion: record.destinationRegion,
        destinationCity: record.destinationCity,
        destinationAddress: record.destinationAddress,
        pickupContact: { name: record.pickupContactName, phone: record.pickupContactPhone },
        deliveryContact: {
          name: record.deliveryContactName,
          company: record.deliveryContactCompany,
          phone: record.deliveryContactPhone,
        },
        operationalNotes: record.operationalNotes,
      },
      execution: {
        transportMode: record.transportMode,
        serviceType: record.serviceType,
        pickupMode: record.pickupMode,
        requiredPickup: record.requiredPickup,
        pickupWindowStart: record.pickupWindowStart,
        pickupWindowEnd: record.pickupWindowEnd,
        deliveryDeadline: record.deliveryDeadline,
        budgetMax: record.budgetMax,
        strategy: record.strategy,
        availableDocuments: asDocuments(record.availableDocuments),
      },
      updatedAt: record.updatedAt,
    });
  } catch (error) {
    if (error instanceof FreightRequestIntakeError) throw error;
    throw new FreightRequestIntakeError(
      "INVALID_FREIGHT_REQUEST_INTAKE",
      "The persisted FreightRequest intake is invalid.",
      500,
    );
  }
}

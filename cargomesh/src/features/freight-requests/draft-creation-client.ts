import {
  type FreightRequestIntakeViewModel,
} from "./intake-contracts";
import type { ManualFreightRequestIntakeFields } from "./manual-intake-contracts";
import { createFreightRequest, FreightRequestHonoClientError } from "@/server/hono/client";

export class DraftCreationClientError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "DraftCreationClientError";
  }
}

export type CreateFreightRequestDraftFields = ManualFreightRequestIntakeFields & {
  requiresRefrigeration?: boolean;
  temperatureMinC?: number | null;
  temperatureMaxC?: number | null;
  isHazardous?: boolean;
  isOversized?: boolean;
  isFragile?: boolean;
};

export type CreateFreightRequestDraftInput = {
  fields: CreateFreightRequestDraftFields;
};

export async function createFreightRequestDraft(
  input: CreateFreightRequestDraftInput,
  signal?: AbortSignal,
  request: typeof fetch = fetch,
): Promise<FreightRequestIntakeViewModel> {
  const fields = input.fields;
  const packageCount = Math.trunc(fields.entryQuantity ?? 1);
  const cargoWeightKg = fields.totalWeightKg
    ?? packageCount * (fields.unitsPerEntry ?? 1) * (fields.entryUnitWeightKg ?? 0);
  const cargoVolumeM3 = [fields.entryLengthCm, fields.entryWidthCm, fields.entryHeightCm]
    .every((value) => typeof value === "number")
    ? packageCount * (fields.unitsPerEntry ?? 1) * (fields.entryLengthCm ?? 0) * (fields.entryWidthCm ?? 0) * (fields.entryHeightCm ?? 0) / 1_000_000
    : null;

  try {
    return await createFreightRequest({
      originCity: fields.originCity ?? "",
      originCountry: fields.originCountry ?? "PE",
      destinationCity: fields.destinationCity ?? "",
      destinationCountry: fields.destinationCountry ?? "CL",
      cargoWeightKg,
      cargoVolumeM3,
      packageCount,
      isCrossBorder: (fields.originCountry ?? "PE") !== (fields.destinationCountry ?? "CL"),
      transportMode: "ROAD",
      serviceType: "FTL",
      strategy: "BALANCED",
      budgetUsd: fields.budgetMax ?? null,
      cargoDescription: fields.cargoDescription ?? null,
      requiresRefrigeration: fields.requiresRefrigeration === true,
      isHazardous: fields.isHazardous === true,
      isFragile: fields.isFragile === true,
      isOversized: fields.isOversized === true,
    }, signal, request);
  } catch (error) {
    if (error instanceof FreightRequestHonoClientError) {
      throw new DraftCreationClientError(error.code, error.message);
    }
    throw error;
  }
}

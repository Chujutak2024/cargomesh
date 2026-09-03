import assert from "node:assert/strict";
import test from "node:test";

import type { AuthenticatedMemberContext } from "@/lib/supabase/auth";
import type { FreightRequestIntakeViewModel } from "./intake-contracts";
import {
  createFreightRequestDraftWithDependencies,
  parseCreateFreightRequestDraftInput,
  type DraftCreationDependencies,
} from "./draft-creation-policy";
import { RecommendationDraftError } from "@/features/recommendations/recommendation-draft-contracts";

const SUPERVISOR_MEMBER: AuthenticatedMemberContext = {
  userId: "d0000000-0000-0000-0000-000000000001",
  userEmail: "supervisor@acme.cargomesh.test",
  memberId: "e0000000-0000-0000-0000-000000000001",
  organizationId: "a0000000-0000-0000-0000-000000000001",
  role: "SUPERVISOR",
  status: "ACTIVE",
};

function createMockIntakeViewModel(
  row: Record<string, unknown>,
): FreightRequestIntakeViewModel {
  return {
    schemaVersion: "1.0",
    freightRequestId: row.id as string,
    requestCode: row.code as string,
    draftVersion: row.draft_version as number,
    organization: {
      id: row.organization_id as string,
      name: "ACME Mining Perú",
      defaultCurrency: "USD",
    },
    currentOperator: {
      memberId: row.requested_by_member_id as string,
      displayName: "Supervisor ACME",
    },
    status: "DRAFT",
    cargo: {
      profileName: null,
      categoryName: "Maquinaria",
      categoryCode: "MACHINERY",
      entryMethod: row.cargo_entry_method as string,
      quantity: row.entry_quantity as number | null,
      unitsPerEntry: row.units_per_entry as number | null,
      unitWeightKg: row.entry_unit_weight_kg as number | null,
      lengthCm: row.entry_length_cm as number | null,
      widthCm: row.entry_width_cm as number | null,
      heightCm: row.entry_height_cm as number | null,
      totalWeightKg: row.cargo_weight_kg as number,
      totalVolumeM3: row.cargo_volume_m3 as number | null,
    },
    route: {
      origin: `${row.origin_city}, ${row.origin_country}`,
      destination: `${row.destination_city}, ${row.destination_country}`,
      originCountry: row.origin_country as string,
      originRegion: row.origin_region as string | null,
      originCity: row.origin_city as string,
      originAddress: row.origin_address as string | null,
      destinationCountry: row.destination_country as string,
      destinationRegion: row.destination_region as string | null,
      destinationCity: row.destination_city as string,
      destinationAddress: row.destination_address as string | null,
      pickupContact: {
        name: row.pickup_contact_name as string | null,
        phone: row.pickup_contact_phone as string | null,
      },
      deliveryContact: {
        name: row.receiver_name as string | null,
        company: row.receiver_company as string | null,
        phone: row.receiver_phone as string | null,
      },
      operationalNotes: row.special_instructions as string | null,
    },
    execution: {
      transportMode: row.transport_mode as "ROAD",
      serviceType: row.service_type as "FTL",
      pickupMode: (row.pickup_mode as "ASAP" | "SCHEDULED") || "SCHEDULED",
      requiredPickup: row.required_pickup as string,
      pickupWindowStart: row.pickup_window_start as string | null,
      pickupWindowEnd: row.pickup_window_end as string | null,
      deliveryDeadline: row.delivery_deadline as string | null,
      budgetMax: row.budget_max as number | null,
      strategy: (row.optimization_strategy as "BALANCED") || "BALANCED",
      availableDocuments: row.available_documents as string[],
    },
    updatedAt: row.created_at as string,
  };
}

function createTestDependencies(overrides: Partial<DraftCreationDependencies> = {}): {
  deps: DraftCreationDependencies;
  insertedRows: Record<string, unknown>[];
} {
  const insertedRows: Record<string, unknown>[] = [];

  const deps: DraftCreationDependencies = {
    resolveMember: async () => SUPERVISOR_MEMBER,
    resolveCargoCategoryId: async () => "c0000000-0000-0000-0000-000000000001",
    generateRequestCode: async () => "FR-3301",
    insertFreightRequest: async (row) => {
      insertedRows.push(row);
      return { id: row.id as string, code: row.code as string };
    },
    loadIntake: async (requestCode) => {
      const row = insertedRows.find((r) => r.code === requestCode);
      if (!row) throw new Error("Not found in test");
      return createMockIntakeViewModel(row);
    },
    ...overrides,
  };

  return { deps, insertedRows };
}

test("1. Authenticated SUPERVISOR creates a draft with server-assigned UUID, requestCode, and draftVersion: 1", async () => {
  const { deps, insertedRows } = createTestDependencies();

  const payload = {
    fields: {
      cargoCategoryCode: "MACHINERY",
      originCity: "Callao",
      destinationCity: "Santiago",
      cargoEntryMethod: "PALLETS",
      entryQuantity: 10,
      entryUnitWeightKg: 800,
      unitsPerEntry: 1,
      entryLengthCm: 120,
      entryWidthCm: 100,
      entryHeightCm: 150,
    },
  };

  const result = await createFreightRequestDraftWithDependencies(payload, deps);

  assert.equal(insertedRows.length, 1);
  const inserted = insertedRows[0];

  // Server-assigned values
  assert.equal(inserted.organization_id, SUPERVISOR_MEMBER.organizationId);
  assert.equal(inserted.requested_by_member_id, SUPERVISOR_MEMBER.memberId);
  assert.equal(inserted.draft_version, 1);
  assert.equal(inserted.status, "DRAFT");
  assert.equal(inserted.code, "FR-3301");
  assert.ok(typeof inserted.id === "string" && inserted.id.length > 0);

  // Returned ViewModel snapshot
  assert.equal(result.requestCode, "FR-3301");
  assert.equal(result.draftVersion, 1);
  assert.equal(result.status, "DRAFT");
  assert.equal(result.organization.id, SUPERVISOR_MEMBER.organizationId);
  assert.equal(result.currentOperator.memberId, SUPERVISOR_MEMBER.memberId);
});

test("2. Unauthenticated caller is rejected with 401 error", async () => {
  const { deps } = createTestDependencies({
    resolveMember: async () => {
      throw new Error("UNAUTHENTICATED: No valid active session.");
    },
  });

  await assert.rejects(
    () => createFreightRequestDraftWithDependencies({ fields: { originCity: "Callao" } }, deps),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /UNAUTHENTICATED/);
      return true;
    },
  );
});

test("3. Non-SUPERVISOR role (e.g. REQUESTER) is rejected with 403 error", async () => {
  const { deps } = createTestDependencies({
    resolveMember: async () => {
      throw new Error("FORBIDDEN: Requires SUPERVISOR role.");
    },
  });

  await assert.rejects(
    () => createFreightRequestDraftWithDependencies({ fields: { originCity: "Callao" } }, deps),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /FORBIDDEN/);
      return true;
    },
  );
});

test("4. Organization isolation: client cannot inject organizationId, memberId, code, or draftVersion", () => {
  assert.throws(
    () =>
      parseCreateFreightRequestDraftInput({
        fields: {
          originCity: "Callao",
          organizationId: "a9999999-9999-9999-9999-999999999999",
        },
      }),
    /No se permite especificar 'organizationId'/,
  );

  assert.throws(
    () =>
      parseCreateFreightRequestDraftInput({
        fields: {
          originCity: "Callao",
          requestCode: "FR-HACKED",
        },
      }),
    /No se permite especificar 'requestCode'/,
  );

  assert.throws(
    () =>
      parseCreateFreightRequestDraftInput({
        fields: {
          originCity: "Callao",
          draftVersion: 99,
        },
      }),
    /No se permite especificar 'draftVersion'/,
  );
});

test("5. Canonical recalculation: weight, volume, and cross-border derived by server", async () => {
  const { deps, insertedRows } = createTestDependencies();

  const unitizedPayload = {
    fields: {
      originCountry: "PE",
      originCity: "Lima",
      destinationCountry: "CL",
      destinationCity: "Santiago",
      cargoEntryMethod: "PALLETS",
      entryQuantity: 4,
      entryUnitWeightKg: 500,
      unitsPerEntry: 2,
      entryLengthCm: 120,
      entryWidthCm: 100,
      entryHeightCm: 50,
    },
  };

  await createFreightRequestDraftWithDependencies(unitizedPayload, deps);

  assert.equal(insertedRows.length, 1);
  const inserted = insertedRows[0];

  // 4 * 500 * 2 = 4,000 kg
  assert.equal(inserted.cargo_weight_kg, 4000);
  // (4 * 2 * 120 * 100 * 50) / 1,000,000 = 4.8 m³
  assert.equal(inserted.cargo_volume_m3, 4.8);
  // PE !== CL => cross_border: true
  assert.equal(inserted.cross_border, true);

  // Domestic route: PE -> PE => cross_border: false
  const { deps: depsDomestic, insertedRows: insertedDomestic } = createTestDependencies();
  await createFreightRequestDraftWithDependencies(
    {
      fields: {
        originCountry: "PE",
        originCity: "Lima",
        destinationCountry: "PE",
        destinationCity: "Arequipa",
        cargoEntryMethod: "TOTAL_WEIGHT",
        totalWeightKg: 3000,
      },
    },
    depsDomestic,
  );
  assert.equal(insertedDomestic[0].cross_border, false);
  assert.equal(insertedDomestic[0].cargo_weight_kg, 3000);
});

test("6. Active special requirements are explicitly rejected as unsupported (422)", async () => {
  const { deps } = createTestDependencies();

  const reeferPayload = {
    fields: {
      originCity: "Callao",
      requiresRefrigeration: true,
    },
  };

  await assert.rejects(
    () => createFreightRequestDraftWithDependencies(reeferPayload, deps),
    (error: unknown) => {
      assert.ok(error instanceof RecommendationDraftError);
      assert.equal(error.code, "UNSUPPORTED_SPECIAL_REQUIREMENTS");
      assert.equal(error.httpStatus, 422);
      return true;
    },
  );

  const hazmatPayload = {
    fields: {
      originCity: "Callao",
      isHazardous: true,
    },
  };

  await assert.rejects(
    () => createFreightRequestDraftWithDependencies(hazmatPayload, deps),
    (error: unknown) => {
      assert.ok(error instanceof RecommendationDraftError);
      assert.equal(error.code, "UNSUPPORTED_SPECIAL_REQUIREMENTS");
      assert.equal(error.httpStatus, 422);
      return true;
    },
  );

  const oversizedPayload = {
    fields: {
      originCity: "Callao",
      isOversized: true,
    },
  };

  await assert.rejects(
    () => createFreightRequestDraftWithDependencies(oversizedPayload, deps),
    (error: unknown) => {
      assert.ok(error instanceof RecommendationDraftError);
      assert.equal(error.code, "UNSUPPORTED_SPECIAL_REQUIREMENTS");
      assert.equal(error.httpStatus, 422);
      return true;
    },
  );
});

test("7. Inactive special flags (false or null) are accepted without error", async () => {
  const { deps, insertedRows } = createTestDependencies();

  const payload = {
    fields: {
      originCity: "Callao",
      requiresRefrigeration: false,
      temperatureMinC: null,
      temperatureMaxC: null,
      isHazardous: false,
      isOversized: false,
      isFragile: false,
    },
  };

  const result = await createFreightRequestDraftWithDependencies(payload, deps);
  assert.equal(insertedRows.length, 1);
  assert.equal(result.requestCode, "FR-3301");
});

import assert from "node:assert/strict";
import test from "node:test";

import type { AuthenticatedMemberContext } from "@/server/auth/member";
import type { FreightRequestDraftRow } from "@/features/recommendations/recommendation-draft-contracts";
import type { FreightRequestIntakeViewModel } from "@/features/freight-requests/intake-contracts";
import { RecommendationDraftError } from "@/features/recommendations/recommendation-draft-contracts";
import {
  submitFreightRequestDraftWithDependencies,
  type DraftSubmissionDependencies,
} from "./draft-submission-policy";

const MOCK_MEMBER: AuthenticatedMemberContext = {
  userId: "d0000000-0000-0000-0000-000000000001",
  userEmail: "supervisor@acme.cargomesh.test",
  memberId: "e0000000-0000-0000-0000-000000000001",
  organizationId: "a0000000-0000-0000-0000-000000000001",
  role: "SUPERVISOR",
  status: "ACTIVE",
};

function createValidDraftRow(
  overrides: Partial<FreightRequestDraftRow> = {},
): FreightRequestDraftRow {
  return {
    id: "10000000-0000-0000-0000-000000000001",
    organization_id: MOCK_MEMBER.organizationId,
    code: "FR-3001",
    cargo_category_id: "c0000000-0000-0000-0000-000000000001",
    draft_version: 1,
    origin_country: "PE",
    origin_region: "Callao",
    origin_city: "Callao",
    origin_address: "Av. Elmer Faucett 123",
    pickup_contact_name: "Contacto Origen",
    pickup_contact_phone: "+51999888777",
    destination_country: "CL",
    destination_region: "Metropolitana",
    destination_city: "Santiago",
    destination_address: "Av. Libertador 456",
    receiver_name: "Contacto Destino",
    receiver_company: "Cliente Chile S.A.",
    receiver_phone: "+56911223344",
    cargo_description: "Carga general paletizada",
    cargo_entry_method: "PALLETS",
    entry_quantity: 10,
    entry_unit_weight_kg: 800,
    units_per_entry: 1,
    entry_length_cm: 120,
    entry_width_cm: 100,
    entry_height_cm: 150,
    package_count: 10,
    cargo_specifications: {},
    requires_refrigeration: false,
    temperature_min_c: null,
    temperature_max_c: null,
    is_hazardous: false,
    is_fragile: false,
    is_oversized: false,
    is_high_value: false,
    is_stackable: true,
    special_instructions: null,
    pickup_mode: "SCHEDULED",
    pickup_window_start: "2026-10-01T08:00:00Z",
    pickup_window_end: "2026-10-01T12:00:00Z",
    required_pickup: "2026-10-01T08:00:00Z",
    delivery_deadline: "2026-10-05T18:00:00Z",
    budget_max: 3500,
    optimization_strategy: "BALANCED",
    available_documents: ["GUIDE"],
    cross_border: true,
    cargo_weight_kg: 8000,
    cargo_volume_m3: 18,
    service_type: "FTL",
    transport_mode: "ROAD",
    status: "DRAFT",
    ...overrides,
  };
}

function createMockIntakeViewModel(
  row: FreightRequestDraftRow,
): FreightRequestIntakeViewModel {
  return {
    schemaVersion: "1.0",
    freightRequestId: row.id,
    requestCode: row.code,
    draftVersion: row.draft_version,
    organization: {
      id: row.organization_id,
      name: "ACME Mining Perú",
      defaultCurrency: "USD",
    },
    currentOperator: {
      memberId: MOCK_MEMBER.memberId,
      displayName: "Supervisor ACME",
    },
    status: row.status as FreightRequestIntakeViewModel["status"],
    cargo: {
      profileName: null,
      categoryName: "Maquinaria",
      categoryCode: "MACHINERY",
      description: row.cargo_description,
      entryMethod: row.cargo_entry_method,
      quantity: row.entry_quantity,
      unitsPerEntry: row.units_per_entry,
      unitWeightKg: row.entry_unit_weight_kg,
      lengthCm: row.entry_length_cm,
      widthCm: row.entry_width_cm,
      heightCm: row.entry_height_cm,
      totalWeightKg: row.cargo_weight_kg,
      totalVolumeM3: row.cargo_volume_m3,
      requiresRefrigeration: row.requires_refrigeration,
      temperatureMinC: row.temperature_min_c,
      temperatureMaxC: row.temperature_max_c,
      isHazardous: row.is_hazardous,
      isOversized: row.is_oversized,
      isFragile: row.is_fragile,
    },
    route: {
      origin: `${row.origin_city}, ${row.origin_country}`,
      destination: `${row.destination_city}, ${row.destination_country}`,
      originCountry: row.origin_country,
      originRegion: row.origin_region,
      originCity: row.origin_city,
      originAddress: row.origin_address,
      destinationCountry: row.destination_country,
      destinationRegion: row.destination_region,
      destinationCity: row.destination_city,
      destinationAddress: row.destination_address,
      pickupContact: {
        name: row.pickup_contact_name,
        phone: row.pickup_contact_phone,
      },
      deliveryContact: {
        name: row.receiver_name,
        company: row.receiver_company,
        phone: row.receiver_phone,
      },
      operationalNotes: row.special_instructions,
    },
    execution: {
      transportMode: "ROAD",
      serviceType: "FTL",
      pickupMode: (row.pickup_mode as "ASAP" | "SCHEDULED") || "SCHEDULED",
      requiredPickup: row.required_pickup,
      pickupWindowStart: row.pickup_window_start,
      pickupWindowEnd: row.pickup_window_end,
      deliveryDeadline: row.delivery_deadline,
      budgetMax: row.budget_max,
      strategy: "BALANCED",
      availableDocuments: (row.available_documents as string[]) ?? [],
    },
    updatedAt: new Date().toISOString(),
  };
}

function createTestDeps(
  initialRow: FreightRequestDraftRow,
  overrides: Partial<DraftSubmissionDependencies> = {},
) {
  let currentRow = { ...initialRow };
  const deps: DraftSubmissionDependencies = {
    resolveMember: async () => ({ ...MOCK_MEMBER }),
    findDraft: async (id) => (currentRow.id === id ? { ...currentRow } : null),
    validateCargoCategory: async (catId) =>
      catId === "c0000000-0000-0000-0000-000000000001",
    updateStatusToPending: async (current, newVersion) => {
      currentRow = {
        ...current,
        status: "PENDING",
        draft_version: newVersion,
      };
      return { ...currentRow };
    },
    loadIntake: async (code) => {
      assert.equal(code, currentRow.code);
      return createMockIntakeViewModel(currentRow);
    },
    ...overrides,
  };
  return { deps, getCurrentRow: () => currentRow };
}

test("1. Successfully transitions DRAFT to PENDING and increments draftVersion by +1", async () => {
  const initialRow = createValidDraftRow({ draft_version: 1, status: "DRAFT" });
  const { deps, getCurrentRow } = createTestDeps(initialRow);

  const result = await submitFreightRequestDraftWithDependencies(
    initialRow.id,
    { draftVersion: 1 },
    deps,
  );

  assert.equal(result.status, "PENDING");
  assert.equal(result.draftVersion, 2);
  assert.equal(getCurrentRow().status, "PENDING");
  assert.equal(getCurrentRow().draft_version, 2);
});

test("2. Rejects with 409 STALE_DRAFT when input draftVersion does not match current version", async () => {
  const initialRow = createValidDraftRow({ draft_version: 2, status: "DRAFT" });
  const { deps } = createTestDeps(initialRow);

  await assert.rejects(
    () =>
      submitFreightRequestDraftWithDependencies(
        initialRow.id,
        { draftVersion: 1 },
        deps,
      ),
    (err: unknown) => {
      assert.ok(err instanceof RecommendationDraftError);
      assert.equal(err.code, "STALE_DRAFT");
      assert.equal(err.httpStatus, 409);
      return true;
    },
  );
});

test("3. Idempotently replays and returns intake if draft is ALREADY in PENDING status", async () => {
  const initialRow = createValidDraftRow({ draft_version: 2, status: "PENDING" });
  let updateCalled = false;
  const { deps } = createTestDeps(initialRow, {
    updateStatusToPending: async () => {
      updateCalled = true;
      return null;
    },
  });

  const result = await submitFreightRequestDraftWithDependencies(
    initialRow.id,
    { draftVersion: 2 },
    deps,
  );

  assert.equal(result.status, "PENDING");
  assert.equal(result.draftVersion, 2);
  assert.equal(updateCalled, false, "updateStatusToPending should not be called on replay");
});

test("4. Rejects with 422 INVALID_DRAFT if status is non-submittable (e.g. ORCHESTRATING or BOOKED)", async () => {
  for (const status of ["ORCHESTRATING", "BOOKED", "CANCELLED", "FAILED"]) {
    const initialRow = createValidDraftRow({ draft_version: 1, status });
    const { deps } = createTestDeps(initialRow);

    await assert.rejects(
      () =>
        submitFreightRequestDraftWithDependencies(
          initialRow.id,
          { draftVersion: 1 },
          deps,
        ),
      (err: unknown) => {
        assert.ok(err instanceof RecommendationDraftError);
        assert.equal(err.code, "INVALID_DRAFT");
        assert.equal(err.httpStatus, 422);
        return true;
      },
    );
  }
});

test("5. Minimum fields validation: rejects with 422 when origin is missing or empty", async () => {
  const rowNoCity = createValidDraftRow({ origin_city: "" });
  const { deps: deps1 } = createTestDeps(rowNoCity);
  await assert.rejects(
    () => submitFreightRequestDraftWithDependencies(rowNoCity.id, { draftVersion: 1 }, deps1),
    (err: unknown) => {
      assert.ok(err instanceof RecommendationDraftError);
      assert.equal(err.code, "INVALID_DRAFT");
      assert.match(err.message, /origen/i);
      return true;
    },
  );

  const rowNoCountry = createValidDraftRow({ origin_country: "" });
  const { deps: deps2 } = createTestDeps(rowNoCountry);
  await assert.rejects(
    () => submitFreightRequestDraftWithDependencies(rowNoCountry.id, { draftVersion: 1 }, deps2),
    (err: unknown) => {
      assert.ok(err instanceof RecommendationDraftError);
      assert.equal(err.code, "INVALID_DRAFT");
      assert.match(err.message, /origen/i);
      return true;
    },
  );
});

test("6. Minimum fields validation: rejects with 422 when destination is missing or empty", async () => {
  const rowNoCity = createValidDraftRow({ destination_city: "" });
  const { deps: deps1 } = createTestDeps(rowNoCity);
  await assert.rejects(
    () => submitFreightRequestDraftWithDependencies(rowNoCity.id, { draftVersion: 1 }, deps1),
    (err: unknown) => {
      assert.ok(err instanceof RecommendationDraftError);
      assert.equal(err.code, "INVALID_DRAFT");
      assert.match(err.message, /destino/i);
      return true;
    },
  );

  const rowNoCountry = createValidDraftRow({ destination_country: "" });
  const { deps: deps2 } = createTestDeps(rowNoCountry);
  await assert.rejects(
    () => submitFreightRequestDraftWithDependencies(rowNoCountry.id, { draftVersion: 1 }, deps2),
    (err: unknown) => {
      assert.ok(err instanceof RecommendationDraftError);
      assert.equal(err.code, "INVALID_DRAFT");
      assert.match(err.message, /destino/i);
      return true;
    },
  );
});

test("7. Minimum fields validation: rejects with 422 when cargo category is missing or invalid", async () => {
  const rowNoCategory = createValidDraftRow({ cargo_category_id: "" });
  const { deps: deps1 } = createTestDeps(rowNoCategory);
  await assert.rejects(
    () => submitFreightRequestDraftWithDependencies(rowNoCategory.id, { draftVersion: 1 }, deps1),
    (err: unknown) => {
      assert.ok(err instanceof RecommendationDraftError);
      assert.equal(err.code, "INVALID_DRAFT");
      assert.match(err.message, /categoría/i);
      return true;
    },
  );

  const rowInvalidCat = createValidDraftRow({ cargo_category_id: "c9999999-9999-9999-9999-999999999999" });
  const { deps: deps2 } = createTestDeps(rowInvalidCat, {
    validateCargoCategory: async () => false,
  });
  await assert.rejects(
    () => submitFreightRequestDraftWithDependencies(rowInvalidCat.id, { draftVersion: 1 }, deps2),
    (err: unknown) => {
      assert.ok(err instanceof RecommendationDraftError);
      assert.equal(err.code, "INVALID_DRAFT");
      assert.match(err.message, /categoría.*no existe/i);
      return true;
    },
  );
});

test("8. Minimum fields validation: rejects with 422 when cargo weight is 0 or negative", async () => {
  const rowZeroWeight = createValidDraftRow({ cargo_weight_kg: 0 });
  const { deps: deps1 } = createTestDeps(rowZeroWeight);
  await assert.rejects(
    () => submitFreightRequestDraftWithDependencies(rowZeroWeight.id, { draftVersion: 1 }, deps1),
    (err: unknown) => {
      assert.ok(err instanceof RecommendationDraftError);
      assert.equal(err.code, "INVALID_DRAFT");
      assert.match(err.message, /peso/i);
      return true;
    },
  );
});

test("9. Rejects unauthenticated caller and non-supervisor roles", async () => {
  const initialRow = createValidDraftRow();
  const { deps: depsUnauth } = createTestDeps(initialRow, {
    resolveMember: async () => {
      throw new RecommendationDraftError("UNAUTHENTICATED", "No session", 401);
    },
  });

  await assert.rejects(
    () => submitFreightRequestDraftWithDependencies(initialRow.id, { draftVersion: 1 }, depsUnauth),
    (err: unknown) => {
      assert.ok(err instanceof RecommendationDraftError);
      assert.equal(err.httpStatus, 401);
      return true;
    },
  );

  const { deps: depsRequester } = createTestDeps(initialRow, {
    resolveMember: async () => ({ ...MOCK_MEMBER, role: "REQUESTER" }),
  });

  await assert.rejects(
    () => submitFreightRequestDraftWithDependencies(initialRow.id, { draftVersion: 1 }, depsRequester),
    (err: unknown) => {
      assert.ok(err instanceof RecommendationDraftError);
      assert.equal(err.code, "FORBIDDEN");
      assert.equal(err.httpStatus, 403);
      return true;
    },
  );
});

test("10. Rejects when member does not belong to the draft organization", async () => {
  const initialRow = createValidDraftRow({ organization_id: "a9999999-9999-9999-9999-999999999999" });
  const { deps } = createTestDeps(initialRow);

  await assert.rejects(
    () => submitFreightRequestDraftWithDependencies(initialRow.id, { draftVersion: 1 }, deps),
    (err: unknown) => {
      assert.ok(err instanceof RecommendationDraftError);
      assert.equal(err.code, "FORBIDDEN");
      assert.equal(err.httpStatus, 403);
      return true;
    },
  );
});

test("11. Rejects invalid freightRequestId format with 400", async () => {
  const { deps } = createTestDeps(createValidDraftRow());

  await assert.rejects(
    () => submitFreightRequestDraftWithDependencies("invalid-uuid", { draftVersion: 1 }, deps),
    (err: unknown) => {
      assert.ok(err instanceof RecommendationDraftError);
      assert.equal(err.code, "INVALID_ARGUMENT");
      assert.equal(err.httpStatus, 400);
      return true;
    },
  );
});

test("12. Concurrent race condition on DB update throws 409 STALE_DRAFT", async () => {
  const initialRow = createValidDraftRow();
  const { deps } = createTestDeps(initialRow, {
    updateStatusToPending: async () => null, // simulates 0 rows updated due to concurrency race
  });

  await assert.rejects(
    () => submitFreightRequestDraftWithDependencies(initialRow.id, { draftVersion: 1 }, deps),
    (err: unknown) => {
      assert.ok(err instanceof RecommendationDraftError);
      assert.equal(err.code, "STALE_DRAFT");
      assert.equal(err.httpStatus, 409);
      return true;
    },
  );
});

import assert from "node:assert/strict";
import test from "node:test";

import { createFreightIntakeFixture } from "@/features/freight-ui/ui-fixtures";
import {
  applyFreightRequestDraftToIntake,
  RecommendationAcceptanceError,
  persistAndRevalidateRecommendation,
} from "./recommendation-acceptance";
import {
  fetchFreightRequestDraft,
  persistFreightRecommendationDraft,
} from "./recommendation-draft-client";
import type { FreightRequestDraft } from "./recommendation-draft-contracts";

const freightRequestId = "f2000000-0000-0000-0000-000000000001";

function draftFixture(draftVersion = 2): FreightRequestDraft {
  return {
    schemaVersion: "1.0",
    freightRequestId,
    requestCode: "FR-1042",
    draftVersion,
    fields: {
      origin_country: "PE",
      origin_city: "Lima",
      destination_country: "CL",
      destination_city: "Santiago",
      cargo_category_id: "c0000000-0000-0000-0000-000000000005",
      cargo_entry_method: "PALLETS",
      entry_quantity: 5,
      entry_unit_weight_kg: 800,
      units_per_entry: 2,
    },
    normalized: {
      cargoWeightKg: 8_000,
      cargoVolumeM3: 18,
    },
  };
}

test("PATCH sends only the D1-01 contract and returns the canonical draft", async () => {
  const controller = new AbortController();
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const result = await persistFreightRecommendationDraft(
    {
      freightRequestId,
      draftVersion: 1,
      acceptedFields: {
        entry_quantity: 5,
        units_per_entry: 2,
      },
    },
    controller.signal,
    async (url, init) => {
      calls.push({ url: String(url), init });
      return Response.json({ ok: true, data: { draft: draftFixture() } });
    },
  );

  assert.equal(result.draftVersion, 2);
  assert.equal(result.normalized.cargoWeightKg, 8_000);
  assert.equal(calls[0]?.url, `/api/freight-requests/${freightRequestId}/draft`);
  assert.equal(calls[0]?.init?.method, "PATCH");
  assert.equal(calls[0]?.init?.credentials, "same-origin");
  assert.equal(calls[0]?.init?.cache, "no-store");
  assert.strictEqual(calls[0]?.init?.signal, controller.signal);
  assert.deepEqual(JSON.parse(String(calls[0]?.init?.body)), {
    draftVersion: 1,
    proposedFields: {
      entry_quantity: 5,
      units_per_entry: 2,
    },
  });
});

test("acceptance crosses PATCH and adopts the incremented version and server totals", async () => {
  const current = createFreightIntakeFixture();
  const persisted = await persistAndRevalidateRecommendation(
    current,
    {
      entry_quantity: 5,
      units_per_entry: 2,
    },
    (input, signal) => persistFreightRecommendationDraft(
      input,
      signal,
      async () => Response.json({ ok: true, data: { draft: draftFixture() } }),
    ),
    new AbortController().signal,
  );

  assert.equal(persisted.draftVersion, 2);
  assert.equal(persisted.quantity, 5);
  assert.equal(persisted.unitsPerEntry, 2);
  assert.equal(persisted.cargoWeightKg, 8_000);
  assert.equal(persisted.cargoVolumeM3, 18);
});

test("GET loads the current canonical draft with the authenticated session", async () => {
  const controller = new AbortController();
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const result = await fetchFreightRequestDraft(
    freightRequestId,
    controller.signal,
    async (url, init) => {
      calls.push({ url: String(url), init });
      return Response.json({ ok: true, data: draftFixture(4) });
    },
  );

  assert.equal(result.draftVersion, 4);
  assert.equal(calls[0]?.init?.method, "GET");
  assert.equal(calls[0]?.init?.credentials, "same-origin");
  assert.equal(calls[0]?.init?.cache, "no-store");
  assert.strictEqual(calls[0]?.init?.signal, controller.signal);
});

test("HTTP 409 maps exclusively to STALE_DRAFT without fabricating a draft", async () => {
  await assert.rejects(
    persistFreightRecommendationDraft(
      {
        freightRequestId,
        draftVersion: 1,
        acceptedFields: { origin_city: "Arequipa" },
      },
      new AbortController().signal,
      async () => Response.json(
        {
          ok: false,
          error: {
            code: "STALE_DRAFT",
            message: "El borrador cambió; no se aplicó ninguna sugerencia.",
          },
        },
        { status: 409 },
      ),
    ),
    (error: unknown) =>
      error instanceof RecommendationAcceptanceError &&
      error.code === "STALE_DRAFT",
  );
});

test("STALE_DRAFT reload replaces omitted optional fields with the canonical snapshot", async () => {
  const current = createFreightIntakeFixture();
  await assert.rejects(
    persistFreightRecommendationDraft(
      {
        freightRequestId,
        draftVersion: current.draftVersion,
        acceptedFields: { origin_city: "Arequipa" },
      },
      new AbortController().signal,
      async () => Response.json(
        {
          ok: false,
          error: {
            code: "STALE_DRAFT",
            message: "El borrador cambió; vuelve a cargarlo.",
          },
        },
        { status: 409 },
      ),
    ),
    (error: unknown) =>
      error instanceof RecommendationAcceptanceError &&
      error.code === "STALE_DRAFT",
  );

  const canonical = draftFixture(5);
  delete canonical.fields.origin_address;
  canonical.fields.pickup_mode = "ASAP";
  delete canonical.fields.pickup_window_start;
  delete canonical.fields.pickup_window_end;
  const reloaded = await fetchFreightRequestDraft(
    freightRequestId,
    new AbortController().signal,
    async () => Response.json({ ok: true, data: canonical }),
  );
  const adopted = applyFreightRequestDraftToIntake(current, reloaded);

  assert.equal(adopted.draftVersion, 5);
  assert.equal(adopted.originAddress, "");
  assert.equal(adopted.pickupMode, "ASAP");
  assert.equal(adopted.requiredPickup, "");
  assert.equal(adopted.pickupWindowStart, "");
  assert.equal(adopted.pickupWindowEnd, "");
});

test("an uncorrelated or malformed success response is rejected", async () => {
  await assert.rejects(
    persistFreightRecommendationDraft(
      {
        freightRequestId,
        draftVersion: 1,
        acceptedFields: { origin_city: "Arequipa" },
      },
      new AbortController().signal,
      async () => Response.json({
        ok: true,
        data: {
          draft: {
            ...draftFixture(),
            freightRequestId: "f2000000-0000-0000-0000-000000000099",
          },
        },
      }),
    ),
    (error: unknown) =>
      error instanceof RecommendationAcceptanceError &&
      error.code === "INVALID_CANONICAL_DRAFT",
  );
});

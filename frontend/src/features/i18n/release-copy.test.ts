import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (relativePath: string) => readFileSync(
  new URL(relativePath, import.meta.url),
  "utf8",
);

test("the judge flow exposes bilingual intake, recommendation, provider and booking copy", () => {
  const intake = source("../../components/freight-intake-form.tsx");
  const recommendations = source("../recommendations/freight-recommendation-panel.tsx");
  const provider = source("../../app/providers/[carrierSlug]/provider-webmcp-host.tsx");
  const booking = source("../../components/booking-workspace.tsx");

  assert.match(intake, /New freight request/);
  assert.match(intake, /Saved; subject to provider coverage and capacity validation/);
  assert.doesNotMatch(intake, /Pendiente de persistencia y validación operativa/);
  assert.match(recommendations, /Human review required/);
  assert.match(recommendations, /Apply not configured/);
  assert.match(provider, /Available tools/);
  assert.match(booking, /Causal evidence/);
});

test("canonical protocol values remain untranslated", () => {
  const intake = source("../../components/freight-intake-form.tsx");
  const provider = source("../../app/providers/[carrierSlug]/provider-webmcp-host.tsx");

  for (const canonical of ["BALANCED", "STALE_DRAFT", "TOTAL_WEIGHT", "SCHEDULED", "ASAP"]) {
    assert.match(intake, new RegExp(canonical));
  }
  for (const tool of ["book_freight", "get_provider_booking_status"]) {
    assert.match(provider, new RegExp(tool));
  }
});

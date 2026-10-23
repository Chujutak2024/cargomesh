import assert from "node:assert/strict";
import test from "node:test";
import { draftReviewRows } from "./draft-review-presentation";
import { getIntakeOptionsFixture } from "./intake-options";
import { requestToPrototypeDraft } from "./prototype-model";
import { ROAD_REQUEST_FIXTURE } from "./fixtures/contract-flow.fixture";
import { canApproveDraftReview, proposeDraftReview } from "./draft-review";

test("review shows all cargo groups, alternatives and booleans without internal metadata or object coercions", () => {
  const draft = requestToPrototypeDraft(ROAD_REQUEST_FIXTURE)!;
  draft.additionalUnits = [{ id: "private-ui-id", originalIndex: 1, unitPackageType: "BOX", unitQuantity: "3", unitWeightPerUnitKg: "15", unitVolumePerUnitM3: "0.5", unitLengthCm: "100", unitWidthCm: "100", unitHeightCm: "50", unitStackable: true, unitIndivisible: false }];
  draft.pickupAlternatives = [{ startsAt: "2026-10-25T08:00", endsAt: "2026-10-25T10:00" }];
  draft.deliveryAlternatives = [{ startsAt: "2026-10-27T09:00", endsAt: "2026-10-27T18:00" }];
  draft.urgency = "SCHEDULED"; draft.loadSize = "MEDIUM";
  draft.unitPackageType = "BOX";
  for (const language of ["es", "en"] as const) {
    const rows = draftReviewRows(draft, getIntakeOptionsFixture().data, language);
    const text = JSON.stringify(rows);
    for (const hidden of ["[object Object]", "primaryGroupId", "primaryOriginalIndex", "private-ui-id", "originalIndex"]) assert.ok(!text.includes(hidden));
    assert.ok(text.includes("15 kg/")); assert.ok(text.includes("100 × 100 × 50 cm"));
    assert.ok(text.includes("2026-10-25 08:00 → 2026-10-25 10:00"));
    assert.ok(text.includes("2026-10-27 09:00 → 2026-10-27 18:00"));
    assert.equal(new Set(rows.map(row => row.label)).size, rows.length);
    assert.ok(rows.some(row => row.label === (language === "es" ? "Embalaje del grupo 1" : "Group 1 packaging")));
    assert.equal(rows.find(row => row.label === (language === "es" ? "Apilable" : "Unit stackable"))?.value, "No");
  }
});

test("every correction invalidates an older confirmation, including additional groups and alternative dates", () => {
  const draft = requestToPrototypeDraft(ROAD_REQUEST_FIXTURE)!;
  const approval = proposeDraftReview(draft, 1000);
  assert.equal(canApproveDraftReview(approval, draft, 1001), true);
  assert.equal(canApproveDraftReview(approval, { ...draft, unitWeightPerUnitKg: "800" }, 1001), false);
  assert.equal(canApproveDraftReview(approval, { ...draft, pickupAlternatives: [{ startsAt: "2026-10-25T08:00", endsAt: "2026-10-25T10:00" }] }, 1001), false);
});
